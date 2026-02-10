#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scanner exception classes.
"""


class ScannerError(Exception):
    """Raised when a scanner operation fails.
    Caught by handle_scanner_errors decorator to produce {'success': False, 'error': ...}.
    """

    def __init__(self, message: str, *, context: str | None = None):
        super().__init__(message)
        self.context = context

    def __str__(self) -> str:
        if self.context:
            return f'{super().__str__()} [{self.context}]'
        return super().__str__()

    def __repr__(self) -> str:
        return f'{self.__class__.__name__}({super().__str__()!r}, context={self.context!r})'

    def to_dict(self) -> dict:
        """Convert to error response dict."""
        from common.response import error_response
        return error_response(str(self))
