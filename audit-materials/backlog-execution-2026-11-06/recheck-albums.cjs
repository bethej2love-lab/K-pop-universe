const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const strip=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
(async()=>{const out=[];for(const id of ['2096628','2104986','11078855','11081490','11052140']){
 const url='https://www.melon.com/album/detail.htm?albumId='+id,r=await fetch(url),s=await r.text();assert.equal(r.status,200);assert(!/페이지를 찾을 수 없습니다|잘못된 경로로 접근/.test(s));
 const i=s.indexOf('앨범명'),tracks=(s.match(/<tr[\s\S]*?<\/tr>/g)||[]).flatMap(t=>{const sid=t.match(/goSongDetail\('?(\d+)/)?.[1]||t.match(/data-song-no="(\d+)"/)?.[1],title=t.match(/title="([^"]+) 곡정보/)?.[1];return sid&&title?[{id:sid,title,isTitle:/bullet_icons title/.test(t)}]:[];});assert(tracks.length,id);
 out.push({id,url,status:r.status,meta:strip(s.slice(i,i+1400)),tracks});}
 fs.writeFileSync(path.join(__dirname,'official-albums.json'),JSON.stringify(out,null,2)+'\n');console.log(out.map(x=>({id:x.id,meta:x.meta.slice(0,125),tracks:x.tracks})));
})().catch(e=>{console.error(e);process.exitCode=1;});
