# -*- mode: python ; coding: utf-8 -*-
"""
eSCL Scanner PyInstaller Specification
Cross-platform build for Windows, macOS, Linux
"""

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['__main__.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'common',
        'common.logger',
        'common.exceptions',
        'common.response',
        'base',
        'base.service',
        'services.scanner',
        'decorators',
        'decorators.scanner',
        'services',
        'services.escl',
        'services.escl.protocol',
        'services.escl.discovery',
        'app',
        'zeroconf',
        'zeroconf._utils',
        'zeroconf._utils.ipaddress',
        'zeroconf._utils.time',
        'zeroconf._handlers',
        'zeroconf._handlers.answers',
        'zeroconf._handlers.record_manager',
        'zeroconf._handlers.multicast_outgoing_queue',
        'zeroconf._handlers.query_handler',
        'zeroconf._core',
        'zeroconf._listener',
        'zeroconf._engine',
        'zeroconf._protocol',
        'zeroconf._protocol.incoming',
        'zeroconf._protocol.outgoing',
        'zeroconf._services',
        'zeroconf._services.browser',
        'zeroconf._services.info',
        'zeroconf._services.registry',
        'zeroconf._dns',
        'zeroconf._cache',
        'zeroconf._record_update',
        'zeroconf._updates',
        'ifaddr',
        'ifaddr._shared',
        'PIL',
        'PIL.Image',
        'PIL._imaging',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='escl-scanner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
