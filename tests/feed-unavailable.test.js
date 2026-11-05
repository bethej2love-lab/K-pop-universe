// Execute the three real feed query factories against available/unavailable rows.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const rows=[{id:'available',unavailable_at:null},{id:'gone',unavailable_at:'2026-11-03T14:06:02Z'}];
function run(code,expression){
  const q={data:rows.slice(),select(){return this},gte(){return this},or(){return this},in(){return this},order(){return this},limit(){return this},is(k,value){this.data=this.data.filter(r=>r[k]===value);return this}};
  const context={sb:{from:()=>q},_YT_TABLE:'yt_channel_videos',_FEED_COLS:()=>'*',_applyLiveExclude:q=>q,_FEED_TREND_DAYS:7,_hasPubTs:true,since:'2026-11-01',queryGkos:new Set(['악뮤']),_gMem:['이수현(악뮤)'],_gGrp:[],_pgArr:()=>'{"이수현(악뮤)"}'};
  vm.runInNewContext(code+'\n'+expression,context);
  return q.data.map(r=>r.id);
}
const start=source.indexOf('function _feedTrendQuery(){'),end=source.indexOf('function _prefetchFeedTrend()',start);
assert(start>=0&&end>start);
const own=source.match(/const _q=\(\)=>_applyLiveExclude\(sb\.from\(_YT_TABLE\)\.select\(_FEED_COLS\(\)\)\)[\s\S]*?\.limit\(400\);/);
const guest=source.match(/const _qGuest=\(_gMem\.length\|\|_gGrp\.length\)[\s\S]*?\.limit\(200\):null;/);
assert(own&&guest,'Both For You query factories must be located');
for(const[name,code,call]of [['Discover',source.slice(start,end),'_feedTrendQuery();'],['For You owner',own[0],'_q();'],['For You guest',guest[0],'_qGuest();']]){
  assert.deepEqual(run(code,call),['available'],name+': unavailable excluded, normal row preserved');
  // Negative control: the pre-fix query leaks the known unavailable fixture.
  assert.deepEqual(run(code.replaceAll(".is('unavailable_at',null)",''),call),['available','gone'],name+': reproduces original failure');
  console.log('PASS '+name);
}
