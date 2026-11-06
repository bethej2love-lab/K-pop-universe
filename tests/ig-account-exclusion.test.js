// Run the real collector selection policy with fixture sources, without Meta/DB calls.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'tools/ig_business_discovery.mjs'),'utf8');
const start=source.indexOf('const excludedHandles ='),end=source.indexOf('const INVALID_USER_RECHECK_MS',start);
assert(start>=0&&end>start);
const config=JSON.parse(fs.readFileSync(path.join(root,'ig_excluded_accounts.json'),'utf8'));
const fixture={
 'ig_excluded_accounts.json':config,
 'groups.json':{bad:{links:{instagram:'https://www.instagram.com/IDOLISSUE'}},good:{links:{instagram:'https://www.instagram.com/cortis'}}},
 'artists.json':[{links:{instagram:'https://www.instagram.com/idolissue'}},{links:{instagram:'https://www.instagram.com/member_good'}}],
 'ig_media_accounts.json':{accounts:[{h:'IDOLISSUE'},{h:'voguekorea'}]}
};
const run=new Function('readJson','ONLY','console','process',source.slice(start,end)+';return {handles,artistHandles,MAG,mentionsOf};');
const result=run(p=>fixture[p],null,console,{exit(){throw Error('unexpected exit')}});
assert.deepEqual([...result.handles].sort(),['cortis','member_good','voguekorea']);
assert(!result.MAG.has('idolissue'));assert(!result.artistHandles.has('idolissue'));
assert.deepEqual(result.mentionsOf('@idolissue @cortis'),['cortis']);
let exited=false;try{run(p=>fixture[p],'IDOLISSUE',{log(){}},{exit(code){assert.equal(code,0);exited=true;throw Error('blocked exit')}});}catch(e){assert.equal(e.message,'blocked exit');}assert(exited);
const dry=spawnSync(process.execPath,[path.join(root,'tools/ig_business_discovery.mjs'),'--dry-run','--only= IDOLISSUE '],{encoding:'utf8',timeout:5000});
assert.equal(dry.status,0,dry.stderr);assert(dry.stdout.includes('idolissue'));assert(!dry.stdout.includes('planned'));
const artists=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8')),slim=JSON.parse(fs.readFileSync(path.join(root,'artists.slim.json'),'utf8'));
for(const rows of [artists,slim]){assert(!rows.some(a=>/instagram\.com\/idolissue(?:[/?#]|$)/i.test(a.links?.instagram||'')));assert(rows.find(a=>a.id==='a1465').links.namu);}
console.log('PASS excluded account: group/member/magazine sources, mentions, manual override, source/slim links');
