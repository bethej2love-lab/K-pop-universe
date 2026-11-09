// Read-only public HTML audit. No production files or databases are changed.
const fs = require('fs');
const path = require('path');
const routes = ['en/g/riize/', 'en/g/nmixx/', 'en/g/g-i-dle/'];
const strip = s => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
(async () => {
  const out = [];
  for (const route of routes) {
    const url = 'https://kpop-universe.kr/' + route;
    const r = await fetch(url);
    const s = await r.text();
    out.push({url, httpStatus:r.status, title:s.match(/<title>([\s\S]*?)<\/title>/)?.[1], description:s.match(/<meta name="description" content="([^"]*)"/)?.[1], intro:(s.match(/<p class="intro">[\s\S]*?<\/p>/g)||[]).map(strip), members:strip(s.match(/<h2>Members<\/h2>[\s\S]*?<\/ul>/)?.[0]||'')});
  }
  fs.writeFileSync(path.join(__dirname, 'group-headcount-controls-live.json'), JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
