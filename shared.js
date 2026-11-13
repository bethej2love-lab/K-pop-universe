// 메인 앱(index.html)과 관리자 도구(admin.js) 양쪽이 참조하는 순수 데이터/헬퍼 (2026-08-21 신설, "파일
// 분리 0단계" — Fable UX/코드 감사 지적을 검토 후 가장 위험 낮은 조각부터 분리하기로 함).
//
// 왜 분리했나: admin.js는 원래도 이 4개를 index.html의 같은 전역 스코프에서 그냥 가져다 썼음(admin.js가
// 관리자 확인 후 늦게 동적 로드되는 구조라 순서상 문제는 없었음) — 실제 문제는 매칭 로직 회귀 테스트
// (tests/matching.test.js) 만들 때 이 4개를 index.html에서 줄번호/중괄호 스캔으로 손으로 잘라내야 했던
// 것. 여기로 옮기면 테스트가 그냥 require()하면 되고, "어디서 공유되는 데이터인지"가 파일 구조로 드러남.
// 순수하게 코드를 옮기기만 함(로직 변경 없음) — <script src="shared.js">가 index.html 본문 스크립트보다
// 먼저 로드되므로 기존 동작과 100% 동일.
//
// ⚠️ 이 파일을 수정하면 index.html의 <script src="shared.js?v=..."> 쿼리스트링 버전도 같이 올릴 것
// (admin.js의 _ADMIN_JS_VER와 동일한 이유 — 캐시버스터 없이 파일명만 같으면 배포 후에도 브라우저/CDN이
// 옛 버전을 계속 서빙하는 사고가 있었음).

function _artistGroups(a){return a.groups||[a.group];}

// 소속 항목에 명시된 값이 우선이며, 주 소속에만 루트의 기간/상태를 보충한다.
function _artistAffiliation(a,ko){
  if(!a||!ko)return null;
  const source=_artistGroups(a).find(g=>g&&g.ko===ko)||(a.group&&a.group.ko===ko?a.group:null);
  if(!source)return null;
  const entry={...source};
  if(a.group&&a.group.ko===ko){
    for(const key of ['joined','left','pausedFrom','active'])if(entry[key]===undefined&&a[key]!==undefined)entry[key]=a[key];
  }
  return entry;
}
function _artistMembershipStatus(a,ko,info){
  const entry=_artistAffiliation(a,ko)||{};
  if((info&&info.disbanded)||entry.left)return 'former';
  if(entry.pausedFrom)return 'paused';
  return (entry.active!==undefined?entry.active:a.active)===false?'former':'current';
}
// 합류일은 알려진 정밀도를 유지한다. 영상 하한에서 연/월만 있으면 그 기간 첫날부터 보존한다.
function _joinedStartDate(value){
  const m=String(value||'').match(/^(\d{4})(?:[.-](\d{1,2}))?(?:[.-](\d{1,2}))?$/);
  if(!m)return null;
  const y=+m[1],month=+(m[2]||1),day=+(m[3]||1),date=new Date(Date.UTC(y,month-1,day));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;
}
function _groupJoinOrDebut(joined,debut){
  const j=_joinedStartDate(joined),d=_joinedStartDate(debut);
  return j&&(!d||j>d)?joined:(debut||joined||null);
}
function _artistDebutDate(a,groups){
  const dates=[a.debut,..._artistGroups(a).map(g=>g&&groups[g.ko]&&_groupJoinOrDebut(_artistAffiliation(a,g.ko)?.joined,groups[g.ko].debut))].filter(d=>_joinedStartDate(d));
  return dates.sort((x,y)=>_joinedStartDate(x).localeCompare(_joinedStartDate(y)))[0]||null;
}

// ── 탈퇴일 → 컷오프 날짜 (2026-09-04 shared로 이전) ────────────────────────────
// 'YYYY.MM.DD'가 기본이고, **연도만/연·월만 알면 그 해(달)의 마지막 날까지 쳐준다** — 그 구간 안의
// 영상을 잘라낼 근거가 없으므로 보수적으로 늦게 자르는 쪽(2026-09-02 admin.js에서 확장된 관례).
//
// ⚠️ 여기로 옮긴 이유: 그 확장을 **admin.js만 하고 화면(index.html)이 안 따라왔다.** 화면 쪽
//    _memberVideoCutoff는 점만 하이픈으로 바꿔 넘겨서(`'2015'` 그대로) Postgres가 그 해 **1월 1일**로
//    읽었다 — admin은 12월 31일, 화면은 1월 1일. 정반대다. 실측: `published_at.lte.2015`는 10,254행,
//    `lte.2015-12-31`은 13,052행. 탈퇴 연도 1년치가 통째로 사라지는데 에러가 안 나 조용히 어긋났다.
//    PRINCIPLES의 "같은 동작에 진입점이 둘 이상이면 둘 다 고쳤는지 확인"이 정확히 이 사고다.
//    앞으로 해석을 바꾸려면 여기 한 곳만 고치면 된다.
// 반환은 'YYYY-MM-DD'(그 날까지는 출연 인정). 형식이 아예 안 맞으면 null(=컷오프 없음).
function _leftCutoffDate(left){
  if(!left)return null;
  const m=/^(\d{4})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?$/.exec(String(left).trim());
  if(!m)return null;
  const p2=n=>String(n).padStart(2,'0');
  if(!m[2])return `${m[1]}-12-31`;
  if(!m[3])return `${m[1]}-${p2(m[2])}-${new Date(+m[1],+m[2],0).getDate()}`;
  return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
}
// 그룹 활동 중단일(pausedFrom, 2026-10-22) — 탈퇴는 아니지만 그룹 활동에서 빠진 멤버(펜타곤 옌안·유토, 2023.10 계약 종료 후
// 2026 10주년 싱글 7인). 멤버 표기는 현역으로 두고, 멤버 카드의 **미태깅 그룹 전체 영상**만 그날까지로 자른다.
// 그 그룹 항목(groups[].pausedFrom) 우선, 없으면 주 소속일 때 최상위 a.pausedFrom. 반환 'YYYY-MM-DD' 또는 null.
function _memberPausedCutoff(a,gko){
  if(!a)return null;
  const e=(a.groups||[]).find(g=>g&&g.ko===gko);
  const v=(e&&e.pausedFrom)||(a.group&&a.group.ko===gko?a.pausedFrom:null);
  return _leftCutoffDate(v);
}
// 유튜브 채널 동기화 조회에 쓰는 키: 실존하는 그룹 소속이면 그 그룹 키를, 아이유처럼 소속 그룹이 없는
// 솔로 아티스트면 본인 이름을 키로 써서 본인 채널을 동기화/조회한다(그룹별 group_ko 컬럼 재사용).
// ⚠️ 동명이인(2026-10-19): 이름 키(group_ko=사람 이름) 영상은 이름이 같은 사람끼리 구분이 안 된다(포미닛·나인뮤지스 현아 등).
//    이름이 유일하거나 그 이름 키의 주인(artists.json nameKeyOwner — tools/name_key_owner.mjs가 영상 제목 단서로 정함)만 이름을 키로 쓰고,
//    나머지 동명이인 솔로는 '이름#id'(DB에 없는 고유 키)를 쓴다 — 남의 이름 키 영상이 카드·아바타·대표 영상에 섞이지 않게.
function _ytGroupKoFor(a){
  if(GROUPS[a.group.ko])return a.group.ko;
  return _nameKeyOk(a)?a.name.ko:a.name.ko+'#'+(a.id||'');
}
let _nameKeyCnt=null;
function _nameKeyOk(a){
  if(!a||!a.name)return false;
  if(typeof ARTISTS==='undefined'||!ARTISTS||!ARTISTS.length)return true; // 목록이 없는 곳(일부 도구)은 예전처럼
  if(!_nameKeyCnt||_nameKeyCnt._n!==ARTISTS.length){_nameKeyCnt=new Map();_nameKeyCnt._n=ARTISTS.length;ARTISTS.forEach(x=>{if(x&&x.name)_nameKeyCnt.set(x.name.ko,(_nameKeyCnt.get(x.name.ko)||0)+1);});}
  return (_nameKeyCnt.get(a.name.ko)||0)<=1||!!a.nameKeyOwner;
}

// ── 탈퇴 후 솔로 재귀속 (2026-09-03) ─────────────────────────────────────────────
// 그룹을 떠난 뒤의 솔로 활동 영상이 **옛 그룹에 붙어 있는** 문제를 푼다(우즈·원호·에반).
//
// ⚠️ 새 필드를 만들지 않는다 — **이미 있는 구조에서 파생한다.** 처음엔 전용 날짜 필드를
//    추가했다가 걷어냈다(같은 날, 사용자 지적 "겸임일 순 없는 거야?"). 이 프로젝트엔 이미 답이 있었다:
//      승한: group={ko:'솔로'}, groups=[{ko:'솔로'}, {ko:'라이즈', active:false, left:'2024.10.13'}]
//    실제로 `group_ko='승한'` 영상이 295건 돌아가고 있다. 빛새온·김민서도 같은 모양이다.
//
// 이 구조가 **겸임과 탈퇴를 이미 구분한다**(현재 소속 162개 vs 탈퇴 표시 28개):
//   · 겸임  = groups[] 항목에 left/active:false 가 **없다** (마크 = NCT 127 + NCT DREAM, 둘 다 현재)
//   · 탈퇴  = groups[] 항목에 left(+active:false)가 **있다** (승한의 라이즈)
//   · 솔로  = group.ko가 GROUPS에 없다(관례상 '솔로') → _ytGroupKoFor가 본인 이름을 키로 돌려준다
// 그래서 "언제부터 솔로인가"는 별도 필드가 아니라 **그 사람의 그 그룹 탈퇴일**이다. 중복이 없다.
//
// ⚠️ 자동 판정은 불가능하다(2026-09-03 실측). "탈퇴+단일소속+생존+이름고유" 181명을 자동으로 훑었더니
//    75건 중 41건이 한국어 부사 "바로"(비원에이포)였고, 강한 근거만 남겨도 미등록 신인 그룹의
//    동명이인이 대부분이었다. 그래서 **사람이 group.ko를 '솔로'로 바꿔주는 것**이 곧 확정 행위다.
//
// ⚠️ 매처(_m2ParseTitle)는 건드리지 않는다. primaryGroup이 항상 GROUPS 키라는 불변식을 깨면 소비처가
//    너무 넓다. group_ko를 **쓰는 지점**(동기화 행 생성·재귀속 스윕)에서만 이 후처리를 부른다.
//
// gko: 매처가 낸 그룹, memberKos: 그 그룹에서 잡힌 멤버들, publishedAt: 'YYYY-MM-DD'
// 반환: 재귀속할 이름(문자열) 또는 null(해당 없음)
function _soloReattribGko(gko,memberKos,publishedAt){
  if(!gko||!publishedAt||!Array.isArray(memberKos)||memberKos.length!==1)return null; // 단독 출연만
  const nm=memberKos[0];
  const a=ARTISTS.find(x=>x.name&&x.name.ko===nm);
  if(!a)return null;
  if(GROUPS[a.group&&a.group.ko])return null;   // 현재 소속이 실존 그룹이면 솔로 전향자가 아님
  if(_ytGroupKoFor(a)!==nm)return null;         // 방어: 본인 이름이 키가 아니면 대상 아님
  const ent=_artistGroups(a).find(g=>g&&g.ko===gko);
  if(!ent||!ent.left)return null;               // 그 그룹 소속 이력이 있고 **탈퇴일이 찍혀** 있어야 함
  const left=String(ent.left).replace(/\./g,'-');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(left))return null; // 연도만 있는 등 정밀도 부족 → 경계를 못 그음
  return String(publishedAt).slice(0,10)>=left?nm:null;
}

// 프로젝트 유닛(여러 그룹 소속 멤버가 모여 결성한 한시적 유닛, 자체 행성은 없음) — 영상 제목에 유닛명이
// 언급되면 실제 소속 그룹으로 나눠 배정한다. gko는 _ytGroupKoFor와 동일 관례(실존 그룹이면 그 그룹,
// 무소속 솔로면 본인 이름)를 그대로 씀 — 보아처럼 GROUPS에 없는 솔로도 이 매핑 안에서는 정상 동작한다.
// names: 제목에 실제로 쓰이는 표기 전부(영문 약칭+한글 표기) — "V8"만 등록해두면 "브이에잇"으로만
// 쓰인 제목(자체 채널에 흔함)은 못 잡아서 한글 표기를 별도로 추가해둠.
// admin.js(관리자 전용 자동 태깅 도구)에서도 그대로 참조하므로 여기(shared)에 둠 — admin.js는 이 스크립트가
// 실행된 뒤에 로드되는 일반 스크립트라 같은 전역 스코프의 const를 그대로 볼 수 있음(2026-08-12, admin.js
// 분리 리팩토링 때 이 상수만 옮겨진 채로 남아 검색이 통째로 죽는 사고가 있었음 — 재발 방지로 이 위치 확정).
// 유닛 트리거 이름 중 흔한 단어/줄임말과 충돌 위험이 큰 토큰은 평문 매칭 대신 해시태그로 명시된
// 경우만 인정한다(멤버 이름 보호에 쓰던 _ATM_HASHTAG_ONLY_NAMES와 같은 원칙, admin.js 참고). "AAA"는
// 트리플에스 "Acid Angel from Asia" 유닛 약칭이자 아시아 아티스트 어워즈(Asia Artist Awards) 약칭이라,
// 평문 매칭 시 시상식과 무관한 다른 그룹들의 "AAA 비하인드" 영상마다 이 유닛 멤버 4명이 통째로 잘못
// with_members에 붙는 사고가 대량 발견됨(2026-08-21, Fable 감사 기반 실측 — "15&"/"형준" 사고와 같은
// 계열). 트리플에스 자체 채널은 정식 해시태그(#AAA)를 붙이니 진짜 매칭은 그대로 유지됨.
// 트리플에스 서브유닛 전수 재점검(2026-08-21, 사용자 지적 — "유닛 이름 태그는 진짜 조심해야 함,
// 나무위키에 있는 유닛을 다 기계적으로 반영해놔서 위험 검토가 안 돼있었음") 추가 발견: "EVOLution"
// (ONEWE "O!NEW Evolution" 콘서트·2NE1 "NEW EVOLUTION" 투어·크레용팝 "Evolution" 앨범 등에 흔히
// 쓰이는 영단어), "Glow"(뷰티/챌린지 콘텐츠 흔한 단어), "hatch!"(흔한 영단어), "NXT"(3글자 약어,
// WWE NXT 등과 겹침) — 전부 같은 이유로 해시태그 전용으로 좁힘.
// 'M&N'(미료·나르샤 유닛) 추가(2026-08-25): hit()이 '&'를 공백으로 바꿔 'M N'이 되는데, "A.M.N
// Showcase @ DMC Festival"류 제목이 정규화되면 'A M N'이 돼서 그 안의 'M N'에 걸림 — 스텔라(Stellar)
// 페스티벌 직캠들이 통째로 브라운아이드걸스 미료/나르샤로 오태깅되던 원인(실측). '&TEAM'·'15&'와 동일 계열.
// 'GOOD BOY' 추가(2026-09-03): 지디×태양 유닛곡 제목인데 **평문 매칭으로 열려 있었다.** 그 바람에
// 투모로우바이투게더 "Good Boy Gone Bad" 영상 94건에 지디·태양이 통째로 붙었다(실측). 영어 흔한 구라
// AAA·EVOLution과 같은 계열 — 해시태그로만 인정한다.
// ⚠️ 'GOOD BOY'는 2026-09-28에 유닛 이름에서 아예 뺐다 — 해시태그 전용으로도 부족했다: 다른 그룹들의 "Good Boy"
// 챌린지가 정식 해시태그 #GoodBoy를 달아서 지디·태양이 게스트로 계속 붙었다(순위표 14~15건). 곡 제목은 유닛
// 이름이 아니다 — 진짜 지디×태양 콘텐츠는 제목에 "GD X TAEYANG"이 있다.
const _UNIT_HASHTAG_ONLY_TOKENS=new Set(['AAA','EVOLution','Glow','hatch!','NXT','M&N']);
// 시상식 제목의 #AAA는 유닛 출연 근거가 아니다. 정식 Acid Angel from Asia 이름은 그대로 인정한다.
// 자체 채널/외부 채널 경로가 같은 판정을 쓰며, 시상식 단서 없는 기존 #AAA 유닛 표기는 보존한다.
function _unitTokenContextOk(token,title){
  return token!=='AAA'||!/(?:ASIA\s*ARTIST\s*AWARDS?|아시아\s*(?:아티스트\s*어워즈|셀러브리티)|#?AAA\s*(?:19|20)\d\d|(?:19|20)\d\d\s*#?AAA\b)/i.test(title||'');
}
// ⚠️ **해시태그마저 근거가 못 되는** 유닛 트리거(2026-09-03 신설). 다른 그룹이 같은 단어를 곡명으로 쓰고
// 그 그룹 콘텐츠에 정식 해시태그로 달면, 위 hashtag-only 가드를 그냥 통과한다.
// 실사고: 트렌드지의 곡 "GLOW" 홍보 영상에 `#TRENDZ #GLOW #GLOWchallenge`가 달렸고, 트리플에스 유닛
// 'Glow'가 그 해시태그에 걸려 김채원·설린·서아·지연 4명이 144건에 붙었다(36건 × 4명).
// 이 토큰들은 **유닛 소속 그룹이 제목에서 따로 확인될 때만** 확장한다 — 진짜 트리플에스 유닛 콘텐츠는
// 제목에 그룹명이 같이 있고, 자체 채널 경로는 애초에 채널 그룹으로 한정돼 영향이 없다.
// ⚠️ 'UAU'·'유아유'는 넣지 말 것(2026-09-28 되돌림) — 드림캐쳐 유닛(2025 데뷔)이 "UAU 'GENE'"처럼 그룹명 없이
// 활동한다. "동명 신인 그룹"이라 추측해 넣었다가 사용자 정정으로 뺐다. 순위표에 뜬 건 도구가 유닛명을 근거로 안 봐서였다.
const _UNIT_NEED_PARENT_TOKENS=new Set(['Glow']);
const _PROJECT_UNITS={
  'V8':{names:['V8','브이에잇'],members:[{mko:'디에잇',gko:'세븐틴'},{mko:'버논',gko:'세븐틴'}]},
  'GOT THE BEAT':{names:['GOT THE BEAT','갓더비트'],members:[{mko:'보아',gko:'보아'},{mko:'태연',gko:'소녀시대'},{mko:'효연',gko:'소녀시대'},
    {mko:'슬기',gko:'레드벨벳'},{mko:'웬디',gko:'레드벨벳'},{mko:'카리나',gko:'에스파'},{mko:'윈터',gko:'에스파'}]},
  '씨스타19':{names:['씨스타19'],members:[{mko:'효린',gko:'씨스타'},{mko:'보라',gko:'씨스타'}]},
  '오렌지캬라멜':{names:['오렌지캬라멜'],members:[{mko:'레이나',gko:'애프터스쿨'},{mko:'나나',gko:'애프터스쿨'},{mko:'리지',gko:'애프터스쿨'}]},
  '태티서':{names:['태티서'],members:[{mko:'태연',gko:'소녀시대'},{mko:'티파니',gko:'소녀시대'},{mko:'서현',gko:'소녀시대'}]},
  // 효리수(2026-09 데뷔, SM 소녀시대 유닛 — 효연·유리·수영). 2026-11-12 Codex: 유닛 무대가 members 빈 채로 들어와 태연 카드에 떴다. 'HRS' 단독은 흔한 약어라 뺌
  '효리수':{names:['효리수',"Girls' Generation-HRS",'Girls’ Generation-HRS','GirlsGeneration_HRS'],members:[{mko:'효연',gko:'소녀시대'},{mko:'유리',gko:'소녀시대'},{mko:'수영',gko:'소녀시대'}]},
  // JYJ는 한때 독립 groups.json 행성(키 "JX")으로 등록돼있었으나, 소속 멤버 전원이 active:false인데
  // 그룹 자체는 disbanded가 아니라서 "전원 행성 밖으로 흩어져 행성에 별이 하나도 안 남는" 문제가
  // 있었음(2026-08-14, 사용자 제보) — "행성 승격 안 함" 원칙(더블에스301·바스타즈·부석순과 동일)에 맞게
  // 동방신기 소속 유닛 표기로 전환. 원래 discography(The Beginning·IN HEAVEN·JUST US)는
  // 세 멤버 각자의 artists.json unitDiscography로 이관해 보존.
  // JYJ와 JX는 별개 유닛(사용자 정정, 2026-08-14) — JX는 김재중·김준수 2인 활동, 박유천은 미포함.
  // 유닛 태그 표시 순서는 _PROJECT_UNITS 객체 삽입 순서를 따르므로(_unitTagsFor 참고), 최신 유닛인
  // JX를 JYJ보다 앞에 둔다.
  'JX':{names:['JX'],members:[{mko:'김재중',gko:'동방신기'},{mko:'김준수',gko:'동방신기'}]},
  'JYJ':{names:['JYJ','제이와이제이'],members:[{mko:'김재중',gko:'동방신기'},{mko:'박유천',gko:'동방신기'},{mko:'김준수',gko:'동방신기'}]},
  // 슈퍼주니어 공식 유닛 7종(2026-08-05, 나무위키 대조) — 태티서와 동일한 성격(자체 그룹사 소속 공식
  // 서브유닛)이라 같은 방식 적용. "T"/"M"처럼 단일 알파벳만으로는 흔한 단어와 겹쳐 오매칭 위험이 커서
  // names에 bare 단일 알파벳은 넣지 않고 "SUPER JUNIOR-T"/"SJT"처럼 붙여 쓴 형태만 등록한다.
  'K.R.Y.':{names:['SUPER JUNIOR-K.R.Y.','슈퍼주니어-K.R.Y.','K.R.Y.','KRY'],members:[{mko:'규현',gko:'슈퍼주니어'},{mko:'려욱',gko:'슈퍼주니어'},{mko:'예성',gko:'슈퍼주니어'}]},
  'SJT':{names:['SUPER JUNIOR-T','슈퍼주니어-T','SJT'],members:[{mko:'이특',gko:'슈퍼주니어'},{mko:'희철',gko:'슈퍼주니어'},{mko:'신동',gko:'슈퍼주니어'},{mko:'은혁',gko:'슈퍼주니어'},{mko:'성민',gko:'슈퍼주니어'},{mko:'강인',gko:'슈퍼주니어'}]},
  'SJM':{names:['SUPER JUNIOR-M','슈퍼주니어-M','SJ-M','SJM','슈주엠'],members:[{mko:'은혁',gko:'슈퍼주니어'},{mko:'시원',gko:'슈퍼주니어'},{mko:'동해',gko:'슈퍼주니어'},{mko:'려욱',gko:'슈퍼주니어'},{mko:'규현',gko:'슈퍼주니어'},{mko:'성민',gko:'슈퍼주니어'},{mko:'한경',gko:'슈퍼주니어'}]},
  'SJH':{names:['SUPER JUNIOR-HAPPY','슈퍼주니어-HAPPY','슈퍼주니어-해피','SJH'],members:[{mko:'이특',gko:'슈퍼주니어'},{mko:'예성',gko:'슈퍼주니어'},{mko:'신동',gko:'슈퍼주니어'},{mko:'은혁',gko:'슈퍼주니어'},{mko:'성민',gko:'슈퍼주니어'},{mko:'강인',gko:'슈퍼주니어'}]},
  'D&E':{names:['SUPER JUNIOR-D&E','슈퍼주니어-D&E','D&E','디앤이'],members:[{mko:'동해',gko:'슈퍼주니어'},{mko:'은혁',gko:'슈퍼주니어'}]},
  'L.S.S.':{names:['SUPER JUNIOR-L.S.S.','슈퍼주니어-L.S.S.','L.S.S.','LSS'],members:[{mko:'이특',gko:'슈퍼주니어'},{mko:'신동',gko:'슈퍼주니어'},{mko:'시원',gko:'슈퍼주니어'}]},
  '83z':{names:['SUPER JUNIOR-83z','슈퍼주니어-83z','83z','팔삼즈'],members:[{mko:'이특',gko:'슈퍼주니어'},{mko:'희철',gko:'슈퍼주니어'}]},
  // 드림캐쳐 첫 공식 유닛(2026-08-05, 나무위키 대조) — 위와 동일 패턴.
  '유아유':{names:['유아유','UAU'],members:[{mko:'지유',gko:'드림캐쳐'},{mko:'수아',gko:'드림캐쳐'},{mko:'유현',gko:'드림캐쳐'}]},
  // 더블에스301(SS501 중 허영생·김규종·김형준 유닛, 2016.02.16 정식 데뷔)·블락비 바스타즈(블락비 중
  // 비범·유권·피오 유닛, 2015.04.14 데뷔) — 둘 다 한때 별도 groups.json 행성으로 잘못 추가했다가
  // "행성 승격 안 함" 원칙(V8 결정 때 확정, 위 주석 참고)에 맞게 유닛 표기로 되돌림(2026-08-10, 사용자 정정).
  '더블에스301':{names:['더블에스301','Double S 301','SS301'],members:[{mko:'허영생',gko:'SS501'},{mko:'김규종',gko:'SS501'},{mko:'김형준',gko:'SS501'}]},
  '바스타즈':{names:['바스타즈','Bastarz'],members:[{mko:'비범',gko:'블락비'},{mko:'유권',gko:'블락비'},{mko:'피오',gko:'블락비'}]},
  // 나인투식스(동키즈 민규·주원 듀오, 싱글 1집 GOOD TO YOU) — 앨범 하나뿐이라 행성 승격 안 함
  // (더블에스301·바스타즈와 같은 판단, 2026-09-03 사용자 결정).
  // 등록 이유는 **유닛 표기 자체**다(카드에 유닛 태그가 뜨고, 유닛명 토큰이 매칭 전에 제거된다).
  // ⚠️ 처음엔 "이게 오매칭 60건을 고친다"고 적었다가 지웠다 — 실측해보니 **유닛 없이도 현재 매처는
  //    이미 동키즈 민규·주원으로 정확히 잡는다.** DB의 `group_ko='온리원오프'` 60건은 옛 매처가 남긴
  //    재고이고, 재태깅 스윕으로 정리할 몫이다(오늘 아침 제로베이스원 285건과 같은 성격).
  '나인투식스':{names:['나인투식스','NINE to SIX','NINEtoSIX','NINE TO SIX'],members:[{mko:'민규',gko:'동키즈'},{mko:'주원',gko:'동키즈'}]},
  // 세븐틴 소유닛 — 부석순은 한때 groups.json 행성으로 등록됐다가 유닛 표기로 전환(2026-08-12, 사용자 요청).
  // 부석순 이름 유래: 부승관(Seungkwan)·이석민(DK)·권순영(Hoshi) 성명에서 각 한 글자씩.
  '부석순':{names:['부석순','BSS'],members:[{mko:'호시',gko:'세븐틴'},{mko:'도겸',gko:'세븐틴'},{mko:'승관',gko:'세븐틴'}]},
  '정한X원우':{names:['정한X원우','JeongWon'],members:[{mko:'정한',gko:'세븐틴'},{mko:'원우',gko:'세븐틴'}]},
  '호시X우지':{names:['호시X우지'],members:[{mko:'호시',gko:'세븐틴'},{mko:'우지',gko:'세븐틴'}]},
  '에스쿱스X민규':{names:['에스쿱스X민규','CxM','쿱스민규'],members:[{mko:'에스쿱스',gko:'세븐틴'},{mko:'민규',gko:'세븐틴'}]},
  '도겸X승관':{names:['도겸X승관','DK X SEUNGKWAN'],members:[{mko:'도겸',gko:'세븐틴'},{mko:'승관',gko:'세븐틴'}]},
  '아이린&슬기':{names:['아이린&슬기','레드벨벳 아이린&슬기','IRENE & SEULGI'],members:[{mko:'아이린',gko:'레드벨벳'},{mko:'슬기',gko:'레드벨벳'}]},
  'SM THE BALLAD':{names:['SM THE BALLAD','에스엠 더 발라드'],members:[{mko:'규현',gko:'슈퍼주니어'},{mko:'종현',gko:'샤이니'},{mko:'예성',gko:'슈퍼주니어'},{mko:'최강창민',gko:'동방신기'},{mko:'태연',gko:'소녀시대'},{mko:'첸',gko:'엑소'},{mko:'크리스탈',gko:'에프엑스'}]},
  // WayV 서브유닛 — 텐&양양(Ten & Yangyang) 음방 공동 활동(직캠 다수)
  '텐&양양':{names:['텐&양양','Ten & Yangyang','Ten&Yangyang'],members:[{mko:'텐',gko:'웨이션브이'},{mko:'양양',gko:'웨이션브이'}]},
  // ⚠️ rotating:true — "고정 멤버 유닛"이 아니라 곡마다 참여자가 바뀌는 로테이션 유닛.
  // 다른 유닛(부석순·V8 등)은 유닛명이 제목에 뜨면 그 멤버 전원이 참여한 게 맞지만, NCT U는 아래
  // members가 "NCT U로 활동한 적 있는 사람 명단"일 뿐이라 전원 확장하면 참여도 안 한 멤버까지
  // 태깅된다(2026-08-25 실측: 엔시티 유 영상에 비참여 멤버가 767건 붙어 있었음 — 지성321·마크114·
  // 정우113·재현113·도영106). rotating 유닛은 "제목에 이름이 따로 언급된 멤버"만 태깅한다.
  // 이름이 하나도 안 나오면 멤버 태깅 0명 — 자체 채널 영상이면 group_ko는 채널 기준으로 남으므로
  // 그룹 카드엔 그대로 뜨고 개별 멤버 카드에만 안 뜬다(전원 오태깅보다 이쪽이 안전).
  // 곡별 정확한 참여자 태깅은 별도 과제(사용자와 합의, 2026-08-25).
  'NCT U':{rotating:true,names:['NCT U','엔시티 유'],members:[
    {mko:'태용',gko:'엔시티 127'},{mko:'도영',gko:'엔시티 127'},{mko:'재현',gko:'엔시티 127'},{mko:'쟈니',gko:'엔시티 127'},{mko:'정우',gko:'엔시티 127'},{mko:'마크',gko:'엔시티 127'},{mko:'해찬',gko:'엔시티 127'},{mko:'유타',gko:'엔시티 127'},
    {mko:'런쥔',gko:'엔시티 드림'},{mko:'제노',gko:'엔시티 드림'},{mko:'재민',gko:'엔시티 드림'},{mko:'천러',gko:'엔시티 드림'},{mko:'지성',gko:'엔시티 드림'},
    {mko:'텐',gko:'웨이션브이'},{mko:'쿤',gko:'웨이션브이'},{mko:'윈윈',gko:'웨이션브이'},{mko:'샤오쥔',gko:'웨이션브이'},{mko:'양양',gko:'웨이션브이'},{mko:'헨드리',gko:'웨이션브이'},{mko:'루카스',gko:'웨이션브이'},
    {mko:'성찬',gko:'라이즈'},{mko:'쇼타로',gko:'라이즈'}
  ]},
  // SuperM(2019, SM 7인 연합 유닛 — EXO·SHINee·NCT127·WayV 합작, 2026-09-13 사용자 요청). 태티서·GOT THE
  // BEAT와 같은 성격(자체 그룹사 공식 연합)이라 행성 승격 없이 유닛 표기. 마크=엔시티127(갓세븐 마크와 동명이인
  // 방어), 루카스=WayV(전 멤버).
  'SuperM':{names:['SuperM','슈퍼엠'],members:[{mko:'백현',gko:'엑소'},{mko:'카이',gko:'엑소'},{mko:'태민',gko:'샤이니'},{mko:'태용',gko:'엔시티 127'},{mko:'마크',gko:'엔시티 127'},{mko:'텐',gko:'웨이션브이'},{mko:'루카스',gko:'웨이션브이'}]},
  // EXO 서브유닛
  'EXO-CBX':{names:['EXO-CBX','CBX','첸백시'],members:[{mko:'시우민',gko:'엑소'},{mko:'백현',gko:'엑소'},{mko:'첸',gko:'엑소'}]},
  'EXO-SC':{names:['EXO-SC','SC','세찬'],members:[{mko:'찬열',gko:'엑소'},{mko:'세훈',gko:'엑소'}]},
  // 인피니트 서브유닛
  '인피니트H':{names:['인피니트H','Infinite H'],members:[{mko:'장동우',gko:'인피니트'},{mko:'호야',gko:'인피니트'}]},
  '인피니트F':{names:['인피니트F','Infinite F'],members:[{mko:'이성열',gko:'인피니트'},{mko:'엘',gko:'인피니트'},{mko:'이성종',gko:'인피니트'}]},
  // BTOB 서브유닛
  'BTOB-BLUE':{names:['BTOB-BLUE','비투비 블루'],members:[{mko:'서은광',gko:'비투비'},{mko:'이창섭',gko:'비투비'},{mko:'임현식',gko:'비투비'},{mko:'육성재',gko:'비투비'}]},
  'BTOB 4U':{names:['BTOB 4U','비투비 4U'],members:[{mko:'서은광',gko:'비투비'},{mko:'이민혁',gko:'비투비'},{mko:'이창섭',gko:'비투비'},{mko:'프니엘',gko:'비투비'}]},
  // VIXX 서브유닛
  'VIXX LR':{names:['VIXX LR','빅스 LR'],members:[{mko:'레오',gko:'빅스'},{mko:'라비',gko:'빅스'}]},
  // 갓세븐 서브유닛
  'JJ Project':{names:['JJ Project','제이제이 프로젝트'],members:[{mko:'JAY B',gko:'갓세븐'},{mko:'진영',gko:'갓세븐'}]},
  'Jus2':{names:['Jus2','저스투'],members:[{mko:'JAY B',gko:'갓세븐'},{mko:'유겸',gko:'갓세븐'}]},
  // NU'EST 서브유닛
  "NU'EST W":{names:["NU'EST W",'뉴이스트 W'],members:[{mko:'JR',gko:'뉴이스트'},{mko:'아론',gko:'뉴이스트'},{mko:'백호',gko:'뉴이스트'},{mko:'렌',gko:'뉴이스트'}]},
  // 이달의소녀 서브유닛
  '이달의소녀 1/3':{names:['이달의소녀 1/3','LOONA 1/3','루나 1/3'],members:[{mko:'희진',gko:'아르테미스'},{mko:'하슬',gko:'아르테미스'},{mko:'현진',gko:'루셈블'},{mko:'여진',gko:'루셈블'},{mko:'비비',gko:'루셈블'}]},
  'ODD EYE CIRCLE':{names:['ODD EYE CIRCLE','오드아이서클'],members:[{mko:'김립',gko:'아르테미스'},{mko:'진솔',gko:'아르테미스'},{mko:'최리',gko:'아르테미스'}]},
  '이달의소녀 yyxy':{names:['이달의소녀 yyxy','LOONA yyxy','루나 yyxy'],members:[{mko:'이브',gko:'이달의소녀'},{mko:'츄',gko:'이달의소녀'},{mko:'고원',gko:'루셈블'},{mko:'올리비아 혜',gko:'루셈블'}]},
  // 몬스타엑스 서브유닛
  '셔누X형원':{names:['셔누X형원'],members:[{mko:'셔누',gko:'몬스타엑스'},{mko:'형원',gko:'몬스타엑스'}]},
  // 트와이스 서브유닛
  'MISAMO':{names:['MISAMO','미사모'],members:[{mko:'모모',gko:'트와이스'},{mko:'사나',gko:'트와이스'},{mko:'미나',gko:'트와이스'}]},
  // 오마이걸 서브유닛
  '오마이걸 반하나':{names:['오마이걸 반하나','OH MY GIRL BANHANA'],members:[{mko:'효정',gko:'오마이걸'},{mko:'유빈',gko:'오마이걸'},{mko:'아린',gko:'오마이걸'}]},
  // 스트레이키즈 서브유닛
  // 우주소녀 서브유닛
  '우주소녀 쪼꼬미':{names:['우주소녀 쪼꼬미','WJSN CHOCOME'],members:[{mko:'수빈',gko:'우주소녀'},{mko:'여름',gko:'우주소녀'},{mko:'다영',gko:'우주소녀'},{mko:'루다',gko:'우주소녀'}]},
  '우주소녀 더 블랙':{names:['우주소녀 더 블랙','WJSN THE BLACK'],members:[{mko:'설아',gko:'우주소녀'},{mko:'보나',gko:'우주소녀'},{mko:'엑시',gko:'우주소녀'},{mko:'은서',gko:'우주소녀'}]},
  // AOA 서브유닛
  'AOA BLACK':{names:['AOA BLACK','AOA 블랙'],members:[{mko:'유경',gko:'에이오에이'},{mko:'초아',gko:'에이오에이'},{mko:'민아',gko:'에이오에이'},{mko:'지민',gko:'에이오에이'},{mko:'유나',gko:'에이오에이'}]},
  'AOA CREAM':{names:['AOA CREAM','AOA 크림'],members:[{mko:'혜정',gko:'에이오에이'},{mko:'찬미',gko:'에이오에이'},{mko:'유나',gko:'에이오에이'}]},
  // 브라운아이드걸스 서브유닛
  'M&N':{names:['M&N'],members:[{mko:'미료',gko:'브라운아이드걸스'},{mko:'나르샤',gko:'브라운아이드걸스'}]},
  // 티아라 서브유닛
  'T-ARA N4':{names:['T-ARA N4','티아라 N4'],members:[{mko:'은정',gko:'티아라'},{mko:'효민',gko:'티아라'},{mko:'지연',gko:'티아라'},{mko:'아름',gko:'티아라'}]},
  // 1세대 그룹 서브유닛
  'jtL':{names:['jtL'],members:[{mko:'장우혁',gko:'H.O.T.'},{mko:'토니안',gko:'H.O.T.'},{mko:'이재원',gko:'H.O.T.'}]},
  'J-Walk':{names:['J-Walk','제이워크'],members:[{mko:'김재덕',gko:'젝스키스'},{mko:'장수원',gko:'젝스키스'}]},
  // '호우'(한글)는 유닛 이름으로 쓰지 않는다(2026-10-30, Codex 검수25차) — '호우 주의'(폭우)·몬스타엑스 '호우~' 같은 일반 단어로 세븐틴 직캠 합본 등에
  // 손호영·김태우가 붙었다. 영문 HOOW·HoooW(공식 표기)만 인정하고, 한글만 쓴 진짜 호우 영상은 멤버 실명(손호영·김태우)으로 잡힌다.
  '호우':{names:['HOOW','HoooW'],members:[{mko:'손호영',gko:'god'},{mko:'김태우',gko:'god'}]},
  '신화 WDJ':{names:['신화 WDJ','WDJ'],members:[{mko:'이민우',gko:'신화'},{mko:'김동완',gko:'신화'},{mko:'전진',gko:'신화'}]},
  // 아스트로 서브유닛
  '문빈&산하':{names:['문빈&산하','Moon Bin & San Ha'],members:[{mko:'문빈',gko:'아스트로'},{mko:'윤산하',gko:'아스트로'}]},
  '진진&라키':{names:['진진&라키'],members:[{mko:'진진',gko:'아스트로'},{mko:'라키',gko:'아스트로'}]},
  'ZOONIZINI':{names:['ZOONIZINI','주니주니'],members:[{mko:'MJ',gko:'아스트로'},{mko:'진진',gko:'아스트로'}]},
  // 비에이피 서브유닛
  'BANG & ZELO':{names:['BANG & ZELO','Bang&Zelo'],members:[{mko:'방용국',gko:'비에이피'},{mko:'젤로',gko:'비에이피'}]},
  // 레인보우 서브유닛
  '레인보우 픽시':{names:['레인보우 픽시','Rainbow Pixie'],members:[{mko:'조현영',gko:'레인보우'},{mko:'김지숙',gko:'레인보우'},{mko:'오승아',gko:'레인보우'}]},
  '레인보우 블랙':{names:['레인보우 블랙','Rainbow Black'],members:[{mko:'김재경',gko:'레인보우'},{mko:'고우리',gko:'레인보우'},{mko:'조현영',gko:'레인보우'},{mko:'오승아',gko:'레인보우'}]},
  '레인보우18':{names:['레인보우18','Rainbow18'],members:[{mko:'고우리',gko:'레인보우'},{mko:'조현영',gko:'레인보우'}]},
  // 나인뮤지스 서브유닛
  '나인뮤지스A':{names:['나인뮤지스A','9MUSES A'],members:[{mko:'경리',gko:'나인뮤지스'},{mko:'혜미',gko:'나인뮤지스'},{mko:'소진',gko:'나인뮤지스'},{mko:'금조',gko:'나인뮤지스'}]},
  // 다이아 서브유닛
  '빈챈현스':{names:['빈챈현스'],members:[{mko:'유니스',gko:'다이아'},{mko:'기희현',gko:'다이아'},{mko:'백예빈',gko:'다이아'},{mko:'정채연',gko:'다이아'}]},
  'L.U.B':{names:['L.U.B','엘유비'],members:[{mko:'주은',gko:'다이아'},{mko:'은채',gko:'다이아'}]},
  // 프리스틴 서브유닛
  'PRISTIN V':{names:['PRISTIN V','프리스틴 V'],members:[{mko:'임나영',gko:'프리스틴'},{mko:'로아',gko:'프리스틴'},{mko:'은우',gko:'프리스틴'},{mko:'레나',gko:'프리스틴'},{mko:'주결경',gko:'프리스틴'}]},
  // 포미닛 서브유닛
  '2YOON':{names:['2YOON','투윤'],members:[{mko:'허가윤',gko:'포미닛'},{mko:'전지윤',gko:'포미닛'}]},
  // 에이핑크 서브유닛
  'Apink 초봄':{names:['Apink 초봄'],members:[{mko:'박초롱',gko:'에이핑크'},{mko:'윤보미',gko:'에이핑크'}]},
  // 마마무 서브유닛
  '마마무+':{names:['마마무+','MAMAMOO+'],members:[{mko:'솔라',gko:'마마무'},{mko:'문별',gko:'마마무'}]},
  // DAY6 서브유닛
  'DAY6 (Even of Day)':{names:['DAY6 (Even of Day)','Even of Day','이븐 오브 데이'],members:[{mko:'Young K',gko:'데이식스'},{mko:'원필',gko:'데이식스'},{mko:'도운',gko:'데이식스'}]},
  // 빅뱅 서브유닛
  'GD&TOP':{names:['GD&TOP','GD & TOP'],members:[{mko:'지디',gko:'빅뱅'},{mko:'탑',gko:'빅뱅'}]},
  'GD X TAEYANG':{names:['GD X TAEYANG','G-DRAGON X TAEYANG','GDXTAEYANG'],members:[{mko:'지디',gko:'빅뱅'},{mko:'태양',gko:'빅뱅'}]},
  // ZE:A 서브유닛
  'ZE:A Five':{names:['ZE:A Five','ZEA Five'],members:[{mko:'Kevin',gko:'제국의아이들'},{mko:'하민우',gko:'제국의아이들'},{mko:'김동준',gko:'제국의아이들'},{mko:'임시완',gko:'제국의아이들'},{mko:'박형식',gko:'제국의아이들'}]},
  // 트리플에스 서브유닛 10종
  'Acid Angel from Asia':{names:['Acid Angel from Asia','AAA'],members:[{mko:'정혜린',gko:'트리플에스'},{mko:'김유연',gko:'트리플에스'},{mko:'김나경',gko:'트리플에스'},{mko:'공유빈',gko:'트리플에스'}]},
  '+(KR)ystal Eyes':{names:['+(KR)ystal Eyes','KRystal Eyes'],members:[{mko:'윤서연',gko:'트리플에스'},{mko:'이지우',gko:'트리플에스'},{mko:'김채연',gko:'트리플에스'},{mko:'김수민',gko:'트리플에스'}]},
  'LOVElution':{names:['LOVElution'],members:[{mko:'윤서연',gko:'트리플에스'},{mko:'정혜린',gko:'트리플에스'},{mko:'공유빈',gko:'트리플에스'},{mko:'카에데',gko:'트리플에스'},{mko:'서다현',gko:'트리플에스'},{mko:'니엔',gko:'트리플에스'},{mko:'박소현',gko:'트리플에스'},{mko:'신위',gko:'트리플에스'}]},
  'EVOLution':{names:['EVOLution'],members:[{mko:'이지우',gko:'트리플에스'},{mko:'김채연',gko:'트리플에스'},{mko:'김유연',gko:'트리플에스'},{mko:'김수민',gko:'트리플에스'},{mko:'김나경',gko:'트리플에스'},{mko:'코토네',gko:'트리플에스'},{mko:'곽연지',gko:'트리플에스'},{mko:'마유',gko:'트리플에스'}]},
  'NXT':{names:['NXT'],members:[{mko:'린',gko:'트리플에스'},{mko:'주빈',gko:'트리플에스'},{mko:'정하연',gko:'트리플에스'},{mko:'박시온',gko:'트리플에스'}]},
  // 'Aria' 유닛(이지우·김채연·카에데·서다현·니엔) 트리거였던 "Aria"/"아리아"는 삭제함(2026-08-21) —
  // 흔한 단어(곡명)라 다른 그룹들의 해당 곡 챌린지/커버 영상 해시태그(#아리아)에도 걸려 무관한 콜라보로
  // 대량 오매칭됨(Fable 감사로 실측 발견). "AAA"와 달리 해시태그로 좁혀도 챌린지 크레딧 자체가 해시태그를
  // 쓰기 때문에 구분이 안 돼 안전한 대체 트리거가 없음 — 이 유닛은 title 자동매칭 대상에서 제외.
  'Glow':{names:['Glow'],members:[{mko:'김채원',gko:'트리플에스'},{mko:'설린',gko:'트리플에스'},{mko:'서아',gko:'트리플에스'},{mko:'지연',gko:'트리플에스'}]},
  'Visionary Vision':{names:['Visionary Vision'],members:[{mko:'정혜린',gko:'트리플에스'},{mko:'김유연',gko:'트리플에스'},{mko:'김나경',gko:'트리플에스'},{mko:'공유빈',gko:'트리플에스'},{mko:'카에데',gko:'트리플에스'},{mko:'코토네',gko:'트리플에스'},{mko:'곽연지',gko:'트리플에스'},{mko:'니엔',gko:'트리플에스'},{mko:'박소현',gko:'트리플에스'},{mko:'신위',gko:'트리플에스'},{mko:'린',gko:'트리플에스'},{mko:'지연',gko:'트리플에스'}]},
  'hatch!':{names:['hatch!'],members:[{mko:'이지우',gko:'트리플에스'},{mko:'김채연',gko:'트리플에스'},{mko:'김유연',gko:'트리플에스'},{mko:'김수민',gko:'트리플에스'},{mko:'코토네',gko:'트리플에스'},{mko:'마유',gko:'트리플에스'},{mko:'박시온',gko:'트리플에스'},{mko:'김채원',gko:'트리플에스'}]},
  'msnz':{names:['msnz'],members:[{mko:'김유연',gko:'트리플에스'},{mko:'코토네',gko:'트리플에스'},{mko:'니엔',gko:'트리플에스'},{mko:'린',gko:'트리플에스'},{mko:'정하연',gko:'트리플에스'},{mko:'박시온',gko:'트리플에스'},{mko:'김채원',gko:'트리플에스'},{mko:'지연',gko:'트리플에스'}]},
  // 드리핀 서브유닛
  '차동협':{names:['차동협'],members:[{mko:'차준호',gko:'드리핀'},{mko:'이협',gko:'드리핀'},{mko:'김동윤',gko:'드리핀'}]},
  // 동키즈 서브유닛
  'DONGKIZ I:KAN':{names:['DONGKIZ I:KAN','동키즈 아이칸'],members:[{mko:'재찬',gko:'동키즈'}]},
  'NINE to SIX':{names:['NINE to SIX','나인 투 식스'],members:[{mko:'민규',gko:'동키즈'},{mko:'주원',gko:'동키즈'}]},
  // I.O.I 유닛
  'I.O.I (7인 유닛)':{names:['I.O.I 7인 유닛','Whatta Man'],members:[{mko:'임나영',gko:'아이오아이'},{mko:'청하',gko:'아이오아이'},{mko:'주결경',gko:'아이오아이'},{mko:'김소혜',gko:'아이오아이'},{mko:'최유정',gko:'아이오아이'},{mko:'김도연',gko:'아이오아이'},{mko:'전소미',gko:'아이오아이'}]},
  // 워너원 유닛
  // EXID 서브유닛
  '다소니':{names:['다소니','Dasoni'],members:[{mko:'솔지',gko:'이엑스아이디'},{mko:'하니',gko:'이엑스아이디'}]},
  // SS501 서브유닛
  'FIVE O ONE':{names:['FIVE O ONE','파이브 오 원'],members:[{mko:'김현중',gko:'SS501'},{mko:'허영생',gko:'SS501'},{mko:'김규종',gko:'SS501'}]},
  // 구구단 서브유닛
  '구구단 오구오구':{names:['구구단 오구오구','gugudan OGUOGU'],members:[{mko:'신보라',gko:'구구단'},{mko:'장소진',gko:'구구단'},{mko:'류셰닝',gko:'구구단'},{mko:'정미미',gko:'구구단'},{mko:'김세정',gko:'구구단'},{mko:'강미나',gko:'구구단'},{mko:'김나영',gko:'구구단'}]},
  '구구단 세미나':{names:['구구단 세미나','gugudan SEMINA'],members:[{mko:'김세정',gko:'구구단'},{mko:'강미나',gko:'구구단'},{mko:'김나영',gko:'구구단'}]},
  // B.D.U — 빌드업 서바이벌 프로젝트 보이그룹(2024.06~2026.03). 워너원·UNB처럼 서바이벌 프로젝트 그룹이라 행성 있음(groups.json).
  // 행성 있는 프로젝트 그룹(B.D.U·UNB)은 멤버 gko를 전원 그 그룹으로 — 원소속(씨아이엑스 등)으로 두면 B.D.U 무대에서 승훈이
  // 게스트로 빠지고, '솔로'로 두면 "빛새온(솔로)" 같은 유령 태그가 붙었다(2026-10-14 실측 66건).
  'B.D.U':{names:['B.D.U','비디유','Boys Define Universe'],members:[{mko:'빛새온',gko:'B.D.U'},{mko:'승훈',gko:'B.D.U'},{mko:'제이 창',gko:'B.D.U'},{mko:'김민서',gko:'B.D.U'}]},
  'UNB':{names:['UNB','유앤비'],members:[{mko:'강유찬',gko:'유앤비'},{mko:'고호정',gko:'유앤비'},{mko:'준',gko:'유앤비'},{mko:'이의진',gko:'유앤비'},{mko:'오광석',gko:'유앤비'},{mko:'박대원',gko:'유앤비'},{mko:'이형근',gko:'유앤비'},{mko:'지한솔',gko:'유앤비'},{mko:'김기중',gko:'유앤비'}]},
  // A SIX(에이식스, 2024.01.30 데뷔) — 포켓돌스튜디오가 UNB(2018) 이후 9년 만에 다시 낸 혼성 프로젝트
  // 유닛. BAE173·FANTASY BOYS·CLASS:y 멤버들로 구성. 6명 전원 등록(2026-09-27 완성).
  // ⚠️ 행성 없음(2026-10-14 사용자 결정) — 09-23에 groups.json 행성(projectRing)으로 등록했다가 GOT THE BEAT·SuperM과
  //    같은 "기존 그룹 멤버로 꾸린 레이블 유닛"이라 유닛 표기로 전환. 앨범은 멤버 unitDiscography로 이관.
  'A SIX':{names:['A SIX','에이식스'],members:[{mko:'제이민',gko:'BAE173'},{mko:'영서',gko:'BAE173'},{mko:'링치',gko:'판타지보이즈'},{mko:'이한빈',gko:'판타지보이즈'},{mko:'원지민',gko:'클라씨'},{mko:'박보은',gko:'클라씨'}]},
  // Double 0ne(더블원, 2025.06.12 데뷔) — 포켓돌스튜디오 BAE173+판타지보이즈 멤버 유닛. 활동 영상이 전부 2025 원년 11인 시절이라
  // 태깅용 명단도 11명(도하·강민서·이한빈·홍성민은 2026.04 탈퇴 — 이후 신규 활동이 생기면 그때 나눌 것).
  // ⚠️ 행성 없음(2026-10-14, A SIX와 같은 이유) — 앨범 Xpert는 원년 11명 unitDiscography로 이관.
  //    판타지보이즈 쪽은 히카리(a1504)다 — 09-27 등록 때 동명 히카루(a1507)로 잘못 들어가 있던 것 정정(10-14).
  'Double 0ne':{names:['Double 0ne','더블원'],members:[{mko:'유준',gko:'BAE173'},{mko:'무진',gko:'BAE173'},{mko:'준서',gko:'BAE173'},{mko:'영서',gko:'BAE173'},{mko:'빛',gko:'BAE173'},{mko:'도하',gko:'BAE173'},{mko:'강민서',gko:'판타지보이즈'},{mko:'이한빈',gko:'판타지보이즈'},{mko:'히카리',gko:'판타지보이즈'},{mko:'링치',gko:'판타지보이즈'},{mko:'홍성민',gko:'판타지보이즈'}]}
};

// ── 조회수 마일스톤 (2026-09-23) — admin.js(수집)와 index.html(트로피 표시) 양쪽이 봐야 해서 shared로.
// "이 영상이 새 조회수 단계를 넘었다"를 감지해 yt_view_milestones에 기록한다(view_milestones_
// migration.sql, 사용자 실행). 트로피 3종(music_show_wins·melon_yearly_top100·
// spotify_streaming_milestones)과 같은 모양의 append-only 로그.
// 설계(사용자와 합의): "콘텐츠(수집)는 넓게, 노출은 좁게" — 작은 그룹에게도 100만은 의미 있는 지표라
// 낮은 단계부터 전부 모으되(일일뉴스 소스), 카드에 영구 배지로 보여주는 건 그중 상위 티어만
// (_VM_TROPHY_MIN). 데이터는 하나, 화면 노출 기준만 둘로 가른다 — 기준을 바꾸고 싶으면 숫자만 조정.
const _VM_TIERS=[100000,500000,1000000,3000000,5000000,10000000,30000000,50000000,100000000,300000000,500000000,1000000000];
const _VM_TROPHY_MIN=10000000; // 트로피(카드 영구 배지)로 승격하는 최소 티어 — 그 아래는 일일뉴스에서만
// oldTier(이전에 알던 최고 단계, null이면 아직 한 번도 기록 안 됨)~newViewCount 사이에 새로 넘은 티어를
// 전부 돌려준다 — 순환 갱신 간격이 길면(특히 cold 큐, 최대 24일) 한 번에 여러 단계를 건너뛸 수 있어서
// 최고 단계 하나만 보면 중간 단계가 통째로 로그에서 빠진다.
function _vmCrossedTiers(oldTier,newViewCount){
  if(newViewCount==null||isNaN(newViewCount))return[];
  const floor=oldTier||0;
  return _VM_TIERS.filter(t=>t>floor&&t<=newViewCount);
}
// 트로피 패널·일일뉴스에서 티어를 한글/영문 숫자 단위로 표기. 스트림 마일스톤용 _fmtStreamMilestone
// (index.html)은 억/B 단위 전제라 1억 미만 티어(10만~5000만)에서 "0.1억"처럼 어색해져 따로 둔다.
function _fmtViewMilestone(n){
  if(currentLang==='ko'){
    if(n>=1e8)return`${n/1e8}억+`;
    return`${n/1e4}만+`;
  }
  if(n>=1e9)return`${n/1e9}B+`;
  if(n>=1e6)return`${n/1e6}M+`;
  return`${n/1e3}K+`;
}

// ── 행사(시상식·연말 무대·페스티벌·해외 특집 음방) 시리즈 정의 (2026-10-15) ─────────────────────────
// 영상 제목에서 행사를 찾아 content_formats에 'EV:<시리즈>'와 'EV:<시리즈>:<회차>' 두 태그를 붙인다(admin.js 세부 포맷 스윕).
// 회차 = 연도(+도시). 태그는 포맷 알약 목록(_CONTENT_FORMAT_ORDER)에 없는 이름이라 카드에 텍스트로 안 뜨고,
// 행사 페이지(검색·발견 선반)만 이걸로 조회한다(사용자: "카드에 행사 칩까지는 과하다").
// q: 검색어 별칭(공백 없이 소문자 비교) · kw: 태그가 아직 안 붙은 영상을 title_norm ilike로 찾을 때의 키워드(행사 페이지 폴백).
// re: 행사 표기(대소문자 무시). city: 도시가 회차를 가르는 시리즈(KCON·해외 특집 음방)는 도시 캡처 정규식.
// late: 연말(11~12월) 행사 — 제목에 연도가 없으면 11월 전 업로드는 직전 해 회차로 본다(그해 회차는 아직 안 열렸다).
//       연초 행사(골든디스크·서울가요대상·한터)는 업로드 연도 그대로.
const _EV_CITY={바르셀로나:'Barcelona',BARCELONA:'Barcelona',리스본:'Lisbon',LISBON:'Lisbon',후쿠오카:'Fukuoka',FUKUOKA:'Fukuoka',이스탄불:'Istanbul',ISTANBUL:'Istanbul',
  파리:'Paris',PARIS:'Paris',마드리드:'Madrid',MADRID:'Madrid',칠레:'Chile',CHILE:'Chile',멕시코:'Mexico',MEXICO:'Mexico',자카르타:'Jakarta',JAKARTA:'Jakarta',
  싱가포르:'Singapore',SINGAPORE:'Singapore',홍콩:'Hong Kong',HONGKONG:'Hong Kong','HONG KONG':'Hong Kong',도쿄:'Tokyo',TOKYO:'Tokyo',베를린:'Berlin',BERLIN:'Berlin',
  하노이:'Hanoi',HANOI:'Hanoi',브라질:'Brazil',BRAZIL:'Brazil',벨기에:'Antwerp',BELGIUM:'Antwerp',ANTWERP:'Antwerp',안트베르펜:'Antwerp',프랑스:'Paris',FRANCE:'Paris',HONG:'Hong Kong',ABU:'Abu Dhabi',LISBOA:'Lisbon',
  일본:'Japan',재팬:'Japan',JAPAN:'Japan',LA:'LA',미국:'USA',USA:'USA',NY:'NY',태국:'Thailand',THAILAND:'Thailand','사우디아라비아':'Saudi Arabia','SAUDI ARABIA':'Saudi Arabia',
  독일:'Germany',GERMANY:'Germany',호주:'Australia',AUSTRALIA:'Australia',대만:'Taiwan',TAIWAN:'Taiwan',중국:'China',CHINA:'China',홍콩특별:'Hong Kong',
  인도네시아:'Indonesia',INDONESIA:'Indonesia',베트남:'Vietnam',VIETNAM:'Vietnam',튀르키예:'Turkey',TURKEY:'Turkey',영국:'UK',UK:'UK',LONDON:'London',런던:'London',
  'ABU DHABI':'Abu Dhabi',아부다비:'Abu Dhabi',SAITAMA:'Saitama',사이타마:'Saitama',OSAKA:'Osaka',오사카:'Osaka',MANILA:'Manila',마닐라:'Manila',BANGKOK:'Bangkok',방콕:'Bangkok'};
const _EVENT_SERIES=[
  // 시상식
  {id:'mama',q:['마마','mama','마마어워즈','mamaawards','엠넷아시안뮤직어워즈'],kw:['mama award','mama20','mama 20','mama x','0mama','1mama','2mama','3mama','4mama','5mama','6mama','7mama','8mama','9mama'] /* 'mama'는 마마무가 상한(1500)을 채워 행사 영상이 잘렸다 */,ko:'MAMA AWARDS',kind:'award',late:true,re:/(?:19|20)\d\d\s*MAMA\b|\bMAMA\s*(?:AWARDS|(?:19|20)\d\d)|MNET\s*ASIAN\s*MUSIC\s*AWARDS|마마\s*어워즈|엠넷\s*아시안\s*뮤직\s*어워즈/i},
  {id:'aaa',q:['aaa','아시아아티스트어워즈','asiaartistawards'],kw:['asia artist award','aaa20','aaa 20'],ko:'AAA (Asia Artist Awards)',kind:'award',late:true,re:/ASIA\s*ARTIST\s*AWARDS?|아시아\s*아티스트\s*어워즈|#?AAA\s*(?:19|20)\d\d|(?:19|20)\d\d\s*AAA\b|#AAA20\d\d/i},
  {id:'gda',q:['골든디스크','goldendisc','골디','골든디스크어워즈'],kw:['골든디스크','golden disc'],ko:'골든디스크 어워즈',kind:'award',re:/골든\s*디스크|GOLDEN\s*DISC/i},
  {id:'mma',q:['mma','멜론뮤직어워드','멜뮤','melonmusicawards'],kw:['melon music award','멜론뮤직어워드','mma20','mma 20'],ko:'MMA (멜론뮤직어워드)',kind:'award',late:true,re:/MELON\s*MUSIC\s*AWARDS?|멜론\s*뮤직\s*어워드|#?MMA\s*(?:19|20)\d\d|(?:19|20)\d\d\s*MMA\b/i},
  {id:'sma',q:['서울가요대상','서가대','seoulmusicawards'],kw:['서울가요대상','seoul music award'],ko:'서울가요대상',kind:'award',re:/서울\s*가요\s*대상|SEOUL\s*MUSIC\s*AWARDS/i},
  {id:'hma',q:['한터뮤직어워즈','한터','hanteomusicawards'],kw:['한터뮤직','hanteo music'],ko:'한터뮤직어워즈',kind:'award',re:/한터\s*뮤직\s*어워즈|HANTEO\s*MUSIC\s*AWARDS/i},
  {id:'kgma',q:['kgma','코리아그랜드뮤직어워즈'],kw:['kgma','korea grand music'],ko:'KGMA (코리아그랜드뮤직어워즈)',kind:'award',late:true,re:/\bKGMA\b|KOREA\s*GRAND\s*MUSIC\s*AWARDS|코리아\s*그랜드\s*뮤직\s*어워즈/i},
  {id:'tma',q:['더팩트뮤직어워즈','tma','thefactmusicawards'],kw:['더팩트 뮤직','the fact music'],ko:'더팩트 뮤직 어워즈',kind:'award',late:true,re:/THE\s*FACT\s*MUSIC\s*AWARDS|더팩트\s*뮤직\s*어워즈|\bTMA\s*(?:19|20)\d\d/i},
  // 연말 무대
  {id:'sbs-gayo',q:['가요대전','sbs가요대전','gayodaejeon'],kw:['가요대전','gayo daejeon'],ko:'SBS 가요대전',kind:'yearend',late:true,re:/가요\s*대전|SBS\s*GAYO\s*DAEJEON/i},
  {id:'mbc-gayo',q:['가요대제전','mbc가요대제전','mbc가요제'],kw:['가요대제전','mbc music festival'],ko:'MBC 가요대제전',kind:'yearend',late:true,re:/가요\s*대제전|MBC\s*GAYO\s*DAEJEJEON|MBC\s*MUSIC\s*FESTIVAL/i},
  {id:'kbs-gayo',q:['가요대축제','kbs가요대축제','kbs가요축제'],kw:['가요대축제','kbs song festival'],ko:'KBS 가요대축제',kind:'yearend',late:true,re:/가요\s*대축제|KBS\s*SONG\s*FESTIVAL/i},
  // 페스티벌·콘서트
  {id:'kcon',q:['kcon','케이콘'],kw:['kcon','케이콘'],ko:'KCON',kind:'festival',re:/\bKCON\b|케이콘/i,city:/\bKCON\s*(?:(?:19|20)\d\d\s*)?(JAPAN|LA|USA|NY|THAILAND|SAUDI ARABIA|GERMANY|FRANCE|MEXICO|AUSTRALIA|CHINA|TAIWAN|HONG ?KONG|ABU DHABI|INDONESIA|VIETNAM|UK|LONDON|SAITAMA|OSAKA)|\bKCON\s*(?:19|20)\d\d\s*(JAPAN|LA|USA|NY|THAILAND|SAUDI ARABIA|GERMANY|FRANCE|MEXICO|AUSTRALIA|CHINA|TAIWAN|HONG ?KONG)|케이콘\s*(재팬|일본|LA|미국|태국|사우디)/i},
  {id:'waterbomb',q:['워터밤','waterbomb'],kw:['워터밤','waterbomb'],ko:'워터밤',kind:'festival',re:/워터밤|WATERBOMB/i},
  {id:'dream',q:['드림콘서트','드콘','dreamconcert'],kw:['드림콘서트','dream concert'],ko:'드림콘서트',kind:'festival',re:/드림\s*콘서트|DREAM\s*CONCERT/i},
  {id:'lolla',q:['롤라팔루자','롤라','lollapalooza'],kw:['lollapalooza','롤라팔루자'],ko:'롤라팔루자',kind:'festival',re:/롤라팔루자|LOLLAPALOOZA/i},
  {id:'coachella',q:['코첼라','coachella'],kw:['coachella','코첼라'],ko:'코첼라',kind:'festival',re:/코첼라|COACHELLA/i},
  {id:'summersonic',q:['서머소닉','섬머소닉','summersonic'],kw:['summer sonic','서머소닉','섬머소닉'],ko:'서머소닉',kind:'festival',re:/서머\s*소닉|섬머\s*소닉|SUMMER\s*SONIC/i},
  // 해외 시상식·무대(2026-10-16, 사용자 "해외 페스티벌·시상식도 — 코첼라나 AMA"). DB 제목 실측 후 영상이 있는 것만:
  // AMA·그래미·징글볼·위버스콘·SMTOWN LIVE 등. 'AMAs'는 낱말 경계로만(dramas·pajamas 안의 amas 오탐 방지).
  {id:'ama',q:['ama','아메리칸뮤직어워즈','americanmusicawards'],kw:['american music award','amas'],ko:'AMA (아메리칸 뮤직 어워즈)',kind:'award',abroad:true,late:true,re:/AMERICAN\s*MUSIC\s*AWARDS?|\bAMAs\b|아메리칸\s*뮤직\s*어워즈/i},
  {id:'bbma',q:['빌보드뮤직어워드','bbma','billboardmusicawards'],kw:['billboard music award','bbmas'],ko:'빌보드 뮤직 어워드',kind:'award',abroad:true,re:/BILLBOARD\s*MUSIC\s*AWARDS?|\bBBMAs?\b|빌보드\s*뮤직\s*어워(?:드|즈)/i},
  {id:'vma',q:['vma','mtvvma','비디오뮤직어워드'],kw:['vmas','video music award'],ko:'MTV VMA',kind:'award',abroad:true,re:/\bVMAs?\b|VIDEO\s*MUSIC\s*AWARDS?/i},
  {id:'ema',q:['mtvema','엠티비ema','유럽뮤직어워드'],kw:['mtv ema','europe music award'],ko:'MTV EMA',kind:'award',abroad:true,re:/MTV\s*EMAs?\b|EUROPE\s*MUSIC\s*AWARDS?/i},
  {id:'grammy',q:['그래미','grammy','grammys'],kw:['grammy','그래미'],ko:'그래미 어워즈',kind:'award',abroad:true,re:/GRAMMYS?|그래미/i},
  {id:'jingle',q:['징글볼','jingleball'],kw:['jingle ball','징글볼'],ko:'징글볼 (iHeartRadio)',kind:'festival',abroad:true,re:/JINGLE\s*BALL|징글\s*볼/i},
  {id:'gcf',q:['글로벌시티즌','globalcitizen'],kw:['global citizen'],ko:'글로벌 시티즌 페스티벌',kind:'festival',abroad:true,re:/GLOBAL\s*CITIZEN|글로벌\s*시티즌/i},
  {id:'kohaku',q:['홍백','홍백가합전','kohaku'],kw:['紅白','홍백'],ko:'NHK 홍백가합전',kind:'yearend',abroad:true,late:true,re:/紅白|홍백\s*가합전|KOHAKU/i},
  {id:'weversecon',q:['위버스콘','weversecon'],kw:['weverse con','위버스콘'],ko:'위버스콘 페스티벌',kind:'festival',re:/WEVERSE\s*CON|위버스\s*콘/i},
  {id:'smtown',q:['smtownlive','에스엠타운','슴콘'],kw:['smtown live','에스엠타운 라이브'],ko:'SMTOWN LIVE',kind:'festival',re:/SMTOWN\s*LIVE|에스엠타운\s*라이브/i},
  // 해외 특집 음방
  {id:'mb-in',q:['뮤직뱅크월드투어','뮤뱅월투','뮤직뱅크인','musicbankworldtour','뮤직뱅크해외'],kw:['뮤직뱅크 인','music bank in','뮤직뱅크 월드투어','music bank world tour'],ko:'뮤직뱅크 월드투어',kind:'overseas',re:/뮤직\s*뱅크\s*인\s*[가-힣]|MUSIC\s*BANK\s*IN\s+[A-Z]|MUSIC\s*BANK\s*WORLD\s*TOUR|뮤직뱅크\s*월드투어/i,city:/뮤직\s*뱅크\s*인\s*([가-힣]+)|MUSIC\s*BANK\s*IN\s+([A-Z]+)/i},
  {id:'ink-in',q:['인기가요해외','인기가요인'],kw:['인기가요 인','inkigayo in'],ko:'인기가요 해외 특집',kind:'overseas',re:/인기가요\s*인\s*[가-힣]|INKIGAYO\s*IN\s+[A-Z]/i,city:/인기가요\s*인\s*([가-힣]+)|INKIGAYO\s*IN\s+([A-Z]+)/i},
  {id:'mcd-in',q:['엠카운트다운해외','엠카해외','mcountdownin'],kw:['m countdown in','엠카운트다운 인'],ko:'엠카운트다운 해외 특집',kind:'overseas',re:/M\s*COUNTDOWN\s*IN\s+[A-Z]|엠카운트다운\s*인\s*[가-힣]/i,city:/M\s*COUNTDOWN\s*IN\s+([A-Z]+)|엠카운트다운\s*인\s*([가-힣]+)/i},
];
// 도시 정규식은 대안이 여럿이라 처음 채워진 캡처를 쓴다("케이콘 재팬"은 3번째 그룹 — 1·2번만 보다가 도시가 빠졌다).
// 제목(+업로드 날짜)에서 행사 태그 — [] 또는 ['EV:mama','EV:mama:2025'] (도시가 있으면 'EV:kcon:2026-Japan')
function _eventTags(title,publishedAt){
  const t=String(title||'');if(!t)return [];
  const out=[];
  for(const s of _EVENT_SERIES){
    const m=s.re.exec(t);if(!m)continue;
    // 연도: 행사 표기 근처(앞뒤 24자)의 연도 → 제목 어디든 연도 → 업로드 연도(연말 행사는 1~2월이면 전년도)
    const near=t.slice(Math.max(0,m.index-24),m.index+m[0].length+24);
    let y=(near.match(/(?:19|20)\d\d/)||t.match(/(?:19|20)\d\d/)||[])[0];
    // '251010 방송' 같은 6자리 날짜는 연도로 안 본다 — 위 정규식은 4자리만이라 '2510'을 잡을 수 있어 범위 확인
    if(y&&(+y<1995||+y>2035))y=null;
    if(!y&&publishedAt){const p=String(publishedAt);y=p.slice(0,4);if(s.late&&+p.slice(5,7)<11)y=String(+y-1);}
    if(!y)continue;
    let ed=y;
    if(s.id==='sbs-gayo'&&/썸머|SUMMER/i.test(near))ed=y+'-Summer'; // 2026 가요대전 썸머(8월) — 연말 가요대전과 별개 회차
    if(s.city){const c=s.city.exec(t);const raw=c&&(c.slice(1).find(Boolean)||'').trim().toUpperCase();const city=raw&&(_EV_CITY[raw]||_EV_CITY[raw.replace(/\s+/g,'')]||(/^[A-Z ]+$/.test(raw)?raw[0]+raw.slice(1).toLowerCase():raw));if(city)ed=y+'-'+city;}
    out.push('EV:'+s.id,'EV:'+s.id+':'+ed);
  }
  return out;
}

// ── 영상 ↔ 곡 연결(2026-10-16) ──────────────────────────────────────────────────────────────
// 왜: "곡 → 영상"이 제목에 곡명 글자가 있나(title_norm ilike)로만 찾아서, 'ON'·'Hot' 같은 짧은 곡명엔 남의 영상이 섞이고
// 한영 표기가 다르면 빠지고 50개에서 잘렸다. 영상마다 "어느 곡인지"를 키로 박아 두면 곡 단위로 정확히 모을 수 있다
// (사용자 자문 메모 — Luminate의 "곡·녹음·앨범을 식별자로 연결하는 구조", 2026-10-16).
// 키 = '<영상 주인 group_ko>:<곡 기본형>'. 기본형은 (feat.)·(Remix)·(… Ver.) 꼬리를 뗀 정규형이라 리믹스·버전이 한 곡으로 묶인다.
// 멜론 곡 번호 대신 이름 키를 쓰는 이유: 번호는 수록곡의 85%에만 있고, 같은 곡의 버전마다 번호가 달라 묶기가 어렵다.
// 실측(아이브·에스파·뉴진스 각 1,000개, 2026-10-16): 음방·직캠 82~99% 연결. 함정 3개를 아래 규칙으로 막았다 —
//   ① 곡명=그룹명(뉴진스 'New Jeans')은 뉴진스 영상 전부에 걸린다 → 따옴표로 감쌌을 때만
//   ② 쇼츠 해시태그 나열(#ATTITUDE #REBELHEART)은 아무 곡이나 걸린다 → 해시태그는 딱 한 곡만 나올 때만
//   ③ 메들리('LOVE DIVE + 해야')는 곡이 여럿 → 키를 여러 개(최대 5)
const _SONG_TAIL_RE=/\s*[\(\[][^)\]]*(?:feat|with|remix|ver\b|version|inst|mix\b|edit\b|prod\b|english|japanese|korean|acoustic|live\b|sped|slowed|demo|op\.|solo\b|unit\b)[^)\]]*[\)\]]/gi; // '(JUN Solo)'·'(HOSHI Solo)' 같은 멤버 솔로 표기도 꼬리
// 폭 0 문자 — 'YOUNG(폭0)CREATOR(폭0)CREW'처럼 보이지 않게 띄운 제목이 단어 경계 검사에서 떨어졌다(2026-10-28)
const _SONG_ZW=/[\u200b-\u200d\u2060\ufeff]/g;
function _songNorm(s){return String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龥]/g,'');}
// 꼬리 떼기 — 괄호 꼬리 + 일본반의 대시 표기('Chk Chk Boom -Japanese ver.-')
function _songStripTail(title){return String(title||'').replace(_SONG_TAIL_RE,'').replace(/\s*-[^-]*\bver(?:sion)?\b\.?[^-]*-\s*$/i,'');}
// 기본형 = 버전·피처링 꼬리를 뗀 뒤 **첫 괄호 앞까지**. 멜론은 'ULTRA (창빈) ULTRA (Changbin)'·'그렇게, 천천히, 우리 (승민) As we are (Seungmin)'처럼
// 한글판·영어판을 한 제목에 붙여 두는데, 끝 괄호만 떼면 'ultra창빈ultra'가 됐다(2026-10-16 표본). 괄호 뒤 다른 표기는 별칭(_songListFromDisco).
function _songBase(title){
  const t=_songStripTail(title);
  return _songNorm(t.split(/\s*[\(\[]/)[0])||_songNorm(t);
}
// 따옴표 없이 제목에 들어 있는 것만으로는 안 믿는 흔한 낱말 곡명(4글자 이상이어도)
const _SONG_COMMON=new Set(['love','baby','girls','girl','boys','dream','dreams','star','stars','magic','fire','light','heart','money','party','world','summer','winter','spring','happy','sorry','hello','smile','queen','king','game','time','life','home','night','dance','music','angel','crown','rain','snow','blue','gold','free','alone','again','forever','beautiful','intro','outro','interlude','shorts','live','stage','special','teaser','focus','close','with','only','more','what','this','that','yours','mine','good','bad','real','next','last','first','young','wild','sweet','pink','black','white','highlight','behind','vlog','episode','well','habit','yawn','solo','encore']); // solo·encore(2026-11-12 Codex): '준호 Solo Concert'·'1위 앵콜'이 박재범 솔로곡 'Solo' 등으로 묶였다
// songs: [{b:기본형}] (한 주인의 곡 목록, 중복 기본형 제거된 것) · blockNames: 주인 이름 정규형(그룹 ko/en 등)
// 반환: 기본형 배열(최대 5) — 키로 쓸 땐 주인 키를 앞에 붙인다
function _songLinkBases(title,songs,blockNames){
  const t=String(title||'');if(!t||!songs||!songs.length)return [];
  const bset=new Map(songs.map(s=>[s.b,s]));
  const amap=new Map();songs.forEach(s=>(s.alias||[]).forEach(al=>{if(!bset.has(al.n)&&!amap.has(al.n))amap.set(al.n,s.b);})); // 별칭 → 기본형
  const look=n=>bset.has(n)?n:(amap.get(n)||null);
  const out=[];const add=b=>{if(b&&!out.includes(b)&&out.length<5)out.push(b);};
  const blocked=new Set((blockNames||[]).map(_songNorm).filter(Boolean));
  // ① 따옴표·꺾쇠 안 = 곡명(직캠·음방 제목 관례). 이름 막기(blocked)도 여기선 통과 — 'New Jeans'라고 감싸면 곡이다
  const Q=/['‘’"“”「」『』<>＜＞《》〈〉]([^'‘’"“”「」『』<>＜＞《》〈〉\n]{1,60})['‘’"“”「」『』<>＜＞《》〈〉]/g;
  for(const m of t.matchAll(Q)){
    // 메들리를 한 따옴표에 넣은 것('LOVE DIVE + 해야')도 나눠 본다
    for(const part of m[1].split(/\s*(?:\+|&|,|\/|×|x\s)\s*/)){add(look(_songBase(part)));}
    add(look(_songBase(m[1])));
    // 따옴표 안이 '아낀다 (Adore U)'처럼 두 표기면 괄호 안도 본다
    const inner=/[\(\[]([^)\]]+)[\)\]]/.exec(m[1]);if(inner)add(look(_songNorm(inner[1])));
  }
  // ①-2 "가수 - 곡" / "곡 - 가수"(음방·직캠 제목 관례, 2026-10-28): 대시 한쪽이 주인 이름을 품고 다른 쪽이 곡이면 짧은 곡명('GO!'·'TNT')도 믿는다.
  //   실측: 코르티스 퍼포먼스 미연결 207개 중 'CORTIS (코르티스) - TNT |'·'– GO! FanCam'·'GO! - CORTIS [뮤직뱅크'가 수십 개.
  //   곡 쪽은 앞에서부터 낱말을 줄여 가며 곡 목록과 **정확히** 맞는 것만('TNT FanCam' → 'TNT'). 원곡 표기가 따로 있는 커버('MIC Drop … - CORTIS')는 곡 목록에 없어 안 걸린다.
  //   🎵 뒤(보이스캠 '🎵GO!｜')도 같은 방식.
  const dash=[]; // 아래 ②까지 끝난 뒤에 붙인다 — 예전 규칙으로 잡던 키의 순서를 안 바꿔야 전량 재계산 때 안 바뀐 행을 다시 쓰지 않는다
  // 곡 쪽 끊기: 구분자(| ｜ [ ] ( ) # @ , 따옴표, 낱말 ' l '·'ㅣ')까지. 앞 따옴표는 벗긴다('“FOREVER” 미방분').
  const _cut=x=>x.replace(/^\s*['‘’"“”]/,'').split(/[|｜\[\]【】#@(（)）「『,'‘’"“”]|\s[lㅣ]\s/)[0].trim();
  // 낱말을 뒤에서부터 줄여 맞추되, 떼어 낸 뒷말이 군말(직캠·FanCam·4K…)일 때만 — 'Hot Summer'(커버)가 'HOT'으로 잡히던 것 막기
  const _NOISE=/^(?:fan\s*cam|full\s*cam|face\s*cam|focus|cam|직캠|풀캠|페이스캠|세로|가로|ver\.?|version|\d+k|\d+p|60fps|mv|m\/v|stage|live|무대|교차편집|클린|clean|원픽캠|직캠모먼트|by|of|the|[a-z가-힣]+캠)$/i;
  const _lead=x=>{const w=_cut(x.replace(_SONG_ZW,'')).split(/\s+/).filter(Boolean).slice(0,8);
    for(let k=w.length;k>0;k--){if(w.slice(k).some(z=>!_NOISE.test(z)))continue;const b=look(_songBase(w.slice(0,k).join(' ')));if(b)return b;}return null;};
  const _hasOwner=x=>{const n=_songNorm(x);return [...blocked].some(o=>o.length>=2&&n.includes(o));};
  for(const m of t.matchAll(/\s[-–—－]\s/g)){
    const L=t.slice(0,m.index),R=t.slice(m.index+m[0].length);
    const Lseg=L.split(/[|｜\]】」』]/).pop();
    if(_hasOwner(Lseg))dash.push(_lead(R));
    // 주인 이름이 괄호로 시작하면('Fate - (G)I-DLE [Music Bank]') _cut이 '('에서 잘라 빈 문자열이 된다 — 괄호는 살린 앞 낱말로 한 번 더(11-11)
    else if(_hasOwner(_cut(R).split(/\s+/).slice(0,4).join(' '))||_hasOwner(R.split(/[|｜\[\]【】#@]/)[0].split(/\s+/).slice(0,2).join(' ')))dash.push(look(_songBase(Lseg.replace(_SONG_ZW,'').trim())));
  }
  for(const m of t.matchAll(/🎵\s*([^\n]+)/g))dash.push(_lead(m[1]));
  // ② 해시태그를 뺀 본문에서 곡명 포함 — 4글자 이상·흔한 낱말 아님·주인 이름 아님. 긴 곡명 안에 든 짧은 곡명은 버린다
  const noTags=t.replace(/#[^\s#]+/g,' ');
  const body=_songNorm(noTags);
  const tl=noTags.toLowerCase().normalize('NFKC').replace(_SONG_ZW,''); // 단어 경계 검사용(공백·기호 살아 있는 소문자, 폭 0 문자는 뺌)
  const hits=[];
  // 주인 이름(4글자↑)을 지운 본문 — 'NCT WISH' 안의 곡 'WISH'가 모든 영상에 걸리던 것(2026-11-13 Codex). 따옴표 속 곡은 ①에서 이미 잡힌다
  const bodyNO=[...blocked].filter(o=>o.length>=4).reduce((x,o)=>x.split(o).join('|'),body);
  for(const s of songs){
    // 길이 문턱: 한글만으로 된 곡명은 3글자부터('아낀다'·'손오공'), 나머지는 4글자부터(영어 'ON'·'HOT' 같은 짧은 낱말 오탐)
    if((/^[가-힣]+$/.test(s.b)?s.b.length<3:s.b.length<4)||_SONG_COMMON.has(s.b)||blocked.has(s.b))continue;
    if(!body.includes(s.b)||(!bodyNO.includes(s.b)&&![...blocked].some(n=>n.length>=4&&s.b.includes(n))))continue; // 곡 이름에 그룹 이름이 든 곡(SHINee In The House)은 그대로
    // 영어 곡명은 단어 단위로만 — 'ICON'이 '[Dicon]' 안에 걸리던 오탐(2026-10-16 표본). 원제목 낱말을 공백·기호 무관하게 이어 붙인 정규식
    if(/^[a-z0-9]+$/.test(s.b)&&s.title){
      if(s.re===undefined){
        const core=_songStripTail(s.title).replace(/\s*[\(\[][^)\]]*[\)\]]\s*$/,'')||s.title;
        const w=String(core).toLowerCase().normalize('NFKC').replace(_SONG_ZW,'').match(/[a-z0-9]+/g);
        s.re=w?new RegExp('(^|[^a-z0-9])'+w.join('[^a-z0-9]*')+'(?![a-z0-9])'):null;
      }
      if(s.re&&!s.re.test(tl))continue;
    }
    hits.push(s.b);
  }
  // ②-별칭: 디스코의 '쌍둥이자리 (Gemini)'처럼 괄호 안 다른 표기(s.alias) — 한글 3글자↑·영어 4글자↑(단어 경계)
  for(const s of songs){
    if(!s.alias)continue;
    for(const al of s.alias){
      if(al.q||blocked.has(al.n)||_SONG_COMMON.has(al.n)||!body.includes(al.n))continue; // q = 따옴표·대시로만 믿는 별칭(_songAddNicks)
      const hangul=/^[가-힣]+$/.test(al.n);
      if(hangul?al.n.length<3:al.n.length<5)continue; // 영어 별칭은 5글자부터 — '별빛 ⇐ Stay'·'엉망 ⇐ Mess' 같은 흔한 낱말은 따옴표로만
      if(/^[a-z0-9]+$/.test(al.n)){const w=al.raw.toLowerCase().normalize('NFKC').match(/[a-z0-9]+/g);if(w&&!new RegExp('(^|[^a-z0-9])'+w.join('[^a-z0-9]*')+'(?![a-z0-9])').test(tl))continue;}
      hits.push(s.b);break;
    }
  }
  hits.sort((a,b)=>b.length-a.length).forEach(b=>{if(!out.some(o=>o.includes(b)))add(b);});
  dash.forEach(add);
  // ③ 아무것도 못 찾았을 때만 해시태그 — 곡과 정확히 같은 태그가 딱 한 곡일 때만(나열형 쇼츠 오탐 방지)
  if(!out.length){
    const tags=[...t.matchAll(/#([^\s#]+)/g)].map(m=>{const n=_songNorm(m[1]);return bset.has(n)?n:(amap.get(n)||null);}).filter(b=>b&&!blocked.has(b));
    const uniq=[...new Set(tags)];
    if(uniq.length===1)add(uniq[0]);
  }
  // ④ 다른 곡 이름 속 짧은 곡(2026-11-13 Codex — 세븐틴 'CHEERS' ⇐ '청춘찬가 (Cheers to youth)', 동방신기 'Down' ⇐ 'Keep Your Head Down',
  //    비투비 'Stay' ⇐ '불씨 (Please Stay)', GOT7 'if you' ⇐ 'If You Do(니가 하면)', 빅뱅 'Fall In Love' ⇐ "LET'S NOT FALL IN LOVE").
  //    함께 잡힌 곡의 다른 표기(별칭·괄호 표기, 제목에서 그 곡 바로 뒤 괄호) 안에 이 곡이 통째로 들어 있으면 이 곡은 뺀다.
  if(out.length>1){
    const sOf=new Map(songs.map(s=>[s.b,s]));
    const formsOf=b=>{const s=sOf.get(b);return [b,...((s&&s.alias)||[]).map(a=>a.n)].filter(x=>x&&x.length>=2);};
    const inBody=b=>formsOf(b).filter(f=>body.includes(f));
    const wide=new Map(out.map(o=>[o,inBody(o)]));
    const eqOK=new Map(out.map(o=>[o,new Set()])); // 그 곡 바로 뒤 괄호와 똑같은 다른 곡 기본형 = 이 곡의 별칭
    out.forEach(o=>{const s=sOf.get(o);if(s&&s.title)for(const m of String(s.title).matchAll(/[\(\[]([^)\]]{4,80})[\)\]]/g)){const n=_songNorm(m[1]);if(n&&body.includes(n))wide.get(o).push(n);}});
    for(const m of noTags.matchAll(/([^()（）\[\]'"‘’“”|｜]{1,40}?)\s*[\(（]([^)）]{2,60})[\)）]/g)){
      if(/[+,＋]|\s[-–—]\s/.test(m[2]))continue; // 괄호 안이 곡 나열('aespa - Intro + Supernova + Whiplash')이면 별칭이 아니다
      const L=_songNorm(m[1]),P=_songNorm(m[2]);if(!L||!P)continue;
      const own=out.find(o=>formsOf(o).some(f=>L.endsWith(f)));
      if(own&&own!==P){wide.get(own).push(P);eqOK.get(own).add(P);} // 그 곡 바로 뒤 괄호 = 그 곡의 다른 표기(앞 구간 전체는 메들리일 수 있어 안 씀)
    }
    const keep=out.filter(b=>{const mine=wide.get(b).filter(f=>formsOf(b).includes(f));if(!mine.length)return true;
      return !mine.every(f=>out.some(o=>o!==b&&(eqOK.get(o).has(f)||wide.get(o).some(g=>g!==f&&g.length>f.length&&g.includes(f)))));});
    if(keep.length)out.splice(0,out.length,...keep);
  }
  // ⑤ 투어·콘서트·팬미팅 이름 속 곡(2026-11-13 Codex — 'ITZY 2ND WORLD TOUR [ BORN TO BE ]' 직캠이 'BORN TO BE'로, DAY6 콘서트
  //    'You are My Day'의 다른 곡 무대가 'My Day'로). 다른 곡도 잡힌 영상에서만 뺀다(투어 이름 곡 자체 무대는 남는다).
  if(out.length>1){
    const tn=[...t.matchAll(/(tour|투어|concert|콘서트|fan\s*-?\s*meeting|팬미팅|fan-?con|팬콘)\s*[\[<'"‘“《〈「(]\s*([^\]>'"’”》〉」)]{2,60})/ig)].map(m=>_songNorm(m[2])).filter(Boolean);
    for(const m of t.matchAll(/(?:^|[|｜@])\s*([^|｜@'"‘’“”\[\]]{2,40}?)\s*(?:-\s*the\s*\d+(?:st|nd|rd|th)\s*(?:mini\s*)?album|showcase|쇼케이스)/ig))tn.push(_songNorm(m[1]));
    const lead=/^\s*\[([^\]]{3,60})\]/.exec(t);if(lead&&!/\s[-–—]\s/.test(lead[1])&&!/\b(mv|m\/v|4k|8k|직캠|fancam|live|stage)\b/i.test(lead[1]))tn.push(_songNorm(lead[1]));
    if(tn.length){const keep=out.filter(b=>!tn.some(n=>n.includes(b)));if(keep.length)out.splice(0,out.length,...keep);}
  }
  return out;
}
// 곡 창의 "제목으로 찾은 커버"(2026-10-22) — 주인 제한 없는 제목 검색 결과 중 **그 곡을 부른 영상**만 true.
// 제목에 곡명이 그냥 들어 있는 건 안 믿는다('엄마 잔소리'·'잔소리 STOP 챌린지'). 인정하는 건
//   ① 다른 주인의 같은 곡 키(song_keys '아이즈원:잔소리') ② 따옴표·꺾쇠 안 곡명 ③ "가수 - 곡명" 대시 뒤가 곡명으로 시작(짧은·흔한 곡명 제외)
// 다른 곡에만 연결된 영상(song_keys에 이 곡 없음)은 버린다.
function _songCoverByTitle(v,base,owner){
  if(!v||!base)return false;
  const t=String(v.title||'');
  const keys=Array.isArray(v.song_keys)?v.song_keys:[];
  if(keys.length)return owner?keys.includes(owner.key):keys.some(k=>String(k).slice(String(k).indexOf(':')+1)===base);
  // 동명곡은 곡명만으로 원곡자를 추정하지 않는다. 제목의 원곡자 또는 명시된 원곡 태그가 필요하다.
  if(owner&&owner.ambiguous){
    const named=(owner.names||[]).some(n=>{
      const raw=String(n||'').normalize('NFKC').toLowerCase(),words=raw.match(/[a-z0-9]+/g);
      if(/^[a-z0-9\s._-]+$/.test(raw)&&words){
        return new RegExp('(^|[^a-z0-9])'+words.join('[^a-z0-9]*')+'(?![a-z0-9])','i').test(t.normalize('NFKC'));
      }
      return _songNorm(n).length>=2&&_songNorm(t).includes(_songNorm(n));
    });
    const tagged=(owner.groupKey&&(v.cover_of_groups||[]).includes(owner.groupKey))
      ||(owner.personKeys||[]).some(k=>(v.cover_of_members||[]).includes(k));
    if(!named&&!tagged)return false;
  }
  const Q=/['‘’"“”「」『』<>＜＞《》〈〉]([^'‘’"“”「」『』<>＜＞《》〈〉\n]{1,60})['‘’"“”「」『』<>＜＞《》〈〉]/g;
  for(const m of t.matchAll(Q))if(_songBase(m[1])===base)return true;
  if((/^[가-힣]+$/.test(base)?base.length<3:base.length<4)||_SONG_COMMON.has(base))return false;
  return t.split(/\s[-–—]\s/).slice(1).some(seg=>_songNorm(seg).startsWith(base));
}
// ── 앨범 ↔ 영상(2026-10-19) ─────────────────────────────────────────────────────────────────
// 앨범 카드 영상 패널은 "수록곡 song_keys" + "제목에 앨범명이 든 영상(하이라이트 메들리·트레일러·쇼케이스)"을 합친다.
// 앨범명 쪽 판정 규칙 — tools/build_album_videos.mjs(매일 미리 계산)와 앱(그 뒤 들어온 신규 영상)이 같이 쓴다.
// 앨범명 정규형. 곡명과 같으면(싱글 등) 곡 키가 이미 모으니 앨범명으로는 안 찾는다 → null.
// 주인 이름과 같은 앨범명(뉴진스 'New Jeans' EP)은 그 주인 영상 전부에 걸리니 막는다(blockNames, 곡 규칙 함정 ①과 같음)
function _albumNormFor(albumTitle,songBases,blockNames){
  const n=_songNorm(albumTitle);
  if(!n||(songBases&&songBases.has(n)))return null;
  if((blockNames||[]).some(x=>_songNorm(x)===n))return null;
  if((/^[가-힣]+$/.test(n)?n.length<3:n.length<4)||_SONG_COMMON.has(n))return null;
  return n;
}
// 영상 제목에 앨범명이 들어 있나 — 영어는 단어 경계('ICON'이 'Dicon'에 걸리던 곡 규칙과 같은 함정)
function _albumTitleHit(videoTitle,albumTitle,albumNorm){
  if(!albumNorm)return false;
  if(!_songNorm(videoTitle).includes(albumNorm))return false;
  const w=String(albumTitle).toLowerCase().normalize('NFKC').match(/[a-z0-9]+/g);
  if(!w||!/^[a-z0-9]+$/.test(albumNorm))return true;
  return new RegExp('(^|[^a-z0-9])'+w.join('[^a-z0-9]*')+'(?![a-z0-9])').test(String(videoTitle).toLowerCase().normalize('NFKC'));
}
// 디스코(앨범 배열) → 곡 목록(기본형 중복 제거). 반주(Inst./MR)는 뺀다.
// persons(선택): 사람 이름 정규형 Set — 괄호 속 부른 멤버('(창빈)'·'(Seungmin)')를 별칭으로 받지 않게
function _songListFromDisco(albums,persons){
  const seen=new Map(),kr=new Set();
  (albums||[]).forEach(a=>(a&&a.tracks||[]).forEach(tr=>{
    if(!tr||!tr.title||/\((?:inst\.?|instrumental|mr)\)\s*$/i.test(tr.title))return;
    // 한 글자 곡('특 (S-Class)'·'락 (樂) (LALALALA)')도 남긴다 — 본문 포함으론 절대 안 잡히고(길이 문턱) 따옴표·별칭으로만 연결된다
    const b=_songBase(tr.title);if(!b)return;
    let s=seen.get(b);if(!s){s={b,title:tr.title};seen.set(b,s);}
    if(a.region!=='jp')kr.add(b);
    // 별칭 후보: 괄호 안('쌍둥이자리 (Gemini)' → gemini) + 첫 괄호 뒤에 붙은 다른 표기('… (승민) As we are (Seungmin)' → asweare).
    // ⚠️ 괄호엔 별칭 말고도 부른 멤버('CHESS (DAHYUN)'·'(창빈)')·판 표기('(CD ONLY)')·OST 설명이 들어 있다 — 그걸 별칭으로 받으면 제목에
    //    '다현'만 있어도 CHESS가 붙었다(2026-10-16 표본). 진짜 별칭 두 경우만: ①표기 체계가 다름(한글↔영어: '선인장 (CACTUS)')
    //    ②약자 풀이('F.I.L.A (Fall In Love Again)'). 사람 이름(persons)·여러 명(쉼표·&)·판/버전 낱말은 무조건 버린다.
    const core=_songStripTail(tr.title);
    const cands=[...core.matchAll(/[\(\[]([^)\]]+)[\)\]]/g)].map(x=>x[1]);
    const after=core.replace(/^[^\(\[]*/,'').replace(/[\(\[][^)\]]*[\)\]]/g,' ').trim();
    if(after)cands.push(after);
    for(const raw of cands){
      if(/[,&]/.test(raw)||/cd\s*only|digital|bonus|hidden\s*track|original|extended|\bost\b|\beng\b|\bkor\b|\bjpn\b|house|moombahton|radio|clean|explicit|piano|orchestra|chinese|from\b|\bpart\b|\bpt\.|intro|outro/i.test(raw))continue;
      const n=_songNorm(raw);
      if(n.length<2||n===b||(persons&&persons.has(n)))continue;
      const hb=/[가-힣]/.test(b),hn=/[가-힣]/.test(n);
      const initials=(raw.match(/[A-Za-z]+/g)||[]).map(w=>w[0].toLowerCase()).join('');
      const acronym=/^[a-z]+$/.test(b)&&b.length>=2&&initials===b;
      if(hb!==hn||acronym){s.alias=s.alias||[];if(!s.alias.some(x=>x.n===n))s.alias.push({n,raw});}
    }
  }));
  // 일본반에만 있는 영문 제목 곡이 한국 곡의 괄호 표기와 같으면 같은 곡(2026-11-13 Codex — 아스트로 일본반 'All Night' ⇄ '전화해 (All Night)',
  // 엔시티 127 'Come Back' ⇄ '악몽 (Come Back)'이 곡 페이지 두 개로 갈렸다). 별칭으로 남고 따로 곡이 되지 않는다.
  const owner=new Map();seen.forEach(x=>(x.alias||[]).forEach(al=>{if(!owner.has(al.n))owner.set(al.n,x);}));
  return [...seen.values()].filter(x=>kr.has(x.b)||!owner.has(x.b)||owner.get(x.b)===x);
}
// 영어 곡명의 한글 소리 표기(팬·방송 제목 관례 — '레드레드'·'붐팔라')(2026-10-28 사용자 "한글 애칭 연결").
// 디스코엔 영어로만 있어 별칭이 안 생긴다. 자동 음역은 그룹명(크래비티=Gravity)·흔한 말(포커스=FOCUS·드라마=Drama)까지 걸려서
// 미연결 제목에서 실제로 자주 나온 것만 손으로 고른다. **그 그룹 곡 목록에만** 별칭으로 붙으니 다른 그룹 영상엔 안 걸린다.
// 2글자('직진')는 본문 포함으론 안 잡히고(길이 문턱) 따옴표·해시태그로만. 곡 기본형(_songBase)이 그 그룹 디스코에 있어야 붙는다.
const _SONG_KO_NICK={
  '코르티스':{redred:['레드레드'],acai:['아사이']},
  '트레저':{jikjin:['직진']},
  '르세라핌':{boompala:['붐팔라']},
  '라이즈':{boomboombass:['붐붐베이스']},
  '하츠투하츠':{lemontang:['레몬탱']},
  '케플러':{tipitap:['티피탭']},
  '에스파':{whiplash:['위플래시','위플래쉬']},
  '샤이니':{sherlock:['셜록'],everybody:['에브리바디']},
  // 소리 표기가 아니라 공식 한글 제목 — 멜론엔 'FXX OFF'로만 있어 '#꺼져Challenge'가 씨스타 '꺼져' 커버로 잡혔다(Codex 감사18차, 30행).
  // 커버 판정(admin.js _coverBuildIndex)도 이 표를 자기 곡으로 읽는다.
  '원팩트':{fxxoff:['꺼져']},
};
function _songAddNicks(songs,gko){
  const t=_SONG_KO_NICK[gko];
  if(t)songs.forEach(s=>(t[s.b]||[]).forEach(raw=>{const n=_songNorm(raw);s.alias=s.alias||[];if(!s.alias.some(x=>x.n===n))s.alias.push({n,raw});}));
  // 공식 영문 제목(_SONG_ALIASES, 2026-11-11) — 'TWS - plot twist'·'Countdown! - TWS [Music Bank]'처럼 영문으로만 적힌 영상을 한글 곡에.
  // 짧은 것(7글자 이하: 'Super'·'My House')·한 낱말('Fighting'·'Thunderous')은 따옴표·'가수 - 곡'에서만(q) — 본문 포함으론
  // 'Super Junior'·'Real 2PM My House'·'Fighting 2022 Special'(엠카 특집명)까지 걸렸다(11-11 차분 표본). 여러 낱말 긴 별칭('plot twist')만 본문 포함
  if(typeof _songAliasesFor==='function')songs.forEach(s=>{const al=_songAliasesFor(gko,s.title);if(!al)return;
    al.forEach(raw=>{const n=_songNorm(raw);if(n.length<2||n===s.b)return;s.alias=s.alias||[];if(!s.alias.some(x=>x.n===n))s.alias.push({n,raw,q:n.length<=7||!/\s/.test(String(raw).trim())});});});
  // 판본 곡 합치기: 영문 별칭이 다른 곡의 기본형과 같고 그 곡이 판본('plot twist (Japanese ver.)')이면 빼서 한국 원곡 하나로 —
  // 안 빼면 별칭보다 그 판본 곡이 먼저 잡혀 'TWS - plot twist' 영상이 일본판 곡에 붙고 곡 페이지도 따로 생겼다(11-11)
  // 괄호 영문 별칭도 같이('불타오르네 (FIRE)' ← 'FIRE (Japanese Ver.)'·'DOPE-超ヤベ-！- (쩔어)'): 디스코 전체 표본 212쌍이 이렇게 둘로 갈려
  // 'BTS - FIRE' 영상이 일본판 곡에 붙었다. 빼는 쪽은 판본 표시·일본 문자가 있는 곡만 — '소년 (Boy)' ⇄ 'B.O.Y (Bet On You)'처럼 다른 곡은 남는다
  const an=new Map();songs.forEach(s=>(s.alias||[]).forEach(a=>{if(!an.has(a.n))an.set(a.n,s);}));
  const VER=/japan|\bver(?:sion)?\b|\bjp\b|remix|sped\s*up|slowed|rerecorded|acoustic|piano|orchestra|spanish|chinese|english|[぀-ヿ]/i;
  return an.size?songs.filter(s=>{const o=an.get(s.b);return !(o&&o!==s&&VER.test(s.title)&&!VER.test(o.title.replace(/\s*[\(\[][^)\]]*(?:ver|version|remix)[^)\]]*[\)\]]/ig,'')));}):songs;
}

// ── 동명이인 솔로 정적 페이지 주소 구분(2026-10-19) ─────────────────────────────────────────────
// 솔로(소속 그룹이 GROUPS에 없음) 페이지는 member/<이름>/ · en/member/<영문 slug>/인데, 이름이 같은 솔로가 둘 이상이면
// (프리스틴·공원소녀 레나, 포미닛·나인뮤지스 현아 등 8쌍 + 영문만 겹치는 예나·민주 등) **한 주소를 나눠 써서 나중 것이 덮어썼다**.
// 겹치는 경우에만 예전 그룹을 붙인다: member/레나-프리스틴/ · en/member/lena-gwsn/. 예전 그룹까지 같으면 고유번호(id).
// ⚠️ 페이지 빌더(build_group_pages.js)와 앱 공유 링크(_seoUrlForMember)가 **이 함수 하나**를 쓴다 — 따로 만들면 주소가 갈린다.
// 반환: 붙일 꼬리 {ko:'-프리스틴'|'', en:'-pristin'|''}
function _soloPageSuffix(a,artists,groups){
  const res={ko:'',en:''};
  const isSolo=x=>!!(x&&x.name&&x.group&&!groups[x.group.ko]);
  if(!isSolo(a))return res;
  const slug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const koKey=x=>String(x.name.ko).replace(/[.\s]+$/,'');
  const enKey=x=>slug(x.name.en||x.name.ko)||'group';
  const hint=x=>((x.groups||[]).map(y=>y&&y.ko).find(k=>k&&groups[k]))||'';
  const koDup=artists.filter(x=>isSolo(x)&&koKey(x)===koKey(a));
  if(koDup.length>1){const h=hint(a);res.ko='-'+(h&&koDup.filter(x=>hint(x)===h).length===1?h.replace(/[.\s]+$/,''):(a.id||h||'x'));}
  const enDup=artists.filter(x=>isSolo(x)&&enKey(x)===enKey(a));
  if(enDup.length>1){const h=hint(a),hs=h?(slug(groups[h].en||h)||h):'';res.en='-'+(hs&&enDup.filter(x=>hint(x)===h).length===1?hs:(a.id||hs||'x'));}
  return res;
}

// 그룹명이 출연이 아니라 **빗댐**으로만 쓰인 제목인지(2026-10-30 사용자 "50대 코르티스룩 #할명수 #박명수 #코르티스 — 코르티스는 안 나온다",
// "개그계 리센느"처럼 '~계 그룹명'도). 박명수가 코르티스처럼 입은 쇼츠, "트로트계 리센느 김용빈"·"수학계 BTS 정승제"처럼 다른 사람을
// 그룹에 빗댄 영상은 해시태그까지 달려 매처가 출연으로 본다. 진짜 출연에도 "○○ 스타일"을 쓰는 일이 있어 **자동으로 숨기지 않고**
// 검수 큐에 '출연 의심'으로만 올린다(외부 채널 동기화 _extBuildRows + 관리자 검수 목록 배지 + 소급 스윕이 이 한 함수를 쓴다).
// 걸리는 꼴: ① 그룹명+룩/st/스타일/메이크업/코디/재질/짝퉁/따라하기/흉내/성대모사/닮은꼴/패러디 — 뒷말이 단어 끝이어야 한다
//              (갓세븐 '룩'은 곡명 Look이라 걸리지만 "룩스 캔 킬"·"스타일리스트"·"메이크업포에버"는 안 걸리게)
//            ② ~계(의) 그룹명 — 세계·가요계·연예계·아이돌계처럼 진짜 그 그룹을 가리키는 말은 뺀다
//            ③ 제2의 그룹명
// 반환: 걸린 문구(없으면 ''). names: 확인할 그룹 표기(한글 키·영문명).
// ⚠️ 정규식 문자열에 백슬래시를 쓰지 않는다(편집 도구가 이스케이프를 풀어 깨진 사고 — 공백은 ' ?', 이스케이프는 fromCharCode(92)).
const _PARODY_AFTER='(?:룩|st|스타일|메이크업|화장법|코디|재질|짝퉁|따라하기|흉내|성대모사|닮은꼴|닮은|패러디)';
const _PARODY_END='(?=$|[^가-힣A-Za-z0-9]|의|을|를|은|는|이|으로|로|도)';
const _PARODY_KYE_SKIP=/(세|가요|연예|아이돌|케이팝|음악|음반|방송|관|체|시|단)$/;
const _parodyReCache=new Map();
function _parodyRefCue(title,names){
  const t=String(title||'');
  if(!t)return '';
  const BS=String.fromCharCode(92);
  for(const n of names||[]){
    if(!n||n.length<2)continue;
    let r=_parodyReCache.get(n);
    if(!r){
      const e=[...n].map(c=>('.*+?^$|()[]{}'.includes(c)||c===BS)?BS+c:c).join('');
      r=[new RegExp(e+' ?'+_PARODY_AFTER+_PARODY_END,'i'),new RegExp('([가-힣]{1,6})계의? ?'+e+'(?![A-Za-z가-힣])','i'),new RegExp('제 ?2의 ?'+e,'i')];
      _parodyReCache.set(n,r);
    }
    const a=t.match(r[0]);if(a)return a[0];
    const b=t.match(r[1]);if(b&&!_PARODY_KYE_SKIP.test(b[1]))return b[0];
    const c=t.match(r[2]);if(c)return c[0];
  }
  return '';
}
// 그 영상의 그룹 표기들(group_ko 키 + 영문명)로 바로 판정
function _parodyRefCueFor(title,gko){
  const g=(typeof GROUPS!=='undefined'&&GROUPS)?GROUPS[gko]:null;
  return _parodyRefCue(title,[gko,g&&g.en]);
}

// ── 음방 회차 묶기(2026-11-03) — 앱 회차 화면(_openShowEp)과 정적 회차 페이지(build_group_pages.js buildShowPages)가 같이 쓴다 ──
// 출처는 방송사 공식 채널만. 회차 날짜 = ①제목 속 날짜(261030·2026.10.22·20261025)가 그 방송 요일과 맞을 때 ②없으면 같은 방송 다른 영상에서
// 배운 'EP.번호→날짜' ③그래도 없으면 올린 날(KST) 기준 3일 안의 직전 방송일. 요일이 안 맞는 날짜(해외 특집·연말 무대)는 뺀다.
// ⚠️ 채널을 늘리면 DB 부분 인덱스 idx_ytv_music_show_ch의 WHERE도 같이 바꿀 것(sql/music_show_episode_index_2026-11-03.sql) — 없으면 큰 채널이 시간 초과.
const _MS_SHOWS = [
  { key: '뮤직뱅크', en: 'Music Bank', short: '뮤뱅', slug: 'music-bank', dow: 5, h: ['KBSKpop', 'kbsworldtv'], re: /뮤직뱅크|music\s*bank/i },
  { key: '엠카운트다운', en: 'M Countdown', short: '엠카', slug: 'm-countdown', dow: 4, h: ['MnetM2', 'Mnet'], re: /mcountdown|엠카운트다운|m\s*countdown/i },
  { key: '쇼음악중심', en: 'Show! Music Core', short: '음중', slug: 'music-core', dow: 6, h: ['MBCkpop'], re: /음악중심|음중|music\s*core/i },
  { key: '인기가요', en: 'Inkigayo', short: '인가', slug: 'inkigayo', dow: 0, h: ['SBSKPOP', 'SBSKPOP_ZOOM'], re: /inkigayo|인기가요|SBS\s*\d{6}\s*방송/i, no: /매점|live\s+in|in\s+tokyo|in\s+japan/i },
  { key: '쇼챔피언', en: 'Show Champion', short: '쇼챔', slug: 'show-champion', dow: 3, h: ['ALLTHEKPOP'], re: /show\s*champion|쇼챔/i },
  { key: '더쇼', en: 'THE SHOW', short: '더쇼', slug: 'the-show', dow: 2, h: ['thekpop'], re: /the\s*show|더쇼/i },
  // 쇼케이팝(2026-11-11 추가) — 2026-10-19 첫 방송, 월요일 18:00 생방송(아리랑TV·뮤빗·써클차트 글로벌 차트쇼, 1위 있음). 공식 채널 @showkpop.official.
  // ⚠️ 채널을 넣으면 부분 인덱스 idx_ytv_music_show_ch의 WHERE에도 넣어야 한다(sql/2026-11-11_music_show_index_showkpop.sql)
  { key: '쇼케이팝', en: 'SHOW K-POP', short: '쇼케', slug: 'show-kpop', dow: 1, h: ['showkpop.official'], re: /show\s*k-?pop|쇼\s*케이팝/i },
];
const _MS_KIND_LABEL = { stage: ['무대', 'Stage'], encore: ['앵콜', 'Encore'], fullcam: ['풀캠', 'Full cam'], fancam: ['직캠', 'Fancam'], facecam: ['페이스캠', 'Face cam'] };
const _MS_KIND_ORDER = ['stage', 'encore', 'fullcam', 'fancam', 'facecam'];
function _msDateOf(t) {
  const m = t.match(/20(2\d)[.\-\/](\d{1,2})[.\-\/](\d{1,2})/) || t.match(/(?<!\d)20(2\d)(\d{2})(\d{2})(?!\d)/) || t.match(/(?<!\d)(2\d)(\d{2})(\d{2})(?!\d)/);
  if (!m) return null; const mo = +m[2], d = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return '20' + m[1] + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
// 영상 종류 — null이면 회차 목록에서 뺀다(인터뷰·챌린지·비하인드 등)
function _msKind(t) {
  // 그 회차의 무대가 아닌 것은 **직캠 판정보다 먼저** 뺀다(2026-11-04 Codex 검수102·113차) — 예전엔 '직캠'이 들어 있으면 제외 목록을 보기 전에
  // 직캠으로 끝나서 '최애직캠 모음집'(23분, 여러 곡)·'직캠보고서 … 사전녹화 비하인드'가 직캠이 됐고, MC 컷 모음·인생극장(예능)은 제외 목록에 없어 무대가 됐다.
  // 회차 묶기에서만 빠진다 — 아티스트 카드의 영상은 그대로. 'zip' 하나로는 막지 않는다(곡명·그룹명 오인).
  if (/모음집|mc\s*컷|mc\s*cut|mc\s*talk|mc석|인생극장|zip캠|최애\s*zip|직캠\s*보고서|비하인드|behind|수상소감/i.test(t)) return null;
  // 더쇼 인터뷰 코너 'JJaeLiView'·전체 생방송('[🔴LIVE] 2026 THE SHOW Ep.403 … RESCENE, xikers, …, etc.')도 회차 무대가 아니다(2026-11-13 Codex)
  if (/jjaeliview|짹?리뷰\]|🔴|\bfull\s*episode\b|전체\s*방송|,\s*etc\.?\s*$/i.test(t)) return null;
  if (/페이스캠|face\s*cam/i.test(t)) return 'facecam';
  if (/풀캠|full\s*cam/i.test(t)) return 'fullcam';
  if (/직캠|fan\s*cam|focus|원픽캠|fan\s*pick\s*cam|캐치캠|catch\s*cam/i.test(t)) return 'fancam'; // 원픽캠 = 쇼챔 멤버 한 명 직캠(예전엔 '무대'로 갔다) · 더쇼 FAN PICK CAM·쇼케이팝 캐치캠(2026-11-13)
  if (/the\s*show\s*choice/i.test(t)) return 'encore'; // 더쇼 1위 앵콜 이름
  if (/앵콜|encore/i.test(t)) return 'encore';
  if (/interview|인터뷰|behind|비하인드|challenge|챌린지|\.zip|#shorts|엔딩요정|MC석|코너|선공개|티저|teaser/i.test(t)) return null;
  return 'stage';
}
// 그 방송의 가장 최근 방송일(오늘 포함, KST) — 앱의 '음방 회차' 칩용
function _msLastAir(s, now) {
  const k = new Date((now || Date.now()) + 9 * 3600e3);
  for (let i = 0; i < 7; i++) { const t = new Date(k.getTime() - i * 864e5); if (t.getUTCDay() === s.dow) return t.toISOString().slice(0, 10); }
  return null;
}
// vids: yt_channel_videos 행(title·source_handle·group_ko·published_ts 필요) → [{s,date,list:[{v,kind}]}] (날짜순)
function _msGroupEpisodes(vids, minVids) {
  const eps = {}, epNo = {}, rows = [];
  for (const v of vids) {
    if (!v || !v.group_ko || !v.title) continue;
    const s = _MS_SHOWS.find(x => x.h.indexOf(v.source_handle) >= 0 && x.re.test(v.title) && !(x.no && x.no.test(v.title)));
    if (!s) continue;
    const kind = _msKind(v.title); if (!kind) continue;
    const d = _msDateOf(v.title);
    if (d && new Date(d + 'T00:00:00Z').getUTCDay() !== s.dow) continue;
    const ep = (v.title.match(/EP\.?\s*(\d{3,4})/i) || [])[1];
    if (d && ep) epNo[s.key + '|' + ep] = d;
    rows.push({ v, s, kind, d, ep });
  }
  for (const r of rows) {
    if (!r.d && r.ep) r.d = epNo[r.s.key + '|' + r.ep] || null;
    const ts = r.v.published_ts || r.v.published_at;
    if (!r.d && ts) {
      const k = new Date(new Date(ts).getTime() + 9 * 3600e3);
      for (let i = 0; i <= 3; i++) { const t = new Date(k.getTime() - i * 864e5); if (t.getUTCDay() === r.s.dow) { r.d = t.toISOString().slice(0, 10); break; } }
    }
    if (!r.d) continue;
    const key = r.s.key + '|' + r.d;
    (eps[key] = eps[key] || { s: r.s, date: r.d, list: [] }).list.push({ v: r.v, kind: r.kind });
  }
  return Object.keys(eps).map(k => eps[k]).filter(e => e.list.length >= (minVids || 1)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

// ── 곡 영문 제목 별칭(2026-11-11) ─────────────────────────────────────────────────────────
// 디스코 정본은 멜론 한글 제목이라 해외 팬·음방 기록(위키 영문)이 쓰는 공식 영문 제목으로는 곡을 못 찾았다("plot twist").
// 주인(그룹 이름, 솔로·멤버 개인곡은 그 사람 이름) → 디스코 곡 제목 → 영문 제목들(첫 번째가 대표). 2026-11-11 음방 1위 영문 제목 정정에서 확인된 98곡 포함(sql/2026-11-11_win_titles_disco.sql). 쓰는 곳: 앱 검색(app.js _buildSongIndex) ·
// 정적 페이지 곡 표기(tools/seo_extra.js — '첫 만남은 계획대로 되지 않아 Plot Twist', 표기 규칙은 docs/NAMING.md).
// 제목에 이미 괄호 영문이 있는 곡('널 따라가 (You, You)')은 넣지 않아도 된다.
const _SONG_ALIASES={
  "2AM":{"어느 봄날":["One Spring Day"]},
  "2PM":{"이 노래를 듣고 돌아와":["Comeback When You Hear This Song"],"니가밉다":["I Hate You"],"우리집":["My House"],"해야 해":["Make it"],"괜찮아 안 괜찮아":["OK or Not"],"보고싶어, 보러갈게":["On My Way"],"샴페인":["Champagne"],"집 앞 카페":["The Cafe"],"둘이":["Two of Us"],"놓지 않을게":["Hold You"],"시도때도없이":["All Night Long"],"콧노래":["Humming"],"어때?":["Shall We?"],"향수":["Perfume"],"환각":["Hallucination"],"너만의 남자":["Not The Only One"],"여름보다 뜨거운 너":["Hotter Than July"],"미칠 것 같아":["About To Go Insane"],"미친거 아니야?":["GO CRAZY!"],"오늘 같은 밤":["Like Tonight"],"비가와":["Rain"],"이별여행":["Goodbye Trip"],"10점만점에 10점":["10 Out of 10"],"돌아올지도 몰라":["You Might Come Back","Maybe She'll Come Back"],"기다리다 지친다":["Tired of Waiting"],"니가 나를 떠나도":["Even If You Leave Me"],"마자":["Maza"],"목숨을 건다":["I Will Give You My Life"],"Space 마자":["Space MAZA"],"너에게 미쳤었다":["I Was Crazy About You"],"10점 만점에 10점 (10/10)":["10 Out of 10"],"돌아올지도 몰라 (Bossa Nova Mix)":["Maybe She'll Come Back (Bossa Nova Mix)"],"돌아올지도 몰라 (Inst.)":["Maybe She'll Come Back (Instrumental)"],"10점 만점에 10점":["10 Out of 10"],"10점 만점에 10점 (Old School Ver.)":["Out of 10 (Old School Version)"],"10점 만점에 10점 (Inst.)":["10 Out of 10 (Instrumental)"]},
  "82메이저":{"트로피 (TROPHY)":["TROPHY"],"의심스러워 (Suspicious)":["Suspicious"],"뭘 봐(TAKEOVER)":["TAKEOVER"],"영웅호걸":["Heroes"],"혀끝(Stuck)":["Stuck"],"가시밭길도 괜찮아(Thorns)":["Thorns"],"촉(Choke)":["Choke"],"오늘 어때 (wyd?)":["wyd?"]},
  "가인":{"우리 사랑하게 됐어요":["I Happen to Love You"],"반딧불이의 숲":["The Forest of Fireflies"],"비밀":["Secret"],"두 여자":["Two Women"],"노스텔지아 (Feat. 에릭)":["NOSTALGIA (Feat. Eric)"],"노스텔지아 (Inst.)":["NOSTALGIA (Inst.)"],"팅커벨":["Tinkerbell"],"그녀를 만나":["Tiredness"],"피어나":["Bloom"],"돌이킬 수 없는":["Irreversible"],"가인 (歌人)":["Gain (歌人)"],"진실":["Truth"]},
  "갓세븐":{"하드캐리":["Hard Carry"],"니가 하면":["If You Do"],"니가 부르는 나의 이름":["You Calling My Name"],"청춘드라마":["Our Youth"],"기억할거야":["REMEMBER"],"우리가 할 수 있는 말은.":["Yours Truly,"],"앙코르 (Encore)":["Encore"],"이젠 내가 할게":["Thank You, Sorry"],"지켜줄게":["Save You"],"혼자 (Nobody Knows)":["Nobody knows"],"내게":["To Me"],"양심없이":["Don’t care"],"노잼":["No Jam"],"만약에":["If"],"아파":["Sick"],"니꿈꿔":["Dreamin’"],"딱 좋아 (Just right)":["Just Right"],"보름달이 뜨기 전에":["Before the Full Moon Rises"],"온몸이 반응해":["My Reaction"],"나쁜 짓":["Bad Behaviour"],"여보세요":["Hello"],"난 니가 좋아":["I Like You"],"따라와":["Follow Me"]},
  "강다니엘":{"水彩 수채화 (feat. TOMIOKA AI)":["Watercolor (feat. Ai Tomioka)"],"水彩 수채화 (Inst.)":["Watercolor (Instrumental)"],"깨워 (Who U Are)":["Who U Are"],"밤":["Night"],"뭐해 (What are you up to)":["What Are You Up To"]},
  "강민혁":{"별":["Star"]},
  "강승식":{"기억의 잔상":["afterimage"],"괜찮은 오차":["Perfectly Imperfect"],"우리가 담긴 계절":["The Season of Us"],"기억의 잔상 (Inst.)":["afterimage (Instrumental)"],"그대로의 나 [CLEF X 강승식(빅톤)]":["Look for the Silver Lining [CLEF X Kang Seung Sik (VICTON)]"],"그대로의 나 [CLEF X 강승식(빅톤)] (Inst.)":["Look for the Silver Lining [CLEF X Kang Seung Sik (VICTON)] [Instrumental]"],"사계절이 지나도":["I'm Still Loving You"],"사계절이 지나도 (Inst.)":["I'm Still Loving You (Instrumental)"]},
  "강승윤":{"직진":["No Breaks"],"직진 (inst.)":["No Breaks (Inst.)"],"아이야 (Sleep Mix)":["IYAH (Sleep Mix)"],"너":["You"],"너 (Inst.)":["You (Inst.)"],"맘도둑":["Stealer"],"비가 온다":["It Rains"],"본능적으로 (Feat. Swings)":["Instinctively (feat. Swings)"],"본능적으로 (Inst.)":["Instinctively (Instrumental)"]},
  "강인":{"추억인 듯 상처인 듯 (Memories)":["Memories (From \"D-DAY\"), Pt. 3"],"추억인 듯 상처인 듯 (Memories) (Inst.)":["Memories (From \"D-DAY\"), Pt. 3 (Instrumental)"]},
  "강타":{"버킷리스트 (Bucket List) (Feat. 헤리티지)":["Bucket List (feat. Heritage)"],"한 사람 (The One)":["The One"],"가면 2022 (Persona 2022)":["Persona 2022"],"7월의 크리스마스 (Christmas in July)":["Christmas in July"],"아마 (Maybe)":["Maybe"],"아마 (Maybe) (Inst.)":["Maybe (Instrumental)"],"그 해 여름 2021 (Memories of Summer 2021)":["Memories of Summer 2021"],"자유롭게 날 수 있도록 2021 (Free To Fly 2021)":["Free To Fly 2021"],"감기약 (Cough Syrup)":["Cough Syrup"],"감기약 (Cough Syrup) (Inst.)":["Cough Syrup (Instrumental)"],"말했더라면 (If I Told Ya)":["If I Told Ya"],"단골식당 (Diner)":["Diner"],"사랑이 오네요 (Love Is Coming)":["Love Is Coming"],"어느날 가슴이 말했다 (Eternity)":["Eternity"],"너를 닮아 (Still With You)":["Still With You"],"책갈피 (Reminiscence)":["Reminiscence"],"그래서 미안합니다 (Since You've Gone)":["Since You've Gone"],"가슴에 남아 (Still My Heart)":["Still My Heart"],"어느날 가슴이 말했다 (Eternity) (Inst.)":["Eternity (Instrumental)"],"책갈피 (Reminiscence) (Inst.)":["Reminiscence (Instrumental)"],"가면 (Persona)":["Persona"],"쓰레기 (Illusion) (KBS드라마 “러브홀릭” 삽입곡)":["Illusion"],"느리게 걷기 (Agape)":["AGAPE"],"마비 (Paralysis) (KBS드라마 “러브홀릭” 삽입곡)":["Paralysis"],"하루만큼만 (Just One Day)":["Just One Day"],"일어나기 (Reminiscence#1)":["Reminiscence#1"],"그녀의 목소리가 들립니다 (Always) (Feat. 송광식)":["Always (feat. SONG KWANG SIK)"],"잠든 기도 (Prayer)":["Prayer"],"느리게 걷기 (Agape) (Inst.)":["AGAPE (Instrumental)"]},
  "걸스데이":{"링마벨 (Ring My Bell)":["Ring My Bell"],"링마벨 (Ring My Bell) (Inst.)":["Ring My Bell (Instrumental)"],"영러브 (Young love)":["Young Love"],"잘해줘봐야 (Nothing Lasts Up)":["Nothing Lasts Up"]},
  "고세구":{"고양이가 세상을 구한다!":["NO CAT, NO LIFE!"]},
  "고스트나인":{"서있을게(Down for you)":["Down for you"],"째깍째깍 (Awesome day)":["Awesome day"],"책갈피":["Bookmark"],"닻 (Dot)":["Dot"],"밤샜다 (Up All Night)":["Up All Night"],"큰물에서 놀아":["SPLASH"],"한 글자도 놓치지 마":["Focus"],"꿈길":["Way to You"],"야간비행":["Flying at night"]},
  "골든차일드":{"완벽해 (Miracle)":["Miracle"],"빵빠레":["Fanfare"],"창밖으로 우리가 흘러 (Dae Yeol Solo)":["Out The Window (Dae Yeol Solo)"],"느낌적인 느낌 (Seung Min & Dong Hyun & Jae Hyun)":["That Feeling (Seung Min, Dong Hyun & Jae Hyun)"],"난 알아요":["I Know"],"창밖으로 우리가 흘러":["Out The Window (Dae Yeol Solo)"],"느낌적인 느낌":["That Feeling (Seung Min, Dong Hyun & Jae Hyun)"],"안아줄게(Burn It)":["Burn It"],"기다리고 있어":["Round N Round"],"훅 들어와(OMG)":["OMG"],"혼잣말":["Moment"],"느껴져 (Lately)":["Lately"],"나침반":["Compass"],"문제아 (Joo Chan Solo)":["A Song for Me (Joo Chan Solo)"],"그러다 봄":["Spring Again"],"둘만의 천국 (Dae Yeol & Seung Min & Dong Hyun)":["Our Heaven (Dae Yeol & Seung Min & Dong Hyun)"],"도망가지마":["Don’t Run Away"],"놓지 않기로 해 (Jae Hyun & Ji Beom & Bo Min)":["Go Together (Jae Hyun & Ji Beom & Bo Min)"],"너":["Eyes on You"],"너만 보인다":["I See U"],"들어봐 줄래":["Listen"],"넌 모를 거야":["YTMOB (You Turn Me On Baby)"],"너라고 (It's U)":["It's U"],"모든 날":["All Day"],"담다디":["DamDaDi"],"나랑 해":["With Me"],"내 눈을 의심해":["What Happened?"],"네가 너무 좋아":["I Love You So"]},
  "공원소녀":{"공중곡예사 (Wonderboy, the Aerialist)":["the Aerialist (Wonderboy)"],"밤의 비행 (The Interpretation of Dreams)":["Night Aviation (The Interpretation of Dreams)"],"볼터치 (Shy Shy)":["Shy Shy"],"Lullaby ~ 잘자":["Lullaby"]},
  "구구단":{"너에게":["Dear"],"스노우 볼 (Snowball)":["Snowball"],"이순간을 믿을게":["Believe in This Moment"],"이순간을 믿을게 (Inst.)":["Believe in This Moment (Instrumental)"],"나 같은 애 (A Girl Like Me)":["A Girl Like Me"],"미워지려 해":["Hate"],"거리":["Street"],"소원 들어주기":["Make a Wish"],"나 같은 애 (A Girl Like Me) (Inst.)":["A Girl Like Me (Instrumental)"],"구름 위로":["Could This Be Love"],"일기 (Diary)":["Diary"]},
  "구하라":{"하라구":["HARAGU"],"초코칩쿠키 (Inst.)":["Choco Chip Cookies (Instrumental)"]},
  "규현":{"약속":["I’ll Be Here"],"끝나지 않는 계절":["Endless Season"],"괜찮은 줄 알았는데":["Thought I Was Fine"],"돛단배":["Voyage"],"낮잠":["Daydream"],"첫눈처럼":["Like Our First Snow"],"추억에 살아":["Still in Memory"],"나침반":["Compass"],"어느 봄날 (Prologue)":["Prologue"],"하루마다 끝도 없이 (Unending Days)":["Unending Days"],"기지개 (Journey)":["Journey"],"슬픈 밤 (Nights Without You)":["Nights Without You"],"수평선 (Horizon)":["Horizon"],"지금 여기, 너 (Wishes)":["Wishes"],"어느 봄날 (One Spring Day)":["One Spring Day"],"그렇지 않아":["The Story Behind"],"천천히, 느리게":["Slow, Slowly"],"사랑이었을까":["Was It Love"],"너여서 그래 (슈퍼주니어-K.R.Y.)":["Thanks To You (SUPER JUNIOR-K.R.Y.) [feat. RYEOWOOK & YESUNG]"],"그대는 날 어떻게 생각해":["What do you think"],"그대는 날 어떻게 생각해 (Inst.)":["What do you think (Instrumental)"],"출국":["Departure from a Country"],"출국 (Inst.)":["Departure from a Country (Instrumental)"],"늦은 후회":["A late regret (From \"You Hee yul's Sketchbook With you : 84th Voice 'Sketchbook X KYUHYUN)', Vol. 130\")"],"사랑은 말로 표현하는게 아니래요":["Love beyond words"],"사랑은 말로 표현하는게 아니래요 (inst.)":["Love beyond words (Instrumental)"],"별이 빛나는 밤에":["On A Starry Night"],"별이 빛나는 밤에 (Inst.)":["On A Starry Night (Instrumental)"],"투게더 (Together)":["Together"],"커피 (Coffee)":["Coffee"],"마지막 날에 (Moving On)":["Moving On"],"비처럼 음악처럼":["Like Rain, Like Music"],"비처럼 음악처럼 (Inst.)":["Like Rain, Like Music (Instrumental)"],"내 마음을 누르는 일 (Daystar)":["Daystar"],"내 마음이 움찔했던 순간 (취향저격 그녀 X 규현)":["The Moment My Heart (She Is My Type)"],"내 마음이 움찔했던 순간 (취향저격 그녀 X 규현) (Inst.)":["The Moment My Heart (She Is My Type) [Instrumental]"],"화려하지 않은 고백":["Confession Is Not Flashy"],"화려하지 않은 고백 (Inst.)":["Confession Is Not Flashy (Instrumental)"],"하루종일":["All Day Long (From \"When the Weather is Fine\"), Pt. 3"],"애월리 (Aewol-ri)":["Aewol-ri"],"너를 만나러 간다 (The day we meet again)":["The day we meet again"],"그게 좋은거야 (Time with you)":["Time with you"],"조용히 안녕 (Last Good-bye)":["Last Good-bye"],"여전히 아늑해 (Prod.by 성시경) (Still)":["Still"],"시절인연 (Love in Time)":["Love in Time"],"마음세탁소 (When with me)":["When with Me"],"그리고 우리 (And We)":["And We"],"내 맘은 어디에 두죠":["Where My Heart Belongs"],"내 맘은 어디에 두죠 (Inst.)":["Where My Heart Belongs (Instrumental)"],"멀어지던 날 (The day we felt the distance)":["The Day We Felt the Distance"],"밀리언조각 (A Million Pieces)":["A Million Pieces"],"좋은사람 (Remember Me)":["Remember Me"],"긴 팔 (Autumn Sleeves)":["Autumn Sleeves"],"피아노 숲 (Piano Forest)":["Piano Forest"],"그냥 보고 싶어 그래 (Because I Miss You)":["Because I Miss You"],"바람 (Wind)":["Wind"],"안녕의 방식 (Ways to Say Goodbye)":["Ways to Say Goodbye"],"우리가 사랑한 시간":["The Time We Loved"],"우리가 사랑한 시간 (Inst.)":["The Time We Loved (Instrumental)"],"너의 별에 닿을 때까지":["Till I Reach Your Star"],"너의 별에 닿을 때까지 (Inst.)":["Till I Reach Your Star (Inst.)"],"희망은 잠들지 않는 꿈":["Hope Is A Dream That Doesn't Sleep"],"희망은 잠들지 않는 꿈 (Inst.)":["Hope Is A Dream That Doesn't Sleep (Inst.)"]},
  "금조":{"우리 둘":["LOVE PROCESS (Act 1:Crisis) Woman's Story - Two Of Us"],"꿈처럼":["Like A Dream"],"꿈처럼 (Inst.)":["Like A Dream (Instrumental)"],"월광애(月光愛)":["Moonlight"],"월광애(月光愛) (Inst.)":["Moonlight (Instrumental)"],"손끝으로":["Fingertips"]},
  "기현":{"Bad Liar (베일드뮤지션 X 기현 (몬스타엑스) with 정동면 강철성대)":["Bad Liar (Veiled Musician X KIHYUN (MONSTA X) with Jeongdong-myeon Iron Voice)"],"Bad Liar (베일드뮤지션 X 기현 (몬스타엑스) with 정동면 강철성대) (Inst.)":["Bad Liar (Veiled Musician X KIHYUN (MONSTA X) with Jeongdong-myeon Iron Voice) [Instrumental]"],"다시, 봄":["Again Spring"],"다시, 봄 (Inst.)":["Again Spring (Instrumental)"],"정이 들어버렸어":["I've Got A Feeling"],"정이 들어버렸어 (Inst.)":["I've Got A Feeling (Instrumental)"],"한 걸음 더":["One More Step"],"한 걸음 더 (Inst.)":["One More Step (Instrumental)"]},
  "김규종":{"이젠 내가":["Now I"],"이젠 내가 (Inst.)":["Now I (Instrumental)"],"우주로 갈래 (Feat. cats drink coke)":["Go to Space (feat. cats drink coke)"],"우주로 갈래 (Inst.)":["Go to Space (Instrumental)"],"여름밤의 고백 (Summer Night)":["Summer Night"],"여름밤의 고백 (Summer Night) (Inst.)":["Summer Night (Instrumental)"],"이별도 사랑일까 (Inst.)":["Break Up Also Love? (Instrumental)"],"색연필":["Color Pencil"],"색연필 (Inst.)":["Color Pencil (Instrumental)"],"니 목소리가 듣고 싶어":["I Wanna Hear Your Voice"],"니 목소리가 듣고 싶어 (Inst.)":["I Wanna Hear Your Voice (Instrumental)"],"그리움 스케치 (Nostalgia)":["Nostalgia"],"그리움 스케치 (Nostalgia) (Inst.)":["Nostalgia (Instrumental)"],"13월의 겨울":["Winter of 13th Month"],"13월의 겨울 (Inst.)":["Winter of 13th Month (Instrumental)"],"가을밤 (Autumn Night)":["Autumn Night"],"가을밤 (Autumn Night) (Inst.)":["Autumn Night (Inst.)"],"녹는 중":["Melt"],"봄 TO 겨울":["Spring TO Winter"],"녹는 중 (Inst.)":["Melt (Instrumental)"]},
  "김남주":{"끝에, 우리 (시간의 계단 X 김남주 (에이핑크))":["Last Trip"],"끝에, 우리 (시간의 계단 X 김남주 (에이핑크)) (Inst.)":["Last Trip (Instrumental)"]},
  "김동완":{"불러본다":["Missing You"],"버스가 멈추지 않았으면 해":["I Don't Want the Bus to Stop"],"이뤄져라 (Outro)":["Come True (Outro)"],"바람의 노래":["The Wind's Love"],"진담":["Truth"],"왜 그래+악녀탈출":["What's Wrong + Witch's Escape"],"후애":["After Love"],"내 잘못이니까":["My Fault"],"손수건":["Handkerchief"],"잘자 (Feat. 앤디 of SHINHWA)":["GOOD NIGHT (feat. ANDY)"],"들었다 놨다":["Love Actually"],"잘자 (Inst.)":["GOOD NIGHT (Instrumental)"]},
  "김동준":{"나 혼자 (Alone)":["Alone"],"빈 방":["Empty Room"],"나 혼자 (Alone) (Inst.)":["Alone (Instrumental)"],"못 헤어져서 미안해":["Sorry I Can't"],"못 헤어져서 미안해 (Inst.)":["Sorry I Can't (Instrumental)"]},
  "김동한":{"매일매일":["Everyday"],"내 이름을 불러줘 (CALL MY NAME)":["Call My Name"],"아직은":["Don't Go Yet"],"Ain't No Time (Feat. (펜타곤) 우석)":["Ain't No Time (feat. WOOSEOK)"],"기록해줘 (Feat. 상균)":["Record Me (feat. SANG GYUN)"],"새벽전화":["Night Call"]},
  "김동현":{"생각나":["it′s you"],"생각나 (Inst.)":["it′s you (Instrumental)"],"썸탈래 나랑 (SOME)":["SOME"],"썸탈래 나랑 (SOME) (Inst.)":["SOME (Inst.)"]},
  "김보아":{"이 비가 그칠 때쯤 (From “조명가게”/Soundtrack Version)":["When the Rain Stops (From \"Light Shop\") [Soundtrack Version]"],"술잔에":["Drink"],"술잔에 (Inst.)":["Drink (Instrumental)"],"가슴이 말해도":["In My Heart"],"가슴이 말해도 (Inst.)":["In My Heart (Instrumental)"]},
  "김성규":{"너여야만 해":["The Answer"],"널 떠올리면 (When I think about you)":["When I think about you"],"그림":["Portrait"],"모범답안 (Answer)":["Answer"],"널 떠올리면 (When I think about you) (Inst.)":["When I think about you (Instrumental)"],"바람이 분다":["The Wind Is Blowing"],"나 어떡해":["What shall I do?"],"미안해 널 미워해":["I am sorry, I hate you"],"꼭(Like a dream)":["Like a dream"],"꼭(Like a dream) (Inst.)":["Like a dream (Instrumental)"],"안개":["Fog"],"나의 하루":["My day"],"안녕(Fade)":["Fade"],"뭐랬어 (Feat. PUNCHNELLO)":["What Did I Say (feat. PUNCHNELLO)"],"머물러줘":["Don't Move"],"끌림":["Stuck On"],"지워지는 날들":["Vanishing Days"],"천사의 도시":["City of Angel"],"거울":["Mirror"],"답가 (Feat. 박윤하)":["Casual Conversation (feat. Park Yun Ha)"],"60초":["60 Sec"],"눈물만 (Acoustic Ver.)":["Tears (Acoustic Version) (Acoustic version) [Acoustic version]"],"41일":["41th"]},
  "김세정":{"꽃길":["Flower Way"],"화분":["Plant"]},
  "김요한":{"너는 나의 빛":["You Light My Way"],"그대 안의 블루 (Duet With CHEEZE(치즈))":["Blue In You (Duet With CHEEZE)"],"우연처럼":["My Destiny"],"우연처럼 (Inst.)":["My Destiny (Instrumental)"],"저공비행 (Landing On You)":["Landing On You"],"반짝이는 별들처럼 나침반이 되어줘요":["STAR"],"요즘 자꾸만":["Recently"],"요즘 자꾸만 (Inst.)":["Recently (Instrumental)"]},
  "김우석":{"그리워하면":["Missing you"],"살며시 봄이 오면":["When spring comes"],"이따 뭐해":["What Are You Up to Tonight?"],"적월 (赤月) (Red Moon)":["Red Moon"],"그 겨울 (The Winter)":["The Winter"]},
  "김우진":{"어른아이 (On My Way)":["On My Way"],"너니까":["Because it’s you"],"너니까 (Inst.)":["Because it’s you (instrumental)"]},
  "김재중":{"마중길":["Echoes of Us"],"내 남은 사랑을 위해":["Where Love Stays"],"내 남은 사랑을 위해 (Inst.)":["Where Love Stays (Instrumental)"],"못 잊은 거죠":["I Can't Forget (From \"SHOW MUSIC Dream High\")"],"이 세상에서 (Japan Ver.)":["In this world (Japan Ver.)"],"묻고싶다":["I Want To Ask You"],"이 세상에서":["In this world"],"이 세상에서 (Inst.)":["In this world (Instrumental)"],"내일은 비 (Rain, Tomorrow)":["Rain, Tomorrow"],"바다의 시간":["Time of Sea"],"여리디여린 사랑을":["Tender Love"],"여리디여린 사랑을(Inst.)":["Tender Love (Instrumental)"],"서랍":["Drawer"],"원망해요":["All I Desire"],"다시 만나지만 다시 만나겠지만":["Although We Met Again, We Would Meet Again"],"그거 알아?":["YOU KNOW WHAT?"],"우연":["Coincidence"],"우연 (Inst.)":["Coincidence (Instrumental)"],"싫어도":["Though I Hate It"],"싫어도 (Inst.)":["Though I Hate It (Instrumental)"],"햇살 좋은 날 (Feat. 이상곤 Of 노을)":["Shiny Day (feat. Lee Sang Gon)"],"내안 가득히":["There's Only You"],"나만의 위로":["My Only Comfort"],"살아도 꿈인 것처럼":["Living like a dream"],"살아도 꿈인 것처럼 (Inst.)":["Living like a dream (Instrumental)"],"지켜줄게":["I'll Protect You"],"지켜줄게 (Inst.)":["I'll Protect You (Instrumental)"]},
  "김재환":{"안녕하세요":["Begin Again"]},
  "김채원":{"사월에게":["To the memories of April"]},
  "김태우":{"사랑비":["Love Rain"],"니가 보고싶은 밤":["The Night I Miss You"],"니가 보고싶은 밤 (inst.)":["The Night I Miss You (Instrumental)"],"너 때문에":["Because of You (From \"Don't Dare To Dream\" Original Television Soundtrack)"],"너 때문에 (Inst.)":["Because of You (Instrumental) [From \"Don't Dare To Dream\" Original Television Soundtrack]"],"너 하나만":["I only want you"],"너 하나만 (Inst.)":["I only want you (Inst.)"],"내가 나를 봐도 슬퍼..":["When I Look At Myself"],"내가 나를 봐도 슬퍼.. (Inst.)":["When I Look At Myself (Instrumental)"],"그대라는 날개":["Personal Taste (Original Television Soundtrack), Pt. 4 - The wing named you"],"사랑눈 (Feat. 드로플렛, 슬라임)":["Love Snow (feat. Droplet Slrhyme & Slime)"],"하고 싶은 말 Part 2":["Words I'd wanted to say, Pt. 2"],"내가 야! 하면 넌 예! (Duet With LYN)":["I say 'Ya!' you say 'Yeah'! (with Lyn)"],"점점점 (Feat. 앙리)":["More more more (feat. Herny)"],"기억과 추억 (Feat. 준형,호영,데니)":["Recollecton and memory (feat. SHY, Junhyung & Danny)"],"기억과 추억 (Feat. 준형, 호영, 데니)":["Memories and Rememberance (feat. Junhung, Hoyoung & Danny)"],"기억과 추억 (Inst.)":["Memories and Rememberance (Instrumental)"]},
  "김현중":{"치킨이야":["Chicken & Beer"],"하고 싶은 말":["Say Something"],"예전처럼":["Like Before"],"제발 (Please)":["Please"],"제발 (Please) (Inst.)":["Please (Instrumental)"],"고맙다 (MBC '우리 결혼했어요' 러브테마 삽입곡)":["Thank You"],"고맙다 (Inst.)":["Thank you (Inst.)"]},
  "김형준":{"스냅샷 (SNAP SHOT)":["SNAP SHOT"],"스냅샷 (SNAP SHOT) (Inst.)":["SNAP SHOT (Instrumental)"]},
  "나고은":{"날아":["Fly"],"날아 (Inst.)":["Fly (Instrumental)"]},
  "나노":{"우리의 비가 멈췄으면 좋겠어":["I Wish Our Rain To Be Stopped"],"우울VIBE (Prod. HSND)":["Gloomy Vibe (feat. HSND)"],"우리의 비가 멈췄으면 좋겠어 (inst.)":["I Wish Our Rain To Be Stopped (Instrumental)"],"취해줘요 (feat. Dear.L) (Prod. HSND)":["Lit (feat. Dear.L)"],"취해줘요 (Prod. HSND) (inst.)":["Lit (feat. Dear.L) [Inst.]"]},
  "나르샤":{"아는 여자":["Known Woman"],"아는 여자 (Inst.)":["Known Woman (Instrumental)"],"아는 여자 (Orchestra Ver.) (Inst.)":["Known Woman (Orchestra Version) [Instrumental]"]},
  "나연":{"괜찮아 사랑이니까":["Love Is Enough"],"괜찮아 사랑이니까 (Inst.)":["Love Is Enough (Inst.)"],"노을만 예쁘다":["SUNSET"]},
  "나우즈":{"우리의 시작":["Us"],"이름 짓지 않은 세상에":["Run with me"],"자유롭게 날아 (Feat. 우기 (YUQI))":["Fly to the youth (feat. YUQI)"],"일기 (DAY_AND)":["DAY_AND"],"렛츠기릿 (Let's get it)":["Let's get it"],"걔 말고 너":["Troublesome"]},
  "나유민":{"남겨두지 말걸 그랬어":["Hold On"],"감아 (Tic Toc)":["Tic Toc"],"감아 (Tic Toc) (inst.)":["Tic Toc (Instrumental)"],"너무 늦어버린 안녕":["too late. Bye."],"너무 늦어버린 안녕 (inst.)":["too late. Bye. (Instrumental)"],"네게도 하나쯤은 날 남겨뒀을까":["If You"],"네게도 하나쯤은 날 남겨뒀을까 (inst.)":["If You (Instrumental)"],"돌이킬 수 없는":["irrevocable"],"돌이킬 수 없는 (inst.)":["irrevocable (Instrumental)"],"이별끝에도 여전히 너야":["still you"],"이별끝에도 여전히 너야 (inst.)":["still you (Instrumental)"],"넌 아직 내가 왜 힘든지 모르는 것 같아":["You Don't Know Me"],"넌 아직 내가 왜 힘든지 모르는 것 같아 (inst.)":["You Don't Know Me (Instrumental)"]},
  "나인뮤지스":{"와일드 (Wild)":["Wild"],"와일드 (Wild) (Inst.)":["Wild (Inst.)"],"러브시티 (Love City)":["Love City"],"기억해":["Remember"],"페스츄리":["Pastry"],"둘이서":["Two of Us"],"러브시티 (Love City) (Inst.)":["Love City (Instrumental)"],"기억해 (Inst.)":["Remember (Instrumental)"],"잠은 안오고 배는 고프고":["Sleepless Night"],"몰래 (Secret)":["Secret"],"쿵치딱치 (KOONG CHIT DAK CHIT)":["KOONG CHIT DAK CHIT"],"잠은 안오고 배는 고프고 (Inst.)":["Sleepless Night (Instrumental)"],"다쳐 (Hurt Locker)":["Hurt Locker"],"너란애":["A"],"팬시 (Fancy)":["Fancy"],"다쳐 (Hurt Locker) (Inst.)":["Hurt Locker (Instrumental)"],"드라마 (DRAMA)":["DRAMA"],"초이스 (CHOICE)":["CHOICE"],"주르륵":["Jururuk"],"9월 17일":["September 17th"],"9월 17일 (Inst.)":["September 17th (Instrumental)"],"글루 (Glue)":["Glue"],"프리마돈나 (Prima Donna)":["PRIMA DONNA"],"건 (Gun)":["GUN"],"세치혀 (Rumor)":["Rumor"],"천생여자 (天生女子)":["Just a Girl"],"미스 에이전트":["Miss Agent"],"몰라몰라":["OMG"],"핑":["Ping"],"아님 말구":["Whatever"],"돌스 (Dolls)":["Dolls"],"쳐다만 봐":["Just Looking"],"돌스 (Dolls) (Inst.)":["Dolls (Inst)"],"쳐다만 봐 (Inst.)":["Just Looking (Inst)"],"넌 뭐니 (Who R U)":["WHO R U"],"티켓 (Ticket)":["TICKET"],"뉴스 (News)":["News"],"휘가로 (Figaro)":["Figaro"],"넌 뭐니 (Who R U) (Inst.)":["WHO R U (Instrumental)"],"티켓 (Ticket) (Inst.)":["TICKET (Instrumental)"],"뉴스 (News) (Inst.)":["News (Instrumental)"],"휘가로 (Figaro) (Inst.)":["Figaro (Instrumental)"]},
  "나인뮤지스A":{"입술에 입술 (Lip 2 Lip) (Inst.)":["Lip 2 Lip (Inst.)"]},
  "나인아이":{"아파 (Hurt)":["Hurt"]},
  "남우현":{"너만 괜찮다면":["If Only You Are Fine"],"여백 (餘白)":["Blank"],"열 번째 페이지":["10th Page"],"소년소녀 (Feat. 인피니트)":["Boys And Girls (feat. INFINITE)"],"그런 시간":["Those Times"],"나무":["Tree"],"소년소녀 (Feat. 인피니트) (Inst.)":["Boys And Girls (Instrumental) [feat. INFINITE]"],"Only 직진":["Only Forward"],"3분의 시간 뒤에는 돌아가야 해":["In 3 Minutes"],"널 만나고":["After I met you"],"조용히 내가 안아줄게요":["I'll hug you quietly"],"가혹해요":["Harsh on me"],"Only 직진 (Inst.)":["Only Forward (Instrumental)"],"너의 남자 (Boyfriend)":["Boyfriend"],"너의 남자 (Boyfriend) (Inst.)":["Boyfriend (Instrumental)"],"미래에서":["From the future"],"불장난":["DONE"],"낙원(My Paradise)":["My Paradise"],"냉정과 열정 사이":["Calm & Passion"],"오늘따라 (My Diary)":["Somehow (My Diary)"],"가을이 오면":["When Fall Comes"],"넌 나만 바라봐":["Just Look at Me"],"지금 이 노래":["A Song for You"],"같은자리":["The Same Place"],"사랑해":["I Love You"],"끄덕끄덕":["Still I Remember"],"그 사람":["Passerby"],"향기":["Nostalgia"],"사랑이 올 때":["When Love Comes"]},
  "남태현":{"밤의 끝자락 위에서":["On the Edge of the Night"],"밤의 끝자락 위에서 (English ver.)":["On the Edge of the Night (English Version)"]},
  "누에라":{"스파클 (Sparkle)":["Sparkle"],"무한대 (MU)":["MU"]},
  "뉴이스트":{"여보세요 (Re-mastering)":["Hello (2022 Remastered Version)"],"여왕의 기사 (Re-mastering)":["OVERCOME (2022 Remastered Version)"],"다시, 봄":["Again"],"않아 (ARON SOLO)":["I'M Not (Aron Solo)"],"꼭":["Must"],"반딧별":["Shooting Star"],"밤새":["Stay Up All Night"],"우리가 사랑했다면":["If We"],"노래 제목":["A Song for You"],"나의 천국":["Lost & Found"],"여왕의 기사":["Overcome"],"사실 말야":["VVITH"],"티격태격":["Emotion"],"나와 같은 차를 마시고 (A Scene Without You)":["A Scene Without You"],"사랑 없는 사랑":["Darkness"],"어깨빌려줘 (Feat. 계범주)":["Give Me a Shoulder (feat.Kye Bum Zu)"],"여보세요":["Hello"],"잠꼬대":["Sleep Talking"],"예뻐 (Feat. 유아라 Of 헬로비너스)":["Pretty (feat. YOOARA)"],"조금 더 사랑할게":["Love You More"],"야하게 입지마":["Please Don't"],"너네 누나 소개시켜줘":["The Girl Next Door"],"조금만 (Feat. 윤한 (Pop Pianist))":["A Little Bit More... (feat. Yoon Han)"],"생일 축하해요":["Happy Birthday"]},
  "뉴진스":{"우리의 밤은 당신의 낮보다 아름답다":["Our Night is more beautiful than your Day"],"우리의 밤은 당신의 낮보다 아름답다 (Inst.)":["Our Night is more beautiful than your Day (Instrumental)"],"아름다운 구속":["Beautiful Restriction (from \"A Time Called You\") [Music from The Netflix Series]"]},
  "니엘":{"못된 여자":["Love Killer","Lovekiller (Bad Girl)"],"네가 웃으면 내가 웃어":["When you smile, I smile"],"사랑이란 단어에 뭐가 들었든":["The Meaning Within Love"],"사랑에 대체 무슨 핑계야":["What’s the Excuse for Love?"],"이별하러 가는 길":["Parting Path"],"사랑했다 XX":["Loved XX"],"이별하러 가는 길 (Sped Up)":["Parting Path (Sped Up)"],"궤도 (In your space)":["In your space"],"오늘 (Today)":["Today"],"멋지게 헤어지는 방법":["Love Affair"],"잘 지내? (Feat. 저스디스)":["What's Good?"],"나 열나":["Fever"],"신호등":["Signal"],"그런 날":["Disappear"],"전화해 (Call me)":["Call Me","Call me"],"에필로그 (Epilogue)":["Epilogue"],"천사의 노래 (Song of an angel)":["Song of an Angel","Song of an angel"],"아포가토 (Feat. C.A.P)":["Affogato (feat. Cap)"]},
  "니쥬":{"새벽을 달려 (Into The Dawn)":["Into The Dawn"],"만약이라는 건 없어 (What if) - Japanese ver.":["What if -Japanese version-"],"만약이라는 건 없어 (What if)":["What if"]},
  "다니엘":{"저곳으로 (영화 인어공주 한국어 OST)":["Part of Your World (From \"The Little Mermaid\"/Korean Soundtrack Version)"]},
  "다원":{"그대와 그대 향기가":["Your Scent"],"그대와 그대 향기가 (Inst.)":["Your Scent (Instrumental)"]},
  "다이몬":{"찍찍찍 (Zip Zip Zip)":["Zip Zip Zip"],"열기구 (Heart Balloon)":["Heart Balloon"],"찍찍찍 (Zip Zip Zip) (Inst.)":["Zip Zip Zip - Instrumental"],"소년…소녀를 만나다":["Girls, Love boys, Love girls"],"딸기도둑":["Very"]},
  "다이아":{"우와":["WOOWA"],"안할래":["No"],"5분만":["5 more minutes"],"손톱달(Crescendo)":["Crescendo"],"우와(Inst.)":["WOOWA (Instrumental)"],"조아? 조아!":["Like U Like U"],"우우 (WooWoo)":["WooWoo"],"어른":["Grown up"],"데리러 와 (TAKE ME)":["TAKE ME"],"우우 (WooWoo) (Inst.)":["WooWoo (Instrumental)"],"넌 달라":["You're different"],"여.사.친 (우리사이)":["YOU & I"],"한입만 (L.U.B Ver.)":["Only one bite (L.U.B Version)"],"파라다이스 (Limited Ver.)":["Paradise (Limited Version)"],"왠지 (Somehow)":["Somehow"],"왠지 (Chinese Ver.)":["Somehow (Chinese Version)"],"왠지 (Acoustic Ver.)":["Somehow (Acoustic Version)"],"왠지 (Inst.)":["Somehow (Instrumental)"]},
  "다크비":{"나그네 (Traveler)":["Traveler"],"겁이나 (Me, Me & You)":["Me, Me & You"],"쏘아 올려 (Fireworks)":["Fireworks"],"넌 매일 (24/7)":["24/7"],"비눗방울 (Bubble)":["Bubble"],"넌 매일 (24/7) (Inst.)":["24/7 (Instrumental)"],"안취해 (Sober)":["Sober"],"왜 만나 (Rollercoaster)":["Rollercoaster"],"안취해 (Sober) [Remix]":["Sober (Remix)"],"미안해 엄마 (Sorry Mama)":["Sorry Mama"]},
  "달샤벳":{"속마음 (Ya Heart)":["Ya Heart"],"금토일":["FRI. SAT. SUN"],"좋으니까 (HARD 2 LOVE)":["HARD 2 LOVE"],"썸, 뭐?":["Some What"],"지긋이":["Stay with you"],"너 같은":["Someone like U"],"머리부터 발끝까지 (수빈 Solo)":["From head to toe (Subin Solo)"],"착한 남자 (Feat. 심스) (세리 Solo)":["Beautiful liar (Serri Solo) [feat. SIMS]"],"사랑한다고 해서 (우희 Solo)":["Love Hurts (Woohee Solo)"],"너 같은 (Inst.)":["Someone like U (Backing Track)"],"홀려":["possessed"],"그냥 지나가 (수빈 Solo) (Feat. 일훈 Of BTOB)":["Just Pass By (Soobin Solo) [feat. ILHOON]"],"너였나봐":["I guess it was you"],"내 다리를 봐 (Be Ambitious)":["Look at my legs (Be Ambitious)"],"어쩜 (Narr. 안재현)":["How (with Ahn Jae Hyun)"],"내 다리를 봐 (Inst.)":["Look at My Legs (Instrumental)"],"샤르르 (For Darling)":["For Darling"],"있기 없기":["Have, Don′t Have!"],"유리인형 (DON'T TOUCH)":["Don′t TOUCH"],"있기 없기 (Eelectro Swing Remix)":["Have, Don′t Have! (Eelectro Swing Remix)"],"있기 없기 (Inst.)":["Have, Don′t Have! (Instrumental)"],"다가와 봐 (Feat. 낯선)":["Follow Me (feat. Nassun)"],"니가 없이 난...":["Without You, I..."],"블링블링 (Bling Bling)":["Bling Bling"],"블링블링 (Bling Bling) (Inst.)":["Bling Bling (Instrumental)"]},
  "대성":{"한도초과":["HANDO-CHOGUA"],"장미 한 송이":["One Rose"],"혼자가 어울리나 봐":["Better Alone"],"그 시절의 우리":["Us Before"],"추억들로":["Our Memories"],"추억들로 (Inst.)":["Our Memories (Inst.)"],"빛(Light)":["Light"],"흘러간다":["Flow"],"흘러간다 (Inst.)":["Flow (Inst.)"],"나성에 가면":["Unexpected Business Season 3 \"Los Angeles\": When You Go To Na-Seong (Original Television Soundtrack)"],"솜사탕":["Cotton Candy"],"대박이야!":["A Big Hit"],"날 봐, 귀순":["Look At Me, Gwisun"]},
  "더보이즈":{"함께라서 눈부셨던, 서툴지만 아름다운":["Constellation"],"숨바꼭질 (Slip Away)":["Slip Away"],"넌 어떻게 생각해?":["How about you?"],"넌 어떻게 생각해? (Inst.)":["How about you? (Instrumental)"],"덫 (Rat In The Trap)":["Rat In The Trap"],"우리는":["We are"],"우리는 (Inst.)":["We are (Instrumental)"],"줄리의 법칙 (Fantasize)":["Fantasize"],"나만 아는 이야기 (Fairy Tale)":["Fairy Tale"],"더뽀이즈 바나나차차":["THE POYZ BANANA CHACHA (Korean Ver.)"],"더뽀이즈 바나나차차 (Inst.)":["THE POYZ BANANA CHACHA (Instrumental)"],"숨 (Horizon)":["Horizon"],"여름밤":["Summer Night"],"여름밤 (Inst.)":["Summer Night (Instrumental)"],"무중력 (Levitating)":["Levitating"],"환상열차 (Out Of Control)":["Out Of Control"],"지금처럼":["Will Be"],"지금처럼 (Inst.)":["Will Be (Instrumental)"],"우선순위":["Priority"],"우선순위 (Inst.)":["Priority (Instrumental)"],"흔적 (Scar)":["Scar"],"환상고백":["Break Your Rules"],"시간의 숲 (Goodbye)":["Goodbye"],"화이트 (White)":["White"],"위로 (Going High)":["Going High"],"자각몽 (Lucid Dream)":["Lucid Dream"],"지킬게 (KeePer) (Prod. 박경)":["Keeper (feat. Park Kyung)","Keeper"],"소년 (Boy)":["Boy"],"시간이 안 지나가 (Walkin' In Time)":["Walkin' in Time"],"있어 (Got It)":["Got It"],"소년 (Boy) (Inst.)":["Boy (Instrumental)"]},
  "데이식스":{"둘도 아닌 하나":["Not Two but One"],"구름 위에서":["Above the Clouds"],"무적 (ONE)":["One"],"우리 앞으로 더 사랑하자":["Let's Love More"],"한 페이지가 될 수 있게 (Time of Our Life)":["Time of Our Life"],"돌아갈래요 (Wanna Go Back)":["Wanna Go Back"],"포장 (Cover)":["Cover"],"아픈 길 (Hurt Road)":["hurt road"],"행복했던 날들이었다 (Days Gone By)":["days gone by"],"두통 (Headache)":["Headache"],"완전 멋지잖아 (So Cool)":["So Cool"],"마라톤 (Marathon)":["Marathon"],"혼자야":["All Alone"],"쏟아진다":["Pouring"],"그렇더라고요":["When you love someone"],"누군가 필요해":["I Need Somebody"],"남겨둘게":["I'll Remember"],"좋은걸 뭐 어떡해":["What Can I Do"],"놀래!":["Whatever!"],"놓아 놓아 놓아 (Letting Go)":["Letting Go"],"바래 (Wish)":["Wish"],"Free하게 (Freely)":["Freely"],"이상하게 계속 이래 (Out Of My Mind)":["Out Of My Mind"],"버릇이 됐어 (Habits)":["Habits"],"태양처럼 (Like That Sun)":["Like That Sun"]},
  "도드리":{"라일락":["LILAC"],"사계연서":["Seasonal Love Letters"],"꿈만 같았다":["Just Like a Dream"],"본 (本)":["Born (本)"]},
  "도영":{"마음이 들리니":["Listen To My Soul"],"마음이 들리니 (Inst.)":["Listen To My Soul (Instrumental)"],"누구일까?":["Who Would It Be?"],"현실 자각 타임":["Oops"],"어이없네?":["Seriously?"],"럭셔리 데이트":["Luxury Date"],"우리가 이별한 이유":["End of Us"],"늦은 말 (Promise)":["Promise"],"아픈 말":["Still Here"],"아픈 말 (Inst.)":["Still Here (Instrumental)"],"시간을 넘어 너에게로":["I find you"],"시간을 넘어 너에게로 (Inst.)":["I find you (Instrumental)"],"눈의 꽃":["Snow Flower"],"눈의 꽃 (Inst.)":["Snow Flower (Instrumental)"],"시리도록 눈부신":["The Story"],"첫사랑":["First Love"],"첫사랑 (Inst.)":["First Love (Instrumental)"],"사랑할 수 없는 너에게":["Unable To Love"],"사랑할 수 없는 너에게 (Inst.)":["Unable To Love (Instrumental)"],"아주 조금만 더":["A little more"],"아주 조금만 더 (inst.)":["A little more (Instrumental)"],"밤공기":["Night Air"],"밤공기 (Inst.)":["Night Air (Instrumental)"]},
  "도한세":{"청야 (靑夜)":["Blue Night"],"바다를 담은 듯한 그 눈을 본다":["Eyes Deep As The Ocean"],"아스라이 (Feat. 123)":["Asurai (feat. 123)"],"살냄새":["Scent of Skin"],"향기 (Feat. Kid Wine, 용용(yongyong))":["Scent (feat. Kid Wine & Yong Yong)"]},
  "동방신기":{"아스라이… (Beautiful Stranger)":["Beautiful Stranger (MAX Solo)"],"현기증 (Vertigo)":["Vertigo"],"샴페인 (Champagne) (Sung By U-Know)":["Champagne (U-Know Solo)"],"비를 타고... (Everyday It Rains)":["Everyday It Rains"],"너는 내꺼 (Top of The World)":["Top of The World"],"수리수리 (Spellbound)":["Spellbound"],"너의 남자 (Your Man)":["Your Man"],"오늘밤 (Moonlight Fantasy)":["Moonlight Fantasy"],"그 대신 내가 (Beside)":["Beside"],"갈증 (Smoky Heart)":["Smoky Heart"],"뒷모습 (Steppin')":["Steppin'","Steppin`"],"11월... 그리고 (November With Love)":["November With Love"],"항상 곁에 있을게 (Always With You)":["Always With You"],"인생은 빛났다 (Viva)":["Viva"],"비누처럼 (Like a Soap)":["Like a Soap"],"꿈 (Dream)":["Dream"],"왜 (Keep Your Head Down)":["Keep Your Head Down"],"믿기 싫은 이야기 (How can I)":["How Can I"],"고백 (Confession)":["Confession"],"아테나 (ATHENA)":["ATHENA","Athena"],"바보 (Unforgettable)":["Unforgettable"],"내가 허락할 테니 (Love Is Never Gone)":["Love Is Never Gone"],"작은 고백 (Love Is All I Need)":["Love Is All I Need"],"약속했던 그때에 (Always There...)":["Always There..."],"마법의 성 (Magic Castle)":["Magic Castle"],"글로리아 높으신 이의 탄생 (Angels We Have Heard On High)":["Angels We Have Heard On High"],"고요한밤 거룩한밤 (Silent Night Holy Night)":["Silent Night Holy Night"],"마법의 성 (Magic Castle) (Inst.)":["Magic Castle (Instrumental)"],"옹달샘 이야기-하나":["Mountain Spring Story, Pt. 1"],"옹달샘 (Mountain Spring)":["Mountain Spring"],"옹달샘 이야기-둘":["Mountain Spring Story, Pt. 2"]},
  "동키즈":{"해바라기":["Sunflower"],"해바라기 (inst.)":["Sunflower (Instrumental)"],"세상 가장 아름다웠던 (Recollection)":["Recollection"],"낮달 [CLEF X DKZ]":["Daymoon [CLEF X DKZ]"],"낮달 [CLEF X DKZ] (Inst.)":["Daymoon [CLEF X DKZ] [Instrumental]"],"놈 (NOM) (2023 Remaster)":["NOM (2023 Remaster)"],"상상 속의 너 (2023 Remaster)":["Dreaming You (2023 Remaster)"],"사랑도둑 (Cupid)":["Cupid"],"호랑이가 쫓아온다 (Uh-Heung)":["Uh-Heung"],"호랑이가 쫓아온다 (Uh-Heung) (Inst.)":["Uh-Heung (Instrumental)"],"사랑도둑 (Cupid) (Inst.)":["Cupid (Instrumental)"],"상상 속의 너":["Dreaming You"],"상상 속의 너 (inst.)":["Dreaming You (Instrumental)"],"놈 (NOM)":["Nom"],"놈 (NOM) (Remix)":["Nom (Remix)"],"놈 (inst.)":["Nom (Instrumental)"]},
  "동해":{"해 떴네":["HAErise"],"틈(cracked)":["cracked"],"틈(cracked) (Inst.)":["cracked (Instrumental)"],"Blue Moon (Feat. 미연 of (여자)아이들)":["Blue Moon (feat. MIYEON)"]},
  "드리핀":{"손을 뻗어봐":["Reach out Your Hands"],"물들여":["Colors"],"빛":["Light"],"너의 소원 안에 내가 있었으면 해 (WISH)":["WISH"]},
  "드림노트":{"밤 (NIGHT)":["NIGHT"],"오늘보다 내일 더":["THANK YOU"],"바라다 (WISH)":["Wish"],"꿈의 섬으로 (La Isla Bonita)":["La Isla Bonita"],"바라다 (WISH) (Inst.)":["Wish (Instrumental)"],"하쿠나 마타타":["Hakuna Matata"],"취미는 너":["My Hobby Is You"],"하쿠나 마타타 (Inst.)":["Hakuna Matata (Instrumental)"],"빛의 시작 dreamin'tro":["In the Beginning"],"좋아하나봐":["Like You"],"좋아하나봐 (Inst.)":["Like You (Instrumental)"],"초록빛 (Joyful Green) (Korean Ver.)":["Joyful Green (Korean Ver.)"],"초록빛 (Joyful Green) (Japanese Ver.)":["Joyful Green (Japanese Ver.)"],"고장 나 (Broken)":["Broken"],"꿀벌의 노래":["The song of the honeybee"]},
  "드림캐쳐":{"황홀경 (极夜) (SIYEON SOLO)":["Ecstasy (SIYEON SOLO)"],"한겨울 (寒冬) (HANDONG SOLO)":["Midwinter (HANDONG SOLO)"],"해바라기의 마음 (A Heart of Sunflower)":["A Heart of Sunflower"],"바람아 (Wind Blows)":["Wind Blows"],"시간의 틈 (New days)":["A Gap in Time (New Days)"],"데자부 (Deja Vu)":["Deja Vu"],"거미의 저주 (The curse of the Spider)":["The curse of the Spider"],"북극성 (Polaris)":["Polaris"],"그리고 아무도 없었다":["And there was no one"],"약속해 우리 (July 7th)":["Promise Us (July 7th)"],"어느 별":["which star"],"날아올라 (Fly high)":["Fly high"],"괜찮아!":["Are you okay!"],"날아올라 (Fly high) (Inst.)":["Fly high (Instrumental)"]},
  "디에잇":{"나란히 (Side By Side) (Korean Ver.)":["Side By Side (Korean Version)"]},
  "디오":{"너의 모든 순간":["Every Moment Of You"],"너의 모든 순간 (Inst.)":["Every Moment Of You (Inst.)"],"놀이터 (Do you remember?)":["Do you remember?"],"틈 (5 minutes)":["5 minutes"],"내일을 너에게 (I’ll Be There)":["I’ll Be There"],"나답게 (Draw my path)":["Draw my path"],"기억의 온기 (Where You Were)":["Where You Were"],"우리 (IN ANOTHER LIFE)":["IN ANOTHER LIFE"],"사랑한다는 건 (Love to Love U)":["Love to Love U"],"밤에 내린 눈 (Snowfall at Night)":["Snowfall at Night"],"밤에 내린 눈 (Snowfall at Night) (Inst.)":["Snowfall at Night (Inst.)"],"우리가 몰랐던 것들 (Simple Joys)":["Simple Joys"],"오늘에게 (Good Night)":["Good Night"],"매일의 고백 (My Dear)":["My Dear"],"어제의 너, 오늘의 나 (About Time)":["About Time"],"괜찮아도 괜찮아 (That's okay)":["That's okay"],"괜찮아도 괜찮아 (That's okay) (Inst.)":["That's okay (Instrumental)"]},
  "라붐":{"얼마나 좋을까":["How I Wish"],"똑같잖아":["Repeat"],"잡아줄게":["You're the Light"],"이별 앞에서":["Stay There"],"사실 이 얘기는 비밀인데":["Actually, This Is a Secret"],"일기":["Diary"],"불을 켜 (Turn It On)":["Turn It On"],"흐르는 이 노래가 멈추고 나면 (Heal Song)":["Heal Song"],"체온 (Original ver.)":["Between Us"],"체온 (Between Us)":["Between Us"],"체온 (Between Us) (inst.)":["Between Us (Instrumental)"],"푱푱 (Shooting Love)":["Shooting Love"],"딩동 (Ding Dong)":["Ding Dong"],"푱푱 (Shooting Love) (Inst.)":["Shooting Love (Instrumental)"],"아로아로":["Aalow Aalow"],"아로아로 (Inst.)":["Aalow Aalow (Instrumental)"],"상상더하기 WINTER ++":["Fresh Adventure WINTER ++"],"봄을 만나":["Oh My"],"봄을 만나 (Inst.)":["Oh My (Instrumental)"],"두바둡 (only u)":["Only U"],"두바둡 (only u) (Inst.)":["Only U (Instrumental)"]},
  "라비":{"안녕":["WHO WE ARE"],"애니(feat.소연 ((여자)아이들))":["ANI (feat. JEON SOYEON)"],"멈춰(PAUSE)":["PAUSE"],"낙엽(feat.10CM)":["Leaf (feat. 10CM)"],"녹는점 (See-Through) (Feat. Cold Bay)":["See-Through (feat. Cold Bay)"],"나홀로 집에 (Feat. 정용화)":["Home Alone (feat. Jung Yonghwa)"],"아 몰라 일단 Do The Dance":["Do the Dance"],"뇌비우스의 띠 (Feat. ESBEE)":["Noebius Strip (feat. ESBEE)"]},
  "라잇썸":{"아름답고도 아프구나 (상아, 초원, 주현)":["Beautiful Pain (SANGAH, CHOWON, JUHYEON)"]},
  "러블리즈":{"지금, 우리":["Now, We"],"새벽별 (Babysoul & Kei & JIN)":["Morning Star"],"첫눈":["First Snow"],"똑똑":["Knock Knock"],"숨바꼭질":["Hide and Seek"],"나의 연인 (Yoo Ji-Ae & Seo Ji-Soo)":["My Little Lover"],"어제처럼 굿나잇":["Good Night Like Yesterday"],"이별 Chapter 1":["Good-bye Chapter 1"],"비밀여행":["Getaway"],"남보다 못한 사이 (Feat. 휘성) (Babysoul Solo)":["Stranger"],"그녀는 바람둥이야 (Feat. 동우 Of 인피니트) (Babysoul&Kei)":["She is a flirt"],"너만 없다 (JIN Solo)":["Gone"],"닿으면, 너":["November"],"그 시절 우리가 사랑했던 우리 (Beautiful Days)":["When We Were Us (Beautiful Days)"],"찾아가세요 (Lost N Found)":["Lost N Found"],"백일몽":["Daydream"],"꽃점":["Floral"],"여름 한 조각":["Wag-Zak"],"그날의 너 (That Day)":["That Day"],"미묘미묘해":["Mi-myo Mi-myo"],"수채화 (Watercolor)":["Watercolor"],"종소리 (Twinkle)":["Twinkle"],"삼각형 (Triangle)":["Triangle"],"그냥 (Just)":["Just"],"비밀정원 (Secret Garden)":["Secret Garden"],"졸린 꿈 (Sleepy Dreams)":["Sleepy Dreams"],"퐁당":["Fondant"],"책갈피":["Bookmark"],"마음 (*취급주의)":["Dear You"],"인형":["Baby Doll"],"그대에게":["For You"],"예쁜 여자가 되는 법 (How to Be a Pretty Woman)":["How to Be a Pretty Woman"],"새콤달콤 (Sweet & Sour)":["Sweet & Sour"],"라푼젤 (Rapunzel)":["Rapunzel"],"안녕 (Hi~)":["Hi~"],"놀이공원":["Joyland"]},
  "레드벨벳":{"미래":["Future"],"미래 (Inst.)":["Future (Instrumental)"],"피카부 (Peek-A-Boo) (Japanese Ver.)":["Peek-A-Boo (Japanese Version)"],"러시안 룰렛 (Russian Roulette) (Japanese Ver.)":["Russian Roulette (JP version)"],"빨간 맛 (Red Flavor) (Japanese Ver.)":["Red Flavor (JP version)"],"환생 (Rebirth)":["Rebirth"],"환생 (Rebirth) (Inst.)":["Rebirth (Instrumental)"],"여시주의":["Yossism (Music from Telemonster)"],"세가지 소원 (Wish Tree)":["Wish Tree - WINTER GARDEN"],"사탕 (Candy)":["Candy"]},
  "레오":{"나는 요즘":["Nowadays"],"꿈":["Dream"]},
  "레이":{"모노드라마 (Monodrama)":["Monodrama"],"모노드라마 (Monodrama) (Inst.)":["Monodrama (Instrumental)"]},
  "레이나":{"눈물이 뚝뚝뚝 (Feat. 조성확)":["Tears Keep Falling (feat. IHWAK)"],"눈물이 뚝뚝뚝 (Feat. 조성확) (Inst.)":["Tears Keep Falling (feat. IHWAK) [Instrumental]"],"널 사랑하나봐 (Feat. 안재우)":["Loving You (Feat. Jae Woo AN)"],"사랑의 다른 말":["Take It All Away"],"사랑의 다른 말 (Inst.)":["Take It All Away (Inst.)"],"끝나지 않는 밤":["Endless Night"],"끝나지 않는 밤 (Inst.)":["Endless Night (Instrumental)"],"오늘 연락해":["Waiting for You"],"오늘 연락해(Inst.)":["Waiting for You (Instrumental)"],"앤":["Ann"],"앤 (Inst.)":["Ann (Instrumental)"],"작아지는 중":["It's Okay"],"밥 영화 카페 (Feat. Aron Of NU'EST)":["Loop"],"맡겨줘":["Your Day"],"같이 있고 싶어":["Treat You Better"],"모르겠다":["Don't Know"],"장난인거 알아 (Feat. 칸토 Of 트로이)":["You End, and Me (feat. Kanto)"],"레파토리":["Repatory"]},
  "레이디스 코드":{"미치게 훅가게":["Make Me Go Crazy"],"미치게 훅가게 (Inst.)":["Make Me Go Crazy (Instrumental)"],"예뻐 예뻐":["Pretty Pretty"],"예뻐 예뻐 (Inst.)":["Pretty Pretty (Inst.)"],"나쁜여자":["Bad Girl"],"안울래":["I Won't Cry"]},
  "려욱":{"첫눈처럼 너에게 가겠다 (Change Street Ver.)":["I will go to you like the first snow (Change Street Version)"],"사랑이라는 건":["Love is"],"사랑이라는 건 (inst)":["Love is (Instrumental)"],"마중 (Lingering)":["Lingering"],"아무것도 하지 않아도 돼 (It's okay)":["It's okay"],"아무것도 하지 않아도 돼 (It's okay) (Inst.)":["It's okay (Instrumental)"],"사랑이 마음 곁에 남아 (Goodbye)":["Goodbye"],"사랑이 마음 곁에 남아 (Goodbye) (Inst.)":["Goodbye (Inst.)"],"별이 쏟아지는 밤":["Starry Night"],"별이 쏟아지는 밤 (Inst.)":["Starry Night (Instrumental)"],"너에게 (I’m not over you)":["I'm not over you"],"우리의 거리 (One and Only)":["One and Only"],"취해 (Drunk in the morning)":["Drunk in the morning"],"파란 별 (The 2nd Story) (*Special Track)":["The 2nd Story (Special Track)"],"더 사랑한다면":["If You Love Me More"],"더 사랑한다면 (Inst.)":["If You Love Me More (Instrumental)"]},
  "로켓펀치":{"주인공 (In My World)":["In My World"],"덤덤 (Red Balloon)":["Red Balloon"],"어제, 오늘 내일보다 더":["Love More"],"여름밤":["One Summer Night"],"종이별 (Paper Star)":["Paper Star"],"다시, 봄 (Lilac)":["Lilac"],"여자사람친구 (Girl Friend)":["Girl Friend"],"빔밤붐 (BIM BAM BUM)":["Bim Bam Bum"],"선을 넘어 (Do something)":["Do Something"]},
  "롱샷":{"좋은 마음으로":["All Good"],"아닌 걸 알아 이제":["Ejeh"]},
  "루네이트":{"나의 가장, 아름다운 세상":["If I could"],"나비(Butterfly)":["Butterfly"],"지금 만나 (Now)":["Now"]},
  "루한":{"이게 바로 나 (Dream up)":["这就是我"],"극중인 (Imitation)":["Imitation"],"체득 (Nature)":["Nature"]},
  "르세라핌":{"이브, 프시케 그리고 푸른 수염의 아내":["Eve, Psyche & the Bluebeard's Wife"],"미치지 못하는 이유":["Crazier"],"피어나 (Between you, me and the lamppost)":["FEARNOT (Between you, me and the lamppost)"]},
  "리센느":{"백화요란 (Inside Out)":["Inside Out"],"고백주파수":["Love Frequency"],"고백주파수 (Inst.)":["Love Frequency (Instrumental)"],"밤밤밤":["BamBamBam"],"밤밤밤 (Inst.)":["BamBamBam (Instrumental)"]},
  "리아":{"푸른꽃":["Blue Flower"],"푸른꽃 (Inst.)":["Blue Flower (Instrumental)"],"밝혀줄게 별처럼":["Always be your star"],"밝혀줄게 별처럼 (Inst.)":["Always be your star (Instrumental)"]},
  "리즈":{"프린세스 캐치! 티니핑 주제곡":["Princess Catch! Teenieping (Original Soundtrack)"]},
  "린지":{"보리울의 여름 (서로 사랑해요)":["Season in the Sun (Love Each Other)"],"보리울의 여름 (서로 사랑해요) MR":["Season in the Sun (Love Each Other) [Instrumental]"]},
  "마마무":{"데칼코마니":["Décalcomanie"],"넌 is 뭔들":["You're the Best","You're The Best"],"하나둘셋 어이! (1,2,3 Eoi!)":["1,2,3 Eoi!"],"하늘 땅 바다만큼 (mumumumuch)":["mumumumuch"],"분명 우린 그땐 좋았었어 (Happier than Ever)":["Happier than Ever"],"칠해줘 (Paint Me) (Orchestra ver.)":["Paint Me (Orchestra Version)"],"별이 빛나는 밤 (Starry Night) (Orchestra ver.)":["Starry Night (Orchestra Version)"],"고고베베 (gogobebe) (Rock ver.)":["gogobebe (Rock Version)"],"너나 해 (Egotistic) (Blistering sun ver.)":["Egotistic (Blistering sun Version)"],"넌 is 뭔들 2021 (You’re the best 2021)":["You're the best 2021"],"히히하헤호 Part.2 (HeeHeeHaHeHo Part.2)":["HeeHeeHaHeHo Part.2"],"우리끼리 2021 (Words Don't Come Easy 2021)":["Words Don't Come Easy 2021"],"따끔 2021 (A little bit 2021)":["A little bit 2021"],"음오아예 2021 (Um Oh Ah Yeh 2021)":["Um Oh Ah Yeh 2021"],"행복하지마 2021 (Don’t Be Happy 2021)":["Don't Be Happy 2021"],"썸남썸녀 (Peppermint Chocolate) (MMM ver.)":["Peppermint Chocolate (MMM Version)"],"우린 결국 다시 만날 운명이었지 (Destiny) (Extended ver.)":["Destiny (Extended Version)"],"Mr.애매모호 2021 (Mr. Ambiguous 2021)":["Mr. Ambiguous 2021"],"나로 말할 것 같으면 (Yes I am) (Funk boost ver.)":["Yes I am (Funk boost Version)"],"내일의 너, 오늘의 나 (Another Day)":["Another Day"],"애써 (A Memory for Life)":["A Memory for Life"],"우린 결국 다시 만날 운명이었지 Part.2 (Destiny Part.2)":["Destiny Part.2"],"딩가딩가 (Dingga)":["Dingga"],"딩가딩가 (Dingga) (Inst.)":["Dingga (Instrumental)"],"열 밤 (Ten Nights)":["Ten Nights"],"다 빛이나 (Gleam)":["Gleam"],"다 빛이나 (Gleam) (Inst.)":["Gleam (Instrumental)"],"꿈 속의 그대":["You in My Dreams"],"꿈 속의 그대 (Inst.)":["You in My Dreams (Instrumental)"],"매일 봐요":["Everyday"],"칠해줘":["Paint Me"],"칠해줘 (Inst.)":["Paint Me (Instrumental)"],"나로 말할 것 같으면 (Yes I am)":["Yes I Am"],"구차해 (Solo. 문별)":["Love & Hate (Solo Moon Byul)"],"아재개그 (Narr. 김대희, 김준호)":["AZE GAG"],"다라다 (DA RA DA) (휘인, Jeff Bernat, B.O.)":["DA RA DA (feat. Whee In, Jeff Bernat & B.O.)"],"마음아 열려라":["Open Your Mind"],"마음아 열려라 (Inst.)":["Open Your Mind (Instrumental)"],"기대해도 좋은 날":["Woo Hoo"],"기대해도 좋은 날 (Inst.)":["Woo Hoo (Instrumental)"],"1cm의 자존심":["Taller than you"],"내 눈 속엔 너 (My Everything)":["My Everything"],"내 눈 속엔 너 (My Everything) (Inst.)":["My Everything (Instrumental)"],"Mr.애매모호":["Mr. Ambiguous"],"히히하헤호(With 긱스)":["HeeHeeHaHeHo (feat. Geeks)"],"내맘이야 (화사 Solo)":["I do me (Solo Version) [feat. Hwa Sa]"],"행복하지마 (With 범키)":["Don't Be Happy (feat. BUMKEY)"]},
  "마유카":{"회유하는 아르파프레데리움":["Floating Arpaphrederium"]},
  "메이딘":{"안 봐도 비디오 (Super Obvious)":["Super Obvious"],"안 봐도 비디오 (Super Obvious) (Acca.)":["Super Obvious (Acca.)"],"안 봐도 비디오 (Super Obvious) (Inst.)":["Super Obvious (Instrumental)"],"사랑, 두려움":["LOVE, AFRAID"],"사랑, 두려움 (Acca.)":["LOVE, AFRAID (Accapella)"],"사랑, 두려움 (Inst.)":["LOVE, AFRAID (Instrumental)"]},
  "멜로디데이":{"잠은 안 오고":["Restless"],"토닥토닥":["Pat Pat"],"별의 노래":["The Song of the Star"],"별의 노래 (Inst.)":["The Song of the Star (Instrumental)"],"흔한 멜로디 (Feat. JQ)":["An Ordinary Melody (feat. JQ)"],"바빠 보여요 (Feat. 정일훈 Of 비투비)":["You Seem Busy (feat. JUNG ILHOON)"],"바빠 보여요 (Feat. 정일훈 Of 비투비) (Inst.)":["You Seem Busy (Instrumental) [feat. JUNG ILHOON]"],"깔로 (Color)":["Color"],"널 느끼고 널 느끼며":["U"],"미워 미워 미워":["Hate"],"비가 내리면 (Feat. 라비 of 빅스)":["When It Rains (feat. Ravi)"],"겁나 (Feat. 매드클라운)":["Anxious (feat. Mad Clown)"],"겁나 (Inst.)":["Anxious (Instrumental)"],"사랑을 몰라서":["You're My Everything"],"사랑을 몰라서 (Inst.)":["You're My Everything (Instrumental)"],"모래시계":["Heart in a Bottle"],"어떤 안녕":["Another Parting"],"모래시계 (Inst.)":["Heart in a Bottle (Instrumental)"],"어떤 안녕 (Inst.)":["Another Parting (Instrumental)"],"달콤하게 랄랄라":["Sweety Lalala"],"달콤하게 랄랄라 (Inst.)":["Sweety Lalala (Instrumental)"],"혼자하는 사랑":["Loving Alone"],"혼자하는 사랑 (Inst.)":["Loving Alone (Instrumental)"],"다 너로 보인다":["Miracle"],"다 너로 보인다 (Inst.)":["Miracle (Inst) [instrumental]"],"그때처럼":["Miss you"],"그때처럼 (Inst.)":["Miss You (Instrumental)"]},
  "모모랜드":{"뿜뿜":["Bboom Bboom"],"찌릿찌릿":["Chiri Chiri"],"티키타카":["Tiki Taka"],"티키타카 (Inst.)":["Tiki Taka (Instrumental)"],"바나나차차":["BANANA CHACHA"],"바나나차차 (Inst.)":["BANANA CHACHA (Instrumental) [Instrumental]"],"빛나":["Light Up"],"베리베리":["Veryvery"],"빙고게임":["Bingo Game"],"안아줘":["Hug Me"],"안아줘 (Inst.)":["Hug Me (Instrumental)"],"궁금해":["Curious"],"어마어마해 (EDM Ver.) (Inst.)":["Wonderful Love (EDM Version) [Instrumental]"],"꼼짝마":["Freeze"],"좋아":["I Like It"],"너, 어느 별에서 왔니":["What Planet Are You From?"],"오르골":["Orgel"],"어마어마해 (EDM Ver.)":["Wonderful Love (EDM Version)"],"꼼짝마 (Inst.)":["Freeze (Instrumental)"],"어마어마해":["Wonderful Love"],"어마어마해 (Inst.)":["Wonderful Love (Instrumental)"],"짠쿵쾅":["JJan! Koong! Kwang!"],"상사병":["Love Sick"],"어기여차":["Uh-Gi-Yeo-Cha"],"짠쿵쾅 (Inst.)":["JJan! Koong! Kwang! (Instrumental)"],"어기여차 (Inst.)":["Uh-Gi-Yeo-Cha (Instrumental)"]},
  "몬스타엑스":{"무단침입 (Trespass) (Rerecorded)":["Trespass (Rerecorded)"],"아름다워 (Beautiful) (Rerecorded)":["Beautiful (Rerecorded)"],"사랑한다 (Rerecorded)":["LOVE FOREVER (Rerecorded)"],"괜찮아 (Rerecorded)":["IT'S ALRIGHT (Rerecorded)"],"갈증":["갈증"],"대동단결":["대동단결"],"무모하고 대책없지만 (with TTG)":["Reckless (with TTG)"],"악몽 (Ghost)":["Ghost"],"난기류 (Turbulence)":["Turbulence"],"그놈의 크리스마스 (Lonely Christmas)":["Lonely Christmas"],"열대야":["Tropical Night"],"뉴튼 (NEWTON)":["Newton"],"넘사벽 (Incomparable)":["Incomparable"],"니가 필요해 (Need U)":["Need U"],"너만 생각해 (All I Do)":["All I Do"],"넌 어때 (I'll Be There)":["I'll Be There"],"하얀소녀":["White Love"],"걸어 (All in)":["All In"],"네게만 집착해":["Stuck"],"백설탕":["Sweetheart"],"반칙이야":["Unfair Love"],"신속히 (RUSH)":["RUSH"],"삐뚤어질래 (Gone Bad)":["Gone Bad"],"출구는 없어 (No Exit)":["No Exit"],"솔직히 말할까 (Honestly)":["Honestly (with Dasom)"],"훔쳐 (Steal Your Heart)":["Steal Your Heart"],"인터스텔라 (Feat. Yella Diamond)":["Interstellar (feat. Yella Diamond)"]},
  "문별":{"기세":["MOMENTUM"],"이륙 (Take-off)":["Take-off"],"그런 밤 (After Sunset)":["After Sunset"],"겁이나 (Without)":["Without"],"서툰 이별을 하려해":["Trying to say good-bye"],"서툰 이별을 하려해 (Inst.)":["Trying to say good-bye (Instrumental)"],"머리에서 발끝까지(Shutdown) (Feat.Seori)":["Shutdown (feat. Seori)"],"머리에서 발끝까지(Shutdown) (Inst.)":["Shutdown (Instrumental) [feat. Seori]"]},
  "문종업":{"비너스(feat. 권현빈)":["Venus (feat. VIINI)"],"비너스(feat. 권현빈) (inst.)":["Venus (feat. VIINI) [Inst.]"]},
  "미래소년":{"소름 (Amazing)":["Amazing"],"일곱페이지 (Dear My Friend)":["Seven Pages (Dear My Friend)"],"비밀 (#Secret)":["#Secret"]},
  "미료":{"그란 카나리아 (Feat. K JUN)":["Gran Canaria (Feat. K JUN)"]},
  "미소":{"한걸음 더":["One More Step"],"한걸음 더 (Inst.)":["One More Step (Instrumental)"]},
  "미쓰에이":{"남자 없이 잘 살아":["I Don't Need a Man"],"멍하니":["Are You Dazed"],"그 음악을 틀어줘요 DJ":["Play That Music, DJ"],"딱 마주쳐":["Meet Again"],"다시 사랑":["Love Again"]},
  "미야오":{"띠로리 (DDI RO RI)":["DDI RO RI"]},
  "미연":{"봄꽃":["spring flowers"],"봄꽃 (Inst.)":["spring flowers (Instrumental)"],"우리 우연히 만나":["When we meet again"],"우리 우연히 만나 (Inst.)":["When we meet again (Instrumental)"],"적월 (Red Moon)":["Red Moon"],"적월 (Red Moon) (Inst.)":["Red Moon (Instrumental)"],"기도 (Ver.Acoustic)":["Pray (Acoustic Version)"],"기도 (Ver.Acoustic) (Inst.)":["Pray (Acoustic Version Instrumental)"],"달빛에 그려지는":["The Painted On The Moonlight"],"달빛에 그려지는 (inst.)":["The Painted On The Moonlight (Instrumental)"],"무덤덤(Numb)":["Numb"],"소나기":["Rain"]},
  "민규":{"체념 後(후)":["After Resignation"],"체념 後(후)  (Inst.)":["After Resignation (Instrumental)"]},
  "민기":{"어디에 있어":["Where are you"],"어디에 있어 (inst.)":["Where are you (Inst.)"]},
  "민니":{"숨":["Breath"],"숨 (Inst.)":["Breath (Instrumental)"],"꿈결같아서":["Like A Dream"],"꿈결같아서 (Inst.)":["Like A Dream (Instrumental)"],"타이밍":["Timing"],"타이밍 (Inst.)":["Timing (Instrumental)"],"얼음들":["Melted (from \"[THE SEASONS VolⅡ. 8] <AKMU's Long day Long night> ReːWake x MINNIE\")"],"너의 하루를 묻고 싶어":["Saying Hello"],"너의 하루를 묻고 싶어 (Inst.)":["Saying Hello (Inst.)"]},
  "민영":{"오늘 밤 뭐해?":["What′re you doing tonight?"],"오늘 밤 뭐해? (Inst.)":["What′re you doing tonight? (Instrumental)"]},
  "바다":{"소란스런 이별":["Our Loud Goodbye"],"소란스런 이별 (Inst.)":["Our Loud Goodbye (Instrumental)"],"국지성 호우":["localized heavy rain"],"여름안에서":["In the Summer (from \"You Hee yul's Sketchbook With you : 93th Voice 'Sketchbook X BADA', Vol.142\")"],"제주도의 푸른밤":["The Blue Night of Jeju Island"],"단 한사람":["Baking King, Kim Takgu (Original Soundtrack) Part.4 - Only One Person"],"우리 다시 (Diary)":["Diary"],"사랑할거야(Forever Love) (Feat. C.G)":["Forever Love (feat. C.G)"],"내게로 (One step slower) (Feat. C.G)":["One Step Slower (feat. C.G)"],"곁에 있으니까 (Place Of Sun)":["Place Of Sun"],"이름 없는 별 (Like A Shining Star) (One Take Ver)":["Like A Shining Star (One Take Version)"],"이렇게 난 (Here I Am Waiting)":["Here I Am Waiting"],"축제 (Good Luck)":["Good Luck"],"새로운 날에":["A Day of Renew"]},
  "박경":{"보통연애":["Ordinary Love"],"띵동":["Ddingdong"],"띵동 (Inst.)":["Ddingdong (Instrumental)"],"새로고침 (Feat. 강민경 of 다비치)":["Refresh (feat. Kang Minkyung)"],"사랑을 한 번 할 수 있다면 (Feat. 제이레빗)":["To Love Only Once (feat. J Rabbit)"],"다만 너":["Lucid Dream"],"다만 너 (Inst.)":["Lucid Dream (Instrumental)"],"귀차니스트":["Gwichanist"],"인스턴트 (Feat. SUMIN)":["Instant (feat. sumin)"],"밤하늘":["The Night Sky"],"밤하늘 (Inst.)":["The Night Sky (Instrumental)"],"너 앞에서 나는 (Feat. 브라더수)":["When I'm with you (feat. BrotherSu)"],"오글오글":["OgeulOgeul"],"자격지심 (Feat. 은하 Of 여자친구)":["Inferiority complex (feat. EUNHA)","Inferiority Complex (feat. EUNHA)"],"잔상 (Feat. 윤현상)":["Memories (feat. Yoon Hyun Sang)"]},
  "박규리":{"기다릴 거에요":["I′ll Wait for You"],"기다릴 거에요 (Inst.)":["I′ll Wait for You (Instrumental)"]},
  "박봄":{"아이(I) (Feat. DAWN)":["I (feat. DAWN)"],"아이(I) (Feat. DAWN) (Inst.)":["I (Instrumental) [feat. DAWN]"],"이 밤의 끝을 잡고":["Holding The End Of This Night"],"꽃 (With 김민석 of 멜로망스)":["Flower (feat. Kim Min Seok)"],"꽃 (With 김민석 of 멜로망스) (Inst.)":["Flower (Instrumental) [feat. Kim Min Seok]"],"넌 나의 거울 (웹툰 '쌈 마이웨이' X 박봄)":["My Reflection (Original Soundtrack from the Webtoon \"Fight For My Way\")"],"넌 나의 거울 (웹툰 '쌈 마이웨이' X 박봄) (Inst.)":["My Reflection (Original Soundtrack from the Webtoon \"Fight For My Way\") [Instrumental]"],"도레미파솔 (Feat. 창모)":["Do Re Mi Fa Sol (feat. CHANGMO)"]},
  "박소진":{"안녕":["Bye"],"안녕 (inst.)":["Bye (Instrumental)"],"매일 그대와":["Everyday with you (From \"Reply 1988, Pt. 8\") [Original Television Soundtrack]"],"아찔아찔":["dizzy"],"아찔아찔 (Inst.)":["dizzy (Instrumental)"]},
  "박재범":{"All Day (Flex) (Feat. HAON (김하온) & 염따) (Prod. By OkayJJack)":["All Day (Flex) [feat. HAON & YUMDDA]"],"홀로 (Prod. By Slom)":["By Myself"],"곁에 있어주길 (STAY WITH ME)":["Stay with Me"],"사실은 (The Truth Is)":["The Truth Is"],"나나 (NaNa) (Feat. 로꼬 & AOMG)":["NaNa (feat. Loco)"],"나나 (NaNa) (Inst.)":["NaNa (Instrumental)"],"해피엔딩":["Happy Ending (From \"Rooftop Prince\")"],"해피엔딩 (Inst.)":["Happy Ending (From \"Rooftop Prince\") [Instrumental]"]},
  "박정민":{"바람이 불어온다":["Wind is blowing"],"바람이 불어온다 (inst.)":["Wind is blowing (Inst.)"],"그립다":["Missing You"],"그립다 (inst.)":["Missing You (Inst.)"],"넌 알고 있니":["Do You Know?"],"내 하루는 매일매일 크리스마스":["It's always Christmas"],"넌 알고 있니 (Inst.)":["Do you know? (Instrumental)"],"내 하루는 매일매일 크리스마스 (Inst.)":["It's always Christmas (Instrumental)"]},
  "박초롱":{"모르시나요":["Fallin'"],"모르시나요 (Inst.)":["Fallin' (Inst.)"]},
  "박형식":{"끝이 아니었으면":["If This Isn’t the End"],"내게 기대":["Lean On Me"],"내게 기대 (Inst.)":["Lean On Me (Instrumental)"],"몽우리":["Bud"],"몽우리 (Inst.)":["Bud (Inst.)"],"두개의 빛":["Two Lights: Relumino (Original Motion Picture Soundtrack) - Two Lights"],"그 사람이 너라서":["Because of You"],"그 사람이 너라서 (Inst.)":["Because of You (Instrumental)"],"여기 있을게":["I′ll Be Here"],"여기 있을게 (Inst.)":["I′ll Be Here (Instrumental)"]},
  "방민아":{"나도 여자예요":["I Am a Woman Too"],"한 번만 들어줘":["Once again"],"한 번만 들어줘 (Inst.)":["Once again (Instrumental)"],"알게 모르게":["Butterfly"],"한 사람":["Only one"],"한 사람 (Inst.)":["Only one (Instrumental)"]},
  "방용국":{"쉿":["Shut Up"],"히키코모리":["HIKIKOMORI"]},
  "방탄소년단":{"불타오르네 (FIRE) - Live":["Burning Up (FIRE) - Live"],"쩔어 - Live":["Dope - Live"],"피 땀 눈물 - Live":["Blood Sweat & Tears - Live"],"작은 것들을 위한 시 (Boy With Luv) (Feat. Halsey) - Live":["Boy With Luv (Feat. Halsey) - Live"],"잠시 - Live":["Telepathy - Live"],"뱁새 - Live":["Silver Spoon - Live"],"병 - Live":["Dis-ease - Live"],"봄날 - Live":["Spring Day - Live"],"내 방을 여행하는 법":["Fly To My Room"],"잠시":["Telepathy"],"병":["Dis-Ease"],"작은 것들을 위한 시 (Boy With Luv) (Feat. Halsey)":["Boy With Luv (feat. Halsey)"],"소우주 (Mikrokosmos)":["Mikrokosmos"],"보조개":["Dimple"],"전하지 못한 진심 (Feat. Steve Aoki)":["The Truth Untold (feat. Steve Aoki)"],"낙원":["Paradise"],"피 땀 눈물":["Blood Sweat & Tears"],"21세기 소녀":["21st Century Girl"],"둘! 셋! (그래도 좋은 날이 더 많기를)":["2! 3!"],"봄날":["Spring Day"],"피 땀 눈물 (Blood Sweat & Tears)":["Blood Sweat & Tears"],"Intro : 화양연화":["Intro: The Most Beautiful Moment in Life"],"잡아줘 (Hold Me Tight)":["Hold Me Tight"],"쩔어":["Dope"],"흥탄소년단":["Boyz with Fun"],"이사":["Moving On"],"호르몬 전쟁":["War of Hormone"],"힙합성애자":["Hip Hop Phile"],"Interlude : 뭐해":["Interlude: What Are You Doing Now"],"핸드폰 좀 꺼줄래":["Could You Turn off Your Cell Phone"],"이불킥":["Embarrassed"],"여기 봐":["Look Here"],"2학년":["2nd Grade"],"Outro : 그게 말이 돼?":["Outro: Do You Think It Makes Sense?"],"좋아요 (Slow Jam Remix)":["Like (Slow Jam Remix)"],"상남자 (Boy In Luv)":["Boy in Luv"],"어디에서 왔는지":["Where You From"],"하루만":["Just One Day"],"등골브레이커":["Spine Breaker"],"진격의 방탄":["Attack on Bangtan"],"팔도강산":["Paldogangsan"],"좋아요":["Like"]},
  "배너":{"솔직히 (TBH)":["TBH"],"폼 (FORM) (2023 Ver.)":["(FORM) [2023 Version]"],"안녕 (Goodbye & Hello)":["Goodbye & Hello"],"미쳐버려":["Crazy Love"],"우는 남자 (Crying)":["Crying"]},
  "배드빌런":{"숨(ZOOM)":["ZOOM"],"야호 (BADTITUDE)":["YAH HO (BADTITUDE)"]},
  "백예빈":{"비행구름":["Contrail"],"비행구름 (Inst.)":["Contrail (Instrumental)"]},
  "백현":{"놀이공원 (Amusement Park)":["Amusement Park"],"나의 시간은":["Every Second"],"나의 시간은 (Inst.)":["Every Second (Instrumental)"],"공중정원 (Garden In The Air)":["Garden In The Air"],"공중정원 (Garden In The Air) (Inst.)":["Garden In The Air (Instrumental)"],"바래다줄게 (Take You Home)":["Take You Home"],"바래다줄게 (Take You Home) (Inst.)":["Take You Home (Instrumental)"]},
  "백호":{"엘리베이터":["Elevator"],"변했다고 느끼는 내가 변한 건지 (Feat. Sik-K)":["Wanna go back (feat. Sik-K)"],"물어!":["Bite!"],"물어! (Inst.)":["Bite! (Instrumental)"],"태양이 지면 널 만나러 갈게":["Meet Me When The Sun Goes Down (From \"Midnight Sun\" Original Musical Soundtrack, Pt. 3)"]},
  "뱀뱀":{"춤 (Let's Dance)":["Let's Dance"]},
  "베리베리":{"눈 마주쳤지 (DYG Unit)":["Eye Contact (DYG Unit)"],"솜사탕 (Blame us)":["Blame us"],"소중력":["So What"]},
  "베이비돈크라이":{"지금을 놓치면 분명 너 후회할 거야":["Bet You’ll Regret It"]},
  "베이비몬스터":{"춤 (CHOOM)":["CHOOM"]},
  "베이비복스":{"나 어떡해 (2025. UK Garage Mix)":["What should I do (2025. UK Garage Mix)"],"마지막 바램 (2025 Baby v.o.x’s version)":["Last wish (2025 Baby v.o.x’s version)"],"야야야":["YaYaYa"],"인형":["Doll"],"바램":["Desire"],"우연":["Coincidence"],"비밀":["秘密"]},
  "보아":{"정말, 없니? (Emptiness)":["Emptiness"],"홧김에 (Irreversible)":["Irreversible"],"너와 나 (U&I)":["U&I"],"습관 (I want you back)":["I want you back"],"내가 돌아 (NEGA DOLA)":["NEGA DOLA"],"내가 돌아 (NEGA DOLA) (Inst.)":["NEGA DOLA (Instrumental)"],"봄비 (Spring Rain)":["Spring Rain"],"봄비 (Spring Rain) (Inst.)":["Spring Rain (Instrumental)"],"천국과 지옥 사이 (Between Heaven And Hell)":["Between Heaven and Hell (From \"Shark\")"],"네모난 바퀴 (Hope)":["Hope"],"옆 사람 (Stand By)":["Stand By"],"한별 (Implode)":["Implode"],"하루하루 (Ordinary Day)":["Ordinary Day"],"로망스 (Romance)":["Romance"],"슬픔은 넘쳐도 (People Say...)":["People Say..."],"슬픔은 넘쳐도 (Inst.)":["People Say... (Instrumental)"],"오늘 그댈 본다면 (If You Were Here) (CF - 서울우유 '서울이 좋다' 보아편)":["If You Were Here"],"공중정원 (Garden In The Air)":["Garden In the Air"],"숨... (Breathe Again)":["Breathe Again"],"완전한 날개":["One Wings-Embracing Each Other"],"두근두근 (Pit-A-Pat)":["Pit-a-Pat"],"그럴 수 있겠지...!?":["Maybe..maybe not!?"],"인사 (Good-Bye)":["Good-Bye"],"바보같죠 (Stay In Love)":["Stay In Love"],"세상의 어디에서도 (One Way)":["One Way"],"이별풍경 (Always)":["Always"],"아틀란티스 소녀 (Atlantis Princess)":["Atlantis Princess"],"나무 (Tree)":["Tree"],"천사의 숨결 (Beat Of Angel)":["Beat of Angel"],"선물 (Gift)":["Gift"],"이런 내게 (Where Are You)":["Where Are You"],"단념 (Make A Move)":["Make a Move"],"사랑해요 (So Much In Love)":["So Much In Love"],"남겨진 슬픔 (Endless Sorrow)":["Endless Sorrow"],"기적 (Destiny)":["Destiny"],"늘..(Waiting..)":["Waiting.."],"난 (Beat It!)":["Beat it!"],"체념 (Heart-Off)":["Heart-Off"],"비밀일기 (I'm Sorry)":["I'm Sorry"],"안돼, 난 안돼 (No Way)":["No Way"],"차마 (Every Breath You Take)":["Every Breath You Take"],"어린 연인 (Young Lovers)":["Young Lovers"],"이별준비 (Letting You Go)":["Letting You Go"],"먼 훗날 우리 (Someday Somewhere)":["Someday Somewhere"]},
  "보이넥스트도어":{"있잖아":["As Time Goes By"],"부모님 관람불가 (Japanese Ver.)":["Dangerous (Japanese Version)"],"장난쳐?":["Is That True?"],"오늘만 I LOVE YOU":["IF I SAY, I LOVE YOU"],"이렇게 좋아해 본 적이 없어요":["Never Loved This Way Before"],"이렇게 좋아해 본 적이 없어요 (Inst.)":["Never Loved This Way Before (Inst.)"],"부모님 관람불가":["Dangerous"],"돌멩이":["Gonna Be A Rock"],"스물":["20"],"돌아버리겠다":["But I Like You"],"뭣 같아":["But Sometimes"]},
  "보이프렌드":{"밤하늘을 수놓던 우리 목소리":["Starlit Voices"],"발자국":["Step"],"우리가 서로 사랑했던 날은 지나도":["Too late"],"밤하늘을 수놓던 우리 목소리 (inst.)":["Starlit Voices (Inst.)"],"친구라도 돼줘 (Just Friends)":["Just Friends"],"잘 지내더라 (You've moved on)":["You've moved on"],"소나기 (One Day)":["One Day"],"완전한 여인 (Wonderful Girl)":["Wonderful Girl"],"쉽게 보지마 (Do)":["Do"],"내 여자 손대지마 (Don't Touch My Girl)":["Don't Touch My Girl"],"점점점 (It's U)":["It's U"],"내 여자 손대지마 (Don't Touch My Girl) (Inst.)":["Don't Touch My Girl (Instrumental)"],"점점점 (It's U) (Inst.)":["It's U (Instrumental)"]},
  "브라운아이드걸스":{"2019년 겨울 첫눈으로 만든 그댈 2020년 눈으로 다시 만들 순 없겠지만":["Snowman"],"결국 흔해 빠진 사랑얘기":["A Common Love Story"],"내가 날 버린 이유":["Abandoned"],"원더우먼":["Wonder Woman"],"애수":["Sorrow"],"미소를 띄우며 나를 보낸 그 모습처럼":["Goodbye With A Smile"],"사랑밖엔 난 몰라":["Love Only"],"사랑은 봄비처럼 이별은 겨울비처럼":["Love Like A Spring Rain, Farewell Like A Winter Rain"],"하늘":["The Sky"],"초대 (Feat. 엄정화)":["Invitation (feat. Uhm Jung Hwa)"],"편지":["The Letter"],"아이스크림의 시간":["Time of Ice Cream"],"웜홀 (Warm Hole)":["Warm Hole"],"신세계":["Brave New World"],"신의 입자":["Higgs"],"주사위 놀이":["Dice Play"],"이별편지":["Breakup Letter"],"이별편지 (Inst.)":["Breakup Letter (Instrumental)"],"세컨드 (Second)":["Second"]},
  "브브걸":{"우리끼리 (You and I)":["You and I"],"물거품 (Love Is Gone)":["Love Is Gone"],"술버릇 (운전만해 그후)":["After We Ride"],"치맛바람 [Acoustic Ver.]":["Chi Mat Ba Ram (Acoustic Version)"],"나 혼자 여름 [Piano Ver.]":["Summer by Myself (Piano Version)"],"나 혼자 여름 (Summer by myself)":["Summer by myself"],"롤린 (Rollin')":["Rollin'"],"하이힐 (Remix)":["High Heels (2017 Remix Version)"]},
  "블락비":{"몇 년 후에":["A Few Years Later"],"빛이 되어줘":["Jackpot"],"언제 어디서 무엇을 어떻게 (With 조현아 Of 어반자카파) (박경 Solo)":["Halo"],"떠나지마요":["Don’t Leave"],"마지막 정류장 (재효 Solo)":["At Last (feat. JAEHYO)"],"일방적이야":["One Way"],"이렇게 (Vocal Unit)":["Like This"],"보기 드문 여자":["Dime Girl"],"이제 날 안아요":["Hold Me Now"],"닐리리맘보":["Nillili Mambo"],"장난없다(NO JOKE)":["No Joke"],"넌 어디에":["Where You At"],"로맨틱하게":["Dreams Come True"],"했어 안했어":["Did It or Not?"],"닐리리맘보 (INST)":["Nillili Mambo (Instrumental)"],"빠빠빠빠":["Bbabbabbabba"],"그대로 멈춰라!":["Don't Move!"],"나만 이런거야?":["Does It Only Happen To Me?"]},
  "블랙핑크":{"마지막처럼":["As If It's Your Last"],"뛰어(JUMP)":["JUMP"],"아니길 (Hope Not)":["Hope Not"],"뚜두뚜두 (DDU-DU DDU-DU) (Remix)":["DDU-DU DDU-DU (Remix)"],"뚜두뚜두 (DDU-DU DDU-DU)":["DDU-DU DDU-DU"],"휘파람 (WHISTLE)":["WHISTLE"],"붐바야 (BOOMBAYAH)":["BOOMBAYAH"]},
  "블랭키":{"별자리 - Fan Song":["Constellation - Fan Song"]},
  "비디씨":{"신기루 (MIRAGE)":["Mirage"],"너와 나의 공간 (LOVE, TRUST & DESTINY)":["Love, Trust & Destiny"],"꽃이 피네 (Fine)":["Fine"],"공기가 달라 (LOVE IN THE AIR)":["Love in the Air"],"별이 될게":["I'll Be a Star"],"기억되고 싶어 (REMEMBER ME)":["Remember Me"],"도돌이표 (DA CAPO)":["Da Capo"],"기억되고 싶어 (REMEMBER ME) (Inst.)":["Remember Me (Instrumental)"],"도돌이표 (DA CAPO) (Inst.)":["Da Capo (Instrumental)"],"쉼표 (Rest)":["Rest"],"쉼표 (Rest) (Inst.)":["Rest (Instrumental)"],"어느 밤 Blue Sky":["Blue Sky"],"가면무도회":["Masquerade"],"어느 밤 Blue Sky (Inst.)":["Blue Sky (Instrumental)"],"가면무도회 (Inst.)":["Masquerade (Instrumental)"]},
  "비범":{"사랑노래 (Feat. 한해)":["Think About' Chu (feat. Hanhae)"]},
  "비비지":{"한 걸음 (Day by day)":["Day by day"],"춤":["Dance"],"거울아":["Mirror"],"늘 지금처럼 (영화 '동감' X VIVIZ (비비지))":["Come on baby tonight (Ditto)"],"늘 지금처럼 (영화 '동감' X VIVIZ (비비지)) (Inst.)":["Come on baby tonight (Ditto) [Instrumental]"]},
  "비에이피":{"주소서":["CONFESSION"],"걸어가":["WALK"],"지금 (종업 Solo)":["NOW (JongUp Solo)"],"뭐라고 할까":["What More Can I Say"],"어디니? 뭐하니?":["Where Are You?"],"오늘은 꼭":["Just For Today"],"어디니? 뭐하니? (Inst.)":["Where Are You? (Instrumental)"],"쉽죠":["Easy"],"빗소리":["Rain Sound"],"하지마 (Stop it)":["Stop It"],"대박사건 (Crash)":["CRASH"],"음성메시지":["Voice Message"],"마음이 시키는 일":["What My Mind Says"],"전부 거짓말":["Lie Lie"],"비밀연애 (Feat. 송지은 Of Secret)":["Secret Love (feat. Song Ji Eun)"]},
  "비원에이포":{"벅차 (산들+공찬)":["Wonderful Tonight"],"음악에 취해 (Cnu Solo)":["Because (Bonus Track)"],"길":["All I Need Is You (Bonus Track)"],"가위바위보":["Rock Paper Scissors"],"이 별 (The star)":["The star"],"거대한 말":["Adore you"],"반하는 날":["A Day of Love"],"너는 내가 필요해":["You need me"],"내게 전화해":["Call me"],"아이처럼":["Like a child"],"크리스마스잖아요":["It's Christmas time"],"10년 후":["After 10 years"],"그대와 함께":["With You"],"그대와 함께 (Inst.)":["With You (Instrumental)"],"별빛의 노래":["Starlight's song"],"이게 무슨 일이야":["What's Happening?"],"몇 번을":["How many times"],"잘자요 굿나잇":["Baby good night"],"너 때문에":["Because of you"],"둘만 있으면 (바로 Solo) (Feat. 민 Of miss A)":["Just the two of us (BARO SOLO) [feat.Min]"],"웃어봐":["Smile"],"짝사랑 (산들 Solo)":["Unrequited love (SANDEUL SOLO)"],"잘자요 굿나잇 (Inst.)":["Baby good night (Instrumental)"],"너 때문에 (Inst.)":["Because Of You (Instrumental)"],"쮸쮸쮸 (Chu Chu Chu)":["Chu Chu Chu"]},
  "비투비":{"너 없인 안 된다":["Only One For Me"],"우리 다시":["We Together"],"우리 다시 (Inst.)":["We Together (Inst.)"],"집으로 가는 길":["Song of Wind"],"울면 안 돼":["Winter Story"],"크리스마스라서":["White Christmas"],"잘 지내겠죠":["Where are you?"],"넌 나의 천사 (Feat. JOO)":["Speed"],"몰라":["Love Song"],"불씨":["Please Stay"],"이보다 더 좋을 수 있을까":["Hi Beautiful"],"미치고 싶어":["Can't breathe"],"여행 (Traveler)":["Traveler"],"피날레 (Show And Prove)":["Finale (Show And Prove)"],"미안해 (Song by 서은광, 이민혁, 이창섭)":["Sorry (Song by SEO EUNKWANG, LEE MINHYUK & LEE CHANGSUB)"],"Brand new days ～どんな未来を～ / Brand new days ~어떤 미래를~":["Brand New Days ～どんな未?を～"],"花 / 꽃":["花"],"未来（あした）/ 미래":["未来(あした)"],"今すぐここでKissを交わそうよ / 지금 여기서 키스하자":["今すぐここでKissを交わそうよ"],"レモネ一ド / 레모네이드":["レモネード"],"クリスマス·イブ - Vocal Line / 크리스마스 이브":["クリスマス・イブ - Vocal Line"],"Christmas Time ～君だけを～ / 크리스마스 타임 ~너만을~":["Christmas Time"],"여행 가고 싶어":["Let's Go"],"淚色の空 / 눈물색의 하늘":["涙色の空"],"また会えるから / 다시 만날거니까":["また会えるから"],"ずっとずっと / 계속계속":["ずっとずっと"],"이리와":["Come with Eerie (Music from Telemonster)"],"夏色 MY GIRL / 여름색 MY GIRL":["My Girl"],"サヨナラを繰り返して / 이별을 되돌아보며":["サヨナラを繰り返して"],"未來(あした) / 미래 asita":["Asita"],"さくらいろ / 벚꽃색 sakurairo":["Sakurairo"],"내가 니 남자였을 때":["Whan I Was Your Man"],"스릴러":["Thriller"],"왜 이래":["Why"],"크리스탈같이":["Like a Crystal"],"별":["Star"],"두 번째 고백":["Second Confession"],"두 번째 고백 (Inst.)":["Second Confession (Instrumental)"],"사랑밖에 난 몰라":["Lover Boy"],"아버지":["Father"]},
  "빅뱅":{"천국":["My Heaven"],"아무렇지 않은 척":["Pretended"],"봄여름가을겨울 (Still Life)":["Still Life"],"꽃 길":["FLOWER ROAD"],"어쩌라고":["What Can I Do"],"하루하루 (Haru Haru)":["Haru Haru"],"이별이야기 (A Good Man)":["A Good Man"],"바보 (Fool)":["Fool"],"마지막 인사 (Last Farewell)":["Last Farewell"],"거짓말 (Lies)":["Lies"],"있어야 할 곳 (Unknown Number)":["Unknown Number"],"다음날 (승리 Solo)":["Next Day"],"흔들어":["Shake It"],"눈물뿐인 바보":["A Fool of Tears"],"웃어본다 (대성 Solo)":["Laugh It Off"],"웃어본다":["Laugh It Off"]},
  "빅스":{"이별공식":["Love Equation"],"평행우주 (PARALLEL)":["PARALLEL"],"걷고있다":["Walking"],"다이너마이트":["Dynamite"],"늪 (Six Feet Under)":["Six Feet Under"],"로맨스는 끝났다":["The Romance Is Over"],"나비 효과":["Butterfly Effect"],"손의 이별":["Badbye"],"다이너마이트 (Inst.)":["Dynamite (Instrumental)"],"차가운 밤에":["In the Cold Night"],"기적 (ETERNITY)":["Eternity"],"기적 (ETERNITY) (Inst.)":["Eternity (Instrumental)"],"나를 돌아봐":["Turn Round and Look At Me"],"나를 돌아봐 (Inst.)":["Turn Round and Look At Me (Instrumental)"],"대답은 너니까":["Only U"],"여자는 왜 (Feat. 옥상달빛)":["Girls, Why? (feat. OKDAL)"],"여자는 왜 (Inst.)":["Girls, Why? (Instrumental)"],"대.다.나.다.너":["G.R.8.U"],"어떡하지":["What to Do"],"어둠 속을 밝혀줘":["Light up the Darkness"],"그만 버티고 (Feat. 민아 Of 걸스데이)":["Stop Resisting (feat. Minah)"],"대.다.나.다.너 (Inst.)":["G.R.8.U (Instrumental)"],"다칠 준비가 돼 있어 (On and On)":["On and On"],"아이돌 하기 싫어":["Don't Want to Be an Idol"],"다칠 준비가 돼 있어 (On and On) (Inst.)":["On and On (Instrumental)"],"아픈데 좋아 (UUUUU)":["UUUUU"]},
  "빅오션":{"빛(Glow)":["Glow"]},
  "빅톤":{"그리운 밤":["Nostalgic Night"],"시간을 달리는 소년":["Time Chaser"],"시간의 문 (Want me)":["Want me"],"걱정이 돼서":["Farewell"],"오월애 (俉月哀)":["Time of Sorrow"],"오월애 (俉月哀) (Inst.)":["Time of Sorrow (Instrumental)"],"나를 기억해":["Remember Me"],"사랑하기 때문에":["Because of You"],"나를 기억해 (Acoustic Ver.)":["Remember Me (Acoustic Version)"],"말도 안돼":["Unbelievable"],"느린 이별":["Slow Goodbye"],"얼타":["Blank"],"이 나쁜..":["So Bad.."],"아무렇지 않은 척":["I'm Fine"],"날 보며 웃어준다":["Your Smile and You"],"#떨려 (VICTON Ver.)":["Begin Again (VICTON Ver.)"]},
  "빌리":{"기억사탕":["remembrance candy"],"1월 0일 (a hope song)":["January 0th (a hope song)"],"1월 0일 (a hope song) (Inst.)":["January 0th (a hope song) [Inst.]"],"저 별":["Star"],"저 별 (Inst.)":["Star (Instrumental)"]},
  "산다라박":{"손톱":["Nail"],"손톱 (Inst.)":["Nail (Instrumental)"],"한걸음":["One step (Original Television Soundtrack), Pt.2 - One step"]},
  "산들":{"뭐라할까":["What to say"],"뭐라할까 (inst.)":["What to say (instrumental)"],"잘됐으면 좋겠다":["Good Luck"],"잘됐으면 좋겠다 (Inst.)":["Good Luck (Instrumental)"],"너 때문이야":["You Made Me Smile"],"너 때문이야 (Inst.)":["You Made Me Smile (Instrumental)"],"너는 계절처럼 멀어져 가네":["You're leaving like the season"],"너는 계절처럼 멀어져 가네 (Inst.)":["You're leaving like the season (Instrumental)"],"내 기억 속에 남아 있는 그대 모습은":["The Image of You (Remains in My Memory)"],"내 기억 속에 남아 있는 그대 모습은 (Inst.)":["The Image of You (Remains in My Memory) [Instrumental]"],"그대 한 사람 (낮에 뜨는 달 X 산들)":["The One and Only You (The Moon During the Day)"],"그대 한 사람 (낮에 뜨는 달 X 산들) (Inst.)":["The One and Only You (The Moon During the Day) [Instrumental]"],"여름날 여름밤":["Summer day summer night"],"편지":["Letter"],"작은 상자":["Smile Box"],"게으른 나":["Lazy Me"],"고마워":["Thank you"],"취기를 빌려 (취향저격 그녀 X 산들)":["Slightly Tipsy (She Is My Type)"],"취기를 빌려 (취향저격 그녀 X 산들) (Inst.)":["Slightly Tipsy (She Is My Type) [Instrumental]"],"너에게 닿기를":["I Wish"],"너에게 닿기를 (Inst.)":["I Wish (Instrumental)"],"내 안에 맴돌아":["Lingering Inside Me"],"내 안에 맴돌아 (inst.)":["Lingering Inside Me (Instrumental)"],"날씨 좋은 날":["One Fine Day"],"이 사랑":["This love"],"사선(斜線)":["Oblique line"],"빗소리":["Raindrop"],"괜찮아요":["I’m Fine"],"말해줘":["Tell Me"],"말해줘 (Inst.)":["Tell Me (Instrumental)"],"한 걸음만 더":["One More Step"],"한 걸음만 더 (Inst.)":["One More Step (Inst.)"],"그렇게 있어 줘":["Stay as you are"],"집":["Home"],"나의 어릴 적 이야기":["My childhood story"],"야! (Feat. 휘인)":["Ya! (feat. Whee In)"],"같이 걷는 길":["The way with you"]},
  "샤넌":{"미워해 널 잘 지내지는 마":["Hatred Farewell"],"미워해 널 잘 지내지는 마 (Inst.)":["Hatred Farewell (Instrumental)"]},
  "샤이니":{"소나기 (Still Raining)":["Still Raining"],"셀 수 없는 (Countless)":["Countless"],"데리러 가 (Good Evening)":["Good Evening"],"독감 (Who Waits For Love)":["Who Waits For Love"],"네가 남겨둔 말 (Our Page)":["Our Page"],"안녕 (You & I)":["You & I"],"이별의 길 (Farewell My Love)":["Farewell My Love"],"너의 노래가 되어 (An Ode To You)":["An Ode To You"],"재연 (An Encore)":["An Encore"],"상사병 (Symptoms)":["Symptoms"],"빗 속 뉴욕 (Queen Of New York)":["Queen of New York"],"1분만 (One Minute Back)":["One Minute Back"],"닫아줘 (Close the Door)":["Close the Door"],"초록비 (Green Rain)":["Green Rain (From \"The Queen's Classroom\")"],"초록비 (Green Rain) (Inst.)":["Green Rain (From \"The Queen's Classroom\") [Instrumental]"],"오르골 (Orgel)":["Orgel"],"떠나지 못해 (Sleepless Night)":["Sleepless Night"],"히치하이킹 (Hitchhiking)":["Hitchhiking"],"방백 (Aside)":["Aside"],"아름다워 (Beautiful)":["Beautiful"],"다이너마이트 (Dynamite)":["Dynamite"],"Sherlock•셜록 (Clue + Note)":["Sherlock (Clue + Note)"],"알람시계 (Alarm Clock)":["Alarm Clock"],"낯선자 (Stranger)":["Stranger (Korean Version)"],"늘 그 자리에 (Honesty)":["Honesty"],"하나 (One)":["One"],"욕(慾) (Obsession)":["Obsession"],"화살 (Quasimodo)":["Quasimodo"],"악 (Shout Out)":["Shout Out"],"사.계.후 (Love Still Goes On)":["Love Still Goes On"],"욕 (慾) (Obsession)":["Obsession"],"내가 사랑했던 이름 (The Name) (온유 Feat. 김연우)":["The Name (feat. Kim Yeon Woo)"],"니가 맘에 들어 (Talk To You)":["Talk to You"],"줄리엣 (Juliette)":["Juliette"],"차라리 때려 (Hit Me)":["Hit Me"],"잠꼬대 (Please, Don't Go)":["Please, Don't Go"],"소년, 소녀를 만나다 (Romeo+Juliette)":["Romeo + Juliette"],"아.미.고 (Amigo)":["Amigo"],"산소같은 너 (Love Like Oxygen)":["Love Like Oxygen"],"사.계.한 (Plugged By DJ Oneshot) (Love Should Go On)":["Love Should Go On (Plugged By DJ Oneshot)"],"누난 너무 예뻐 (Replay)":["Replay"],"너 아니면 안 되는걸 (Romantic)":["Romantic"],"사랑의 길 (Love's Way)":["Love's Way"],"그녀가 헤어졌다 (One For Me)":["One For Me","One for Me"],"화장을 하고 (Graze)":["Graze"],"마지막 선물 (Last Gift) (In My Room - Prelude)":["Last Gift (In My Room - Prelude)","Last Gift (In My Room) [Prelude]"],"내 곁에만 있어 (Best Place)":["Best Place"],"혜야 (Y Si Fuera Ella)":["Y Si Fuera Ella"],"눈을 감아보면 (Four Seasons)":["Four Seasons"],"산소 같은 너 (Love Like Oxygen)":["Love Like Oxygen"],"너 아니면 안되는 걸 (Romantic)":["Romantic"],"사.계.한 (Love Should Go On)":["Love Should Go On"],"누난 너무 예뻐 (Replay Boom Track)":["Replay (Boom Track)"]},
  "샤크라":{"돌아와":["Come Back"],"다":["All"],"미녀사총사":["Charlie's Angels"],"집착":["Obsession"],"가라사대":["Says"],"그대를 사랑합니다":["I Love You"],"몽":["Dream"]},
  "서다현":{"쿵":["KUNG"],"쿵 (Inst.)":["KUNG (Instrumental)"],"첫 눈이 내리는 오늘 밤":["First Night Of Snow"],"첫 눈이 내리는 오늘 밤 (Inst.)":["First Night Of Snow (Inst.)"],"바램":["My Hope"],"바램 (Inst)":["My Hope (Inst)"],"오늘도 너야":["More Than Yesterday"],"오늘도 너야 (Inst)":["More Than Yesterday (Inst.)"]},
  "서령":{"나의 바다, 나의 우주":["MY SEA, MY UNIVERSE"],"나의 바다, 나의 우주 (inst.)":["MY SEA, MY UNIVERSE (Inst.)"]},
  "서인영":{"편해졌니":["Believe Me"],"편해졌니 (Inst.)":["Believe Me (Inst.)"],"눈을 감아요":["Close Your Eyes"],"너에게 안겨":["Embraced by Your Arms"],"높은 하이힐 (Feat. DOK2)":["High Heeled (Feat. DOK2)"],"소리질러":["Scream"],"잘 지내줘":["How are you Please"],"거짓말 (Feat. 칸토 Of 트로이)":["LIE (feat. Kanto)"],"엉망이야":["You′re a Mess"],"영화찍지마":["Don’t Take a Movie"],"생각나 (Feat. Zion T)":["Thinking of You (feat. Zion.T)"],"생각나 (Inst.)":["Thinking of You (inst.)"],"나를 사랑해줘 (Feat. 개코 Of 다이나믹 듀오)":["Love Me (feat. Gaeko)"],"헤어지자":["Let's Break Up"],"편지":["Letter"],"헤어지자 (Inst.)":["Let's Break Up (Inst.)"],"신데렐라":["Cinderella"],"신데렐라 (Hip Hop Ver.)":["Cinderella (Hip Hop Version)"],"신데렐라 (Inst.)":["Cinderella (Instrumental)"]},
  "선미":{"보름달":["Full Moon"],"가시나":["Gashina"],"주인공":["Heroine"],"뚜뚜":["DDU DDU"],"미니스커트":["Mini skirt"],"새벽산책":["Walking at 2am"],"긴긴밤":["A long long night"],"덕질 (Call my name)":["Call my name"],"열이올라요 (Heart Burn)":["Heart Burn"],"풋사랑 (Childhood)":["Childhood"],"6분의1":["1/6"],"꼬리 (TAIL)":["TAIL"],"꽃같네 (What The Flower)":["What The Flower"],"가라고 (Gotta Go)":["Gotta Go"],"가라고 (Gotta Go) (Inst.)":["Gotta Go (Instrumental)"],"24시간이 모자라":["24 Hours"]},
  "선예":{"울지 않을게":["Won’t Cry"],"울지 않을게 (Inst.)":["Won’t Cry (Instrumental)"],"열애중":["Love, ing"],"열애중 (Inst.)":["Love, ing (Instrumental)"],"사랑소리":["Love Sound"],"사랑소리 (MR)":["Love Sound (Instrumental)"]},
  "설리":{"고블린 (Goblin)":["Goblin"],"온더문 (On The Moon)":["On The Moon"],"도로시 (Dorothy)":["Dorothy"]},
  "설아":{"우리의 밤은 밝고 아름답다":["Shining and Beautiful"],"밤의 Gypsy":["Gypsy of Night"],"밤의 Samba":["Samba of Night"],"우리의 밤은 밝고 아름답다(inst.)":["Shining and Beautiful(Instrumental)"],"곁 (웹툰 ′막내황녀님′ X 설아 (우주소녀))":["By My Side (Webtoon 'The Beloved Little Princess' Original Soundtrack)"],"곰인형":["Teddy Bear"],"곰인형 (Inst.)":["Teddy Bear (Inst.)"],"연인":["Lover"],"연인 (Inst.)":["Lover (Instrumental)"]},
  "성민":{"갓생":["Godsaeng"],"별빛 아래":["Dancing under the Stars"],"갓생(MR)":["Godsaeng (MR)"],"별빛 아래(MR)":["Dancing under the Stars (MR)"],"요.요.요. (YO.YO.YO.)":["YO.YO.YO."],"화양연화":["Brilliant Days"],"요.요.요. (YO.YO.YO.) (Inst.)":["YO.YO.YO. (Instrumental)"],"화양연화 (Inst.)":["Brilliant Days (Instrumental)"],"사랑이 따끔 (Lovesick)":["Lovesick"],"애리 (Eri)":["Eri"],"설렘꽃 (Blooming)":["Blooming"],"오르골 (Orgel)":["Orgel"],"꽃말 (Stay)":["Stay"],"스르르 (Zzz...)":["Zzz…"],"쉼표 (Rest)":["Rest"],"낮 꿈 (Day Dream)":["Day Dream"],"낮 꿈 (Day Dream) (Inst.)":["Day Dream (Instrumental)"]},
  "세리":{"너를 보면":["Seeing You"],"너를 보면 (Inst.)":["Seeing You (Instrumental)"],"니가 부를 때 (feat. 민선)":["When you call me (feat. Minsun)"],"니가 부를 때 (inst.)":["When you call me (Instrumental)"],"다가와":["Come Closer"],"다가와 (Inst.)":["Come Closer (Instrumental)"]},
  "세븐":{"잘자 (GOOD NIGHT) (Feat. REDDY)":["Good Night (feat. Reddy)"],"괜찮아 (I'M GOOD)":["I'm Good"],"괜찮은건지":["Insensitivity"],"괜찮은건지 (Inst.)":["Insensitivity (Instrumental)"],"내가 노래를 못해도":["When I Can't Sing"],"그런 사람":["That Guy"],"이해해":["Understand"],"라 라 라":["La La La"],"잘할게":["Be Good to You"],"닮은 사랑":["Similar Love"],"허락해줘 (Feat. 태양)":["Please Say Yes (feat. TAEYANG)"],"독백":["Monologue"],"열정":["Passion"],"욕심":["Desire"],"두 걸음":["Two Steps"],"문신":["Tattoo"],"알아":["I Know"],"오기":["Pride"],"듣고 싶지 않은 말":["Words I Don't Want to Hear"],"와줘..":["Come Back to Me"],"한번 단 한번":["One More Time"],"아쉬운 이별 (Feat. 휘성)":["Unwanted Parting (feat. Wheesung)"],"우연히 널 봐도":["Should I Ever See You"],"꽃을 들고서":["With These Flowers"],"더 멀리 떠나요":["Please Go Far Away"],"너이길 바래":["I Hope It's You"]},
  "세븐어스":{"긴꿈":["An enduring dream"],"사랑해도 될까요":["Can I Love You"],"사랑해도 될까요 (inst.)":["Can I Love You - inst."],"바람(wish)":["wish"],"차갑고,반짝이는":["COLD AND SHINY"],"위성":["SATELLITE"]},
  "세븐틴":{"붐붐 (Boomboom)":["Boom Boom"],"청바지":["CBZ (Prime Time)"],"박수":["Clap"],"파이팅 해야지":["Fighting","Fighting (BSS)"],"예쁘다":["Pretty U"],"손오공":["Super"],"고맙다":["Thanks"],"사탕":["Candy"],"아낀다":["Adore U"],"만세":["Mansae"],"독 : Fear":["Fear"],"경음악의 신":["God of Light Music"],"음악의 신 (뽕짝 Remix)":["God of Music (Trot Remix)"],"경음악의 신 (Inst.)":["God of Light Music (Inst.)"],"음악의 신 (God of Music)":["God of Music"],"하품 (Yawn)":["Yawn"],"음악의 신 (Inst.)":["God of Music (Inst.)"],"먼지":["Dust"],"돌고 돌아":["Circles"],"노래해":["'bout you"],"매일 그대라서 행복하다":["Imperfect love"],"그리워하는 것까지":["I can't run away"],"여전히 아름다운지":["Is It Still Beautiful"],"여전히 아름다운지 (Inst.)":["Is It Still Beautiful (Instrumental)"],"같은 꿈, 같은 맘, 같은 밤":["Same Dream, Same Mind, Same Night"],"좋겠다":["I Wish"],"어른 아이":["Kidult"],"같이 가요":["Together"],"거짓말을 해":["Lie Again"],"포옹":["Hug"],"칠리":["Chilli"],"숨이 차":["Getting Closer"],"어쩌나 (Oh My!)":["Oh My!"],"나에게로 와":["Come To Me"],"우리의 새벽은 낮보다 뜨겁다":["Our Dawn Is Hotter Than Day"],"모자를 눌러 쓰고":["Without You"],"날 쏘고 가라":["Bring It"],"13월의 춤":["Lilili Yabbay"],"바람개비":["Pinwheel"],"캠프파이어":["Campfire"],"몰래 듣지 마요":["Don't Listen In Secret"],"엄지척":["Chuck"],"이놈의 인기":["Still Lonely"],"유행가":["Hit Song"],"떠내려가":["Drift Away"],"아낀다 (Vocal Team Ver.)":["Adore U (Vocal Team Ver.)"],"만.세 (Hiphop Team Ver.)":["Monday To Saturday (Hiphop Team Ver.)"],"사랑쪽지 (Love Letter)":["Love Letter"],"표정관리":["Fronting"],"어른이 되면":["When I Grow Up"]},
  "세이마이네임":{"너의향기":["YOUR SCENT"],"너의향기 (Inst.)":["YOUR SCENT - Instrumental"],"문을 나선 순간 (Vocal. 소하)":["Out the door (Vocal. SOHA)"],"문을 나선 순간 (Vocal. 소하) (Inst.)":["Out the door (Vocal. SOHA) (Inst.)"],"처음 만난 그날처럼(He told me)":["He told me"],"난 오늘 밤하늘에서 가장 빛나는 별이 된다":["Be a Star"]},
  "소나무":{"금요일밤":["Friday Night"],"자꾸자꾸":["Again and Again"]},
  "소녀시대":{"오랜 소원 (It's You)":["It's You"],"그 여름 (0805)":["Sailing (0805)"],"그 여름 (0805) (Inst.)":["Sailing (0805) [Instrumental]"],"어떤 오후 (One Afternoon)":["One Afternoon"],"유로파 (Europa)":["Europa"],"백허그 (Back Hug)":["Back Hug"],"말해봐 (Talk Talk)":["Talk Talk"],"유리아이 (Lost In Love)":["Lost In Love"],"낭만길 (Romantic St.)":["Romantic St."],"텔레파시 (Telepathy)":["Telepathy"],"봄날 (How Great Is Your Love)":["How Great Is Your Love"],"제자리걸음 (Sunflower)":["Sunflower"],"비타민 (Vitamin)":["Vitamin"],"훗 (Hoot)":["Hoot"],"내 잘못이죠 (Mistake)":["Mistake"],"단짝 (My Best Friend)":["My Best Friend"],"첫눈에... (Snowy Wish)":["Snowy Wish"],"해치 (Full Ver.)":["Haechi (Full Version)"],"해치 (Opening Ver.)":["Haechi (Opening Version)"],"해치 (Ending Ver.)":["Haechi (Ending Version)"],"별별별 (☆★☆) (Acoustic R&B Ver.)":["Star Star Star ☆★☆ (Acoustic R&B Version)"],"뻔&Fun (Sweet Talking Baby)":["Sweet Talking Baby"],"영원히 너와 꿈꾸고 싶다 (Forever)":["Forever"],"웃자 (Be Happy)":["Be Happy"],"화성인 바이러스 (Boys & Girls) (Feat. Key Of SHINee)":["Boys & Girls (feat. Key)"],"카라멜 커피 (Talk To Me)":["Talk to Me"],"별별별 (☆★☆)":["Star Star Star ☆★☆"],"무조건 해피엔딩 (Stick Wit U)":["Stick Wit' U"],"소원을 말해봐 (Genie)":["Genie"],"힘 내! (Way To Go)":["Way to Go"],"힘들어하는 연인들을 위해 (Let's Talk About Love)":["Let's Talk About Love"],"소녀시대 (Girls' Generation)":["Girls' Generation"],"그대를 부르면 (Tears)":["Tears"],"다시 만난 세계 (Into The New World)":["Into the New World"],"다시 만난 세계 (Into The New World) (Inst.)":["Into the New World (Instrumental)"]},
  "소디엑":{"밤하늘":["MIDNIGHT SKY"],"첫 눈 (FIRST SNOW)":["FIRST SNOW"]},
  "소연":{"내 이름 맑음":["My Name Is Malguem (The Seasons: Cantabile of Park Bo Gum)"],"아무너케 (I'm OK)":["A-MOONO-KE (I’m OK)"],"아무너케 (I'm OK) (Inst.)":["A-MOONO-KE (I’m OK) [Instrumental]"],"아따 맛있다 (Shake Shack Korea)":["Ah-dda, It's delicious (Shake Shack Korea)"],"난리나":["NANRINA (From \"You Hee yul's Sketchbook With you : 81th Voice 'Sketchbook X SOYEON ((G)I-DLE)', Vol. 124\")"],"아이들 쏭 (Idle song)":["Idle Song"],"인터뷰 (Interview)":["Interview"],"인터뷰 (Interview) (Inst.)":["Interview (Instrumental)"],"다 그대로더라":["They Are All the Same"],"다 그대로더라 (Inst.)":["They Are All the Same (Instrumental)"],"너뿐이야":["Only You"],"너뿐이야 (Inst.)":["Only You (Instrumental)"],"잘 지내고 있니":["Goodbye"],"잘 지내고 있니 (Inst.)":["Goodbye (Instrumental)"],"당신 생각":["Think of You"],"당신 생각 (Inst.)":["Think of You (Instrumental)"]},
  "소영":{"숨":["Breath"],"숨 (Inst.)":["Breath (Instrumental)"]},
  "소유":{"까만밤":["All Night"],"어깨":["Lean On Me"],"썸":["Some"],"오늘밤":["Tonight"],"오늘밤 (Inst.)":["Tonight (Instrumental)"],"사랑을 말해요":["Love used to be"],"사랑을 말해요 (Inst.)":["Love used to be (Instrumental)"],"열애중":["Love, ing"],"열애중 (Inst.)":["Love, ing (Instrumental)"],"흠뻑":["Soaked"],"시간을 돌려서":["Take me back in time"],"시간을 돌려서 (Inst.)":["Take me back in time (Instrumental)"],"우리는 매일 이별을 향해 걸어가지":["Farewell Everyday"],"돌스 (Dolls)":["Dolls"],"돌스 (Dolls) (Inst)":["Dolls (Instrumental)"],"이별언어":["GOOD BYE"],"이별언어 (Inst.)":["GOOD BYE (Instrumental)"],"마음 (Feat. 적재)":["Heart (feat. JUKJAE)"],"썸 2 (Feat. 정용화)":["Some 2 (feat. Jung Yong Hwa)"],"알았다면":["If I Had Known"],"나무 (Feat. DAVII)":["Tree (feat. DAVII)"],"웃어주지 말아요":["Don't Smile At Me"],"웃어주지 말아요 (Inst.)":["Don't Smile At Me (Instrumental)"],"잘자요 내사랑":["Good Night MY LOVE"],"하나면 돼요":["The Only One"],"하나면 돼요 (Inst.)":["The Only One (Instrumental)"],"이젠 안녕":["Goodbye"],"이젠 안녕 (Inst.)":["Goodbye (Instrumental)"],"괜찮나요":["Good To Be With You"],"괜찮나요 (inst.)":["Good To Be With You (Instrumental)"],"무덤덤 (PROD. 아르마딜로)":["Decrescendo"],"너와 함께 (PROD. 다비 (DAVII))":["When I'm with you"],"멀어진다 (PROD. 소유, 유진경)":["Shadows"],"잔다툼 (PROD. 윤현상)":["Little Moments"],"기우는 밤 (Feat. 긱스) (PROD. 프라이머리)":["The Night (feat. Geeks)"],"너에게 배웠어 (PROD. 윤종신)":["Grown-Up"],"좋은 사람 (PROD. 구름)":["Still the One"],"온기가 필요해 (PROD. 권순관 of 노리플라이)":["We Need Warmth"],"일곱살 (PROD. 문문)":["7"],"뻔한 이별 (PROD. 13)":["I Still"],"제주도의 푸른 밤":["The Blue Night of Jeju Island"],"내게 말해줘":["Tell Me"],"내게 말해줘 (Inst.)":["Tell Me (Instrumental)"],"한번만":["Once More"],"한번만 (Inst.)":["Once More (Instrumental)"]},
  "소정":{"니가 다 망친거야":["You Ruined Me"],"니가 다 망친거야 (Inst.)":["You Ruined Me (Instrumental)"],"그냥 사랑이 식었다고 말하지 그랬어":["Alone"],"그냥 사랑이 식었다고 말하지 그랬어 (Inst.)":["Alone (Instrumental)"],"차라리 잘 됐어":["Our Story"],"술은 별로 안 마셨는데":["Barely had a drink"],"술은 별로 안 마셨는데 (Inst.)":["Barely had a drink (Instrumental)"],"멀리":["Far Away"],"멀리 (Inst.)":["Far Away (Instrumental)"],"이기는 연애":["The one who wins"],"이기는 연애 (Inst.)":["The one who wins (Instrumental)"],"오랜만이야 안녕":["Hello"],"오랜만이야 안녕 (Inst.)":["Hello (Instrumental)"],"보고싶은 그대가":["Missing You"],"보고싶은 그대가 (Inst.)":["Missing You (Instrumental)"],"같은 베개…":["Same Pillow…"],"같은 베개… (Acoustic Ver.)":["Same Pillow… (Acoustic Ver.)"],"같은 베개… (Inst.)":["Same Pillow… (Instrumental)"],"내가 제일 사랑했던 노래":["The song I loved"],"내가 제일 사랑했던 노래 (Inst.)":["The song I loved (Instrumental)"],"#구름스타그램":["Love In The Cloud"],"거짓말이라 말해":["Love Me Again"],"거짓말이라 말해 (Inst.)":["Love Me Again (Instrumental)"],"너와 나는 이제 남이니까":["Nothing Between Us"],"너와 나는 이제 남이니까 (Inst.)":["Nothing Between Us (Instrumental)"],"단 하루만":["Just For One Day"],"단 하루만 (Inst.)":["Just For One Day (Instrumental)"],"함께 했는데 이별은 나 혼자인 거야":["If You Were Still Here"],"함께 했는데 이별은 나 혼자인 거야 (inst.)":["If You Were Still Here (Instrumental)"],"우린 왜 이별 하는 걸까? (Better than Me)":["Better than Me"]},
  "소희":{"그럴리가 없는데":["That Can't Happen"],"그럴리가 없는데 (Inst.)":["That Can't Happen (Instrumental)"]},
  "손동운":{"겨울향기":["Scent of yours"],"겨울향기 (inst.)":["Scent of yours (Instrumental)"],"우리 날씨 맑음 (Today's Weather)":["Today′s Weather"],"장마 (Rainy Season)":["Rainy Season"],"편지 (Letter)":["Letter"],"부디":["Please (from \"You Hee yul's Sketchbook With you : 90th Voice 'Sketchbook X SON DONGWOON)', Vol.138\""],"편해지자":["In the Silience"],"서툰 어른 (Thirty)":["Thirty"],"암전":["A Dark Change"],"점":["There′s No Eternity"],"오늘도":["Still, Today"],"점 (Inst.)":["There′s No Eternity (Instrumental)"]},
  "손동표":{"파도 (2024)":["Wave (2024)"],"파도 (2024) (Inst.)":["Wave (2024) [Instrumental]"],"지들맘대로":["Zdeulmamdaero"],"지들맘대로 (Inst.)":["Zdeulmamdaero (Instrumental)"]},
  "솔라":{"텅 (Empty)":["Empty"],"꿀 (HONEY)":["HONEY"],"찹찹 (chap chap)":["chap chap"],"징글징글 (zinggle zinggle)":["zinggle zinggle"],"뱉어 (Spit it out)":["Spit It Out"],"뱉어 (Spit it out) (Inst.)":["Spit It Out (Instrumental)"],"그리움만 쌓이네":["Only Longing Grows (From \"Solar Sensitivity, Pt. 2\")"]},
  "솔지":{"한도 초과":["HANDOCHOGWA"],"하나뿐인 당신":["You are my one and only"],"넌 나 어떠니":["What About Me"],"한도 초과 (MR)":["HANDOCHOGWA (MR)"],"하나뿐인 당신 (MR)":["You are my one and only (MR)"],"넌 나 어떠니 (MR)":["What About Me (MR)"],"다시 사랑하면 안되니":["Can't I Love You Again?"],"다시 사랑하면 안되니 (Inst.)":["Can't I Love You Again? (Instrumental)"],"한없이 아름다운 너를 만나":["I meet you who are infinitely beautiful"],"한없이 아름다운 너를 만나 (Inst.)":["I meet you who are infinitely beautiful (Instrumental)"],"입버릇":["If you're gonna hurt me like this"],"입버릇 (Inst)":["If you're gonna hurt me like this (Instrumental)"],"라페스타 (La Festa)":["La Festa"],"라페스타 (La Festa) (Inst.)":["La Festa (Instrumental)"],"한남동 밤길":["Night Road in Hannam-dong"],"서쪽 하늘":["Western Sky"],"서쪽 하늘 (Inst.)":["Western Sky (Instrumental)"],"반지하나":["One ring"],"반지하나 (inst.)":["One ring (instrumental)"],"그 아픔까지 사랑한거야":["Geu a Pheum Ka Ji Sa Rang Han Geo Ya"],"안녕 내가 싫어도":["So far away"],"안녕 내가 싫어도 (Inst.)":["So far away (Inst.)"],"우리가 우리였었던 날들":["The days we were us"],"우리가 우리였었던 날들 (Inst.)":["The days we were us (Instrumental)"],"사랑이라고 믿었다":["I believed it was love"],"사랑이라고 믿었다 (Inst.)":["I believed it was love (Instrumental)"],"거기서 거기":["It's all the same"],"거기서 거기 (Inst.)":["It's all the same (Instrumental)"],"사랑스런 너의 곁에":["By Your Side"],"사랑스런 너의 곁에 (Inst.)":["By Your Side (Inst.)"],"계절의 끝에서":["Fade away"],"이렇게 헤어지고 있어":["Breaking up"],"계절의 끝에서 (Inst.)":["Fade away (Instrumental)"],"이렇게 헤어지고 있어 (Inst.)":["Breaking up (Instrumental)"],"감정 낭비":["Waste of emotions"],"감정 낭비 (inst.)":["Waste of emotions (Instrumental)"],"이런 위로":["This Comfort"],"이런 위로 (Inst.)":["This Comfort (Instrumental)"],"천천히 와줄래":["Play Life Music, Pt. 3: I'm Here with You"],"기억해줘요 이런 내 마음을 (바니와 오빠들 X 솔지)":["Remember My Love (From “Bunny and Guys”)"],"기억해줘요 이런 내 마음을 (바니와 오빠들 X 솔지) (Inst.)":["Remember My Love (From “Bunny and Guys”) [Instrumental]"],"네가 남긴 흔적":["The Trace You Left"],"네가 남긴 흔적 (Inst.)":["The Trace You Left (Instrumental)"],"한사람":["One Person"],"한사람 (Inst.)":["One Person (Instrumental)"],"오늘따라 비가 와서 그런가 봐":["Rains Again"],"오늘따라 비가 와서 그런가 봐(Inst.)":["Rains Again (Instrumental)"],"이 거리를 걸어서":["Walking on This Street"],"이 거리를 걸어서 (Inst.)":["Walking on This Street (Instrumental)"],"쓰라린 상처도 아픈지 모르고":["Even Not Knowing If It Hurts"],"쓰라린 상처도 아픈지 모르고 (Inst.)":["Even Not Knowing If It Hurts (Instrumental)"],"처음 그 느낌처럼":["As the First Feeling"],"종로에서 (Feat. PK헤만)":["At Jongno (feat. PK Heman)"],"내게 남은 사랑을 드릴께요":["I'll Give You My Love"],"조금만 사랑했다면":["If I have Loved Little More"],"처음 그 느낌처럼 (Remix)":["As the First Feeling (Remix)"],"종로에서 (Inst.)":["At Jongno (Instrumental)"],"종로에서 (Chinese Ver.)":["At Jongno (Chinese Version)"],"사랑했던 날":["The Day I Loved You","The day I loved you"],"사랑했던 날 (String Ver.)":["The Day I Loved You (String Version)"],"미워서 (Feat.수호)":["out of hatred (feat. Suho)"],"미소":["Smile"],"말아요":["Don't"]},
  "송민호":{"아낙네":["Fiancé"]},
  "송지은":{"시편 23편 여호와는 나의 목자니":["Psalms 23"],"시편 23편 여호와는 나의 목자니 (Inst.)":["Psalms 23 (Inst.)"],"고백":["Confession"],"고백 (Inst.)":["Confession (Instrumental)"],"신기루":["Mirage"],"신기루(inst.)":["Mirage (Instrumental)"],"우리 둘 사이로":["Between Us"],"우리 둘 사이로 (Inst.)":["Between Us (Instrumental)"],"보고 싶은 사람":["Person Who I Miss"],"보고 싶은 사람 (Inst.)":["Person Who I Miss (Instrumental)"],"희망고문":["False Hope"],"미친거니 (Feat. 방용국)":["Crazy (feat. BANG YONGGUK)"],"미친거니 (Inst.)":["Crazy (Instrumental)"],"어젠 (Duet. 환희)":["Yesterday (with Hwanhee)"],"어젠 (Solo)":["Yesterday (Solo Version)"],"어젠 (MR)":["Yesterday (Instrumental)"]},
  "수빈":{"기억속 켜진불":["Rekindling Memories"],"기억속 켜진불 (Inst.)":["Rekindling Memories (Instrumental)"]},
  "수영":{"나의 별에게":["To My Star"],"나의 별에게 (Inst.)":["To My Star (Instrumental)"],"겨울숨 (Original Ver.)":["Winter Breath"],"겨울숨 (Acoustic Ver.)":["Winter Breath (Acoustic Version)"]},
  "수지":{"하루":["A Day"],"하루 (Inst.)":["A Day (Instrumental)"],"전속력으로":["R.U.N"],"안하기가 쉽지 않아요":["Inevitable"],"안하기가 쉽지 않아요 (Inst.)":["Inevitable (Instrumental)"],"잘자 내 몫까지 (With 이루마)":["Midnight (feat. Yiruma)"],"다른사람을 사랑하고 있어":["I’m in Love with Someone Else"],"나쁜X":["Bxatxh"],"잘자 내 몫까지":["Midnight"],"서툰 마음 (Prod. 정키)":["Confession"],"너는 밤새도록":["Sleeplessness"],"듣고 싶은 말":["I Wanna Say To you"],"듣고 싶은 말 (Inst.)":["I Wanna Say To you (Instrumental)"],"행복한 척":["Pretend"],"다 그런거잖아 (Feat. Reddy)":["Sick and Tired (feat. REDDY)"],"난로 마냥":["Question Mark"],"꽃마리":["Little Wildflower"],"좋을땐":["When We Were"],"좋을땐 (Inst.)":["When We Were (Instrumental)"],"왜 이럴까":["Why am I like this"],"왜 이럴까 (Inst.)":["Why am I like this (Instrumental)"],"그래도 사랑해":["I Still Love You"],"그래도 사랑해 (Inst.)":["I Still Love You (Instrumental)"]},
  "수진":{"헤엄":["Tide"],"개화 (開花)":["Flowering"],"아가씨":["AGASSY"]},
  "수현":{"눈사람":["Snow Man"]},
  "수호":{"잘 지내자, 우리":["Let's Stay Well"],"잘 지내자, 우리 (inst.)":["Let's Stay Well (Inst.)"],"나비가 날아왔어요":["Butterflies in my heart"],"나비가 날아왔어요 (Inst.)":["Butterflies in my heart (Instrumental)"],"남극에서 온 편지 (I'll be here)":["I'll be here"],"첫눈이 오면":["Winter is coming"],"아스라이, 더 가까이":["Love You More Gradually"],"아스라이, 더 가까이 (Inst.)":["Love You More Gradually (Instrumental)"],"모두 다 사랑하리":["Love All - SONGOLMAE REMAKE RE:FLY"]},
  "슈퍼주니어":{"우리의 꽃말 (Stuck With You)":["Stuck With You"],"우리에게 (The Melody)":["The Melody"],"너와 나 (Come a little closer) (Sung by 이특, 신동, 은혁, 동해)":["Come a little closer (Sung by LEETEUK, SHINDONG, EUNHYUK & DONGHAE) [Analog Trip (YouTube Originals Soundtrack)]"],"놈, 놈, 놈 (You Got It)":["You Got It (Sung by LEETEUK, HEECHUL, YESUNG, EUNHYUK & DONGHAE)"],"도로시 (Dorothy)":["Dorothy (Sung by SUPER JUNIOR-K.R.Y.)"],"별이 뜬다 (Stars Appear...)":["Stars Appear..."],"첫눈에 반했습니다 (Love at First Sight)":["Love at First Sight (Sung by SUPER JUNIOR-T)"],"춤을 춘다 (Midnight Blues)":["Midnight Blues"],"중 (...ing)":["...Ing"],"백일몽 (Evanesce)":["Evanesce"],"사랑이 멎지 않게 (Raining Spell for Love)":["Raining Spell for Love"],"환절기 (Mid-season)":["Mid-season"],"너로부터 (From U)":["From 'U","From U"],"하루 (HARU)":["Haru"],"걸리버 (Gulliver)":["Gulliver"],"언젠가는 (Someday)":["Someday"],"달콤씁쓸 (Bittersweet)":["Bittersweet"],"빠삐용 (Butterfly)":["Butterfly"],"머문다 (Daydream)":["Daydream"],"헤어지는 날 (A 'Good'bye)":["A 'Good'bye"],"하루에 (A Day)":["A Day"],"안단테 (Andante)":["Andante"],"오페라 (Opera)":["Opera"],"라라라라 (Be My Girl)":["Be My Girl"],"폭풍 (Storm)":["Storm"],"어느새 우린 (Good Friends)":["Good Friends"],"결투 (Feels Good)":["Feels Good"],"기억을 따라 (Memories)":["Memories"],"해바라기 (Sunflower)":["Sunflower"],"엉뚱한 상상 (White Christmas)":["White Christmas"],"입술을 깨물고":["Bite the Lips"],"입술을 깨물고 (Inst.)":["Bite the Lips (Instrumental)"],"똑똑똑":["Knock Knock Knock"],"너라고 (It's You)":["It's You"],"그녀는 위험해 (She Wants It)":["She Wants It"],"사랑이 죽는 병 (Love Disease)":["Love Disease"],"첫번째 이야기 (Love U More)":["Love U More"],"쏘리 쏘리 (Sorry, Sorry)":["Sorry, Sorry"],"니가 좋은 이유 (Why I Like You)":["Why I Like You"],"마주치지 말자 (Let's Not...)":["Let's Not…"],"앤젤라 (Angela)":["Angela"],"이별… 넌 쉽니 (Heartquake) (Feat. 동방신기)":["Heartquake (feat. U-know from TVXQ! & Micky)"],"죽어있는 것 (Dead At Heart)":["Dead At Heart"],"돈 돈! (Don't Don)":["Don't Don"],"소원이 있나요 (Sapphire Blue)":["Sapphire Blue"],"갈증 (Original Ver.)":["A Man in Love (Original Version)"],"미워 (Hate U, Love U)":["Hate U, Love U"],"사랑이 떠나다 (She's Gone)":["She's Gone"],"마지막 승부 (The Girl Is Mine)":["The Girl Is Mine"],"거울 (Mirror)":["Mirror"],"우리들의 사랑 (Our Love)":["Our Love"],"갈증 (Remix Ver.)":["A Man in Love (Remix Version)"],"아주 먼 옛날 (Song For You) (Bonus Track)":["Song for You (Bonus Track)"],"아주 먼 옛날 (Song For You)":["Song for You (Bonus Track)"]},
  "스테이씨":{"사랑은 원래 이렇게 아픈 건가요":["Like This"],"Over U, 안녕 (Seeun x J)":["Over U, Goodbye (Seeun x J)"],"너란 별을 만나 (Meant To Be)":["Meant To Be"],"색안경 (STEREOTYPE)":["STEREOTYPE"]},
  "스트레이키즈":{"락 (樂)":["Lalalala"],"특":["S-Class"],"소리꾼":["Thunderous"],"11월 11일 (November 11th)":["November 11th"],"유성우 (Raining stars)":["Raining stars"],"행복 뭐 별거 없네요 (The Little Things)":["The Little Things"],"제자리걸음 (Still here)":["Still here"],"급류 (Into The Current)":["Into The Current"],"명 (My Name)":["My Name"],"나지막이 (Live) Limbo (Live)":["Limbo (Live)"],"안아줄게요 (Live) Hug Me (Live)":["Hug Me (Live)"],"별, 빛 (STAY) STAY":["STAY"],"별, 빛 (STAY)":["STAY"],"사각지대":["BLIND SPOT"],"가려줘":["Cover Me"],"위인전":["Hall of Fame"],"죽어보자":["GET LIT"],"충돌":["Collision"],"나지막이 (리노)":["Limbo (Lee Know)"],"식혜":["CHILL"],"나 너 좋아하나봐 (승민, 아이엔)":["Can't Stop (Seungmin, I.N)"],"거미줄":["VENOM"],"땡":["FREEZE"],"피어난다 (방찬, 리노, 승민, 아이엔)":["Waiting For Us (Bang Chan, Lee Know, Seungmin & I.N)"],"불면증":["Insomnia"],"그림자도 빛이 있어야 존재":["Behind the Light"],"편":["My Side"],"극과 극":["N/S"],"잠깐의 고요":["Maze of Memories"],"고장난 나침반":["Broken Compass"],"애":["Mixtape : OH"],"바람 (Levanter)":["Levanter"],"승전가":["Victory Song"],"해장국":["Hero's Soup"],"잘 하고 있어":["Grow Up"]},
  "스피카":{"너 때문에":["Because of You"],"너 때문에 (Inst.)":["Because of You (Instrumental)"],"고스트 (GHOST)":["Ghost"],"고스트 (GHOST) (Inst.)":["GHOST (Instrumental)"],"마녀의 일기":["A Witch’s Diary"],"마녀의 일기 (Inst.)":["A Witch’s Diary (Instrumental)"],"그날 밤":["That Night"],"화 (火)":["Fire"],"러시안룰렛 (Russian Roulette)":["Russian Roulette"],"일기장":["Diary"],"독하게":["Doggedly"],"독하게 (Inst.)":["Doggedly (Inst.)"]},
  "슬기":{"기억속에 너와":["In my memory"],"기억속에 너와 (Inst.)":["In my memory (Instrumental)"]},
  "승관":{"모든 숨쉬는 순간은 기적이 되어":["Somewhere in This Universe"],"모든 숨쉬는 순간은 기적이 되어 (Inst.)":["Somewhere in This Universe (Instrumental)"],"민들레":["Dandelion"],"그대가 오면":["The Moment You Arrive"],"그대가 오면 (Inst.)":["The Moment You Arrive (Instrumental)"],"이유":["The Reason"],"이유 (Inst.)":["The Reason (Inst.)"],"어떤 사랑":["Kind of Love"],"어떤 사랑 (Inst.)":["Kind of Love (Instrumental)"]},
  "승민":{"너여야만 해":["All I Want Is You"],"너여야만 해 (Inst.)":["All I Want Is You (Instrumental)"],"우리 만남은 우연이었을까요":["Destiny"],"우리 만남은 우연이었을까요 (Inst.)":["Destiny (Instrumental)"]},
  "승희":{"봄은 자라고 있네":["Spring Will Come Again"],"봄은 자라고 있네 (Inst.)":["Spring Will Come Again (Instrumental)"],"그날 (The day) (세기말 풋사과 보습학원, 네이버 웹툰)":["The day"],"그날 (The day) (세기말 풋사과 보습학원, 네이버 웹툰) (Inst.)":["The day (Instrumental)"],"편지":["Letter"],"편지 (inst.)":["Letter (Instrumental)"],"언젠가 설명이 필요한 밤 (바니와 오빠들 X 승희 (오마이걸))":["Sleepless Summer Night (Bunny and Guys)"],"언젠가 설명이 필요한 밤 (바니와 오빠들 X 승희 (오마이걸)) (Inst.)":["Sleepless Summer Night (Bunny and Guys) [Instrumental]"]},
  "시그니처":{"풍덩":["Poongdung"],"오로라(AURORA)":["AURORA"],"눈누난나 (Nun Nu Nan Na)":["Nun Nu Nan Na"],"아싸 (ASSA)":["Assa"],"아리송 (ARISONG)":["Arisong"],"달달해 (DALDALHAE)":["Daldalhae"],"힝힝 (HingHing)":["HingHing"],"어젯밤 이야기(Mess With My Mind)":["Mess With My Mind"],"안녕, 인사해(Smooth Sailing)":["Smooth Sailing"]},
  "시연":{"시작":["start over"],"시작 (Inst.)":["start over (Instrumental)"]},
  "시우민":{"나의 유일한 너에게":["To my one and only you"],"나의 유일한 너에게 (inst.)":["To my one and only you (Inst.)"],"이유 (You)":["You"],"이유 (You) (Inst.)":["You (Instrumental)"]},
  "시크릿":{"아이스크림 (ICE CREAM)":["ICE CREAM"],"샤이보이 (Shy Boy) (2026 Ver.)":["Shy Boy (2026 Ver.)"],"별빛달빛 (Starlight Moonlight) (2026 Ver.)":["Starlight Moonlight (2026 Ver.)"],"사랑은 MOVE (Love is MOVE) (2026 Ver.)":["Love is MOVE (2026 Ver.)"],"유후 (Yoo Hoo) (2026 Ver.)":["Yoo Hoo (2026 Ver.)"]},
  "시크릿넘버":{"독사 (DOXA)":["DOXA"],"둠치타 (DOOMCHITA)":["DOOMCHITA"],"사랑인가 봐":["Love, Maybe"],"사랑인가 봐 (Inst.)":["Love, Maybe (Instrumental)"],"불토(Fire Saturday)":["Fire Saturday"]},
  "신비":{"사랑스러워":["Loveable"],"사랑스러워 (Inst.)":["Loveable (Instrumental)"],"꿈인 듯 해":["You Are Like My Dream"],"꿈인 듯 해 (inst.)":["You Are Like My Dream (Instrumental)"]},
  "신예찬":{"여름의 끝":["End of Summer (Original Soundtrack)"]},
  "신혜성":{"손을 잡아줘":["Hold My Hand"],"전부 아름다웠어":["Beautiful"],"아직은 끝나지 않은 이야기":["Unfinished Story"],"여기, 해가 저무는 곳에서 (Outro)":["Here, Where the Sun Goes Down (Outro Version)"],"나의 너에게":["For You"],"그 자리에":["Still There"],"머물러줘":["Please Stay"],"다시는":["Painful Love"],"안부":["Take Care"],"문득":["Suddenly"],"빗소리에":["Sound of Rain"],"로코 드라마":["Roco Drama"],"끝이야":["The End"],"예뻐":["Serenade"],"생각보다 생각나":["Think About You"],"예쁜 아가씨":["Pretty Girl"],"그대라서":["Because of You"],"그대라서 (Inst.)":["Because of You (Instrumental)"],"첫사람":["The First Person"],"첫사람 (Inst.)":["The First Person (Instrumental)"],"사랑...후에":["After Love"],"사랑...후에 (Inst.)":["After Love (Instrumental)"],"인형":["Doll (with Im Chang Jung)"],"인형 (Inst.)":["Doll (Instrumental)"],"겨울":["Winter"],"끝인가봐요":["It Must Be Finished"],"너에게 전하지 못한 말":["Undelievered Massage To You"],"그대라면 좋을텐데":["I Wish You Were"],"12월의 끝":["End of December"],"불면증":["Insomnia"],"한 걸음을 더":["One More Step"],"지난 여름의 기억":["Memories of the Last Summer"],"돌아와줘":["Come Back To Me"],"사랑해":["I Love You"],"내겐 꿈 같은 하루 (Feat. 박지윤)":["A Surreal Day for Me"],"끝인사":["Goodbye"],"다른 사람 사랑하지마":["Don't Love Another Person"],"째각째각":["Tick Tick"],"생각해봐요":["Think About It"],"조금 더 가까이 (Duet. 영준, 브라운아이드소울)":["Come Closer"],"별을 따다":["Picking the Star"],"이별을 꿈꾸다":["Dreaming of Separation"],"너 없인":["Without You"],"안녕 그리고 안녕 (Feat. Eric, 남규리)":["Hello and Goodbye"],"조금 더 가까이 (Duet. 영준)":["Come Closer"],"조금 더 가까이 (Inst.)":["Come Closer (Instrumental)"],"안녕 그리고 안녕 (Feat. 에릭, 남규리)":["Hello and Goodbye (feat. Eric & Nam Gyu Ri)"],"안녕 그리고 안녕 (Inst.)":["Hello and Goodbye (Instrumental)"],"퍼플 레인 (Purple Rain)":["Purple Rain"],"퍼플 레인 (Purple Rain) (Inst.)":["Purple Rain (Instrumental)"],"그 남자 이야기 (He Said...)":["He Said..."]},
  "신화":{"표적 (Sniper)":["Sniper (Target)"],"아는 사이":["She Said"],"떠나가지 마요":["Don't Leave Me"],"우리":["We"],"오렌지":["Orange"],"별":["Like a Star"],"고양이":["Cat"],"얼음달":["Bad 4 U"],"그래":["That's Right"],"아는 남자":["Guy Who Knows"],"웃다가...":["While Smiling…"],"마네킹":["Mannequin"],"사랑 노래":["Love Song"],"눈 오는 날 (The Snowy Night)":["The Snowy Night"],"열병":["Crazy"],"나의 전부 Part Ⅱ (My Everything)":["My Everything"],"놓아요 (Set Free)":["Set Free"],"위하여 (Cheers!)":["Cheers!"],"원해 (I Want)":["I Want"],"너의 결혼식":["Wedding"],"비밀 (My Own Secret)":["My Own Secret"],"중독":["Deep Sorrow"],"...후에":["Later"],"괜찮아요":["Gonna be alright"],"네가 없다면":["Without You"],"노을 (You...)":["You..."],"너 사랑안에":["In Your Love"],"해결사":["The Solver"],"천일유혼":["Sharing Forever"],"으샤! 으샤!":["Uh Sha Uh Sha"],"바램 (I Swear...)":["I Swear..."],"원":["Cycle"],"침묵을 깨고":["Breakin' the silence"],"소망":["Desire"],"푸리":["Grief"],"너의 곁에서":["Forever With You"]},
  "싸이":{"강남스타일":["Gangnam Style"],"감동이야 (feat. 성시경)":["You Move Me (feat. SUNG SI KYUNG)"],"밤이 깊었네 (feat. 헤이즈)":["Sleepless (feat. Heize)"],"이제는 (feat. 화사)":["Now (feat. Hwa Sa)"],"나의 월요일":["Hello Monday"],"내일의 나에게":["Dear Me"],"댄스쟈키":["Dance Jockey"],"나팔바지":["NAPAL BAJI"],"좋은날이 올거야 (Feat. 전인권)":["The Day Will Come (feat. Jun In Kwon)"],"아저씨SWAG (Feat. 개코 of Dynamic Duo)":["Ahjussi Swag (feat. Gaeko)"],"청개구리 (Feat. G-Dragon)":["Blue Frog (feat. G-DRAGON)"],"뜨거운 안녕 (Feat. 성시경)":["Passionate Goodbye (feat. Sung Si Kyung)"],"77학개론 (Feat. 리쌍, 김진표)":["Year of 77 (feat. Leessang & Kim Jinpyo)"],"어땠을까 (Feat. 박정현)":["What Would Have Been? (feat. Lena Park)"],"내 세상":["My World"],"내 세상 (Inst.)":["My World (Instrumental)"]},
  "싸이커스":{"문제아 (Outsider)":["Outsider"],"위치 (WITCH)":["WITCH"],"온갖 맛이 나는 젤리":["Every Flavor Jelly"],"도깨비집 (TRICKY HOUSE)":["TRICKY HOUSE"],"빛나리":["K-909 : Shine"]},
  "씨스타":{"끈":["Come and Get Me"],"해볼래":["Say! Yes"],"이불 덮고 들어":["My Sad Lullaby"],"있다 없으니까 (Smells Remix)":["Gone Not Around Any Longer (Smells Remix)"],"넌 너무 야해 (Feat. 긱스) (The Way You Make Me Melt)":["The Way You Make Me Melt (feat. Geeks)"],"바빠 (Bad Boy)":["Bad Boy"],"일주일 (A Week)":["A Week"],"핑글핑글 (Up And Down)":["Up and Down"],"나혼자 (Alone)":["Alone"],"널 사랑하겠어 (I Choose To Love You)":["I Choose to Love You"],"나혼자 (Alone) (Inst.)":["Alone (Instrumental)"],"약한 남자 싫어":["I Do Not Want a Weak Man"],"니까짓게":["How Dare You"],"가식걸":["Shady Girl"],"가식걸 (Inst.)":["Shady Girl (Instrumental)"],"위 네버 고 얼론 (We Never Go Alone)":["We Never Go Alone"],"위 네버 고 얼론 (We Never Go Alone) (Inst.)":["We Never Go Alone (Instrumental)"]},
  "씨아이엑스":{"니가 궁금해":["WONDER YOU"],"환상 속의 그대":["IN MY DREAMS"],"여름바다(Drown in Luv)":["Drown in Luv"],"20살":["20"],"숨":["In & Out"],"고해":["Confession"],"정글 (Jungle)":["Jungle"],"혹시라도 실수로 아름다운 널 해치지 않게 (Change Me)":["Change Me"],"반항아 (Rebel)":["Rebel"],"순수의 시대 (Numb)":["Numb"],"방관자 (Bystander)":["Bystander"],"그림자":["My name is shadow"]},
  "씨엔블루":{"라라라":["Can't Stop (Teaser Ver.)"],"달리기":["Running"],"그러나 꽃이었다 (Still, a Flower)":["Still, a Flower"],"우리 다시 만나는 날 (Again)":["Again"],"기억의 온도 (The Temperature of Memory)":["The Temperature of Memory"],"사소한 것들이 좋아서 (Little Things)":["Little Things"],"인생찬가 (Anthem of Life)":["Anthem of Life"],"이렇게 예뻤나 (YOU'RE SO FINE)":["YOU'RE SO FINE"],"신데렐라 (Cinderella)":["Cinderella"],"헷갈리게 (Between Us)":["Between Us"],"사랑 빛":["Love Light"],"마니또 (Manito)":["Manito"],"외톨이야":["Loner"],"끊지마 (Calling You)":["Calling You"],"신데렐라 (Remix DJ Friz)":["Cinderella (DJ Friz Remix)"],"신데렐라 (Remix Seotter)":["Cinderella (Seotter Remix)"],"숨바꼭질 (Hide and Seek)":["Hide and Seek"],"롤러코스터 (Roller Coaster)":["Roller Coaster"],"발자국 (Footsteps)":["Footsteps"],"그래요":["Yes"]},
  "씨엘씨":{"예뻐지게":["High Heels"],"오빠친구":["Friend Lover Zone"],"궁금해":["Like"],"숨바꼭질":["Hide and Seek"],"어쩌죠":["What Should I Do"],"선 (Distance)":["Distance"],"일곱 번째 (7th)":["7th"],"어디야? (Where Are You?)":["Where Are You?"],"즐겨 (I LIKE IT)":["I Like It"],"잡아줄게 (Hold Your Hand)":["Hold Your Hand"],"도깨비 (Hobgoblin)":["Hobgoblin"],"미유미유 (Meow Meow)":["Meow Meow"],"말이야 (I Mean That)":["I Mean That"],"눈물병 (Depression)":["Depression"],"어느 별에서 왔니 (What Planet Are You From?)":["What Planet Are You From?"],"아니야 (No Oh Oh)":["No Oh Oh"],"하나, 둘, 셋 (One, Two, Three)":["One, Two, Three"],"진작에 (It's Too Late)":["It’s Too Late"],"ファ一ストラブ / 첫 사랑":["ファーストラブ"],"クングメ / 궁금해":["クングメ"],"카페모카 주세요":["Cafe Mocha Please"],"샤랄라 (Sharala)":["Sharala"],"첫사랑":["First Love"],"창문을 열고":["Opening the Window"]},
  "아르테미스":{"은하수를 여행하는 히치하이커를 위한 안내서":["The Hitchhiker’s Guide to the Galaxy"],"조난 (Distress)":["Distress"]},
  "아스트로":{"꿈속의 문(Moon)(with VIVIZ (비비지), 민혁, 기현, I.M of MONSTA X, 호시, 원우, 민규, 도겸, 승관 of SEVENTEEN, HELLO GLOOM, 라키, 최유정, 김도연, 찬희 (SF9), 방찬 (Stray Kids), 문수아 of Billlie)":["Moon(with VIVIZ, MINHYUK, KIHYUN, I.M of MONSTA X, HOSHI, WONWOO, MINGYU, DK, SEUNGKWAN of SEVENTEEN, HELLO GLOOM, ROCKY, CHOI YOOJUNG, KIM DOYEON, CHA NI (SF9), Bang Chan (Stray Kids), MOON SUA of Billlie)"],"발자국 (Footprint)":["Footprint"],"노을 그림 (Sunset Sky)":["Sunset Sky"],"내 이름을 부를 때":["When You Call My Name"],"12시간":["12 Hours"],"빛이 돼줄게":["Lights On"],"다야 (All About You)":["All About You"],"찬바람 불 때면 (When The Wind Blows)":["When The Wind Blows"],"어느새 우린":["Better With You"],"니가 웃잖아":["You Smile"],"너라서":["Because It's You"],"다 거짓말":["Lie"],"OK! 준비완료":["OK! READY"],"풋사랑":["First Love"],"모닝콜":["Morning Call"],"장화 신은 고양이":["Cat's Eye"],"하늘빛 (Light the Sky)":["Light the sky"],"24시간 (24 Hours)":["24 Hours"],"밤하늘의 별처럼 (Like Stars)":["Like stars"],"우리의 계절 (Our spring)":["Our spring"],"별비 (gemini)":["gemini"],"아니 그래":["No, I Don’t.."],"전화해 (All Night)":["All Night"],"피어나 (Bloom)":["Bloom"],"너잖아 (Always you)":["Always You"],"너의 뒤에서 (By Your Side)":["By Your Side"],"외친다 (Call Out)":["Call Out"],"내 곁에 있어줘 (Stay with me)":["Stay With Me"],"니가 불어와 (Crazy Sexy Cool)":["Crazy Sexy Cool"],"붙잡았어야 해":["Again"],"고백 (Confession)":["Confession"],"숨바꼭질 (HIDE&SEEK)":["Hide & Seek"]},
  "아이덴티티":{"8시 11분":["Eight Eleven"],"던져 (Storm)":["Storm"]},
  "아이들":{"나는 아픈 건 딱 질색이니까":["Fate"],"그래도 돼요":["If You Want"],"한(一) (i-dle ver.)":["HANN (Alone) (i-dle ver.)"],"덤디덤디 (DUMDi DUMDi) (i-dle ver.)":["DUMDi DUMDi (i-dle ver.)"],"화(火花) (i-dle ver.)":["HWAA (i-dle ver.)"]},
  "아이딧":{"제멋대로 찬란하게":["CHAN-RAN"],"꿈을 꿰뚫는 순간(飛必沖天)":["Taking Off - Through Your Dreams"],"꽃피울 CROWN":["Blooming CROWN"]},
  "아이브":{"숨바꼭질 (Hush)":["Hush"],"악성코드 (Stuck In Your Head)":["Stuck In Your Head"],"삐빅 (♥beats)":["♥beats"],"해야 (HEYA)":["HEYA"],"섬찟 (Hypnosis)":["Hypnosis"],"궁금해 (Next Page)":["Next Page"]},
  "아이오아이":{"너무너무너무":["Very Very Very","miss me?"],"웃으며 안녕 (Recorded in 2016) (Prod.진영)":["Goodbye With A Smile (Recorded in 2016) (Prod.Jinyoung)"],"잠깐만":["Hold On"],"갑자기":["Suddenly"],"그때 우리 지금":["Then, Now and Forever"],"소나기":["Downpour"],"만들어가는 거야":["M-Maybe"],"사랑해 기억해":["I Love You, I Remember You"],"사랑해 기억해 (Inst.)":["I Love You, I Remeber You (Instrumental)"]},
  "아이유":{"삐삐":["Bbibbi"],"에잇":["Eight"],"금요일에 만나요":["Friday"],"좋은 날":["Good Day"],"라일락":["Lilac"],"잔소리":["Nagging"],"팔레트":["Palette"],"소격동":["Sogyeokdong"],"분홍신":["The Red Shoes"],"밤편지":["Through The Night"],"스물셋":["Twenty-Three"],"겨울잠":["Winter Sleep"],"너랑 나":["You & I"],"봄 사랑 벚꽃 말고":["Not Spring, Love, or Cherry Blossoms"],"이 별로부터":["Unknown Planet"],"바이, 썸머":["Bye, Summer"],"빨간 운동화":["Red Sneakers"],"10월 4일":["October 4th"],"미인 (Feat. Balming Tiger)":["A Beautiful Person (feat. Balming Tiger)"],"네모의 꿈":["Square's dream"],"밤 산책":["Midnight Walk"],"내사랑 내곁에":["My Love by My Side"],"내사랑 내곁에 (Inst.)":["My Love by My Side (Instrumental)"],"홀씨":["Holssi"],"Shh.. (Feat. 혜인(HYEIN), 조원선 & Special Narr. 패티김)":["Shh.. (Feat. HYEIN & WONSUN JOE) [Special Narr. Patti Kim]"],"관객이 될게 (I stan U)":["I stan U"],"드라마":["Drama"],"정거장":["Next Stop"],"너":["You"],"러브레터":["Love Letter"],"봄 안녕 봄":["Hi Spring Bye"],"돌림노래 (Feat. DEAN)":["Troll (feat. DEAN)"],"빈 컵 (Empty Cup)":["Empty Cup"],"아이와 나의 바다":["My Sea"],"어푸 (Ah puh)":["Ah puh"],"에필로그":["Epilogue"],"마음을 드려요":["Give You My Heart"],"마음을 드려요 (Inst.)":["Give You My Heart (Instrumental)"],"그 사람":["The Visitor"],"시간의 바깥":["Above the Time"],"자장가":["Lullaby"],"가을 아침":["Autumn Morning"],"비밀의 화원":["Secret Garden"],"잠 못 드는 밤 비는 내리고":["Sleepless Rainy Night"],"어젯밤 이야기":["Last Night Story"],"개여울":["By the Stream"],"매일 그대와":["Everyday with You"],"이 지금":["Dlwlrma"],"이런 엔딩":["Ending Scene"],"잼잼":["Jam Jam"],"마침표":["Full Stop"],"그렇게 사랑은":["Love Alone"],"이름에게":["Dear Name"],"사랑이 잘 (With 오혁)":["Can't Love You Anymore (with OHHYUK)"],"마음":["Heart"],"나의 옛날이야기":["My Old Story"],"꽃":["Flower"],"삐에로는 우릴 보고 웃지":["Pierrot Laughs At Us"],"사랑이 지나가면":["When Love Passes By"],"여름밤의 꿈":["Dreams In Summer Night"],"크레파스 (드라마 '예쁜 남자' 삽입곡)":["Crayon (From Drama \"Pretty Boy\")"],"을의 연애 (With 박주원)":["Love of B (with Park Ju-won)"],"누구나 비밀은 있다 (Feat. 가인 Of Brown Eyed Girls)":["Everybody Has Secrets (feat. GAIN)"],"입술 사이 (50cm)":["Between the Lips (50 cm)"],"싫은 날":["Bad Day"],"아이야 나랑 걷자 (Feat. 최백호)":["Walk With Me, Girl (feat. Choi Baek Ho)"],"우울시계 (Feat. 종현 Of SHINee)":["A Gloomy Clock (feat. JONGHYUN)"],"한낮의 꿈 (Feat. 양희은)":["Daydream (feat. Yang Hee-eun)"],"기다려":["Wait"],"복숭아":["Peach"],"하루 끝":["Every End of the Day"],"그 애 참 싫다":["Don't Like Her"],"내 손을 잡아":["Hold My Hand"],"내 손을 잡아 (Inst.)":["Hold My Hand (Instrumental)"],"이게 아닌데":["Not Like This"],"느리게 하는 일":["What I'm Doing Slow"],"첫 이별 그날 밤":["The Night of the First Breakup"],"혼자 있는 방":["Lonely Room"],"여자라서":["Because I'm a Woman"],"여자라서 (Piano Ver.)":["Because I'm a Woman (Piano Version)"],"다섯째 손가락":["Fifth Finger"],"다섯째 손가락 (Inst.)":["Fifth Finger (Instrumental)"],"기차를 타고":["Taking a Train"],"마쉬멜로우":["Marshmallow"],"아침 눈물":["Tear Drops in the Morning"],"두근 두근 데이트":["Heart Beating Date"],"기차를 타고 (Inst.)":["Taking a Train (Instrumental)"],"아침 눈물 (Inst.)":["Tear Drops in the Morning (Instrumental)"],"바라보기":["Looking at You"],"가여워":["Pitiful"],"미아":["Lost Child"],"나 말고 넷":["Four Without Me"],"있잖아 (Feat. 마리오)":["You Know (feat. Mario)","Well… (feat. Mario)"],"졸업하는 날":["Graduation Day"],"미운 오리":["Ugly Duckling"],"마주보기 (바라보기 그 후)":["Face to Face - After Looking at You"],"미아 (Acoustic Ver.)":["Lost Child (Acoustic Version)"],"있잖아 (Rock Ver.)":["You Know (Rock Version)"],"가여워 (Inst.)":["Pitiful (Instrumental)"],"미운오리":["Ugly Duckling"],"미아 (Inst.)":["Lost Child (Instrumental)"]},
  "아이즈원":{"느린 여행":["Slow Journey"],"환상동화 (Secret Story of the Swan)":["Secret Story of the Swan"],"우연이 아니야":["DESTINY"],"언젠가 우리의 밤도 지나가겠죠":["SOMEDAY"],"해바라기":["Hey. Bae. Like it."],"비올레타":["Violeta"],"하늘 위로":["Up"],"고양이가 되고 싶어":["NEKONI NARITAI (Korean Version)"],"기분 좋은 안녕":["GOKIGEN SAYONARA (Korean Version)"]},
  "아이칠린":{"꼭꼭 숨어라":["Play Hide & Seek"],"꼭꼭 숨어라 (Inst)":["Play Hide & Seek (Instrumental)"]},
  "아이콘":{"혼잣말 (T.T.M)":["T.T.M"],"왜왜왜 (Why Why Why)":["Why Why Why"],"고무줄다리기 (Rubber Band)":["Rubber Band"],"오늘 모해 (#WYD)":["#WYD"]},
  "아일릿":{"비밀찾기":["Secret Quest"],"비밀찾기 (Inst.)":["Secret Quest - Instrumental"],"체포하겠어":["You're Under Arrest","You’re Under Arrest"],"체포하겠어 (Kids Remix)":["You're Under Arrest (Kids Remix)"],"체포하겠어 (Whistle Remix)":["You're Under Arrest (Whistle Remix)"],"체포하겠어 (Club Remix)":["You're Under Arrest (Club Remix)"],"체포하겠어 (Hyper Remix)":["You're Under Arrest (Hyper Remix)"],"체포하겠어 (Sped Up)":["You're Under Arrest (Sped Up)"],"체포하겠어 (Slowed+Reverb)":["You're Under Arrest (Slowed+Reverb)"],"가장 빛날 너에게":["ALL FOR YOU"],"가장 빛날 너에게 (Inst.)":["ALL FOR YOU (Instrumental)"],"빌려온 고양이 (Do the Dance) (Japanese Ver.)":["Karitekita Neko (Do the Dance) [Japanese Ver.]"],"빌려온 고양이 (Do the Dance)":["Billyeoon Goyangi (Do the Dance)"],"빌려온 고양이 (Do the Dance) (Snail's House Remix)":["Billyeoon Goyangi (Do the Dance) [Snail's House Remix]"],"빌려온 고양이 (Do the Dance) (Sunlight Remix)":["Billyeoon Goyangi (Do the Dance) [Sunlight Remix]"],"빌려온 고양이 (Do the Dance) (Fig Tape Remix)":["Billyeoon Goyangi (Do the Dance) [Remix]"],"빌려온 고양이 (Do the Dance) (Breakbot & Irfane Remix)":["Billyeoon Goyangi (Do the Dance) [Breakbot & Irfane Remix]"],"빌려온 고양이 (Do the Dance) (Slowed + Reverb)":["Billyeoon Goyangi (Do the Dance) [Slowed + Reverb]"],"빌려온 고양이 (Do the Dance) (Instrumental)":["Billyeoon Goyangi (Do the Dance) [Instrumental]"],"밤소풍":["bamsopoong"]},
  "아홉":{"그냥 너라서 그래":["You're the Reason"],"아홉, 빛나는 숫자의 시작 (Intro)":["Everything is Love"],"1.5x의 속도로 달려줘":["Run at 1.5x Speed"],"피노키오는 거짓말을 싫어해":["Pinocchio"],"다신 너를 잃지 않게":["Never Lose You"],"잠든 일기장 (Outro)":["The Sleeping Diary"],"소년, 무대 위로 넘어지다 (Intro)":["The Little Star"],"파랑 학교, 초록 잔디, 빨간 운동화":["The Universe"],"그곳에서 다시 만나기로 해 (Rendezvous)":["Rendezvous"],"미완성은 아닐거야":["Incompleted"],"우주 최고의 꼴찌":["Cosmic Underdog"],"아홉, 우리가 빛나는 숫자 (Outro)":["AHOF"]},
  "악뮤":{"소문의 낙원":["Paradise of Rumors"],"봄 색깔":["Spring Colors"],"벌레를 내고":["Paid with Bugs"],"기쁨, 슬픔, 아름다운 마음":["Joy, Sorrow, A Beautiful Heart"],"햇빛 bless you":["Sunshine Bless You"],"어린 부부":["Young and Married"],"옳은 사람":["The Right Person"],"우아한 아침 식사":["Graceful Breakfast"],"난민들의 축제":["Festival of Refugees"],"얼룩":["Stains"],"후라이의 꿈":["Fry’s Dream"],"뱃노래":["Chantey"],"물 만난 물고기":["Fish In the Water"],"어떻게 이별까지 사랑하겠어, 널 사랑하는 거지":["How can I love the heartbreak, you're the one I love"],"달":["Moon"],"더 사랑해줄걸":["Should've Loved You More"],"고래":["Whale"],"밤 끝없는 밤":["Endless Dream, Good Night"],"작별 인사":["Farewell"],"시간을 갖자":["Let's Take Time"],"생방송":["Live"],"리얼리티":["Reality"],"오랜 날 오랜 밤":["Last Goodbye"],"못생긴 척":["Play Ugly"],"집에 돌아오는 길":["Way Back Home"],"그때 그 아이들은":["Will Last Forever"],"사람들이 움직이는 게":["How People Move"],"새삼스럽게 왜":["Haughty Girl"],"초록창가":["Green Window"],"사소한 것에서":["Every Little Thing"],"주변인":["Around"],"시간과 낙엽":["Time and Fallen Leaves"],"외국인의 고백":["The Love Of Foreigner"],"외국인의 고백 (Inst.)":["The Love Of Foreigner (Instrumental)"],"매력있어":["KPOPSTAR Season2 'You Are Attractive'"],"다리꼬지마":["KPOPSTAR Season2 'Don't Cross Your Leg"]},
  "안예인":{"그리움만 남겨져 가":["All that remains is our longing"],"그리움만 남겨져 가 (Inst.)":["All that remains is our longing (inst.)"]},
  "알엠":{"어긋":["uhgood"],"지나가 (with Nell)":["everythingoes (with Nell)"]},
  "애프터스쿨":{"첫사랑":["First Love"],"화장을 하다 울었어":["Make up & Tears"],"손목시계":["Watch"],"뱅(Bang) ! (2011 New Recordings)":["Bang!"],"너 때문에 (2011 New Recordings)":["Because of You"],"시간에 기대어 (Raina Solo)":["Depend on Time (feat. Raina)"],"잘 지내고 있죠":["Nothing to Complain Of"],"뱅(Bang) !":["Bang"],"뱅(Bang) ! (Inst.)":["Bang (Inst.) [Instrumental]"],"너 때문에":["Because of You"],"너 때문에 (Inst.)":["Because of You (Instrumental)"],"나쁜놈":["Bad Bastard"]},
  "앤팀":{"러브장":["Love Jang"]},
  "앨리스":{"해봐 (Like I do)":["Like I Do"],"우리 처음":["We, First"],"나의 별":["My Star"],"너와 나":["You and I"]},
  "앰퍼샌드원":{"뭐라는 거야 (What You Talking About)":["What You Talking About"],"나는 나대로 (My Way)":["My Way"],"너의 웃음 속에 눈물이 보여 (Tears In Your Smile)":["Tears In Your Smile"],"그게 그거지 (That’s That)":["That's That"],"삐걱삐걱 (Seesaw)":["Seesaw"],"길을 비켜 (Move Out)":["Move Out"],"일냈어 (Did It)":["Did It"]},
  "앳하트":{"내 마음 한 조각":["A Piece of My heart"]},
  "양요섭":{"네가 없는 곳":["Where I Am Gone"]},
  "양지원":{"태양을 향해 (아이마스크 광고 삽입곡)":["Towards the Sun"],"태양을 향해 (아이마스크 광고 삽입곡) (Inst.)":["Towards the sun (Inst.)"]},
  "어센트":{"편의점 앞 신호등":["Green light, Yellow light, Red light"],"계절이 너로 시작돼":["You're my season"]},
  "언차일드":{"빛 (TRICKY GRLS)":["TRICKY GRLS"],"팅팅 (TiNG TiNG)":["TiNG TiNG"]},
  "엄지":{"어서와":["Meow the Secret Boy"],"어서와 (Inst.)":["Meow the Secret Boy (Instrumental)"]},
  "업텐션":{"너에게 미쳤었다":["Crazy About You"],"설레":["Incredible"],"만약 (If) (Duet 고결, 환희)":["If (Duet KOGYEOL, HWANHEE)"],"혹시라도 (Forever) (Unit 쿤, 선율, 규진, 샤오)":["Forever (Unit KUHN, SUNYOUL, GYUJIN, XIAO)"],"니가 보여 (Waiting For You)":["Waiting for You"],"빈집 (텅) (Empty House)":["Empty House"],"반해, 안 반해 (Target on)":["Target On"],"오늘이야 (Finally)":["Finally"],"습관 (Habit)":["Habit"],"모호해 (Mixed signals)":["Mixed Signals"],"이대로 (Always)":["Always"],"시간이 멈춰서 (Still with you)":["Still with You"],"예고 없이 (I need you)":["I Need You"],"미치게 해 (Going Crazy)":["Going Crazy"],"그대 내게 다시 (Come Back To Me)":["Come Back to Me"],"미치게 해 (Going Crazy) (Inst.)":["Going Crazy (Instrumental)"],"시작해 (Runner)":["Runner"],"너다운 (True Love)":["True Love"],"매일 (Everyday)":["Everyday"],"하얗게 불태웠어":["White Night"],"전력질주":["GO!"],"왜냐하면":["Because"],"빠져가지고":["Stuck On You"],"오늘이 딱이야 (夜半逃走)":["Tonight"],"예뻐 (Beautiful)":["Beautiful"],"오아시스 (OASIS)":["Oasis"],"행운이 되어줘 (Be My Luck)":["Be My Luck"],"오늘이 딱이야 (夜半逃走) (Inst.)":["Tonight [Instrumental]"],"나한테만 집중해 (Attention)":["Attention"],"아무렇지 않은 척 (Like nothing happened)":["Like Nothing Happened"],"기적을 바란다 (I wish a miracle)":["I Wish a Miracle"],"보일 듯 말 듯 (Cherish)":["Cherish"],"여기여기 붙어라 (Catch me!)":["Catch Me!"],"나두 (dito)":["Dito"],"불러 (call me)":["Call Me"],"위험해 (SO, DANGEROUS)":["SO, DANGEROUS"],"그대로 (Come as you are)":["Come As You Are"]},
  "에버글로우":{"달아 (Moon)":["Moon"],"봉봉쇼콜라 (Bon Bon Chocolat)":["Bon Bon Chocolat"]},
  "에스에프나인":{"내가 그리움이 되면 (Fade Into Memories)":["Fade Into Memories"],"아픈 건지 허전한 건지 (Hurt & Hollow)":["Hurt & Hollow"],"곁 (By Your Side)":["By Your Side"],"숨은 사랑 찾기 (Love Puzzle)":["Love Puzzle"],"물음표":["Question Mark"],"물음표 (Inst.)":["Question Mark (Instrumental)"],"잠시 (On And On)":["On And On"],"오늘이라서 (For Fantasy)":["For Fantasy"],"숨 |Believer|":["|Believer|"],"한 번 더 사랑하자 (Love Again)":["Love Again"],"하자 하자 이별 좀 (Off My Mind)":["Off My Mind"],"방방 뛰어 (Fanatic)":["Fanatic"],"손잡아 줄게 (Shine Together)":["Shine Together"],"오래 오래 (Forever)":["Forever"],"나만 그래 (Am I The Only One)":["Am I The Only One"],"룰루랄라 (Lullu Lalla)":["Lullu Lalla"],"널 꽉 잡은 손만큼 (Like The Hands Held Tight)":["Like The Hands Held Tight"],"타 (Fire)":["Fire"],"더 잔인하게 (Stop It Now)":["Stop It Now"],"춤을 출 거야 (Dance With Us)":["Dance With Us"],"돌고 돌아 (Round And Round)":["Round And Round"],"예뻐지지 마":["Enough"],"화끈하게":["Play Hard"],"하필":["Heartbeat"],"무중력":["The Beat Goes On"],"너와 함께라면 (So Beautiful)":["So Beautiful"],"너와 함께라면 (So Beautiful) (Inst.)":["So Beautiful (inst.)"],"팡파레 (Fanfare)":["Fanfare"]},
  "에스파":{"시대유감 (時代遺憾) (2024 aespa Remake Ver.)":["Regret of the Times (2024 aespa Remake Version)"],"시대유감 (時代遺憾) (2024 aespa Remake Ver.) (Inst.)":["Regret of the Times (2024 aespa Remake Version) [Instrumental]"]},
  "에이비식스":{"어제와 닮은 오늘이 생각보다 따뜻하니까":["Pieces of Youth"],"그런 날 (Sometimes)":["Sometimes"],"잘 자, 내일 봐":["Your Tomorrow"],"같이 걷자":["Side by Side"],"1분 1초":["A Minute, A Second"],"1분 1초 (Inst.)":["A Minute, A Second - Instrumental"],"중.꺾.그.마":["Just do it!"],"우리가 헤어졌던 이유":["Sucker for your love"],"아인슈타인 (EINSTEIN)":["EINSTEIN"],"위로 (CONSOLATION)":["CONSOLATION"],"너의 눈에 내가 보여서 (IN YOUR EYES)":["IN YOUR EYES"],"비범벅":["Walking In The Rain"],"비범벅 (Inst.)":["Walking In The Rain (Instrumental)"],"불시착 (STAY YOUNG)":["STAY YOUNG"],"앵콜 (ENCORE) (Feat. ABNEW)":["ENCORE (feat. ABNEW)"],"이게 그리움이 아니라면 대체 뭐겠어 (MAYBE)":["MAYBE"],"한걸음 뒤에 서서 (BEHIND YOU)":["BEHIND YOU"],"초현실 (SURREAL) (Alternative Rock Mix.)":["SURREAL (Alternative Rock Mix)"],"불시착 (STAY YOUNG) (Inst.)":["STAY YOUNG (Instrumental)"],"잡아줄게 (HOLD YOU)":["Hold You"],"잡아줄게 (HOLD YOU) (Inst.)":["Hold You (Instrumental)"],"더 더 (MORE)":["MORE"],"좋게 끝내 (BREAK UP)":["BREAK UP"],"별자리 (SHINING STARS)":["SHINING STARS"],"둘만의 춤 (DANCE FOR TWO)":["DANCE FOR TWO"]},
  "에이스":{"늦은 후회":["The Late Regret"],"늦은 후회 (Eng ver.)":["The Late Regret (Eng Version)"],"해주고 싶은 한마디 (Talk you down)":["Talk you down"],"진도 아리랑 (Prequel)":["Prequel"],"선인장 (CACTUS) (Eng ver.)":["CACTUS (English Version)"],"선인장 (CACTUS) (Remix ver.)":["CACTUS (Remix Version)"],"도깨비 (Favorite Boys)":["Goblin (Favorite Boys)"],"황홀경 (恍惚境)":["Baby Tonight"],"편지를 써 (Stand by you)":["Stand by you"],"삐딱선 (SAVAGE)":["SAVAGE"],"나쁜 말 (So Sick)":["So Sick"],"들린다면":["If You Heard"],"선인장 (CACTUS)":["CACTUS"],"선인장 (CACTUS) (Inst.)":["CACTUS (Inst.)"]},
  "에이오에이":{"날 보러 와요 (Come See Me)":["Come See Me"],"주문을 외워봐 (Magic Spell)":["Magic Spell"],"빙글뱅글 (Bingle Bangle)":["Bingle Bangle"],"파르페":["Parfait"],"뚜뚜뚜":["Dododo"],"짧은 치마 (Miniskirt)":["Miniskirt"],"가로등 불 아래서":["Under the Street Light"],"짧은 치마 (Inst.)":["Miniskirt (Instrumental)"],"흔들려":["Confused"],"니꺼 내꺼":["We Belong Together"]},
  "에이티즈":{"불놀이야 (I'm The One)":["Fireworks (I'm The One)"],"우리의 마음이 닿는 곳이라면 (To be your light) (종호)":["To be your light (JONGHO)"],"미친 폼 (Crazy Form)":["Crazy Form"],"꿈날 (Dreamy Day)":["Dreamy Day"],"최면 (Wake Up)":["Wake Up"],"지평선 (Horizon)":["Horizon"],"안개":["MIST"],"친구 (THANK U)":["THANK U"],"걸어가고 있어":["WITH U"],"해적왕":["Pirate King"]},
  "에이프릴":{"예쁜 게 죄":["Oh! My Mistake"],"이야기":["Story"],"예쁜 게 죄 (Inst.)":["Oh! My Mistake (Instrumental)"]},
  "에이핑크":{"1도 없어":["I'm So Sick"],"손을 잡아줘":["Hold My Hand"],"나만 알면 돼":["I want you to be happy"],"나만 알면 돼 (Inst.)":["I want you to be happy (Instrumental)"],"그날의 봄 (Just Like This)":["Just Like This"],"작은 별 (Dream)":["Dream"],"고마워 (Thank you)":["Thank you","Thank You"],"고마워 (Thank you) (Inst.)":["Thank You (Instrumental)"],"덤더럼 (Dumhdurum)":["Dumhdurum"],"너의 모든 순간을 사랑해":["Moment"],"안아줘요":["Hug Me"],"느낌적인 느낌":["What Are You Doing?"],"줄다리기":["Push & Pull"],"기억 더하기":["Memories"],"별 그리고..":["Forever Star"],"말보다 너":["Promise Me"],"기적 같은 이야기":["Miracle"],"기적 같은 이야기 (Inst.)":["Miracle (Instrumental)"],"콕콕":["Kok Kok"],"좋아요!":["Like!"],"내가 설렐 수 있게":["Only One"],"네가 손짓해주면":["The Wave"],"네가 손짓해주면 (Inst.)":["The Wave (Instrumental)"],"끌려":["Attracted to U"],"꽃잎점":["Petal"],"신기하죠":["A Wonderful Love"],"새끼손가락":["Promise U"],"새끼손가락 (Inst.)":["Promise U (Instrumental)"],"천사가 아냐":["I'm Not an Angel"],"동화 같은 사랑":["Once Upon a Time"],"사랑동화":["Love Story"],"난 니가 필요해":["I Need You"],"4월 19일":["0419"],"꿈결처럼":["Like a Dream"],"우리 그냥 사랑하게 해주세요":["Let Us Just Love"],"우리 그냥 사랑하게 해주세요 (Inst.)":["Let Us Just Love (Instrumental)"],"몰라요":["I Don't Know"]},
  "에잇턴":{"이럴거면 다음생에":["Like a Friend"]},
  "에프엑스":{"피노키오 (Danger)":["Pinocchio (Danger)"],"나비 (Butterfly)":["Butterfly"],"무지개 (Rainbow)":["Rainbow"],"바캉스 (Vacance)":["Vacance"],"뱉어내 (Spit It Out)":["Spit It Out"],"종이 심장 (Paper Heart)":["Paper Heart"],"시그널 (Signal)":["Signal"],"여우 같은 내 친구 (No More)":["No More"],"제트별 (Jet)":["Jet"],"지그재그 (Zig Zag)":["Zig Zag"],"훌쩍 (Let's Try)":["Let's Try"],"빙그르 (Sweet Witches)":["Sweet Witches"],"좋아해도 되나요 (...Is It OK?)":["…Is It OK?"],"아이 (Love)":["Love"],"라차타 (LA chA TA)":["LA chA TA"],"NU 예삐오 (NU ABO)":["NU ABO"],"아이스크림 (Ice Cream)":["Ice Cream"],"사랑해, 사랑해":["I Love You, I Love You"],"사랑해, 사랑해 (Inst.)":["I Love You, I Love You (Inst.)"]},
  "에프티아일랜드":{"사랑후애":["After Love"],"처음 그 날처럼":["Like The First Day"],"정답":["Expected"],"작은 나보다 커다란 세상이 문을 열어 줄 것 같아":["Cloud"],"행복 이론 (Theory of Happiness)":["Theory of Happiness"],"내게 전해 줄 노래 (Letter to Myself)":["Letter to Myself"],"나침반 (Journey)":["Journey"],"베르사이유의 장미 (웹툰 ‘세이렌’ X FTISLAND (FT아일랜드))":["The rose of Versailles (Original Soundtrack from the Webtoon The Siren : Becoming the Villain's Family)"],"베르사이유의 장미 (웹툰 ‘세이렌’ X FTISLAND (FT아일랜드)) (Inst.)":["The rose of Versailles (Original Soundtrack from the Webtoon The Siren : Becoming the Villain's Family) [Instrumental]"],"마중 (2023) (낮에 뜨는 달 X FTISLAND (FT아일랜드))":["Meeting (The Moon during the Day) [2023 Remake]"],"마중 (2023) (낮에 뜨는 달 X FTISLAND (FT아일랜드)) (Inst.)":["Meeting (The Moon during the Day) [2023 Remake] [Instrumental]"],"사랑하는 법을 몰라서 (2023)":["Because I Don't Know How to Love (2023)"],"사랑하는 법을 몰라서 (2023) (Inst.)":["Because I Don't Know How to Love (2023) [Instrumental]"],"말이 안 돼 (Unthinkable)":["Unthinkable"],"뻔한 스토리 (Obvious)":["Obvious"],"관둬 (Quit)":["Quit"],"다시 바래 (Hope Again)":["Hope Again"],"못 고치나 봐 (Day By Day)":["Day By Day"],"신기루 (사랑사랑사랑2) (No Regret)":["No Regret"],"여름밤의 꿈":["Summer Night's Dream"],"원해":["What U Want"],"너를 그린다":["Imagine You"],"나무":["The Wood"],"사랑앓이 (With 김나영)":["Love Sick (With Kim Na Young)"],"사랑앓이 (With 김나영) (Inst.)":["Love Sick (With Kim Na Young) [inst.]"],"가면":["Mask"],"너에게 물들어":["Becoming You"],"그림자":["Shadow"],"빛":["Find a Light"],"오렌지색 하늘":["Orange Sky"],"미치도록":["Madly"],"가질 수 없는 너":["Paralyzer"],"좋겠어 (I wish)":["I Wish"],"너의 말":["Your Words"],"보내주자...":["Let Her Go"],"지독하게":["Severely"],"친구마저 잃었다":["Even Lost a Friend"],"난 못난 사람입니다":["I'm a Foolish Person"],"다 큰 남자가...":["Grown Man"],"애인이 돼 주길 바래요":["We Hope to Become Lovers"],"새들처럼":["Like Birds"],"상심":["Heartbroken"],"그대 눈물까지도":["Even If It's Your Tears"],"이별 아닌 이별":["Not a True Goodbye"],"신사동 그 사람":["That Person In Shinsadong"],"널 갖겠다":["I'm Going To Have You"],"고백합니다":["I Confess"],"사랑사랑사랑":["Love Love Love"],"굳은 살이 박혀버려..":["Iron Heart"],"미친 듯이 너 하나만":["Crazily, Only You"],"돈키호테의 노래":["Song of Don Quixote"],"빙빙빙":["BingBingBing"],"바래":["I Hope"],"미우나고우나":["Love It, Hate It"],"천사와 나무꾼":["The Angel and the Woodman"],"소녀를 만나다 (소나기)":["Meet Girl (Shower)"],"결혼해줘":["Marry Me"],"꼭은 아니더라도":["Even If It's Not Necessary…"],"첫눈에 알아":["Already Knew It at First Sight"],"보내주기":["Let Go"],"못난이":["Ugly"],"남의 속도 모르고":["You Don't Know My Feelings"],"바래 (Ver.2)":["I Hope (Version 2)"],"나쁜 여자야":["Bad Woman"],"인형처럼":["Like a Doll"],"마법":["Magic"],"그대와 나":["You and I"],"어쩌란 말이야":["What Should I Do?"],"너를 사랑해 (Love Is...)":["Love Is…"],"너의 안부를 물을 때":["When I'm Asking About Your Well Being"],"바램":["Hopeful"],"내 오랜 그녀와 해야 할 일":["The Thing I Should Have Continued Doing With Her"],"그대는 사랑입니다 (Remix)":["You Are My Love (Remix)"],"여자는 몰라":["She Doesn't Know"],"그대는 사랑입니다":["You Are My Love"],"멋쟁이 Vs 예쁜이 (FT Vs Pri)":["Cool vs. Pretty (FT Vs Pri)"],"외워두기":["Memorize"],"미워하고 원망하고":["Hate & Resentment"],"1분 1초도":["1 Minute 1 Second"],"사랑하지마요":["Don’t Love"],"사랑이라 부르는 이름":["A Name Called Love"],"눈물이 흐른다":["2008 Love Song F.T Island - Tears Are Falling"],"너 올 때까지":["Until You Come Back"],"사랑이야":["It's Love"],"눈물이 더 가까운 사람":["A Person Closer To Tears"],"사랑앓이":["Love Sick"],"행복합니다":["I'm Happy"],"천둥":["Thunder"],"한사람만":["Only One Person","Only One Persion"],"집착":["Attachment"],"남자의 첫사랑은 무덤까지 간다":["A Man's First Love Follows Him To the Grave","A Man's First Love Follows To the Grave"],"하지말래요":["They Tell Me To Stop"],"마중":["Meeting"],"사랑하는 법을 몰라서":["Because I Don't Know How To Love"],"첫키스":["First Kiss"]},
  "엑소":{"첫 눈":["The First Snow"],"불공평해 (Unfair)":["Unfair"],"발자국 (On the snow)":["On the Snow"],"나비소녀 (Don't Go)":["Don't Go"],"피터팬 (Peter Pan)":["Peter Pan"],"늑대와 미녀 (Wolf) (EXO-K Ver.)":["Wolf (EXO-K Version)"],"늑대와 미녀 (Wolf) (Chinese Ver.)":["Wolf (Chinese Version)"]},
  "엑스디너리 히어로즈":{"소년만화":["Boy Comics"],"어리고 부끄럽고 바보 같은":["Little Things"],"꿈을 꾸는 소녀":["Dreaming Girl"],"불꽃놀이의 밤":["Night of Fireworks"],"잠꼬대":["Zzz.."],"나를 깨워줘 (Break the Darkness)":["Break the Darkness"],"나를 깨워줘 (Break the Darkness) (Inst.)":["Break the Darkness (Instrumental)"]},
  "엑스러브":{"투스젬치와와":["Tooth Gem Chiwawa"],"투스젬치와와 (Sped Up)":["Tooth Gem Chiwawa (Sped Up)"],"투스젬치와와 (Instrumental)":["Tooth Gem Chiwawa (Instrumental)"]},
  "엔믹스":{"긴 소원 (Birthday Wish)":["Birthday Wish"],"너는 달 (Sing to the Moon) (LILY, HAEWON)":["Sing to the Moon (LILY & HAEWON)"],"휙 (WHIP) (JIWOO, KYUJIN)":["WHIP (JIWOO & KYUJIN)"],"별별별 (See that?)":["See that?"]},
  "엔시티 127":{"나 홀로 집에 (Home Alone)":["Home Alone"],"하얀 거짓말 (White Lie)":["White Lie"],"질주 (2 Baddies) (No Identity Remix)":["2 Baddies (No Identity Remix)"],"질주 (2 Baddies) (Viann Remix)":["2 Baddies (Viann Remix)"],"질주 (2 Baddies) (Biicla Remix)":["2 Baddies (Biicla Remix)"],"서곡 (序曲; Prelude)":["Prelude"],"영웅 (英雄; Kick It)":["Kick It"],"꿈 (Boom)":["Boom"],"낮잠 (Pandora's Box)":["Pandora's Box"],"너의 하루 (Make Your Day)":["Make Your Day"],"뿔 (MAD DOG)":["MAD DOG"],"메아리 (Love Me Now)":["Love Me Now"],"우산 (Love Song)":["Love Song"],"백야 (White Night)":["White Night"],"영웅 (英雄; Kick It) (Valentino Khan Remix)":["Kick It (Valentino Khan Remix)"],"영웅 (英雄; Kick It) (MINIMONSTER Remix)":["Kick It (MINIMONSTER Remix)"],"영웅 (英雄; Kick It) (Hitchhiker Remix)":["Kick It (Hitchhiker Remix)"],"소방차 (Fire Truck)":["Fire Truck"],"지금 우리 (City 127)":["City 127"],"나의 모든 순간 (No Longer)":["No Longer"],"내 Van (My Van)":["My Van"],"악몽 (Come Back)":["Come Back"],"신기루 (Fly Away With Me)":["Fly Away With Me"]},
  "엔시티 드림":{"버퍼링 (Glitch Mode) (Japanese Ver.)":["Glitch Mode (Japanese ver.)"],"버퍼링 (Glitch Mode) (JINBO Remix)":["iScreaM Vol. 16 : Glitch Mode (JINBO Remix)"],"맛 (Hot Sauce) (Hitchhiker Remix)":["Hot Sauce (Hitchhiker Remix)"],"맛 (Hot Sauce) (MINIMONSTER Remix)":["Hot Sauce (MINIMONSTER Remix)"],"사랑한단 뜻이야 (Candle Light)":["Candle Light"],"사랑한단 뜻이야 (Candle Light) (Inst.)":["Candle Light (Instrumental)"],"마지막 첫사랑 (My First and Last)":["My First and Last"],"덩크슛 (Dunk Shot)":["Dunk Shot"]},
  "엔시티 위시":{"여우비 (Crush)":["Crush"],"고양이 릴스 (Reel-ationship)":["Reel-ationship"],"3분까진 필요 없어 (3 Minutes)":["3 Minutes"],"꿈결 (Like A Dream)":["Like A Dream"],"프린스핑송":["Princeping Song (From \"Princess Catch! Teenieping\")"],"프린스핑송 (Inst.)":["Princeping Song (From \"Princess Catch! Teenieping\") [Instrumental]"],"이 세상 끝까지":["If you love me let me know (Would You Marry Me? : Original Television Soundtrack)"],"이 세상 끝까지 (Inst.)":["If you love me let me know (Would You Marry Me? : Original Television Soundtrack) [Instrumental]"]},
  "엔싸인":{"나의 바다 (Memories of us)":["Memories of us"],"나의 바다 (Memories of us) (Inst.)":["Memories of us (Instrumental)"],"웜홀 (Wormhole: New Track)":["Wormhole: New Track"],"바다숲":["SOUND CANDY"],"바다숲 (Inst.)":["SOUND CANDY (Inst.)"],"필요해 (Need U)":["Need U"],"너만 빼고 다 있어 (Have All Except You)":["Have All Except You"],"우리집":["My House"],"필요해 (Need U) (Inst.)":["Need U (Instrumental)"],"너만 빼고 다 있어 (Have All Except You) (Inst.)":["Have All Except You (Instrumental)"],"여름안에서 (Radio Edit Ver)":["In Summer (Radio Edit Ver)"],"여름안에서 (Performance Ver)":["In Summer (Performance Ver)"]},
  "엔플라잉":{"잔불 (Still)":["Still"],"고생했어 (My Dearest)":["My Dearest"],"나를 사랑하지 않는 너에게 (Wake Up)":["Wake Up"],"어쩌면 가장 서툰 내가 좋았어 (The Way We Were)":["The Way We Were"],"홍실 (Hongsil)":["Hongsil"],"아는 결말 (Our Ending)":["Our Ending"],"우주먼지 (Fading Away)":["Fading Away"],"환절기 (換節期)":["In Between Seasons"],"만년설 (Everlasting)":["Everlasting"],"사랑을 마주하고 (Rise Again)":["Rise Again"],"하나둘씩 (Love In Memory)":["Love In Memory"],"아직도 난 그대를 좋아해요 (Still You)":["Still You"],"행복해버리기 (HAPPY ME!)":["HAPPY ME!"],"뫼비우스 (Moebius)":["Moebius"],"네가 내 마음에 자리 잡았다 (Into You)":["Into You"],"아름다운 밤":["Wonderful Night"],"아름다운 밤 (inst.)":["Wonderful Night (Instrumental)"],"폭망 (I Like You)":["I Like You"],"그 밤 (The Night)":["The Night"],"일 (1)":["1"],"너에게로 가는 길 (영화 '동감' X 엔플라잉 (N.Flying))":["Crazy for you ('Ditto' Original Soundtrack)"],"너에게로 가는 길 (영화 '동감' X 엔플라잉 (N.Flying)) (Inst.)":["Crazy for you ('Ditto' Original Soundtrack) [Instrumental]"],"피었습니다 (Into Bloom)":["Into Bloom"],"쉼표 (Comma,)":["Comma,"],"지우개 (Undo)":["Undo"],"파란 배경 (Blue Scene)":["Blue Scene"],"이 별 저 별 (Fate)":["Fate"],"빈집 (Zip.)":["Zip."],"너에게 (To You)":["To You"],"아 진짜요. (Oh really.)":["Oh really."],"꽃바람 (YOUTH)":["YOUTH"],"아무거나 (I'M GONNA)":["I’M GONNA"],"마지막 무대 (Last Song)":["Last Song"],"에요 (E-YO)":["E-YO"],"괜찮아":["It's Fine"],"괜찮아 (Inst.)":["It's Fine (Instrumental Version)"],"굿밤 (GOOD BAM)":["GOOD BAM"],"ㅈㅅ (Pardon?)":["Pardon?"],"봄이 부시게 (Spring Memories)":["Spring Memories"],"놔 (Leave It)":["Leave It"],"불놀이 (Flowerwork)":["Flowerwork"],"옥탑방 (Rooftop)":["Rooftop"],"꽃 (Like a Flower)":["LIKE A FLOWER"],"꽃 (Like a Flower) (Inst.)":["LIKE A FLOWER (inst.)"],"팔불출":["Lovefool"],"너 없는 난":["Fall With You"],"진짜가 나타났다":["The Real"],"다행이야":["I'm Okay"],"정리가 안돼":["Don’t' Mess with Me"],"짠해":["Say Goodbye"],"뻔뻔":["Shameless"],"기가 막혀 (Awesome)":["Awesome"],"가슴이 놀래 (Heartbreak)":["Heartbreak"],"1분 (1 Minute)":["1 Minute"]},
  "엔하이픈":{"멀어":["Blind"],"구해줘 (I Need The Light)":["I Need the Light"],"구해줘 (I Need The Light) (Inst.)":["I Need the Light (Instrumental)"],"몰랐어":["Just A Little Bit"],"모 아니면 도 (Go Big or Go Home)":["Go Big or Go Home"],"별안간 (Mixed Up)":["Mixed Up"]},
  "엘라스트":{"아이(i)":["i"],"너":["You"],"나의 세상 (Forever and one)":["Forever and one"],"악연 (Dark Dream)":["Dark Dream"],"악연 (Dark Dream) (Inst.)":["Dark Dream (Instrumental)"],"눈물자국":["TEARS OF CHAOS"],"기사의 맹세":["Swear"],"나의 꽃":["My Flower"],"빛":["Light"],"놓아줘":["Let me free"],"각인":["Nightmare"]},
  "엠블랙":{"봄 여름 가을 그리고...":["Spring, Summer, Autumn And..."],"괜찮을 거란 그 말 (Feat. 혜미 Of 피에스타)":["Words that Would Make It OK"],"녹 (Unplugged Ver.)":["Rust (Unplugged Ver.)"],"사계절 24시간 (Four Seasons 24 Hours)":["Four seasons, 24 Hours"],"나무 (Tree)":["Tree"],"천국이니까 (Winter Rain)":["Winter Rain"],"천국이니까 (Winter Rain) (Inst.)":["Winter Rain (Instrumental)"],"사랑이 온다 (Beautiful)":["Beautiful"],"전쟁이야 (This Is War)":["This Is War"],"낙서 (Scribble)":["Scribble"],"모나리자 (Mona Lisa)":["Mona Lisa"]},
  "엠씨엔디":{"절대음감(Tuning)":["Tuning"],"고래(Out Louder)":["Out Louder"],"고양이 춤 (Cat Waltz)":["Cat Waltz"],"풍악을 울려 (Play Pungak)":["Play Pungak"],"우당탕 (Crush)":["Crush"],"Outro ; ㅁㅊㄴㄷ":["Outro"],"아직 끝난거 아이다 (Not over)":["Not Over"],"Intro ; 푸른별 (Earth Age)":["Intro ; Earth Age"],"숨쉬어 (Breathe)":["Breathe"],"쾅쾅쾅 (Bumpin’)":["Bumpin'"],"Outro ; 외딴별 (Kepler1649c)":["Outro ; Kepler1649c"],"아뜨뜨뜨":["ADDD"],"열대야 (Campfire)":["Campfire"],"떠 (Spring)":["Spring"]},
  "여은":{"너와 참 행복했는데":["I was so happy with you"],"너와 참 행복했는데 (Inst.)":["I was so happy with you (Instrumental)"],"너를 생각하는 밤이야":["Thinking about you tonight"],"너를 생각하는 밤이야 (Inst.)":["Thinking about you tonight (Instrumental)"],"너라서 버틸 수 있었어":["I could hold on because of you"],"너라서 버틸 수 있었어 (Inst.)":["I could hold on because of you (Instrumental)"],"사랑이 번져가":["Love is spreading"],"사랑이 번져가 (Inst.)":["Love is spreading (Instrumental)"],"다 그대로 돌아가":["Everything's just as it was"],"다 그대로 돌아가 (Inst.)":["Everything's just as it was (Instrumental)"],"너는 어디에 있니":["Where are you"],"너는 어디에 있니 (Inst.)":["Where are you (Instrumental)"],"우리 결국":["We Ended Up"],"우리 결국 (Inst.)":["We Ended Up (Inst.)"],"뭐야 우리 사이":["Situationship"],"뭐야 우리 사이 (Inst.)":["Situationship (Instrumental)"],"사랑한 만큼 아픈 거겠죠":["It hurts as much as I loved you"],"사랑한 만큼 아픈 거겠죠 (Inst.)":["It hurts as much as I loved you (Instrumental)"],"그리움이 밀려오는 이 밤":["Night like this"],"그리움이 밀려오는 이 밤 (Inst.)":["Night like this (Instrumental)"],"이런 게 사랑이라면":["Love like this"],"이런 게 사랑이라면 (Inst.)":["Love like this (Instrumental)"],"다시는 오지 않을 내 사람아":["My love who will never return"],"다시는 오지 않을 내 사람아 (Inst.)":["My love who will never return (Instrumental)"],"내가 아는 사랑은 다 너라서":["All I love is you"],"내가 아는 사랑은 다 너라서 (Inst.)":["All I love is you (Instrumental)"],"아무리 지워도 네가 서있어":["Can't erase you"],"아무리 지워도 네가 서있어 (Inst.)":["Can't erase you (Instrumental)"],"사랑한다 사랑해":["I Love You, I Love You"],"사랑한다 사랑해(inst.)":["I Love You, I Love You(inst.)"],"너무 예뻐서":["Because You're So Beautiful"],"너무 예뻐서(inst.)":["Because You're So Beautiful(inst.)"],"빛나는 우리의 한 페이지를":["Shining Page Of Our Story"],"빛나는 우리의 한 페이지를 (Inst.)":["Shining Page Of Our Story (inst.)"],"내 옆에 니가 좋아":["I Like You Beside Me"],"내 옆에 니가 좋아 (Inst.)":["I Like You Beside Me (inst.)"],"너로 가득한 날들":["The days filled with you"],"너로 가득한 날들 (Inst.)":["The days filled with you (Instrumental)"],"너와 함께 한 시간이 지나가고":["When the time with you passes by"],"너와 함께 한 시간이 지나가고 (Inst.)":["When the time with you passes by (Instrumental)"],"내 품에 돌아와 줘":["Come Back To My Arms"],"내 품에 돌아와 줘 (Inst.)":["Come Back To My Arms (inst.)"],"밤 하늘의 별도 너처럼 빛나진 않잖아":["Even The Stars Don't Shine Like You"],"밤 하늘의 별도 너처럼 빛나진 않잖아 (Inst.)":["Even The Stars Don't Shine Like You (inst.)"],"너 때문에 내 하루가":["Because of you"],"너 때문에 내 하루가 (Inst.)":["Because of you (Instrumental)"],"너 없는 하루가":["A Day Without you"],"너 없는 하루가 (Inst.)":["A Day Without you (Instrumental)"],"내 맘이 참 그래":["That's just how I feel"],"내 맘이 참 그래 (Inst.)":["That's just how I feel (Instrumental)"],"어차피 떠날 사람":["Leaving anyway"],"어차피 떠날 사람 (Inst.)":["Leaving anyway (Instrumental)"],"그대 안에 사는 나를":["I'm the one who lives in you"],"그대 안에 사는 나를 (Inst.)":["I'm the one who lives in you (inst.)"],"있잖아 나는":["You know what"],"있잖아 나는 (Inst.)":["You know what (Instrumental)"],"사실은 너무 보고싶어":["Actually, I miss you so much"],"사실은 너무 보고싶어 (inst.)":["Actually, I miss you so much (Instrumental)"],"비가 그칠락 말락":["The rain will stop"],"비가 그칠락 말락 (Inst.)":["The rain will stop (inst.)"],"사랑한 기억":["Memories of love"],"사랑한 기억 (inst.)":["Memories of love (Instrumental)"],"날 두고 가지 마":["Don't leave me"],"날 두고 가지 마 (inst.)":["Don't leave me (Instrumental)"],"아프잖아 너 때문에":["It hurts because of you"],"아프잖아 너 때문에 (Inst.)":["It hurts because of you (Inst.)"],"미워도 사랑해요":["I love you even if I hate you"],"미워도 사랑해요 (Inst.)":["I love you even if I hate you (inst.)"],"바라고 또 바래왔죠":["Hoping & hoping again"],"바라고 또 바래왔죠 (inst.)":["Hoping & hoping again (Instrumental)"],"많은 걸 놓쳐버린 우리처럼":["Like us who missed out on many things"],"많은 걸 놓쳐버린 우리처럼 (Inst.)":["Like us who missed out on many things (Inst.)"],"마지막 사랑":["The last love"],"마지막 사랑 (Inst.)":["The last love (Inst.)"],"그래도 이젠 보내줄래":["But I'll let you go now"],"그래도 이젠 보내줄래 (Inst.)":["But I'll let you go now (inst.)"],"모든 순간이 아무렇지 않은 날":["Every moment is a day where nothing is wrong"],"모든 순간이 아무렇지 않은 날 (Inst.)":["Every moment is a day where nothing is wrong (inst.)"],"이별하는 중":["Breaking up"],"이별하는 중 (inst.)":["Breaking up (Instrumental)"],"헤어지기 싫어서":["I Don’t Want To Break Up"],"헤어지기 싫어서 (Inst.)":["I don’t want to break up (Inst.)"],"기억하나요 everything":["Do You Remember Everything"],"기억하나요 everything (Inst.)":["Do you remember everything (Inst.)"],"미스티블루(Misty Blue)":["Misty Blue"],"미스티블루(Misty Blue) (Inst.)":["Misty Blue (Inst.)"],"사랑시 고백구 행복동":["The Loverville"],"사랑시 고백구 행복동 (Inst.)":["The Loverville (Inst.)"],"혼자왔어요":["Lonely Night"],"혼자왔어요 (Inst.)":["Lonely Night (Inst.)"],"가슴으로 운다":["Cry With My Heart"],"가슴으로 운다 (Inst.)":["Cry with my heart (Inst.)"],"모두 내 탓이죠":["It's All My Fault"],"모두 내 탓이죠 (Inst.)":["It's all my fault (Inst.)"],"차라리 너를 더 미워하는 게":["I'd Rather Hate You More"],"차라리 너를 더 미워하는 게 (Inst.)":["I'd rather hate you more (Inst.)"],"스며드나봐":["seep into you"],"스며드나봐 (Inst.)":["seep into you (Instrumental)"],"뚝 뚝 뚝":["Drip Drip Drip"],"뚝 뚝 뚝 (Inst.)":["Drip Drip Drip (Instrumental)"],"기억을 걷다보면":["As I Walk Down Memory Lane"],"기억을 걷다보면 (Inst.)":["As I Walk Down Memory Lane (Instrumental)"],"잘해주지 말지 그랬어":["Don't Treat Me Well"],"잘해주지 말지 그랬어 (Inst.)":["Don't Treat Me Well (Instrumental)"],"한번쯤은":["At Least Once"],"한번쯤은 (Inst.)":["At Least Once (Instrumental)"],"있을 때 잘 할걸":["I Should've Done Better"],"있을 때 잘 할걸 (Inst.)":["I Should've Done Better (Instrumental)"],"자꾸 좋아져 (Feat. _416)":["grow on me (feat. _416)"],"싸운날":["Fight Day"],"싸운날 (Inst.)":["Fight Day (Instrumental)"],"그대라면":["If It's You"],"그대라면 (Inst.)":["If It's You (Instrumental)"],"이젠 잊기로 해요":["Let's Forget It (From “Reply 1988, Pt. 10”) [Original Television Soundtrack]"]},
  "여자친구":{"교차로 (Crossroads)":["Crossroads"],"앞면의 뒷면의 뒷면":["Wheel of the Year"],"눈의 시간":["Time of the Snow"],"거울의 방":["Room of Mirrors"],"북쪽 계단":["Crème Brûlée"],"지금 만나러 갑니다 (Eclipse)":["Eclipse"],"여름여름해 (Sunny Summer)":["Sunny Summer"],"바람의 노래 (Hear The Wind Sing)":["Hear the Wind Sing"],"비행운 : 飛行雲 (Contrail)":["Contrail"],"나의 지구를 지켜줘 (Please Save My Earth)":["Please Save My Earth"],"봄비 (Rain In The Spring Time)":["Rain In the Spring Time"],"핑 (Crush)":["Crush"],"우리의 다정한 계절 속에 (Season of Memories)":["Season of Memories"],"짠 (ZZAN)":["Cheers (ZZAN)"],"짠 (ZZAN) (Inst.)":["Cheers (ZZAN) [Instrumental]"],"귀를 기울이면 (LOVE WHISPER)":["Love Whisper"],"여름비 (SUMMER RAIN)":["Summer Rain"],"두 손을 모아 (AVE MARIA)":["Ave Maria"],"이분의 일 1/2 (ONE-HALF)":["One-Half"],"빨간우산 (RED UMBRELLA)":["Red Umbrella"],"그루잠 (FALLING ASLEEP AGAIN)":["Falling Asleep Again"],"여름비 (SUMMER RAIN) (Inst.)":["Summer Rain (Instrumental)"]},
  "여진":{"반,짝 (Two Halves)":["Two Halves"]},
  "연준":{"조금 서툴러도 다시 (Baby Wassup?)":["Baby Wassup?"]},
  "연호":{"네 편이 돼줄게":["By Your Side"],"네 편이 돼줄게 (Inst.)":["By Your Side (Instrumental)"]},
  "영재":{"도망치는 건 부끄럽지만":["Escape to Me"],"이상 기온":["Summer Happening"],"자꾸 네가":["Thinking Of You"],"친한 친구 (Feat. 코코) (Full Ver.)":["Best Friend (feat.COCO) [Full Ver.]"],"같이 걸어가줘요":["Walk With Me"],"태양이 지면 널 만나러 갈게":["Meet Me When The Sun Goes Down (From \"Midnight Sun\" Original Musical Soundtrack, Pt. 1)"]},
  "영파씨":{"GO해":["GO AHEAD"],"GO해 (Inst.)":["GO AHEAD (Inst.)"],"화약 (Umbrella)":["Umbrella"],"나의 이름은 (ROTY)":["ROTY"],"ㄱㅓ리에서…(Street Carol...)(With 존박)":["Street Carol…(With John Park)"]},
  "예리":{"스물에게 (Dear Diary)":["Dear Diary"],"스물에게 (Dear Diary) (Inst.)":["Dear Diary (Instrumental)"]},
  "예린":{"조각별 (Shooting Star) (Prod. PATEKO (파테코))":["Shooting Star"],"춘곤 (春困) (Prod. PATEKO (파테코))":["Spring Glow"],"조각별 (Shooting Star) (Inst.)":["Shooting Star (Instrumental)"],"너무 예뻐":["So Pretty"],"너무 예뻐 (inst.)":["So Pretty (inst.)"],"이것저것 재지 말고 솔직해볼까":["To Be Honest"],"이것저것 재지 말고 솔직해볼까 (Inst.)":["To Be Honest (Instrumental)"],"볕뉘 (SHINE)":["SHINE"],"밤밤밤 (Bambambam)":["Bambambam"],"루프탑 (Summer Charm)":["Summer Charm"],"밤밤밤 (Bambambam) (inst.)":["Bambambam (Instrumental)"],"시간 (Time)":["Time"]},
  "예성":{"어떤날은 (MONOLOGUE)":["MONOLOGUE"],"어떤날은 (MONOLOGUE) (inst.)":["MONOLOGUE (Instrumental)"],"굶지 말기 (Eat’s OK)":["Eat’s OK"],"그냥 오면 돼 (Every day, Wait for us)":["Every day, Wait for us"],"평행선 (Parallel Lines)":["Parallel Lines"],"외워둘게 (I’ll remember)":["I’ll remember"],"우연을 모아 (Wish)":["Wish"],"혼자 하는 일 (On My Own)":["On My Own"],"혼자 하는 일 (On My Own) (Inst.)":["On My Own (Instrumental)"],"봄날의 소나기 (Paper Umbrella)":["Paper Umbrella"],"겨울잠 (Hibernation)":["Hibernation"],"그대뿐인지 (All But You)":["All But You"],"비눗방울 (So Close Yet So Far)":["So Close Yet So Far"],"문 열어봐 (Here I am)":["Here I am"],"벚꽃잎(Spring in me) (Duet. 달총 of CHEEZE)":["Spring in me (with Dalchong)"],"우리 (We)":["We"],"메아리 (Your echo)":["Your echo"],"어떤 말로도 (Confession) (Feat. 찬열 of EXO)":["Confession (feat. CHANYEOL)"],"달의 노래 (My Dear)":["My Dear"],"먹지":["Gray Paper"],"먹지 (Inst.)":["Gray Paper (Instrumental)"],"사랑에 멀어서":["Blind with love"],"사랑에 멀어서 (Inst.)":["Blind with love (inst) [instrumental]"]},
  "예지":{"아카시아(ACACIA)":["ACACIA"],"아카시아(ACACIA) (Inst.)":["ACACIA (instrumental)"],"미묘(迷猫)":["MIMEW"],"미묘(迷猫) (inst.)":["MIMEW (instrumental)"],"아낙수나문 (Anck Su Namum)":["Anck Su Namum"],"아낙수나문 (Anck Su Namum) (Inst.)":["Anck Su Namum (Instrumental)"]},
  "오마이걸":{"비밀정원":["Secret Garden"],"다섯 번째 계절 (SSFWL)":["The Fifth Season (SSFWL)"],"일기예보":["Weather Diary"],"일기예보 (Inst.)":["Weather Diary (Instrumental)"],"내 Type":["Queen B"],"미라클":["Miracle"],"미라클 (Miracle)":["Miracle"],"나의 인형":["My Doll"],"초대장":["Who Comes Who Knows"],"보글보글":["BOGGLE BOGGLE"],"보글보글 (Inst.)":["BOGGLE BOGGLE (Instrumental)"],"바라밤":["Bara Bam"],"바라밤 (Inst.)":["Bara Bam (Instrumental)"],"살짝 설렜어 (Nonstop)":["Nonstop"],"꽃차":["Flower Tea"],"기억해":["Remember"],"기억해 (Inst.)":["Remember (Instrumental)"],"소나기":["Shower"],"미제 (Case No.L5VE)":["Case No.L5VE"],"유성 (Gravity)":["Gravity"],"심해 (마음이라는 바다)":["Underwater Love"],"불꽃놀이 (Remember Me)":["Remember Me"],"메아리":["Echo"],"우리 이야기":["Our Story"],"너의 귓가에 안녕":["Hello Love"],"너의 귓가에 안녕 (Inst.)":["Hello Love (Instrumental)"],"내 얘길 들어봐 (A-ing) (Feat. 스컬&하하)":["Listen to my word (A-ing) [feat. Skull & HaHa]"],"한여름의 크리스마스":["Midsummer night's Christmas"],"거짓말도 보여요":["Lies you can see"],"한 발짝 두 발짝":["STEP BY STEP"],"궁금한걸요":["CURIOUS"]},
  "오메가엑스":{"너를 다시":["You, Again"],"쉬어가도 돼":["Comfort"],"너를 다시 (Eng Ver.)":["You, again (Eng. Version)"],"쉬어가도 돼 (Eng Ver.)":["Comfort (Eng. Version)"],"전화해요 (PLEASE)":["Please"],"얼음땡(ICETAG)":["Icetag"]},
  "오원빈":{"사랑해 또 사랑해 (Feat. 미료)":["I Love You and Love You (feat. Miryo)"],"사랑해 또 사랑해 (Inst.)":["I Love You and Love You (inst.)"]},
  "오종혁":{"사랑이 그래요 2024 (with 이홍기)":["Love is like that 2024 (with Lee Hong Gi)"],"사랑이 그래요 2024 (Inst.)":["Love is like that 2024 (Instrumental) [with Lee Hong Gi]"],"시간은...":["Time Is…"],"가슴이 뛰잖아":["Heart Is Beating"],"가슴이 뛰잖아 (Inst.)":["Heart Is Beating (Instrumental)"],"사랑한다면서":["You said you love me"],"그리워도":["Even if I miss you"],"어느덧 일주일":["It's already been a week"],"바보처럼":["like a fool"],"사랑한다면서 (Inst.)":["You said you love me (Instrumental)"],"그리워도 (Inst.)":["Even if I miss you (Instrumental)"],"그댄 어떻게든":["You can't help it"],"솔직하고 싶지만":["I want to be honest"],"사랑이 그래요":["Love is like that"],"오늘까지만 (Feat. 오소연)":["Until today (Feat. Oh So-yeon)"]},
  "오하영":{"커플":["couple"],"커플 (Inst.)":["couple (Instrumental)"]},
  "온리원오프":{"sage/구원":["Sage"],"너-정류장-나 (heartbreak terminal)":["Heartbreak Terminal"],"탄생화 (Prod. 서사무엘)":["blOOm"],"얼음과 불의 노래 (Prod. GroovyRoom)":["A sOng of ice&fire"],"너-거짓말-나 (Prod. Cha Cha Malone)":["Heartbreak Theatre"]},
  "온앤오프":{"여름 빛 (Summer Light)":["Summer Light"],"여름 빛 (Summer Light) (Inst.)":["Summer Light (Inst.)"],"바람이 분다 (Love Effect)":["Love Effect"],"바람이 부는 이유 (Wind Effect)":["Wind Effect"],"스물네 번 (86400) (Remastered ver.)":["86400 (2022 Remastered Version)"],"사랑하게 될 거야 (We Must Love) (Remastered ver.)":["We Must Love (2022 Remastered Version)"],"여름 쏙 (Popping)":["Popping"],"여름 시 (Summer Poem)":["Summer Poem"],"여름의 모양 (Summer Shape)":["Summer Shape"],"여름의 온도 (Dry Ice)":["Dry Ice"],"여름의 끝 (Summer End)":["Summer End"],"춤춰 (Ugly Dance)":["Ugly Dance"],"온도차 (Thermometer) (ON Team Ver.)":["Thermometer"],"비밀 (Secret Triangle) (OFF Team Ver.)":["Secret Triangle"],"누워서 세계 속으로 (Trip Advisor)":["Trip Advisor"],"이별 노래가 아니야 (Not a sad song)":["Not a Sad Song"],"이별 노래가 아니야 (Not a sad song) (Inst.)":["Not a Sad Song (Instrumental)"],"스쿰빗스위밍 (Sukhumvit Swimming)":["Sukhumvit Swimming"],"첫 키스의 법칙 (Belle Epoque)":["Belle Epoque"],"제페토 (Geppetto)":["Geppetto"],"오늘 뭐 할래 (Good Good)":["Good Good"],"선인장 (Cactus)":["Cactus"],"신세계 (SPIN OFF Ver.)":["New World (SPIN OFF Version)"],"예뻐죽겠다":["Pretty"],"예뻐죽겠다 (Inst.)":["Pretty (Instrumental)"],"사랑하게 될 거야 (We Must Love)":["We Must Love"],"별일 아냐 (Yayaya)":["Yayaya"],"첫 사랑의 법칙 (Happily never after)":["Happily never after"],"축제 (Your Day)":["Your Day"],"축제 (Your Day) (Inst.)":["Your Day (Instrumental)"],"아침 (Good Morning)":["Good Morning"],"나 말고 다 (Incomplete)":["Incomplete"],"스물네 번 (86400)":["86400"]},
  "온유":{"오래 OKㅋ":["Oreo Cake"],"에필로그":["Epilogue"],"소년":["Boy"],"번져 (gradation)":["Gradation"],"만세":["Yay"],"아름다운 너에게":["For You"],"아름다운 너에게 (Inst.)":["For You (Instrumental)"],"매력 (beat drum)":["Beat Drum"],"마에스트로":["MAESTRO"],"월화수목금토일":["All Day"],"12월 32일":["Songstealer - December 32 days"],"마음주의보":["Mind Warning"],"마음주의보 (Inst.)":["Mind Warning (Inst.)"],"다정한 봄에게":["Dear my spring"],"다정한 봄에게 (Inst.)":["Dear my spring (Inst.)"],"다정한 봄에게 (Piano Ver.)":["Dear my spring (Piano Version)"],"태양이 지면 널 만나러 갈게":["Meet Me When The Sun Goes Down (From \"Midnight Sun\" Original Musical Soundtrack, Pt. 4)"],"거리마다 (Your Scent)":["Your Scent"],"동네 (Under The Starlight)":["Under The Starlight"],"어떤 사이 (Sign)":["Sign"],"사랑이었을까 (Illusion)":["Illusion"],"온유하게 해요 (Shine On You)":["Shine On You"],"또각또각 (Timepiece)":["Timepiece"]},
  "올데이프로젝트":{"NO 한도":["NO LIMIT"]},
  "올아워즈":{"미쳤으니까 (YOUMIN, XAYDEN, MASAMI, HYUNBIN)":["Cause I'm Insane (YOUMIN, XAYDEN, MASAMI, HYUNBIN)"],"나의 봄, 나의 빛, 나의 숨":["My Spring, My Light, My Breath"],"도깨비(SHOCK)":["SHOCK"],"으랏차차(GOTCHA)":["GOTCHA"],"헤엄":["Slow Motion"]},
  "옹성우":{"왜 몰랐었을까":["Late Regret"],"왜 몰랐었을까 (Inst.)":["Late Regret (Inst.)"],"너를 위한 카페 (Café)":["Cafe"],"또, 다시 나를 마주한 채 (After Dark)":["After Dark"],"우리가 만난 이야기":["Our Story"],"우리가 만난 이야기 (Inst.)":["Our Story (Instrumental)"]},
  "용훈":{"이음선(TIMELORD) (Narr. 온달)":["TIMELORD (Narr. Ondal)"],"이음선(TIMELORD) (Clean Ver.)":["TIMELORD"],"이음선(TIMELORD) (Inst.)":["TIMELORD (Instrumental)"]},
  "우기":{"아프다":["Gone (Korean ver.)"],"내일이 찾아오면 (Acoustic ver.) (“강매강”/OST Part.2)":["When Tomorrow Comes (Acoustic ver.)"],"내일이 찾아오면 (Acoustic ver.) (Inst.) (“강매강”/OST Part.2)":["When Tomorrow Comes (Acoustic ver.) (Inst.)"],"연극":["Bad Liar"],"연극 (Inst.)":["Bad Liar (Instrumental)"]},
  "우빈":{"나":["Begin Again Open MIC EPISODE. 42 - Rudderless"],"그대로 있어주기를":["hope you stay"],"그대로 있어주기를 (Inst.)":["hope you stay (Instrumental)"]},
  "우아":{"내가 다 해보고 말해줄게":["I'll Tell You"],"소녀…소년을 만나다":["Girls love boys"],"단거(Danger)":["Danger"],"별 따러 가자":["Catch the Stars"],"하염없이 너만 (Vocal. 민서 (MINSEO))":["Endlessly you (feat. MINSEO)"],"하염없이 너만 (Inst.)":["Endlessly you (Instrumental)"],"비밀의 공주 (시크릿쥬쥬 x WOOAH (우아))":["Secret princess (Secret Jouju x WOOAH)"],"비밀의 공주 (시크릿쥬쥬 x WOOAH (우아)) (Inst.)":["Secret princess (Secret Jouju x WOOAH) [Instrumental]"],"겁쟁이":["Scaredy Cat"],"빙빙빙 (Round & Round)":["Round & Round"],"우아! (woo!ah!)":["Woo!Ah!"]},
  "우연":{"찾았다":["I'll Find You"],"찾았다 (Inst.)":["I'll Find You (Inst.)"]},
  "우주소녀":{"너에게 닿기를 (I Wish)":["I Wish"],"너에게 닿기를 (Chinese Ver.)":["For the Summer (New Ver.)"],"너의 세계로 (Let Me In)":["Let Me In"],"기적 같은 아이 (Miracle)":["Miracle"],"퐁당퐁당 (Plop Plop)":["Plop Plop"],"지금 만나러 가요 (Closer to you)":["Closer to You"]},
  "우즈":{"행진곡":["March"],"행진곡 (Inst.)":["March (Instrumental)"],"비하인드":["BEHIND"],"심연":["ABYSS"],"난 너 없이 (I hate you)":["I hate you"],"안녕이란 말도 함께 (Hope to be like you)":["Hope to be like you"],"해가 될까":["SUN OR SUCK"],"해가 될까 (Inst.)":["SUN OR SUCK (Instrumental)"],"방아쇠 (Trigger)":["Trigger"],"내 맘대로 (On my own)":["On my own"],"파랗게":["Love Me Harder"],"주마등":["memories"],"아무의미":["Meaningless"]},
  "우지":{"어떤 미래":["What kind of future"]},
  "우희":{"서울의 별":["Star of Seoul"],"달":["Moon"],"달 (Inst.)":["Moon (Inst.)"],"내일로":["Tomorrow"],"내일로 (Inst.)":["Tomorrow (Instrumental)"]},
  "워너원":{"약속해요":["I Promise You (I.P.U.)"],"봄바람":["Spring Breeze"],"다시, 봄바람":["Spring Breeze, Again"],"다시, 봄바람 (Inst.)":["Spring Breeze, Again (Instrumental)"],"켜줘 (Light)":["Light"],"캥거루 (Kangaroo) (Prod. ZICO)":["Kangaroo (Prod. ZICO)"],"영원+1 (Prod. NELL)":["Forever and a Day (Prod. NELL)"],"모래시계 (Prod. 헤이즈)":["Sandglass (Prod. Heize)"],"보여":["Day By Day"],"너의 이름을":["I'll Remember"]},
  "원더걸스":{"그려줘":["DRAW ME"],"아름다운 그대에게":["Beautiful Boy"],"이바보":["This Fool"],"뭐 어때":["So What (feat. David Kim)"],"가져가":["Take It"],"미안한 마음":["It's Not Love"]},
  "원더나인":{"세어봐":["Count"],"세어봐 (inst.)":["Count (Instrumental)"],"속삭여(Blah)":["Blah"],"춰":["Move"],"널":["U"],"있을게":["Stay"],"속삭여(Blah) (Inst.)":["Blah (Instrumental)"],"우리들의 이야기":["The Story"]},
  "원어스":{"눈을 돌리지마 (Say Yes!)":["Say Yes!"],"우연히 너를 만나도 (By chance)":["By chance"],"끝나지 않을 우리 이야기 (Never Ending Us)":["Never Ending Us"],"바람을 타고 날아간 곳에 네가 있을까 (Fly to you)":["Fly to you"],"루퍼트의 눈물 (Rupert's drop)":["Rupert's drop"],"발키리 (Valkyrie) (Penta Ver.)":["Valkyrie (Penta Ver.)"],"태양이 떨어진다 (Twilight) (Penta Ver.)":["Twilight (Penta Ver.)"],"가자 (LIT) (Penta Ver.)":["LIT (Penta Ver.)"],"쉽게 쓰여진 노래 (A Song Written Easily) (Penta Ver.)":["A Song Written Easily (Penta Ver.)"],"뿌셔 (BBUSYEO) (Penta Ver.)":["BBUSYEO (Penta Ver.)"],"반박불가 (No diggity) (Penta Ver.)":["No diggity (Penta Ver.)"],"월하미인 (月下美人 : LUNA) (Penta Ver.)":["LUNA (Penta Ver.)"],"덤벼 (Bring it on) (Penta Ver.)":["Bring it on (Penta Ver.)"],"루퍼트의 눈물 (Rupert's drop) (Inst.)":["Rupert's drop (Instrumental)"],"미리보기 (Epilogue)":["Epilogue"],"잇다 있다 잊었다 (Unforgettable)":["Unforgettable"],"반짝임 그 찰나의 널 (Halley's Comet)":["Halley's Comet"],"월하미인 (月下美人 : LUNA)":["LUNA"],"사랑의 결말은 모 아니면 도 (Yes Or No)":["Yes Or No"],"헤엄쳐 (We're in Love)":["We're in Love"]},
  "원우":{"봄, 여름, 가을, 겨울":["Spring, Summer, Fall, Winter (Korean Ver.)"],"고개":["GOGAE"]},
  "원위":{"우리들은 행방불명 (Neverland)":["Neverland"],"우리들은 행방불명 (Neverland) (Inst.)":["Neverland (Inst.)"],"좌표 (Coordinates)":["Coordinates"],"나침반 (Compass)":["Compass"],"행운의 달 (Lucky 12)":["Lucky 12"],"미로 (MAZE)":["MAZE"],"미확인 비행체 (UFO)":["UFO"],"숨바꼭질 (Hide & Seek)":["Hide & Seek"],"흔적 (Trace)":["Trace"],"너와 나, 그리고... (彫刻 : Diary)":["Diary"],"비바람을 건너 (Beyond the Storm)":["Beyond the Storm"],"별 헤는 밤 (The Starry Night)":["The Starry Night"],"악당은 영웅의 변신을 기다려준다 (EVILDOER)":["EVILDOER"],"일방통행 (一方通行 : Traffic Love)":["Traffic Love"],"우연의 일치 (Coincidence)":["Coincidence"],"순애 (純愛 : Endless)":["Endless"],"오래된 음악가의 추억 (Rise Again)":["Rise Again"],"청천을 (靑天乙 : Dreamcatcher)":["Dreamcatcher"],"눈이 부시게 (All the things I love)":["All the things I love"],"사라지지 않는 기억이 있다면 (Indelible)":["Indelible"],"검은 별 (Sole Star)":["Sole Star"],"추억의 소각장":["Beautiful Ashes"],"한여름 밤 유성우":["Meteor Shower"],"별 세는 너":["Count The Stars"],"다시 만나서 반가워":["Pleasant"],"동서남북 (Omnipresent)":["Omnipresent"],"동서남북 (Omnipresent) (Inst.)":["Omnipresent (Instrumental)"],"너의 우주는 (Universe_)":["Universe_"],"우물 속 작은 아이 (Envision_)":["Envision_"],"꿈속에서 놓친 너, 옅은 잠결에 흐르길 (Montage_)":["Montage_"],"시발점 (Trigger_)":["Trigger_"],"궤도 (Orbit_)":["Orbit_"],"선물할게요 (From_)":["From_"],"Intro : 우주선 (Intro : Spaceship)":["Intro : Spaceship"],"비를 몰고 오는 소년 (Rain To Be)":["Rain To Be"],"로보트도 인간에게 감정을 느낀다 (A.I.)":["A.I."],"베로니카의 섬 (Veronica)":["Veronica"],"천체 (COSMOS)":["COSMOS"],"기억 속 한 권의 책 (A book in Memory)":["A Book in Memory"],"기억 세탁소 (Eraser)":["Eraser"],"기억 속 한 권의 책 (A book in Memory) (Inst.)":["A Book in Memory (Instrumental)"],"미쳤다 미쳤어 (Crazy good)":["Crazy Good"],"내가 처음 만져본 강아지 (Love me)":["Love me"],"모르겠다고 (Q) (Feat. 화사)":["Q (feat. Hwa Sa)"],"공과 사 (0&4)":["0&4"],"귀걸이가 나를 때리게 (Ring on my Ears)":["Ring on my Ears"],"다 추억 (Reminisce about All)":["Reminisce about All"],"귀걸이가 나를 때리게 (Ring on my Ears) (Remix)":["Ring On My Ears (Remix)"],"나의 계절 봄은 끝났다 (End of Spring) (Rock ver.)":["End Of Spring (Rock version)"],"피크요정 (Tinker Bell)":["Tinker Bell"],"동화 (Fairy Tale)":["Fairy Tale"],"소인국 (Lilliput)":["Lilliput"],"피투성이 피노키오 (Pinocchio)":["Pinocchio"],"아름다운 날이야 (Beautiful Runaway)":["Beautiful Runaway"],"바로 너야 (Just You)":["Just You"],"흘러간 시간에 그대로 멈춰 있지 않기를 (Beyond the Night)":["Beyond the Night"],"다음에 계속 (The End.)":["The End."],"크리스마스는 이래야지 (WE X MAS)":["WE X MAS"],"그녀는 대체":["About Her"],"그녀는 대체 (Inst.)":["About Her (Instrumental)"]},
  "원팩트":{"내가 아니더라도 (TAG Solo)":["someone else (TAG Solo Version)"],"몇번의 하루":["wait!"],"고백":["Confession"],"걷다보면":["Reach you"],"다음 생":["Next life"],"꺼져":["FXX OFF"],"마침표":["PERIOD"],"기다려왔어 널 (Until now KR ver.)":["Until now (Korean Version)"],"멋진 거":["Hot Stuff"],"좋겠다":["Must Be Nice"],"진행중":["Loading"]},
  "원필":{"사랑병동":["Highs and Lows"],"어른이 되어 버렸다":["Already Grown Up"],"백만송이는 아니지만":["Hold My Love"],"피아노":["Piano"],"시간의 잔상":["After"],"시간의 잔상 (Inst.)":["After (Inst.)"],"예뻤어":["Begin Again Open MIC EPISODE. ​​30 - You Were Beautiful"],"안녕, 잘 가":["Voiceless"],"지우게":["Sincerity"],"소설 속의 작가가 되어":["A writer in a love story"],"우리 더 걸을까":["Walk with me"],"외딴섬의 외톨이":["Stranded"],"언젠가 봄은 찾아올 거야":["Someday, spring will come"],"휴지조각":["Pieces"],"늦은 끝":["Last goodbye"],"그리다 보면":["Unpainted canvas"],"행운을 빌어 줘":["A journey"],"태양이 지면 널 만나러 갈게":["Meet Me When The Sun Goes Down (From \"Midnight Sun\" Original Musical Soundtrack, Pt. 2)"]},
  "원호":{"Intro : 시간과 잡화점의 무늬 (Seasons and Patterns)":["Intro : Seasons and Patterns"]},
  "원희":{"그대 눈이 내게 말해요":["The Look In Your Eyes"],"그대 눈이 내게 말해요 (Inst.)":["The Look In Your Eyes (Inst.)"]},
  "웬디":{"그마저도 사랑이라":["Even That Is Love"],"그마저도 사랑이라 (Inst.)":["Even That Is Love (Inst.)"],"한마디면 돼요":["Say You Love Me"],"한마디면 돼요 (inst.)":["Say You Love Me (inst.)"],"공항로 (Prod. 검정치마)":["Airport Goodbyes"],"나를 신경 쓰고 있는 건가":["If I Could Read Your Mind"],"나를 신경 쓰고 있는 건가 (Inst.)":["If I Could Read Your Mind (Instrumental)"],"두 글자":["Two Words"],"두 글자 (Inst.)":["Two Words (Instrumental)"],"슬픔 속에 그댈 지워야만 해 (Because I Love You)":["Because I Love You (From \"Mimi\")"]},
  "위너":{"공허해":["Empty"],"빼입어 (DRESS UP)":["DRESS UP"],"바람 (WIND) (YOON SOLO)":["WIND"],"끄덕끄덕 (DON’T BE SHY)":["DON'T BE SHY"],"여보세요":["HELLO"],"손만 잡고 자자":["TURN OFF THE LIGHT (MINO SOLO)"],"애 걔":["FOR"],"예뻤더라":["WE WERE"],"사치":["LUXURY"],"센치해 (SENTIMENTAL)":["SENTIMENTAL"],"철없어 (IMMATURE)":["IMMATURE"],"좋더라 (I'M YOUNG)":["I'M YOUNG"],"사랑가시 (PRICKED)":["PRICKED"],"컬러링":["Color Ring"],"끼부리지마":["Don't Flirt"],"걔 세":["I'm Him"],"척":["Love Is a Lie"],"고백하는 거야":["Confession"],"사랑하지마":["But"],"이 밤":["Tonight"]},
  "위아이":{"겁이나":["WITHOUT U"],"질주(OVERDRIVE)":["OVERDRIVE"],"너의 행성 (All Day With You)":["All Day With You"],"하루 끝에 (End of The Day)":["End of The Day"],"우산":["Umbrella"],"꽃다발 (Bouquet)":["Bouquet"],"16번째 별":["RUi"],"모 아님 도 (Prod. 장대현)":["All or Nothing"],"겨울, 꽃":["Winter, Flower"],"꼬리별 (TIMELESS)":["TIMELESS"],"안고 싶어 (Hug You)":["Hug You"],"도화선 (Fuze) (Prod.by 장대현)":["Fuze"],"반 고흐의 밤 (Starry Night) (prod. dress)":["Starry Night"]},
  "위클리":{"텐션업":["7days Tension"],"텐션업 (Inst.)":["7days Tension (Instrumental)"],"나비 동화":["Butterfly"],"언니":["Unnie"],"몰래몰래":["Top Secret"],"월화수목금토일":["Weeekly"],"붐 치키(BOOM CHI KI)":["Boom Chi Ki"],"붐 치키(BOOM CHI KI) (Inst.)":["Boom Chi Ki (Instrumental)"]},
  "위키미키":{"우리 둘 사이에":["Between Us Two"],"우리 둘 사이에 (Inst.)":["Between Us Two (Instrumental)"],"산막이옛길을 달리는 소녀":["The Girls Running on the SANMAGIYET-GIL"],"자꾸만 (Sung by 최유정, 김도연)":["Again and Again (Sung by Choi YooJung, Kim DoYeon)"],"자꾸만 (Inst.)":["Again and Again (Inst.)"],"우리라는 이유 (Just Us)":["Just Us"],"너 하고 싶은 거 다 해 (너.하.다)":["Whatever U Want"],"좋아한다 안 한다 (꽃잎점)":["Petal Fortune"],"너란 사람 (iTeen Girls Special)":["iTeen Girls Special"]},
  "유겸":{"딱풀 (Feat. Hoody)":["Glue stick (feat. Hoody)"],"빛이나 (Feat. SUMIN)":["SHINE (feat. SUMIN)"],"1분만":["1 MINUTE"],"나의 그녀는":["SHE"],"허리를 감싸고":["Take It Slow"],"우야야야":["WOOYAYAYA"],"불빛":["Lights"],"네 잘못이야 (Feat. GRAY)":["All Your Fault (feat. GRAY)"]},
  "유나이트":{"널 좋아해":["I LIKE YOU"],"그런 느낌이 와":["I GOT THE FEELING"],"평행선":["PARALLEL"],"너의 향기는 나를 깨우니까 (Perfume)":["Perfume"],"정했어 (Love it)":["Love it"],"너라는 별":["A star called you"]},
  "유니스":{"하늘땅 별땅":["Sky Land, Star Land"],"하늘땅 별땅 (Inst.)":["Sky Land, Star Land (Inst.)"],"꿈에서 또 만나":["See you in my dream"],"'뭐해?'라는 씨앗에서":["From a seed called 'Hey, what's up?'"],"땡! (DDANG!)":["DDANG!"],"봄비":["Spring rain"],"너만 몰라":["Curious"],"꿈의 소녀(Dream of girls)(UNIS Ver.)":["Dream of girls (UNIS Ver.)"],"백일몽":["Daydream"],"백일몽 (Inst.)":["Daydream (Instrumental)"]},
  "유니티":{"난말야":["I mean"],"끝을 아는 시작":["Begin with the end"],"난말야 (Inst.)":["I mean (Instrumental)"],"넘어 (No More)":["No More"],"추억시계":["A Memory Clock"],"별아":["Star"],"넘어 (No More) (Inst.)":["No More (Instrumental)"],"추억시계 (Inst.)":["A Memory Clock (Instrumental)"]},
  "유리":{"빠져가 (Into You)":["Into You"],"꿈 (Illusion)":["Illusion"]},
  "유빈":{"웃어주기로 해":["Make a Smile For Me"],"웃어주기로 해 (Inst.)":["Make a Smile For Me (Instrumental)"],"온통 이 세상은 너로 돼 있어":["All about you (SOMETOON Original Soundtrack)"],"향수(PERFUME)":["Perfume"],"넵넵 (ME TIME)":["Yaya (Me Time)"],"무성영화 (feat. 윤미래)":["Silent Movie (feat. Yoon Mirae)"],"보내줄게":["Let You Go"],"숙녀 (淑女)":["都市女子"]},
  "유아":{"모두 다 반할 걸?":["Falling for me"],"숲의 아이 (Bon voyage)":["Bon voyage"],"날 찾아서 (Far)":["Far"],"자각몽 (Abracadabra)":["Abracadabra"]},
  "유앤비":{"믿어줘 (Rebooting)":["Rebooting"]},
  "유주":{"라라라":["Lalala"],"라라라 (inst.)":["Lalala (inst.)"],"그 뒤가 얼마나 무서울지 모른 채":["What comes after"],"미제":["Nameless"],"추신":["P.S."],"첫사랑은 저주다":["First Love Is a Curse"],"오리온자리":["Orion"],"그날의 사건 (Feat. 정세운)":["Sequence (feat. JEONG SEWOON)"],"구름에 걸린 노을처럼":["Sunset"],"단잠":["Rest In You"],"단잠 (Inst.)":["Rest In You (Instrumental)"],"우연히 봄":["Spring Is Gone by chance"],"우연히 봄 (Inst.)":["Spring Is Gone by chance (Instrumental)"],"온 세상이 나에게":["My Whole World Is You"],"온 세상이 나에게 (Inst.)":["My Whole World Is You (Instrumental)"],"따라랏 (DALALA)":["DALALA"],"꿈 (Dreaming)":["Dreaming"],"복숭아꽃 (Feat. sokodomo)":["Peach Blossom (feat. sokodomo)"],"이브닝 (Feat. BIG Naughty)":["Evening (feat. BIG Naughty)"],"이브닝 (Feat. BIG Naughty) (Inst.)":["Evening (Instrumental)"],"아메리카노 같아 넌":["My Americano"],"아메리카노 같아 넌 (Inst.)":["My Americano (Instrumental)"],"놀이(Play)":["Play"],"겨우, 겨울 (Feat. 매드클라운)":["Cold Winter (feat. Mad Clown)"],"데킬라(The Killa)":["The Killa"],"너의 곁으로":["By Your Side"],"너의 곁으로 (Inst.)":["By Your Side (instrumental)"],"남아있어 (Prod. by 진영)":["Stay"],"남아있어 (Prod. by 진영) (Inst.)":["Stay (Instrumental)"],"위로 (String Ver.)":["Comfort (String Ver)"],"위로":["Comfort"],"위로 (String Ver.) (Inst.)":["Comfort (String Ver.) [Instrumental]"],"위로 (Inst.)":["Comfort (Instrumental)"],"이 노래만":["Just This Song"],"이 노래만 (Inst.)":["Just This Song (Instrumental)"]},
  "유키스":{"놀이터":["Playground"],"만만하니":["Am I too easy?"],"만만하니 (Inst.)":["Am I too easy? (Instrumental)"]},
  "유태양":{"안아줘 (Hug Me)":["Hug Me"]},
  "유회승":{"도망가자 (Run With Me)":["Run With Me"],"그대 눈이 내게 말해요":["The Look In Your Eyes"],"그대 눈이 내게 말해요 (Inst.)":["The Look In Your Eyes (Inst.)"],"미워하다, 그리워하고":["Hate and Miss you"],"미워하다, 그리워하고 (inst.)":["Hate and Miss you (inst.)"],"그랬나봐":["I Think I Did"],"그랬나봐 (Inst.)":["I Think I Did (Instrumental)"],"형 (兄)":["Brother (from \"[THE SEASONS VolⅡ. 7] <AKMU's Long day Long night> ReːWake x You Hwe Seung\")"],"오빠는...":["Older Brother"],"오빠는... (Inst.)":["Older Brother (Instrumental)"],"사랑했었다 (Still love you)":["Still love you"],"사랑했었다 (Still love you) (Inst.)":["Still love you (Inst.)"],"기대":["Expectation"]},
  "윤산하":{"여우별":["Yeowoobyul"]},
  "윤채원":{"아메리카노 한잔에 빗소리":["Americano on a rainy day"],"아메리카노 한잔에 빗소리 (Inst.)":["Americano on a rainy day (Instrumental)"]},
  "윤호":{"널 만나러 가":["On My Way to You"],"널 만나러 가 (Inst.)":["On My Way to You (Instrumental)"]},
  "은정":{"두근두근 때론 콩닥콩닥":["Throbbing, sometimes beating (from Apple of My Eye, Original Television Soundtrack, Pt. 1)"],"혼자가 편해졌어 (Feat. 케이윌)":["I'm good (feat. K.Will)"],"눈물비":["Tears Drop"],"혼자가 편해졌어 (Solo Ver.)":["I'm good (Solo Version)"],"혼자가 편해졌어 (Inst.)":["I'm good (Instrumental)"],"혼자가 편해졌어 (Feat. 케이윌) (Bonus Track)":["I'm good (Bonus Track Version) [feat. K.Will]"]},
  "은지원":{"불나방 (I’M ON FIRE) (Feat. Blue.D)":["I’M ON FIRE (feat. Blue.D)"],"쓰레기 (WORTHLESS)":["Worthless"],"비틀비틀 (TIPSY)":["Tipsy"],"비슷비슷해 (SAME)":["Same"],"술김에...":["Drunken"],"술김에... (Inst.)":["Drunken (Instrumental)"],"설레임":["Flutter"],"싸이렌 (Siren) (Feat. 미스터타이푼)":["Siren (feat. Mr. Tyfoon)"],"처음처럼만":["I Am the First"],"올빼미 (All Famy)":["All Famy"]},
  "은하":{"어루만져 줄게요":["Pat Pat"],"어루만져 줄게요 (inst.)":["Pat Pat (Instrumental)"],"알고 있나요":["Do You Know That"],"알고 있나요 (Inst.)":["Do You Know That (Instrumental)"],"시간의 끝에서 (시간의 계단 X 은하 (EUNHA))":["At the end of Time"],"시간의 끝에서 (시간의 계단 X 은하 (EUNHA)) (Inst.)":["At the end of Time (Instrumental)"],"말해줘요":["Tell Me"],"말해줘요 (Inst.)":["Tell Me (Instrumental)"]},
  "은혁":{"있을까 (Special Track)":["EMPTY (Special Track)"],"곤란해 (It’s So Difficult)":["It’s So Difficult"],"곤란해 (It’s So Difficult) (Bossa ver.)":["It’s So Difficult (Bossa Ver.)"]},
  "이기광":{"이유 (Reason)":["Reason"],"이제야 (Regret)":["Regret"],"아름답게 (I Can't Do This)":["I Can′t Do This"],"불안 (Anxiety)":["Anxiety"],"웃으며 인사해 (Feat. 손동운 of 하이라이트)":["Goodbye with a Smile (feat. Son Dong Woon)"]},
  "이달의소녀":{"목소리 (Voice)":["Voice"],"기억해 (Fall Again)":["Fall Again"],"숨바꼭질 (Hide & Seek)":["Hide & Seek"]},
  "이대열":{"별 나무":["Where Stars Grow"]},
  "이미주":{"호기심":["Curiosity"],"호기심 (Inst.)":["Curiosity (Instrumental)"],"내마음이 하는일":["My heart says"],"내마음이 하는일 (Inst.)":["My heart says (Instrumental)"],"보고싶어":["Miss You"]},
  "이브":{"금붕어(Goldfish)":["Goldfish"]},
  "이븐":{"2배속 (2X)":["2X"],"뱉어 (Backtalk)":["Backtalk"]},
  "이성열":{"소행성":["Asteroid"]},
  "이세계아이돌":{"연애세포 (恋愛細胞)":["Love Cell"],"화이트 (White)":["White"],"겨울봄":["Winter Spring"],"겨울봄 (Inst.)":["Winter Spring (Inst.)"]},
  "이수현":{"푸른 산호초":["Blue Lagoon (Korean Ver.)"],"푸른 산호초 (Japanese Ver.)":["Blue Lagoon (Japanese Ver.)"],"푸른 산호초 (Inst.)":["Blue Lagoon (Instrumental)"],"무뎌져가":["Every Day Without You"],"무뎌져가 (Inst.)":["Every Day Without You (Instrumental)"],"가리워진 길":["The Veiled Path (from \"[THE SEASONS VolⅡ. 13] ReːWake x LEE SUHYUN\")"],"나의 봄은":["My Spring"],"나의 봄은 (Inst.)":["My Spring (Inst.)"],"아직 너의 시간에 살아":["In Your Time"],"아직 너의 시간에 살아 (inst.)":["In Your Time (Instrumental)"],"소리":["Sori (From \"Mr. Sunshine\", Pt. 4) [Original Television Soundtrack]"]},
  "이엑스아이디":{"덜덜덜":["DDD"],"위아래":["Up & Down"],"위아래 (Inst.)":["Up & Down (Instrumental)"],"불이나":["FIRE"],"불이나 (ENG VER.)":["FIRE (English Version)"],"알러뷰":["I Love You"],"알러뷰 (Inst.)":["I Love You (Instrumental)"],"하나보단 둘 (2018 Remastered Ver.)":["Better Together (Remastered 2018)"],"하나보단 둘 (2018 Remastered Ver.) (Inst.)":["Better Together (Remastered 2018) [Instrumental]"],"아슬해":["A Sul Hae"],"아슬해 (Inst.)":["A Sul Hae (Instrumental)"],"내일해":["Lady"],"내일해 (Inst.)":["Lady (Instrumental)"],"데려다줄래":["Don't Want a Drive"],"데려다 줄래 (Inst.)":["Don't Want a Drive (Instrumental)"],"매일밤":["Every Night"],"매일밤 (Inst.)":["Every Night (Instrumental)"]},
  "이영지":{"낮 밤 (feat. 박재범)":["Day & Night (feat. Jay Park)"],"타협":["Compromise"],"암실":["Dark Room"]},
  "이은상":{"이유":["Reason"],"꿈의 정원":["Garden of Dreams"],"아이가 될래요":["Child Again"],"사랑보다 더 크게 사랑해":["More Than Love"]},
  "이의진":{"완벽한 숨(Perfect Breathing)":["Perfect Breathing"],"도망쳐":["Run Away"],"완벽한 숨(Perfect Breathing)(JPN Ver.)":["Perfect Breathing (JPN Ver.)"],"불면증 (insomnia)":["Insomnia"],"불면증 (Inst.)":["Insomnia (Instrumental)"]},
  "이재원":{"불면증 (Insomnia)":["Insomnia"]},
  "이재진":{"들어와":["Into My Heart"]},
  "이준":{"내가 주고 싶은 건":["What I Wanna Give"]},
  "이즈나":{"빗속에서":["In the Rain"]},
  "이진솔":{"애니메이션 (Animation)":["Animation"],"향연 (Dilema)":["Dilema"],"스카이 풀 (Sky Pool)":["Sky Pool"],"숲 (Forest)":["Forest"]},
  "이찬혁":{"1조":["1 TRILLION"]},
  "이창민":{"말은 쉽지":["Easy To Say"],"삼키지마":["Telecinema Project, Vol. 5 - Don't Swallow"]},
  "이펙스":{"매일의 내일":["BETTER DAYS"],"사랑 아직 잘 몰라도":["Call it love"],"아무 일도 없었다":["Waffle"],"낭만 터지는":["Bang"],"피카소":["Picasso"],"눈물나게 고마워":["Grateful to Tears"],"늑대와 춤을":["Dances with Wolves"],"별 헤는 밤":["Morning to midnight"],"고래낙하":["Whale fall"],"플루토":["Pluto"],"낭만소녀":["1997"],"경이로운 일상":["Wonderful"],"잃어버린 것들에 대하여":["Closer"],"청춘에게":["Youth2Youth"],"말할 수 있는 비밀":["My Secret"],"졸업식":["Graduation Day"],"잘자요 굿나잇":["K-909 : Baby good night"],"사랑하는 내 님아":["My Darling"],"여우가 시집가는 날":["Sunshower"],"안녕, 나의 첫사랑":["Goodbye, My First Love"],"꿈의 능선(SKYLINE)":["SKYLINE"],"첫사랑의 법칙":["First Love′s Law"],"고백 Bomb":["Love Bomb"],"사랑歌":["Hymn to Love"],"작은 언약식":["The Vow"],"학원歌":["Anthem of Teen Spirit"],"번아웃":["Burnout"],"지구별 여행자 (Traveller)":["Traveller"]},
  "이홍기":{"비오니까":["Because It's Raining"],"비오니까(inst)":["Because It's Raining(Instrumental)"],"비도 오고 그래서":["You, Clouds, Rain"],"비도 오고 그래서 (Inst.)":["You, Clouds, Rain (Instrumental)"],"희재":["Heejae"],"삭제":["Delete"],"희재 (Inst.)":["Heejae (Instrumental)"],"삭제 (Inst.)":["Delete (Instrumental)"],"한사람만 (2023) (여름날 우리 X 이홍기 (FT아일랜드))":["Only One Person (My love)"],"한사람만 (2023) (여름날 우리 X 이홍기 (FT아일랜드)) (Inst.)":["Only One Person (My love) [Instrumental]"],"아모르 파티":["Amor Fati"],"아모르 파티 (Inst.)":["Amor Fati (Instumental)"],"모닥불 (Feat. 딘딘)":["BONFIRE (Feat. dindin)"],"눈치 없이 (INSENSIBLE)":["INSENSIBLE"],"비가 와요 (IN THE RAIN)":["IN THE RAIN"],"사랑이 올 때 (Acoustic Ver.)":["When Love Comes (Acoustic Version)"],"아직 하지 못한 말":["What I Wanted To Say"],"우리 둘이 (With 후지이 미나)":["Two of Us (with Fujii Mina)"],"우리 둘이 (Inst.)":["Two of Us (Inst.)"],"뜨거운 안녕":["Goodbye Party"],"편지":["Letter"],"평온한 호스피스 병동":["Calm Hospice"],"회상":["Recollection"]},
  "이효리":{"달라요":["As I am"],"달라요 (Inst.)":["As I am (Instrumental)"],"마음, 얼음처럼, 단단하게":["My Heart, Like Ice, Hardened"],"너의 것과 같기를 (Prod. 이상순)":["Wish You the Same (Prod. Lee Sang Soon)"],"후디에 반바지":["HOODIE E BANBAJI"],"안부를 묻진 않아도":["Even Without Me Asking How You Are"],"안부를 묻진 않아도 (Piano Ver.)":["Even Without Me Asking How You Are (Piano Version)"],"오늘부터 행복한 나 (Feat. 이상순) (Inst.)":["Happy me from today (Instrumental)"],"비야내려":["Rain Down"],"예쁘다":["Beautiful"],"변하지않는건 (Feat. Los)":["Unchanged (feat. LOS)"],"다이아몬드":["Diamond (with Lee Juck)"],"미스코리아":["Miss Korea"],"내가 미워요":["I Hate Myself"],"사랑의 부도수표":["Bounced Checks of Love"],"누군가":["Somebody"],"묻지 않을게요":["Wouldn′t Ask You"],"쇼쇼쇼":["Show Show Show"],"노":["No"],"바보처럼 (Sadness)":["Sadness"],"미안해요 (Ghost)":["Ghost"]},
  "인성":{"만찬가":["Feast of the Night"],"사랑하려는 중":["Trying To Love"],"네가 물든 기억":["Stained Memory"],"넌 그때 거기, 난 지금 여기":["Still You, Now Me"],"흔들리지 않게":["Stay Steady"],"흔들리지 않게 (Inst.)":["Stay Steady (Instrumental)"],"사랑한다는 말":["Say I Love You"],"사랑한다는 말 (Inst.)":["Say I Love You (inst.)"]},
  "인피니트":{"우리의 계절":["I Still Remember"],"기도 (메텔의 슬픔)":["Pray"],"왜 날":["Why Me"],"분다":["Wind"],"지난 날":["Reminisce (L Solo)"],"고백":["Love Song (Sung Jong Solo)"],"태풍 (The Eye)":["The Eye"]},
  "임영민":{"손난로":["Warm Pocket"],"나 홀로 집에":["Home Alone"],"다시":["AGAIN"]},
  "있지":{"마.피.아. In the morning (English Ver.)":["In the morning (English Version)"],"믿지 (MIDZY)":["Trust Me (MIDZY)"],"믿지 (MIDZY) (English Ver.)":["Trust Me (MIDZY) [English Version]"]},
  "장대현":{"던져 (FEEL GOOD)":["FEEL GOOD"]},
  "장동우":{"인생 (人生)":["Find me"],"마음에 묻다 (Feat. 윤소윤)":["Can't Let Go (feat. Yoon  So Yun)"]},
  "장예은":{"기억의 향기 (Japanese Ver.)":["Scent of Memories (Japanese Ver.)"],"기억의 향기":["Scent of Memories"]},
  "장현승":{"나만의 그대":["My Only One"],"궤도 (Orbit)":["Orbit"],"차가운 너의 손을 따스히 감싸주고 싶어":["I Just Can't Stop Loving You"]},
  "재윤":{"다시 우리 만나도":["The Way We Were"],"반하겠어 (Drama Ver.)":["Like You (Drama Version)"],"다시 우리 만나도 (Inst.)":["The Way We Were (inst.)"]},
  "재찬":{"어쩜 (MAYB) (feat. Nathania)":["MAYB (Feat. Nathania)"],"시간 (Time)":["Time"],"나의 계절에게 (Our Season)":["Our Season"],"나의 계절에게 (Our Season) (Inst.)":["Our Season (Instrumental)"]},
  "저스트비":{"난리나":["Party time"],"전화받아":["Ring Ring Ring"],"아픈 손가락":["My soft spot"],"좁은문":["Narrow Gate"],"얼어있는 길거리에 잠시라도 따듯한 햇빛이 내리길":["Camellia"],"밤공기":["Night Stroll"]},
  "전진":{"너만 있으면 돼 (You're the only one I need)":["You're the only one I need"]},
  "정대현":{"나비란":["Spring After Spring"],"무인도":["Why Am I Still Here"],"이름":["Name"],"행로(行路) (CHN ver.)":["行路 (Chinese Version)"],"느낌있게 (Bomb)":["Bomb"],"너는 내게":["YOU′RE MY"],"너는 내게 (Inst.)":["YOU′RE MY (Instrumental)"]},
  "정민":{"서른의 밤":["The Night of Thrity"],"쉼터":["Shelter"],"그곳에 살아":["Live there"],"파도":["Wave"],"익명에게":["Unknown"],"어젯밤":["Last Night"],"아픔의 나이":["The age of pain"],"나의 종착역":["My last stop"],"눈사람과 봄":["Snowman and Spring"],"첫 장면":["The first scene"],"모든 걸 다 버려도 괜찮아(Prod. 고닥)":["Afterimage Project, Pt. 3 'It's okay to throw everything away (feat. Godak)'"],"던(DUN)":["DUN"],"그날 우리":["The Day of Ours"],"그날 우리 (inst.)":["The Day of Ours (Instrumental)"],"왜 그땐 몰랐을까":["Why?"],"비가 오는데":["Rain"],"왜 그땐 몰랐을까 (inst.)":["Why? (Instrumental)"],"비가 오는데 (inst.)":["Rain (Instrumental)"],"스물한살 그때":["Twenty One, Me and You"],"널 좋아해서 미안해":["Sorry to Love You"],"스물한살 그때 (inst.)":["Twenty One, Me and You (Instrumental)"],"널 좋아해서 미안해 (inst.)":["Sorry to Love You (Instrumental)"]},
  "정예인":{"보물섬 (Treasure Island) (feat. Brody (브로디))":["Treasure Island (feat. Brody)"],"어른이":["Childult"],"행운성":["Celestial Luck"],"이젠 사라지고 없는 것들":["Gone Things"],"이젠 사라지고 없는 것들 (Inst.)":["Gone Things (Instrumental)"],"나의 나만의 그대":["My One and Only"],"나의 나만의 그대 (Inst.)":["My One and Only (Instrumental)"],"내가 너의 봄이 되어줄게":["I will be your spring"],"버스정류장":["Bus"]},
  "정용화":{"우주에 있어 (WOULD YOU)":["WOULD YOU"],"너의 도시 (Your City)":["Your City"],"그대의 시간에 맞출게요 (On Your Time)":["On Your Time"],"나에게 (note to self)":["note to self"],"키스해볼까?":["Shall We Kiss?"],"키스해볼까? (Inst.)":["Shall We Kiss? (Instrumental)"],"너,나,우리 (Feat.이준,윤두준of하이라이트,광희)":["Would you marry me? (feat. Lee Joon, YOON DUJUN & Hwang Kwang Hee)"],"너,나,우리 (Feat.이준,윤두준of하이라이트,광희) (Inst.)":["Would you marry me? (inst.)"],"여자여자해 (That Girl) (Feat. 로꼬)":["That Girl (Feat. Loco)"],"딱 붙어 (Closer)":["Closer"],"대답하지 마 (Not Anymore)":["Not Anymore"],"널 잊는 시간 속 (Lost in Time)":["Lost in Time"],"어느 멋진 날":["One Fine Day"],"마일리지 (Mileage) (With YDG)":["Mileage (with YDG)"],"니가 없어도":["Without You"],"마지막 잎새":["Last Leaf"],"별, 그대":["You, My Star"],"처음 사랑하는 연인들을 위해 (반말송)":["For First-time Lovers"],"처음 사랑하는 연인들을 위해 (반말송) (Inst.)":["For First-time Lovers (Inst.)"]},
  "정우":{"같이 걸을래":["First Step"],"같이 걸을래 (inst.)":["First Step (Instrumental)"],"이젠 웃으며, 안녕":["Smile Good Bye"],"이젠 웃으며, 안녕 (Inst.)":["Smile Good Bye (Instrumental)"]},
  "정은지":{"하늘바라기":["Hopefully Sky"],"너란 봄":["The Spring"]},
  "정인성":{"처음 그때":["First Time Back Then"],"처음 그때 (inst.)":["First Time Back Then (inst.)"],"밤의 의미 (Trust Yourself)":["Trust Yourself"]},
  "정일훈":{"생각이 손에 만져지는 듯해":["Thoughts in hands"],"춤":["Dance"],"긴 머리":["Long way"],"미켈란젤로":["MICHAELANGELO"],"얘기 좀 해요 (Feat. 임현식 Of 비투비)":["Come Closer (feat. LIM HYUNSIK)"],"멋진 구두 (Fancy shoes remastered ver.)":["Fancy Shoes (Remastered)"]},
  "제국의아이들":{"뻔한말 (It Was You)":["It Was You"],"삐끗 삐끗":["Wobble"],"숨소리":["Breathe"],"비틀비틀":["St-Dagger"],"숨소리 (Inst.)":["Breathe (Instrumental)"],"바람의 유령":["The Ghost of Wind"],"바람의 유령 (Inst.)":["The Ghost of Wind (Instrumental)"],"아리따운 걸":["Beautiful Lady"],"아리따운 걸 (Inst.)":["Beautiful Lady (Instrumental)"],"후유증":["Aftermath"],"후유증 (Inst.)":["Aftermath (Instrumental)"],"하루종일 (Japanese Ver.)":["All Day Long (Japanese Version)"],"하루종일 (Japanese Ver.) (Inst.)":["All Day Long (Japanese Version) [Instrumental]"],"하루종일":["All Day Long"],"이별드립":["Bad-Talk-Sad"],"이별드립(Inst.)":["Bad-Talk-Sad (Instrumental)"],"하루종일 (Original Ver.)":["All Day Long"]},
  "제로베이스원":{"바다 (ZB1 Remake)":["The Sea - ZB1 Remake"],"내일의 너에게 닿기를":["Reaching for you"],"내일의 너에게 닿기를 (Inst.)":["Reaching for you (Instrumental)"],"우주먼지 (and I)":["And I"]},
  "제시카":{"봄이라서 그래":["Because It's Spring"]},
  "제아":{"외롭다고 말하긴 싫은데":["I don't want to say I'm lonely"],"외롭다고 말하긴 싫은데 (Inst.)":["I don't want to say I'm lonely (Instrumental)"],"그때는 왜 몰랐을까":["Why didn’t I realize"],"그때는 왜 몰랐을까 (inst.)":["Why didn’t I realize (Inst.)"],"사월의 눈":["Snow of April"],"비가 오는 날엔":["Rainy day"],"비가 오는 날엔 (Inst.)":["Rainy day (Instrumental)"],"보고 싶은 그대니까요":["I Miss You"],"보고 싶은 그대니까요 (inst.)":["I Miss You (Instrumental)"],"나만 없다면":["Only without me"],"그댄 달라요 (With 라디)":["You're Different (With Ra.D)"],"그댄 달라요 (With 라디) (Inst.)":["You're Different (With Ra.D) [Inst.]"],"겨울 너야":["Winter, It's You"],"나쁜 여자 (Feat. 정엽)":["Bad Girl (Feat. Jungyup)"],"눈물섬":["Island of Tears"],"하루만이라도":["Just One Day"],"너 때문에":["Because of You"],"너 때문에 (Inst.)":["Because of you (Inst.)"],"미아":["CHUNO (Original Television Soundtrack) Pt. 2 - lost child"]},
  "제이 창":{"아인(雅人)":["Is you"],"아인(雅人) (Eng ver.)":["Is you (English Version)"]},
  "제이미":{"5가지 Christmas":["5 Christmas Languages"],"상상한 꿈":["Dream"],"상상한 꿈 (Inst.)":["Dream (Instrumental)"],"뭐니 (Feat. OLNL)":["Do you? (feat. OLNL)"],"하나 빼기 둘":["Count you out"],"전화받아 (Feat. 키노 (KINO), WOODZ, 네이슨 (NATHAN))":["PUTP (feat. Кино, WOODZ & Nathan)"],"별 (Prod. by LambC)":["Stars"],"다시":["Try"],"Young해 (Feat. Young K)":["20 (feat. Young K)"]},
  "제이홉":{"항상 (HANGSANG) Feat. Supreme Boi":["HANGSANG (feat. Supreme Boi)"]},
  "젝스키스":{"아프지 마요":["Be Well"],"확인":["R.O.O.K.I.E."],"뒤돌아보지 말아요":["DON’T LOOK BACK"],"꿈":["DREAM"],"의미 없어":["MEANINGLESS"],"제자리":["ROUND & ROUND"],"하늘을 걸어":["WALKING IN THE SKY"],"슬픈 노래":["SAD SONG"],"세 단어":["THREE WORDS"],"연정":["HEARTBREAK"],"무모한 사랑":["RECKLESS LOVE","Reckless Love"],"너를 보내며":["FAREWELL","Letting You Go"],"배신감":["BAD GIRL","Bad Girl"],"사랑하는 너에게":["DEAR LOVE"],"그날까지":["TOGETHER FOREVER"],"커플 (2016 Version)":["COUPLE (2016 Version)"],"예감 (2016 Version)":["GOT A FEELING (2016 Version)"],"기사도 (2016 Version)":["CHIVALRY (2016 Version)"],"연정 (2016 Version)":["HEARTBREAK (2016 Version)"],"무모한 사랑 (2016 Version)":["RECKLESS LOVE (2016 Version)"],"학원별곡 (2016 Version)":["RISE UP (2016 Version)"],"사랑하는 너에게 (2016 Version)":["DEAR LOVE (2016 Version)"],"커플 (Couple)":["Couple"],"커플":["Couple","Walking in the Rain"],"네겐 보일수 없었던 세상":["The World Where I Couldn't Show You"],"그대가 잠든 사이에":["While You're Sleeping"],"내맘을 알고있니":["Do You Know My Heart"],"변신":["Transform"],"단념":["Abandonment"],"기도":["Prayer"],"비상 (飛翔)":["Emergency"],"지금이야 (Remix)":["Now (Remix Version)"],"약속된 운명 (아마게돈)":["Promised Destiny (Armageddon)"],"7전 8기":["Persevere"],"여우사냥":["Fox Hunting"],"그 날까지 (Together Forever)":["Together Forever"],"천년의 약속 1":["A Promise of Millennia"],"형제가 너무달라":["Brothers Are So Different"],"내사랑 그대여":["My Love"],"신비한 사막의 나라":["Mysterious Desert Country"],"각오해 알리바바":["Prudent Alibaba"],"우리는 유쾌한 아라비아 도둑":["We Are a Pleasant Arabia Thief"],"아이구 배 아파라":["I'm a Sick Aunt"],"라이언 칼의 수호자":["Guardian of Ryan Sword"],"천년의 약속 2":["A Promise of Millennia 2"],"램프의 요정":["Lamp Fairy"],"침입자를 잡아라":["Catch the Intruder"],"욕심은 화를 불러":["Greed Makes Angry"],"환희의 휘날레":["A Joy of Happiness"],"학교별곡":["School Byeolgok"],"기억해 줄래":["Remember Me"],"흘러가는 대로":["Dream Comes True"],"사랑 신고식":["Love Announcement"],"초라한 초대":["Come On"]},
  "젤로":{"홀려":["Possessed"],"난 널":["Sunrise"]},
  "조권":{"우리 사랑하게 됐어요":["I Happen to Love You"],"친구의 고백":["Confession of a friend"],"친구의 고백 (Inst.)":["Confession of a friend (Instrumental)"],"새벽":["Lonely"],"새벽 (Inst.)":["Lonely (Instrumental)"],"횡단보도":["Crosswalk"],"괜찮아요":["fine"],"고백하던 날":["The Day of Confession"]},
  "종현":{"데자-부 (Deja-Boo)":["Déjà-Boo"],"빛이 나 (Shinin')":["Shinin'"],"환상통 (Only One You Need)":["Only One You Need"],"와플 (#Hashtag)":["#Hashtag"],"기름때 (Grease)":["Grease"],"사람 구경 중 (Sightseeing)":["Sightseeing"],"하루만이라도 (Just for a day)":["Just for a day"],"어떤 기분이 들까 (I'm So Curious)":["I’m So Curious"],"우린 봄이 오기 전에 (Before Our Spring)":["Before Our Spring"],"멍하니 있어 (Just Chill)":["Just Chill"],"눈싸움 (Blinking Game)":["Blinking Game"],"엘리베이터 (Elevator)":["Elevator"],"놓아줘 (Let Me Out)":["Let Me Out"],"벽난로 (Fireplace)":["Fireplace"],"따뜻한 겨울 (Our Season)":["Our Season"],"하루의 끝 (End of a day)":["End of a day"],"산하엽 (Diphylleia grayi)":["Diphylleia grayi"],"미안해 (I'm sorry)":["I'm sorry"],"그래도 되지 않아? (Fine)":["Fine"],"내일쯤 (Maybe tomorrow)":["Maybe tomorrow"],"할렐루야 (Hallelujah)":["Hallelujah"],"일인극 (MONO-Drama)":["MONO-Drama"],"시간이 늦었어 (Beautiful Tonight)":["Beautiful Tonight (Bonus Track)"]},
  "종호":{"사랑한 만큼":["To Some Degree of Love"],"사랑한 만큼 (inst.)":["To Some Degree of Love (Inst.)"],"처음 그대로":["Just like the first time"],"처음 그대로 (Inst.)":["Just like the first time (Instrumental)"],"바람":["Wind"],"바람 (Inst.)":["Wind (Inst.)"]},
  "주헌":{"광 (Gwang)":["Gwang"],"하늘에 머리가 닿을 때까지 (Feat. Tiger JK)":["Touch the sky (feat. Tiger JK)"],"진화 (Evolution)":["Evolution"],"독백 (Feat. GSoul)":["monologue (feat. GSoul)"]},
  "쥬얼리":{"룩앳미":["Look At Me"],"룩앳미 (Look At Me) (Inst.)":["Look At Me (Instrumental)"],"운명같은 사랑":["Fateful Love"],"운명같은 사랑 (Inst.)":["Fateful Love (instrumental)"]},
  "지디":{"쿠데타 (COUP D'ETAT)":["Coup D'état"]},
  "지민":{"약속":["Promise"],"할렐루야 (Hallelujah)":["Hallelujah"],"야 하고 싶어 (Feat. 시우민 of EXO)":["Call You Bae (feat. XIUMIN)"]},
  "지수":{"꽃 (FLOWER)":["FLOWER"]},
  "지수연":{"종이비행기":["Paper Plane"],"우연과 필연":["Chance & Fate"],"미완":["Unwritten"],"너란 책":["The Book of You"],"종이더미":["Pile of Paper"],"블루스크린":["bluescreen"],"숲으로 떠난 물고기":["A Fish Gone to the Forest"],"숲으로 떠난 물고기 (Inst.)":["A Fish Gone to the Forest (Inst.)"],"그대를 보내요":["I'll let you go (from '<Dare to Love Me> Original Soundtrack, Pt. 3')"],"오히려 좋아":["Even Better"],"오히려 좋아 (Inst.)":["Even Better (Instrumental)"]},
  "지연":{"또르르 (2022)":["Rolling (2022)"],"또르르 (2022) (inst.)":["Rolling (2022) [Instrumental]"]},
  "지윤":{"난 기다릴게요":["I′ll Wait"],"난 기다릴게요 (Inst.)":["I′ll Wait (Instrumental)"]},
  "지코":{"만화영화 (Cartoon)":["Cartoon"],"웬수 (Feat. BIBI)":["Love & Hate (feat. BIBI)"],"아무노래":["Any Song"],"남겨짐에 대해 (Feat. 다운)":["Being Left (feat. Dvwn)"],"너는 나 나는 너":["I Am You, You Are Me"],"사랑이었다 (Feat. 루나 of f(x))":["It Was Love (feat. LUNA)"],"날 (Feat. JTONG)":["Predator (feat. J-Tong)"],"말해 Yes Or No (Feat. PENOMECO, The Quiett)":["Tell Me Yes Or No (feat. PENOMECO & The Quiett)","Tell Me Yes Or No (feat. The Quiett & PENOMECO)"]},
  "지효":{"이상한 하루":["A Strange Day"],"이상한 하루 (Inst.)":["A Strange Day (Instrumental)"]},
  "진":{"구름과 떠나는 여행":["With the Clouds"],"오늘의 나에게":["To Me, Today"],"네게 닿을 때까지":["Falling"],"그리움에":["I will come to you"],"슈퍼 참치":["Super Tuna"],"이 밤":["Tonight"]},
  "진영":{"열일곱 (with 원필 (DAY6))":["Seventeen (with WONPIL)"],"나는 괜찮을까요":["Will I be okay?"],"외사랑 (feat. 최유리)":["One-sided love (feat. Choi Yu Ree)"],"너를 만남이란 기적":["Our Miracle"],"잘 자":["Sleep Well"],"편지":["Letter"],"달이 될게":["Shining on Your Night"],"달이 될게 (Inst.)":["Shining on Your Night (Instrumental)"],"넌 사랑을 모른다 했지(티파니에서 모닝 키스를 OST)":["You said you don't know what love is"],"넌 사랑을 모른다 했지(티파니에서 모닝 키스를 OST)(inst.)":["You said you don't know what love is (Instrumental)"],"좋아해, 아니 사랑해":["I'm Into You, I Mean Love You"],"좋아해, 아니 사랑해 (Inst.)":["I'm Into You, I Mean Love You (Instrumental)"],"이 사랑을":["For This Love"],"이 사랑을 (Inst.)":["For This Love (Instrumental)"]},
  "진진":{"검은 새벽":["Dark Dawn"],"검은 새벽 (Inst)":["Dark Dawn (inst.)"],"이별택배":["Farewell Letter"],"자존감 (self-esteem)":["self-esteem"],"날 위해 (feat. MRCH)":["for me (feat. MRCH)"]},
  "진호":{"보늬밤":["Chestnut"],"보늬밤(Inst.)":["Chestnut(Instrumental)"],"에델바이스":["Edelweiss"],"에델바이스(Inst.)":["Edelweiss(Instrumental)"],"듣고 싶어":["I want to hear it"],"듣고 싶어 (Inst.)":["I want to hear it (Inst.)"],"나만의 이별 (Goodbye With You)":["Goodbye With You"],"나의 너에게, 우리의 순간":["Dear Precious One, Our Shimmering Days"],"이 순간을 간직해":["Keep This Moment"],"이 순간을 간직해 (inst.)":["Keep This Moment (Instrumental)"]},
  "차은우":{"질투":["Jealousy"],"질투 (Inst.)":["Jealousy (Instrumental)"],"항해":["Love Sailing"],"항해 (Inst.)":["Love Sailing (Instrumental)"],"기억해줘요":["Please Remember"],"기억해줘요 (inst.)":["Please Remember (Instrumental)"]},
  "차희":{"틈":["puzzle"],"틈 (inst.)":["puzzle (Instrumental)"],"난 못해요":["I Can't"],"난 못해요 (Inst.)":["I Can't (Instrumental)"]},
  "찬열":{"처음부터 지금까지":["From the Beginning Till Now"],"처음부터 지금까지 (Inst.)":["From the Beginning Till Now (Instrumental)"],"그래도 돼 (Good Enough)":["Good Enough"],"봄 여름 가을 겨울 (SSFW)":["SSFW"],"봄 여름 가을 겨울 (SSFW) (Inst.)":["SSFW (Instrumental)"]},
  "찬희":{"그리움":["Starlight"],"그리움 (Inst.)":["Starlight (Instrumental)"]},
  "창조":{"기다려 (Never Anything) (Feat. V-Hawk)":["Never Anything (feat. V-hawk)"]},
  "천지":{"내 눈물 모아":["Gather My Tears"],"이별이 늦어져서 미안해":["too late"],"안녕이라는 말":["farewell"]},
  "청하":{"벌써 12시":["Gotta Go"],"알고리즘 (Algorithm)":["Algorithm"],"새벽에 핀 별 하나":["A Star in the dawn"],"새벽에 핀 별 하나 (Inst.)":["A Star in the dawn (Instrumental)"],"나만의 것":["It's only mine"],"나만의 것 (Inst.)":["It's only mine (Inst.)"],"짜증 나게 만들어":["Bother Me"],"Chill해":["Chill"],"별하랑 (160504 + 170607)":["BYULHARANG (160504 + 170607)"],"솔직히 지친다":["Everybody Has"],"여기 적어줘 (Feat. pH-1)":["My Friend (feat. pH-1)"],"우리가 즐거워":["Young In Love"],"너의 온도 (Remind of You)":["Remind of You"],"우주먼지":["Cosmic Dust"],"월화수목금토일":["Week"],"두근두근":["Pit-A-Pat"],"두근두근 (Inst.)":["Pit-A-Pat (Instrumental)"]},
  "체리블렛":{"겨울 별 (A Winter Star)":["A Winter Star"],"닿을까 말까 (KKa KKa)":["KKa KKa"],"알로하오에 (Aloha Oe)":["Aloha Oe"],"무릎을 탁 치고 (Hands Up)":["Hands Up"],"네가 참 좋아 (Really Really)":["Really Really"],"탁구공 (Ping Pong)":["Ping Pong"],"발그레 (Ruddy)":["Ruddy"],"눈에 띄네":["Stick Out"]},
  "첸":{"우리 어떻게 할까요":["Shall We?"],"별들보다 빛나는":["Brighter than"],"빈 집 (Empty)":["Empty"],"꽃씨 (Dandelion)":["Dandelion"],"별빛 저 너머의 너머의 너머의 별 (Starlight)":["Starlight"],"회상 (Remember)":["Remember"],"나 사랑법":["The Way to love myself"],"나 사랑법 (Inst.)":["The Way to love myself (Instrumental)"],"안녕 (Hello)":["Hello"],"너의 달빛":["Your moonlight"],"너의 달빛 (Inst.)":["Your moonlight (Instrumental)"],"아름다워":["Beautiful (From Heart 4 U Original Soundtrack)"],"벚꽃연가":["Cherry Blossom Love Song"],"벚꽃연가 (Inst.)":["Cherry Blossom Love Song (Instrumental)"],"안녕 못해 (I'm Not Okay)":["I'm Not Okay (From “MISSING 9”)"],"안녕 못해 (I'm Not Okay) (Inst.)":["I'm Not Okay (From “MISSING 9”) [Instrumental]"]},
  "최강창민":{"슬픔 속에 그댈 지워야만 해 (Because I Love You) (Acoustic Ver.)":["Because I Love You (Acoustic Version)"]},
  "최민환":{"내일이 오겠죠..":["Maybe.."],"그날의 너":["Me, Now"],"그날의 너 (Inst.)":["Me, Now (inst.)"]},
  "최예나":{"보기 드문 여자 (Feat. NOWIMYOUNG (나우아임영))":["Dime Girl (feat. nowimyoung)"],"캐치 캐치 (Sped Up)":["Catch Catch (Sped Up)"],"캐치 캐치":["Catch Catch"],"봄이라서 (Feat. 딘딘, 정형돈)":["Spring Fever (feat. DINDIN & Jung Hyung Don)"],"스티커 (Feat. 윤마치 (MRCH))":["Sticker (feat. MRCH)"],"4월의 고양이":["April’s Cat"],"물음표 (Feat. 폴킴)":["Question Mark (feat. Paul Kim)"],"착하다는 말이 제일 싫어 (Chinese Ver.)":["Being a Good Girl Hurts (Chinese Version)"],"착하다는 말이 제일 싫어":["Being a Good Girl Hurts"],"안녕 (Hello, Goodbye)":["Hello, Goodbye"],"네모네모":["NEMONEMO"],"설탕":["Sugar"],"그건 사랑이었다고":["It was love"],"Hate Rodrigo (Feat. 우기 ((여자)아이들))":["Hate Rodrigo (feat. YUQI)"]},
  "츄":{"사랑합니다":["I Love You"],"사랑합니다 (inst.)":["I Love You (Inst.)"],"별":["Star"],"별 (Inst.)":["Star (Inst.)"],"내가 바보라서 그래? (feat. KIXO (키조))":["because I'm stupid? (feat. KIXO)"],"내가 바보라서 그래? (feat. KIXO (키조)) (Inst.)":["because I'm stupid? (Instrumental) [feat. KIXO]"],"두 번째 사랑 (Ver. Acoustic)":["Second love (Acoustic Version)"],"두 번째 사랑":["Second love"],"두 번째 사랑 (Inst.)":["Second love (Instrumental)"],"여우비 (낮에 뜨는 달 X 츄 (CHUU))":["Fox Rain (The Moon during the Day)"],"여우비 (낮에 뜨는 달 X 츄 (CHUU)) (Inst.)":["Fox Rain (The Moon during the Day) [Instrumental]"],"아름다운 이별":["A Beautiful Farewell"],"아름다운 이별 (Inst.)":["A Beautiful Farewell (Instrumental)"],"좋아 좋아":["I Like You (from \"[THE SEASONS VolⅡ. 10] <AKMU's Long day Long night> ReːWake x CHUU\")"],"우리의 밤은 당신의 낮보다 아름답다":["Our Night is more beautiful than your Day"],"우리의 밤은 당신의 낮보다 아름답다 (Inst.)":["Our Night is more beautiful than your Day (Instrumental)"],"브런치 (조조코믹스, 네이버웹툰)":["Brunch (Daily JoJo)"],"브런치 (조조코믹스, 네이버웹툰) (Inst.)":["Brunch (Daily JoJo) [Instrumental]"],"일과 이분의 일":["ONE AND A HALF"],"일과 이분의 일 (Inst.)":["ONE AND A HALF (Instrumental)"],"좋아서 좋아해":["Loving U"],"좋아서 좋아해 (Inst.)":["Loving U (Instrumental)"],"봄꽃":["Spring Flower"],"봄꽃 (Inst.)":["Spring Flower (Instrumental)"]},
  "카드":{"ㅏㅣㅑ (AH EE YAH)":["Ah Ee Yah"],"밤밤(Bomb Bomb)":["Bomb Bomb"],"지니까":["Jinikka"],"이제 우리 (Song by 제이셉, 전소민)":["Here We Now (feat. J.seph & Jeon So Min)"],"난 멈추지 않는다":["I Can't Stop"]},
  "카라":{"맘마미아":["Mamma Mia"],"마법 (Inst.)":["Lonely"],"이게뭐야":["What's This?"],"그땐 그냥":["In Those Days"],"멜랑꼴리 (Melancholy 24/7)":["MelanCholy (24/7)"],"빨간불 (Red Light)":["Red Light"],"이야기 (Story)":["Story"],"둘 중에 하나 (Runaway)":["Runaway"],"둘 중에 하나 (Runaway) (Inst.)":["Runaway (Inst.) [instrumental]"],"나는.. (Ing) (Acoustic Ver.)":["Ing (Acoustic Version)"],"내 마음을 담아서 (Dear Kamilia)":["Dear Kamilia"],"루팡 (Lupin)":["Lupin"],"굿데이 (Goodday) 시즌 2":["Goodday Season 2"],"맘에 들면 (If U Wanna)":["If U Wanna"]},
  "카즈타":{"찾았다 (Japanese Ver.)":["I'll Find You (Japanese Ver.)"],"찾았다 (Japanese Ver.) (Inst.)":["I'll Find You (Japanese Ver., Inst.)"]},
  "케플러":{"있지...":["Lowkey"]},
  "퀸즈아이":{"모를거야 (How Could You Know)":["How Could You Know"],"모를거야 (How Could You Know) (Inst.)":["How Could You Know (Instrumental)"],"계절처럼 돌아와 줄 순 없니":["Can't you come back like the season"],"계절처럼 돌아와 줄 순 없니 (Inst.)":["Can't you come back like the season (inst.)"]},
  "큐더블유이알":{"소년만화":["Dreamer"],"피카레스크":["Picaresque"],"바니바니":["BANI BANI"],"가짜 아이돌":["FAKE IDOL"],"내 이름 맑음":["My Name is Malguem"],"사랑하자":["Let's Love"],"달리기":["run! run! run!"],"안녕, 나의 슬픔":["Goodbye My Sadness"],"메아리":["REBOUND"],"고민중독":["T.B.H"],"자유선언":["Free-Dumb"],"지구정복":["G9JB"],"대관람차":["Ferris Wheel"],"불꽃놀이":["Make Our Highlight"],"마니또":["Manito"],"흰수염고래":["Blue Whale"],"눈물참기":["Dear"],"행복해져라":["Be Happy"],"검색어는 QWER":["#QWER"]},
  "크나큰":{"동화":["Fairy Tale"],"바랬어":["Fade"],"무슨 생각해":["What Do You Think?"],"한 끗 차이":["Closer"],"한 끗 차이 (Inst.)":["Closer (Instrumental)"],"비":["Rain"],"너무 예뻐":["Love You"],"해, 달, 별":["Sun, Moon, Star"],"해, 달, 별 (Inst.)":["Sun, Moon, Star (Instrumental)"],"아름다워":["Beauty"],"웃어줄래":["I Know"],"괜찮은가봐":["Goodbye"],"요즘 넌 어때":["I Remember"],"노력해볼게":["I’ll Try"],"고백":["Propose"],"요즘 넌 어때 (Inst.)":["I Remember (Instrumental)","I Remember (Inst.)"]},
  "크래비티":{"봄날의 우리 (Spring, with You)":["Spring, with You"]},
  "크레용팝":{"부릉부릉(Vroom Vroom)":["Vroom Vroom"],"뭐해 (Feat. 로빈)":["Wassup (feat. Robbin)"],"뭐해 (Inst.)":["Wassup (Instrumental)"],"뜬뜬뜬뜬 뜨든뜬":["C'mon C'mon"],"뜬뜬뜬뜬 뜨든뜬 (Inst.)":["C'mon C'mon (Instrumental)"],"헤이 미스터":["Hey Mister"],"헤이 미스터 (Inst.)":["Hey Mister (Instrumental)"],"어이 (Uh-ee)":["Uh-Ee"],"어이 (Inst.)":["Uh-Ee (Instrumental)"],"빠빠빠":["Bar Bar Bar"],"빠빠빠 (Inst.)":["Bar Bar Bar (Instrumental)"]},
  "크리스탈":{"울컥":["Suddenly (From \"My Lovely Girl\" [Original Television Soundtrack], Pt. 2)"]},
  "클라씨":{"젖은 일기장 (Prod. by EL CAPITXN)":["AFTER THE TEARS"],"눈물이 난 채로 걷는 게 나다운 거라서 (Prod. by EL CAPITXN)":["Tear Drop"],"비둘기 (Prod. by 구름) (KIM SEONYOU SOLO)":["Pigeon (KIM SEONYOU SOLO)"],"사랑이라 부를 수 있을까":["Can I Call It Love"],"사랑이라 부를 수 있을까 (Inst.)":["Can I Call It Love (Instrumental)"]},
  "클로즈유어아이즈":{"여전히":["Waiting For You"],"여전히 (Inst.)":["Waiting For You - Instrumental"],"ㅠ":["You"],"왼손에는 버블티":["Bubble Tea"],"너를 담은 이 영화에 나의 가사가 자막이 돼":["Subtitled"],"내 안의 모든 시와 소설은":["All My Poetry"],"빗속에서 춤추는 법":["How To Dance"],"못 본 척":["Laid Back"],"사과가 하늘로 떨어진 날":["Upside down"]},
  "클릭비":{"고작 약간의 한숨과 약간의 눈물뿐... [Forgive Me]":["Forgive Me"],"행운":["Good Luck"]},
  "키":{"I Wanna Be (Feat. 소연 of (여자)아이들)":["I Wanna Be (feat. SOYEON)"],"센 척 안 해 (One of Those Nights) (Feat. Crush)":["One of Those Nights (feat. Crush)"],"미워 (The Duty of Love)":["The Duty of Love"]},
  "키비츠":{"A1ㄱ":["A1 GO"]},
  "키스오브라이프":{"쉿 (Shhh)":["Shhh"],"안녕, 네버랜드":["Bye My Neverland"]},
  "키키":{"멍냥":["MUNGNYANG"],"딸기게임 (Strawberry Cheesegame)":["Strawberry Cheesegame"],"한 개뿐인 (ONE OFF)":["ONE OFF"]},
  "킥플립":{"눈에 거슬리고 싶어":["Eye-Poppin'"],"거꾸로":["Backward"],"뭔가 잘못된 것 같아":["Something Feels Wrong"],"뭔가 잘못된 것 같아 (Inst.)":["Something Feels Wrong - Instrumental"],"처음 불러보는 노래":["My First Love Song"],"반창고 (Band-Aid)":["Band-Aid"],"특이점":["Crush"],"다시, 여기":["Tiki-taka"],"악몽을 꿨던 건 비밀이지만":["Secret Nightmare"],"제끼자":["Skip It!"],"언젠가 태양은 폭발해":["Before the Sun Explodes"],"응 그래":["Umm Great"],"내일에서 만나":["See You On Tomorrow"]},
  "탑":{"쩔어":["Zutter"]},
  "태민":{"그림":["Draw"],"그림 (Inst.)":["Draw (Instrumental)"],"일식 (Black Rose) (Feat. Kid Milli)":["Black Rose (feat. Kid milli)"],"해몽 (Waiting For)":["Waiting For"],"네모 (Nemo)":["Nemo"],"괴도 (Danger)":["Danger"],"거절할게 (Wicked)":["Wicked"],"소나타 (Play Me)":["Play Me"],"발걸음 (Steps)":["Steps (From \"Prime Minister & I\")"],"발걸음 (Steps) (Inst.)":["Steps (From \"Prime Minister & I\") [Instrumental]"]},
  "태양":{"눈, 코, 입":["Eyes, Nose, Lips"],"나만 바라봐":["Look Only At Me"],"슝! (feat. LISA of BLACKPINK)":["Shoong! (feat. LISA of BLACKPINK)"],"나의 마음에 (Seed)":["Seed"],"나는":["Reason"],"텅빈도로 (EMPTY ROAD)":["EMPTY ROAD"],"오늘밤 (TONIGHT) (Feat. ZICO)":["TONIGHT (feat. ZICO)"],"웨딩드레스 (Wedding Dress)":["Wedding Dress"],"기도 (Feat. Teddy)":["Prayer (feat. Teddy)"],"죄인":["A Sinner"]},
  "태연":{"만찬가":["Bansanka"],"만찬가 (Inst.)":["Bansanka (Instrumental)"],"조각":["Pieces"],"조각 (Inst.)":["Pieces (Inst.)"],"인사 (Panorama)":["Panorama"],"불티 (Spark)":["Spark"],"그런 밤 (Some Nights)":["Some Nights"],"사계 (Four Seasons)":["Four Seasons"],"겨울나무 (I'm all ears)":["I'm all ears"],"꿈":["Dream"],"꿈 (Inst.)":["Dream (Inst.)"],"혼자서 걸어요 (Prod. by 나얼)":["Nights Into Days"],"혼자서 걸어요 (Inst.) (Prod. by 나얼)":["Nights Into Days (Inst.)"],"너와 나 사이":["You and me"],"너와 나 사이 (Inst.)":["You and me (Instrumental)"],"내 곁에":["By My Side"],"내 곁에 (Inst.)":["By My Side (Instrumental)"],"나의 작은 정원":["Little Garden"],"나의 작은 정원 (Inst.)":["Little Garden (Instrumental)"],"내일은 고백할게":["Kiss me"],"내일은 고백할게 (Inst.)":["Kiss me (Instrumental)"],"춘천가는 기차":["A Train to Chuncheon (Monthly Project 2019 May Yoon Jong Shin with TAEYEON)"],"날개 (Feel So Fine)":["Feel So Fine"],"수채화 (Love in Color)":["Love in Color"],"쌍둥이자리 (Gemini)":["Gemini"],"스트레스 (Stress)":["Stress"],"먼저 말해줘 (Farewell)":["Farewell"],"그리고 하나":["Only One"],"그리고 하나 (Inst.)":["Only One (Instrumental)"],"사랑해요 (I Love You)":["I Love You"],"사랑해요 (I Love You) (Inst.)":["I Love You (Instrumental)"]},
  "태일":{"머무는 별":["Remaining Star"],"설렘각":["Fluttering"],"설렘각 (Inst.)":["Fluttering (Instrumental)"],"좋아한다 안 한다 (Duet. 세정 of 구구단) (Prod. 박경)":["Love or Not (feat. KIMSEJEONG)"],"좋아한다 안 한다 (Prod. 박경) (Inst.)":["Love or Not (Instrumental)"],"흔들린다 (Prod. By 40)":["Inspiring"],"흔들린다 (Piano Only)":["Inspiring (Piano Only)"]},
  "템페스트":{"하루만":["Only One Day"],"있을게 (to YOU)":["Next To YOU"],"폭풍의 눈":["EYE OF THE STORM"],"난장 (Dangerous)":["Dangerous"]},
  "토니안":{"유추프라카치아":["Yutzpracachia's Love"],"촌스럽게 (Behind The Clouds)":["Behind The Clouds"],"촌스럽게 (Behind The Clouds) (Inst.)":["Behind The Clouds (Instrumental)"]},
  "투모로우바이투게더":{"5시 53분의 하늘에서 발견한 너와 나":["Blue Hour"],"하루에 하루만 더 (Stick With You)":["Stick With You"],"다음의 다음":["Dream of Mine"],"그날이 오면":["When the Day Comes"],"그날이 오면 (Inst.)":["When the Day Comes - Instrumental"],"별의 노래":["Song of the Stars"],"내일에서 기다릴게 (I'll See You There Tomorrow)":["I’ll See You There Tomorrow"],"물수제비":["Skipping Stones"],"이젠 안녕":["Goodbye Now"],"이젠 안녕 (Inst.)":["Goodbye Now (Instrumental)"],"네버랜드를 떠나며":["Farewell, Neverland"],"소악행":["Ice Cream"],"밸런스 게임":["What if I had been that PUMA"],"교환일기 (두밧두 와리와리)":["MOA Diary (Dubaddu Wari Wari)"],"디어 스푸트니크":["Dear Sputnik"],"널 보면 시간이 멈춰 어느 순간에도":["Love Sight"],"널 보면 시간이 멈춰 어느 순간에도 (Inst.)":["Love Sight (Instrumental)"],"날씨를 잃어버렸어":["We Lost The Summer"],"하굣길":["Way Home"],"세계가 불타버린 밤, 우린... (Can't You See Me?)":["Can't You See Me?"],"샴푸의 요정":["Fairy of Shampoo"],"거울 속의 미로":["Maze in the Mirror"],"동물원을 빠져나온 퓨마":["Puma"],"9와 4분의 3 승강장에서 너를 기다려 (Run Away)":["9 and Three Quarters (Run Away)"],"간지러워 (Roller Coaster)":["Roller Coaster"],"그냥 괴물을 살려두면 안 되는 걸까":["Can't We Just Leave the Monster Alive?"],"어느날 머리에서 뿔이 자랐다 (CROWN)":["CROWN"],"별의 낮잠":["Nap of a star"]},
  "투애니원":{"안녕":["Goodbye"],"너 아님 안돼":["Gotta Be You"],"살아 봤으면 해":["If I Were You"],"착한 여자":["Good To You"],"멘붕 (CL Solo)":["MTBD (CL Solo Version)"],"그리워해요":["Missing You"],"내가 제일 잘 나가":["I Am the Best"],"박수쳐":["Clap Your Hands"],"난 바빠":["I'm Busy"],"아파 (Slow)":["It Hurts (Slow)"],"사랑은 아야야":["Ah-Yah-Yah"],"날 따라 해봐요":["Try to Follow Me"]},
  "투어스":{"첫 만남은 계획대로 되지 않아":["Plot Twist"],"마음 따라 뛰는 건 멋지지 않아?":["Countdown!"],"내가 S면 넌 나의 N이 되어줘":["If I'm S, Can You Be My N?"],"너의 모든 가능성이 되어 줄게":["All the Possibilities"],"다시 만난 오늘":["Nice to see you again - Korean Ver."],"내 이름을 불러줘":["Call My Name"],"널 따라가 (You, You)":["You, You"],"내일이 되어 줄게":["Here For You"],"심야 영화":["Now Playing"],"너의 이름 (Highlight)":["Highlight"],"마지막 축제":["Last Festival"],"점 대신 쉼표를 그려 (Comma,)":["Comma,"],"너+나=7942":["YOU+ME=7942"],"내가 태양이라면":["Keep On"]},
  "튜넥스":{"내가 살아있다는 증거":["I’m Alive"]},
  "트라이비":{"멍청이(twit)":["K-909 : twit"],"우주로(WOULD YOU RUN) Original Ver.":["WOULD YOU RUN (Original Ver.)"],"우주로(WOULD YOU RUN)":["WOULD YOU RUN"],"둠둠타(DOOM DOOM TA)":["DOOM DOOM TA"],"러버덤(RUB-A-DUM)":["RUB-A-DUM"]},
  "트레저":{"사랑해 (I LOVE YOU)":["I LOVE YOU"]},
  "트렌드지":{"카멜레온":["Chameleon"],"뚜뚜":["ddoO ddoO"],"위로위로 (Go Up) (Live Band Ver.)":["Go Up (Live Band Version)"],"녹아":["Melting"],"이루어질 것만 같아":["Dreams Come True"],"이루어질 것만 같아 (Inst.)":["Dreams Come True (Instrumental)"]},
  "트리플에스":{"깨어 (Are You Alive) (Inst.)":["Are You Alive (Instrumental)"],"추리소설 (Detective Soseol) (Inst.)":["Detective Soseol (Instrumental)"],"어제 우리 불꽃놀이 (Firework Diary) (Inst.)":["Firework Diary (Instrumental)"],"가시권 (Heart Raider) (Inst.)":["Heart Raider (Instrumental)"],"치유 (Chiyu) (Inst.)":["Chiyu (Instrumental)"],"이면의 이면 (Beyond the Beyond) (Inst.)":["Beyond the Beyond (Instrumental)"],"내적 댄스 (Inner Dance) (Inst.)":["Inner Dance (Instrumental)"],"연애소설 (Love Soseol) (Inst.)":["Love Soseol (Instrumental)"],"연애소설 (Love Soseol)":["Love Soseol"],"내적 댄스 (Inner Dance)":["Inner Dance"],"가시권 (Heart Raider)":["Heart Raider"],"치유 (Chiyu)":["Chiyu"],"이면의 이면 (Beyond the Beyond)":["Beyond the Beyond"],"찰나 (Charla) (Inst.)":["Charla (Instrumental)"],"복합성 (Complexity) (Inst.)":["Complexity (Instrumental)"],"미열 37.5 (Inst.)":["37.5 Celcius (Instrumental)"],"첫 이별 (Farewell My First) (Inst.)":["Farewell My First (Instrumental)"],"첫 이별 (Farewell My First)":["Farewell My First"],"미열 37.5":["37.5 Celsius"],"복합성 (Complexity)":["Complexity"],"초월 (Chowall)":["Chowall"],"찰나 (Charla)":["Charla"]},
  "트와이스":{"올해 제일 잘한 일":["The Best Thing I Ever Did"],"거북이":["TURTLE"],"날 바라바라봐":["LOOK AT ME"],"힘내! (DON'T GIVE UP)":["DON'T GIVE UP"],"널 내게 담아":["YOU IN MY HEART"],"잘자요 굿나잇":["JALJAYO GOOD NIGHT"],"하루에 세번":["Three Times a Day"],"ONLY 너":["Only You"],"OOH-AHH하게":["Like Ooh-Ahh"],"다시 해줘":["Do It Again"],"미쳤나봐":["Going Crazy"]},
  "티아라":{"내 이름은":["What's My Name?"],"Little Apple with 젓가락형제":["Little Apple (feat. Chopsticks Brother)"],"넘버나인 (No.9)":["No.9"],"넘버나인 (No.9) (Club Ver.)":["No.9 (Club Version)"],"로그인 (Log-In)":["Log-In"]},
  "티아이오티":{"10분조차":["Every Ten Minutes"],"가나요 (Moonrise)":["Moonrise"],"아기상어":["Baby Shark"],"백전무패":["Unbeatable"],"말해줘":["Tell Me"],"다섯시간의 조각들":["Five Hours in Pieces"],"지내볼게":["I'll Be Okay"],"맨발의 청춘":["RUN RUN BAREFOOT"],"맨발의 청춘 (Inst.)":["RUN RUN BAREFOOT (Instrumental)"],"맨발의 청춘 (Fast ver.)":["RUN RUN BAREFOOT (Fast ver.)"],"그 계절 긴 터널을 지나":["The Long Season"],"그 계절 긴 터널을 지나 (Inst.)":["The Long Season (Inst.)"]},
  "티에이엔":{"너란 별 (약속해요)":["Sing with you"]},
  "티에프엔":{"에델바이스(EDELWEISS)":["EDELWEISS"],"에델바이스(EDELWEISS)(Inst.)":["EDELWEISS (Instrumental)"],"은닉":["Get the Bomb"],"아수라발발타(ASURABALBALTA)":["ASURABALBALTA"],"아수라발발타(ASURABALBALTA)(Inst.)":["ASURABALBALTA (Instrumental)"]},
  "티엔엑스":{"그러니까 내 말은":["Love letter"],"아 진짜 (For Real?)":["For Real?"],"시간의 틈에서":["At The Moment"],"겨울 다시 봄":["By My Side"],"최애 (My Bias)":["My Bias"],"따따따 (Short Ver.)":["DDA DDA DDA (Short Version)"],"180초":["180Sec"],"비켜":["MOVE"],"벌써":["Burst Up"],"작은 노래":["Your Favorite Melody"]},
  "티오원":{"얼음 땡":["Freeze Tag"],"매운맛":["Hot Sauce"],"너만 있다면 (With You)":["With You"],"피어나 (TO1 Ver.)":["Don't Fear Now (TO1 Version)"]},
  "틴탑":{"사랑하고 싶어 2025 (I Wanna Love 2025)":["I Wanna Love 2025"],"긴 생머리 그녀 (Miss Right) (DJ Remix)":["Miss Right (DJ Remix)"],"휙 (HWEEK)":["HWEEK"],"니가 아니라서 2023 (Missing You 2023)":["Missing You 2023"],"휙 (HWEEK) (Inst.)":["HWEEK (Instrumental)"],"휙 (HWEEK) (Sped Up)":["HWEEK (Sped Up)"],"비 그친 밤 (That Night)":["That Night"],"너와 나의 사이 (LOVER)":["Lover"],"서울밤 (SEOUL NIGHT)":["Seoul Night"],"놀면 돼 (Let's play!)":["Let's Play!"],"클났네 (S.O.S)":["S.O.S"],"니가 없으면 (Without you)":["Without You"],"헤어지고 난 후 (Go away)":["Go Away"],"서울밤 (SEOUL NIGHT) (Inst.)":["Seoul Night (Instrumental)"],"너와 나의 사이 (LOVER) (Inst.)":["Lover (Instrumental)"],"재밌어? (Love is)":["Love Is"],"손만 잡고 잘게 (Because I Care)":["Because I Care"],"화나게 해 (Make Me Sick)":["Make Me Sick"],"7월의 만남 (July)":["July"],"안녕?! (High Five)":["High Five"],"뭐가 문제야 (What's Problem)":["What’s Problem"],"바람이 분다":["Love Comes"],"사각지대 (Warning Sign)":["Warning Sign"],"가지마 (Please, don't go)":["Please, Don't Go"],"기다리죠 (Day after Day)":["Day After Day"],"술마시지마 (Don't drink)":["Don’t Drink"],"아침부터 아침까지 (ah-ah)":["Ah-Ah"],"5계절 (5 Seasons)":["5 Seasons"],"그 전화 받지 마 (Please)":["Please"],"헷갈려 (Confusing)":["Confusing"],"눈사탕 (Snow Kiss)":["Snow Kiss"],"메리 크리스마스 (Merry Christmas)":["Merry Christmas"],"겨울노래 (Winter Song)":["Winter Song"],"우린 문제 없어 (I'm Sorry)":["I’m Sorry"],"아니야 (No)":["No"],"쉽지않아 (Missing)":["Missing"],"혼자 사니? (Alone?)":["Alone?"],"울어 (Cry)":["Cry"],"지독하다 (Love Is...)":["Love Is..."],"리모콘 (Remote Control)":["Remote Control"],"지독하다 (Love is...)":["Love is..."],"못났다 (Lovefool)":["Lovefool"],"장난아냐 (Rocking)":["Rocking"],"길을 걷다가... (Walk By...)":["Walk By…"],"배아파 (Jealousy)":["Jealousy"],"긴 생머리 그녀 (Miss Right)":["Miss Right"],"니가 아니라서 (Missing You)":["Missing You","Missing you"],"사랑하고 싶어 (I Wanna Love)":["I Wanna Love"],"왜 (Why)":["Why"],"너 땜에 못살아 (Mad At U)":["Mad at U"],"달콤해 (So Sweet)":["So Sweet"],"반해":["Fall in Love"],"나랑 사귈래?":["Be Ma Girl"],"나랑 사귈래? (Inst.)":["Be Ma Girl (Instrumental)"],"흔들어놔! (Shake it !)":["Shake It!"],"미치겠어":["I'm Gonna Crazy"],"미치겠어 (R&B Slow Mix)":["I'm Gonna Crazy (R&B Slow Mix) [Remix]"],"미치겠어 (Inst.)":["I'm Gonna Crazy (Instrumental)"],"향수 뿌리지마":["No More Perfume On You"],"손등이 스친다":["The Back of My Hand Brushes Against"],"향수 뿌리지마 (Inst.)":["No More Perfume On You (Instrumental)"],"박수 (Clap)":["Clap"],"춤춰! (Let's Dance)":["Let's Dance"],"박수 (Inst.)":["Clap (Instrumental)"],"춤춰! (Inst.)":["Let's Dance (Instrumental)"]},
  "파우":{"다정해지는 법":["Being Tender"],"이유":["Reason"],"항상 그 자리에 있어":["Always There"]},
  "판타지보이즈":{"뛰어 (RUN)":["RUN"],"꽉 잡아 (Hold Tight)":["Hold Tight"]},
  "퍼플키스":{"아지트 (agit)":["agit"],"불꽃 (FireFlower)":["FireFlower"],"날 좀 봐 (Oh My Gosh)":["Oh My Gosh"],"좋아 (JOAH)":["JOAH"],"빈틈 (Cursor)":["Cursor"],"새벽 2시 (2am)":["2am"],"돼지 목에 진주 목걸이 (Cast pearls before swine)":["Cast pearls before swine"],"눈물과 보석, 별 그리고 너 (Twinkle)":["Twinkle"],"마침표 (Period)":["Period"]},
  "페이":{"괜찮아 괜찮아 Fantasy":["Fantasy"]},
  "펜타곤":{"겁쟁이":["Coward"],"한탕 (One Shot)":["One Shot"],"관람차 (Sparkling Night)":["Sparkling Night"],"그해 그달 그날":["COSMO"],"Dr. 베베":["Dr. BeBe"],"도망가자 (HAPPINESS KR Ver.)":["Happiness"],"에일리언":["Beautiful"],"봄눈":["Humph"],"오늘까지만":["Stuck"],"예쁨":["SHINE ON ME"],"약속":["With UNIVERSE"],"다른 우리(A-HA!) (Sung by 진호, 키노)":["A-HA!"],"다른 우리 (A-HA!) (Inst.)":["A-HA! (Instrumental)"],"불꽃":["Eternal Flame"],"소행성 (Asteroid)":["Asteroid"],"빗물 샤워 (Shower of Rain)":["Shower of Rain"],"동백꽃 (Camellia)":["Camellia"],"청개구리":["Naughty Boy"],"저두요!! (Just do it yo!!)":["Just do it yo!!"],"밤에 비가 내리면":["When It Rains in Night"],"惡夢 - wake up - / 악몽":["悪夢"],"忘れられない / 잊을 수가 없어":["忘れられない"],"光-HIKARI- / 빛":["光"],"미지근해":["Lukewarm"],"귀 좀 막아줘 (Organic Song) (이던, 유토, 우석 With 후이)":["Organic Song"]},
  "포미닛":{"미쳐":["Crazy"],"오늘 뭐해":["Whatcha Doin' Today"],"싫어 (Hate)":["Hate"],"싫어 (Hate) (Inst.)":["Hate (Instrumental)"],"1절만 하시죠":["Cut It Out"],"간지럽혀":["Tickle Tickle Tickle"],"추운 비":["Cold Rain"],"알려 줄게":["I'll Teach You"],"들어와":["Come In"],"고마워 :)":["Thank You :)"],"물 좋아?":["Is It Poppin'?"],"이름이 뭐예요?":["What's Your Name?"],"거울아 거울아":["Mirror Mirror"],"모르는 척":["Pretending Not to Know"],"나쁘게":["Badly"],"홈런":["Earth's representative Rolling Stars (Original Soundtrack) 'home run'"],"태연하게 당연하게":["Cool and Naturally"],"사랑 만들기":["Personal Taste (Original Television Soundtrack), Pt. 3 - Making Love"],"징글징글 (Feat. 마리오, 에이맨)":["Jingle Jingle"],"징글징글 (Inst.)":["Jingle Jingle (Instrumental)"],"웃겨":["Funny"],"안 줄래":["Won't Give It to You"]},
  "프로미스나인":{"이랬다가 저랬다가":["Hot and Cold"],"의심하지 마":["Never Doubt It"],"가상 현실 데이트 매칭":["VR Date Matching"],"일장춘몽":["Dream On"],"가상 현실 데이트 어게인":["VR Date Again"],"어디일까 이곳은":["Where Am I"],"하얀 그리움":["White Memories"],"눈맞춤":["Eye Contact"],"달빛바다":["Sea of Moonlight"],"달빛바다 (Inst.)":["Sea of Moonlight (Instrumental)"],"별":["Star"],"별(Inst.)":["Star (Instrumental)"],"별의 밤":["Starry Night"],"물고기":["Mulgogi"],"다가가고 싶어":["Close To You"],"너를 따라, 너에게":["Think of You"],"두근두근(DKDK)":["Pitapat (DKDK)"],"22세기 소녀":["22Century Girl"],"나에게로 오는 길 (Intro.)":["The Way To Me (Intro)"],"환상속의 그대":["Miracle"],"피노키오":["Pinocchio"],"유리구두 (MAMA Ver.)":["Glass Shoes (MAMA Version)"],"유리구두":["Glass Shoes (From fromis_9 Pre-Debut)"]},
  "프리스틴":{"티나 (TINA)":["Tina"],"너 말야 너":["You're My Boy"]},
  "플레어유":{"너의 계절이 찾아와 (Bloom)":["Bloom"],"백일밤 (Hundred Nights)":["Hundred Nights"],"잠시 너를 잊었어 (Never Ever)":["Never Ever"],"우니까 (Don’t Cry)":["Don’t Cry"],"놀이터 (Playground)":["Playground"]},
  "플레이브":{"꽃송이들의 퍼레이드":["Blossom Parade"],"흥흥흥 (feat. SOLE)":["HMPH! (feat. SOLE)"],"그런 것 같아":["Think I Am"],"버추얼 아이돌":["Virtual Idol"],"우리 영화":["Our Movie"],"기다릴게":["Wait for you"],"기다릴게 (Inst.)":["Wait for you (Inst.)"],"꾼":["GGUN"],"푸른 하늘에 단비":["Sweet Rain"],"괜찮아 사랑이니까 (Original)":["Love Is Enough (Original)"],"괜찮아 사랑이니까 (Original) (Inst.)":["Love Is Enough (Original, Inst.)"],"봉숭아":["Bongsoong-a"],"왜요 왜요 왜?":["Why?"]},
  "피에스타":{"짠해":["You’re pitiful","You’re Pitiful"],"짠해 (inst.)":["You’re pitiful (Inst.)"],"입술 한 모금":["A Sip of Lips"],"갈증":["Thirst"],"왔다갔다":["Come and Go"],"불 좀 꺼줘요":["Turn Off the Light"],"타이트해":["So Tight"],"하나 더 (One More)":["One More"],"아무것도 몰라요":["I Don't Know"],"머리 어깨 무릎 발":["Head Shoulder Knee and Toes"],"아무것도 몰라요 (R. Tee Remix)":["I Don't Know (R. Tee Remix)"],"달빛바다 (FIESTAR Ver.)":["Moonlight Sea (FIESTAR Version)"]},
  "피원하모니":{"때깔 (Killin' It)":["Killin' It"],"꿍꿍이 (Love Story)":["Love Story"],"태양을 삼킨 아이 (Look At Me Now)":["Look at Me Now"],"배낭여행 (Better Together)":["Better Together"],"둠두둠 (Doom Du Doom)":["Doom Du Doom"],"겁나니 (Scared)":["Scared"],"끝장내 (End It)":["End It"],"Intro; 틀 (Breakthrough)":["Intro; Breakthrough"],"네모네이드 (Nemonade)":["Nemonade"],"이거지 (That’s It)":["That's It"],"틀 (Breakthrough) (Full Version)":["Breakthrough (Full Version)"]},
  "피프티피프티":{"얼음공주":["Ice Princess (Kor Ver.)"],"얼음공주 (Eng ver.)":["Ice Princess (Eng ver.)"],"얼음공주 (Inst.)":["Ice Princess (Inst.)"],"가위바위보":["Eeny meeny miny moe"],"가위바위보 (Eng. ver)":["Eeny meeny miny moe (Eng. ver)"]},
  "피프틴앤드":{"사랑은 미친짓 (Feat. 칸토 of 트로이)":["Love is Madness (feat. Kanto)"],"티가 나나봐":["Can't hide it","Can't Hide It"]},
  "픽시":{"편지":["The Letter"],"귓속말":["Whisper"],"숨":["Breath"],"안부":["Greetings"],"불러불러 (Call me)":["Call me"],"불러불러 (Call me) (Inst.)":["Call me (Instrumental)"],"중독 (Addicted)":["Addicted"],"중독 (Addicted) (Inst.)":["Addicted (Instrumental)"],"날개 (Wings)":["Wings"]},
  "핑클":{"남아있는 노래처럼":["Like the Song Remains"],"남아있는 노래처럼 (Instrumental)":["Like the Song Remains (Instrumental)"],"내 남자 친구에게":["To My Boyfriend"],"영원한 사랑":["Forever Love"],"루비(淚悲):(슬픈 눈물)":["Ruby (Sorrowful Tears)"],"화이트 (White)":["White"],"자존심":["Pride"],"영원":["Forever"],"그대안의 나":["Me in You"],"나만의 비밀 (Iloveschool)":["Iloveschool"],"나의 왕자님께":["To My Prince"],"화이트":["White"],"기도 (Without You)":["Without You"],"로즈 (Rose)":["Rose"],"숨겨진 그림자 (To My Friend)":["To My Friend"]},
  "하민우":{"행복하자":["Now and On"],"행복하자 (Inst.)":["Now and On (Instrumental)"],"스릴러 (Thriller) (Feat. 루디밀러)":["Thriller (feat. Ruddie Miller)"]},
  "하성운":{"그때의 나에게":["Dear my past self"],"그때의 나에게 (Inst.)":["Dear my past self (Instrumental)"],"다시 첫사랑":["In Love With You"],"다시 첫사랑 (Inst.)":["In Love With You (Instrumental)"],"그때의 우리":["Us in Those Days"],"그때의 우리 (Inst.)":["Us in Those Days (Instrumental)"],"선물":["Gift"],"선물 (Inst.)":["Gift (Instrumental)"],"어떻게 생각해?":["Say Yes"],"바다 (Baby Blue)":["Baby Blue"],"너라는 꿈":["Who You Are"],"너라는 꿈 (Inst.)":["Who You Are (Instrumental)"],"티격태격":["Squabble"],"티격태격 (Inst.)":["Squabble (Inst.)"],"스니커즈 (Sneakers)":["Sneakers"],"영화 한 편 볼까 하는데":["Why don't you see a movie?"],"겨우살이":["Don’t leave me alone"],"야광별":["Starlight"],"그 섬 (Forbidden Island)":["Forbidden Island"],"촛불 (Candle light)":["Candle light"],"행성 (Without you)":["Without you"],"말해줘요 (Talk to me)":["Talk to me"],"우연일까":["Serendipity"],"우연일까 (Inst.)":["Serendipity (Inst.)"],"궁금‘s":["Curiou's"],"다시 찾아온 12월 이야기":["The Story of December"],"블루메이즈 (Bluemaze)":["Bluemaze"],"저기요":["Hey There"],"오늘 뭐해?!":["What Are You Doing Today?!"],"면역력":["Immunity"],"면역력 (Inst.)":["Immunity (Instrumental)"],"라이딩 (Riding) (Feat. 개코)":["Riding (feat. Gaeko)"],"오.꼭.말":["Tell me I love you"],"문득":["Remember You"],"잊지마요 (Feat. 박지훈)":["Don't Forget (feat. PARK JI HOON)"]},
  "하이라이트":{"일하러 가야 돼":["Gotta Go to Work"],"리본":["Ribbon"],"가까이 (Stay) - Live":["Stay - Live"],"불러보지만 - Live":["Though I Call Your Name - Live"],"없는 엔딩 (Endless Ending) - Live":["Endless Ending - Live"],"비가 오는 날엔 - Live":["On Rainy Days - Live"],"12시 30분 - Live":["12:30 - Live"],"얼굴 찌푸리지 말아요 - Live":["Plz Don′t Be Sad - Live"],"밤이야":["Midnight"],"잘 지내줘":["TAKE CARE"],"얼굴 찌푸리지 말아요":["Plz Don’t Be Sad"],"아름답다":["It′s Still Beautiful"],"시작":["The Beginning"]},
  "하이키":{"행복합니다":["We’re Happy"],"행복합니다 (Inst.)":["We’re Happy (Inst.)"],"낭만 한도 초과":["Be full of Romantic"],"나의 첫사랑에게 (To. My First Love)":["To. My First Love"],"세상은 영화 같지 않더라":["Not Like a Movie"],"나의 첫사랑에게 (To. My First Love) (Inst.)":["To. My First Love (Instrumental)"],"세상은 영화 같지 않더라 (Inst.)":["Not Like a Movie (Instrumental)"],"여름이었다":["Summer Was You"],"내 이름이 바다였으면 해":["Let Me Be Your Sea"],"여름이었다 (Inst.)":["Summer Was You (Instrumental)"],"뜨거워지자 (Let It Burn)":["Let It Burn"],"나를 위한, 나에 의한, 나만의 이야기 (Iconic)":["Iconic"],"국지성호우 (Rainfalls)":["Rainfalls"],"불빛을 꺼뜨리지 마 (Time to Shine)":["Time to Shine"],"불빛을 꺼뜨리지 마 (Time to Shine) (Inst.)":["Time to Shine (Instrumental)"],"건물 사이에 피어난 장미 (Rose Blossom)":["Rose Blossom"],"건물 사이에 피어난 장미 (Rose Blossom) (Inst.)":["Rose Blossom (Instrumental)"],"기뻐 (Deeper)":["Deeper"],"기뻐 (Deeper) (Instrumental)":["Deeper (Instrumental)"]},
  "하이파이유니콘":{"웃는다":["Smile"],"너라는 중력":["Gravity"],"종이비행기를 접는 이유":["Airplane"],"어쩌다가":["By Chance"],"반짝 너 하나":["Only You Shine"],"라일라":["LAILA"],"난 넌 우린":["You And I"],"난 넌 우린 (Inst.)":["You And I - Inst."],"내 머리에 열이 나":["FEVER"],"내 머리에 열이 나 (Inst.)":["FEVER - Inst."],"오늘도 너야":["Still You"]},
  "하츠웨이브":{"어리버리":["Outta my mind"],"우리만의 이야기 (Close To Me)":["Close To Me"]},
  "하츠투하츠":{"처음투성이 (Baby Steps)":["Baby Steps"]},
  "하트오브우먼":{"나를 잃지 않는 방법 (Lost in Proof)":["Lost in Proof"],"달라 ($.$)":["($.$)"],"북극성 (Daydreaming)":["Daydreaming"]},
  "하현곤":{"다시 오면 안될까?":["Can't You Come Back?"],"다시 오면 안될까? (MR)":["Can't you come back? (Instrumental)"]},
  "한겸":{"생각이나 (Narration.MISEO)":["Feedback (Narr.MISEO)"]},
  "한승연":{"시간의 온도":["The Temperature of Time"],"시간의 온도 (Inst.)":["The Temperature of Time (Instrumental)"]},
  "한승우":{"행복회로":["Positive Vibes"],"행복회로 (Inst.)":["Positive Vibes (Instrumental)"],"새벽 끝":["Dawn"],"다시 만나":["See You Again"],"겉과 속":["On & Off"],"너를 만난 후로 참 행복했다고":["We Loved Each Other"],"답장해":["Reply"],"원해":["I Just Want Love"],"철부지":["Child"]},
  "핫샷":{"니가 미워":["I Hate You"],"젤리 (Jelly)":["Jelly"],"젤리 (Jelly) (Inst.)":["Jelly (Instrumental)"]},
  "해원":{"마루는 강쥐":["Maru is a Puppy"],"마루는 강쥐 (Inst.)":["Maru is a Puppy (Inst.)"]},
  "해윤":{"보고싶어 지금":["I miss you now"],"보고싶어 지금 (Inst.)":["I miss you now (Instrumental)"]},
  "해찬":{"니가 좋은 이유":["A Thousand Reasons"],"니가 좋은 이유 (Inst.)":["A Thousand Reasons (Instrumental)"],"좋은 사람 (2022)":["Good Person"],"좋은 사람 (2022) (Inst.)":["Good Person (Instrumental)"]},
  "허영생":{"만약에 우리 (Korean)":["moshimo (Korean Version)"],"종이여자 (Rhodanthe)":["Rhodanthe"],"종이여자 (Rhodanthe) (Inst.)":["Rhodanthe (Instrumental)"],"니가 뭘 알아":["What Do You Know?"],"사랑받고 싶었어":["Want To Be Loved"],"너라서":["Because of You"],"가을 길목":["Autumn Days"],"휴..":["Hue.."],"몸이 약한 아이":["Vulnerable"],"못다한 이야기":["Untold Story"],"몸이 약한 아이 (Inst.)":["Vulnerable (Instrumental)"],"작업의 정석":["How to Get Girls"],"그게 나야":["That′s Me"],"알아 다":["I Know All"],"작업의 정석 (Inst.)":["How to Get Girls (Instrumental)"],"슬픈 노래는":["Sad Song"],"슬픈 노래는 (Inst.)":["Sad Song (Instrumental)"]},
  "헬로비너스":{"빛이 내리면 (Glow)":["Glow"],"난 예술이야":["I'm Ill"],"카멜레온":["Chameleon"],"난 예술이야 (Club Remix)":["I'm ill (Club Remix)"],"위글위글":["Wigglewiggle"],"끈적끈적":["Stickysticky"],"위스키 (Whisky)":["Whisky"],"끈적끈적 (Inst.)":["Stickysticky (Instrumental)"],"차 마실래?":["Walk Me Home"],"잠깐만":["Hold On"],"자꾸만":["Again and Again"],"오늘 뭐해?":["What Are You up to Today?"],"똑같아":["Just The Same"],"파도처럼":["Like A Wave"],"설레임":["Excitement"]},
  "혁":{"혼자 남은 밤":["night left alone"],"혼자 남은 밤 (Inst.)":["night left alone (Instrumental)"],"서른즈음에 (Prod. 정동환)":["around thirty"],"서른즈음에 (Prod. 정동환) (Inst.)":["around thirty (Instrumental)"],"너의 밤은 아프지 않기를":["A Long Night"],"너.나.꿈":["You, Me and Dream"],"너.나.꿈 (Inst.)":["You, Me and Dream (Instrumental)"]},
  "현성":{"눈이 부시게":["Our Dazzling Tomorrow"],"따스한 밤":["WHITE NIGHT"],"그날의 나 그리고 너":["Always be there"],"너였어":["It was you"],"몇 밤":["Nights"],"바람길":["Wind Road"],"바람길 (Inst.)":["Wind Road (Instrumental)"]},
  "현아":{"어때?":["How's This?"],"빨개요":["Red"],"나빌레라":["Nabillera"],"띵가띵가":["whatever"],"베베 (BABE)":["Babe"],"보라색 (With 이던 Of 펜타곤)":["Purple (with E'dawn)"],"자화상":["Mirror"],"나팔꽃 (Feat. 김아일)":["Morning Glory (feat. Isle Qim)"],"꼬리쳐":["Freaky"],"흐트러지지 마":["Straight Up"],"풋사과 (Feat. 정일훈 Of BTOB)":["Green Apple (feat. JUNG ILHOON)"],"내 남자친구에게":["Dear Boyfriend"]},
  "혜빈":{"사랑이라 말하기엔 서로 너무 아팠으니까":["It hurt too much to say it′s love"],"사랑이라 말하기엔 서로 너무 아팠으니까 (Inst.)":["It hurt too much to say it′s love (Instrumental)"]},
  "호시":{"아기자기":["Baby, Honey"]},
  "호야":{"점":["Reply"],"한숨":["Sigh"],"춤 (Outro)":["Dance (Outro)"]},
  "홍빈":{"꿈을 그린다":["Make A Dream"],"꿈을 그린다 (Inst.)":["Make A Dream (Instrumental)"]},
  "화사":{"화사한 밤 (just talking to myself)":["just talking to myself"],"화사한 밤 (just talking to myself) (Inst.)":["just talking to myself (Instrumental)"]},
  "효린":{"지워":["Erase"],"맛있게드세요":["Bon appétit"],"이게 사랑이지 뭐야 (feat. Paul Blanco)":["This love (feat. Paul Blanco)"],"비개인 (BEGAN)":["BEGAN"],"비개인 (BEGAN) (Inst.)":["BEGAN (Instrumental)"],"아하 (A-Ha)":["A-Ha"],"없던 이유 (feat. 매드 클라운, 김승민)":["To Find a Reason (feat. Mad Clown & Kim Seungmin)"],"모닝콜 (Morning Call)":["Morning Call"],"달리 (Dally) (feat. GRAY)":["Dally (feat. GRAY)"],"바다보러갈래 (SEE SEA)":["SEE SEA"],"말 없이 안아줘 (feat. 크루셜스타)":["Hug Me Silently (feat. Crucial Star)"],"니가 더 잘 알잖아 (youknowbetter)":["youknowbetter"],"달리 (Dally) (Feat. GRAY)":["Dally (feat. GRAY)"],"내일할래 (To Do List)":["To Do List"],"스쳐간 꿈처럼":["Dreamy Love"],"스쳐간 꿈처럼 (Inst.)":["Dreamy Love (Instrumental)"],"서로의 눈물이 되어":["Our Tears"],"서로의 눈물이 되어 (Inst.)":["Our Tears (Instrumental)"],"보고싶어":["I Miss You"],"보고싶어 (Inst.)":["I Miss You (Instrumental)"],"더 가까이":["Come a Little Closer"],"더 가까이 (Inst.)":["Come a Little Closer (Instrumental)"],"안녕":["Good bye"],"안녕 (Inst.)":["Good bye (Instrumental)"],"너 밖에 몰라 (One Way Love)":["One Way Love"],"사랑 하지 마 (Don't Love Me)":["Don't Love Me"],"스토커 (Feat. 매드클라운) (Stalker)":["Stalker (feat. Mad Clown)"],"마사지 (Feat. Dok2) (Massage)":["Massage (feat. .Dok2)"],"립스틱 짙게 바르고 (Feat. ZICO Of Block B) (Red Lipstick)":["Red Lipstick (feat. Zico)"],"오늘 밤 (Tonight)":["Tonight"]},
  "효민":{"입꼬리 (Jazz Ver.)":["Allure (Jazz Version)"],"입꼬리":["Allure"],"으음으음(U Um U Um)":["U Um U Um"],"눈가에 한 방울(YOU)":["You"],"입꼬리 (Chinese Ver.)":["Allure (Chinese Version)"],"으음으음(U Um U Um) (Chinese Ver.)":["U Um U Um (Chinese Version)"],"으음으음(U Um U Um) (Inst.)":["U Um U Um (Instrumental)"]},
  "효정":{"나의 작은 청춘에게":["Purple Note"],"나의 작은 청춘에게 (Inst.)":["Purple Note (Instrumental)"],"내일 만나면 좋아한다 말해줘":["Eve"],"내일 만나면 좋아한다 말해줘 (Inst.)":["Eve (Instrumental)"],"크리스마스 야간열차":["Hot December"],"크리스마스 야간열차 (Inst.)":["Hot December (Instrumental)"]},
  "효진":{"너의 하루에 작은 꽃이 되어줄게":["Let me be a small flower in your day"],"너의 하루에 작은 꽃이 되어줄게 (Inst.)":["Let me be a small flower in your day (Inst.)"],"너를 사랑하는 일 (Love Things)":["Love Things"],"마음이 필요해":["Need Your Heart"],"마음이 필요해 (Inst.)":["Need Your Heart (Instrumental)"],"오늘이 지나기 전에":["Before Today Is Over"],"오늘이 지나기 전에 (Inst.)":["Before Today Is Over (Instrumental)"]},
  "후이":{"잡초 (With 장혜진)":["Nameless (feat. Jang Hye Jin)"]},
  "휘브":{"청사진(PAGES OF US)":["PAGES OF US"],"배로 (Rush of Joy)":["Rush of Joy"],"해! (Play)":["Play"]},
  "휘인":{"다 핀 꽃":["Blossom Flower (From IT'S OKAY!)"],"다 핀 꽃 (Inst.)":["Blossom Flower (From IT'S OKAY!) [inst.]"],"세 번의 날갯짓을 약속해":["Butterfly"],"세 번의 날갯짓을 약속해 (Inst.)":["Butterfly (Instrumental)"],"이별의 맛":["Aftertaste"],"이별의 맛 (inst.)":["Aftertaste (Instrumental)"],"장마 (남은 인생 10년 X 휘인 (Whee In))":["Rainy Season (The Last 10 Years)"],"장마 (남은 인생 10년 X 휘인 (Whee In)) (Inst.)":["Rainy Season (The Last 10 Years) [Instrumental]"],"휘이 (Prod. Young K (DAY6), 나상현)":["Wheee"],"불꽃 (Spark)":["Spark"],"숨결 (Breeze)":["Breeze"],"광합성 (Feat. Colde)":["Sunny Shower (feat. Colde)"],"잊어야 하는 그대":["The Only One Have to Forget"],"잊어야 하는 그대 (Inst.)":["The Only One Have to Forget (Instrumental)"],"추억 속의 그대":["CHU EOG SOG EUI GEU DAI (From \"You Hee yul's Sketchbook With you : 85th Voice 'Sketchbook X Whee In', Vol. 132\")"],"봄바람":["Spring wind (From \"You Hee yul's Sketchbook With you : 85th Voice 'Sketchbook X Whee In', Vol. 131\")"],"너의 하루 끝에":["In your days"],"너의 하루 끝에 (Inst.)":["In your days (Instrumental)"],"너, 너 (N번째 연애 X 휘인 (Whee In))":["You, you (Nth Romance)"],"너, 너 (N번째 연애 X 휘인 (Whee In)) (Inst.)":["You, you (Nth Romance) [Instrumental]"],"오묘해":["Make Me Happy"],"파스텔":["Pastel"],"바라고 바라":["I wish"],"바라고 바라 (Inst.)":["I wish (Instrumental)"],"오후 (OHOO)":["OHOO"],"그렇게 넌 내게 빛나":["Shine on You"],"그렇게 넌 내게 빛나 (Inst.)":["Shine on You (Instrumental)"],"내 눈물 모아":["With My Tears"],"내 눈물 모아 (Inst.)":["With My Tears (Instrumental)"]},
  "희재":{"이상기류":["Turbulence"],"너의 내일로":["Into Your Tomorrow"],"도약":["THE LEAP"],"사랑해 엄마":["I love you mom"]},
  "희진":{"난 모든 기억을 지워야만 했어":["I Had To Erase Every Memory"],"난 모든 기억을 지워야만 했어 (Inst.)":["I Had To Erase Every Memory (Instrumental)"],"개화":["Kehwa"]},
  "A SIX":{"사랑 모두 거짓말 (Sad Story)":["Sad Story"]},
  "ATBO":{"우린 뭐 없이도":["My Way"],"사랑해줘":["Love Me"]},
  "B.D.U":{"변함없는 기적":["Everlasting Miracle"],"다 잊어":["Forget All"]},
  "B.I":{"추락 (Free fall)":["Free fall"],"달나라 (To the moon)":["To the moon"],"눈길 (Gaze)(feat.Gemma Kang)":["Gaze (feat. Gemma Kang)"],"관람차 (Ferris wheel)(feat.Heize)":["Ferris wheel (feat. Heize)"],"안아줄래요 (Hug me)":["Hug me"],"반딧불이 (Firefly)":["Firefly"],"시간아 (Stopwatch)":["Stopwatch"],"해변 (illa illa)":["illa illa"],"긴 꿈 (Daydream) (Feat. 이하이)":["Daydream (feat. LeeHi)"],"꿈결 (Illusion)":["Illusion"],"역겹겠지만 (Remember me)":["Remember me"],"비 온 뒤 흐림 (GRAY)":["GRAY"],"그땐 내가 (Then)":["Then"],"다음 생 (Re-Birth)":["Re-Birth"],"깊은 밤의 위로 (Donation Project)":["Midnight Blue (Donation Project)"],"내 걱정 (Donation Project)":["Blossom (Donation Project)"]},
  "BAE173":{"걸음마 (get him UGH)":["get him UGH"],"반하겠어 (Crush on U)":["Crush on U"]},
  "BOBBY":{"꽐라":["HOLUP!"]},
  "CL":{"+처음으로170205+":["+REWIND170205+"],"+투덜거려본다171115+":["+PARADOX171115+"],"+안해180327+":["+I QUIT180327+"],"+소중한 추억190519+":["+THNX190519+"],"나쁜 기집애":["The Baddest Female"]},
  "god":{"날 기다려줘":["Step by Step"],"왜 또 다시 난":["Freestyle (With G.O.D.)"]},
  "H.O.T.":{"For 연가":["A Song For Lady"],"투지 (鬪志, Git It Up!)":["Git it up!"],"아이야!":["I Yah!"],"나의 너":["My Girl"],"축복":["Celebrate"],"영혼":["Soul"],"환희":["It's Been Raining Since You Left Me"],"다시 시작해":["Forver Song"],"고마워, 미안해 (Together, Forever)":["Together, Forever"],"빛":["Hope"],"열맞춰!":["Line Up"],"투혼":["The Sprit of Fighter"],"우리들의 맹세":["The Promise of H.O.T."],"소년이여! 신화가 되어라 (Boys, Be A Legend!)":["Boys, Be a Legend!"],"홀로서기":["All Alone"],"후에...":["Since You`ve Gone"],"하나라는 아름다운 느낌":["Unity Is as Beautiful as One"]},
  "JAY B":{"잠시만":["One Moment"],"흔들의자 (Rocking Chair)":["Rocking Chair"],"흔들의자 (Rocking Chair) (Inst.)":["Rocking Chair (Inst.)"]},
  "JBJ":{"꽃이야":["My Flower"]},
  "JUN.K":{"집":["Home"],"스케치북":["Sketchbook"],"30분은 거절할까 봐":["30 Minutes Might Be Too Long"],"미끄럼틀":["Slip 'N Slide"],"평행선":["Parallel Lines"],"쉼표":["Comma (Korean Version)"],"솔직히 말할게":["Honestly"],"11월부터 2월까지 (Feat. 소미)":["Nov to Feb (feat. Somi)"],"이사하는 날":["A Moving Day"],"왜 (Feat. 박지민)":["Why (feat. PARK JI MIN)"],"나의 20대 (Feat. 더블케이)":["My 20's (feat. Double K)"],"결혼식":["Your Wedding"],"가지마":["Don't Leave Me"],"사랑... 안녕":["Love... Goodbye"],"사랑... 안녕 (Inst.)":["Love... Goodbye (Instrumental)"]},
  "JYJ":{"낙엽 (Fallen Leaves)":["Fallen Leaves"],"소년의 편지 (The Boy's Letter)":["The Boy's Letter"]},
  "Kei":{"바람의 노래":["Wind Song"],"바람의 노래 (Inst.)":["Wind Song (Instrumental)"],"연가(戀歌)":["Love Song"],"연가(戀歌) (Inst.)":["Love Song (Instrumental)"],"그런 날이 오게 될까?":["Will My Day Ever Come? (From\"Midnight Sun\" Original Musical Sound Track, Pt. 5)"],"종이달":["Paper Moon"],"이 비(雨)":["Rain"],"별과 해":["Star and Sun"],"별과 해 (Inst.)":["Star and Sun (Inst.)"]},
  "MJ":{"발렛 파킹":["Valet Parking"]},
  "NRG":{"티파니에서 아침을 remix":["Nostalgia"],"구원 (Remix)":["Messenger (Remix)"],"정상에서 만나자":["See You At The Top"]},
  "S.E.S.":{"한 폭의 그림":["Paradise"],"산다는 건 다 그런 게 아니겠니":["Life"],"그대로부터 세상 빛은 시작되고 (The Light)":["The Light"],"편지":["The Letter"],"샤랄라 (Remix)":["Sharala (Remix)"],"너를 사랑해 (Remix)":["Loving You (Remix)"],"꿈을 모아서 (Just In Love) (Remix)":["Just in Love (Remix)"],"사랑이라는 이름의 용기":["In the Name of Love"],"꿈을 모아서":["Just in Love"],"달 끝까지":["Beyond the Moon"],"감싸 안으며":["Show Me Your Love"],"나를 위한 이별 (Good-bye To My Love)":["Good-Bye to My Love"],"그대 맘도 나와 같다면 (Melody)":["Melody"],"바람둥이 길들이기 (Taming A Playboy)":["Taming a Playboy"]},
  "SJM":{"태완미 / 太完美 (Perfection) (Japanese Ver.)":["太完美 (Perfection) (Japanese Ver.)"],"명운선 / 命運線 (Destiny) (Japanese Ver.)":["命運線 (Destiny) (Japanese Ver.)"]},
  "SS501":{"We Can Fly (진에어(JINAIR) 이미지송)":["We Can Fly"],"데자뷰":["Dejavu"]},
  "YEL":{"나르시시스트 (Narcissist)":["Narcissist"],"나르시시스트 (Narcissist) (inst.)":["Narcissist (inst.)"],"그냥 나와":["Come Out"],"조제 (JOSEE) (Feat. Sondia)":["Josee (feat. Sondia)"]},
  "Young K":{"응원가":["Anthem"],"우리가 헤어질 100가지 이유 (with JINJOO of DNCE)":["A Hundred Whys for Goodbye"],"집으로 향한다":["Heading Home"],"안개꽃":["Gypsophila"],"작업실에서 커피를":["Ordinary Days"],"다시 돌아온 계절":["Season of Us (My Royal Nemesis : Original Television Soundtrack)"],"다시 돌아온 계절 (Inst.)":["Season of Us (My Royal Nemesis : Original Television Soundtrack) [Instrumental]"],"나무가 될게":["Love will find a way"],"나무가 될게 (Inst.)":["Love will find a way (Instrumental)"],"너의 곁에 세븐일레븐":["7-ELEVEN with you"],"나비":["Butterfly"],"나비 (Inst.)":["Butterfly (Instrumental)"],"아마도 사랑인가 봐":["Am I in Love?"],"아마도 사랑인가 봐 (Inst.)":["Am I in Love? (Inst.)"],"베스트 송":["best song"],"끝까지 안아 줄게":["Guard You"],"사랑은 얼어 죽을":["not gonna love"],"그대로 와 줘요":["come as you are"],"잘 자라 내 사람아":["goodnight, dear"]},
};
// 주인(그룹 이름 또는 솔로 이름) + 디스코 곡 제목 → 영문 제목 배열(없으면 null). 멜론 표기 차이('(Feat. …)' 꼬리·괄호 영문)는 _songBase로 흡수
let _SONG_ALIAS_BASE=null;
// 언어별 곡 표기(2026-11-12 사용자): 한국어 = 정본(한국 활동 곡명) 그대로('산소 같은 너 (Love Like Oxygen)'),
// 영어 = 곡의 en(영어로만 들어왔던 곡에 남긴 원래 영문 제목) → 영문 별칭 → '한글 (English)'의 괄호 속 영어 → 한글이 없으면 그대로('404 (New Era)').
// en: 디스코 곡 객체의 en(있으면). 피처링·판본 괄호는 영어 제목으로 보지 않는다.
function _songTitleFor(owner,title,lang,en){
  const t=String(title||'').trim();
  if(lang!=='en')return t;
  if(en)return String(en).trim();
  if(!/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(t))return t;
  const al=_songAliasesFor(owner,t);if(al&&al[0])return al[0];
  const m=/^(.+?)\s*\(([^()]*[A-Za-z][^()]*)\)/.exec(t);
  if(m&&!/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(m[2])&&!/^\s*(feat|ft|inst|ver|prod|remix|live|english|japanese|chinese|korean)\b/i.test(m[2]))return m[2].trim();
  return t;
}
function _songAliasesFor(owner,title){
  if(!owner||!title)return null;
  const m=_SONG_ALIASES[owner];if(!m)return null;
  if(m[title])return m[title];
  if(!_SONG_ALIAS_BASE)_SONG_ALIAS_BASE={};
  let bm=_SONG_ALIAS_BASE[owner];
  if(!bm){bm=_SONG_ALIAS_BASE[owner]=new Map();for(const k in m){const b=_songBase(k);if(b&&!bm.has(b))bm.set(b,m[k]);}}
  return bm.get(_songBase(title))||null;
}
