// Fan tabs belong immediately after performance, independent of async Original insertion.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=require('../tools/index_source.cjs').readIndexSource();
const init=html.match(/let catTabs=([^;]+);/)[1];
const insert=html.match(/const liveAt=catTabs\.findIndex[^\n]+\n\s*catTabs\.splice[^\n]+/)[0];
let count=0;
for(const memberKo of [null,'성현'])for(const originalFirst of [false,true]){
  const ctx={memberKo,_catLabel:k=>k,fanLbl:'by COER'};vm.createContext(ctx);
  vm.runInContext('var catTabs='+init,ctx);
  if(originalFirst)vm.runInContext("catTabs.splice(1,0,['jacon','Original'])",ctx);
  vm.runInContext(insert,ctx);
  if(!originalFirst)vm.runInContext("catTabs.splice(1,0,['jacon','Original'])",ctx);
  const ids=Array.from(vm.runInContext('catTabs.map(x=>x[0])',ctx));
  assert.equal(ids.indexOf('fan'),ids.indexOf('live')+1);
  assert.equal(ids[0],'all');assert.equal(ids[1],'jacon');count++;
}
{
  const ctx={catTabs:[['all','All'],['short','Shorts']],fanLbl:'by Fans'};vm.createContext(ctx);
  vm.runInContext(insert,ctx);assert.equal(ctx.catTabs[1][0],'fan');count++;
}
console.log(`✅ fan tab order: ${count} cases passed`);
