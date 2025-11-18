/**
 * eSCL/AirPrint Protocol Scanner Types
 * HTTP-based network scanner protocol for Canon, HP, Epson, and other MFP devices
 */

/**
 * eSCL Scanner device information
 */
export interface ESCLScanner {
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
export interface ESCLCapabilities {
  /** Available scan resolutions in DPI */
  resolutions: number[];
  /** Supported color modes */
  colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[];
  /** Available scan sources */
  sources: ('Platen' | 'Adf' | 'Feeder')[];
  /** Maximum scannable area width in mm */
  maxWidth?: number;
  /** Maximum scannable area height in mm */
  maxHeight?: number;
}

/**
 * Scan request parameters
 */
export interface ESCLScanParams {
  /** Target scanner device */
  scanner: ESCLScanner;
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
export interface ScannedImage {
  /** Base64 encoded PNG image data */
  data: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** Color mode used for scanning */
  colorMode: string;
}

/**
 * Generic eSCL response wrapper
 */
export interface ESCLResponse {
  /** Operation success status */
  success: boolean;
  /** List of discovered scanners */
  scanners?: ESCLScanner[];
  /** Scanner capabilities */
  capabilities?: ESCLCapabilities;
  /** Scanned images */
  images?: string[];
  /** Number of images returned */
  count?: number;
  /** Error message if operation failed */
  error?: string;
  /** Additional response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Scanner response for local scanner backend
 */
export interface ScannerResponse {
  success: boolean;
  scanners?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  images?: string[];
  count?: number;
  error?: string;
}

/**
 * Color mode mapping for UI display
 */
export interface ColorModeMap {
  [key: string]: {
    value: 'bw' | 'gray' | 'color';
    label: string;
  };
}

/**
 * Image save parameters
 */
export interface SaveImageParams {
  folderPath: string;
  fileName: string;
  imageData: string;
}

/**
 * Image save result
 */
export interface SaveImageResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Python subprocess command types
 */
export type ESCLCommand = {
  action: 'list' | 'scan' | 'capabilities' | 'exit';
  params?: ESCLScanParams;
};

/**
 * Python subprocess command for legacy Python scanner
 */
export type PythonCommand = {
  type: 'list' | 'scan' | 'exit';
  params?: Record<string, unknown>;
};

/**
 * Scan parameters for legacy Python scanner
 */
export interface ScanParams {
  scanner?: { name: string; id: string };
  dpi?: number;
  mode?: string;
  source?: string;
}

/**
 * Python process spawn options
 */
export interface ProcessSpawnOptions {
  /** Python executable path */
  pythonPath?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Timeout for subprocess communication (ms) */
  timeout?: number;
  /** Environment variables for Python process */
  env?: NodeJS.ProcessEnv;
}

/**
 * Scanner discovery response
 */
export interface DiscoveryResponse {
  /** Operation success status */
  success: boolean;
  /** List of discovered scanners */
  data: ESCLScanner[];
  /** Error message if operation failed */
  error?: string;
}
