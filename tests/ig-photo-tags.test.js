const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),admin=fs.readFileSync(path.join(root,'admin.js'),'utf8');
const ctx={URL,Map,Date,console,sb:null};vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('const _igPhotoTagsCache='),app.indexOf('function _openIgViewer(')),ctx);
const source={p:'https://www.instagram.com/p/PostAbC_12/?igsh=hello',c:['https://cdn.test/path/photo-a.jpg?oe=old','https://cdn.test/path/photo-b.jpg?oe=old']};
assert.equal(ctx._igPostKey(source.p),'PostAbC_12');
for(const url of ['https://evil.test/p/PostAbC_12/','https://instagram.com.evil.test/p/a/','not-a-url'])assert.equal(ctx._igPostKey(url),null);
const a=ctx._igPhotoIdentity(source,0),b=ctx._igPhotoIdentity(source,1);assert.equal(a.photoKey,'img:photo-a.jpg');
const row={post_key:a.postKey,photo_key:a.photoKey,image_key:a.imageKey,media_id:null,artist_ids:['a0001'],revision:1};
assert.equal(ctx._igPhotoTagRow([row],a),row);assert.equal(ctx._igPhotoTagRow([row],b),null);
const renewed={...source,c:['https://another-cdn.test/new/path/photo-a.jpg?oe=new','https://another-cdn.test/photo-b.jpg?oe=new']};
assert.equal(ctx._igPhotoTagRow([row],ctx._igPhotoIdentity(renewed,0)),row,'CDN host/path/query rotation preserves legacy photo identity');
const ids={...renewed,mi:[{id:'123456',u:renewed.c[0],ty:'IMAGE'},{id:'654321',u:renewed.c[1],ty:'IMAGE'}]};
assert.equal(ctx._igPhotoTagRow([row],ctx._igPhotoIdentity(ids,0)),row,'new media IDs can adopt legacy saved tags');
const linked={...row,media_id:'123456'};
const removed={...ids,c:[ids.c[1]],mi:[ids.mi[1]]};assert.equal(ctx._igPhotoTagRow([linked],ctx._igPhotoIdentity(removed,0)),null,'deleted first slide never transfers tags onto the next slide');
const changed={...ids,c:['https://cdn.test/brand-new-filename.jpg'],mi:[{id:'123456',u:'https://cdn.test/brand-new-filename.jpg',ty:'IMAGE'}]};assert.equal(ctx._igPhotoTagRow([linked],ctx._igPhotoIdentity(changed,0)),linked,'stable media ID survives filename changes');
assert.equal(ctx._igPhotoTagRow([{...row,media_id:'111'}],ctx._igPhotoIdentity(ids,0)),null,'different media IDs override coincident filenames');
assert.equal(ctx._igPhotoIdentity({...source,c:[source.c[0],source.c[0]]},0),null,'ambiguous legacy duplicate filename cannot be tagged');
assert.equal(ctx._igPhotoTagRow([],a),null,'untagged posts stay untagged');
assert.equal(ctx._igPhotoIdentity({...source,mi:{}},0).imageKey,'photo-a.jpg');
// Run the existing collector's media serializer, including its backwards-compatible URL arrays.
const collector=fs.readFileSync(path.join(root,'tools/ig_business_discovery.mjs'),'utf8'),start=collector.indexOf('    const img = m =>'),end=collector.indexOf('    acc.push({ handle:',start);
const serialize=new Function('b','MAG','h','mentionsOf',collector.slice(start,end)+';return media;');
const sourcePost={id:'9001',media_type:'CAROUSEL_ALBUM',media_url:'https://cdn.test/a.jpg',permalink:source.p,caption:'Caption',children:{data:[{id:'1001',media_type:'IMAGE',media_url:'https://cdn.test/a.jpg'},{id:'1002',media_type:'VIDEO',thumbnail_url:'https://cdn.test/b.jpg',media_url:'https://cdn.test/video.mp4'}]}};
const [packed]=serialize({media:{data:[sourcePost]}},new Set(),'cortis',()=>[]);assert.equal(packed.c.length,2);assert.equal(packed.mi[1].ty,'VIDEO');assert.equal(packed.mi[1].id,'1002');assert.equal(packed.mi[1].u,packed.c[1]);assert(!JSON.stringify(packed).includes('video.mp4'),'video behavior remains thumbnail/external only');
const [one]=serialize({media:{data:[{...sourcePost,children:{data:[sourcePost.children.data[0]]}}]}},new Set(),'cortis',()=>[]);assert.equal(one.mi[0].id,'1001','one remaining carousel child keeps its own ID');assert.equal(one.mi[0].u,one.u);
const [withoutChildren]=serialize({media:{data:[{...sourcePost,children:undefined}]}},new Set(),'cortis',()=>[]);assert.equal(withoutChildren.mi[0].id,null,'parent carousel ID is never confused with a child photo');
// Execute the shared video/photo search implementation against the real roster.
const artists=JSON.parse(fs.readFileSync(path.join(root,'artists.json'))),groups=JSON.parse(fs.readFileSync(path.join(root,'groups.json'))),picker={ARTISTS:artists,GROUPS:groups,document:{},Set};vm.createContext(picker);vm.runInContext(fs.readFileSync(path.join(root,'shared.js'),'utf8'),picker);
vm.runInContext(admin.slice(admin.indexOf('function _vidTagExactMatch('),admin.indexOf("document.getElementById('vid-tag-with-search')",admin.indexOf('function _vidTagExactMatch('))),picker);
for(const q of ['혁','진영','은채','Jinyoung','SEONGHYEON']){
 const lower=q.toLowerCase(),already=new Set(),excludeGroup='코르티스';
 const prior=artists.filter(a=>(a.name.ko.includes(q)||(a.name.en||'').toLowerCase().includes(lower))&&!picker._artistGroups(a).some(g=>g.ko===excludeGroup)&&!already.has(a.name.ko+'|'+a.group.ko)).sort((a,b)=>(picker._vidTagExactMatch(b,q,lower)?1:0)-(picker._vidTagExactMatch(a,q,lower)?1:0)).slice(0,8);
 assert.deepEqual(Array.from(picker._vidTagFindMembers(q,{excludeGroup,already}),a=>a.id),prior.map(a=>a.id),'existing video search unchanged: '+q);
}
assert.equal(picker._vidTagGroupMembers('코르티스').length,5);
assert(picker._vidTagFindMembers('은채',{limit:30}).some(a=>a.id==='a0148'));
assert(picker._vidTagFindMembers('은채',{limit:30}).some(a=>a.id==='a0953'));
assert.equal(picker._vidTagFindMembers('CORTIS',{includeGroupNames:true,limit:30}).length,5);
(async()=>{
 let calls=0,resolve;const wait=new Promise(r=>resolve=r);
 ctx.sb={from(){return{select(){return{eq:async()=>{calls++;await wait;return{data:[row],error:null};}};}};}};
 const p1=ctx._igPhotoTagRows('PostAbC_12'),p2=ctx._igPhotoTagRows('PostAbC_12'),p3=ctx._igPhotoTagRows('PostAbC_12',true);resolve();await Promise.all([p1,p2,p3]);assert.equal(calls,1,'deduplicate viewer reads');
 await ctx._igPhotoTagRows('PostAbC_12');assert.equal(calls,1);await ctx._igPhotoTagRows('PostAbC_12',true);assert.equal(calls,2);
 console.log('✅ Photo identity, renewal/removal safety, legacy IDs, shared video search and read deduplication');
})().catch(e=>{console.error(e);process.exitCode=1;});
