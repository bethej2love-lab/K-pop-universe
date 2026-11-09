// Read-only audit loader: sources come from the pinned Git revision; no application writes.
const cp=require('child_process'),fs=require('fs'),path=require('path');
const REV='e64f24f9cd';const read=p=>cp.execFileSync('git',['show',REV+':'+p],{encoding:'utf8',maxBuffer:50000000});
const files={};for(const p of ['admin.js','app.js','shared.js','artists.json','groups.json'])files[p]=read(p);
function ext(src,name){let start=src.indexOf('function '+name+'(');if(start<0)throw Error(name);let i=src.indexOf('{',start),n=0;for(;i<src.length;i++){if(src[i]==='{')n++;if(src[i]==='}'&&!--n)return src.slice(start,i+1)}throw Error('function end '+name)}
let loader=read('tools/m2_harness.js');const helpers=['_groupEndDate','_disbandCutoffDate','_atmRosterFor'];
loader=loader.replace('  const src=`',helpers.map(n=>'  pieces.push('+JSON.stringify(ext(n==='_groupEndDate'?files['app.js']:files['admin.js'],n))+');').join('\n')+'\n  const src=`');
loader=loader.replace('module.exports={_m2ParseTitle,','module.exports={_atmLeftBefore,_atmRosterFor,_groupEndDate,_disbandCutoffDate,_m2ParseTitle,');
const vf=Object.assign({},fs,{readFileSync(p,e){let k=path.basename(String(p));return k in files?files[k]:fs.readFileSync(p,e)}});
const m={exports:{}};new Function('module','exports','require','__dirname',loader)(m,m.exports,n=>n==='fs'?vf:require(n),path.join(process.cwd(),'tools'));
const H=m.exports.load();const names=['BLUE','Love','고우리','김채원','레오','루나','루비','리세','리오','릴리','먼데이','메이','미래','미아','베이비','소울','솔라','써머','아이엠','웨이','위시','이진','이현','조이','지디','태양','하나','하루'];names.forEach(n=>H._ATM_DYNAMIC_HASHTAG_NAMES.add(n));
module.exports={H,REV,read,ext,files,rules:{whitelist:names,exceptions:[],verifiedDate:'2026-11-05'},addedActualHelpers:helpers};
