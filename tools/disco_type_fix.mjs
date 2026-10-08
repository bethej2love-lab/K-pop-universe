#!/usr/bin/env node
// 앨범 타입 오분류 수정 (2026-10-09)
//
// 문제: parseTypeFromTitle의 fallback 로직이 albumType==='album'이면 트랙 수 무관 '정규'를 반환했다.
//       suffix("- The 2nd Mini Album" 등)가 없는 영문 앨범 이름은 전부 이 경로로 빠졌다.
//       수정 후 기준: 1~3=싱글, 4~9=미니, 10+=정규.
//
// 이 스크립트는 이미 저장된 오분류를 한 번 일괄 수정한다.
// 조건: type='정규' AND trackCount 4~9 AND 제목에 집 번호 suffix 없음
//       → '미니'로 변경
//
// 실행: node tools/disco_type_fix.mjs [--dry]
//       --dry  변경 목록만 출력하고 파일은 건드리지 않는다

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DISCO_A = path.join(ROOT, 'disco', 'a');
const DISCO_G = path.join(ROOT, 'disco', 'g');
const DRY = process.argv.includes('--dry');

// 제목에 집 번호 suffix가 있으면 true — parseTypeFromTitle이 이미 정확하게 읽었을 것
function hasSuffix(title) {
  return /[-–—]\s*(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+(mini\s+)?album/i.test(String(title || ''))
    || /[-–—]\s*(?:the\s+)?(?:1st|first)\s+(mini\s+)?album/i.test(String(title || ''));
}

let total = 0, fixed = 0;

function sweep(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const fp = path.join(dir, f);
    let data;
    try { data = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    const albums = data.d || data.albums || [];
    let changed = false;
    for (const al of albums) {
      total++;
      if (al.type !== '정규') continue;
      const tc = al.trackCount ?? (al.tracks?.length ?? null);
      if (tc == null) continue;                  // 트랙 수 모르면 건드리지 않는다
      if (tc < 4 || tc > 9) continue;           // 싱글(~3) 또는 실제 정규(10+)는 패스
      if (hasSuffix(al.title)) continue;         // suffix 있는 건 이미 정확히 읽힌 것
      console.log(`[fix] ${f.replace('.json', '')} | "${al.title}" | ${tc}트랙 | 정규 → 미니`);
      if (!DRY) al.type = '미니';
      changed = true;
      fixed++;
    }
    if (changed && !DRY) fs.writeFileSync(fp, JSON.stringify(data), 'utf8');
  }
}

sweep(DISCO_A);
sweep(DISCO_G);

console.log(`\n총 ${total}장 검사, ${fixed}장 ${DRY ? '수정 예정' : '수정 완료'}.`);
if (DRY && fixed > 0) console.log('실제 수정하려면 --dry 없이 다시 실행하세요.');
