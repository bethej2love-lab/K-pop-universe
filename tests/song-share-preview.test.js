// Real builder functions, with in-memory output: no database, network or generated-page checkout.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const builder=fs.readFileSync(path.join(root,'build_group_pages.js'),'utf8');
const block=(start,end)=>builder.slice(builder.indexOf(start),builder.indexOf(end,builder.indexOf(start)));
const writes=new Map(),pages=[];
const sandbox={path,ROOT:'/fixture',SITE:'https://example.test',pages,
  groups:{Alpha:{en:'Alpha'},Beta:{en:'Beta'},Empty:{}},
  SONGS:{Alpha:[{b:'snowysummer'}],Beta:[{b:'snowysummer'}]},
  MEMBER_SONGS_BY_SONG:new Map([
    ['Alpha|snowysummer',[{a:{id:'alpha',slug:'shared'}}]],
    ['Beta|snowysummer',[{a:{id:'beta',slug:'shared'}}]]
  ]),songPageCount:0,memberSongPageCount:0,
  songPagePath:(g,b,l)=>`${l}/${g}/s/${b}/`,
  memberSongPagePath:(a,b,l)=>`${l}/${a.slug}/s/${b}/`,
  songLikePageHtml:()=>'<html/>',
  fs:{mkdirSync:()=>{},writeFileSync:(p,v)=>writes.set(p.replace(/\\/g,'/'),v)}
};
vm.createContext(sandbox);
vm.runInContext(block('function buildSongPages()','// ── 멤버×곡 페이지')+'\nbuildSongPages();',sandbox);
assert.deepEqual(JSON.parse(writes.get('/fixture/share_routes/Alpha.json')),{g:['snowysummer'],m:{alpha:[]}});
assert.deepEqual(JSON.parse(writes.get('/fixture/share_routes/Beta.json')),{g:['snowysummer'],m:{beta:['snowysummer']}});
assert.deepEqual(JSON.parse(writes.get('/fixture/share_routes/Empty.json')),{g:[],m:{}});
assert.equal(pages.length,8,'both languages and member pages are still generated');

// Render the real template: preview changes without moving the existing MV hero.
const ctx={SITE:'https://example.test',SONG_CSS_V:4,FANCAM_RE:/직캠|fancam|facecam/i,
  ytThumb:id=>`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  songPagePath:(g,b,l)=>`${l}/${g}/s/${b}/`,
  memberSongPagePath:(a,b,l)=>`${l}/${a.id}/s/${b}/`,
  memberPagePath:(a,l)=>`${l}/${a.id}/`,groupPagePath:(g,l)=>`${l}/${g}/`,
  MEMBER_SONGS_BY_SONG:new Map(),membersOf:()=>[],
  escHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),
  hashEsc:encodeURIComponent,ogImageForGroup:()=>'/default.jpg',
  SEO:{fmtViews:String},languageNav:()=>'',LIST_FWD:'<script>FORWARD_LIST_HASH</script>'};
vm.createContext(ctx);
vm.runInContext(block('function songShareVideo(vids)','// ── 직캠 조회수 순위 페이지'),ctx);
const vids=[{id:'mv',title:'Snowy Summer MV',category:'mv'},
  {id:'teaser',title:'Snowy Summer Teaser',category:'live'},
  {id:'stage',title:'Snowy Summer music show stage',category:'live'}];
const s={b:'snowysummer',title:'Snowy Summer',vids};
const html=ctx.songLikePageHtml({gko:'Alpha',info:{en:'Alpha'},s,lang:'ko',others:[]});
assert.match(html,/og:title" content="Snowy Summer 직캠·무대 모음/);
assert.match(html,/og:image" content="https:\/\/i.ytimg.com\/vi\/stage\/hqdefault.jpg/);
assert.match(html,/class="hero" href="https:\/\/www.youtube.com\/watch\?v=mv"[^>]*><img src="https:\/\/i.ytimg.com\/vi\/mv\/hqdefault.jpg/);
assert.match(html,/FORWARD_LIST_HASH/);
assert.equal(ctx.songShareVideo([{id:'cam',title:'Snowy Summer fancam'}]).id,'cam');
assert.equal(ctx.songShareVideo([vids[0]]).id,'mv','no stage: stay within the selected song');
assert.equal(ctx.songShareVideo([]),undefined);
const memberHtml=ctx.songLikePageHtml({gko:'Alpha',info:{en:'Alpha'},s,lang:'ko',others:[],
  member:{a:{id:'member',name:{ko:'멤버'}},nm:'멤버',nmEn:'Member',vids:[{id:'cam',title:'Snowy Summer fancam'}]}});
assert.match(memberHtml,/og:title" content="멤버 Snowy Summer 직캠 모음/);
assert.match(memberHtml,/og:image" content="https:\/\/i.ytimg.com\/vi\/cam\//);

console.log('✅ Published song routes, song/member OG and unchanged hero');
