// 자컨 탭 = 그룹 공식 채널 + 멤버 개인 채널 (2026-10-21 사용자 "자컨 탭엔 그룹 공식 유튜브 영상 쫙, 개인 채널 있는 멤버 카드엔 그것까지")
// 예전엔 개인 채널(idol)만 봐서 공식 채널 영상이 하나도 안 나왔다. 대표영상·목록·탭 노출 판정 세 곳이 같은 함수를 써야 한다.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const html=require('../tools/index_source.cjs').readIndexSource();
const src=html.match(/const _JACON_TIERS=[\s\S]*?\nfunction _applyJaconQuery[\s\S]*?\n}\n/)[0];
assert.equal((html.match(/_applyJaconQuery\(/g)||[]).length,5,'정의 1 + 대표영상·목록·탭 판정·탭 삽입 4곳');
assert.ok(!/filter==='jacon'\)\{\s*q=q\.eq\('source_tier','idol'\)/.test(html),'자컨 목록이 개인 채널만 보던 옛 조건 없음');
const mk=()=>{const ops=[];const q={ops,in:(c,v)=>(ops.push(['in',c,v]),q),eq:(c,v)=>(ops.push(['eq',c,v]),q),or:s=>(ops.push(['or',s]),q)};return q;};
const ctx={_pgFilterVal:v=>'"'+v+'"',_soloKeyUsable:()=>null,_idolHandlesByMember:new Map([['레이|아이브',['Follow_Rei']]])};
vm.createContext(ctx);vm.runInContext(src+';this._applyJaconQuery=_applyJaconQuery;',ctx);
let n=0;
{const q=ctx._applyJaconQuery(mk(),'아이브',null,null,null);
 assert.deepEqual(q.ops[0],['or','source_tier.in.(official,grpsub,idol),category.eq.jacon'],'공식·개인 채널 + 관리자가 자컨으로 지정한 영상(2026-10-26)');assert.deepEqual(q.ops[1],['eq','group_ko','아이브']);assert.equal(q.ops.length,2);n++;}
{const q=ctx._applyJaconQuery(mk(),'아이브','레이',null,null);
 assert.equal(q.ops[2][1],'source_tier.neq.idol,members.cs.{"레이"},source_handle.in.("Follow_Rei")');n++;}
{const q=ctx._applyJaconQuery(mk(),'아이브','장원영',null,null);
 assert.equal(q.ops[2][1],'source_tier.neq.idol,members.cs.{"장원영"}','남의 개인 채널 미태깅 영상은 안 섞임');n++;}
{const q=ctx._applyJaconQuery(mk(),'X','A',null,'unit');assert.equal(q.ops.length,1,'유닛 카드는 범위 그대로');n++;}
console.log(`✅ jacon tab: ${n} cases passed`);
