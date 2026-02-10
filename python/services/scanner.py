#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scanner Service — main entry point for scanner operations.
Delegates to protocol-specific implementations (e.g. eSCL).
"""

import logging
from base.service import Service
from services.escl import ESCLProtocol

log = logging.getLogger(__name__)


class ScannerService(Service):
    """Scanner service that delegates to protocol-specific implementations."""

    def __init__(self):
        self.escl = ESCLProtocol()

    def list_scanners(self) -> dict:
        """Discover scanners on the network."""
        return self.escl.list_scanners()

    def scan(self, params: dict) -> dict:
        """Execute scan with given parameters."""
        return self.escl.scan(params)

    def get_capabilities(self, params: dict) -> dict:
        """Retrieve scanner capabilities."""
        return self.escl.get_capabilities(params)
