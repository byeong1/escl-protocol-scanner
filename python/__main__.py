#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eSCL Scanner Service Entry Point
Dedicated subprocess for eSCL (AirPrint) network scanners
"""

import sys
from common.response import send_response, error_response
from app import ESCLApplication


def main():
    try:
        app = ESCLApplication()
        app.run()
    except Exception as e:
        send_response(error_response(f'eSCL service error: {e}'))
        sys.exit(1)


if __name__ == '__main__':
    main()
