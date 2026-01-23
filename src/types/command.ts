/**
 * Command Types
 */

import { IESCLScanParams } from './scanner';

/**
 * Python subprocess command types
 */
export type TESCLCommand = {
  action: 'list' | 'scan' | 'capabilities' | 'exit';
  params?: IESCLScanParams;
};

/**
 * Python subprocess command for legacy Python scanner
 */
export type TPythonCommand = {
  type: 'list' | 'scan' | 'exit';
  params?: Record<string, unknown>;
};
