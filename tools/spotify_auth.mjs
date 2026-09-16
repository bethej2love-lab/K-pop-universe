// 스포티파이 Web API 인증·호출 공용 모듈 (2026-09-15)
//
// 왜 스포티파이인가: 앨범 수집을 **매일 자동으로** 돌리려면 자동 접근이 허용된 공식 소스가 필요하다.
// 멜론은 robots.txt가 `User-agent: * → Disallow: /`라 사람이 가끔 돌리는 일회성 도구로만 쓰고
// (tools/melon_*.mjs), 매일 도는 크롤러의 소스로는 쓰지 않는다.
//
// 인증은 Client Credentials — 사용자 로그인이 없다. 앱의 id/secret으로 토큰을 받아 공개 카탈로그를
// 읽는 방식이라 무인 자동화에 맞는다(그래서 Redirect URI는 앱 등록 때 형식상 채울 뿐 쓰지 않는다).
//
// 키를 주는 방법 두 가지:
//   · CI  — 레포 시크릿 SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (환경변수로 주입)
//   · 로컬 — 레포 루트에 `.spotify.key` 파일. 형식은 둘 다 지원:
//              id:secret              (한 줄)
//              id\nsecret             (두 줄)
//            .gitignore의 `*.key`에 걸려 커밋되지 않는다(.kopis_key와 같은 방식).
//            ⚠️ 명령줄에 키를 직접 적지 말 것 — 셸 히스토리와 대화 기록에 그대로 남는다.
//
// ── 이 앱에서 **막혀 있는** 엔드포인트 (2026-09-16 실측) ──────────────────────
// 타이틀곡을 트랙 인기도로 자동 판정해보려고 찔러본 결과다. 다시 시도하지 말 것:
//   · `/tracks?ids=...`              → 403 Forbidden (id 1개만 넣어도 동일)
//   · `/artists/{id}/top-tracks`     → 403 Forbidden
//   · `/tracks/{id}` (단일)          → 200이지만 **popularity 필드가 아예 안 온다**(undefined)
// 즉 이 앱 권한으로는 인기도 기반 판정이 불가능하다(2024년 말 신규 앱 정책 이후로 보인다).
// 우리가 가진 유튜브 데이터로 "앨범 발매일 전후 MV 제목"과 트랙을 맞춰보는 대안도 재봤는데
// 커버리지가 4건 중 1건 수준이라(키스오브라이프만 맞음) 자동 판정 근거로는 못 쓴다.
// → 타이틀곡 미상(실측 104장)은 **지어내지 않고 비워둔다.** 화면은 트랙리스트를 그대로 그리고
//    타이틀곡 하이라이트만 안 붙으므로 기능이 깨지는 곳은 없다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readCreds() {
  let id = process.env.SPOTIFY_CLIENT_ID || '', secret = process.env.SPOTIFY_CLIENT_SECRET || '';
  if (!id || !secret) {
    const f = path.join(ROOT, '.spotify.key');
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, 'utf8').trim();
      const parts = raw.includes('\n') ? raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : raw.split(':');
      if (parts.length >= 2) { id = id || parts[0]; secret = secret || parts.slice(1).join(':'); }
    }
  }
  if (!id || !secret) {
    console.error('오류: 스포티파이 키가 없습니다.');
    console.error('  CI  → 레포 시크릿 SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET');
    console.error('  로컬 → 레포 루트에 .spotify.key 파일 (id:secret 한 줄, 또는 id/secret 두 줄)');
    process.exit(1);
  }
  return { id, secret };
}

let _token = null, _exp = 0;
export async function token() {
  if (_token && Date.now() < _exp - 30000) return _token;
  const { id, secret } = readCreds();
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) {
    const t = await r.text();
    // 400 invalid_client이면 키가 틀린 것. 값은 절대 찍지 않는다.
    throw new Error(`토큰 발급 실패 ${r.status}: ${t.slice(0, 200)}${r.status === 400 ? '  ← Client ID/Secret을 확인하세요' : ''}`);
  }
  const j = await r.json();
  _token = j.access_token;
  _exp = Date.now() + (j.expires_in || 3600) * 1000;
  return _token;
}

// ── ⚠️ 레이트리밋 실측 (2026-09-15) ─────────────────────────────────────────
// 처음엔 "스포티파이는 일일 쿼터 상한이 없고 짧은 창의 요청 수 제한만 있다"고 적었는데 **틀렸다**.
// 신규 앱(Development Mode)의 Client Credentials로 실측한 결과:
//   · `/artists/{id}/albums` 를 약 100회 호출 → 429, **Retry-After: 86,010초 (≈24시간)**
//   · 429는 **엔드포인트별**이다 — 같은 시각에 `/search`와 `/artists/{id}`는 200으로 멀쩡했다
//   · `/browse/new-releases` 는 아예 **403 Forbidden**(신규 앱에 막힌 엔드포인트)
//   · `limit`은 문서상 50까지지만 실제로는 **10을 넘기면 400 "Invalid limit"**
//   · 아티스트 객체에 `followers`·`genres`·`popularity`가 **아예 안 온다**
//     (검색·상세 모두 external_urls, href, id, images, name, type, uri 7개 필드뿐)
// → 호출 횟수는 **설계의 1급 제약**이다. "전 아티스트를 매일 훑는다"는 순진한 설계는 못 쓴다.
//    발견은 `/search`(type=album, `artist:` + `year:` 필터)로 하고, 한 번에 도는 양은 예산으로 묶는다.
//
// 429가 24시간짜리로 오면 기다릴 수 없다 — 그래서 **긴 Retry-After는 기다리지 않고 던진다**.
// 호출부가 "오늘 예산 소진"으로 보고 다음 실행에 넘기게 하는 게 맞다(무한정 붙잡고 있으면 워크플로가
// 타임아웃으로 죽고, 진행 상황도 안 남는다). 실제로 그렇게 매달려 있다가 스크립트가 멈춘 적이 있다.
export class RateLimited extends Error {
  constructor(sec, where) { super(`레이트리밋 — ${where} (Retry-After ${sec}초 ≈ ${(sec / 3600).toFixed(1)}시간)`); this.retryAfter = sec; }
}
const MAX_WAIT_SEC = Number(process.env.SPOTIFY_MAX_WAIT_SEC) || 120; // 이보다 길면 기다리지 않고 포기

// GET 호출 — 짧은 429는 Retry-After만큼 쉬고 재시도, 긴 429는 RateLimited로 던짐, 5xx는 지수 백오프.
export async function api(pathAndQuery, { retries = 4 } = {}) {
  for (let i = 0; ; i++) {
    const t = await token();
    let r;
    try {
      r = await fetch('https://api.spotify.com/v1' + pathAndQuery, {
        headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(25000),
      });
    } catch (e) {
      if (i >= retries) throw e;
      await sleep(800 * (i + 1));
      continue;
    }
    if (r.status === 429) {
      const wait = Number(r.headers.get('retry-after') || 2);
      if (wait > MAX_WAIT_SEC) throw new RateLimited(wait, pathAndQuery.split('?')[0]);
      await sleep((wait + 1) * 1000);
      continue; // 짧은 429는 재시도 횟수에 안 센다 — 기다리면 풀린다
    }
    if (r.status === 401) { _token = null; if (i < retries) continue; }   // 토큰 만료 — 한 번 더
    if (r.status >= 500) { if (i >= retries) throw new Error(`${r.status} ${pathAndQuery}`); await sleep(800 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${pathAndQuery}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
