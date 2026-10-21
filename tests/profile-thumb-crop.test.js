const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const css=fs.readFileSync(path.join(__dirname,'../kpop_universe.css'),'utf8');
const cases=[['K7Ox3iVo8uw','58% 50%','1.1','50% 100%'],['noKS6ECLJMo','50% 50%','1.1','50% 50%'],['kMhIOMIQN-g','42% 50%','1.2','50% 0%'],['xMX_wK0osU0','50% 50%','1.55','50% 0%']];
for(const[id,pos,scale,origin]of cases){
  const card=`#tt-insta-pic-wrap.tt-pic-fromvid #tt-insta-pic[src*="/vi/${id}/"]`;
  const search=`.sr-av.is-thumb img[src*="/vi/${id}/"]`;
  const at=css.indexOf(card),rule=css.slice(at+card.length,css.indexOf('}',at)+1);
  assert(at>=0,`${id}: scoped to video fallback, not Instagram`);
  assert(css.slice(Math.max(0,at-search.length-4),at).includes(search),`${id}: same crop in search`);
  for(const value of [`object-position:${pos};`,`transform:scale(${scale});`,`transform-origin:${origin};`])assert(rule.includes(value),id+': '+value);
}
assert(!css.includes('/vi/ZX9fFQkhtO4/'),'acceptable Leesol sample is not changed');
console.log('PASS profile crop: 4 video-specific rules, card/search parity, no blanket override');
