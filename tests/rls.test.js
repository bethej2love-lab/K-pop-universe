// RLS(행 수준 보안) 회귀 테스트 (2026-08-26 신설)
//
// 왜 만들었나: 이 앱은 브라우저에서 Supabase를 직접 부르는 구조라, **공개된 anon 키가 곧 공격면**이다.
// 그래서 진짜 방어선은 클라이언트의 _isAdmin()이 아니라 서버의 RLS 정책 하나뿐인데, 새 테이블을
// 만들면서 RLS 켜는 걸 빠뜨려도 화면에는 아무 티가 안 난다(앱은 잘 돌아간다 — 오히려 더 잘 돈다).
// 그런 실수는 사람이 기억으로 막을 수 없어서 배포 전에 기계가 확인한다.
//
// 어떻게 확인하나(비파괴): 각 테이블에 **빈 INSERT({})** 를 던지고 에러 코드를 본다.
//   42501 = RLS가 막음                        → 잠겨 있음
//   23502 = NOT NULL 위반(=RLS는 통과했다)     → 익명 쓰기가 열려 있음
//   55000 = 뷰라서 INSERT 불가                 → 테이블이 아님
// ⚠️ 이 판별이 성립하는 근거: PostgreSQL은 **RLS WITH CHECK을 NOT NULL보다 먼저** 평가한다.
//    실측으로 확인함 — yt_channel_videos는 PK(id)가 NOT NULL인데 빈 INSERT에서 23502가 아니라
//    42501이 났다. 즉 23502가 났다는 건 RLS 관문을 이미 통과했다는 뜻이다.
// 어느 쪽이든 트랜잭션이 중단되므로 **데이터는 한 줄도 쓰이지 않는다.**
//
// 대상 테이블은 코드에서 자동 추출한다(.from('...')) — 새 테이블을 코드에 쓰기 시작하면 자동으로
// 검사 대상이 된다. (PostgREST의 스키마 introspection은 anon에게 401이라 서버에서 못 받아온다.)
//
// 실행: node tests/rls.test.js
//   회사망처럼 MITM 인증서가 끼어 있으면 fetch가 전부 죽으므로 다음처럼 실행:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node tests/rls.test.js
//
// ⚠️ 한계: 여기서 쓰는 건 "로그인하지 않은 anon 키"다. 익명 로그인/일반 로그인 세션까지는 검사하지
//    않는다(테스트가 실서비스에 auth 유저를 만들게 되므로). 유저별 격리(내 데이터만 보이는지)는
//    별도로 확인할 것.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1';
const KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 앱에 이미 공개된 anon 키

// ── 기대값 선언 ────────────────────────────────────────────────────────────────
// read:  'public'  익명이 읽어도 되는 공개 데이터(카탈로그·공유된 것)
//        'locked'  익명은 한 행도 못 봐야 함
// write: 'locked'  익명 INSERT가 RLS에 막혀야 함
//        'open'    익명 INSERT가 **의도적으로** 허용된 것(이유를 반드시 적을 것)
//        'view'    뷰라서 INSERT 불가
const EXPECT = {
  // 카탈로그성 공개 데이터 — 앱이 로그인 없이도 보여줘야 하는 것들
  yt_channel_videos:            { read: 'public', write: 'locked' },
  artist_pics:                  { read: 'public', write: 'locked' },
  ext_channels:                 { read: 'public', write: 'locked' },
  name_match_whitelist:         { read: 'public', write: 'locked' },
  kpop_events:                  { read: 'public', write: 'locked' },
  melon_yearly_top100:          { read: 'public', write: 'locked' },
  spotify_streaming_milestones: { read: 'public', write: 'locked' },
  // 유저가 공개하기로 한 것 / 집계
  public_collections:           { read: 'public', write: 'locked' },
  video_reactions:              { read: 'public', write: 'locked' },
  video_scraps:                 { read: 'public', write: 'locked' },
  // 어드민 전용 — 익명은 읽지도 못해야 함
  group_priority:               { read: 'locked', write: 'locked' },
  rank_snapshots:               { read: 'locked', write: 'locked' },
  collection_likes:             { read: 'locked', write: 'locked' },
  // 유저 데이터(즐겨찾기·프로필 등) — 절대 익명에게 열리면 안 됨
  user_data:                    { read: 'locked', write: 'locked' },
  // 의도적으로 익명 쓰기 허용
  feedback:                     { read: 'locked', write: 'open',
                                  why: '로그인 안 한 방문자도 피드백을 보낼 수 있어야 함. 읽기는 막혀 있음.' },
  // 뷰(집계) — INSERT 자체가 불가
  collection_like_counts:       { read: 'locked', write: 'view' },
  video_reaction_counts:        { read: 'public', write: 'view' },
  video_scrap_counts:           { read: 'public', write: 'view' },
  // 2026-08-26: 익명 INSERT가 열려 있던 걸 발견해 조임. 원인은 이 테이블에만 있던 'public write'
  //   (PERMISSIVE, cmd=ALL) 정책. 지우지 않고 RESTRICTIVE 정책 3개(INSERT/UPDATE/DELETE)를 AND로
  //   얹어서 관리자 이메일을 요구하게 했다 — 기존 정책을 드롭하면 관리자 권한이 같이 날아갈 수 있어서.
  //   ⚠️ 다른 테이블에도 'public write' 같은 PERMISSIVE ALL 정책이 있는지는 이 테스트가 계속 감시한다.
  atm_exception_rules:          { read: 'locked', write: 'locked' },
};

// ── 코드에서 테이블 자동 추출 ─────────────────────────────────────────────────
const src = ['index.html', 'admin.js', 'shared.js']
  .filter(f => fs.existsSync(path.join(ROOT, f)))
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const tables = [...new Set([...src.matchAll(/\.from\('([a-z0-9_]+)'\)/g)].map(m => m[1]))].sort();

let pass = true, netFail = false;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const warn = m => console.log('⚠️  ' + m);

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

async function readCount(t) {
  const r = await fetch(`${SB}/${t}?select=*`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') || '';
  const total = cr.split('/')[1];
  return total === '*' ? 0 : parseInt(total || '0', 10);
}
async function insertProbe(t) {
  const r = await fetch(`${SB}/${t}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: '{}' });
  let code = '';
  try { code = (await r.json()).code || ''; } catch (e) { }
  return code === '42501' ? 'locked' : code === '55000' ? 'view' : code === '23502' ? 'open' : ('알 수 없음(' + r.status + '/' + code + ')');
}

(async () => {
  console.log(`[rls] 코드에서 추출한 테이블 ${tables.length}개 검사 (익명 키 기준, 데이터는 쓰이지 않음)\n`);

  const unknown = tables.filter(t => !EXPECT[t]);
  if (unknown.length) {
    bad(`기대값이 선언되지 않은 새 테이블: ${unknown.join(', ')}`);
    console.log('   → tests/rls.test.js의 EXPECT에 read/write 기대값을 추가할 것.');
    console.log('     새 테이블을 만들 때 RLS를 켰는지 여기서 한 번 의식적으로 확인하라는 게 이 실패의 목적이다.\n');
  }

  for (const t of tables) {
    const exp = EXPECT[t];
    if (!exp) continue;
    let cnt, wr;
    try { cnt = await readCount(t); wr = await insertProbe(t); }
    catch (e) { netFail = true; bad(`${t}: 네트워크 오류 (${e.message})`); continue; }

    // 읽기
    const readState = cnt > 0 ? 'public' : 'locked';
    if (readState !== exp.read) {
      if (exp.read === 'locked') bad(`${t}: 익명이 ${cnt}행을 읽을 수 있음 — 잠겨 있어야 하는 테이블`);
      else warn(`${t}: 공개 기대인데 0행 (데이터가 비었거나 정책이 바뀜)`);
    }
    // 쓰기
    if (wr !== exp.write) {
      bad(`${t}: 익명 INSERT가 '${exp.write}' 기대인데 '${wr}'`);
    } else if (exp.write === 'open') {
      (exp.known_issue ? warn : ok)(`${t}: 익명 INSERT 허용 — ${exp.why}`);
    } else {
      ok(`${t}: 읽기 ${cnt}행 / 쓰기 ${wr === 'view' ? '뷰(INSERT 불가)' : 'RLS 차단'}`);
    }
  }

  if (netFail) {
    console.log('\n네트워크 오류가 있었다. 회사망이라면 다음처럼 다시 실행:');
    console.log('  NODE_TLS_REJECT_UNAUTHORIZED=0 node tests/rls.test.js');
  }
  console.log(pass ? '\n✅ RLS 테스트 통과' : '\n❌ RLS 테스트 실패');
  process.exit(pass ? 0 : 1);
})();
