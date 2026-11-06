const fs=require('fs'),assert=require('node:assert/strict');
const d=__dirname+'/',clone=x=>JSON.parse(JSON.stringify(x)),g=JSON.parse(fs.readFileSync('groups.json')),before=clone(g);
const cs=JSON.parse(fs.readFileSync(d+'remaining-duplicate-albums.json')),os=JSON.parse(fs.readFileSync(d+'duplicate-canonical.json'));
const ids={'We Hate All Kinds of Violence - 1집':'5280','해결사 - 1집':'4246','Equalize Her - 1집':'5248','비 (Sorrow) - 4집':'2473','Race - 2집':'5304','Discovery - 1집':'5294','The Beautiful Stardust':'359951'},plan=[];
for(const [title,id] of Object.entries(ids)){
 const c=cs.find(x=>x.title===title),o=os.find(x=>x.id===id);assert(c&&o&&o.artist);assert.equal(new Set(o.tracks.map(t=>t.songId)).size,o.tracks.length);
 for(const r of c.refs){assert.equal(r.who.type,'group');const list=g[r.who.owner][r.who.kind],index=list.findIndex(a=>a.title===title);assert(index>=0);const a=list[index];assert.deepEqual(a,r.album);const prior=clone(a);a.tracks=clone(o.tracks);a.trackCount=a.tracks.length;a.titleTrack=a.tracks.filter(t=>t.isTitle).map(t=>t.title).join(' / ');assert(a.titleTrack);a.melonAlbumId=id;plan.push({owner:r.who.owner,kind:r.who.kind,index,source:o.url,before:prior,after:clone(a),policy:'Exact official artist/album; source dates/type/cover retained; digital catalog includes official bonus tracks'});}
}
assert.equal(plan.length,7);const inverse=clone(g);for(const p of plan)inverse[p.owner][p.kind][p.index]=p.before;assert.deepEqual(inverse,before);
fs.writeFileSync(d+'legacy-album-edits.json',JSON.stringify(plan,null,2)+String.fromCharCode(10));fs.writeFileSync('groups.json',JSON.stringify(g,null,1)+String.fromCharCode(10));console.log('Applied 7 legacy albums; inverse scope verified');
