// Exercise the actual expiry selector without starting network collection.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../tools/ig_business_discovery.mjs'),'utf8');
const start=s.indexOf('function imageExp(r) {'),end=s.indexOf('const imageExpiries =',start);
assert(start>=0&&end>start);
const imageExp=vm.runInNewContext(s.slice(start,end)+';imageExp');
const url=t=>'https://scontent.example.test/image.jpg?oe='+Math.floor(t/1000).toString(16);
const old=Date.parse('2026-11-04T08:32:39Z'),later=Date.parse('2026-11-09T00:00:00Z');
assert.equal(imageExp({pic_url:url(later)}),later,'profile expiry still supported');
assert.equal(imageExp({pic_url:url(later),media:[{u:url(old)}]}),old,'expired post outranks fresh profile');
assert.equal(imageExp({pic_url:url(later),media:[{u:url(later),c:[url(later),url(old)]}]}),old,'carousel child expiry included');
assert.equal(imageExp({media:[{u:url(old)},{u:url(later)}]}),old,'earliest expiry wins');
assert.equal(imageExp({pic_url:'https://example.test/no-expiry',media:null}),Infinity,'missing expiry is not invented');
assert.equal(imageExp(null),Infinity);
console.log('PASS image expiry: profile / post / carousel / missing metadata');
