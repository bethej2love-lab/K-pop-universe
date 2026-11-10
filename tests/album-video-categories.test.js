// Album/song filters share card category names; challenges belong to Shorts.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = require('../tools/index_source.cjs').readIndexSource();
const start = html.indexOf('const _TVF_FMTS=');
const end = html.indexOf('function _tvfVidUrl(', start);
assert(start >= 0 && end > start);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`const _CAT_LABEL=Object.fromEntries(['mv','live','fan','jacon','cover','short','variety','show'].map(k=>[k,[k,k]]));
  const _isShortV=v=>!!v&&(v.is_short===true||v.category==='short');
  const _isFanV=v=>!!v&&(v.source_tier==='fans'||v.category==='fan');
  ${html.slice(start, end)}
  this.categories=_TVF_FMTS.map(x=>x[0]);this.classify=_tvfFmt;this.has=_tvfHas;`, ctx);
assert.deepEqual(Array.from(ctx.categories), ['mv','live','fan','jacon','cover','short','variety','show']);
assert(!ctx.categories.includes('challenge'));
for (const v of [
  {title:'Challenge',category:'live',is_short:true},
  {title:'Regular short',category:'short'},
  {title:'Legacy challenge',category:'challenge'}
]) assert.equal(ctx.classify(v), 'short');
assert.equal(ctx.classify({title:'Challenge full performance',category:'live',is_short:false}), 'live', 'title alone must not force a portrait format');
for (const category of ['mv','cover','variety','show']) assert.equal(ctx.classify({category}), category);
// 팬 = 출처 층위(2026-11-10): 팬 직캠은 퍼포먼스 칩과 by Fans 칩에 겹쳐 든다. 전환 전 category='fan'은 내용 미상 → 기타.
assert.equal(ctx.classify({category:'fan'}), 'other');
assert(ctx.has({category:'live',source_tier:'fans'},'live') && ctx.has({category:'live',source_tier:'fans'},'fan'));
assert(!ctx.has({category:'live'},'fan'));
console.log('PASS album/song video categories: shared order, merged Shorts, preserved other genres');
