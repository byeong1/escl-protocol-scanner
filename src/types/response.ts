/**
 * Response Types
 */

import { IESCLScanner, IESCLCapabilities } from './scanner';

/**
 * Generic eSCL response wrapper
 */
export interface IESCLResponse {
  /** Operation success status */
  success: boolean;
  /** List of discovered scanners */
  scanners?: IESCLScanner[];
  /** Scanner capabilities */
  capabilities?: IESCLCapabilities;
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
export interface IScannerResponse {
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
 * Scanner discovery response
 */
export interface IDiscoveryResponse {
  /** Operation success status */
  success: boolean;
  /** List of discovered scanners */
  data: IESCLScanner[];
  /** Error message if operation failed */
  error?: string;
}

/**
 * Image save result
 */
export interface ISaveImageResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
