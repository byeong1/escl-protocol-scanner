/**
 * eSCL Protocol Scanner - Main Entry Point
 *
 * 애플리케이션 진입점
 * Application 인스턴스를 생성하고 export
 */

import { Application } from "./core/application";

// Types - re-export all types
export * from "./types";

// Classes
export { Application } from "./core/application";
export { ESCLClient } from "./services/client";
export { ESCLDiscovery } from "./services/discovery";

// 기본 Application 인스턴스
const eSCLScanner = new Application();

// 기본 인스턴스 export
export { eSCLScanner };

// Version (package.json에서 가져옴)
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const VERSION: string = require("../package.json").version;
