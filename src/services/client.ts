/**
 * eSCL Protocol Client for Node.js
 * HTTP client for communicating with eSCL/AirPrint network scanners
 */

import * as http from 'http';
import { IESCLScanner, IESCLCapabilities } from '../types';

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
  async getCapabilities(scanner: IESCLScanner, debug: boolean = false): Promise<IESCLCapabilities | null> {
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
   * @param documentFormat Document format MIME type
   * @param width Scan width in mm (optional)
   * @param height Scan height in mm (optional)
   * @returns Scan job UUID
   */
  async createScanJob(
    scanner: IESCLScanner,
    dpi: number,
    colorMode: string,
    source: string,
    documentFormat: string,
    width?: number,
    height?: number
  ): Promise<string | null> {
    try {
      const scanSettings = this.buildScanSettings(dpi, colorMode, source, documentFormat, width, height);
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
    } catch (error: any) {
      const statusCode = error.code || (error.message && parseInt(error.message.match(/HTTP (\d+)/)?.[1]));

      /* 409: 스캐너가 다른 작업을 처리 중 */
      if (statusCode === 409) {
        throw new Error('[SCANNER_BUSY] 스캐너가 다른 작업을 처리 중입니다. 잠시 후 다시 시도해주세요.');
      }

      /* 500: ADF 모드에서 문서 없음 */
      if (statusCode === 500 && source === 'Feeder') {
        throw new Error('[ADF_NO_DOCUMENT] 문서가 급지기(ADF)에 올려져 있지 않습니다.');
      }

      /* 503: 스캐너 서비스 불가 */
      if (statusCode === 503) {
        throw new Error('[SCANNER_UNAVAILABLE] 스캐너를 사용할 수 없습니다. 스캐너 상태를 확인해주세요.');
      }

      console.error(`Failed to create scan job on ${scanner.name}:`, error);
      throw error;
    }
  }

  /**
   * Poll scan job status
   * @param scanner Target scanner
   * @param jobId Scan job ID
   * @returns Job status and image URLs if complete
   */
  async getScanJobStatus(scanner: IESCLScanner, jobId: string): Promise<{
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
  async downloadImage(scanner: IESCLScanner, imageUrl: string): Promise<Buffer | null> {
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
   * @param dpi Resolution in DPI
   * @param colorMode Color mode
   * @param source Scan source
   * @param documentFormat Document format MIME type
   * @param width Scan width in mm (optional)
   * @param height Scan height in mm (optional)
   */
  private buildScanSettings(dpi: number, colorMode: string, source: string, documentFormat: string, width?: number, height?: number): string {
    const ESCL_NS = 'http://schemas.hp.com/imaging/escl/2011/05/03';
    const PWG_NS = 'http://www.pwg.org/schemas/2010/12/sm';

    /* mm to 1/300 inch 변환 */
    const widthInUnits = Math.round((width || 210) / 25.4 * 300);
    const heightInUnits = Math.round((height || 297) / 25.4 * 300);

    return `<?xml version="1.0" encoding="UTF-8"?>
<scan:ScanSettings xmlns:scan="${ESCL_NS}" xmlns:pwg="${PWG_NS}">
  <pwg:Version>2.0</pwg:Version>
  <scan:Intent>Document</scan:Intent>
  <pwg:ScanRegions>
    <pwg:ScanRegion>
      <pwg:ContentRegionUnits>escl:ThreeHundredthsOfInches</pwg:ContentRegionUnits>
      <pwg:XOffset>0</pwg:XOffset>
      <pwg:YOffset>0</pwg:YOffset>
      <pwg:Width>${widthInUnits}</pwg:Width>
      <pwg:Height>${heightInUnits}</pwg:Height>
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
  <pwg:DocumentFormat>${documentFormat}</pwg:DocumentFormat>
</scan:ScanSettings>`;
  }

  /**
   * Parse scanner capabilities from XML response
   * @param xml XML response from scanner
   * @param debug Enable debug logging (default: false)
   */
  private parseCapabilities(xml: string, debug: boolean = false): IESCLCapabilities {
    const resolutions: number[] = [];
    const colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[] = [];
    const sources: ('Platen' | 'Adf' | 'Feeder')[] = [];
    const documentFormats: string[] = [];

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

    // Extract document formats (MIME types)
    // Look for <pwg:DocumentFormat> and <scan:DocumentFormatExt> tags
    const formatMatches = xml.matchAll(/<[a-z]*:?DocumentFormat(?:Ext)?>([^<]+)<\/[a-z]*:?DocumentFormat(?:Ext)?>/g);
    for (const match of formatMatches) {
      const format = match[1].trim();
      if (format && !documentFormats.includes(format)) {
        documentFormats.push(format);
      }
    }

    // If no formats found, default to jpeg (most common)
    if (documentFormats.length === 0) {
      documentFormats.push('image/jpeg');
    }

    // Extract max width and height (in 1/300 inch units, convert to mm)
    let maxWidth: number | undefined;
    let maxHeight: number | undefined;

    const maxWidthMatch = xml.match(/<[a-z]*:?MaxWidth>(\d+)<\/[a-z]*:?MaxWidth>/);
    const maxHeightMatch = xml.match(/<[a-z]*:?MaxHeight>(\d+)<\/[a-z]*:?MaxHeight>/);

    if (maxWidthMatch) {
      maxWidth = Math.round(parseInt(maxWidthMatch[1], 10) / 300 * 25.4);
    }
    if (maxHeightMatch) {
      maxHeight = Math.round(parseInt(maxHeightMatch[1], 10) / 300 * 25.4);
    }

    // Remove duplicates from resolutions
    const uniqueResolutions = Array.from(new Set(resolutions)).sort((a, b) => a - b);
    const uniqueColorModes = Array.from(new Set(colorModes));
    const uniqueSources = Array.from(new Set(sources));
    const uniqueDocumentFormats = Array.from(new Set(documentFormats));

    if (debug) {
      console.log('[eSCL] Parsed capabilities:', {
        resolutions: uniqueResolutions,
        colorModes: uniqueColorModes,
        sources: uniqueSources,
        documentFormats: uniqueDocumentFormats,
        maxWidth,
        maxHeight
      });
    }

    return {
      resolutions: uniqueResolutions,
      colorModes: uniqueColorModes,
      sources: uniqueSources,
      documentFormats: uniqueDocumentFormats,
      maxWidth,
      maxHeight
    };
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
