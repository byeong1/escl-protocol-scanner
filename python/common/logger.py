#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Logging configuration for eSCL Scanner Backend.
Uses Python's standard logging module with stderr output.
"""

import logging
import sys


def setup_logging() -> None:
    """Configure root logger for the application.

    All log output goes to stderr (stdout is reserved for JSON IPC).
    Format: [module.name] message
    Call once at application startup.
    """
    root = logging.getLogger()

    if not root.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter('[%(name)s] %(message)s'))
        root.addHandler(handler)
        root.setLevel(logging.DEBUG)
