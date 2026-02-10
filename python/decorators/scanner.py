#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scanner error handling decorator.
"""

from functools import wraps
from typing import Callable
from common.exceptions import ScannerError
from common.response import error_response
import logging

log = logging.getLogger(__name__)


def handle_scanner_errors(func: Callable) -> Callable:
    """Decorator that catches ScannerError and unexpected exceptions,
    converting them into a consistent error response dict.
    """
    @wraps(func)
    def wrapper(*args, **kwargs) -> dict:
        try:
            return func(*args, **kwargs)
        except ScannerError as e:
            log.error('%s error: %s', func.__name__, e)
            return e.to_dict()
        except Exception as e:
            log.error('%s unexpected error: %s', func.__name__, e)
            return error_response(f'{func.__name__} failed: {e}')
    return wrapper
