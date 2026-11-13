// 인스타 게시물 이미지 중계(2026-11-13) — 게시물 코드(shortcode)만으로 그때그때 살아 있는 이미지 주소로 넘긴다.
// 왜: API가 주는 cdninstagram 주소는 4~5일이면 만료(oe=)돼서 지난 게시물·태깅한 사진이 깨졌다. instagram.com/p/{code}/media/는
//     매번 새 주소로 넘겨 주지만 응답에 Cross-Origin-Resource-Policy: same-origin이 붙어 브라우저 <img>가 막힌다 → 여기서 받아 302만 돌려준다.
// 호출: /functions/v1/ig-img?c={shortcode}&s=t|m|l  (t 150px · m 320px · l 1080px). 인스타 CDN 주소로만 넘긴다.
// 배포: supabase functions deploy ig-img --no-verify-jwt  (<img>가 인증 없이 부르므로 JWT 검사 끔)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
Deno.serve(async (req) => {
  const u = new URL(req.url);
  const code = (u.searchParams.get('c') || '').match(/^[A-Za-z0-9_-]{5,40}$/)?.[0];
  const s = u.searchParams.get('s');
  const size = s === 't' || s === 'l' ? s : 'm';
  if (!code) return new Response('bad request', { status: 400 });
  try {
    const r = await fetch(`https://www.instagram.com/p/${code}/media/?size=${size}`, { redirect: 'manual', headers: { 'User-Agent': UA } });
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && /^https:\/\/[a-z0-9.-]+\.(cdninstagram\.com|fbcdn\.net)\//.test(loc)) {
      return new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'public, max-age=21600', 'Access-Control-Allow-Origin': '*' } });
    }
    return new Response('not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=900', 'X-Upstream': String(r.status) } });
  } catch (_e) {
    return new Response('upstream error', { status: 502 });
  }
});
