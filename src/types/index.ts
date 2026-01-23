/**
 * Types Index
 * 모든 타입을 re-export
 */

// Scanner
export type {
  IESCLScanner,
  IESCLCapabilities,
  IESCLScanParams,
  IScannedImage,
} from './scanner';

// Response
export type {
  IESCLResponse,
  IScannerResponse,
  IDiscoveryResponse,
  ISaveImageResult,
} from './response';

// Command
export type {
  TESCLCommand,
  TPythonCommand,
} from './command';

// Config
export type {
  IColorModeMap,
  ISaveImageParams,
  IScanParams,
  IProcessSpawnOptions,
} from './config';

// Application
export type {
  IApplicationConfig,
  IQuickScanParams,
  IESCLDiscoveryOptions,
} from './application';
