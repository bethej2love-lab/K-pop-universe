// 나무위키 그룹 문서에서 팬 소통 플랫폼 단서를 뽑는다: 플랫폼 도메인 링크 + 키워드 주변 문장.
const fs=require('fs'),path=require('path');
const D=process.argv[2];
const list=fs.readFileSync(path.join(D,'list.tsv'),'utf8').trim().split('\n').map(l=>l.split('\t'));
const DOM=/(weverse\.io|berriz\.in|b\.stage|bstage\.in|dear-u|bubble|fromm|phoning|universe|lysn|plus-?chat|mnetplus|chattie|pocketdols|withfan|2gathr|day-?off|cosmo|fans\.co|churrrrr|hiand)/i;
const KW=/(위버스\s*DM|Weverse\s*DM|DM\s*서비스|버블|bubble|베리즈|Berriz|프롬|fromm|포닝|Phoning|b\.stage|비스테이지|디어유|DearU|리슨|Lysn|UNIVERSE|유니버스|플러스챗|Plus Chat|FANS|채티|Chattie|포켓돌스|POCKETDOLS|위드팬|withfan|투개더|2GATHR|DAY OFF|데이오프|Cosmo|코스모|츄르|Churrrrr|하이앤드|HIAND|위버스|Weverse)/g;
const out={};
list.forEach(([k,u],i)=>{
  const f=path.join(D,'g_'+(i+1)+'.html');
  if(!fs.existsSync(f)){out[k]={err:'nofile'};return;}
  const html=fs.readFileSync(f,'utf8');
  const links=[...new Set([...html.matchAll(/href=['"]([^'"]+)['"]/g)].map(m=>m[1]).filter(h=>/^https?:/.test(h)&&DOM.test(h)&&!/namu\.wiki/.test(h)))];
  const text=html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g,' ').replace(/<img[^>]*alt=['"]([^'"]*)['"][^>]*>/g,' [$1] ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');
  const snips=[];const seen=new Set();
  for(const m of text.matchAll(KW)){
    const s=text.slice(Math.max(0,m.index-70),m.index+90).trim();
    const key=s.slice(40,110);if(seen.has(key))continue;seen.add(key);
    snips.push(s);if(snips.length>=25)break;
  }
  out[k]={bytes:html.length,links,snips};
});
fs.writeFileSync(path.join(D,'platforms_raw.json'),JSON.stringify(out,null,1));
for(const [k,v] of Object.entries(out))console.log(k,'| links:',(v.links||[]).length,'| snips:',(v.snips||[]).length,v.err||'');
