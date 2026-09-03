#!/usr/bin/env node
// 기본정보 완성도 감사 (읽기 전용 — 원본 수정 안 함) — 2026-09-03
//
// 목적: "정기 업데이트"의 첫 단계. groups.json·artists.json에서 비어 있는 기본 필드와
//       오래된(=신보 누락 의심) 디스코그래피를 뽑아, 나무위키 기반 채우기(서브에이전트)로
//       넘길 수 있는 갭 리포트를 만든다. 디스코 내용 감사는 tools/group_disco_audit.mjs가 담당.
//
// 채우는 흐름(권장):
//   1) node tools/data_completeness_audit.mjs        # 갭 리포트 + gap_*.json 생성
//   2) 각 gap_*.json을 서브에이전트에 주고 namu 링크를 WebFetch로 조회해 값 회수(동명이인 안전)
//   3) 빈 필드만 채워 원본 수정 → node tools/build_slim_data.mjs → 커밋
//
// 사용법: node tools/data_completeness_audit.mjs [--out <dir>] [--stale-months N]
//   출력:  <dir>/gap_member_basic.json  (생일/국적/나무위키 없는 활동 멤버 + namu URL)
//          <dir>/gap_group_basic.json   (팬덤/인스타/유튜브 없는 그룹 + namu URL)
//          <dir>/gap_stale_disco.json   (활동 그룹인데 최신 앨범이 N개월 이상 된 = 신보 점검 후보)
//   기본 dir = ~/Downloads/data_audit

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = arg('--out', path.join(os.homedir(), 'Downloads', 'data_audit'));
const STALE_MONTHS = Number(arg('--stale-months', '14'));
fs.mkdirSync(OUT, { recursive: true });

const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const arts = Array.isArray(A) ? A : Object.values(A);
const gks = Object.keys(G);
const namuOf = o => (o.links && o.links.namu) || '';
const has = v => v && (typeof v === 'string' ? v.trim() : (v.ko || v.en));

// ── 멤버 기본정보 갭(활동 중 우선) ──────────────────────────────────
const memGap = [];
for (const a of arts) {
  const need = [];
  if (!a.bday) need.push('bday');
  if (!has(a.nat)) need.push('nat');
  if (!namuOf(a)) need.push('namu');
  if (!need.length) continue;
  memGap.push({ id: a.id, name: a.name && a.name.ko, group: a.group && a.group.ko, active: a.active !== false, need, namu: namuOf(a) });
}
// 활동 중 + namu 링크 보유(채우기 가능한 것) 우선 정렬
memGap.sort((x, y) => (y.active - x.active) || ((y.namu ? 1 : 0) - (x.namu ? 1 : 0)));

// ── 그룹 기본정보 갭 ────────────────────────────────────────────────
const grpGap = [];
for (const k of gks) {
  const g = G[k]; const L = g.links || {};
  const need = [];
  if (!has(g.fandom)) need.push('fandom');
  if (!L.instagram) need.push('instagram');
  if (!L.youtube) need.push('youtube');
  if (!need.length) continue;
  grpGap.push({ ko: k, en: g.en, need, namu: L.namu || '' });
}

// ── 오래된 디스코(활동 그룹인데 최신 앨범이 오래됨 = 신보 누락 의심) ──
const now = new Date();
const monthsAgo = d => { const t = new Date(String(d).replace(/\./g, '-')); return (now - t) / (86400000 * 30.4); };
const disbandKo = k => /해체|해산/.test(JSON.stringify(G[k].disbanded || '')) || G[k].disbanded === true;
const staleDisco = [];
for (const k of gks) {
  const g = G[k];
  if (g.disbanded) continue; // 해체 그룹은 신보 없음이 정상
  const disco = g.discography || [];
  if (!disco.length) { staleDisco.push({ ko: k, en: g.en, newest: null, months: null, aid: null }); continue; }
  const dates = disco.map(d => d.releaseDate).filter(Boolean);
  if (!dates.length) continue;
  const newest = dates.sort().slice(-1)[0];
  const m = monthsAgo(newest);
  if (m >= STALE_MONTHS) staleDisco.push({ ko: k, en: g.en, newest, months: Math.round(m) });
}
staleDisco.sort((x, y) => (y.months || 9999) - (x.months || 9999));

// ── 출력 ────────────────────────────────────────────────────────────
const w = (f, o) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(o, null, 1));
w('gap_member_basic.json', memGap);
w('gap_group_basic.json', grpGap);
w('gap_stale_disco.json', staleDisco);

const memActiveFillable = memGap.filter(m => m.active && m.namu).length;
console.log('── 기본정보 완성도 감사 ──');
console.log(`멤버 ${arts.length}명 / 그룹 ${gks.length}개`);
console.log('');
console.log(`[멤버 갭] ${memGap.length}명 (활동+namu보유=바로채우기 가능 ${memActiveFillable}명)`);
console.log(`  · 생일 없음: ${memGap.filter(m => m.need.includes('bday')).length}`);
console.log(`  · 국적 없음: ${memGap.filter(m => m.need.includes('nat')).length}`);
console.log(`  · 나무위키 없음: ${memGap.filter(m => m.need.includes('namu')).length}`);
console.log('');
console.log(`[그룹 갭] ${grpGap.length}개`);
console.log(`  · 팬덤 없음: ${grpGap.filter(g => g.need.includes('fandom')).length}`);
console.log(`  · 인스타 없음: ${grpGap.filter(g => g.need.includes('instagram')).length}`);
console.log(`  · 유튜브 없음: ${grpGap.filter(g => g.need.includes('youtube')).length}`);
console.log('');
console.log(`[신보 점검 후보] 활동 그룹인데 최신 앨범 ${STALE_MONTHS}개월+ 경과: ${staleDisco.length}개`);
console.log('  상위 15:', staleDisco.slice(0, 15).map(s => `${s.ko}(${s.months ?? '무'}m)`).join(' · '));
console.log('');
console.log(`→ 갭 JSON 3종 저장: ${OUT}`);
