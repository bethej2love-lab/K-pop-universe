// draft에 커뮤니티 앱 그룹 주소(commLinks) 붙이기 — 나무위키 문서의 실제 링크에서
const fs=require('fs');const [,,draftF,rawF,outF]=process.argv;
const d=JSON.parse(fs.readFileSync(draftF,'utf8')),raw=JSON.parse(fs.readFileSync(rawF,'utf8'));
for(const r of d){const L=(raw[r.g]&&raw[r.g].links)||[];const c={};
  const b=L.find(u=>/link\.berriz\.in\/web\/main\//.test(u));if(b)c.berriz=b;
  const m=L.find(u=>/artist\.mnetplus\.world\/main\/stg\/[^/]+/.test(u));if(m)c.mnetplus=m.replace(/(stg\/[^/]+).*/,'$1');
  const s=L.find(u=>/^https?:\/\/[a-z0-9-]+\.bstage\.in\/?$/.test(u));if(s)c.bstage=s;
  r.commLinks=c;}
fs.writeFileSync(outF,JSON.stringify(d,null,1));
