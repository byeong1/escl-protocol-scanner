#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
eSCL Scanner Discovery
Zeroconf service event handler for mDNS scanner discovery
"""

import ipaddress
import logging

try:
    from zeroconf import ServiceListener, Zeroconf
except ImportError:
    ServiceListener = object
    Zeroconf = None

log = logging.getLogger(__name__)


class ESCLScannerListener(ServiceListener):
    """eSCL Scanner Discovery Listener"""

    def __init__(self):
        self.scanners: list[dict] = []

    def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """Called when a scanner is discovered"""
        log.info('Scanner detected: %s', name)

        info = zc.get_service_info(type_, name)

        if info and info.addresses:
            host = str(ipaddress.ip_address(info.addresses[0]))

            # Remove service type from mDNS name (e.g., "Canon iR-ADV C3525._uscan._tcp.local." -> "Canon iR-ADV C3525")
            clean_name = name.split('._')[0] if '._' in name else name

            scanner_info = {
                'name': clean_name,
                'host': host,
                'port': info.port,
                'type': type_
            }
            self.scanners.append(scanner_info)
            log.info('Scanner added: %s (%s:%s)', clean_name, host, info.port)

    def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """Called when a scanner is removed"""
        log.info('Scanner removed: %s', name)

    def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
        """Called when scanner information is updated (ignored)"""
        pass
