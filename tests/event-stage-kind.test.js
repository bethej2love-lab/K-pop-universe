// 행사 "지난 무대 보기" 무대·직캠·그 밖 가르기(_evKind, 2026-10-28 사용자 "지난 무대 보기 눌렀을 때 영상 제대로 필터링 안 된 것 같다").
// 시상식 공식 무대는 수집 분류가 대부분 category 'other'라 예전 기준(live·mv)으론 무대 칸이 거의 비고, 비면 '전체'로 넘어가
// 비하인드·브이로그·쇼츠가 섞였다. 실제 2025 회차 제목으로 고정한다.
// 실행: node tests/event-stage-kind.test.js
const{readIndexSource}=require('../tools/index_source.cjs');
const src=readIndexSource();
const grab=name=>{const m=src.match(new RegExp('^const '+name+'=.*$','m'));if(!m)throw new Error(name+' 없음');return m[0];};
const _isShortV=v=>!!v.is_short;
eval([grab('_EV_NOT_STAGE_RE'),grab('_EV_FANCAM_RE'),grab('_EV_STAGE_RE')].join('\n')+'\nglobalThis._EVK_RE={_EV_NOT_STAGE_RE,_EV_FANCAM_RE,_EV_STAGE_RE};');
const{_EV_NOT_STAGE_RE,_EV_FANCAM_RE,_EV_STAGE_RE}=globalThis._EVK_RE;
const kindSrc=src.match(/^const _evKind=v=>\{[\s\S]*?^\};/m);
if(!kindSrc)throw new Error('_evKind 없음');
const _evKind=eval('('+kindSrc[0].replace(/^const _evKind=/,'').replace(/;$/,'')+')');
let pass=0,fail=0;
const t=(title,want,extra)=>{const v=Object.assign({title,category:'other',is_short:false,content_formats:[]},extra||{});const got=_evKind(v);
  if(got===want){pass++;}else{fail++;console.log(`❌ ${want} 이어야 (지금 ${got}) ← ${title}`);}};
// 무대 — 수집 분류는 other
t('[#MMA2025] EXO - 늑대와 미녀 + Monster + 전야 + Love Shot + 으르렁 + Back it up (4K) | #EXO #20251220','stage');
t('[#2025MAMA] CORTIS - GO! + FaSHioN | Mnet 251129 방송','stage');
t("[#AAA2025] 🎥 RIIZE(라이즈) 'INTRO+잉걸 (Ember to Solar)+Fame' | 4K Stage |",'stage');
t('Sticky+Midas Touch+lgloo+Lips Hips Kiss+Lucky-KISS OF LIFE [2025 가요대축제 글로벌 페스티벌] | KBS 251219 방송','stage');
t('[가요대제전] MEOVV ANNA (미야오 안나) – DROP TOP+HANDS UP | 2025 GayoDaejejeon | MBC251231','stage');
t('Stray Kids - CEREMONY + This & That + MIROH #2026SBS가요대전Summer','stage',{category:'live'});
// 직캠 — 방송사 공식 안무캠(안무영상 태그가 붙어도)
t("[K-Choreo 8K] 에스파 직캠 'INTRO + Dirty Work + Rich Man' (aespa Choreography) @가요대축제글로벌페스티벌",'fancam',{content_formats:['안무영상']});
t('[4K] 251225 SBS 가요대전 엔시티 위시 유우시 - \'TT\' 직캠 (NCT WISH YUSHI FANCAM)','fancam',{category:'fan'});
// 그 밖 — 연습·리허설·수상소감·리액션·비하인드·공항·쇼츠
t('JENNIE - 2025 MMA Performance Rehearsal','other');
t('ATEEZ(에이티즈) - 2025 MBC 가요대제전 Performance Practice','other');
t('[#MMA2025] G-DRAGON - 올해의 베스트송 수상소감 | #GDRAGON #지드래곤 #멜론뮤직어워드','other');
t('[#MMA2025] EXO - 으르렁 Reaction Moment | #EXO #리액션모먼트 #REACTIONCAM #리액션캠','other');
t('[#aaa2025] Stray Kids(스트레이키즈) - 4K Award acceptance speech','other');
t('[IVE ON] 2025 MBC 가요대제전 BEHIND','other');
t('[LIVE] 스트레이 키즈, "\'10주년 AAA 2025\' 출국" l STRAY KIDS, "Departing for AAA 2025" [공항]','other');
t('나한텐 TOO GOOD #MMA2025 #GDRAGON #지드래곤','other',{is_short:true});
t('2025 KGMA Behind - DAYOUNG (다영)','other',{content_formats:['비하인드']});
console.log(fail?`\n❌ 행사 무대 가르기 ${fail}건 실패`:`\n✅ 행사 무대 가르기 테스트 통과 ${pass}건`);
process.exit(fail?1:0);
