// 지난 인스타 글을 열 때 모든 장의 새 주소 받기(2026-11-13, 사용자 "최근 사진은 다 태깅되는데 지난 여러 장 글은 안 되는 게 이해가 안 돼").
// 왜: 인스타가 주는 사진 주소는 2~4일이면 만료된다. 최근 글은 2시간마다 새로 받아 늘 살아 있지만, 지난 글(과거 채우기)은 한 번 받고 끝 —
//     공개 주소(instagram.com/p/{code}/media/)로는 첫 장만 다시 받을 수 있다.
// 그래서: 과거 채우기가 글마다 '목록 어느 쪽에 있었는지'(ig_media.pc = '커서|한 쪽 개수')를 적어 두고, 열 때 그 쪽만 Business Discovery로
//     다시 물어 모든 장(+영상 파일) 새 주소를 받는다. 받은 주소는 ig_media에 써 두어 만료 전까지 다시 열면 호출 없음.
// 호출: GET /functions/v1/ig-fresh?c={post_key} → 200 {post_key,u,c,mi,v,n} | 404 {reason}
// 키: app_secrets.meta_ig_token(과거 채우기 워크플로가 넣음, 방문자 못 읽음). DB는 서버 함수 기본 환경변수(service role)로.
// 배포: Management API functions/deploy?slug=ig-fresh, verify_jwt false(사이트가 인증 없이 부름)
const SB = Deno.env.get('SUPABASE_URL')!, SKEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IG_USER = '17841420475472395', GRAPH = 'https://graph.facebook.com/v26.0';
const H = { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'application/json' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Content-Type': 'application/json' };
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });
const fresh = (u?: string | null) => { if (!u) return false; const m = /[?&]oe=([0-9A-Fa-f]{6,})/.exec(u); return !m || parseInt(m[1], 16) * 1000 > Date.now() + 3600e3; };
const keyOf = (p?: string) => (String(p || '').match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || null;
const img = (m: any) => m.thumbnail_url || (m.media_type !== 'VIDEO' ? m.media_url : null);
const usage = (h: Headers) => { let m = 0; for (const k of ['x-app-usage', 'x-business-use-case-usage']) { const v = h.get(k); if (v) v.replace(/"(call_count|total_time|total_cputime)":(\d+)/g, (_s, _a, n) => { m = Math.max(m, +n); return ''; }); } return m; };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const code = (new URL(req.url).searchParams.get('c') || '').match(/^[A-Za-z0-9_-]{5,40}$/)?.[0];
  if (!code) return out({ reason: 'bad request' }, 400);
  try {
    const rr = await fetch(`${SB}/rest/v1/ig_media?select=post_key,handle,media_id,ty,n,u,c,mi,v,pc&post_key=eq.${code}`, { headers: H });
    const row = (await rr.json())[0];
    if (!row) return out({ reason: 'no row' }, 404);
    const isVid = row.ty === 'VIDEO', multi = (row.n || 1) > 1;
    const already = isVid ? fresh(row.v) : multi ? Array.isArray(row.c) && row.c.length > 1 && row.c.every(fresh) : fresh(row.u);
    if (already) return out(row);
    if (!row.pc) return out({ reason: 'no cursor' }, 404);
    const tk = await fetch(`${SB}/rest/v1/app_secrets?select=v&k=eq.meta_ig_token`, { headers: H });
    const token = (await tk.json())[0]?.v;
    if (!token) return out({ reason: 'no token' }, 503);
    const [cur0, lim0] = String(row.pc).split('|');
    let cursor = cur0 || '', lim = Math.max(1, +lim0 || 25), seen = 0, hit: any = null, calls = 0;
    // 그 쪽만 다시 — 응답이 크면 반씩 줄여 이어 받는다(같은 쪽 범위 안에서). 첫 쪽(커서 없음)은 새 글이 위에 쌓였을 수 있어 한 쪽 더.
    const span = (cur0 ? 0 : 50) + (+lim0 || 25);
    let step = lim;
    while (!hit && seen < span && calls < 6) {
      const media = `media${cursor ? `.after(${cursor})` : ''}.limit(${step}){id,media_type,media_url,thumbnail_url,permalink,children{id,media_type,media_url,thumbnail_url}}`;
      const r = await fetch(`${GRAPH}/${IG_USER}?fields=business_discovery.username(${encodeURIComponent(row.handle)}){${media}}&access_token=${encodeURIComponent(token)}`);
      calls++;
      const j = await r.json();
      if (j.error) {
        if (/reduce the amount of data/i.test(j.error.message || '') && step > 3) { step = Math.ceil(step / 2); continue; }
        return out({ reason: 'graph ' + (j.error.code || '') }, 502);
      }
      const m = j.business_discovery?.media || {};
      const data = m.data || [];
      hit = data.find((x: any) => (row.media_id && String(x.id) === String(row.media_id)) || keyOf(x.permalink) === code) || null;
      seen += data.length;
      const next = m.paging?.cursors?.after;
      if (!next || !data.length) break;
      cursor = next;
      if (usage(r.headers) >= 95) break;
    }
    if (!hit) return out({ reason: 'not found', calls }, 404);
    const kids = (hit.children?.data || []).slice(0, 20).filter((k: any) => img(k));
    const upd: any = { u: img(hit) || row.u };
    if (kids.length > 1) { upd.c = kids.map(img); upd.mi = kids.map((k: any) => ({ id: k.id ? String(k.id) : null, u: img(k), ty: k.media_type })); upd.n = kids.length; }
    if (hit.media_type === 'VIDEO' && hit.media_url) upd.v = hit.media_url;
    await fetch(`${SB}/rest/v1/ig_media?post_key=eq.${code}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(upd) });
    return out({ ...row, ...upd, pc: undefined, calls });
  } catch (e) {
    return out({ reason: 'error ' + String((e as Error)?.message || e).slice(0, 80) }, 500);
  }
});
