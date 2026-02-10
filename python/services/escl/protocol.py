#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eSCL (AirPrint) Scanner Service
HTTP-based network scanner support
"""

import time
import base64
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from io import BytesIO
from decorators import handle_scanner_errors
from common.exceptions import ScannerError
from common.response import success_response
import logging

log = logging.getLogger(__name__)

from services.escl.discovery import ESCLScannerListener

try:
    from zeroconf import ServiceBrowser, Zeroconf
    from PIL import Image
    ESCL_AVAILABLE = True
except ImportError:
    ESCL_AVAILABLE = False

# eSCL namespaces
ESCL_NS = "http://schemas.hp.com/imaging/escl/2011/05/03"
PWG_NS = "http://www.pwg.org/schemas/2010/12/sm"


class ESCLProtocol:
    """eSCL (AirPrint) service for network scanners"""

    def __init__(self):
        if not ESCL_AVAILABLE:
            raise ImportError('eSCL libraries not found. Install with: pip install zeroconf pillow')

        self.discovered_scanners: list[dict] = []

    def _find_scanner(self, scanner_name: str) -> dict:
        """Find scanner by name from discovered scanners. Raises ScannerError if not found."""
        if not scanner_name: raise ScannerError('No scanner selected')

        scanner = next((s for s in self.discovered_scanners if s['name'] == scanner_name), None)

        if not scanner: raise ScannerError(f'Scanner information not found: {scanner_name}')
            
        return scanner

    @handle_scanner_errors
    def get_capabilities(self, params: dict) -> dict:
        """Retrieve and parse scanner capabilities"""
        selected = self._find_scanner(params.get('scanner'))
        host = selected['host']
        port = selected['port']

        # Retrieve capabilities
        url = f"http://{host}:{port}/eSCL/ScannerCapabilities"
        response = urllib.request.urlopen(url, timeout=5)
        content = response.read()

        root = ET.fromstring(content)

        # Parse supported resolutions
        resolutions = []
        res_elements = root.findall('.//{%s}DiscreteResolution' % ESCL_NS)
        for res in res_elements:
            x_res = res.find('.//{%s}XResolution' % ESCL_NS)
            if x_res is not None and x_res.text:
                resolutions.append(int(x_res.text))

        # Parse supported color modes
        color_modes = []
        mode_elements = root.findall('.//{%s}ColorMode' % ESCL_NS)
        for mode in mode_elements:
            if mode.text:
                color_modes.append(mode.text)

        # Check input sources (Platen, Adf support)
        input_sources = []
        if root.find('.//{%s}Platen' % ESCL_NS) is not None:
            input_sources.append('Platen')
        if root.find('.//{%s}Adf' % ESCL_NS) is not None:
            input_sources.append('Adf')

        # Remove duplicates and sort
        resolutions = sorted(list(set(resolutions)))
        color_modes = list(set(color_modes))

        log.info('Capabilities parsed: resolutions=%s, modes=%s, sources=%s', resolutions, color_modes, input_sources)

        return success_response(capabilities={
            'resolutions': resolutions,
            'colorModes': color_modes,
            'inputSources': input_sources
        })

    @handle_scanner_errors
    def list_scanners(self) -> dict:
        """Discover eSCL scanners on the network"""
        log.info('Scanner discovery started...')

        zeroconf = Zeroconf()
        listener = ESCLScannerListener()

        # eSCL service types
        services = [
            "_uscan._tcp.local.",
            "_uscans._tcp.local."
        ]

        _browsers = [ServiceBrowser(zeroconf, service, listener) for service in services]

        # Wait 5 seconds for discovery
        time.sleep(5)

        zeroconf.close()

        log.info('Discovery complete: %d scanner(s) found', len(listener.scanners))

        # Store discovery results
        self.discovered_scanners = listener.scanners

        return success_response(scanners=listener.scanners, backend='eSCL')

    @handle_scanner_errors
    def scan(self, params: dict) -> dict:
        """Execute scan via eSCL protocol"""
        dpi = params.get('dpi', 300)
        mode = params.get('mode', 'gray')
        source = params.get('source', 'Platen')

        selected = self._find_scanner(params.get('scanner'))
        host = selected['host']
        port = selected['port']

        log.info('Scan started: %s:%s', host, port)

        # 1. Check scanner status
        self._check_scanner_status(host, port)

        # 1.5. Verify requested InputSource is supported
        supported_sources = self._get_supported_sources(host, port)
        if supported_sources and source not in supported_sources:
            raise ScannerError(f'Unsupported input source: {source}', context=f'supported: {supported_sources}')

        # 2. Create scan job
        job_url = self._create_scan_job(host, port, dpi, mode, source)

        # 3. Wait for scan to complete
        self._poll_until_scan_done(host, port)

        # 4. Download and process pages
        is_adf = (source == 'Feeder')
        scanned_images = self._download_and_process_pages(job_url, is_adf)

        # 5. Delete scan job
        self._delete_scan_job(job_url)

        if not scanned_images:
            raise ScannerError('Cannot retrieve scan results. Please verify document is loaded in scanner.')

        return success_response(
            images=scanned_images,
            count=len(scanned_images),
            backend='eSCL'
        )

    def _poll_until_scan_done(self, host: str, port: int, max_wait: int = 30, poll_interval: int = 1) -> None:
        """Poll /eSCL/ScannerStatus until scanner returns to Idle or Stopped."""
        log.info('Scan in progress... (polling ScannerStatus)')
        url = f"http://{host}:{port}/eSCL/ScannerStatus"
        elapsed = 0

        while elapsed < max_wait:
            response = urllib.request.urlopen(url, timeout=5)
            content = response.read()
            root = ET.fromstring(content)
            state = root.find('.//{%s}State' % PWG_NS)

            if state is not None:
                log.debug('Scanner state: %s', state.text)
                if state.text == 'Idle':
                    log.info('Scan completed (scanner idle)')
                    return
                if state.text == 'Stopped':
                    raise ScannerError('Scanner stopped during scan', context='Stopped')

            time.sleep(poll_interval)
            elapsed += poll_interval

        log.warning('Status polling timed out, attempting download anyway')

    def _download_and_process_pages(self, job_url: str, is_adf: bool) -> list[str]:
        """Download scanned pages and encode as base64. Returns list of base64 strings."""
        scanned_images = []
        page_num = 1

        while True:
            log.info('Attempting to download page %d...', page_num)
            image_data = self._download_scan_result(job_url)

            if not image_data:
                if page_num == 1:
                    self._delete_scan_job(job_url)
                    return []
                log.info('Scan complete: %d total pages', page_num - 1)
                break

            encoded = self._encode_page_image(image_data, page_num)
            if encoded:
                scanned_images.append(encoded)

            if not is_adf:
                break
            page_num += 1

        return scanned_images

    def _encode_page_image(self, image_data: bytes, page_num: int) -> str | None:
        """Encode a scanned page to base64 PNG. Returns base64 string or None."""
        try:
            img = Image.open(BytesIO(image_data))
            log.debug('Page %d original size: %dx%d', page_num, img.size[0], img.size[1])

            img = img.transpose(Image.Transpose.ROTATE_90)
            log.debug('Page %d size after rotation: %dx%d', page_num, img.size[0], img.size[1])

            buffer = BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')

        except Exception as img_error:
            log.error('Page %d image processing error: %s', page_num, img_error)
            return None

    def _check_scanner_status(self, host: str, port: int) -> None:
        """Check scanner status. Raises ScannerError if not idle."""
        url = f"http://{host}:{port}/eSCL/ScannerStatus"
        response = urllib.request.urlopen(url, timeout=5)
        content = response.read()

        root = ET.fromstring(content)
        state = root.find('.//{%s}State' % PWG_NS)

        if state is None or state.text != 'Idle':
            raise ScannerError('Scanner is not ready', context=state.text if state is not None else 'unknown')

        log.info('Scanner ready')

    def _get_supported_sources(self, host: str, port: int) -> list[str]:
        """Retrieve supported InputSource list from scanner capabilities."""
        url = f"http://{host}:{port}/eSCL/ScannerCapabilities"
        response = urllib.request.urlopen(url, timeout=5)
        content = response.read()

        log.debug('Capabilities XML:\n%s', content.decode('utf-8'))

        root = ET.fromstring(content)

        sources = root.findall('.//{%s}InputSource' % PWG_NS)
        source_list = [s.text for s in sources if s.text]
        log.info('Supported InputSource: %s', source_list)
        return source_list

    def _create_scan_job(self, host: str, port: int, resolution: int, color_mode: str, input_source: str) -> str:
        """Create scan job. Returns job URL. Raises ScannerError if job creation fails."""
        url = f"http://{host}:{port}/eSCL/ScanJobs"

        # Color mode mapping
        mode_map = {
            'gray': 'Grayscale8',
            'bw': 'BlackAndWhite1',
            'color': 'RGB24'
        }
        escl_mode = mode_map.get(color_mode, 'Grayscale8')

        scan_settings = f'''<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="{ESCL_NS}" xmlns:pwg="{PWG_NS}">
    <pwg:Version>2.0</pwg:Version>
    <scan:Intent>Document</scan:Intent>
    <pwg:ScanRegions>
        <pwg:ScanRegion>
            <pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>
            <pwg:XOffset>0</pwg:XOffset>
            <pwg:YOffset>0</pwg:YOffset>
            <pwg:Width>3508</pwg:Width>
            <pwg:Height>4961</pwg:Height>
        </pwg:ScanRegion>
    </pwg:ScanRegions>
    <scan:Justification>
        <pwg:XImagePosition>Center</pwg:XImagePosition>
        <pwg:YImagePosition>Center</pwg:YImagePosition>
    </scan:Justification>
    <pwg:InputSource>{input_source}</pwg:InputSource>
    <scan:ColorMode>{escl_mode}</scan:ColorMode>
    <scan:XResolution>{resolution}</scan:XResolution>
    <scan:YResolution>{resolution}</scan:YResolution>
    <pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat>
</scan:ScanSettings>'''

        log.debug('Sending XML:\n%s', scan_settings)

        data = scan_settings.encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'text/xml'})
        response = urllib.request.urlopen(req, timeout=10)

        job_url = response.headers.get('Location')
        if not job_url:
            raise ScannerError('Scanner did not return job URL')

        # Convert relative path to absolute path
        if job_url.startswith('/'):
            job_url = f"http://{host}:{port}{job_url}"

        log.info('Job created: %s', job_url)
        return job_url

    def _download_scan_result(self, job_url: str, quiet: bool = False) -> bytes | None:
        """Download scan result"""
        try:
            result_url = f"{job_url}/NextDocument"

            if not quiet:
                log.debug('Attempting to download result: %s', result_url)

            response = urllib.request.urlopen(result_url, timeout=10)
            content = response.read()

            log.info('Download complete: %d bytes', len(content))
            return content

        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            else:
                if not quiet:
                    log.error('Download failed: HTTP %d', e.code)
                return None
        except Exception as e:
            if not quiet:
                log.error('Download failed: %s', e)
            return None

    def _delete_scan_job(self, job_url: str) -> None:
        """Delete scan job (scanner auto-deletes on success, so errors are not critical)"""
        try:
            req = urllib.request.Request(job_url, method='DELETE')
            urllib.request.urlopen(req, timeout=10)
            log.info('Job deletion complete')

        except Exception:
            # On successful scan, scanner auto-deletes, so 404/500 errors are normal
            log.debug('Job deletion attempted (already deleted)')
