// 관리자 계정에 비밀번호 심기 (1회용 · 2026-09-12)
//
// 앱 로그인은 구글 OAuth라 관리자 계정엔 비번이 없다. 헤드리스 무인 실행기(run_daily_routine.cjs)가
// sb.auth.signInWithPassword로 로그인하려면 이 계정에 비번이 하나 있어야 한다. service_role 키로
// Admin API를 호출해 심는다(구글 로그인은 그대로 계속 됨 — 비번이 추가될 뿐).
//
// ⚠️ Supabase 대시보드에서 **Email 로그인 제공자가 켜져 있어야** signInWithPassword가 동작한다
//    (Authentication → Providers → Email = Enabled).
//
// 실행:
//   SUPABASE_SERVICE_ROLE='<service_role 키>' node tools/set_admin_password.mjs '<새-비밀번호>'
//   (이메일을 바꾸려면 ADMIN_EMAIL 환경변수. 기본 bethej2love@gmail.com)
//   service_role 키는 절대 커밋/공개 금지. 심고 나면 그 비번을 GitHub Secret KPU_ADMIN_PASSWORD로 등록.

const URL = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const EMAIL = (process.env.ADMIN_EMAIL || 'bethej2love@gmail.com').trim();
const PW = process.argv[2] || process.env.NEW_PASSWORD;

if (!KEY) { console.error('오류: SUPABASE_SERVICE_ROLE 환경변수가 없습니다.'); process.exit(1); }
if (!PW || PW.length < 8) { console.error('오류: 새 비밀번호를 인자로 주세요(8자 이상). 예) node tools/set_admin_password.mjs "myStrongPass123"'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

// 이메일로 유저 찾기 — 전체 페이지를 훑는다. admin list users는 per_page 상한(200)이 있고, 이 앱은
// 방문자마다 익명 세션을 만들어서 auth.users에 익명 유저가 수백 명 쌓인다(=실제 회원 수 아님).
// 관리자 계정이 뒤 페이지에 묻히므로 1페이지만 보면 못 찾는다(2026-09-13 실측). 못 찾으면 이메일이
// 달린 진짜 계정 목록을 같이 돌려줘서 실제 관리자 이메일을 눈으로 확인할 수 있게 한다.
async function findUser(email) {
  const perPage = 200;
  let scanned = 0, anon = 0;
  const emailAccounts = [];
  for (let page = 1; page <= 500; page++) { // 안전 상한(최대 10만명)
    const r = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, { headers: H });
    if (!r.ok) throw new Error(`유저 목록 조회 실패: ${r.status} ${await r.text()}`);
    const body = await r.json();
    const users = Array.isArray(body) ? body : (body.users || []);
    if (!users.length) break;
    scanned += users.length;
    for (const x of users) {
      if (x.is_anonymous || !x.email) { anon++; continue; }
      emailAccounts.push(x.email);
      if (x.email.toLowerCase() === email.toLowerCase()) return { user: x, scanned, anon, emailAccounts };
    }
    if (users.length < perPage) break; // 마지막 페이지
  }
  return { user: null, scanned, anon, emailAccounts };
}

async function main() {
  // 1. 이메일로 유저 찾기(전 페이지)
  const { user, scanned, anon, emailAccounts } = await findUser(EMAIL);
  if (!user) {
    console.error(`오류: ${EMAIL} 계정을 못 찾았습니다.`);
    console.error(`   전체 ${scanned}명 중 익명 방문자 ${anon}명 · 이메일 계정 ${emailAccounts.length}개(=실제 회원).`);
    console.error(`   이메일 계정 목록: ${emailAccounts.slice(0, 40).join(', ') || '(없음)'}`);
    console.error(`   → 이 중 관리자 이메일이 있으면 ADMIN_EMAIL(또는 KPU_ADMIN_EMAIL 시크릿)을 그 값으로 지정하세요.`);
    process.exit(1);
  }

  // 2. 비번 설정
  const ur = await fetch(`${URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT', headers: H, body: JSON.stringify({ password: PW }),
  });
  if (!ur.ok) { console.error('비번 설정 실패:', ur.status, await ur.text()); process.exit(1); }

  console.log(`✅ ${EMAIL} 계정에 비밀번호를 설정했습니다.`);
  console.log('   이제 이 비번을 GitHub → Settings → Secrets → Actions 에 KPU_ADMIN_PASSWORD 로 등록하세요.');
  console.log('   ⚠️ Supabase Authentication → Providers → Email 이 Enabled 인지도 확인하세요(비번 로그인 필수).');
}
main().catch(e => { console.error('오류:', e && e.message ? e.message : e); process.exit(1); });
