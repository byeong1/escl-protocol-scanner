# eSCL Protocol Scanner - 배포 및 사용 가이드

## 📦 배포 (Deployment)

### 1단계: npm 계정 생성

npm에 패키지를 배포하려면 먼저 npm 계정이 필요합니다.

```bash
# npm 계정 생성 (웹사이트에서)
# https://www.npmjs.com/signup

# 또는 터미널에서
npm adduser

# 혹은
npm login
```

### 2단계: 패키지 설정 확인

배포하기 전에 `package.json`을 확인하세요:

```json
{
  "name": "@escl-protocol/scanner",
  "version": "1.0.0",
  "description": "eSCL/AirPrint Protocol Scanner Library",
  "license": "MIT",
  "author": "Your Organization",
  "homepage": "https://github.com/yourusername/escl-protocol-scanner",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/escl-protocol-scanner.git"
  }
}
```

**이미 설정됨:**
```json
{
  "author": "byeong1",
  "homepage": "https://github.com/byeong1/escl-protocol-scanner",
  "repository": {
    "url": "git@github.com:byeong1/escl-protocol-scanner.git"
  }
}
```

### 3단계: 버전 업데이트

```bash
# Patch version (1.0.0 → 1.0.1)
npm version patch

# Minor version (1.0.0 → 1.1.0)
npm version minor

# Major version (1.0.0 → 2.0.0)
npm version major
```

### 4단계: 빌드 및 테스트

```bash
cd /Users/byeong_il/code/yarn-package/eSCL-Protocol-Scanner

# 최신 코드로 빌드
npm run build

# 빌드 결과 확인
ls -la dist/

# (선택사항) 로컬에서 테스트
npm install -g .  # 글로벌 설치해서 테스트
```

### 5단계: npm에 배포

#### 공개 배포 (Public - 누구나 설치 가능)

```bash
# 먼저 로그인 확인
npm whoami

# 배포 (처음 배포할 때)
npm publish --access public

# 또는 (나중에 업데이트할 때)
npm publish
```

**성공하면 npm 레지스트리에서 볼 수 있습니다:**
```
https://www.npmjs.com/package/@escl-protocol/scanner
```

#### GitHub 패키지 레지스트리에 배포 (선택사항)

```bash
# .npmrc 파일 생성 (또는 수정)
cat > ~/.npmrc << EOF
@escl-protocol:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
EOF

# 배포
npm publish
```

### 6단계: 배포 확인

```bash
# npm에서 패키지 검색
npm view @escl-protocol/scanner

# 설치 가능한지 확인
npm install @escl-protocol/scanner
```

---

## 🚀 사용 (Usage)

### 방법 1: npm으로 설치

#### A. 새 프로젝트에서

```bash
# 새 프로젝트 생성
mkdir my-scanner-app
cd my-scanner-app
npm init -y

# 패키지 설치
npm install @escl-protocol/scanner

# Python 의존성 설치
pip install zeroconf pillow
```

#### B. 기존 프로젝트에 추가

```bash
# 패키지 설치
npm install @escl-protocol/scanner

# Python 의존성 설치 (필요한 경우)
pip install zeroconf pillow
```

### 방법 2: Yarn으로 설치

```bash
# 패키지 설치
yarn add @escl-protocol/scanner

# Python 의존성 설치
pip install zeroconf pillow
```

---

## 💻 실제 사용 예제

### 예제 1: 간단한 스캐너 검색

```typescript
// scanner-discover.ts
import { discoverScanners } from '@escl-protocol/scanner';

async function main() {
  console.log('네트워크에서 스캐너를 찾는 중...');

  const scanners = await discoverScanners(5000);

  console.log(`\n발견된 스캐너: ${scanners.length}개\n`);

  scanners.forEach((scanner, index) => {
    console.log(`${index + 1}. ${scanner.name}`);
    console.log(`   호스트: ${scanner.host}:${scanner.port}`);
    if (scanner.manufacturer) {
      console.log(`   제조사: ${scanner.manufacturer}`);
    }
    if (scanner.model) {
      console.log(`   모델: ${scanner.model}`);
    }
    console.log();
  });
}

main().catch(error => {
  console.error('오류:', error.message);
  process.exit(1);
});
```

**실행:**
```bash
npx ts-node scanner-discover.ts
```

**출력:**
```
네트워크에서 스캐너를 찾는 중...

발견된 스캐너: 2개

1. Canon iR-ADV C3525
   호스트: 192.168.1.100:80
   제조사: Canon
   모델: iR-ADV C3525

2. HP LaserJet Pro MFP
   호스트: 192.168.1.101:80
   제조사: HP
   모델: M428dw
```

### 예제 2: 스캐너 능력 조회

```typescript
// scanner-capabilities.ts
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';

async function main() {
  const scanners = await discoverScanners(5000);

  if (scanners.length === 0) {
    console.log('스캐너를 찾을 수 없습니다.');
    return;
  }

  const scanner = scanners[0];
  console.log(`\n스캐너: ${scanner.name}`);

  const client = new ESCLClient();
  const capabilities = await client.getCapabilities(scanner);

  if (!capabilities) {
    console.error('능력 정보를 가져올 수 없습니다.');
    return;
  }

  console.log('\n지원하는 해상도 (DPI):');
  capabilities.resolutions.forEach(dpi => {
    console.log(`  - ${dpi} DPI`);
  });

  console.log('\n지원하는 색상 모드:');
  capabilities.colorModes.forEach(mode => {
    const modeNames: Record<string, string> = {
      'BlackAndWhite1': '흑백',
      'Grayscale8': '그레이스케일',
      'RGB24': '풀 컬러'
    };
    console.log(`  - ${modeNames[mode]}`);
  });

  console.log('\n지원하는 스캔 소스:');
  capabilities.sources.forEach(source => {
    const sourceNames: Record<string, string> = {
      'Platen': '플래튼 (평판)',
      'Feeder': '급지함 (ADF)',
      'Adf': '자동문서급지장치'
    };
    console.log(`  - ${sourceNames[source]}`);
  });
}

main().catch(error => {
  console.error('오류:', error.message);
  process.exit(1);
});
```

**실행:**
```bash
npx ts-node scanner-capabilities.ts
```

### 예제 3: 스캔 실행

```typescript
// scanner-scan.ts
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';
import * as fs from 'fs';

async function main() {
  const scanners = await discoverScanners(5000);

  if (scanners.length === 0) {
    console.error('스캐너를 찾을 수 없습니다.');
    process.exit(1);
  }

  const scanner = scanners[0];
  console.log(`스캐너: ${scanner.name}`);

  const client = new ESCLClient(30000); // 30초 타임아웃

  try {
    // 1. 스캔 작업 생성
    console.log('\n스캔 작업을 생성 중...');
    const jobId = await client.createScanJob(
      scanner,
      300,        // 300 DPI
      'RGB24',    // 풀 컬러
      'Platen'    // 평판
    );

    if (!jobId) {
      console.error('스캔 작업 생성 실패');
      process.exit(1);
    }

    console.log(`작업 ID: ${jobId}`);

    // 2. 스캔 완료 대기
    console.log('\n스캔 진행 중...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 최대 60초

    while (!completed && attempts < maxAttempts) {
      const status = await client.getScanJobStatus(scanner, jobId);

      if (status.status === 'Completed') {
        completed = true;
        console.log(`\n스캔 완료! ${status.images.length}개 이미지 발견`);

        // 3. 이미지 다운로드
        console.log('\n이미지를 다운로드 중...');
        for (let i = 0; i < status.images.length; i++) {
          const imageUrl = status.images[i];
          const imageBuffer = await client.downloadImage(scanner, imageUrl);

          if (imageBuffer) {
            const filename = `scan_${i + 1}.png`;
            fs.writeFileSync(filename, imageBuffer);
            console.log(`  ✓ 저장됨: ${filename} (${imageBuffer.length} bytes)`);
          }
        }
      } else if (status.status === 'Aborted') {
        console.error('스캔이 중단되었습니다.');
        process.exit(1);
      } else {
        console.log(`  ${status.status}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (!completed) {
      console.error('스캔 타임아웃');
      process.exit(1);
    }
  } catch (error) {
    console.error('오류:', error.message);
    process.exit(1);
  }
}

main();
```

**실행:**
```bash
npx ts-node scanner-scan.ts
```

### 예제 4: Electron 앱에서 사용

```typescript
// main.ts (Electron 메인 프로세스)
import { app, BrowserWindow, ipcMain } from 'electron';
import { discoverScanners, ESCLClient, quickScan } from '@escl-protocol/scanner';

// 메인 윈도우 생성
function createWindow() {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();
}

// 스캐너 검색 IPC
ipcMain.handle('scanner:discover', async () => {
  try {
    const scanners = await discoverScanners(5000);
    return { success: true, scanners };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 스캐너 능력 조회 IPC
ipcMain.handle('scanner:capabilities', async (event, scanner) => {
  try {
    const client = new ESCLClient();
    const capabilities = await client.getCapabilities(scanner);
    return { success: true, capabilities };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 스캔 실행 IPC
ipcMain.handle('scanner:scan', async (event, params) => {
  try {
    const images = await quickScan(params);
    return { success: true, images };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

```typescript
// preload.ts (Electron 프리로드)
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  scanner: {
    discover: () => ipcRenderer.invoke('scanner:discover'),
    getCapabilities: (scanner: any) =>
      ipcRenderer.invoke('scanner:capabilities', scanner),
    scan: (params: any) => ipcRenderer.invoke('scanner:scan', params)
  }
});
```

```typescript
// renderer.ts (Electron 렌더러 프로세스)
async function discoverScanners() {
  const result = await window.api.scanner.discover();

  if (result.success) {
    console.log(`발견된 스캐너: ${result.scanners.length}개`);
    // UI 업데이트
  } else {
    console.error('오류:', result.error);
  }
}

async function performScan(scanner: any) {
  const result = await window.api.scanner.scan({
    scanner,
    dpi: 300,
    mode: 'color',
    source: 'Platen',
    timeout: 30000
  });

  if (result.success) {
    console.log(`스캔 완료: ${result.images.length}개 이미지`);
  } else {
    console.error('스캔 실패:', result.error);
  }
}
```

### 예제 5: Express 서버에서 사용

```typescript
// scanner-server.ts
import express from 'express';
import { discoverScanners, ESCLClient } from '@escl-protocol/scanner';
import * as fs from 'fs';

const app = express();
app.use(express.json());

// 스캐너 검색 API
app.get('/api/scanners', async (req, res) => {
  try {
    const timeout = parseInt(req.query.timeout as string) || 5000;
    const scanners = await discoverScanners(timeout);
    res.json({ success: true, scanners });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 스캐너 능력 조회 API
app.get('/api/scanner/:host/capabilities', async (req, res) => {
  try {
    const scanner = {
      name: req.params.host,
      host: req.params.host,
      port: 80
    };

    const client = new ESCLClient();
    const capabilities = await client.getCapabilities(scanner);

    if (!capabilities) {
      return res.status(404).json({
        success: false,
        error: 'Scanner not found or does not support eSCL'
      });
    }

    res.json({ success: true, capabilities });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 스캔 실행 API
app.post('/api/scanner/:host/scan', async (req, res) => {
  try {
    const { dpi = 300, mode = 'color', source = 'Platen' } = req.body;

    const scanner = {
      name: req.params.host,
      host: req.params.host,
      port: 80
    };

    const client = new ESCLClient(30000);

    // 스캔 작업 생성
    const jobId = await client.createScanJob(
      scanner,
      dpi,
      mode === 'bw' ? 'BlackAndWhite1' : mode === 'gray' ? 'Grayscale8' : 'RGB24',
      source
    );

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create scan job'
      });
    }

    // 스캔 완료 대기
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!completed && attempts < maxAttempts) {
      const status = await client.getScanJobStatus(scanner, jobId);

      if (status.status === 'Completed') {
        // 이미지 다운로드
        const images: string[] = [];
        for (const imageUrl of status.images) {
          const imageBuffer = await client.downloadImage(scanner, imageUrl);
          if (imageBuffer) {
            images.push(imageBuffer.toString('base64'));
          }
        }

        return res.json({
          success: true,
          images,
          count: images.length
        });
      }

      if (status.status === 'Aborted') {
        return res.status(400).json({
          success: false,
          error: 'Scan was aborted'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    res.status(408).json({
      success: false,
      error: 'Scan timeout'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Scanner API running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /api/scanners');
  console.log('  GET  /api/scanner/:host/capabilities');
  console.log('  POST /api/scanner/:host/scan');
});
```

**실행 및 테스트:**
```bash
# 서버 실행
npx ts-node scanner-server.ts

# 다른 터미널에서 테스트
curl http://localhost:3000/api/scanners

curl http://localhost:3000/api/scanner/192.168.1.100/capabilities

curl -X POST http://localhost:3000/api/scanner/192.168.1.100/scan \
  -H "Content-Type: application/json" \
  -d '{"dpi": 300, "mode": "color", "source": "Platen"}'
```

---

## 🔑 배포 후 관리

### 새 버전 배포

```bash
cd /Users/byeong_il/code/yarn-package/eSCL-Protocol-Scanner

# 1. 코드 수정
# 2. 버전 업데이트
npm version minor  # 1.0.0 → 1.1.0

# 3. 빌드
npm run build

# 4. 배포
npm publish
```

### npm 패키지 정보 확인

```bash
# 최신 버전 확인
npm view @escl-protocol/scanner

# 모든 버전 확인
npm view @escl-protocol/scanner versions

# 패키지 다운로드 통계
npm view @escl-protocol/scanner

# 로컬에서 설치된 버전 확인
npm list @escl-protocol/scanner
```

### 버전 관리

```bash
# 현재 버전 확인
cat package.json | grep version

# 패치 버전 업데이트 (1.0.0 → 1.0.1)
npm version patch

# 마이너 버전 업데이트 (1.0.0 → 1.1.0)
npm version minor

# 메이저 버전 업데이트 (1.0.0 → 2.0.0)
npm version major
```

---

## ❓ 자주 묻는 질문 (FAQ)

### Q: 배포 후 설치할 때 Python 에러가 발생합니다.
**A:** Python 의존성을 수동으로 설치해야 합니다:
```bash
pip install zeroconf pillow
```

### Q: 회사 내부에서만 사용하고 싶으면?
**A:** Private npm 패키지로 배포하세요:
```bash
npm publish --access restricted
```

### Q: 기존 프로젝트에서 버전을 업그레이드하려면?
**A:** 다음 명령어를 사용하세요:
```bash
npm install @escl-protocol/scanner@latest
```

### Q: 특정 버전으로 설치하려면?
**A:** 버전을 명시해서 설치하세요:
```bash
npm install @escl-protocol/scanner@1.0.0
```

### Q: 배포를 취소하고 싶으면?
**A:** 배포 후 72시간 이내에만 가능합니다:
```bash
npm unpublish @escl-protocol/scanner@1.0.0 --force
```

---

## 📋 체크리스트

배포 전에 확인하세요:

- [ ] `package.json`의 `author`, `homepage`, `repository` 업데이트
- [ ] `npm run build` 성공
- [ ] Python 의존성 설치됨 (`zeroconf`, `pillow`)
- [ ] 스캔 실행 테스트
- [ ] `README.md`, `SETUP.md` 최신 상태
- [ ] `CHANGELOG.md` 업데이트
- [ ] 버전 번호 업데이트 (`npm version`)
- [ ] npm 로그인 확인 (`npm whoami`)
- [ ] `npm publish` 실행
- [ ] npm 웹사이트에서 배포 확인

완료되었습니다! 이제 패키지를 배포하고 사용할 준비가 되었습니다. 🎉
