// 네트워크 응답 순서와 무관하게 마지막 누가/정렬 선택을 보존한다. 실제 함수를 통제된 응답으로 실행.
const fs=require('fs'),vm=require('vm'),assert=require('assert');const src=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const start=src.indexOf('async function _programFacetView('),end=src.indexOf('\n}',start)+2,fn=src.slice(start,end);
function fixture(){
 const pending=[],views=[];const box={currentLang:'ko',favGroups:new Set(['에스파']),favMembers:new Set(),GROUPS:{에스파:{en:'aespa'},아이브:{en:'IVE'}},
 _pgFilterVal:x=>x,_filterBannedVideos:x=>x,_PF_FAVHIT:v=>v.group_ko==='에스파',_PF_INGROUP:(v,g)=>v.group_ko===g,
 _openFeedListOverlay:(label,sub,rows,ctx)=>views.push({sub,rows,facets:ctx.facets})};
 vm.createContext(box);vm.runInContext(fn,box);
 const st={label:'프로그램',tops:['에스파','아이브'],rows:[],cache:new Map(),toSongs:x=>x,mkQ:sort=>{
  let finish;const p=new Promise(r=>finish=r);p.or=()=>p;pending.push({sort,finish});return p;
 }};
 return {st,pending,views,run:(w,s)=>box._programFacetView(st,w,s)};
}
const rows=[{id:'a',group_ko:'에스파',published_at:'2026-10-01',view_count:3},{id:'b',group_ko:'아이브',published_at:'2026-10-02',view_count:5}];
(async()=>{
 let f=fixture();const old=f.run('fav','latest'),newer=f.run('all','popular');
 f.pending[1].finish({data:rows});await newer;f.pending[0].finish({data:rows});await old;
 assert.equal(f.views.at(-1).facets[0].sel,'all','늦은 과거 응답이 마지막 누가 선택을 덮음');
 assert.equal(f.views.at(-1).facets[1].sel,'popular');
 f=fixture();f.st.cache.set('all|latest',rows);await f.run('all','latest');const shown=f.views[0];
 const who=shown.facets[0].onPick('fav');const sort=shown.facets[1].onPick('popular');
 f.pending[1].finish({data:rows});await sort;f.pending[0].finish({data:rows});await who;
 assert.equal(f.views.at(-1).facets[0].sel,'fav','정렬이 진행 중인 누가 선택을 전체로 되돌림');
 assert.equal(f.views.at(-1).facets[1].sel,'popular');assert.equal(f.views.at(-1).rows.length,1);
 f=fixture();f.st.cache.set('all|latest',rows);await f.run('all','latest');const initial=f.views[0];
 const sorting=initial.facets[1].onPick('popular'),picking=initial.facets[0].onPick('fav');
 assert.equal(f.pending[1].sort,'popular','누가 선택이 진행 중인 정렬을 최신순으로 되돌림');
 f.pending[1].finish({data:rows});await picking;f.pending[0].finish({data:rows});await sorting;
 assert.equal(f.views.at(-1).facets[0].sel,'fav');assert.equal(f.views.at(-1).facets[1].sel,'popular');
 console.log('프로그램 필터: 늦은 응답 차단·누가→정렬·정렬→누가 마지막 선택 보존 통과');
})().catch(e=>{console.error(e);process.exitCode=1;});
