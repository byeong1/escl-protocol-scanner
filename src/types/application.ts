/**
 * Application Types
 */

import { IESCLScanner } from './scanner';

/**
 * Application 설정 옵션
 */
export interface IApplicationConfig {
  /** 기본 타임아웃 (ms) */
  timeout?: number;
  /** Python 경로 (개발 환경용) */
  pythonPath?: string;
  /** 디버그 모드 */
  debug?: boolean;
}

/**
 * 스캔 파라미터
 */
export interface IQuickScanParams {
  /** 스캐너 디바이스 */
  scanner: IESCLScanner;
  /** DPI 해상도 */
  dpi: number;
  /** 컬러 모드 */
  mode: 'bw' | 'gray' | 'color';
  /** 스캔 소스 */
  source: 'Platen' | 'Feeder';
  /** 문서 포맷 MIME 타입 */
  documentFormat: string;
  /** 저장 경로 */
  savePath?: string;
  /** 스캔 너비 (mm) */
  width?: number;
  /** 스캔 높이 (mm) */
  height?: number;
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * eSCL Discovery 옵션
 */
export interface IESCLDiscoveryOptions {
  /** Custom Python executable path (e.g., /path/to/venv/bin/python3) */
  pythonPath?: string;
}
