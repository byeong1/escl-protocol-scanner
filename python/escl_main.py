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
        'error': f'Required Python packages are not installed. Install with: pip install {" ".join(missing)}'
    }))
    sys.exit(1)

# eSCL 백엔드 import
from escl_backend import ESCLBackend


def main():
    """eSCL Scanner Service Main Loop"""
    try:
        backend = ESCLBackend()
        print(f'[eSCL] Service started', file=sys.stderr, flush=True)

        # stdin에서 명령어 읽기
        for line in sys.stdin:
            line = line.strip()

            if not line:
                continue

            try:
                command = json.loads(line)
                action = command.get('action')

                print(f'[eSCL] Command received: {action}', file=sys.stderr, flush=True)

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
                    # Exit service
                    print(json.dumps({'success': True, 'message': 'eSCL service stopped'}), flush=True)
                    break

                else:
                    # Unknown command
                    print(json.dumps({
                        'success': False,
                        'error': f'Unknown command: {action}'
                    }), flush=True)

            except json.JSONDecodeError as e:
                print(json.dumps({
                    'success': False,
                    'error': f'JSON parsing error: {str(e)}'
                }), flush=True)

            except Exception as e:
                print(json.dumps({
                    'success': False,
                    'error': f'Command processing error: {str(e)}'
                }), flush=True)

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'eSCL service error: {str(e)}'
        }), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
