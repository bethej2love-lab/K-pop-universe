const fs=require('fs'),path=require('path');const D=process.argv[2];
const list=fs.readFileSync(path.join(D,'list.tsv'),'utf8').trim().split('\n').map(l=>l.split('\t'));
const all={},per={};
list.forEach(([k],i)=>{const f=path.join(D,'g_'+(i+1)+'.html');if(!fs.existsSync(f))return;const h=fs.readFileSync(f,'utf8');
  const cats=[...new Set([...h.matchAll(/href=['"]\/w\/(?:%EB%B6%84%EB%A5%98|분류):([^'"#?]+)['"]/g)].map(m=>{try{return decodeURIComponent(m[1])}catch(e){return m[1]}}))];
  const pf=cats.filter(c=>/입점|Weverse|위버스|bubble|버블|fromm|프롬|Berriz|베리즈|b\.stage|Phoning|포닝|UNIVERSE|유니버스|DM|Lysn|리슨|플러스챗|Plus|채티|POCKETDOLS|위드팬|Cosmo|HIAND|FANS|DAY OFF|2GATHR|Mnet Plus/i.test(c));
  per[k]=pf;pf.forEach(c=>all[c]=(all[c]||0)+1);});
fs.writeFileSync(path.join(D,'cats.json'),JSON.stringify(per,null,1));
console.log(Object.entries(all).sort((a,b)=>b[1]-a[1]).map(([c,n])=>n+'\t'+c).join('\n'));
