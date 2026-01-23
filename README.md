# @crowsgear/escl-protocol-scanner

Network scanner library based on eSCL/AirPrint protocol.

> **Note**: This library only supports network-connected scanners (WiFi or LAN). USB scanners are not supported - use WIA (Windows) or system scan dialog instead.

## Installation

```bash
npm install @crowsgear/escl-protocol-scanner
# or
yarn add @crowsgear/escl-protocol-scanner
```

### Python Dependencies

Requires Python 3.6+ and the following packages:

```bash
pip install zeroconf pillow
```

## Quick Start

### 1. Discover Scanners

```typescript
import { discoverScanners } from "@crowsgear/escl-protocol-scanner";

// Basic usage (uses system Python)
const result = await discoverScanners(10000);

// Specify Python path directly (recommended)
const result = await discoverScanners(10000, {
    pythonPath: "/path/to/.venv/bin/python3",
});

if (result.success && result.data.length > 0) {
    console.log("Found scanners:", result.data);
}
```

### 2. Get Scanner Capabilities

```typescript
import { ESCLClient } from "@crowsgear/escl-protocol-scanner";

const client = new ESCLClient(10000);
const capabilities = await client.getCapabilities(scanner);

// capabilities structure:
// {
//   resolutions: [100, 200, 300, 600],      // Supported DPI
//   colorModes: ['BlackAndWhite1', 'Grayscale8', 'RGB24'],
//   sources: ['Platen', 'Adf'],              // Platen=flatbed, Adf=feeder
//   maxWidth: 297,                           // Max scan width (mm)
//   maxHeight: 432                           // Max scan height (mm)
// }
```

### 3. Perform Scan

```typescript
import { quickScan } from "@crowsgear/escl-protocol-scanner";

const filePaths = await quickScan({
    scanner: scanner,
    dpi: 300,
    mode: "color", // 'bw' | 'gray' | 'color'
    source: "Platen", // 'Platen' | 'Feeder'
    savePath: "/save/path",
    width: 210, // Scan width in mm (default: 210 = A4)
    height: 297, // Scan height in mm (default: 297 = A4)
    timeout: 30000,
});

if (filePaths) {
    console.log("Saved files:", filePaths);
}
```

## Paper Size Reference

| Paper  | Width (mm) | Height (mm) |
| ------ | ---------- | ----------- |
| A4     | 210        | 297         |
| A3     | 297        | 420         |
| Letter | 216        | 279         |
| Legal  | 216        | 356         |

## Cross-Platform Python Path

```typescript
import path from "path";

const projectRoot = process.cwd();
const pythonPath =
    process.platform === "win32"
        ? path.join(projectRoot, ".venv", "python.exe")
        : path.join(projectRoot, ".venv", "bin", "python3");

const result = await discoverScanners(10000, { pythonPath });
```

## API

### discoverScanners(timeout, options?)

Discovers eSCL scanners on the network.

```typescript
const result = await discoverScanners(10000, { pythonPath: "/path/to/python3" });
// result: { success: boolean, data: ESCLScanner[], error?: string }
```

### ESCLClient

```typescript
const client = new ESCLClient(timeout?: number);

// Get scanner capabilities
const caps = await client.getCapabilities(scanner, debug?: boolean);

// Create scan job
const jobId = await client.createScanJob(
  scanner,
  dpi: number,
  colorMode: string,      // 'BlackAndWhite1' | 'Grayscale8' | 'RGB24'
  source: string,         // 'Platen' | 'Feeder'
  width?: number,         // mm (default: 210)
  height?: number         // mm (default: 297)
);

// Check scan status
const status = await client.getScanJobStatus(scanner, jobId);

// Download image
const buffer = await client.downloadImage(scanner, imageUrl);
```

### quickScan(params)

Convenience function - handles scan job creation to image saving in one call.

```typescript
const filePaths = await quickScan({
  scanner: ESCLScanner,
  dpi: number,
  mode: 'bw' | 'gray' | 'color',
  source: 'Platen' | 'Feeder',
  savePath?: string,      // Save path (default: cwd)
  width?: number,         // mm (default: 210)
  height?: number,        // mm (default: 297)
  timeout?: number
});
```

## Types

```typescript
interface ESCLScanner {
    name: string;
    host: string;
    port: number;
    model?: string;
    manufacturer?: string;
}

interface ESCLCapabilities {
    resolutions: number[];
    colorModes: ("BlackAndWhite1" | "Grayscale8" | "RGB24")[];
    sources: ("Platen" | "Adf" | "Feeder")[];
    maxWidth?: number; // mm
    maxHeight?: number; // mm
}
```

## Supported Scanners

AirPrint/eSCL compatible network scanners:

- Canon iR-ADV series
- HP LaserJet MFP
- Xerox WorkCentre
- Epson WorkForce Pro
- Other AirPrint compatible MFPs
- ...

## License

MIT
