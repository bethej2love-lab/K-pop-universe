// Actual registered input handlers with synthetic events and save stubs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const prompt=/document\.getElementById\('generic-prompt-input'\)\.addEventListener\('keydown',e=>\{[\s\S]*?\n\}\);/.exec(src)?.[0];
const collection=src.split('\n').find(s=>s.startsWith("document.getElementById('col-new-name').addEventListener('keydown'"));
const profile=src.split('\n').find(s=>s.startsWith("['pp-nick','pp-bio'].forEach(id=>document.getElementById(id).addEventListener('keydown'"));
assert(prompt&&collection&&profile);
function fixture(){
 const handlers={},saves=[];
 const ctx={document:{getElementById:id=>({addEventListener:(_type,fn)=>handlers[id]=fn,click:()=>saves.push(id)})},_confirmNewCol:()=>saves.push('collection'),saveProfile:()=>saves.push('profile')};
 vm.createContext(ctx);vm.runInContext([prompt,collection,profile].join('\n'),ctx);return {handlers,saves};
}
let total=0,failed=0;function check(name,run){total++;try{run();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
for(const id of ['generic-prompt-input','col-new-name','pp-nick','pp-bio']){
 for(const flags of [{isComposing:true},{keyCode:229}])check(id+' ignores IME '+JSON.stringify(flags),()=>{const f=fixture();let prevented=false;f.handlers[id]({key:'Enter',...flags,preventDefault(){prevented=true;}});assert.equal(f.saves.length,0);assert(!prevented);});
 check(id+' ordinary Enter still saves once',()=>{const f=fixture();f.handlers[id]({key:'Enter',isComposing:false,keyCode:13,preventDefault(){}});assert.equal(f.saves.length,1);});
 check(id+' unrelated key does not save',()=>{const f=fixture();f.handlers[id]({key:'a',preventDefault(){throw new Error('must not prevent typing');}});assert.equal(f.saves.length,0);});
 check(id+' composition Enter then separate Enter saves once',()=>{const f=fixture();for(const isComposing of [true,false])f.handlers[id]({key:'Enter',isComposing,preventDefault(){}});assert.equal(f.saves.length,1);});
}
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
