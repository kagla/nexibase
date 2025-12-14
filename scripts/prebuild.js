#!/usr/bin/env node
/**
 * src/app을 app/으로 복사하고, custom/app이 있으면 덮어씁니다.
 *
 * 사용법:
 * 1. 사용자가 수정할 파일만 custom/app/에 복사
 * 2. npm run dev 또는 npm run build 실행
 * 3. custom/app 파일이 src/app보다 우선 적용됨
 *
 * 예시:
 * - src/app/page.tsx (원본)
 * - custom/app/page.tsx (사용자 수정본) → 이 파일이 사용됨
 * - src/app/admin/page.tsx (원본) → custom에 없으므로 그대로 사용
 */

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const srcApp = path.join(rootDir, 'src/app');
const customApp = path.join(rootDir, 'custom/app');
const targetApp = path.join(rootDir, 'app');

/**
 * 디렉토리 재귀 복사
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 디렉토리 재귀 삭제
 */
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }

  fs.rmdirSync(dir);
}

// 시작
console.log('🔧 app 폴더 생성 중...');

// 1. 기존 app 폴더 삭제
if (fs.existsSync(targetApp)) {
  removeDir(targetApp);
}

// 2. src/app → app/ 복사
if (!fs.existsSync(srcApp)) {
  console.error('❌ src/app 폴더가 없습니다.');
  process.exit(1);
}

console.log('   src/app → app/ 복사');
copyDir(srcApp, targetApp);

// 3. custom/app 있으면 덮어쓰기
if (fs.existsSync(customApp)) {
  console.log('   custom/app → app/ 덮어쓰기');
  copyDir(customApp, targetApp);
  console.log('✓ 커스텀 모드: custom/app 파일이 우선 적용됩니다');
} else {
  console.log('✓ 기본 모드: src/app을 사용합니다');
}
