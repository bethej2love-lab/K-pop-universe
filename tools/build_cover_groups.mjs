// 발견 탭 "그룹별 커버곡 모음" 선반의 후보 그룹 목록(cover_groups.json) — 하루 한 번 서버에서 만든다(2026-10-21).
//
// 왜: 예전엔 방문자 브라우저마다 첫날 한 번씩 영상 테이블 전체를 cover_of_* <> '{}' 조건 + id 정렬로 4번 훑어
// 이 목록을 만들었다. Supabase pg_stat_statements 실측(10-21 "Disk IO Budget 소진" 경고)에서 그 쿼리가
// 호출당 평균 19.6초·916회로 디스크 읽기 상위권이었다. 결과는 "커버 영상이 6개 이상인 그룹"이라
// 하루에 거의 안 바뀐다 — 매일 앨범 영상 갱신(album-videos.yml) 때 같이 만들고, 앱은 이 파일만 읽는다.
//
// 실행: node tools/build_cover_groups.mjs   (회사망: NODE_TLS_REJECT_UNAUTHORIZED=0)
import fs from 'node:fs';

const SB_URL = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const SB_KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 앱과 같은 공개 읽기 키(RLS 읽기 전용)
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
const OUT = 'cover_groups.json';

const counts = {};
let lastId = '', pages = 0;
// id 커서로 넘긴다(offset은 뒤로 갈수록 느려진다). 예전 앱 코드는 4,000행에서 멈췄지만 여기선 끝까지 센다.
for (;;) {
  const q = new URLSearchParams({ select: 'id,group_ko', or: '(cover_of_groups.neq.{},cover_of_members.neq.{})', order: 'id.asc', limit: '1000' });
  if (lastId) q.set('id', 'gt.' + lastId);
  const r = await fetch(SB_URL + '?' + q, { headers: H });
  if (!r.ok) { console.error('조회 실패', r.status, await r.text()); process.exit(1); }
  const rows = await r.json();
  rows.forEach(v => { if (v.group_ko) counts[v.group_ko] = (counts[v.group_ko] || 0) + 1; });
  pages++;
  if (rows.length < 1000) break;
  lastId = rows[rows.length - 1].id;
}
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), counts }) + '\n');
console.log(`[cover-groups] ${pages}페이지 · 그룹 ${Object.keys(counts).length}개 → ${OUT}`);
