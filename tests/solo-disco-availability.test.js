// 실제 생성된 slim → 앱 lazy loader → 실제 disco 파일. 빈 솔로는 404 요청 없이 빈 목록,
// 앨범/유닛이 있는 솔로는 원래 자기 파일을 읽는지 검증한다.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const artists=read('artists.slim.json'),original=read('artists.json'),groups=read('groups.slim.json');
const src=fs.readFileSync(path.join(root,'app.js'),'utf8');
const key=src.match(/const _discoFileKey=[^\n]+/)[0];
const functions=src.slice(src.indexOf('let _soloDupKeys='),src.indexOf('function _ensureTracksIndex('));
let requests=[];const ctx={ARTISTS:artists,GROUPS:groups,fetch:async url=>{
  requests.push(url);const file=path.join(root,decodeURIComponent(url));
  assert(fs.existsSync(file),'앱이 없는 파일을 요청: '+url);
  return {ok:true,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
}};
vm.createContext(ctx);vm.runInContext(key+'\n'+functions,ctx);
(async()=>{
  let empty=0,loaded=0;
  for(const a of artists.filter(a=>!groups[a.group.ko])){
    const o=original.find(x=>x.id===a.id),has=!!(o.discography?.length||o.unitDiscography?.length),before=requests.length;
    if(!has){assert.deepEqual(a.discography,[],'빈 솔로 표시 누락 '+a.id);assert.deepEqual(a.unitDiscography,[]);}
    await ctx._ensureMemberDisco(a);
    if(!has){assert.equal(requests.length,before);empty++;}
    else {assert.equal(requests.length,before+1);loaded++;}
    assert.deepEqual(JSON.parse(JSON.stringify(a.discography)),o.discography||[],a.id+' 앨범 유실/오연결');
    assert.deepEqual(JSON.parse(JSON.stringify(a.unitDiscography)),o.unitDiscography||[],a.id+' 유닛 유실/오연결');
    await ctx._ensureMemberDisco(a);assert.equal(requests.length,before+(has?1:0),'중복 요청 '+a.id);
  }
  assert(empty>0&&loaded>0);
  console.log(`솔로 ${empty+loaded}개 등록행: 빈 목록 ${empty}개 요청0·앨범/유닛 ${loaded}개 자기 파일·재요청0 통과`);
})().catch(e=>{console.error(e);process.exitCode=1;});
