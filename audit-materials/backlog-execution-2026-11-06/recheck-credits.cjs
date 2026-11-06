const fs=require('fs'),assert=require('node:assert/strict');
const d=__dirname+'/',src=fs.readFileSync('tools/melon_credits.mjs','utf8');
const dec=src.slice(src.indexOf('const dec ='),src.indexOf('const norm ='));
const fn=src.slice(src.indexOf('function fetchCredits('),src.indexOf('const A =')).replace('function fetchCredits(','async function fetchCredits(').replace('const html = get(','const html = await get(');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)}),s=await r.text();assert.equal(r.status,200);assert(s.length>400&&!/페이지를 찾을 수 없습니다|잘못된 경로로 접근/.test(s),url);return s;}
const fetchCredits=new Function('get',dec+fn+';return fetchCredits;')(get);
const targets=[['이재진','에프티아일랜드','672431'],['세븐','솔로','33513'],['금조','나인뮤지스','830460'],['빛새온','솔로','1705072'],['미미','오마이걸','857998']];
(async()=>{const out=[];for(const [name,group,aid] of targets){const url='https://www.melon.com/artist/detail.htm?artistId='+aid,html=await get(url);assert(html.includes(name)||html.includes('SE7EN'),name);const i=html.indexOf('활동정보');const title=html.match(/<title>([\s\S]*?)<\/title>/)?.[1];const profile=html.slice(Math.max(0,i-1300),i+2200).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();const lyrics=await fetchCredits(aid,'L'),compose=await fetchCredits(aid,'C');out.push({name,group,source:url,title,profile,aid,lyrics,compose});fs.writeFileSync(d+'credit-official.json',JSON.stringify(out,null,2)+String.fromCharCode(10));console.log(name,aid,lyrics.length,compose.length,profile.slice(0,220));}})().catch(e=>{console.error(e);process.exitCode=1;});
