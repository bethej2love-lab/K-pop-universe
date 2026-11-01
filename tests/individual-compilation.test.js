// Actual automatic upsert boundary, scripted DB; no production API calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'admin.js'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
function fn(s,name){const a=s.indexOf('function '+name+'(');if(a<0)return '';return s.slice(s.slice(a-6,a)==='async '?a-6:a,s.indexOf('\n}',a)+2);}
const example='[ALLIVE] 5세대 하이브 아이돌 총집합✨ 라이브 모음집 | #MBCRADIO #CORTIS #ILLIT #TUIDE #SANTOSBRAVOS | MBC 250909 방송 외';
const base={id:'synthetic',title:example,group_ko:'코르티스',members:[],with_groups:['아일릿','튜이드'],with_members:[],tags_manual:false,content_flag:null};
async function run(row){let sent,options;const ctx={GROUPS:JSON.parse(fs.readFileSync(path.join(root,'groups.json'))),_YT_TABLE:'synthetic',_ytHasSourceCols:true,_ytHasPubTs:true,sb:{from:()=>({upsert:async(rows,opts)=>{sent=rows;options=opts;return {error:null};}})}};
 vm.createContext(ctx);vm.runInContext(fn(app,'_flagPatch')+'\n'+fn(src,'_autoIndividualAppearance')+'\n'+fn(src,'_ytUpsertVideos'),ctx);await ctx._ytUpsertVideos([row],{onConflict:'id',ignoreDuplicates:true});return {row:sent[0],options};}
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const title of [example,'BTS TXT 라이브 모음집','BTS TXT 무대 모아보기','BTS TXT LIVE COMPILATION'])await check('separate-stage compilation: '+title.slice(0,35),async()=>{const r=await run({...base,title});assert.equal(r.row.content_flag,'개별출연');assert.equal(r.row.flag_source,'auto');assert(r.row.flagged_at);});
 for(const title of ['5세대 하이브 아이돌 총집합 #CORTIS #ILLIT','BTS TXT 합동 무대 모음집','BTS TXT 콜라보 라이브 모음집','BTS X TXT 라이브 모음집','BTS TXT DUET LIVE COMPILATION','BTS with TXT 라이브 모음집'])await check('ambiguous/joint performance stays unchanged: '+title,async()=>{const r=await run({...base,title});assert.equal(r.row.content_flag,null);});
 await check('single-group best-of keeps collaboration semantics',async()=>{assert.equal((await run({...base,with_groups:[]})).row.content_flag,null);});
 await check('unrecognized second name is not a second registered group',async()=>{assert.equal((await run({...base,with_groups:['unregistered fixture']})).row.content_flag,null);});
 await check('explicit guest member group counts as a second group',async()=>{assert.equal((await run({...base,with_groups:[],with_members:['원희(아일릿)']})).row.content_flag,'개별출연');});
 for(const flag of ['무관','hidden','기타','보류'])await check('existing flag preserved: '+flag,async()=>{assert.equal((await run({...base,content_flag:flag})).row.content_flag,flag);});
 await check('human normal confirmation is preserved',async()=>{assert.equal((await run({...base,tags_manual:true})).row.content_flag,null);});
 await check('existing human individual flag is preserved',async()=>{const r=await run({...base,content_flag:'개별출연',flag_source:'manual'});assert.equal(r.row.flag_source,'manual');});
 await check('source input, tags and duplicate policy preserved',async()=>{const original=JSON.stringify(base),r=await run(base);assert.equal(JSON.stringify(base),original);assert.deepEqual(r.row.members,base.members);assert.deepEqual(r.row.with_groups,base.with_groups);assert.equal(r.options.ignoreDuplicates,true);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
