// tools/weekly_report.mjs
// weekly-report.yml이 매주 월요일 KST 09:00에 호출.
// Supabase에서 지난 7일 통계를 조회해 GitHub Issue로 발행 → GitHub가 이메일 알림 발송.
//
// 필요 환경변수: SUPABASE_SERVICE_ROLE, GH_TOKEN, GH_REPO
// SUPABASE_URL은 선택(기본값 내장).

import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;
const GH_TOKEN = process.env.GH_TOKEN;
const GH_REPO = process.env.GH_REPO;

if (!SB_KEY) { console.error('SUPABASE_SERVICE_ROLE 없음'); process.exit(1); }
if (!GH_TOKEN) { console.error('GH_TOKEN 없음'); process.exit(1); }
if (!GH_REPO) { console.error('GH_REPO 없음'); process.exit(1); }

const sb = createClient(SB_URL, SB_KEY);

function fmt(n) { return n == null ? '?' : n.toLocaleString(); }

async function safeCount(query) {
  try { const { count } = await query; return count; } catch { return null; }
}
async function safeData(query) {
  try { const { data } = await query; return data; } catch { return null; }
}

async function main() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400 * 1000);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const nowStr = now.toISOString().slice(0, 10);

  const [newVideos, heldVideos, hiddenVideos, queueCount, milestones, wins, totalVideos] = await Promise.all([
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString())),
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true }).eq('content_flag', '보류')),
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true }).eq('content_flag', 'hidden')),
    safeCount(sb.from('tag_review_queue').select('id', { count: 'exact', head: true }).is('resolved_at', null)),
    safeCount(sb.from('yt_view_milestones').select('id', { count: 'exact', head: true }).gte('crossed_at', weekAgoStr).eq('seeded', false)),
    safeCount(sb.from('music_show_wins').select('id', { count: 'exact', head: true }).gte('win_date', weekAgoStr)),
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true })),
  ]);

  const routineMeta = await safeData(sb.from('atm_exception_rules').select('value').eq('type', 'admin_meta').eq('key', 'last_routine').maybeSingle());
  const cleanupMeta = await safeData(sb.from('atm_exception_rules').select('value').eq('type', 'admin_meta').eq('key', 'last_cleanup').maybeSingle());

  function ageStr(isoStr) {
    if (!isoStr?.value) return '기록 없음';
    const diffH = Math.round((now - new Date(isoStr.value)) / 3600000);
    return diffH < 24 ? `${diffH}시간 전` : `${Math.round(diffH / 24)}일 전`;
  }

  const queueWarn = queueCount > 50 ? ` ⚠️ 50건 초과` : '';
  const heldWarn = heldVideos > 200 ? ` ⚠️` : '';

  const body = `## 주간 현황 (${weekAgoStr} ~ ${nowStr})

### 이번 주 활동
| 항목 | 수치 |
|---|---|
| 신규 영상 유입 | ${fmt(newVideos)}건 |
| 조회수 마일스톤 돌파 | ${fmt(milestones)}건 |
| 음방 1위 | ${fmt(wins)}건 |

### 현재 상태
| 항목 | 수치 |
|---|---|
| 전체 영상 | ${fmt(totalVideos)}건 |
| 보류 영상 누적 | ${fmt(heldVideos)}건${heldWarn} |
| 숨김 영상 누적 | ${fmt(hiddenVideos)}건 |
| 검수 큐 대기 | ${fmt(queueCount)}건${queueWarn} |

### 자동화 상태
- **마지막 일일 루틴**: ${ageStr(routineMeta)}
- **마지막 데이터 청소**: ${ageStr(cleanupMeta)}

${queueCount > 50 ? '> ⚠️ 검수 큐가 50건을 넘었습니다. 어드민에서 확인이 필요합니다.\n' : ''}\
> 자동 발행 — weekly-report.yml · ${now.toISOString()}
`;

  const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));
  const title = `📊 주간 현황 ${nowStr.slice(0, 7)} W${weekNum}`;

  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Issue 생성 실패:', res.status, err);
    process.exit(1);
  }

  const issue = await res.json();
  console.log(`✅ 주간 보고 발행: #${issue.number} ${issue.html_url}`);
}

main().catch(e => { console.error(e); process.exit(1); });
