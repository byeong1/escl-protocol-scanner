/**
 * @escl-protocol/scanner
 * eSCL/AirPrint Protocol Scanner Library
 *
 * A comprehensive TypeScript/Node.js library for discovering and communicating
 * with network scanners using the eSCL (eSC Lexmark) protocol, which is based
 * on AirPrint standards.
 *
 * Features:
 * - Automatic scanner discovery via mDNS/Bonjour
 * - HTTP-based communication with eSCL devices
 * - Support for multiple color modes and resolutions
 * - Image download and processing
 * - Compatible with Canon, HP, Epson, and other MFP devices
 *
 * @example
 * ```typescript
 * import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';
 *
 * // Discover available scanners
 * const scanners = await discoverScanners(5000);
 * console.log(`Found ${scanners.length} scanners`);
 *
 * // Get scanner capabilities
 * const client = new ESCLClient();
 * const caps = await client.getCapabilities(scanners[0]);
 * console.log('Available resolutions:', caps?.resolutions);
 *
 * // Perform a scan
 * const jobId = await client.createScanJob(
 *   scanners[0],
 *   300,           // 300 DPI
 *   'RGB24',       // Full color
 *   'Platen'       // Flatbed
 * );
 * ```
 */

// Type exports
export type {
  ESCLScanner,
  ESCLCapabilities,
  ESCLScanParams,
  ScannedImage,
  ESCLResponse,
  ScannerResponse,
  ColorModeMap,
  SaveImageParams,
  SaveImageResult,
  ESCLCommand,
  PythonCommand,
  ScanParams,
  ProcessSpawnOptions,
  DiscoveryResponse
} from './types';

export type { ESCLDiscoveryOptions } from './discovery';

// Class imports and exports
import { ESCLClient } from './client';
export { ESCLClient } from './client';
export { ESCLDiscovery, discoverScanners } from './discovery';

// Version
export const VERSION = '1.0.0';

/**
 * Quick scan helper - convenience function for common scan workflow
 *
 * @example
 * ```typescript
 * import { quickScan } from '@escl-protocol/scanner';
 *
 * // With custom save path
 * const filePaths = await quickScan({
 *   scanner: scannerDevice,
 *   dpi: 300,
 *   mode: 'color',
 *   source: 'Platen',
 *   savePath: '/path/to/save/folder'
 * });
 *
 * // Without save path - defaults to current working directory
 * const filePaths = await quickScan({
 *   scanner: scannerDevice,
 *   dpi: 300,
 *   mode: 'color',
 *   source: 'Platen'
 * });
 * ```
 */
export async function quickScan(params: {
  scanner: any;
  dpi: number;
  mode: 'bw' | 'gray' | 'color';
  source: 'Platen' | 'Feeder';
  timeout?: number;
  savePath?: string;
}): Promise<string[] | null> {
  let { scanner, dpi, mode, source, timeout, savePath } = params;
  const client = new ESCLClient(timeout);

  // Default save path to current working directory if not provided
  if (!savePath) {
    savePath = process.cwd();
  }

  try {
    // Map mode to eSCL color mode
    const colorModeMap: Record<string, string> = {
      'bw': 'BlackAndWhite1',
      'gray': 'Grayscale8',
      'color': 'RGB24'
    };

    const colorMode = colorModeMap[mode];
    if (!colorMode) {
      throw new Error(`Invalid color mode: ${mode}`);
    }

    // 1. Create scan job
    const jobId = await client.createScanJob(scanner, dpi, colorMode, source);
    if (!jobId) {
      throw new Error('Failed to create scan job');
    }

    const jobUrl = `http://${scanner.host}:${scanner.port}/eSCL/ScanJobs/${jobId}`;
    console.log(`[eSCL] Scan job created: ${jobUrl}`);

    // 2. Wait for scan to complete (5 seconds)
    console.log('[eSCL] Waiting for scan to complete (5 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 3. Download images via NextDocument endpoint
    const filePaths: string[] = [];
    let pageNum = 1;
    const isAdf = source === 'Feeder';

    while (true) {
      console.log(`[eSCL] Attempting to download page ${pageNum}...`);
      const imageBuffer = await downloadNextDocument(jobUrl);

      if (!imageBuffer) {
        // 404 or error
        if (pageNum === 1) {
          // First page failed
          throw new Error('Failed to download scan result. Make sure document is loaded in scanner.');
        } else {
          // Subsequent pages: 404 is normal (scan complete)
          console.log(`[eSCL] Scan completed: ${pageNum - 1} pages`);
          break;
        }
      }

      // Successfully got image data
      console.log(`[eSCL] Page ${pageNum} downloaded: ${imageBuffer.length} bytes`);

      // Save image to file
      const filePath = await saveImageToFile(savePath, imageBuffer, pageNum);
      filePaths.push(filePath);

      // Platen (flatbed) only has 1 page
      if (!isAdf) {
        break;
      }

      pageNum++;
    }

    // 4. Delete scan job (cleanup)
    await deleteScanJob(jobUrl);

    return filePaths.length > 0 ? filePaths : null;
  } catch (error) {
    console.error('Quick scan failed:', error);
    return null;
  }
}

/**
 * Save image to file system
 */
async function saveImageToFile(folderPath: string, imageBuffer: Buffer, pageNum: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const path = require('path');

    try {
      // Create folder if it doesn't exist
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `scan_${timestamp}_page${pageNum}.jpg`;
      const filePath = path.join(folderPath, fileName);

      // Write file synchronously
      fs.writeFileSync(filePath, imageBuffer);
      console.log(`[eSCL] Image saved: ${filePath}`);

      resolve(filePath);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Download next document from scan job
 */
async function downloadNextDocument(jobUrl: string): Promise<Buffer | null> {
  try {
    const nextDocUrl = `${jobUrl}/NextDocument`;
    return await httpGetBinary(nextDocUrl);
  } catch (error: any) {
    // 404 is expected when scan is complete
    if (error.code === 404 || (error.message && error.message.includes('404'))) {
      return null;
    }
    console.error('[eSCL] Failed to download next document:', error);
    return null;
  }
}

/**
 * Delete scan job (cleanup)
 */
async function deleteScanJob(jobUrl: string): Promise<void> {
  try {
    await httpDelete(jobUrl);
    console.log('[eSCL] Scan job deleted');
  } catch (error) {
    // Failure to delete is not critical
    console.log('[eSCL] Scan job delete attempted (already deleted by scanner)');
  }
}

/**
 * HTTP GET binary helper
 */
function httpGetBinary(url: string, timeout: number = 10000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = require('http').get(url, { timeout }, (res: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          const error: any = new Error(`HTTP ${res.statusCode}`);
          error.code = res.statusCode;
          reject(error);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
  });
}

/**
 * HTTP DELETE helper
 */
function httpDelete(url: string, timeout: number = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'DELETE',
      timeout
    };

    const req = require('http').request(url, options, (res: any) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve();
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
    req.end();
  });
}
