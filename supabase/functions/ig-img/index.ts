// 인스타 게시물 이미지 중계(2026-11-13) — 게시물 코드(shortcode)만으로 그 게시물의 대표 사진을 돌려준다.
// 왜: API가 주는 cdninstagram 주소는 4~5일이면 만료(oe=)돼서 지난 게시물·태깅한 사진이 깨졌다. instagram.com/p/{code}/media/는
//     매번 새 주소로 넘겨 주지만, 그 경로와 넘겨 준 이미지 둘 다 Cross-Origin-Resource-Policy: same-origin이라 브라우저 <img>가 막힌다
//     → 여기서 이미지를 받아 그대로 전달한다(302만 돌려주는 방식은 CDN 이미지에서 다시 막혔다).
// 호출: /functions/v1/ig-img?c={shortcode}&s=t|m|l  (t 150px · m 320px · l 1080px). 격자는 t, 사진 창은 l.
// 브라우저 캐시 7일(같은 게시물 사진은 안 바뀐다).
// 배포: supabase functions deploy ig-img --no-verify-jwt  (<img>가 인증 없이 부르므로 JWT 검사 끔)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CDN = /^https:\/\/[a-z0-9.-]+\.(cdninstagram\.com|fbcdn\.net)\//;
Deno.serve(async (req) => {
  const u = new URL(req.url);
  const code = (u.searchParams.get('c') || '').match(/^[A-Za-z0-9_-]{5,40}$/)?.[0];
  const s = u.searchParams.get('s');
  const size = s === 't' || s === 'l' ? s : 'm';
  if (!code) return new Response('bad request', { status: 400 });
  try {
    const r = await fetch(`https://www.instagram.com/p/${code}/media/?size=${size}`, { redirect: 'manual', headers: { 'User-Agent': UA } });
    const loc = r.headers.get('location') || '';
    if (r.status >= 300 && r.status < 400 && CDN.test(loc)) {
      const img = await fetch(loc, { headers: { 'User-Agent': UA } });
      if (img.ok && /^image\//.test(img.headers.get('content-type') || '')) {
        return new Response(img.body, { status: 200, headers: {
          'Content-Type': img.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=604800, immutable',
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Resource-Policy': 'cross-origin',
        } });
      }
    }
    return new Response('not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=900', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin', 'X-Upstream': String(r.status) } });
  } catch (_e) {
    return new Response('upstream error', { status: 502, headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' } });
  }
});
