#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eSCL (AirPrint) Scanner Backend
HTTP-based network scanner support
"""

import sys
import time
import base64
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from io import BytesIO
from base import ScannerBackend

try:
    from zeroconf import ServiceBrowser, ServiceListener, Zeroconf
    from PIL import Image
    ESCL_AVAILABLE = True
except ImportError as e:
    ESCL_AVAILABLE = False

# eSCL namespaces
ESCL_NS = "http://schemas.hp.com/imaging/escl/2011/05/03"
PWG_NS = "http://www.pwg.org/schemas/2010/12/sm"


class ESCLScannerListener(ServiceListener):
    """eSCL Scanner Discovery Listener"""

    def __init__(self):
        self.scanners = []

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """Called when a scanner is discovered"""
        print(f'[eSCL] Scanner detected: {name}', file=sys.stderr, flush=True)

        info = zc.get_service_info(type_, name)

        if info and info.addresses:
            # Convert IPv4 address
            host = ".".join(map(str, info.addresses[0]))

            # Remove service type from mDNS name (e.g., "Canon iR-ADV C3525._uscan._tcp.local." -> "Canon iR-ADV C3525")
            clean_name = name.split('._')[0] if '._' in name else name

            scanner_info = {
                'name': clean_name,
                'host': host,
                'port': info.port,
                'type': type_
            }
            self.scanners.append(scanner_info)
            print(f'[eSCL] Scanner added: {clean_name} ({host}:{info.port})', file=sys.stderr, flush=True)

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """Called when a scanner is removed"""
        print(f'[eSCL] Scanner removed: {name}', file=sys.stderr, flush=True)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """Called when scanner information is updated (ignored)"""
        pass


class ESCLBackend(ScannerBackend):
    """eSCL (AirPrint) backend for network scanners"""

    def __init__(self):
        if not ESCL_AVAILABLE:
            raise ImportError('eSCL libraries not found. Install with: pip install zeroconf pillow')

        self.discovered_scanners = []

    def get_capabilities(self, params):
        """Retrieve and parse scanner capabilities"""
        try:
            scanner_name = params.get('scanner')

            if not scanner_name:
                return {
                    'success': False,
                    'error': 'No scanner selected'
                }

            # Find selected scanner information
            selected = None
            for s in self.discovered_scanners:
                if s['name'] == scanner_name:
                    selected = s
                    break

            if not selected:
                return {
                    'success': False,
                    'error': f'Scanner information not found: {scanner_name}'
                }

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

            print(f'[eSCL] Capabilities parsed: resolutions={resolutions}, modes={color_modes}, sources={input_sources}', file=sys.stderr, flush=True)

            return {
                'success': True,
                'capabilities': {
                    'resolutions': resolutions,
                    'colorModes': color_modes,
                    'inputSources': input_sources
                }
            }

        except Exception as e:
            print(f'[eSCL] Capabilities retrieval error: {str(e)}', file=sys.stderr, flush=True)
            return {
                'success': False,
                'error': f'Capabilities retrieval failed: {str(e)}'
            }

    def list_scanners(self):
        """Discover eSCL scanners on the network"""
        try:
            print('[eSCL] Scanner discovery started...', file=sys.stderr, flush=True)

            zeroconf = Zeroconf()
            listener = ESCLScannerListener()

            # eSCL service types
            services = [
                "_uscan._tcp.local.",
                "_uscans._tcp.local."
            ]

            browsers = [ServiceBrowser(zeroconf, service, listener) for service in services]

            # Wait 5 seconds for discovery
            time.sleep(5)

            zeroconf.close()

            print(f'[eSCL] Discovery complete: {len(listener.scanners)} scanner(s) found', file=sys.stderr, flush=True)

            # Store discovery results
            self.discovered_scanners = listener.scanners

            if listener.scanners:
                # Return scanner objects (including name, host, port)
                return {
                    'success': True,
                    'scanners': listener.scanners,
                    'backend': 'eSCL'
                }
            else:
                return {
                    'success': True,
                    'scanners': [],
                    'backend': 'eSCL'
                }

        except Exception as e:
            print(f'[eSCL] Error: {str(e)}', file=sys.stderr, flush=True)
            return {
                'success': False,
                'error': f'Scanner discovery failed: {str(e)}'
            }

    def scan(self, params):
        """Execute scan via eSCL protocol"""
        try:
            scanner_name = params.get('scanner')
            dpi = params.get('dpi', 300)
            mode = params.get('mode', 'gray')
            source = params.get('source', 'Platen')

            if not scanner_name:
                return {
                    'success': False,
                    'error': 'No scanner selected'
                }

            # Find selected scanner information
            selected = None
            for s in self.discovered_scanners:
                if s['name'] == scanner_name:
                    selected = s
                    break

            if not selected:
                return {
                    'success': False,
                    'error': f'Scanner information not found: {scanner_name}'
                }

            host = selected['host']
            port = selected['port']

            print(f'[eSCL] Scan started: {host}:{port}', file=sys.stderr, flush=True)

            # 1. Check scanner status
            if not self._check_scanner_status(host, port):
                return {
                    'success': False,
                    'error': 'Scanner is not ready'
                }

            # 1.5. Check scanner capabilities (verify supported InputSource)
            supported_sources = self._get_scanner_capabilities(host, port)
            if supported_sources:
                print(f'[eSCL] Requested source: {source}, supported: {supported_sources}', file=sys.stderr, flush=True)

            # 2. Create scan job (retry if 409 error occurs)
            job_url = self._create_scan_job(host, port, dpi, mode, source)

            # If 409 Conflict occurs, cleanup existing job and retry
            if not job_url:
                print('[eSCL] Possible 409 error - attempting to cleanup existing jobs', file=sys.stderr, flush=True)
                # TODO: Logic needed to retrieve and delete existing jobs
                return {
                    'success': False,
                    'error': 'Failed to create scan job - please restart the scanner'
                }

            if not job_url:
                return {
                    'success': False,
                    'error': 'Failed to create scan job'
                }

            # 3. Wait for scan to complete (poll job status)
            print('[eSCL] Scan in progress... (polling job status)', file=sys.stderr, flush=True)
            self._status_logged = False
            max_wait = 30
            poll_interval = 1
            elapsed = 0

            while elapsed < max_wait:
                status = self._check_job_status(job_url)
                if status == 'Completed':
                    print('[eSCL] Scan completed', file=sys.stderr, flush=True)
                    break
                if status in ('Aborted', 'Canceled'):
                    return {
                        'success': False,
                        'error': f'Scan job {status.lower()}'
                    }
                time.sleep(poll_interval)
                elapsed += poll_interval
            else:
                print('[eSCL] Status polling timed out, attempting download anyway', file=sys.stderr, flush=True)

            # 4. Download scan results (ADF can have multiple pages)
            import os
            from datetime import datetime

            # Create save directory (project_root/scans)
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
            save_dir = os.path.join(project_root, 'scans')
            os.makedirs(save_dir, exist_ok=True)

            # Common timestamp (group pages from same scan session)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

            scanned_images = []
            saved_paths = []
            page_num = 1

            # Determine if ADF (automatic feeder)
            is_adf = (source == 'Feeder')

            # 5. Call NextDocument repeatedly (until 404 for ADF)
            while True:
                print(f'[eSCL] Attempting to download page {page_num}...', file=sys.stderr, flush=True)
                image_data = self._download_scan_result(job_url)

                if not image_data:
                    # Error if first page not received
                    if page_num == 1:
                        self._delete_scan_job(job_url)
                        return {
                            'success': False,
                            'error': 'Cannot retrieve scan results. Please verify document is loaded in scanner.'
                        }
                    else:
                        # 404 after second page is normal completion
                        print(f'[eSCL] Scan complete: {page_num - 1} total pages', file=sys.stderr, flush=True)
                        break

                # 6. Save image and Base64 encoding
                try:
                    # Generate filename (with page number)
                    if is_adf:
                        filename = f'scan_{timestamp}_page{page_num}.jpg'
                    else:
                        filename = f'scan_{timestamp}.jpg'

                    filepath = os.path.join(save_dir, filename)

                    # Load image and handle rotation
                    img = Image.open(BytesIO(image_data))
                    print(f'[eSCL] Page {page_num} original size: {img.size[0]}x{img.size[1]}', file=sys.stderr, flush=True)

                    # Rotate 90 degrees counter-clockwise
                    img = img.transpose(Image.Transpose.ROTATE_90)
                    print(f'[eSCL] Page {page_num} size after rotation: {img.size[0]}x{img.size[1]}', file=sys.stderr, flush=True)

                    # Save rotated image as JPEG
                    img.save(filepath, format='JPEG', quality=95)
                    print(f'[eSCL] File saved: {filepath}', file=sys.stderr, flush=True)

                    # Convert to PNG and Base64 encode (for frontend display)
                    buffer = BytesIO()
                    img.save(buffer, format='PNG')
                    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')

                    scanned_images.append(encoded)
                    saved_paths.append(filepath)

                except Exception as img_error:
                    print(f'[eSCL] Page {page_num} image processing error: {img_error}', file=sys.stderr, flush=True)
                    # Continue even if processing fails

                # Platen only has 1 page, ADF continues to attempt
                if not is_adf:
                    break

                page_num += 1

            # 7. Delete scan job
            self._delete_scan_job(job_url)

            return {
                'success': True,
                'images': scanned_images,
                'count': len(scanned_images),
                'backend': 'eSCL',
                'saved_paths': saved_paths
            }

        except Exception as e:
            print(f'[eSCL] Scan error: {str(e)}', file=sys.stderr, flush=True)
            return {
                'success': False,
                'error': f'Scan failed: {str(e)}'
            }

    def _check_scanner_status(self, host, port):
        """Check scanner status"""
        try:
            url = f"http://{host}:{port}/eSCL/ScannerStatus"
            response = urllib.request.urlopen(url, timeout=5)
            content = response.read()

            root = ET.fromstring(content)
            state = root.find('.//{%s}State' % PWG_NS)

            if state is not None and state.text == 'Idle':
                print(f'[eSCL] Scanner ready', file=sys.stderr, flush=True)
                return True

            return False

        except Exception as e:
            print(f'[eSCL] Status check failed: {e}', file=sys.stderr, flush=True)
            return False

    def _get_scanner_capabilities(self, host, port):
        """Retrieve scanner capabilities (verify supported InputSource)"""
        try:
            url = f"http://{host}:{port}/eSCL/ScannerCapabilities"
            response = urllib.request.urlopen(url, timeout=5)
            content = response.read()

            print(f'[eSCL] Capabilities XML:\n{content.decode("utf-8")}', file=sys.stderr, flush=True)

            root = ET.fromstring(content)

            # Find InputSource
            sources = root.findall('.//{%s}InputSource' % PWG_NS)
            if sources:
                source_list = [s.text for s in sources if s.text]
                print(f'[eSCL] Supported InputSource: {source_list}', file=sys.stderr, flush=True)
                return source_list

            return []

        except Exception as e:
            print(f'[eSCL] Capabilities retrieval failed: {e}', file=sys.stderr, flush=True)
            return []

    def _create_scan_job(self, host, port, resolution, color_mode, input_source):
        """Create scan job"""
        try:
            url = f"http://{host}:{port}/eSCL/ScanJobs"

            # Color mode mapping
            mode_map = {
                'gray': 'Grayscale8',
                'bw': 'BlackAndWhite1',
                'color': 'RGB24'
            }
            escl_mode = mode_map.get(color_mode, 'Grayscale8')

            # eSCL scan settings XML (same as test code)
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

            print(f'[eSCL] Sending XML:\n{scan_settings}', file=sys.stderr, flush=True)

            data = scan_settings.encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'text/xml'})
            response = urllib.request.urlopen(req, timeout=10)

            job_url = response.headers.get('Location')

            if job_url:
                # Convert relative path to absolute path
                if job_url.startswith('/'):
                    job_url = f"http://{host}:{port}{job_url}"

                print(f'[eSCL] Job created: {job_url}', file=sys.stderr, flush=True)
                return job_url

            return None

        except Exception as e:
            print(f'[eSCL] Job creation failed: {e}', file=sys.stderr, flush=True)
            return None

    def _download_scan_result(self, job_url, quiet=False):
        """Download scan result"""
        try:
            result_url = f"{job_url}/NextDocument"

            if not quiet:
                print(f'[eSCL] Attempting to download result: {result_url}', file=sys.stderr, flush=True)

            response = urllib.request.urlopen(result_url, timeout=10)
            content = response.read()

            print(f'[eSCL] Download complete: {len(content)} bytes', file=sys.stderr, flush=True)
            return content

        except urllib.error.HTTPError as e:
            if e.code == 404:
                # 404 means not ready yet - quietly return None
                return None
            else:
                if not quiet:
                    print(f'[eSCL] Download failed: HTTP {e.code}', file=sys.stderr, flush=True)
                return None
        except Exception as e:
            if not quiet:
                print(f'[eSCL] Download failed: {e}', file=sys.stderr, flush=True)
            return None

    def _check_job_status(self, job_url):
        """Check scan job status"""
        try:
            response = urllib.request.urlopen(job_url, timeout=5)
            content = response.read()

            # Debug: only print first response
            if not hasattr(self, '_status_logged'):
                print(f'[eSCL] Job status XML:\n{content.decode("utf-8")[:500]}', file=sys.stderr, flush=True)
                self._status_logged = True

            root = ET.fromstring(content)

            # Find JobState (try multiple namespaces)
            state = root.find('.//{%s}JobState' % PWG_NS)
            if state is None:
                state = root.find('.//{%s}JobState' % ESCL_NS)
            if state is None:
                # Try without namespace
                state = root.find('.//JobState')

            if state is not None and state.text:
                print(f'[eSCL] Job status: {state.text}', file=sys.stderr, flush=True)
                return state.text  # 'Pending', 'Processing', 'Completed', 'Aborted', 'Canceled'

            print('[eSCL] JobState tag not found', file=sys.stderr, flush=True)
            return 'Unknown'

        except Exception as e:
            # Status check failed
            print(f'[eSCL] Status check failed: {e}', file=sys.stderr, flush=True)
            return 'Unknown'

    def _delete_scan_job(self, job_url):
        """Delete scan job (scanner auto-deletes on success, so errors are not critical)"""
        try:
            req = urllib.request.Request(job_url, method='DELETE')
            response = urllib.request.urlopen(req, timeout=10)
            print(f'[eSCL] Job deletion complete', file=sys.stderr, flush=True)
            return True

        except Exception as e:
            # On successful scan, scanner auto-deletes, so 404/500 errors are normal
            print(f'[eSCL] Job deletion attempted (already deleted)', file=sys.stderr, flush=True)
            return False


def is_available():
    """Check if eSCL backend is available"""
    return ESCL_AVAILABLE
