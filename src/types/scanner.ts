/**
 * eSCL Scanner Types
 */

/**
 * eSCL Scanner device information
 */
export interface IESCLScanner {
  /** Device name from mDNS (cleaned of service type suffix) */
  name: string;
  /** Network hostname or IP address */
  host: string;
  /** HTTP service port (typically 80) */
  port: number;
  /** Full mDNS service name */
  serviceName?: string;
  /** Device model from mDNS TXT record */
  model?: string;
  /** Device manufacturer */
  manufacturer?: string;
}

/**
 * Scanner capabilities response
 */
export interface IESCLCapabilities {
  /** Available scan resolutions in DPI */
  resolutions: number[];
  /** Supported color modes */
  colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[];
  /** Available scan sources */
  sources: ('Platen' | 'Adf' | 'Feeder')[];
  /** Supported document formats (MIME types from scanner, e.g., 'image/jpeg', 'image/png', 'application/pdf') */
  documentFormats: string[];
  /** Maximum scannable area width in mm */
  maxWidth?: number;
  /** Maximum scannable area height in mm */
  maxHeight?: number;
}

/**
 * Scan request parameters
 */
export interface IESCLScanParams {
  /** Target scanner device */
  scanner: IESCLScanner;
  /** Resolution in DPI (e.g., 200, 300) */
  dpi: number;
  /** Color mode for scanning */
  mode: 'bw' | 'gray' | 'color';
  /** Scan source */
  source: 'Platen' | 'Feeder';
}

/**
 * Scanned image data
 */
export interface IScannedImage {
  /** Base64 encoded PNG image data */
  data: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** Color mode used for scanning */
  colorMode: string;
}
