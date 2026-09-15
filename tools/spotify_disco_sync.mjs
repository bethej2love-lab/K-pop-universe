// 스포티파이 신보 일일 수집 (2026-09-15)
//
// 하는 일: 우리 로스터를 우선순위 순으로 돌며 "스포티파이엔 있는데 우리 데이터엔 없는 앨범"을 찾아
// groups.json / artists.json에 넣는다. 파생물(disco/·slim·tracks_index) 재생성은 이 커밋이
// rebuild-disco-artifacts.yml을 깨워 자동으로 이어진다.
//
// ── 왜 '예산 + 커서'인가 ─────────────────────────────────────────────────────
// 호출 횟수가 1급 제약이다(spotify_auth.mjs 실측: /artists/{id}/albums 약 100회에 24시간 잠김).
// "388팀을 매일 다 훑는다"는 순진한 설계는 쓸 수 없다. 그래서:
//   · 한 회차에 BUDGET(기본 80)회만 쓰고 멈춘다
//   · 어디까지 봤는지 spotify_sync_state.json에 남겨 다음 회차가 이어받는다
//   · 순서는 groups.json의 pri(A/B/C) 우선 → 큰 그룹 신보가 먼저 잡힌다
//   · 긴 429가 뜨면 기다리지 않고 그 회차를 접는다(진행분은 이미 파일에 반영돼 있다)
// 하루 2회차(KST 18:11/00:11) × 80 = 160팀이라 전체 한 바퀴에 2~3일. 신보는 하루 2장 수준이고
// A등급부터 도니 실질 지연은 거의 없다.
//
// ⚠️ 이 스크립트는 **원본(groups.json/artists.json)만** 고친다. 파생물은 건드리지 않는다.
// ⚠️ 이미 있는 앨범은 절대 덮어쓰지 않는다 — 사람이 고쳐둔 값(타이틀곡·집 번호·커버)을 자동 수집이
//    되돌리면 안 된다. 이 프로젝트의 tags_manual 원칙과 같은 취지다.
//
// 실행: node tools/spotify_disco_sync.mjs [--dry] [--budget N] [--only 에스파,아이브]
// env: SPOTIFY_CLIENT_ID/SECRET (또는 .spotify.key) · BUDGET

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RateLimited } from './spotify_auth.mjs';
import { norm, isVariant, searchAlbums, resolveArtist, toEntry } from './spotify_disco_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const rd = f => JSON.parse(fs.readFileSync(P(f), 'utf8'));

// ⚠️ 원본 파일의 들여쓰기를 **보존해서** 쓴다. groups.json은 2칸인데 artists.json은 **1칸**이라,
//    둘 다 `JSON.stringify(x, null, 2)`로 쓰면 artists.json 20만 줄이 통째로 리포맷된 diff가 된다.
//    자동 수집이 매일 그런 커밋을 만들면 실제로 뭐가 추가됐는지 아무도 못 본다(리뷰가 불가능해진다).
//    스타일은 2번째 줄의 선행 공백에서 읽고, 끝 개행 유무도 원본을 따른다.
function writeJsonKeepingStyle(file, obj) {
  const raw = fs.readFileSync(P(file), 'utf8');
  const m = /^[\[{]\r?\n([ \t]+)/.exec(raw);
  const indent = m ? m[1] : 2;
  const eol = raw.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(P(file), JSON.stringify(obj, null, indent) + eol);
}

const DRY = process.argv.includes('--dry');
const argOf = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const BUDGET = Number(argOf('--budget') || process.env.BUDGET || 80);
const ONLY = argOf('--only') ? new Set(argOf('--only').split(',')) : null;

const groups = rd('groups.json');
const artists = rd('artists.json');
const MAP_F = 'spotify_artist_map.json';
const STATE_F = 'spotify_sync_state.json';
const map = fs.existsSync(P(MAP_F)) ? rd(MAP_F) : {};
const state = fs.existsSync(P(STATE_F)) ? rd(STATE_F) : { checked: {}, runs: 0 };
state.checked = state.checked || {};

// ── 대상 목록과 순서 ─────────────────────────────────────────────────────────
// pri(A/B/C)가 앞선 순 → 같은 등급 안에서는 **가장 오래 안 본 순**. 이러면 A등급은 매 회차 가깝게
// 돌고, 하위 등급도 반드시 언젠가 돈다(굶는 대상이 안 생긴다).
const PRI = { A: 0, B: 1, C: 2 };
function targets() {
  const out = [];
  for (const [ko, g] of Object.entries(groups)) {
    if (g.disbanded) continue;                       // 해체 그룹은 신보가 없다
    out.push({ ko, kind: 'group', names: [g.en, ko, ...(g.altNames || [])].filter(Boolean), pri: PRI[g.pri] ?? 3 });
  }
  for (const a of artists) {
    const ko = a.name?.ko, gko = a.group?.ko;
    if (!ko || !gko || groups[gko]) continue;        // 실존 그룹 소속은 그룹으로 커버
    if (a.active === false) continue;
    out.push({ ko, kind: 'solo', names: [a.name?.en, ko].filter(Boolean), pri: 3 });
  }
  const seen = new Set();
  return out.filter(t => (seen.has(t.ko) ? false : seen.add(t.ko)))
    .sort((x, y) => x.pri - y.pri || (state.checked[x.ko] || '').localeCompare(state.checked[y.ko] || ''));
}

// 그 대상이 이미 갖고 있는 앨범 (정규화 제목 집합 + 발매 연도 목록)
// ⚠️ 연도가 중요하다 — 매핑 검증을 "우리가 실제로 앨범을 가진 연도"로 해야 한다(자세한 건
//    spotify_disco_lib.mjs의 resolveArtist 주석). 최신 연도부터 내림차순으로 준다.
function owned(t) {
  const set = new Set(), years = new Set();
  // ⚠️ years는 **그 주체 본인의 디스코에서만** 모은다. 멤버 솔로 앨범까지 섞으면 검증이 무너진다 —
  //    실측(펜타곤): 그룹 최신 앨범은 2023년인데 멤버 솔로가 2025·2026에 있어서 연도가 2026,2025로
  //    잡혔고, 그 연도로 그룹을 검색하니 당연히 겹침 0 → 정답 매핑이 "미검증"으로 보류됐다.
  //    titles 쪽은 반대로 멤버 것까지 넣는 게 맞다(중복 삽입 방지가 목적이라 넓을수록 안전).
  const add = (list, countYear) => {
    for (const al of list || []) {
      const k = norm(al.title); if (k) set.add(k);
      if (!countYear) continue;
      const y = Number(String(al.releaseDate || '').slice(0, 4)); if (y > 1990) years.add(y);
    }
  };
  if (t.kind === 'group') {
    add(groups[t.ko]?.discography, true);
    for (const a of artists) if (a.group?.ko === t.ko) add(a.discography, false); // 멤버 솔로: 중복 방지용으로만
  } else {
    for (const a of artists) {
      if (a.name?.ko !== t.ko) continue;
      add(a.discography, true);
      for (const u of a.unitDiscography || []) add(u?.albums, true);
    }
  }
  return { titles: set, years: [...years].sort((a, b) => b - a) };
}

// 새 앨범을 원본에 꽂는다(발매일 내림차순 유지 — 기존 파일이 그 순서다)
function insert(t, entry) {
  const push = list => {
    list.push(entry);
    list.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
  };
  if (t.kind === 'group') { groups[t.ko].discography = groups[t.ko].discography || []; push(groups[t.ko].discography); return true; }
  const a = artists.find(x => x.name?.ko === t.ko && !groups[x.group?.ko]);
  if (!a) return false;
  a.discography = a.discography || [];
  push(a.discography);
  return true;
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const year = new Date().getFullYear();
const month = new Date().getMonth() + 1;
// 1월 초엔 지난해 말 발매가 아직 "신보"다 — 그때만 연도를 하나 더 본다(평소엔 콜을 안 쓴다).
const YEARS = month === 1 ? [year, year - 1] : [year];

let calls = 0, checked = 0, added = 0, mapped = 0;
const addedList = [], reviewList = [], problems = [];
let stoppedBy = null;

const list = ONLY ? targets().filter(t => ONLY.has(t.ko)) : targets();
console.log(`[disco-sync] 대상 ${list.length} · 예산 ${BUDGET}콜 · 연도 ${YEARS.join(',')}${DRY ? ' · DRY' : ''}`);

for (const t of list) {
  if (calls >= BUDGET) { stoppedBy = '예산 소진'; break; }
  try {
    const own = owned(t);
    // 1) 매핑이 없으면 먼저 해석한다(여기서도 콜을 쓰므로 같은 예산에서 깎는다)
    let m = map[t.ko];
    if (!m || !m.id) {
      const r = await resolveArtist({ names: t.names, ourTitles: own.titles, ourYears: own.years });
      calls += r.calls;
      if (!r.ok) { problems.push(`${t.ko} — 매핑 실패(${r.reason})`); state.checked[t.ko] = new Date().toISOString().slice(0, 10); continue; }
      m = map[t.ko] = { id: r.id, spotifyName: r.name, kind: t.kind, confidence: r.confidence, why: r.why, evidence: { titleOverlap: r.overlap }, checkedAt: new Date().toISOString().slice(0, 10) };
      mapped++;
      if (r.confidence === 'low') reviewList.push(`매핑 확인 필요: ${t.ko} → ${r.name} (${r.why}, 겹침 ${r.overlap})`);
    }

    // 2) 올해(1월이면 작년까지) 앨범을 검색해 우리에 없는 것만 고른다
    const newOnes = [];
    for (const y of YEARS) {
      if (calls >= BUDGET) { stoppedBy = '예산 소진'; break; }
      const items = await searchAlbums(m.spotifyName || t.names[0], y, m.id);
      calls++;
      for (const al of items) {
        const key = norm(al.name);
        if (!key || own.titles.has(key)) continue;            // 이미 있음
        if (isVariant(al.name)) continue;                     // 리믹스·영어버전·멤버별 스페셜
        if (String(al.release_date_precision) !== 'day') { problems.push(`${t.ko} — 발매일 정밀도 ${al.release_date_precision}: ${al.name}`); continue; }
        newOnes.push(al);
      }
    }

    // 3) ⚠️ 검증 게이트 — **확인 안 된 매핑으로는 앨범을 넣지 않는다.**
    //    confidence가 'medium'인 건 "이름이 유일하게 일치"만 본 것이라 동명이인일 수 있다. 평소엔
    //    검증 비용을 안 쓰다가, **실제로 넣을 게 생겼을 때만** 우리가 앨범을 가진 연도로 대조한다.
    //    신보는 하루 2장 수준이라 이 비용은 사실상 없는 것과 같고, 엉뚱한 사람의 앨범이 쌓이는 건 막는다.
    if (newOnes.length && m.confidence !== 'high' && own.years.length && calls < BUDGET) {
      let ov = 0;
      for (const y of own.years.slice(0, 2)) {
        if (calls >= BUDGET) break;
        const items = await searchAlbums(m.spotifyName, y, m.id);
        calls++;
        for (const al of items) if (own.titles.has(norm(al.name))) ov++;
        if (ov >= 1) break;
      }
      m.evidence = { ...(m.evidence || {}), verifyOverlap: ov, verifyYears: own.years.slice(0, 2) };
      if (ov >= 1) { m.confidence = 'high'; m.why = (m.why || '') + ` · 수집 전 검증 통과(겹침 ${ov})`; }
      else {
        reviewList.push(`⛔ 매핑 미검증이라 보류: ${t.ko} → ${m.spotifyName} — 우리가 앨범을 가진 연도(${own.years.slice(0, 2).join(',')})에 겹치는 앨범이 0. 신보 ${newOnes.length}장을 넣지 않았습니다.`);
        newOnes.length = 0;
      }
    }

    // 4) 넣기
    for (const al of newOnes) {
      if (calls >= BUDGET) { stoppedBy = '예산 소진'; break; }
      const { entry, needsTitleTrack } = await toEntry(al);
      calls++;
      if (DRY) { addedList.push(`[DRY] ${t.ko} · ${entry.releaseDate} · ${entry.type} · ${entry.title}${needsTitleTrack ? ' (타이틀곡 미상)' : ''}`); }
      else if (insert(t, entry)) {
        added++;
        own.titles.add(norm(al.name));
        addedList.push(`${t.ko} · ${entry.releaseDate} · ${entry.type} · ${entry.title}${needsTitleTrack ? ' (타이틀곡 미상)' : ''}`);
        if (needsTitleTrack) reviewList.push(`타이틀곡 미상: ${t.ko} — ${entry.title} (${entry.trackCount}트랙)`);
      } else problems.push(`${t.ko} — 넣을 대상을 못 찾음`);
    }
    state.checked[t.ko] = new Date().toISOString().slice(0, 10);
    checked++;
  } catch (e) {
    if (e instanceof RateLimited) { stoppedBy = `레이트리밋 (${e.message})`; break; }
    problems.push(`${t.ko} — ${e.message}`);
    state.checked[t.ko] = new Date().toISOString().slice(0, 10);
  }
}

// ── 저장 ─────────────────────────────────────────────────────────────────────
if (!DRY) {
  if (added) {
    writeJsonKeepingStyle('groups.json', groups);
    writeJsonKeepingStyle('artists.json', artists);
  }
  const sortedMap = {}; for (const k of Object.keys(map).sort()) sortedMap[k] = map[k];
  fs.writeFileSync(P(MAP_F), JSON.stringify(sortedMap, null, 2) + '\n');
  state.runs = (state.runs || 0) + 1;
  state.lastRunAt = new Date().toISOString();
  fs.writeFileSync(P(STATE_F), JSON.stringify(state, null, 2) + '\n');
}

// ── 리포트 ───────────────────────────────────────────────────────────────────
const out = [];
const say = s => { out.push(s); console.log(s); };
say(`## 스포티파이 신보 수집`);
say('');
// 대상을 다 훑었으면 예산을 조금 넘겼어도 "완주"다 — 예산은 하드 컷이 아니라 회차당 상한선이고,
// 한 대상을 처리하다 몇 콜 넘기는 건 정상이다(중간에 끊으면 그 대상만 어중간해진다).
const done = checked >= list.length;
say(`- 훑은 대상 **${checked}** / ${list.length} · 콜 **${calls}**/${BUDGET} · 새 매핑 ${mapped}건`);
say(`- 추가한 앨범 **${added}장**${done ? ' · 대상 전부 완주' : ` · 중단: ${stoppedBy || '알 수 없음'} (다음 회차가 이어받음)`}`);
if (addedList.length) { say(''); addedList.slice(0, 40).forEach(s => say(`  - ${s}`)); if (addedList.length > 40) say(`  - … 외 ${addedList.length - 40}장`); }
if (reviewList.length) { say(''); say(`<details><summary>사람이 볼 것 ${reviewList.length}건</summary>`); say(''); reviewList.slice(0, 40).forEach(s => say(`  - ${s}`)); say(''); say('</details>'); }
if (problems.length) { say(''); say(`<details><summary>문제 ${problems.length}건</summary>`); say(''); problems.slice(0, 40).forEach(s => say(`  - ${s}`)); say(''); say('</details>'); }
if (DRY) say('\n[--dry] 파일은 쓰지 않았습니다.');

if (process.env.GITHUB_STEP_SUMMARY) { try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n'); } catch { } }
// 레이트리밋으로 접힌 건 **실패가 아니다** — 설계된 동작이고 다음 회차가 이어받는다.
// 진짜 실패(인증 오류 등)는 위에서 예외로 터져 나간다.
