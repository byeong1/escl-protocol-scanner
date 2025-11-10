#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scanner Backend Base Classes and Common Utilities
"""

from abc import ABC, abstractmethod
import sys
import json


class ScannerBackend(ABC):
    """Abstract base class for scanner backends"""

    @abstractmethod
    def list_scanners(self):
        """
        Return list of available scanners

        Returns:
            dict: {'success': bool, 'scanners': list, 'backend': str}
                  or {'success': False, 'error': str}
        """
        pass

    @abstractmethod
    def scan(self, params):
        """
        Execute scan with given parameters

        Args:
            params (dict): {
                'scanner': str,      # Scanner name/ID
                'dpi': int,          # Resolution (default: 300)
                'mode': str,         # 'gray', 'bw', 'color' (default: 'gray')
                'format': str,       # 'a3', 'a4', 'b4', 'b5' (default: 'a3')
                'adf': bool,         # Auto Document Feeder (default: True)
                'duplex': bool       # Double-sided scanning (default: False)
            }

        Returns:
            dict: {'success': bool, 'images': list, 'count': int, 'backend': str}
                  or {'success': False, 'error': str}
        """
        pass


def send_response(data):
    """
    Send JSON response via stdout

    Args:
        data (dict): Response data to send
    """
    response = json.dumps(data, ensure_ascii=False)
    sys.stdout.write(response + '\n')
    sys.stdout.flush()
