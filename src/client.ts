/**
 * eSCL Protocol Client for Node.js
 * HTTP client for communicating with eSCL/AirPrint network scanners
 */

import * as http from 'http';
import { ESCLScanner, ESCLCapabilities, ESCLResponse } from './types';

/**
 * eSCL HTTP Client
 * Handles all HTTP communication with eSCL-compatible network scanners
 */
export class ESCLClient {
  private timeout: number = 10000;

  constructor(timeout?: number) {
    if (timeout) {
      this.timeout = timeout;
    }
  }

  /**
   * Get scanner capabilities
   * @param scanner Target scanner
   * @returns Scanner capabilities
   */
  async getCapabilities(scanner: ESCLScanner): Promise<ESCLCapabilities | null> {
    try {
      const response = await this.httpGet(
        `http://${scanner.host}:${scanner.port}/eSCL/ScannerCapabilities`
      );

      return this.parseCapabilities(response);
    } catch (error) {
      console.error(`Failed to get capabilities for ${scanner.name}:`, error);
      return null;
    }
  }

  /**
   * Start scan job
   * @param scanner Target scanner
   * @param dpi Resolution in DPI
   * @param colorMode Color mode (BlackAndWhite1, Grayscale8, RGB24)
   * @param source Scan source (Platen, Feeder)
   * @returns Scan job UUID
   */
  async createScanJob(
    scanner: ESCLScanner,
    dpi: number,
    colorMode: string,
    source: string
  ): Promise<string | null> {
    try {
      const scanSettings = this.buildScanSettings(dpi, colorMode, source);
      const jobResponse = await this.httpPost(
        `http://${scanner.host}:${scanner.port}/eSCL/ScanJobs`,
        scanSettings
      );

      // Extract job UUID from Location header or response
      const jobMatch = jobResponse.match(/\/eSCL\/ScanJobs\/([a-f0-9-]+)/);
      if (jobMatch) {
        return jobMatch[1];
      }

      return null;
    } catch (error) {
      console.error(`Failed to create scan job on ${scanner.name}:`, error);
      return null;
    }
  }

  /**
   * Poll scan job status
   * @param scanner Target scanner
   * @param jobId Scan job ID
   * @returns Job status and image URLs if complete
   */
  async getScanJobStatus(scanner: ESCLScanner, jobId: string): Promise<{
    status: 'Processing' | 'Completed' | 'Aborted' | 'Unknown';
    images: string[];
  }> {
    try {
      const response = await this.httpGet(
        `http://${scanner.host}:${scanner.port}/eSCL/ScanJobs/${jobId}`
      );

      const status = response.match(/<JobState>(\w+)<\/JobState>/)?.[1] || 'Unknown';
      const images: string[] = [];

      // Extract image URLs
      const imageMatches = response.matchAll(/<DocumentURI>([^<]+)<\/DocumentURI>/g);
      for (const match of imageMatches) {
        images.push(match[1]);
      }

      return {
        status: status as 'Processing' | 'Completed' | 'Aborted' | 'Unknown',
        images
      };
    } catch (error) {
      console.error(`Failed to get scan job status:`, error);
      return { status: 'Unknown', images: [] };
    }
  }

  /**
   * Download scanned image
   * @param scanner Target scanner
   * @param imageUrl Relative image URL
   * @returns PNG image data as Buffer
   */
  async downloadImage(scanner: ESCLScanner, imageUrl: string): Promise<Buffer | null> {
    try {
      const fullUrl = `http://${scanner.host}:${scanner.port}${imageUrl}`;
      return await this.httpGetBinary(fullUrl);
    } catch (error) {
      console.error(`Failed to download image:`, error);
      return null;
    }
  }

  /**
   * Build eSCL scan settings XML
   */
  private buildScanSettings(dpi: number, colorMode: string, source: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ScanSettings xmlns="http://schemas.hp.com/imaging/escl/2011/05/03">
  <Version>2.5</Version>
  <ScanRegions>
    <ScanRegion>
      <ContentRegionUnits>mms</ContentRegionUnits>
      <ContentRegionXOffset>0</ContentRegionXOffset>
      <ContentRegionYOffset>0</ContentRegionYOffset>
      <ContentRegionWidth>210</ContentRegionWidth>
      <ContentRegionHeight>297</ContentRegionHeight>
    </ScanRegion>
  </ScanRegions>
  <InputSource>${source}</InputSource>
  <ColorMode>${colorMode}</ColorMode>
  <XResolution>${dpi}</XResolution>
  <YResolution>${dpi}</YResolution>
  <ChromaticityMode>Auto</ChromaticityMode>
  <Brightness>0</Brightness>
  <Contrast>0</Contrast>
</ScanSettings>`;
  }

  /**
   * Parse scanner capabilities from XML response
   */
  private parseCapabilities(xml: string): ESCLCapabilities {
    const resolutions: number[] = [];
    const colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[] = [];
    const sources: ('Platen' | 'Adf' | 'Feeder')[] = [];

    // Extract resolutions
    const resolutionMatches = xml.matchAll(/<Res>(\d+)<\/Res>/g);
    for (const match of resolutionMatches) {
      resolutions.push(parseInt(match[1], 10));
    }

    // Extract color modes
    const colorMatches = xml.matchAll(/<ColorMode>(\w+)<\/ColorMode>/g);
    for (const match of colorMatches) {
      const mode = match[1] as 'BlackAndWhite1' | 'Grayscale8' | 'RGB24';
      if (['BlackAndWhite1', 'Grayscale8', 'RGB24'].includes(mode)) {
        colorModes.push(mode);
      }
    }

    // Extract sources
    const sourceMatches = xml.matchAll(/<InputSource>(\w+)<\/InputSource>/g);
    for (const match of sourceMatches) {
      const source = match[1] as 'Platen' | 'Adf' | 'Feeder';
      if (['Platen', 'Adf', 'Feeder'].includes(source)) {
        sources.push(source);
      }
    }

    return { resolutions, colorModes, sources };
  }

  /**
   * HTTP GET request
   */
  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: this.timeout }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
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
   * HTTP GET request (binary)
   */
  private httpGetBinary(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: this.timeout }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(Buffer.concat(chunks));
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
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
   * HTTP POST request
   */
  private httpPost(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: this.timeout
      };

      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 201 || res.statusCode === 200) {
            resolve(data || res.headers.location || '');
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
