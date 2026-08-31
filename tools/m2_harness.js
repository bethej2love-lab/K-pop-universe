// admin.js 안의 매칭 엔진(_m2ParseTitle·_atmResolveMembers)을 Node에서 그대로 실행하기 위한 로더.
// tests/matching.test.js의 "이름으로 잘라오기" 방식을 그대로 쓰되, 테스트 케이스 없이 모듈로만 노출한다
// (tools/fancam_pattern_probe.js 등 시뮬레이션/감사 도구가 공용으로 씀). 로직을 베끼지 않고 실제 배포
// 코드를 슬라이스해 실행하므로 카피 드리프트가 없다. ⚠️ _m2ParseTitle이 새 최상위 함수/상수를 부르게
// 되면 아래 pieces에 반드시 추가해야 함(안 하면 "... is not defined").
//
// 사용: const {load}=require('./m2_harness'); const {_m2ParseTitle,GROUPS,ARTISTS}=load();
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');

function extractByBraces(src,declStartRe,label){
  const m=declStartRe.exec(src);
  if(!m)throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  const start=m.index;
  let i=src.indexOf('{',start);
  if(i===-1)throw new Error(`[harness] 여는 중괄호를 못 찾음: ${label}`);
  let depth=0;
  for(;i<src.length;i++){
    if(src[i]==='{')depth++;
    else if(src[i]==='}'){depth--;if(depth===0){i++;break;}}
  }
  return src.slice(start,i);
}
function extractStatement(src,declStartRe,label){
  const m=declStartRe.exec(src);
  if(!m)throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  const start=m.index;
  let depth=0;
  for(let i=start;i<src.length;i++){
    const c=src[i];
    if(c==='{'||c==='['||c==='(')depth++;
    else if(c==='}'||c===']'||c===')')depth--;
    else if(c===';'&&depth===0)return src.slice(start,i+1);
  }
  throw new Error(`[harness] 문장 끝(;)을 못 찾음: ${label}`);
}

function load(){
  const adminSrc=fs.readFileSync(path.join(ROOT,'admin.js'),'utf8');
  const sharedSrc=fs.readFileSync(path.join(ROOT,'shared.js'),'utf8');
  const GROUPS=JSON.parse(fs.readFileSync(path.join(ROOT,'groups.json'),'utf8'));
  const ARTISTS=JSON.parse(fs.readFileSync(path.join(ROOT,'artists.json'),'utf8'));
  const pieces=[];
  const S=(re,l)=>pieces.push(extractStatement(adminSrc,re,l));
  const F=(re,l)=>pieces.push(extractByBraces(adminSrc,re,l));
  S(/^const _WONKOK_BRACKETS\s*=/m,'_WONKOK_BRACKETS');
  F(/^function _isBeOriginal\(/m,'_isBeOriginal');
  F(/^function _wonkokStripClause\(/m,'_wonkokStripClause');
  S(/^const _ATM_KOREAN_SURNAMES\s*=/m,'_ATM_KOREAN_SURNAMES');
  F(/^function _atmEscRe\(/m,'_atmEscRe');
  F(/^function _atmTokenize\(/m,'_atmTokenize');
  S(/^const _ATM_HASHTAG_ONLY_NAMES\s*=/m,'_ATM_HASHTAG_ONLY_NAMES');
  F(/^function _atmStripSurname\(/m,'_atmStripSurname');
  F(/^function _isHashtagOnlyName\(/m,'_isHashtagOnlyName');
  S(/^const _ATM_SURNAME_EXCLUDE\s*=/m,'_ATM_SURNAME_EXCLUDE');
  S(/^const _ATM_NO_CONTEXT_RELAX_NAMES\s*=/m,'_ATM_NO_CONTEXT_RELAX_NAMES');
  F(/^function _atmContextRelaxesHashtagOnly\(/m,'_atmContextRelaxesHashtagOnly');
  F(/^function _atmStripCommonNounCtx\(/m,'_atmStripCommonNounCtx');
  F(/^function _atmMatchesMember\(/m,'_atmMatchesMember');
  // 설명란 노이즈 제거(2026-08-31) — 있으면 싣는다
  if(/^const _ATM_DESC_NOISE_LINE\s*=/m.test(adminSrc)){
    S(/^const _ATM_DESC_NOISE_LINE\s*=/m,'_ATM_DESC_NOISE_LINE');
    F(/^function _atmStripDescNoise\(/m,'_atmStripDescNoise');
  }
  F(/^function _memberLeftCutoffDate\(/m,'_memberLeftCutoffDate');
  F(/^function _atmResolveMembers\(/m,'_atmResolveMembers');
  S(/^const _m2VariantsCache\s*=/m,'_m2VariantsCache');
  F(/^function _m2NameVariants\(/m,'_m2NameVariants');
  S(/^const _GROUP_TITLE_CONFLICT_EXCLUDE\s*=/m,'_GROUP_TITLE_CONFLICT_EXCLUDE');
  S(/^const _GROUP_AMBIGUOUS_IF_COMATCHED\s*=/m,'_GROUP_AMBIGUOUS_IF_COMATCHED');
  F(/^function _unitMemberNamedInTitle\(/m,'_unitMemberNamedInTitle');
  F(/^function _atmLeftBefore\(/m,'_atmLeftBefore');
  // 음악방송 직캠 구조 파서(2026-08-29 신설) — admin.js에 있으면 싣고, 없으면(구버전) 건너뜀
  if(/^const _FANCAM_SHOW_PATTERNS\s*=/m.test(adminSrc)){
    F(/^function _fancamShowPatterns\(/m,'_fancamShowPatterns');
    S(/^const _FANCAM_SHOW_PATTERNS\s*=/m,'_FANCAM_SHOW_PATTERNS');
    S(/^const _FANCAM_FILLER_RE\s*=/m,'_FANCAM_FILLER_RE');
    F(/^function _fancamNormTok\(/m,'_fancamNormTok');
    F(/^function _fancamParseTitle\(/m,'_fancamParseTitle');
  }
  F(/^function _m2ParseTitle\(/m,'_m2ParseTitle');
  // 원곡 해석기 v2(2026-08-30) — 있으면 싣는다
  if(/^function _coverResolve\(/m.test(adminSrc)){
    F(/^function _coverSongKeys\(/m,'_coverSongKeys');
    F(/^function _coverKeyLoose\(/m,'_coverKeyLoose');
    S(/^const _COVER_COMMON_KEYS\s*=/m,'_COVER_COMMON_KEYS');
    S(/^let _coverIndex\s*=/m,'_coverIndex');
    S(/^let _coverIndexChart\s*=/m,'_coverIndexChart');
    ['_coverOriginLabel','_coverOriginId','_coverArtistOriginOf','_coverBuildIndex','_coverIndexEnsure','_coverContext','_coverHasCollabSignal','_coverCandidates','_coverOriginFromText','_coverIsSelf','_coverDebutYear','_coverResolve'].forEach(n=>F(new RegExp('^function '+n+'\\(','m'),n));
    // 원곡 오탐 청소의 되돌리기 게이트(2026-08-31) — 있으면 싣는다
    if(/^function _coverRestoreSignal\(/m.test(adminSrc))F(/^function _coverRestoreSignal\(/m,'_coverRestoreSignal');
  }
  // 겸임 멤버 태그 정규화(2026-08-31) — 있으면 싣는다
  if(/^function _normalizeMemberTags\(/m.test(adminSrc)){
    S(/^let _amtIndex\s*=/m,'_amtIndex');
    ['_amtBuildIndex','_amtEntries','_amtSamePerson','_amtGroupNamedInTitle','_amtPickGroup','_normalizeMemberTags'].forEach(n=>F(new RegExp('^function '+n+'\\(','m'),n));
  }
  // 수동 편집 이력 diff(2026-08-31) — 있으면 싣는다
  if(/^const _TAG_LOG_FIELDS\s*=/m.test(adminSrc)){
    S(/^const _TAG_LOG_FIELDS\s*=/m,'_TAG_LOG_FIELDS');
    F(/^function _tagLogSame\(/m,'_tagLogSame');
    F(/^function _tagLogDiff\(/m,'_tagLogDiff');
  }
  const src=`
const GROUPS=${JSON.stringify(GROUPS)};
const ARTISTS=${JSON.stringify(ARTISTS)};
${sharedSrc}
const _ATM_DYNAMIC_HASHTAG_NAMES=new Set();
const _ATM_DYNAMIC_AMBIGUOUS_COMATCH=new Set();
const _ATM_DYNAMIC_LITERAL_ONLY=new Set();
const _ATM_DYNAMIC_SURNAME_EXCLUDE=new Map();
const _STRICT_SYNC_GROUPS=new Set(Object.entries(GROUPS).filter(([,v])=>v&&v.strictSync).map(([ko])=>ko));
${pieces.join('\n')}
module.exports={_m2ParseTitle,_atmResolveMembers,_atmMatchesMember,_atmTokenize,_wonkokStripClause,_PROJECT_UNITS,GROUPS,ARTISTS,_STRICT_SYNC_GROUPS,
  _atmStripDescNoise:(typeof _atmStripDescNoise==='function')?_atmStripDescNoise:null,
  _coverResolve:(typeof _coverResolve==='function')?_coverResolve:null,_coverCandidates:(typeof _coverCandidates==='function')?_coverCandidates:null,_coverSongKeys:(typeof _coverSongKeys==='function')?_coverSongKeys:null,_coverBuildIndex:(typeof _coverBuildIndex==='function')?_coverBuildIndex:null,
  _coverContext:(typeof _coverContext==='function')?_coverContext:null,_coverHasCollabSignal:(typeof _coverHasCollabSignal==='function')?_coverHasCollabSignal:null,
  _coverRestoreSignal:(typeof _coverRestoreSignal==='function')?_coverRestoreSignal:null,
  _fancamParseTitle:(typeof _fancamParseTitle==='function')?_fancamParseTitle:null,
  _tagLogDiff:(typeof _tagLogDiff==='function')?_tagLogDiff:null,_tagLogSame:(typeof _tagLogSame==='function')?_tagLogSame:null,
  _normalizeMemberTags:(typeof _normalizeMemberTags==='function')?_normalizeMemberTags:null,_amtSamePerson:(typeof _amtSamePerson==='function')?_amtSamePerson:null};
`;
  const mod={exports:{}};
  new Function('module','exports','require',src)(mod,mod.exports,require);
  return mod.exports;
}
module.exports={load};
