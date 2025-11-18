#!/usr/bin/env node

/**
 * Python 의존성 확인 및 설치 스크립트
 * - 시스템에 Python 3 설치 여부 확인
 * - 필요한 패키지(zeroconf, pillow) 설치 여부 확인
 * - 대화형 설치 프롬프트
 *
 * 사용자는 PYTHON_PATH 환경변수로 어느 Python을 사용할지 결정
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

const REQUIRED_PACKAGES = ['zeroconf', 'pillow'];
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const PROJECT_ROOT = path.dirname(path.dirname(PACKAGE_JSON_PATH));

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

/**
 * 시스템 Python 경로 찾기
 */
function findPythonPath() {
  // PYTHON_PATH 환경변수가 설정되어 있으면 사용
  if (process.env.PYTHON_PATH) {
    log.success(`PYTHON_PATH 환경변수 사용: ${process.env.PYTHON_PATH}`);
    return process.env.PYTHON_PATH;
  }

  // 아니면 시스템 python3 사용
  try {
    const pythonPath = execSync('which python3', { encoding: 'utf-8' }).trim();
    log.info(`시스템 Python 사용: ${pythonPath}`);
    return pythonPath;
  } catch (error) {
    log.error('python3를 찾을 수 없습니다. Python 3을 설치하세요.');
    process.exit(1);
  }
}

/**
 * 패키지 설치 여부 확인
 */
function checkPackageInstalled(pythonPath, packageName) {
  try {
    execSync(`${pythonPath} -c "import ${packageName}"`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 설치된 패키지 확인
 */
function checkInstalledPackages(pythonPath) {
  const missing = [];

  for (const pkg of REQUIRED_PACKAGES) {
    const installed = checkPackageInstalled(pythonPath, pkg);

    if (installed) {
      log.success(`${pkg} 설치됨`);
    } else {
      log.warn(`${pkg} 미설치`);
      missing.push(pkg);
    }
  }

  return missing;
}

/**
 * 사용자 입력 프롬프트
 */
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase());
    });
  });
}

/**
 * 패키지 설치
 */
async function installPackages(pythonPath, packages) {
  log.header(`Python 패키지 설치`);

  const installCmd = `${pythonPath} -m pip install ${packages.join(' ')}`;

  console.log(`설치 명령어: ${colors.cyan}${installCmd}${colors.reset}\n`);

  const answer = await prompt(
    `${colors.bright}패키지를 설치하시겠습니까? (y/n): ${colors.reset}`
  );

  if (answer === 'y' || answer === 'yes') {
    try {
      log.info('설치 중...');
      execSync(installCmd, { stdio: 'inherit' });
      log.success('패키지 설치 완료');
      return true;
    } catch (error) {
      log.error(`설치 실패: ${error.message}`);
      return false;
    }
  } else {
    log.warn('사용자가 설치를 거부했습니다.');
    log.info(`수동 설치 명령어: ${colors.cyan}${installCmd}${colors.reset}`);
    return false;
  }
}

/**
 * 메인 함수
 */
async function main() {
  log.header('eSCL Protocol Scanner - Python 의존성 확인');

  // Python 경로 결정
  const pythonPath = findPythonPath();

  // 패키지 확인
  log.header('필수 패키지 확인');
  const missing = checkInstalledPackages(pythonPath);

  if (missing.length === 0) {
    log.success('모든 필수 패키지가 설치되어 있습니다.');
    console.log();
    process.exit(0);
  }

  // 설치 필요
  log.header('필수 패키지 설치 필요');
  log.warn(`다음 패키지가 필요합니다: ${missing.join(', ')}`);

  const installed = await installPackages(pythonPath, missing);

  if (!installed) {
    log.error('필수 패키지 없이는 eSCL 스캐너를 사용할 수 없습니다.');
    console.log(
      `\n${colors.bright}수동 설치 방법:${colors.reset}`
    );

    console.log(`${colors.cyan}${pythonPath} -m pip install ${missing.join(' ')}${colors.reset}`);
    console.log();
    process.exit(1);
  }
}

// 실행
main().catch((error) => {
  log.error(`예기치 않은 오류: ${error.message}`);
  process.exit(1);
});
