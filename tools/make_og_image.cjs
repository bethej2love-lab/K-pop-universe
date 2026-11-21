// 공유 이미지(og-image.png, 1200×630) 생성 — 2026-11-21 사용자가 시안 3종(A 빛 하나·B 별자리·C 궤도) 중 **C 궤도**를 고름.
// 별·행성 장식 없이 가는 동심 호(데뷔 연도 궤도)와 그 위의 빛 몇 점, 글자는 가운데. 글꼴 Pretendard(jsDelivr).
// 실행: node tools/make_og_image.cjs  (Playwright 필요. 프록시 환경이면 HTTPS_PROXY를 읽는다) → og-image.png를 덮어쓴다.
const {chromium}=require('playwright');const path=require('path');
const FONT='<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">';
const base='*{margin:0;padding:0;box-sizing:border-box}html,body{width:1200px;height:630px;overflow:hidden;background:#07080c;font-family:Pretendard,system-ui,sans-serif;color:#eef2ff;-webkit-font-smoothing:antialiased}';
const body=`<style>${base}
.bg{position:absolute;inset:0;background:radial-gradient(520px 520px at 600px 760px,rgba(138,176,255,.26),transparent 70%),#07080c}
svg{position:absolute;left:0;top:0}
.t{position:absolute;left:0;right:0;top:214px;text-align:center}
.n{font-size:72px;font-weight:700;letter-spacing:-.02em;line-height:1}
.n b{color:#8ab0ff;font-weight:700}
.s{margin-top:24px;font-size:28px;color:rgba(214,224,250,.7)}
</style><div class="bg"></div>
<svg width="1200" height="630" viewBox="0 0 1200 630"><defs><filter id="g" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="6"/></filter></defs>
<g fill="none" stroke="rgba(190,208,255,.14)" stroke-width="1.2">${[300,430,560,700,850].map(r=>`<circle cx="600" cy="900" r="${r}"/>`).join('')}</g>
${[[330,640,'#ffb3d1',6,0],[212,470,'#8ab0ff',8,0],[905,512,'#9fe3c8',7,0],[1075,360,'#ffd98a',6,0],[480,96,'#c9b8ff',5,0],[742,62,'#8ab0ff',6,0]].map(([x,y,c,r])=>`<circle cx="${x}" cy="${y}" r="${r*2.6}" fill="${c}" opacity=".32" filter="url(#g)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('')}
</svg>
<div class="t"><div class="n">K-POP <b>UNIVERSE</b></div><div class="s">Find your place in K-pop</div></div>`;
(async()=>{
  const opt={};if(process.env.HTTPS_PROXY){const px=new URL(process.env.HTTPS_PROXY);opt.proxy={server:px.origin,username:decodeURIComponent(px.username),password:decodeURIComponent(px.password)};}
  const b=await chromium.launch(opt);const pg=await b.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await pg.setContent('<!doctype html><html><head><meta charset="utf-8">'+FONT+'</head><body>'+body+'</body></html>',{waitUntil:'networkidle'});
  await pg.evaluate(()=>document.fonts.ready);await pg.waitForTimeout(400);
  await pg.screenshot({path:path.join(__dirname,'..','og-image.png')});await b.close();
})();
