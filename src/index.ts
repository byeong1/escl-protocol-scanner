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
  documentFormat: string;
  timeout?: number;
  savePath?: string;
  width?: number;
  height?: number;
}): Promise<string[] | null> {
  let { scanner, dpi, mode, source, documentFormat, timeout, savePath, width, height } = params;
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
    const jobId = await client.createScanJob(scanner, dpi, colorMode, source, documentFormat, width, height);
    if (!jobId) {
      throw new Error('[SCAN_JOB_FAILED] 스캔 작업을 생성할 수 없습니다. 스캐너 상태를 확인해주세요.');
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
      const imageBuffer = await downloadNextDocument(jobUrl, 30, 1000, isAdf);

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
      const filePath = await saveImageToFile(savePath, imageBuffer, pageNum, documentFormat);
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
    throw error;
  }
}

/**
 * Save image to file system
 * @param folderPath Target folder path
 * @param imageBuffer Image data buffer
 * @param pageNum Page number
 * @param documentFormat MIME type (e.g., 'image/jpeg', 'image/png', 'application/pdf')
 */
async function saveImageToFile(folderPath: string, imageBuffer: Buffer, pageNum: number, documentFormat: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const path = require('path');

    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      let ext = documentFormat.split('/').pop()!;
      if (ext === 'jpeg') ext = 'jpg';

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `scan_${timestamp}_page${pageNum}.${ext}`;
      const filePath = path.join(folderPath, fileName);

      fs.writeFileSync(filePath, imageBuffer);
      console.log(`[eSCL] Image saved: ${filePath}`);

      resolve(filePath);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Download next document from scan job with retry for 409 (busy)
 */
async function downloadNextDocument(jobUrl: string, maxRetries: number = 30, retryDelay: number = 1000, isAdf: boolean = false): Promise<Buffer | null> {
  const nextDocUrl = `${jobUrl}/NextDocument`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await httpGetBinary(nextDocUrl);
    } catch (error: any) {
      const statusCode = error.code || (error.message && parseInt(error.message.match(/HTTP (\d+)/)?.[1]));

      /* 404: 스캔 완료 (더 이상 문서 없음) */
      if (statusCode === 404) {
        return null;
      }

      /* 409: 스캐너가 아직 작업 중 - 재시도 */
      if (statusCode === 409) {
        console.log(`[eSCL] Scanner busy (409), waiting... (attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      /* 500: ADF 모드에서 문서 없음 */
      if (statusCode === 500 && isAdf) {
        throw new Error('[ADF_NO_DOCUMENT] 문서가 급지기(ADF)에 올려져 있지 않습니다.');
      }

      console.error('[eSCL] Failed to download next document:', error);
      return null;
    }
  }

  /* 최대 재시도 횟수 초과 */
  throw new Error('[SCANNER_BUSY] 스캐너가 다른 작업을 처리 중입니다. 잠시 후 다시 시도해주세요.');
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
