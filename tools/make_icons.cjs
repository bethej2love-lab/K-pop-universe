// 앱 아이콘(홈 화면·파비콘) 생성 — 2026-11-21 사용자가 고리 달린 구 시안 중 **'가 미드나잇'**을 기본으로 고름
// ("특수한 상황에 따라 행성 색깔을 바꿀 수도 있겠지, 기본은 가"). 색만 바꾸려면 아래 PALETTES에 한 벌 추가하고 --palette=이름 으로 실행.
// 형태: 고리는 굵은 선이 아니라 얇은 띠(바깥 타원 − 안쪽 타원), 구 뒤쪽은 흐리게·앞쪽은 밝게 겹치고 양 끝은 사라진다. 구는 왼쪽 위에서 빛이 드는 음영.
// 실행: node tools/make_icons.cjs [--palette=midnight] → icons/ 4개(apple-touch-icon-180, icon-192, icon-512, icon-maskable-512)를 덮어쓴다. Playwright 필요.
const {chromium}=require('playwright');const path=require('path');
const PALETTES={
  midnight:{bg0:'#16203c',bg1:'#0a0e1c',bg2:'#05060b',o1:'#eaf1ff',o2:'#9dbdff',o3:'#4f6fd0',r1:'#b9ccff',r2:'#ffffff',glow:'#7fa2ff'}, // 기본(가)
  rose:{bg0:'#2a1630',bg1:'#120b18',bg2:'#08060b',o1:'#ffe3ea',o2:'#ff8fb4',o3:'#a05bd8',r1:'#ffc2d6',r2:'#fff3f7',glow:'#ff7fb0'},       // 시안 '다' — 기념일 등
};
const name=(process.argv.find(a=>a.startsWith('--palette='))||'').split('=')[1]||'midnight';
const P=PALETTES[name];if(!P){console.error('없는 팔레트: '+name);process.exit(1);}
function svg(size,scale){ // scale<1 = 마스커블(안전 영역 안으로 줄임)
  const cx=256,cy=262,R=96,rx=206,ry=62,w=13,rot=-20;
  const band=(a,b,c,d)=>`M${cx-a} ${cy} A${a} ${b} 0 1 0 ${cx+a} ${cy} A${a} ${b} 0 1 0 ${cx-a} ${cy} Z M${cx-c} ${cy} A${c} ${d} 0 1 1 ${cx+c} ${cy} A${c} ${d} 0 1 1 ${cx-c} ${cy} Z`;
  const ring=band(rx,ry,rx-w*1.15,ry-w*0.62);
  const tr=scale&&scale!==1?` transform="translate(${256*(1-scale)} ${256*(1-scale)}) scale(${scale})"`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><defs>
  <radialGradient id="b" cx="50%" cy="20%" r="95%"><stop offset="0" stop-color="${P.bg0}"/><stop offset=".6" stop-color="${P.bg1}"/><stop offset="1" stop-color="${P.bg2}"/></radialGradient>
  <radialGradient id="orb" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${P.o1}"/><stop offset=".45" stop-color="${P.o2}"/><stop offset="1" stop-color="${P.o3}"/></radialGradient>
  <linearGradient id="rg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.r1}" stop-opacity="0"/><stop offset=".16" stop-color="${P.r1}" stop-opacity=".85"/><stop offset=".5" stop-color="${P.r2}"/><stop offset=".84" stop-color="${P.r1}" stop-opacity=".85"/><stop offset="1" stop-color="${P.r1}" stop-opacity="0"/></linearGradient>
  <clipPath id="back"><rect x="0" y="0" width="512" height="${cy}"/></clipPath><clipPath id="front"><rect x="0" y="${cy}" width="512" height="${512-cy}"/></clipPath>
  <filter id="soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="30"/></filter>
  <filter id="sh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <rect width="512" height="512" fill="url(#b)"/>
  <g${tr}>
  <circle cx="${cx}" cy="${cy}" r="${R*1.5}" fill="${P.glow}" opacity=".34" filter="url(#soft)"/>
  <g transform="rotate(${rot} ${cx} ${cy})"><g clip-path="url(#back)" opacity=".5"><path d="${ring}" fill="url(#rg)" fill-rule="evenodd"/></g></g>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#orb)"/>
  <g transform="rotate(${rot} ${cx} ${cy})"><g clip-path="url(#front)"><path d="${ring}" fill="rgba(0,0,0,.35)" fill-rule="evenodd" transform="translate(0 9)" filter="url(#sh)"/><path d="${ring}" fill="url(#rg)" fill-rule="evenodd"/></g></g>
  </g></svg>`;
}
(async()=>{
  const b=await chromium.launch();
  for(const [file,size,scale] of [['apple-touch-icon-180.png',180,1],['icon-192.png',192,1],['icon-512.png',512,1],['icon-maskable-512.png',512,0.74]]){
    const p=await b.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    await p.setContent(`<body style="margin:0;background:${P.bg2}">${svg(size,scale)}</body>`);await p.waitForTimeout(150);
    await p.screenshot({path:path.join(__dirname,'..','icons',file),clip:{x:0,y:0,width:size,height:size}});await p.close();
    console.log('wrote icons/'+file);
  }
  await b.close();
})();
