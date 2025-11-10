# @escl-protocol/scanner

A comprehensive TypeScript/Node.js library for discovering and communicating with network scanners using the **eSCL (Enhanced Scanner Communication Language)** protocol, which is based on **AirPrint** standards.

## Features

- 🔍 **Automatic Scanner Discovery**: Uses mDNS/Bonjour to discover eSCL-compatible scanners on the local network
- 📡 **HTTP-based Communication**: eSCL protocol built on HTTP for reliable device communication
- 🎨 **Multiple Color Modes**: Support for Black & White, Grayscale, and Full Color scanning
- 📊 **Flexible Resolution**: Supports various DPI settings (150, 200, 300, 600 DPI, etc.)
- 📄 **Multi-source Scanning**: Platen (flatbed) and ADF (Automatic Document Feeder) support
- 📸 **Image Processing**: Automatic rotation correction and PNG encoding
- 🔧 **Python Backend**: Uses Python subprocess for reliable mDNS discovery via zeroconf
- ✨ **Production Ready**: Mature implementation from scanner-net project

## Supported Devices

Compatible with network scanners from major manufacturers:
- **Canon**: iR-series MFP devices
- **HP**: LaserJet MFP devices
- **Xerox**: WorkCentre series
- **Ricoh**: MP series
- **Epson**: WorkForce Pro series
- **And other AirPrint-compatible MFP devices**

## Installation

### Prerequisites
- Node.js ≥ 14.0.0
- Python 3.6+ with:
  - `zeroconf` library
  - `pillow` library

### Install with npm/yarn

```bash
npm install @escl-protocol/scanner
# or
yarn add @escl-protocol/scanner
```

### Install Python Dependencies

```bash
pip install zeroconf pillow
```

## Quick Start

### Basic Usage

```typescript
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

async function example() {
  // 1. Discover available scanners (5 second discovery window)
  const scanners = await discoverScanners(5000);
  console.log(`Found ${scanners.length} scanners`);

  if (scanners.length === 0) {
    console.log('No scanners found on network');
    return;
  }

  // 2. Get scanner info
  const scanner = scanners[0];
  console.log(`Scanner: ${scanner.name}`);
  console.log(`Host: ${scanner.host}:${scanner.port}`);
}

example();
```

### Discover Scanners

```typescript
import { discoverScanners, ESCLScanner } from '@escl-protocol/scanner';

// Quick discovery
const scanners = await discoverScanners(5000);

scanners.forEach(scanner => {
  console.log(`${scanner.name} at ${scanner.host}:${scanner.port}`);
  if (scanner.manufacturer) {
    console.log(`  Manufacturer: ${scanner.manufacturer}`);
  }
  if (scanner.model) {
    console.log(`  Model: ${scanner.model}`);
  }
});
```

### Get Scanner Capabilities

```typescript
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

const scanners = await discoverScanners(5000);
const client = new ESCLClient();

const capabilities = await client.getCapabilities(scanners[0]);
if (capabilities) {
  console.log('Supported Resolutions:', capabilities.resolutions);
  console.log('Color Modes:', capabilities.colorModes);
  console.log('Scan Sources:', capabilities.sources);
}
```

### Perform a Scan

```typescript
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

const scanners = await discoverScanners(5000);
const client = new ESCLClient();

// Create scan job
const jobId = await client.createScanJob(
  scanners[0],
  300,           // DPI (300 DPI)
  'RGB24',       // Color mode (Full Color)
  'Platen'       // Source (Flatbed)
);

if (!jobId) {
  console.error('Failed to create scan job');
  process.exit(1);
}

// Poll for completion
let completed = false;
let attempts = 0;

while (!completed && attempts < 30) {
  const status = await client.getScanJobStatus(scanners[0], jobId);

  if (status.status === 'Completed') {
    // Download images
    for (const imageUrl of status.images) {
      const imageBuffer = await client.downloadImage(scanners[0], imageUrl);
      if (imageBuffer) {
        console.log('Downloaded image:', imageBuffer.length, 'bytes');
      }
    }
    completed = true;
  } else if (status.status === 'Aborted') {
    console.error('Scan was aborted');
    process.exit(1);
  } else {
    console.log(`Scan progress: ${status.status}`);
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
}

if (!completed) {
  console.error('Scan job timeout');
  process.exit(1);
}
```

### Quick Scan Helper

For simple one-off scans:

```typescript
import { discoverScanners, quickScan } from '@escl-protocol/scanner';

const scanners = await discoverScanners(5000);

const images = await quickScan({
  scanner: scanners[0],
  dpi: 300,
  mode: 'color',      // 'bw' | 'gray' | 'color'
  source: 'Platen',   // 'Platen' | 'Feeder'
  timeout: 30000
});

if (images) {
  console.log(`Scanned ${images.length} images`);
  // images are base64-encoded PNG data
}
```

## API Reference

### Types

#### `ESCLScanner`
```typescript
interface ESCLScanner {
  name: string;              // Scanner display name
  host: string;              // IP address
  port: number;              // HTTP port (usually 80)
  serviceName?: string;      // Full mDNS service name
  model?: string;            // Device model (if available)
  manufacturer?: string;     // Device manufacturer (if available)
}
```

#### `ESCLCapabilities`
```typescript
interface ESCLCapabilities {
  resolutions: number[];                                    // Available DPI values
  colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[]; // Available color modes
  sources: ('Platen' | 'Adf' | 'Feeder')[];               // Available scan sources
}
```

### Classes

#### `ESCLClient`

Main client for communicating with eSCL scanners.

```typescript
class ESCLClient {
  constructor(timeout?: number);

  async getCapabilities(scanner: ESCLScanner): Promise<ESCLCapabilities | null>;
  async createScanJob(scanner: ESCLScanner, dpi: number, colorMode: string, source: string): Promise<string | null>;
  async getScanJobStatus(scanner: ESCLScanner, jobId: string): Promise<{ status: string; images: string[] }>;
  async downloadImage(scanner: ESCLScanner, imageUrl: string): Promise<Buffer | null>;
}
```

#### `ESCLDiscovery`

Scanner discovery service using Python subprocess with zeroconf.

```typescript
class ESCLDiscovery {
  constructor(timeout?: number);

  async startDiscovery(): Promise<ESCLScanner[]>;
  stopDiscovery(): void;
  getScanners(): ESCLScanner[];
  onScannerDiscovered(callback: (scanners: ESCLScanner[]) => void): void;
  offScannerDiscovered(callback: (scanners: ESCLScanner[]) => void): void;
}
```

### Functions

#### `discoverScanners(timeout: number): Promise<ESCLScanner[]>`

Convenience function for quick scanner discovery.

```typescript
const scanners = await discoverScanners(5000); // 5 second discovery
```

#### `quickScan(params): Promise<string[] | null>`

Convenience function for simple scan workflow.

```typescript
const images = await quickScan({
  scanner: device,
  dpi: 300,
  mode: 'color',
  source: 'Platen',
  timeout: 30000
});
```

## Architecture

### How It Works

1. **Discovery**: JavaScript code spawns a Python subprocess (`escl_main.py`)
2. **Python Subprocess**: Uses `zeroconf` library to discover eSCL scanners on the network via mDNS
3. **Communication**: JSON-RPC over stdin/stdout between Node.js and Python
4. **Image Processing**: Python handles image rotation and PNG encoding

### Design Rationale

- **Python for Discovery**: `zeroconf` library is more mature and stable than Node.js alternatives
- **Subprocess Architecture**: Isolates network scanning from main application
- **JSON-RPC Protocol**: Simple, reliable IPC between Node.js and Python processes
- **Image Encoding**: Base64 PNG encoding for safe cross-process transmission

## Configuration

### Environment Variables

```bash
# Python path (if non-standard)
export PYTHON_PATH=python3

# Logging (if implemented)
export ESCL_DEBUG=1
```

### Timeouts

```typescript
const client = new ESCLClient(10000);  // 10 second HTTP timeout
const scanners = await discoverScanners(5000);  // 5 second discovery window
```

## Troubleshooting

### Scanners Not Found

1. **Check Python Dependencies**:
   ```bash
   pip install zeroconf pillow
   ```

2. **Verify Network**:
   - Ensure scanner is on same network as computer
   - Check scanner is powered on and connected
   - Verify network is mDNS-enabled (not blocked by firewall)

3. **Enable Debug Output**:
   ```typescript
   import { ESCLDiscovery } from '@escl-protocol/scanner';
   const discovery = new ESCLDiscovery();
   // Check stderr output for Python errors
   ```

### Connection Refused

1. Verify scanner IP and port (usually port 80)
2. Ensure firewall allows HTTP access to scanner
3. Check scanner supports eSCL protocol (AirPrint-compatible)

### Scan Timeouts

1. Increase timeout value:
   ```typescript
   const client = new ESCLClient(30000);  // 30 seconds
   ```

2. Check scanner network latency
3. Reduce scan resolution for slower networks

### Image Processing Issues

1. Verify `pillow` library is installed:
   ```bash
   pip install --upgrade pillow
   ```

2. Check disk space for image temporary files
3. Verify scanner outputs valid PNG/JPEG images

## Error Handling

```typescript
try {
  const scanners = await discoverScanners(5000);

  if (scanners.length === 0) {
    throw new Error('No scanners found');
  }

  const capabilities = await client.getCapabilities(scanners[0]);
  if (!capabilities) {
    throw new Error('Failed to get capabilities');
  }

  const jobId = await client.createScanJob(scanners[0], 300, 'RGB24', 'Platen');
  if (!jobId) {
    throw new Error('Failed to create scan job');
  }
} catch (error) {
  console.error('eSCL operation failed:', error.message);
  // Handle error appropriately
}
```

## Performance Considerations

- **Discovery Time**: ~5 seconds for local network scan
- **Scan Time**: Varies by document size, DPI, and network latency
  - Single page A4 at 300 DPI: typically 5-10 seconds
  - Large batch jobs: minutes depending on document count
- **Memory Usage**: Python subprocess uses ~50-100MB when idle
- **Network**: Requires local network access to scanners (no internet required)

## Compatibility

### Operating Systems
- ✅ macOS 10.14+
- ✅ Linux (Ubuntu 18.04+, CentOS 7+, etc.)
- ✅ Windows 10+ (with Python 3.6+)

### Node.js Versions
- ✅ Node.js 14.x
- ✅ Node.js 16.x
- ✅ Node.js 18.x
- ✅ Node.js 20.x

### Scanner Models
- ✅ Canon: iR-ADV C series, iR 2500/3000 series
- ✅ HP: LaserJet Pro M series, MFP devices
- ✅ Xerox: WorkCentre 5000+ series
- ✅ Ricoh: MP C series
- ✅ Epson: WorkForce Pro series
- ✅ Brother: MFC series (eSCL enabled)

## Development

### Building from Source

```bash
# Install dependencies
yarn install

# Build TypeScript
yarn build

# Clean build artifacts
yarn clean

# Watch mode
yarn build:watch
```

### Project Structure

```
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # TypeScript interfaces
│   ├── client.ts          # eSCL HTTP client
│   ├── discovery.ts       # Scanner discovery service
│   └── [...other files]
├── python/
│   ├── escl_main.py       # Python subprocess entry point
│   ├── escl_backend.py    # eSCL protocol implementation
│   └── base.py            # Base class for backends
├── dist/                  # Compiled JavaScript (generated)
├── package.json
└── README.md
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with description of changes
4. Ensure tests pass and code follows project conventions

## License

MIT

## Support

For issues, questions, or feature requests:
- GitHub Repository: [escl-protocol-scanner](https://github.com/byeong1/escl-protocol-scanner)
- GitHub Issues: [Report Issues](https://github.com/byeong1/escl-protocol-scanner/issues)
- npm Package: [@escl-protocol/scanner](https://www.npmjs.com/package/@escl-protocol/scanner)
- Email: your-email@example.com

## Changelog

### Version 1.0.0 (Initial Release)
- Basic eSCL protocol support
- Scanner discovery via mDNS
- Single and batch scanning
- Image rotation and encoding
- Support for multiple manufacturers
