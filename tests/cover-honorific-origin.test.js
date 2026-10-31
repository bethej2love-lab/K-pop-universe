// '태용 선배님의 관둬'의 원곡자는 태용. 소유격을 이름 일부로 오해해 F.T.ISLAND 동명곡으로 고르지 않는다.
const assert=require('assert'),M=require('../tools/m2_harness').load();
const origin={kind:'member',gko:'엔시티 127',mko:'태용'};let failed=0,total=0;
function check(name,fn){total++;try{fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
for(const title of [
 '태용 선배님의 \\"관둬\\" Cover🎵⭐\\"너를 좋아하고 싶다고 내 마음은\\" #shorts',
 '태용 선배님의 "관둬" Cover',
 '태용 후배님의 "관둬" Cover', // 통제 문법 비교, 실제 방송 제목 주장 아님
])check('명시 원곡자 선택 '+title,()=>{
 const r=M._coverResolve({title,group_ko:'엘라스트',members:['원혁'],with_members:[],with_groups:[],cover_of_members:['태용(엔시티 127)'],cover_of_groups:[],published_at:'2024-07-06'});
 assert.equal(r?.origin?.gko,'엔시티 127');assert.equal(r.origin.mko,'태용');assert.equal(r.song,'관둬 (GWANDO)');
 assert.deepEqual(r.patch.cover_of_groups,[]);assert.deepEqual(r.patch.cover_of_members,['태용(엔시티 127)']);
 assert(!r.patch.with_members?.length,'원곡자에게 실제 출연자를 새로 만들지 않음');
});
for(const [text,expected] of [
 ['태용',true],['태용 선배님의',true],['태용 후배님의',true],['태용 선배님의 \\"',true],
 ['태용 선배님과',false],['태용 선배님의 친구',false],['태용 선배님의무대',false],['다른태용 선배님의',false],['Bobby Helms',false],
])check('원곡자 표기 전체 일치 '+text,()=>assert.equal(M._coverCreditExact(text,origin),expected));
check('외부 원곡자 풀네임 부분 일치 방어 보존',()=>assert.equal(M._coverCreditExact('Bobby Helms',{kind:'member',gko:'아이콘',mko:'바비'}),false));
console.log(`${total}검사 / ${failed}실패`);if(failed)process.exitCode=1;
