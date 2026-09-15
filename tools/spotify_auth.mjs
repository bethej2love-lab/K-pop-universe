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

// GET 호출 — 429(레이트리밋)는 Retry-After만큼 쉬고 재시도, 5xx는 지수 백오프.
// ⚠️ 스포티파이는 유튜브와 달리 **일일 쿼터 상한이 없다**. 제한은 짧은 창의 요청 수뿐이라,
//    429를 정직하게 기다려주기만 하면 호출 횟수 자체는 설계 제약이 아니다.
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
      await sleep((wait + 1) * 1000);
      continue; // 429는 재시도 횟수에 안 센다 — 기다리면 반드시 풀린다
    }
    if (r.status === 401) { _token = null; if (i < retries) continue; }   // 토큰 만료 — 한 번 더
    if (r.status >= 500) { if (i >= retries) throw new Error(`${r.status} ${pathAndQuery}`); await sleep(800 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${pathAndQuery}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));
