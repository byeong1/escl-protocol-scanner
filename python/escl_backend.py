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

# eSCL 네임스페이스
ESCL_NS = "http://schemas.hp.com/imaging/escl/2011/05/03"
PWG_NS = "http://www.pwg.org/schemas/2010/12/sm"


class ESCLScannerListener(ServiceListener):
    """eSCL 스캐너 검색 리스너"""

    def __init__(self):
        self.scanners = []

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """스캐너 발견 시 호출"""
        print(f'[eSCL] 스캐너 감지: {name}', file=sys.stderr, flush=True)

        info = zc.get_service_info(type_, name)

        if info and info.addresses:
            # IPv4 주소 변환
            host = ".".join(map(str, info.addresses[0]))

            # mDNS 이름에서 서비스 타입 제거 (예: "Canon iR-ADV C3525._uscan._tcp.local." -> "Canon iR-ADV C3525")
            clean_name = name.split('._')[0] if '._' in name else name

            scanner_info = {
                'name': clean_name,
                'host': host,
                'port': info.port,
                'type': type_
            }
            self.scanners.append(scanner_info)
            print(f'[eSCL] 추가됨: {clean_name} ({host}:{info.port})', file=sys.stderr, flush=True)

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """스캐너 제거 시 호출"""
        print(f'[eSCL] 스캐너 제거: {name}', file=sys.stderr, flush=True)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """스캐너 업데이트 시 호출 (무시)"""
        pass


class ESCLBackend(ScannerBackend):
    """eSCL (AirPrint) backend for network scanners"""

    def __init__(self):
        if not ESCL_AVAILABLE:
            raise ImportError('eSCL 라이브러리를 찾을 수 없습니다. 설치: pip install zeroconf pillow')

        self.discovered_scanners = []

    def get_capabilities(self, params):
        """스캐너 capabilities 조회 및 파싱"""
        try:
            scanner_name = params.get('scanner')

            if not scanner_name:
                return {
                    'success': False,
                    'error': '스캐너가 선택되지 않았습니다.'
                }

            # 선택된 스캐너 정보 찾기
            selected = None
            for s in self.discovered_scanners:
                if s['name'] == scanner_name:
                    selected = s
                    break

            if not selected:
                return {
                    'success': False,
                    'error': f'스캐너 정보를 찾을 수 없습니다: {scanner_name}'
                }

            host = selected['host']
            port = selected['port']

            # Capabilities 조회
            url = f"http://{host}:{port}/eSCL/ScannerCapabilities"
            response = urllib.request.urlopen(url, timeout=5)
            content = response.read()

            root = ET.fromstring(content)

            # 지원하는 해상도 파싱
            resolutions = []
            res_elements = root.findall('.//{%s}DiscreteResolution' % ESCL_NS)
            for res in res_elements:
                x_res = res.find('.//{%s}XResolution' % ESCL_NS)
                if x_res is not None and x_res.text:
                    resolutions.append(int(x_res.text))

            # 지원하는 색상 모드 파싱
            color_modes = []
            mode_elements = root.findall('.//{%s}ColorMode' % ESCL_NS)
            for mode in mode_elements:
                if mode.text:
                    color_modes.append(mode.text)

            # 입력 소스 확인 (Platen, Adf 지원 여부)
            input_sources = []
            if root.find('.//{%s}Platen' % ESCL_NS) is not None:
                input_sources.append('Platen')
            if root.find('.//{%s}Adf' % ESCL_NS) is not None:
                input_sources.append('Adf')

            # 중복 제거 및 정렬
            resolutions = sorted(list(set(resolutions)))
            color_modes = list(set(color_modes))

            print(f'[eSCL] Capabilities 파싱 완료: resolutions={resolutions}, modes={color_modes}, sources={input_sources}', file=sys.stderr, flush=True)

            return {
                'success': True,
                'capabilities': {
                    'resolutions': resolutions,
                    'colorModes': color_modes,
                    'inputSources': input_sources
                }
            }

        except Exception as e:
            print(f'[eSCL] Capabilities 조회 오류: {str(e)}', file=sys.stderr, flush=True)
            return {
                'success': False,
                'error': f'Capabilities 조회 실패: {str(e)}'
            }

    def list_scanners(self):
        """네트워크에서 eSCL 스캐너 검색"""
        try:
            print('[eSCL] 스캐너 검색 시작...', file=sys.stderr, flush=True)

            zeroconf = Zeroconf()
            listener = ESCLScannerListener()

            # eSCL 서비스 타입
            services = [
                "_uscan._tcp.local.",
                "_uscans._tcp.local."
            ]

            browsers = [ServiceBrowser(zeroconf, service, listener) for service in services]

            # 5초 대기
            time.sleep(5)

            zeroconf.close()

            print(f'[eSCL] 발견: {len(listener.scanners)}개', file=sys.stderr, flush=True)

            # 검색 결과 저장
            self.discovered_scanners = listener.scanners

            if listener.scanners:
                # 스캐너 전체 객체 반환 (name, host, port 포함)
                return {
                    'success': True,
                    'scanners': listener.scanners,
                    'backend': 'eSCL'
                }
            else:
                return {
                    'success': False,
                    'error': '네트워크 스캐너를 찾을 수 없습니다. WiFi 연결 및 스캐너 전원을 확인하세요.'
                }

        except Exception as e:
            print(f'[eSCL] 오류: {str(e)}', file=sys.stderr, flush=True)
            return {
                'success': False,
                'error': f'스캐너 검색 실패: {str(e)}'
            }

    def scan(self, params):
        """eSCL 프로토콜로 스캔 실행"""
        try:
            scanner_name = params.get('scanner')
            dpi = params.get('dpi', 300)
            mode = params.get('mode', 'gray')
            source = params.get('source', 'Platen')

            if not scanner_name:
                return {
                    'success': False,
                    'error': '스캐너가 선택되지 않았습니다.'
                }

            # 선택된 스캐너 정보 찾기
            selected = None
            for s in self.discovered_scanners:
                if s['name'] == scanner_name:
                    selected = s
                    break

            if not selected:
                return {
                    'success': False,
                    'error': f'스캐너 정보를 찾을 수 없습니다: {scanner_name}'
                }

            host = selected['host']
            port = selected['port']

            print(f'[eSCL] 스캔 시작: {host}:{port}', file=sys.stderr, flush=True)

            # 1. 스캐너 상태 확인
            if not self._check_scanner_status(host, port):
                return {
                    'success': False,
                    'error': '스캐너가 준비되지 않았습니다.'
                }

            # 1.5. 스캐너 capabilities 확인 (지원하는 InputSource 확인)
            supported_sources = self._get_scanner_capabilities(host, port)
            if supported_sources:
                print(f'[eSCL] 요청한 source: {source}, 지원: {supported_sources}', file=sys.stderr, flush=True)

            # 2. 스캔 작업 생성 (409 에러 발생 시 재시도)
            job_url = self._create_scan_job(host, port, dpi, mode, source)

            # 409 Conflict 발생 시 기존 작업 정리 후 재시도
            if not job_url:
                print('[eSCL] 409 에러 가능성 - 기존 작업 정리 시도', file=sys.stderr, flush=True)
                # TODO: 기존 작업 목록 조회 및 삭제 로직 필요
                return {
                    'success': False,
                    'error': '스캔 작업 생성 실패 - 스캐너를 재부팅해주세요'
                }

            if not job_url:
                return {
                    'success': False,
                    'error': '스캔 작업 생성 실패'
                }

            # 3. 스캔 완료 대기 (5초)
            print('[eSCL] 스캔 진행 중... (5초 대기)', file=sys.stderr, flush=True)
            time.sleep(5)

            # 4. 스캔 결과 다운로드 (ADF는 여러 페이지 가능)
            import os
            from datetime import datetime

            # 저장 폴더 생성 (프로젝트 루트/scans)
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
            save_dir = os.path.join(project_root, 'scans')
            os.makedirs(save_dir, exist_ok=True)

            # 공통 타임스탬프 (동일 스캔 세션의 페이지들을 그룹화)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

            scanned_images = []
            saved_paths = []
            page_num = 1

            # ADF 여부 확인
            is_adf = (source == 'Feeder')

            # 5. NextDocument 반복 호출 (ADF는 404 나올 때까지)
            while True:
                print(f'[eSCL] 페이지 {page_num} 다운로드 시도...', file=sys.stderr, flush=True)
                image_data = self._download_scan_result(job_url)

                if not image_data:
                    # 첫 페이지도 못 받았으면 에러
                    if page_num == 1:
                        self._delete_scan_job(job_url)
                        return {
                            'success': False,
                            'error': '스캔 결과를 가져올 수 없습니다. 문서가 스캐너에 올려져 있는지 확인하세요.'
                        }
                    else:
                        # 두 번째 페이지 이후 404는 정상 종료
                        print(f'[eSCL] 스캔 완료: 총 {page_num - 1}페이지', file=sys.stderr, flush=True)
                        break

                # 6. 이미지 저장 및 Base64 인코딩
                try:
                    # 파일명 생성 (페이지 번호 포함)
                    if is_adf:
                        filename = f'scan_{timestamp}_page{page_num}.jpg'
                    else:
                        filename = f'scan_{timestamp}.jpg'

                    filepath = os.path.join(save_dir, filename)

                    # 이미지 로드 및 회전 처리
                    img = Image.open(BytesIO(image_data))
                    print(f'[eSCL] 페이지 {page_num} 원본 크기: {img.size[0]}x{img.size[1]}', file=sys.stderr, flush=True)

                    # 반시계 방향 90도 회전
                    img = img.transpose(Image.ROTATE_90)
                    print(f'[eSCL] 페이지 {page_num} 회전 후 크기: {img.size[0]}x{img.size[1]}', file=sys.stderr, flush=True)

                    # 회전된 이미지를 JPEG로 저장
                    img.save(filepath, format='JPEG', quality=95)
                    print(f'[eSCL] 파일 저장: {filepath}', file=sys.stderr, flush=True)

                    # PNG로 변환하여 Base64 인코딩 (프론트엔드 표시용)
                    buffer = BytesIO()
                    img.save(buffer, format='PNG')
                    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')

                    scanned_images.append(encoded)
                    saved_paths.append(filepath)

                except Exception as img_error:
                    print(f'[eSCL] 페이지 {page_num} 이미지 처리 오류: {img_error}', file=sys.stderr, flush=True)
                    # 실패해도 계속 진행

                # Platen은 1페이지만, ADF는 계속 시도
                if not is_adf:
                    break

                page_num += 1

            # 7. 스캔 작업 삭제
            self._delete_scan_job(job_url)

            return {
                'success': True,
                'images': scanned_images,
                'count': len(scanned_images),
                'backend': 'eSCL',
                'saved_paths': saved_paths
            }

        except Exception as e:
            print(f'[eSCL] 스캔 오류: {str(e)}', file=sys.stderr, flush=True)
            return {
                'success': False,
                'error': f'스캔 실패: {str(e)}'
            }

    def _check_scanner_status(self, host, port):
        """스캐너 상태 확인"""
        try:
            url = f"http://{host}:{port}/eSCL/ScannerStatus"
            response = urllib.request.urlopen(url, timeout=5)
            content = response.read()

            root = ET.fromstring(content)
            state = root.find('.//{%s}State' % PWG_NS)

            if state is not None and state.text == 'Idle':
                print(f'[eSCL] 스캐너 준비됨', file=sys.stderr, flush=True)
                return True

            return False

        except Exception as e:
            print(f'[eSCL] 상태 확인 실패: {e}', file=sys.stderr, flush=True)
            return False

    def _get_scanner_capabilities(self, host, port):
        """스캐너 capabilities 조회 (지원하는 InputSource 확인)"""
        try:
            url = f"http://{host}:{port}/eSCL/ScannerCapabilities"
            response = urllib.request.urlopen(url, timeout=5)
            content = response.read()

            print(f'[eSCL] Capabilities XML:\n{content.decode("utf-8")}', file=sys.stderr, flush=True)

            root = ET.fromstring(content)

            # InputSource 찾기
            sources = root.findall('.//{%s}InputSource' % PWG_NS)
            if sources:
                source_list = [s.text for s in sources if s.text]
                print(f'[eSCL] 지원하는 InputSource: {source_list}', file=sys.stderr, flush=True)
                return source_list

            return []

        except Exception as e:
            print(f'[eSCL] Capabilities 조회 실패: {e}', file=sys.stderr, flush=True)
            return []

    def _create_scan_job(self, host, port, resolution, color_mode, input_source):
        """스캔 작업 생성"""
        try:
            url = f"http://{host}:{port}/eSCL/ScanJobs"

            # 색상 모드 매핑
            mode_map = {
                'gray': 'Grayscale8',
                'bw': 'BlackAndWhite1',
                'color': 'RGB24'
            }
            escl_mode = mode_map.get(color_mode, 'Grayscale8')

            # eSCL 스캔 설정 XML (테스트 코드와 동일)
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

            print(f'[eSCL] 전송 XML:\n{scan_settings}', file=sys.stderr, flush=True)

            data = scan_settings.encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'text/xml'})
            response = urllib.request.urlopen(req, timeout=10)

            job_url = response.headers.get('Location')

            if job_url:
                # Location이 상대 경로면 절대 경로로 변환
                if job_url.startswith('/'):
                    job_url = f"http://{host}:{port}{job_url}"

                print(f'[eSCL] 작업 생성: {job_url}', file=sys.stderr, flush=True)
                return job_url

            return None

        except Exception as e:
            print(f'[eSCL] 작업 생성 실패: {e}', file=sys.stderr, flush=True)
            return None

    def _download_scan_result(self, job_url, quiet=False):
        """스캔 결과 다운로드"""
        try:
            result_url = f"{job_url}/NextDocument"

            if not quiet:
                print(f'[eSCL] 결과 다운로드 시도: {result_url}', file=sys.stderr, flush=True)

            response = urllib.request.urlopen(result_url, timeout=10)
            content = response.read()

            print(f'[eSCL] 다운로드 완료: {len(content)} bytes', file=sys.stderr, flush=True)
            return content

        except urllib.error.HTTPError as e:
            if e.code == 404:
                # 404는 아직 준비 안 됨 - 조용히 None 반환
                return None
            else:
                if not quiet:
                    print(f'[eSCL] 다운로드 실패: HTTP {e.code}', file=sys.stderr, flush=True)
                return None
        except Exception as e:
            if not quiet:
                print(f'[eSCL] 다운로드 실패: {e}', file=sys.stderr, flush=True)
            return None

    def _check_job_status(self, job_url):
        """스캔 작업 상태 확인"""
        try:
            response = urllib.request.urlopen(job_url, timeout=5)
            content = response.read()

            # 디버깅: 첫 번째 응답만 출력
            if not hasattr(self, '_status_logged'):
                print(f'[eSCL] 작업 상태 XML:\n{content.decode("utf-8")[:500]}', file=sys.stderr, flush=True)
                self._status_logged = True

            root = ET.fromstring(content)

            # JobState 찾기 (여러 네임스페이스 시도)
            state = root.find('.//{%s}JobState' % PWG_NS)
            if state is None:
                state = root.find('.//{%s}JobState' % ESCL_NS)
            if state is None:
                # 네임스페이스 없이 시도
                state = root.find('.//JobState')

            if state is not None and state.text:
                print(f'[eSCL] 작업 상태: {state.text}', file=sys.stderr, flush=True)
                return state.text  # 'Pending', 'Processing', 'Completed', 'Aborted', 'Canceled'

            print('[eSCL] JobState 태그를 찾을 수 없음', file=sys.stderr, flush=True)
            return 'Unknown'

        except Exception as e:
            # 상태 확인 실패
            print(f'[eSCL] 상태 확인 실패: {e}', file=sys.stderr, flush=True)
            return 'Unknown'

    def _delete_scan_job(self, job_url):
        """스캔 작업 삭제 (성공 시 스캐너가 자동 삭제하므로 실패해도 무방)"""
        try:
            req = urllib.request.Request(job_url, method='DELETE')
            response = urllib.request.urlopen(req, timeout=10)
            print(f'[eSCL] 작업 삭제 완료', file=sys.stderr, flush=True)
            return True

        except Exception as e:
            # 스캔 성공 시 스캐너가 자동으로 삭제하므로 404/500 에러는 정상
            print(f'[eSCL] 작업 삭제 시도 (이미 삭제됨)', file=sys.stderr, flush=True)
            return False


def is_available():
    """Check if eSCL backend is available"""
    return ESCL_AVAILABLE
