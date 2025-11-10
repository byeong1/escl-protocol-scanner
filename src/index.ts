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
  ProcessSpawnOptions
} from './types';

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
 * const images = await quickScan({
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
}): Promise<string[] | null> {
  const { scanner, dpi, mode, source, timeout } = params;
  const client = new ESCLClient(timeout);

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

    // Create scan job
    const jobId = await client.createScanJob(scanner, dpi, colorMode, source);
    if (!jobId) {
      throw new Error('Failed to create scan job');
    }

    // Poll for completion (simplified - in production use more sophisticated polling)
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const status = await client.getScanJobStatus(scanner, jobId);

      if (status.status === 'Completed') {
        // Download images
        const images: string[] = [];
        for (const imageUrl of status.images) {
          const imageBuffer = await client.downloadImage(scanner, imageUrl);
          if (imageBuffer) {
            images.push(imageBuffer.toString('base64'));
          }
        }
        return images;
      }

      if (status.status === 'Aborted') {
        throw new Error('Scan job was aborted');
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Scan job timeout');
  } catch (error) {
    console.error('Quick scan failed:', error);
    return null;
  }
}
