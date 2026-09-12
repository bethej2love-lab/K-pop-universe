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

async function main() {
  // 1. 이메일로 유저 찾기
  const listUrl = `${URL}/auth/v1/admin/users?per_page=200`;
  const lr = await fetch(listUrl, { headers: H });
  if (!lr.ok) { console.error('유저 목록 조회 실패:', lr.status, await lr.text()); process.exit(1); }
  const body = await lr.json();
  const users = Array.isArray(body) ? body : (body.users || []);
  const user = users.find(u => (u.email || '').toLowerCase() === EMAIL.toLowerCase());
  if (!user) { console.error(`오류: ${EMAIL} 계정을 못 찾았습니다(가입된 유저 ${users.length}명 확인). 이메일을 확인하세요.`); process.exit(1); }

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
