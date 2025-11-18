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
   * @param debug Enable debug logging (default: false)
   * @returns Scanner capabilities
   */
  async getCapabilities(scanner: ESCLScanner, debug: boolean = false): Promise<ESCLCapabilities | null> {
    try {
      const response = await this.httpGet(
        `http://${scanner.host}:${scanner.port}/eSCL/ScannerCapabilities`
      );

      return this.parseCapabilities(response, debug);
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
    // Match the Python implementation which uses proper namespaces
    const ESCL_NS = 'http://schemas.hp.com/imaging/escl/2011/05/03';
    const PWG_NS = 'http://www.pwg.org/schemas/2010/12/sm';

    return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="${ESCL_NS}" xmlns:pwg="${PWG_NS}">
  <pwg:Version>2.0</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>
      <pwg:XOffset>0</pwg:XOffset>
      <pwg:YOffset>0</pwg:YOffset>
      <pwg:Width>3508</pwg:Width>
      <pwg:Height>4961</pwg:Height>
    </pwg:ScanRegion>
  </pwg:ScanRegions>
  <scan:Justification>
    <pwg:XImagePosition>Center</pwg:XImagePosition>
    <pwg:YImagePosition>Center</pwg:YImagePosition>
  </scan:Justification>
  <pwg:InputSource>${source}</pwg:InputSource>
  <scan:ColorMode>${colorMode}</scan:ColorMode>
  <scan:XResolution>${dpi}</scan:XResolution>
  <scan:YResolution>${dpi}</scan:YResolution>
  <pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat>
</scan:ScanSettings>`;
  }

  /**
   * Parse scanner capabilities from XML response
   * @param xml XML response from scanner
   * @param debug Enable debug logging (default: false)
   */
  private parseCapabilities(xml: string, debug: boolean = false): ESCLCapabilities {
    const resolutions: number[] = [];
    const colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[] = [];
    const sources: ('Platen' | 'Adf' | 'Feeder')[] = [];

    // Debug: Print raw XML for inspection (only if debug enabled)
    if (debug) {
      console.log('[eSCL] Capabilities XML response (full):');
      console.log(xml);
    }

    // eSCL uses XML namespaces, need to handle scan: and pwg: prefixes
    // Extract resolutions - look for XResolution inside DiscreteResolution
    const discreteResMatches = xml.matchAll(/<[a-z]*:?DiscreteResolution>[\s\S]*?<[a-z]*:?XResolution>(\d+)<\/[a-z]*:?XResolution>[\s\S]*?<\/[a-z]*:?DiscreteResolution>/g);
    for (const match of discreteResMatches) {
      resolutions.push(parseInt(match[1], 10));
    }

    // Also try simpler pattern for XResolution
    if (resolutions.length === 0) {
      const xResMatches = xml.matchAll(/<[a-z]*:?XResolution>(\d+)<\/[a-z]*:?XResolution>/g);
      for (const match of xResMatches) {
        const res = parseInt(match[1], 10);
        if (!resolutions.includes(res)) {
          resolutions.push(res);
        }
      }
    }

    // Extract color modes - handle namespaced tags
    const colorMatches = xml.matchAll(/<[a-z]*:?ColorMode>(\w+)<\/[a-z]*:?ColorMode>/g);
    for (const match of colorMatches) {
      const mode = match[1] as 'BlackAndWhite1' | 'Grayscale8' | 'RGB24';
      if (['BlackAndWhite1', 'Grayscale8', 'RGB24'].includes(mode)) {
        colorModes.push(mode);
      }
    }

    // Extract sources - look for InputSource tags or check for Platen/Adf elements
    const sourceMatches = xml.matchAll(/<[a-z]*:?InputSource>(\w+)<\/[a-z]*:?InputSource>/g);
    for (const match of sourceMatches) {
      const source = match[1] as 'Platen' | 'Adf' | 'Feeder';
      if (['Platen', 'Adf', 'Feeder'].includes(source)) {
        sources.push(source);
      }
    }

    // If no InputSource tags found, check for Platen/Adf elements directly
    if (sources.length === 0) {
      if (/<[a-z]*:?Platen[\s>]/.test(xml)) {
        sources.push('Platen');
      }
      if (/<[a-z]*:?Adf[\s>]/.test(xml)) {
        sources.push('Adf');
      }
    }

    // Remove duplicates from resolutions
    const uniqueResolutions = Array.from(new Set(resolutions)).sort((a, b) => a - b);
    const uniqueColorModes = Array.from(new Set(colorModes));
    const uniqueSources = Array.from(new Set(sources));

    if (debug) {
      console.log('[eSCL] Parsed capabilities:', { resolutions: uniqueResolutions, colorModes: uniqueColorModes, sources: uniqueSources });
    }

    return { resolutions: uniqueResolutions, colorModes: uniqueColorModes, sources: uniqueSources };
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
