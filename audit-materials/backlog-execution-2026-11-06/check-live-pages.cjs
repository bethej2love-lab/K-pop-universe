const fs=require('fs'),assert=require('node:assert/strict');
const cases=[
 ['en/g/cortis/seonghyeon/',['CORTIS','코르티스','SEONGHYEON','성현']],
 ['g/코르티스/성현/',['CORTIS','코르티스','SEONGHYEON','성현']],
 ['en/g/secret-number/',['4-member']],
 ['en/g/secret/',['is a 3-member']],
 ['en/g/alpha-drive-one/',['8-member']],
 ['en/g/alpha-drive-one/gunwoo/',['On hiatus']],
 ['en/member/dia/',['DIA','디아']],
 ['member/디아/',['DIA','디아']],
 ['en/g/btob/a/borntobeat/',['2012.04.03']],
 ['en/g/cnblue/a/trigger/',['noindex,follow','https://kpop-universe.kr/en/g/cnblue/']],
 ['en/g/oh-my-girl/mimi/credits/',['Mimi']],
 ['en/g/ftisland/lee-jaejin/credits/',['Jaejin']]
];
(async()=>{const out=[];for(const [route,want] of cases){const url='https://kpop-universe.kr/'+route,r=await fetch(url+'?audit='+Date.now(),{signal:AbortSignal.timeout(30000)}),s=await r.text();assert.equal(r.status,200,route);for(const w of want)assert.ok(s.toLowerCase().includes(w.toLowerCase()),route+' missing '+w);if(route.includes('gunwoo'))assert.ok(!s.includes('former K-pop idol'));if(route.includes('seonghyeon')||route.includes('성현')){const title=s.match(/<title>(.*?)<\/title>/s)?.[1]||'';for(const w of want)assert.ok(title.toLowerCase().includes(w.toLowerCase()),'title '+route+' '+w);}if(route==='member/디아/'||route==='en/member/dia/')assert.ok(s.includes('UdDVIYATjtk')&&!s.includes('C48F3OEd_fU'),route+' identity-specific image');const canonical=s.match(/rel="canonical" href="([^"]+)/)?.[1];assert(canonical,route+' canonical');if(!route.endsWith('/a/trigger/'))assert(s.includes('hreflang="ko"')&&s.includes('hreflang="en"'));else assert.equal(canonical,'https://kpop-universe.kr/en/g/cnblue/');out.push({url,status:r.status,title:s.match(/<title>(.*?)<\/title>/s)?.[1],h1:s.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1],canonical,checks:want});console.log('PASS',route);}fs.writeFileSync(__dirname+'/live-page-verification.json',JSON.stringify({at:new Date().toISOString(),pages:out},null,2)+String.fromCharCode(10));})().catch(e=>{console.error(e.message);process.exitCode=1;});
