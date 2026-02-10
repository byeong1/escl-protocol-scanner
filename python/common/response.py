#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Common response builders for JSON IPC.
"""

import sys
import json
from typing import Any


def success_response(**kwargs: Any) -> dict:
    """Build a success response dict."""
    return {'success': True, **kwargs}


def error_response(error: str | Exception) -> dict:
    """Build an error response dict."""
    return {'success': False, 'error': str(error)}


def send_response(data: dict) -> None:
    """Send JSON response via stdout."""
    response = json.dumps(data, ensure_ascii=False)
    sys.stdout.write(response + '\n')
    sys.stdout.flush()
