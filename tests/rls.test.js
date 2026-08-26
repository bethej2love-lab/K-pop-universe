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
  // ⚠️ read는 'public'이 맞다(2026-08-26 재확인): index.html의 _loadDynamicAtmRules()가 line ~12530에서
  //   **로그인 무관 전원에게 무조건** 호출돼 매처 예외규칙(surname_exclude·literal_only·ambiguous_comatch)을
  //   로드한다 — 공개 읽기가 앱 동작에 필요하고, 내용은 태깅 설정 토큰/타임스탬프라 유저 데이터가 아니다.
  //   처음엔 테이블이 0행이라 'locked'로 잘못 통과했는데, 행이 생기자 실제 정책(public read)이 드러난 것.
  //   경계 대상은 어디까지나 write였고, write는 위 RESTRICTIVE 3종으로 관리자만 가능(테스트 통과 확인).
  atm_exception_rules:          { read: 'public', write: 'locked' },
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

  // ── 로그인 유저 간 격리(cross-user) — 두 테스트 계정 토큰이 있을 때만 ──────────────
  // 왜 필요: 위 검사는 전부 '로그인 안 한 anon' 기준이라 "로그인한 A가 B의 행을 보는가"는 못 잡는다.
  //   read:'locked'인 per-user 테이블(user_data 즐겨찾기·프로필, collection_likes)에 유저 격리
  //   정책(USING auth.uid()=user_id)이 빠져 있으면, 익명은 막혀도 '로그인한 아무나'가 남의 데이터를
  //   전부 읽을 수 있다 — anon 테스트로는 절대 안 잡히는 사각지대다.
  // 실행법:
  //   1) 테스트 계정 2개를 만들고 각 access_token(JWT)을 구한다
  //      (브라우저 콘솔: (await sb.auth.getSession()).data.session.access_token)
  //   2) 계정 B로 즐겨찾기/프로필 등을 미리 만들어 둔다(B가 빈 계정이면 0행이라 판정이 무의미)
  //   3) KPU_TOKEN_A=... KPU_TOKEN_B=... node tests/rls.test.js
  // read:'public'인 video_scraps·video_reactions는 원래 누구나 읽는 집계라 격리 대상이 아니다(제외).
  const TOKEN_A = process.env.KPU_TOKEN_A, TOKEN_B = process.env.KPU_TOKEN_B;
  const jwtSub = t => { try { return JSON.parse(Buffer.from((t.split('.')[1] || ''), 'base64').toString()).sub || ''; } catch (e) { return ''; } };
  if (TOKEN_A && TOKEN_B) {
    const uidB = jwtSub(TOKEN_B);
    const asUser = tok => ({ apikey: KEY, Authorization: 'Bearer ' + tok });
    const OWNED = { user_data: 'user_id', collection_likes: 'user_id' }; // read:locked인 per-user 테이블만
    console.log('\n[rls] 로그인 유저 간 격리 검사 (로그인 A가 B의 행을 읽는지)');
    if (!uidB) warn('KPU_TOKEN_B에서 uid(sub)를 못 읽음 — 올바른 access_token(JWT)인지 확인');
    for (const [t, col] of Object.entries(OWNED)) {
      try {
        // A의 토큰으로 B의 소유행을 직접 조회 — 격리돼 있으면 0행이어야 한다
        const rA = await fetch(`${SB}/${t}?select=${col}&${col}=eq.${uidB}`, { headers: { ...asUser(TOKEN_A), Prefer: 'count=exact', Range: '0-0' } });
        const seenByA = parseInt((rA.headers.get('content-range') || '').split('/')[1] || '0', 10) || 0;
        // B 자신으로 조회해 데이터 존재 여부 확인(0이면 판정 무의미)
        const rB = await fetch(`${SB}/${t}?select=${col}&${col}=eq.${uidB}`, { headers: { ...asUser(TOKEN_B), Prefer: 'count=exact', Range: '0-0' } });
        const ownedByB = parseInt((rB.headers.get('content-range') || '').split('/')[1] || '0', 10) || 0;
        if (seenByA > 0) bad(`${t}: 로그인 A가 B의 행 ${seenByA}개를 읽음 — 유저 격리 정책(USING auth.uid()=${col}) 누락/오류`);
        else if (!ownedByB) warn(`${t}: 계정 B에 데이터가 없어 격리 판정 무의미 — B로 즐겨찾기 등을 먼저 만들 것`);
        else ok(`${t}: A가 B의 행을 못 봄(B는 ${ownedByB}행 보유, A에겐 0행)`);
      } catch (e) { netFail = true; warn(`${t}: 격리 검사 네트워크 오류 (${e.message})`); }
    }
  } else {
    console.log('\n[rls] ⏭️  로그인 유저 간 격리 검사 건너뜀 — KPU_TOKEN_A / KPU_TOKEN_B 환경변수 없음.');
    console.log('      테스트 계정 2개의 access_token을 주면 "A가 B의 데이터를 읽는지"까지 검사한다:');
    console.log('      KPU_TOKEN_A=... KPU_TOKEN_B=... node tests/rls.test.js');
  }

  if (netFail) {
    console.log('\n네트워크 오류가 있었다. 회사망이라면 다음처럼 다시 실행:');
    console.log('  NODE_TLS_REJECT_UNAUTHORIZED=0 node tests/rls.test.js');
  }
  console.log(pass ? '\n✅ RLS 테스트 통과' : '\n❌ RLS 테스트 실패');
  process.exit(pass ? 0 : 1);
})();
