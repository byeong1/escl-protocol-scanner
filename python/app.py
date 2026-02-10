#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eSCL Scanner Service Application
"""

import sys
import json
import logging
from common.logger import setup_logging
from common.response import send_response, success_response, error_response

log = logging.getLogger(__name__)

class ESCLApplication:
    """eSCL Scanner Service Application"""

    def __init__(self):
        setup_logging()

        self._check_dependencies()

        from services import ScannerService
        
        self.service = ScannerService()
        self._handlers = {
            'list': lambda cmd: self.service.list_scanners(),
            'scan': lambda cmd: self.service.scan(cmd.get('params', {})),
            'capabilities': lambda cmd: self.service.get_capabilities(cmd.get('params', {})),
        }

    @staticmethod
    def _check_dependencies():
        """필수 라이브러리 존재 여부를 확인하고, 없으면 에러 응답 후 종료한다."""
        missing = []

        try:
            import zeroconf  # noqa: F401
        except ImportError:
            missing.append('zeroconf')

        try:
            import PIL  # noqa: F401
        except ImportError:
            missing.append('pillow')

        if missing:
            send_response(error_response(
                f'Required Python packages are not installed. '
                f'Install with: pip install {" ".join(missing)}'
            ))
            sys.exit(1)

    def dispatch(self, command: dict) -> bool:
        """커맨드를 적절한 백엔드 메서드로 라우팅한다."""
        action = command.get('action')
        log.info('Command received: %s', action)

        if action == 'exit':
            send_response(success_response(message='eSCL service stopped'))
            return False

        handler = self._handlers.get(action)
        if not handler:
            send_response(error_response(f'Unknown command: {action}'))
            return True

        result = handler(command)
        send_response(result)
        return True

    def run(self) -> None:
        """stdin에서 JSON 커맨드를 읽어 처리하는 메인 루프."""
        log.info('Service started')

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                command = json.loads(line)
            except json.JSONDecodeError as e:
                send_response(error_response(f'JSON parsing error: {e}'))
                continue

            try:
                if not self.dispatch(command):
                    break
            except Exception as e:
                send_response(error_response(f'Command processing error: {e}'))
