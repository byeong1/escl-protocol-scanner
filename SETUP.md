# eSCL Protocol Scanner - Setup Guide

This guide walks you through setting up the `@escl-protocol/scanner` package for use in your Node.js/Electron projects.

## Quick Setup

### 1. Install Package

```bash
# Using npm
npm install @escl-protocol/scanner

# Using yarn
yarn add @escl-protocol/scanner
```

### 2. Install Python Dependencies

The package requires Python 3.6+ with these libraries:

```bash
pip install zeroconf pillow
```

### 3. Import and Use

```typescript
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

// Discover scanners
const scanners = await discoverScanners(5000);

// Use scanner
const client = new ESCLClient();
const caps = await client.getCapabilities(scanners[0]);
```

## System Requirements

### Node.js
- **Minimum**: Node.js 14.0.0
- **Recommended**: Node.js 18.0.0 or later

### Python
- **Minimum**: Python 3.6
- **Recommended**: Python 3.8 or later

### Operating Systems
- macOS 10.14+
- Linux (Ubuntu 18.04+, CentOS 7+, etc.)
- Windows 10+ (with Python installed)

## Installation Troubleshooting

### Python not found

**Problem**: `python3: command not found`

**Solution**:
1. Install Python 3 via [python.org](https://www.python.org/downloads/)
2. On macOS, use Homebrew:
   ```bash
   brew install python@3.11
   ```
3. On Ubuntu:
   ```bash
   sudo apt-get install python3 python3-pip
   ```
4. Verify installation:
   ```bash
   python3 --version
   pip3 --version
   ```

### zeroconf or pillow not installed

**Problem**: `ImportError: No module named 'zeroconf'` or `ImportError: No module named 'PIL'`

**Solution**:
```bash
pip install --upgrade zeroconf pillow
```

### Global pip installation issues

**Problem**: Permission denied when running `pip install`

**Solution**: Use user installation:
```bash
pip install --user zeroconf pillow
```

Or use virtual environment:
```bash
python3 -m venv scanner-env
source scanner-env/bin/activate  # On Windows: scanner-env\Scripts\activate
pip install zeroconf pillow
```

## Using in an Electron App

### Step 1: Install Package

```bash
yarn add @escl-protocol/scanner
```

### Step 2: Add Python Installation (Optional)

For distribution, you may want to include Python with your app. Use something like:
- `python-embedded` on Windows
- System Python via packaging tools

### Step 3: Update Main Process

```typescript
// main.ts
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

class ScannerService {
  async discoverScanners(timeout: number = 5000) {
    try {
      const scanners = await discoverScanners(timeout);
      return { success: true, scanners };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getScannerCapabilities(scanner: any) {
    const client = new ESCLClient();
    const caps = await client.getCapabilities(scanner);
    return caps;
  }
}

// Export for IPC
const scannerService = new ScannerService();
ipcMain.handle('scanner:discover', (event) => scannerService.discoverScanners());
ipcMain.handle('scanner:capabilities', (event, scanner) =>
  scannerService.getScannerCapabilities(scanner)
);
```

### Step 4: Use in Renderer Process

```typescript
// renderer.ts
const scanners = await window.api.invoke('scanner:discover');
if (scanners.success) {
  const caps = await window.api.invoke('scanner:capabilities', scanners.scanners[0]);
  console.log('Supported resolutions:', caps.resolutions);
}
```

## Using in a Web Server (Node.js)

### Step 1: Install Package

```bash
npm install @escl-protocol/scanner
```

### Step 2: Create Scanner API

```typescript
// scanner-api.ts
import express from 'express';
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

const app = express();

app.get('/api/scanners', async (req, res) => {
  try {
    const scanners = await discoverScanners(5000);
    res.json({ success: true, scanners });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/scanner/:host/capabilities', async (req, res) => {
  try {
    const scanner = {
      name: 'Scanner',
      host: req.params.host,
      port: 80
    };
    const client = new ESCLClient();
    const caps = await client.getCapabilities(scanner);
    res.json({ success: true, capabilities: caps });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Scanner API listening on port 3000');
});
```

### Step 3: Run Server

```bash
npx ts-node scanner-api.ts
```

## Environment Variables

```bash
# Optional: Specify Python path (if non-standard)
export PYTHON_PATH=python3

# Optional: Enable debug logging
export ESCL_DEBUG=1
```

## Build from Source

If you want to build the package yourself:

```bash
# Clone/download the repository
cd escl-protocol-scanner

# Install dependencies
yarn install

# Build TypeScript
yarn build

# Watch mode for development
yarn build:watch

# Clean build artifacts
yarn clean
```

## Verification

### Verify Installation

```typescript
import { discoverScanners } from '@escl-protocol/scanner';

async function verify() {
  console.log('Testing eSCL Scanner package...');
  try {
    const scanners = await discoverScanners(3000);
    console.log(`✓ Package loaded successfully`);
    console.log(`✓ Found ${scanners.length} scanners on network`);
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

verify();
```

### Check Python Installation

```bash
python3 -c "import zeroconf; import PIL; print('✓ All dependencies installed')"
```

## Production Deployment

### For Node.js Apps

1. Install package: `npm install @escl-protocol/scanner`
2. Ensure Python dependencies are installed on production server
3. Test scanner discovery before deploying

### For Electron Apps

1. Bundle Python with your app (optional but recommended)
2. Include Python dependencies in package
3. Add scanner module to your build process
4. Test with actual scanner hardware before release

### Performance Considerations

- **Discovery Timeout**: 5 seconds by default (adjust based on network size)
- **HTTP Timeout**: 10 seconds by default (increase for slower networks)
- **Memory Usage**: ~50-100MB when Python subprocess is running
- **Network**: Requires local network access to scanners

## Getting Help

### Common Issues

**Scanner Discovery Returns Empty**
- Check scanner is on same network
- Verify mDNS is not blocked by firewall
- Try increasing discovery timeout: `discoverScanners(10000)`

**Connection Timeout**
- Verify scanner IP and port
- Check network latency
- Try increasing HTTP timeout: `new ESCLClient(30000)`

**Image Processing Issues**
- Verify `pillow` library: `pip install --upgrade pillow`
- Check disk space for temp files
- Verify scanner outputs valid images

### Debug Mode

Enable detailed logging:

```typescript
import { ESCLDiscovery } from '@escl-protocol/scanner';

const discovery = new ESCLDiscovery();
// Check stderr for Python debug messages
const scanners = await discovery.startDiscovery();
```

### Getting Support

- GitHub Issues: [Report Issues](https://github.com/yourusername/escl-protocol-scanner/issues)
- Documentation: See [README.md](./README.md)
- Email Support: your-email@example.com

## Next Steps

After setup, check out:
1. [README.md](./README.md) - Full API documentation
2. [examples/](./examples/) - Usage examples
3. [python/README.md](./python/README.md) - Python backend documentation
