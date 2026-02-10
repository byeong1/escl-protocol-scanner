# @crowsgear/escl-protocol-scanner

[English](./README.md)

eSCL/AirPrint 프로토콜 기반 네트워크 스캐너 라이브러리입니다.

> **참고**: 네트워크에 연결된 스캐너(WiFi 또는 LAN)만 지원합니다. USB 스캐너는 지원되지 않을 수 있습니다.

## 설치

```bash
npm install @crowsgear/escl-protocol-scanner
# 또는
yarn add @crowsgear/escl-protocol-scanner
```

**Python 설치가 필요하지 않습니다!** Windows, macOS, Linux용 사전 빌드 바이너리가 포함되어 있습니다.
별도의 Python 경로를 지정하여 사용할 수도 있습니다. 자세한 내용은 [Application (사용자 설정)](#application-사용자-설정)을 참고하세요.

## 빠른 시작

```typescript
import { eSCLScanner } from '@crowsgear/escl-protocol-scanner';

// 1. 스캐너 탐색 (result: IDiscoveryResponse)
const result = await eSCLScanner.discoverScanners(10000);
if (result.success && result.data.length > 0) {
  console.log('발견된 스캐너:', result.data);
}

// 2. 스캐너 기능 조회 (result.data: IESCLScanner[])
const scanner = result.data[0]; // 첫 번째 스캐너 선택
const capabilities = await eSCLScanner.getCapabilities(scanner);
console.log('해상도:', capabilities?.resolutions);
console.log('색상 모드:', capabilities?.colorModes);

// 3. 스캔 실행
const filePaths = await eSCLScanner.quickScan({
  scanner: scanner,
  dpi: 300,
  mode: 'color',
  source: 'Platen',
  documentFormat: 'image/jpeg',
  savePath: '/path/to/save',
});
console.log('저장된 파일:', filePaths);
```

## API

### eSCLScanner

기본 인스턴스로, 바로 사용할 수 있습니다.

```typescript
import { eSCLScanner } from '@crowsgear/escl-protocol-scanner';

// 스캐너 탐색
const result = await eSCLScanner.discoverScanners(timeout?: number);

// 스캐너 기능 조회
const caps = await eSCLScanner.getCapabilities(scanner: IESCLScanner);

// 빠른 스캔
const files = await eSCLScanner.quickScan(params: IQuickScanParams);

// 스캔 작업 생성
const jobId = await eSCLScanner.createScanJob(scanner, dpi, colorMode, source, documentFormat, width?, height?);

// 스캔 작업 상태 조회
const status = await eSCLScanner.getScanJobStatus(scanner, jobId);

// 이미지 다운로드
const buffer = await eSCLScanner.downloadImage(scanner, imageUrl);
```

### Application (사용자 설정)

사용자 설정을 위한 새 인스턴스를 생성합니다.

```typescript
import { Application } from '@crowsgear/escl-protocol-scanner';

const myScanner = new Application({
  timeout: 15000,
  pythonPath: '/path/to/.venv/bin/python3', // 선택: Python 경로
  debug: true,
});

const result = await myScanner.discoverScanners();
```

> **참고**: `pythonPath`를 지정하면 사전 빌드 바이너리보다 우선 적용됩니다.

### quickScan 매개변수

```typescript
interface IQuickScanParams {
  scanner: IESCLScanner;         // 스캐너 장치
  dpi: number;                    // 해상도 (예: 200, 300, 600)
  mode: 'bw' | 'gray' | 'color';  // 색상 모드
  source: 'Platen' | 'Feeder';    // 스캔 소스 (평판/ADF)
  documentFormat: string;         // MIME 타입 (예: 'image/jpeg')
  savePath?: string;              // 저장 경로 (기본값: 현재 디렉터리)
  width?: number;                 // 스캔 너비 mm (기본값: 210)
  height?: number;                // 스캔 높이 mm (기본값: 297)
  timeout?: number;               // 타임아웃 ms
}
```

## 타입

```typescript
interface IESCLScanner {
  name: string;
  host: string;
  port: number;
  model?: string;
  manufacturer?: string;
}

interface IESCLCapabilities {
  resolutions: number[];
  colorModes: ('BlackAndWhite1' | 'Grayscale8' | 'RGB24')[];
  sources: ('Platen' | 'Adf' | 'Feeder')[];
  documentFormats: string[];
  maxWidth?: number;
  maxHeight?: number;
}

interface IDiscoveryResponse {
  success: boolean;
  data: IESCLScanner[];
  error?: string;
}
```

## 용지 크기 참고

| 용지    | 너비 (mm) | 높이 (mm) |
|---------|-----------|-----------|
| A4      | 210       | 297       |
| A3      | 297       | 420       |
| Letter  | 216       | 279       |
| Legal   | 216       | 356       |

## 지원 스캐너

eSCL(AirPrint Scan) 프로토콜을 지원하는 모든 네트워크 스캐너 및 복합기에서 사용할 수 있습니다.
Brother, Canon, Epson, HP, Ricoh, Xerox 등 주요 제조사의 최신 네트워크 복합기는 대부분 eSCL을 지원합니다.

> eSCL은 Apple이 설계하고 [Mopria Alliance](https://mopria.org)가 업계 표준으로 관리하는 프로토콜입니다. 호환 기기 목록은 [Apple AirPrint 페이지](https://support.apple.com/en-us/102895)에서 확인할 수 있습니다.
> 모든 기기에 대해 충분한 테스트가 이루어지지 않았으므로, 특정 기기에서 문제가 발생하면 [이슈](https://github.com/crowsgear/escl-protocol-scanner/issues)를 등록해 주세요.

## 개발

사전 빌드 바이너리 없이 개발하려면 Python 3과 `zeroconf`, `pillow`가 필요합니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install zeroconf pillow
```

```typescript
import { Application } from '@crowsgear/escl-protocol-scanner';

const scanner = new Application({
  pythonPath: '/path/to/.venv/bin/python3',
});

const result = await scanner.discoverScanners();
```

## 라이선스

MIT
