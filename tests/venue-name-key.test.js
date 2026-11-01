// Actual venue identity helpers; source metadata is read only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=src.indexOf('function _venueIdKey(name){'),b=src.indexOf('function _renderVenueInfo(',a);assert(a>0&&b>a);
const metadata=JSON.parse(fs.readFileSync(path.join(__dirname,'..','venues_info.json'),'utf8')).venues;
const ctx={_venuesInfo:{...metadata,Alias:{alias_of:'Canonical'},'Hall A':{wikidata:'Q123'},'Hall B':{wikidata:'Q123'},Small:{kopis_id:'ID',hall:'small'},Large:{kopis_id:'ID',hall:'large'}}};
vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);const key=n=>ctx._venueIdKey(n);
let total=0,failed=0;function check(name,run){total++;try{run();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
check('case and whitespace refer to same unnamed venue',()=>assert.equal(key('New Venue X'),key('newvenuex')));
check('tabs/newlines and repeated spaces normalize',()=>assert.equal(key('New\t Venue\n  X'),key('NewVenueX')));
check('letter s remains part of an unlisted name',()=>assert.equal(key('SAMPLE STAGE'),'n:samplestage'));
check('distinct names are not merged by removing s',()=>assert.notEqual(key('Shall X'),key('Hall X')));
check('alias can use canonical name fallback',()=>assert.equal(key('Alias'),key('Canonical')));
check('Wikidata identity remains authoritative',()=>assert.equal(key('Hall A'),key('Hall B')));
check('KOPIS hall distinctions remain intact',()=>assert.notEqual(key('Small'),key('Large')));
check('all actual metadata aliases resolve without cycles',()=>{for(const [name,v] of Object.entries(metadata)){if(!v.alias_of)continue;const seen=new Set();let n=name;while(metadata[n]?.alias_of){assert(!seen.has(n),'alias cycle '+name);seen.add(n);n=metadata[n].alias_of;}assert.equal(key(name),key(v.alias_of));}});
check('known aliases with absent metadata target retain name fallback',()=>{for(const name of ['Blue Square iMarket Hall','Shinsegae Mesa Hall','Yes24 Muv Hall'])assert.equal(key(name),key(metadata[name].alias_of));});
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
