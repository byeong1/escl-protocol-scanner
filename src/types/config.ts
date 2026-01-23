/**
 * Configuration Types
 */

/**
 * Color mode mapping for UI display
 */
export interface IColorModeMap {
  [key: string]: {
    value: 'bw' | 'gray' | 'color';
    label: string;
  };
}

/**
 * Image save parameters
 */
export interface ISaveImageParams {
  folderPath: string;
  fileName: string;
  imageData: string;
}

/**
 * Scan parameters for legacy Python scanner
 */
export interface IScanParams {
  scanner?: { name: string; id: string };
  dpi?: number;
  mode?: string;
  source?: string;
}

/**
 * Python process spawn options
 */
export interface IProcessSpawnOptions {
  /** Python executable path */
  pythonPath?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Timeout for subprocess communication (ms) */
  timeout?: number;
  /** Environment variables for Python process */
  env?: NodeJS.ProcessEnv;
}
