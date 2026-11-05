const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
// The client must only choose routes actually produced by the builder.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=app.indexOf('const _songShareRoutes='),end=app.indexOf('\n}',app.indexOf('function _seoUrlForSongList',start))+2;
const client={GROUPS:{Alpha:{}},_discoFileKey:g=>g,
  _seoUrlForGroup:g=>`https://example.test/g/${g}/`,
  _seoUrlForMember:a=>`https://example.test/g/Alpha/${a.id}/`};
vm.createContext(client);
vm.runInContext(app.slice(start,end)+`\n_songShareRoutes.set('Alpha',{g:['snowysummer','한 곡'],m:{member:['snowysummer']}});`,client);
assert.equal(client._seoUrlForSongList('Alpha:snowysummer',null),'https://example.test/g/Alpha/s/snowysummer/');
assert.equal(client._seoUrlForSongList('Alpha:snowysummer',{id:'member'}),'https://example.test/g/Alpha/member/s/snowysummer/');
assert.equal(client._seoUrlForSongList('Alpha:snowysummer',{id:'absent'}),'https://example.test/g/Alpha/s/snowysummer/');
assert.equal(client._seoUrlForSongList('Alpha:unpublished',null),null);
assert.equal(client._seoUrlForSongList('Unknown:snowysummer',null),null);
assert.equal(client._seoUrlForSongList('Alpha:한 곡',null),'https://example.test/g/Alpha/s/'+encodeURIComponent('한 곡')+'/');
// Native share text must name the song; ordinary card sharing stays unchanged.
let payload, copied;
client.navigator={share:p=>{payload=p;return Promise.resolve();}};
client._gaEvent=()=>{};client._isTouchPrimary=()=>true;client._copyShareLink=u=>{copied=u;};
const shareStart=app.indexOf('function _shareCurrentView(');
vm.runInContext(app.slice(shareStart,app.indexOf('\n}',shareStart)+2),client);
client._shareCurrentView('https://example.test/song/','Snowy Summer 무대·직캠 모음','list','Snowy Summer 무대·직캠 모음');
assert.equal(payload.text,'Snowy Summer 무대·직캠 모음');
assert.equal(payload.url,'https://example.test/song/');
client._shareCurrentView('https://example.test/group/','그룹','group');
assert.equal(Object.hasOwn(payload,'text'),false);
client._isTouchPrimary=()=>false;
client._shareCurrentView('https://example.test/song/','곡','list','곡 모음');
assert.equal(copied,'https://example.test/song/');
// The static page forwards the whole hash; a normal SEO visit stays on the page.
const builder=fs.readFileSync(path.join(root,'build_group_pages.js'),'utf8');
const fwd=builder.match(/const LIST_FWD = ([^\n]+);\r?\n/);
assert.ok(fwd);
const script=vm.runInNewContext(fwd[1],{SITE:'https://example.test'}).replace(/^<script>|<\/script>$/g,'');
for(const hash of ['#g=Alpha&vf=all&vk=Alpha:snowysummer&vkl=Snowy%20Summer&vs=popular&vo=1','#g=Alpha']){
  let target;vm.runInNewContext(script,{location:{hash,replace:u=>{target=u;}}});
  assert.equal(target,hash.includes('&vf=')?'https://example.test/'+hash:undefined);
}
console.log('✅ Published-path fallback and native/desktop share payloads');
(async()=>{
  let calls=0,resolve;
  client.AbortController=AbortController;client.setTimeout=setTimeout;client.clearTimeout=clearTimeout;
  client.fetch=()=>{calls++;return new Promise(r=>{resolve=r;});};
  const first=client._ensureSongShareRoutes('Beta'),second=client._ensureSongShareRoutes('Beta');
  assert.equal(first,second,'concurrent selection shares one request');assert.equal(calls,1);
  resolve({ok:true,json:async()=>({g:['snow'],m:{}})});await first;
  await client._ensureSongShareRoutes('Beta');assert.equal(calls,1,'successful route list is reused');
  client.fetch=async()=>{calls++;return {ok:false};};
  await client._ensureSongShareRoutes('Failed');await client._ensureSongShareRoutes('Failed');
  assert.equal(calls,3,'failed lookup can retry rather than caching a false route');
  console.log('✅ Route prefetch deduplication, cache and retry');
})().catch(e=>{console.error(e);process.exitCode=1;});
