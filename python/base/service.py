#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Base Service Abstract Class
"""

from abc import ABC, abstractmethod


class Service(ABC):
    """Base class for all services."""

    @abstractmethod
    def list_scanners(self) -> dict:
        """Discover scanners on the network."""

    @abstractmethod
    def scan(self, params: dict) -> dict:
        """Execute scan with given parameters."""

    @abstractmethod
    def get_capabilities(self, params: dict) -> dict:
        """Retrieve scanner capabilities."""
