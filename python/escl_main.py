#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eSCL Scanner Service Entry Point
Dedicated subprocess for eSCL (AirPrint) network scanners
"""

import sys
import json
import os
import tempfile

# zeroconf 라이브러리 체크
try:
    from zeroconf import Zeroconf
    ZEROCONF_AVAILABLE = True
except ImportError:
    ZEROCONF_AVAILABLE = False

# PIL 라이브러리 체크
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# 필수 라이브러리 체크
if not ZEROCONF_AVAILABLE or not PIL_AVAILABLE:
    missing = []
    if not ZEROCONF_AVAILABLE:
        missing.append('zeroconf')
    if not PIL_AVAILABLE:
        missing.append('pillow')

    print(json.dumps({
        'success': False,
        'error': f'필수 라이브러리가 없습니다.\n설치: pip install {" ".join(missing)}'
    }))
    sys.exit(1)

# eSCL 백엔드 import
from escl_backend import ESCLBackend


def main():
    """eSCL 스캐너 서비스 메인 루프"""
    try:
        backend = ESCLBackend()
        print(f'[eSCL] 서비스 시작', file=sys.stderr, flush=True)

        # stdin에서 명령어 읽기
        for line in sys.stdin:
            line = line.strip()

            if not line:
                continue

            try:
                command = json.loads(line)
                action = command.get('action')

                print(f'[eSCL] 명령 수신: {action}', file=sys.stderr, flush=True)

                if action == 'list':
                    # 스캐너 목록 조회
                    result = backend.list_scanners()
                    print(json.dumps(result), flush=True)

                elif action == 'scan':
                    # 스캔 실행
                    params = command.get('params', {})
                    result = backend.scan(params)

                    # 이미지 데이터가 너무 크면 임시 파일로 저장
                    if result.get('success') and result.get('images'):
                        print(json.dumps(result, ensure_ascii=False), flush=True)
                    else:
                        print(json.dumps(result), flush=True)

                elif action == 'capabilities':
                    # 스캐너 capabilities 조회
                    params = command.get('params', {})
                    result = backend.get_capabilities(params)
                    print(json.dumps(result), flush=True)

                elif action == 'exit':
                    # 종료
                    print(json.dumps({'success': True, 'message': 'eSCL 서비스 종료'}), flush=True)
                    break

                else:
                    # 알 수 없는 명령
                    print(json.dumps({
                        'success': False,
                        'error': f'알 수 없는 명령: {action}'
                    }), flush=True)

            except json.JSONDecodeError as e:
                print(json.dumps({
                    'success': False,
                    'error': f'JSON 파싱 오류: {str(e)}'
                }), flush=True)

            except Exception as e:
                print(json.dumps({
                    'success': False,
                    'error': f'명령 처리 오류: {str(e)}'
                }), flush=True)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'eSCL 서비스 오류: {str(e)}'
        }), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
