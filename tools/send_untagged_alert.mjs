// 미태깅 영상 웹 푸시 알림 (2026-10-07)
//
// 매시간 동기화(sync-hourly.yml) 후에 실행된다. 직전 동기화에서 새로 들어온 live 영상 중
// members가 비어 있는 것을 찾아 관리자 휴대폰으로 웹 푸시를 보낸다.
//
// 대상 조건:
//   category = 'live'  AND  (members IS NULL OR members = '{}')
//   AND  published_at >= (오늘 - 7일)  AND  content_flag IS NULL
//
// 의존 패키지: web-push (워크플로에서 npm install web-push --no-save)
// env:
//   VAPID_PRIVATE_KEY  — GitHub Secret (비밀키)
//   SUPABASE_ANON_KEY  — 없으면 코드 내 하드코딩 폴백
//
// 실행(로컬): npm install web-push && DRY=1 node tools/send_untagged_alert.mjs

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.env.DRY === '1';

// ── Supabase 설정 ──────────────────────────────────────────────────────────
const SB_URL = 'https://dukgguehegnembimqvkm.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const YT_TABLE = 'yt_channel_videos';

async function sbGet(endpoint) {
  return new Promise((res, rej) => {
    const url = new URL(SB_URL + endpoint);
    https.get({
      hostname: url.hostname, path: url.pathname + url.search,
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }, r => {
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => { try { res(JSON.parse(body)); } catch { rej(new Error('JSON: ' + body.slice(0, 200))); } });
    }).on('error', rej);
  });
}

// ── VAPID 초기화 ───────────────────────────────────────────────────────────
const pushCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'push_config.json'), 'utf8'));
const VAPID_PUB = pushCfg.vapidPublicKey;
const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = pushCfg.subject;

if (!VAPID_PRIV) {
  console.error('[push] VAPID_PRIVATE_KEY 환경변수 없음 — GitHub Secret 확인');
  process.exit(0); // 에러로 끝내지 않음 — 알림 없어도 동기화 자체는 성공
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV);

// ── 알림 대상 그룹 ────────────────────────────────────────────────────────
// 제목에 멤버 힌트가 없어 자동 태깅이 잘 안 되는 그룹만 알림.
// 전체 출연 영상은 members={} 여도 상관없으므로 나머지 그룹은 제외.
const ALERT_GROUPS = ['코르티스', '크래비티', '아일릿'];

// ── 메인 ──────────────────────────────────────────────────────────────────
const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

// 1) 미태깅 live 영상 조회 (members가 null이거나 빈 배열 = pg 배열 {}로 저장)
const groupIn = `(${ALERT_GROUPS.map(g => encodeURIComponent(g)).join(',')})`;
const videosRes = await sbGet(
  `/rest/v1/${YT_TABLE}` +
  `?select=id,title,group_ko,published_at` +
  `&category=eq.live` +
  `&or=(members.is.null,members.eq.%7B%7D)` +
  `&published_at=gte.${sevenDaysAgo}` +
  `&content_flag=is.null` +
  `&group_ko=in.${groupIn}` +
  `&order=published_at.desc&limit=50`
);

const videos = Array.isArray(videosRes) ? videosRes : [];
console.log(`[push] 미태깅 live 영상: ${videos.length}건`);
if (!videos.length) { console.log('[push] 보낼 알림 없음'); process.exit(0); }

// 그룹별로 묶어 요약
const byGroup = {};
for (const v of videos) {
  const g = v.group_ko || '미분류';
  (byGroup[g] = byGroup[g] || []).push(v);
}
const topGroups = Object.entries(byGroup)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 4)
  .map(([g, vs]) => `${g} ${vs.length}개`)
  .join(' · ');

const payload = JSON.stringify({
  title: `🏷️ 미태깅 영상 ${videos.length}건`,
  body: topGroups,
  url: '/?admin=1'
});
console.log('[push] 알림 내용:', payload);

if (DRY) { console.log('[push] DRY 모드 — 전송 안 함'); process.exit(0); }

// 2) 구독 목록 조회
const subsRes = await sbGet('/rest/v1/push_subscriptions?select=endpoint,p256dh,auth');
const subs = Array.isArray(subsRes) ? subsRes : [];
console.log(`[push] 구독자: ${subs.length}명`);
if (!subs.length) { console.log('[push] 구독 없음 — 앱에서 알림 켜기 필요'); process.exit(0); }

// 3) 전송
let ok = 0, fail = 0;
for (const sub of subs) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { TTL: 86400 }
    );
    ok++;
  } catch (e) {
    fail++;
    const status = e.statusCode;
    console.warn(`[push] 전송 실패 ${status}: ${sub.endpoint.slice(0, 60)}...`);
    // 410/404 = 만료된 구독. 추후 cleanup 필요하지만 지금은 무시
  }
}
console.log(`[push] 전송 완료 — 성공 ${ok} / 실패 ${fail}`);
