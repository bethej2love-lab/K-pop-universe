const fs=require('fs');
const clean=s=>s.replace(/<img[^>]*alt=['"]([^'"]*)['"][^>]*>/g,' ').replace(/<a[^>]*href=['"]#fn[^>]*>[\s\S]*?<\/a>/g,'').replace(/<[^>]+>/g,' ').replace(/&#91;/g,'[').replace(/&#93;/g,']').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const fnTitles=h=>{const m={};for(const x of h.matchAll(/<a[^>]*title=['"]([^'"]*)['"][^>]*href=['"]#fn-([^'"]+)['"]/g))m[x[2]]=x[1];return m;};
const h=fs.readFileSync(process.argv[2],'utf8');
let sec='';const rows=[];
// 섹션 제목 추적 + 표 행
const re=/<h(\d)[^>]*>([\s\S]*?)<\/h\1>|<tr[^>]*>([\s\S]*?)<\/tr>/g;let m;
while((m=re.exec(h))){
  if(m[2]){sec=clean(m[2]).replace(/\[편집\]/,'').trim();continue;}
  const tds=[...m[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
  if(tds.length<2)continue;
  const notes=[...m[3].matchAll(/<a[^>]*title=['"]([^'"]*)['"][^>]*href=['"]#fn/g)].map(x=>x[1]);
  rows.push({sec,cells:tds.map(clean),notes});
}
fs.writeFileSync(process.argv[3],JSON.stringify(rows,null,1));
console.log(rows.length);
