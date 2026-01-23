# @crowsgear/escl-protocol-scanner

Network scanner library based on eSCL/AirPrint protocol.

> **Note**: This library only supports network-connected scanners (WiFi or LAN). USB scanners are not supported.

## Installation

```bash
npm install @crowsgear/escl-protocol-scanner
# or
yarn add @crowsgear/escl-protocol-scanner
```

**No Python installation required!** Pre-built binaries for Windows, macOS, and Linux are included.

## Quick Start

```typescript
import { eSCLScanner } from '@crowsgear/escl-protocol-scanner';

// 1. Discover scanners
const result = await eSCLScanner.discoverScanners(10000);
if (result.success && result.data.length > 0) {
  console.log('Found scanners:', result.data);
}

// 2. Get scanner capabilities
const scanner = result.data[0];
const capabilities = await eSCLScanner.getCapabilities(scanner);
console.log('Resolutions:', capabilities?.resolutions);
console.log('Color modes:', capabilities?.colorModes);

// 3. Perform scan
const filePaths = await eSCLScanner.quickScan({
  scanner: scanner,
  dpi: 300,
  mode: 'color',
  source: 'Platen',
  documentFormat: 'image/jpeg',
  savePath: '/path/to/save',
});
console.log('Saved files:', filePaths);
```

## API

### eSCLScanner

Default instance, ready to use.

```typescript
import { eSCLScanner } from '@crowsgear/escl-protocol-scanner';

// Discover scanners
const result = await eSCLScanner.discoverScanners(timeout?: number);

// Get scanner capabilities
const caps = await eSCLScanner.getCapabilities(scanner: IESCLScanner);

// Quick scan
const files = await eSCLScanner.quickScan(params: IQuickScanParams);

// Create scan job
const jobId = await eSCLScanner.createScanJob(scanner, dpi, colorMode, source, documentFormat, width?, height?);

// Get scan job status
const status = await eSCLScanner.getScanJobStatus(scanner, jobId);

// Download image
const buffer = await eSCLScanner.downloadImage(scanner, imageUrl);
```

### Application (Custom Configuration)

Create a new instance for custom configuration.

```typescript
import { Application } from '@crowsgear/escl-protocol-scanner';

const myScanner = new Application({
  timeout: 15000,
  debug: true,
});

const result = await myScanner.discoverScanners();
```

### quickScan Parameters

```typescript
interface IQuickScanParams {
  scanner: IESCLScanner;         // Scanner device
  dpi: number;                    // Resolution (e.g., 200, 300, 600)
  mode: 'bw' | 'gray' | 'color';  // Color mode
  source: 'Platen' | 'Feeder';    // Scan source (flatbed/ADF)
  documentFormat: string;         // MIME type (e.g., 'image/jpeg')
  savePath?: string;              // Save path (default: cwd)
  width?: number;                 // Scan width in mm (default: 210)
  height?: number;                // Scan height in mm (default: 297)
  timeout?: number;               // Timeout in ms
}
```

## Types

```typescript
interface IESCLScanner {
  name: string;
  host: string;
  port: number;
  model?: string;
  manufacturer?: string;
}

interface IESCLCapabilities {
  resolutions: number[];
  colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[];
  sources: ('Platen' | 'Adf' | 'Feeder')[];
  documentFormats: string[];
  maxWidth?: number;
  maxHeight?: number;
}

interface IDiscoveryResponse {
  success: boolean;
  data: IESCLScanner[];
  error?: string;
}
```

## Paper Size Reference

| Paper  | Width (mm) | Height (mm) |
|--------|------------|-------------|
| A4     | 210        | 297         |
| A3     | 297        | 420         |
| Letter | 216        | 279         |
| Legal  | 216        | 356         |

## Supported Scanners

AirPrint/eSCL compatible network scanners:

- Canon iR-ADV series
- HP LaserJet MFP
- Xerox WorkCentre
- Epson WorkForce Pro
- Other AirPrint compatible MFPs

## Development

For development without pre-built binaries, you can use Python directly:

```bash
pip install zeroconf pillow
```

```typescript
import { Application } from '@crowsgear/escl-protocol-scanner';

const scanner = new Application({
  pythonPath: '/path/to/.venv/bin/python3',
});

const result = await scanner.discoverScanners();
```

> **Note**: When pre-built binaries exist, they take priority over Python scripts.

## License

MIT
