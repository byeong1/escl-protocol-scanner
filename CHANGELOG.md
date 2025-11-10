# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-10

### Added
- Initial release of `@escl-protocol/scanner`
- **Scanner Discovery**: Automatic mDNS/Bonjour discovery of eSCL-compatible network scanners
- **eSCL Protocol Support**: Complete HTTP-based eSCL protocol implementation
- **Scanner Capabilities**: Query supported resolutions, color modes, and scan sources
- **Scan Operations**: Create scan jobs, poll status, and download scanned images
- **Image Processing**: Automatic rotation correction and PNG encoding
- **Multiple Color Modes**: Support for Black & White, Grayscale, and Full Color
- **Multiple Scan Sources**: Flatbed (Platen) and ADF (Automatic Document Feeder)
- **Multi-Device Support**: Compatible with Canon, HP, Xerox, Ricoh, Epson, and other AirPrint scanners
- **Python Backend**: Reliable zeroconf-based discovery using Python subprocess
- **TypeScript Support**: Full TypeScript type definitions and declaration files
- **Zero Dependencies**: No Node.js dependencies (Python handles network operations)
- **Production Ready**: Mature implementation based on scanner-net project

### Technical Details
- **TypeScript**: ~780 lines of TypeScript code
- **Python**: ~716 lines of Python code
- **Compiled Size**: ~84KB of JavaScript (minified TypeScript)
- **Node.js Requirement**: 14.0.0+
- **Python Requirement**: 3.6+ with zeroconf and pillow libraries

### Documentation
- Comprehensive README with quick start guide
- SETUP.md with installation and troubleshooting
- Full API documentation with type definitions
- Examples for Electron and Node.js usage
- Architecture documentation

### Files
- `src/index.ts` - Main entry point and public API
- `src/types.ts` - TypeScript interfaces and type definitions
- `src/client.ts` - eSCL HTTP client for device communication
- `src/discovery.ts` - Scanner discovery service
- `python/escl_main.py` - Python subprocess entry point
- `python/escl_backend.py` - Core eSCL protocol implementation
- `python/base.py` - Base class for scanner backends
- `README.md` - Full API documentation
- `SETUP.md` - Installation and setup guide
- `LICENSE` - MIT License

## Future Plans

### Version 1.1.0 (Planned)
- [ ] Browser/Chrome extension support via native messaging
- [ ] WebSocket support for real-time scanning
- [ ] Batch scanning with progress callbacks
- [ ] Custom paper size support
- [ ] Scanner job persistence and recovery

### Version 2.0.0 (Planned)
- [ ] Native Node.js module for direct mDNS (remove Python dependency)
- [ ] Async/stream-based image download
- [ ] Multi-scanner concurrent scanning
- [ ] Image compression and quality control
- [ ] Scanning profiles and presets

## Known Limitations

1. **Python Dependency**: Requires Python 3.6+ for mDNS discovery
   - Future versions will provide native Node.js alternative
2. **Local Network Only**: Scanners must be on same network (mDNS limitation)
3. **HTTP Only**: eSCL protocol uses unencrypted HTTP (standard for network devices)
4. **Single Job per Scanner**: Sequential scanning only (parallel coming soon)
5. **Platform Specific**: Python path must be available on system

## Breaking Changes

None yet - this is the initial release.

## Migration Guides

No migrations needed for version 1.0.0.

## Support

For bug reports, feature requests, or issues:
- GitHub Issues: [Report Issues](https://github.com/yourusername/escl-protocol-scanner/issues)
- Documentation: [README.md](./README.md)
- Setup Help: [SETUP.md](./SETUP.md)

## Credits

This package is based on the proven implementation from the [scanner-net](https://github.com/yourusername/scanner-net) project, refined and packaged for distribution via npm/yarn.
