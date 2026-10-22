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
  '에스쿱스X민규':{names:['에스쿱스X민규'],members:[{mko:'에스쿱스',gko:'세븐틴'},{mko:'민규',gko:'세븐틴'}]},
  '도겸X승관':{names:['도겸X승관'],members:[{mko:'도겸',gko:'세븐틴'},{mko:'승관',gko:'세븐틴'}]},
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
  '호우':{names:['호우'],members:[{mko:'손호영',gko:'god'},{mko:'김태우',gko:'god'}]},
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
  'PRISTIN V':{names:['PRISTIN V','프리스틴 V'],members:[{mko:'로아',gko:'프리스틴'},{mko:'은우',gko:'프리스틴'},{mko:'레나',gko:'프리스틴'},{mko:'주결경',gko:'프리스틴'}]},
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
  '구구단 세미나':{names:['구구단 세미나','gugudan SEMINA'],members:[{mko:'김세정',gko:'구구단'},{mko:'김나영',gko:'구구단'}]},
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
const _SONG_COMMON=new Set(['love','baby','girls','girl','boys','dream','dreams','star','stars','magic','fire','light','heart','money','party','world','summer','winter','spring','happy','sorry','hello','smile','queen','king','game','time','life','home','night','dance','music','angel','crown','rain','snow','blue','gold','free','alone','again','forever','beautiful','intro','outro','interlude','shorts','live','stage','special','teaser','focus','close','with','only','more','what','this','that','yours','mine','good','bad','real','next','last','first','young','wild','sweet','pink','black','white','highlight','behind','vlog','episode','well','habit','yawn']);
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
  // ② 해시태그를 뺀 본문에서 곡명 포함 — 4글자 이상·흔한 낱말 아님·주인 이름 아님. 긴 곡명 안에 든 짧은 곡명은 버린다
  const noTags=t.replace(/#[^\s#]+/g,' ');
  const body=_songNorm(noTags);
  const tl=noTags.toLowerCase().normalize('NFKC'); // 단어 경계 검사용(공백·기호 살아 있는 소문자)
  const hits=[];
  for(const s of songs){
    // 길이 문턱: 한글만으로 된 곡명은 3글자부터('아낀다'·'손오공'), 나머지는 4글자부터(영어 'ON'·'HOT' 같은 짧은 낱말 오탐)
    if((/^[가-힣]+$/.test(s.b)?s.b.length<3:s.b.length<4)||_SONG_COMMON.has(s.b)||blocked.has(s.b))continue;
    if(!body.includes(s.b))continue;
    // 영어 곡명은 단어 단위로만 — 'ICON'이 '[Dicon]' 안에 걸리던 오탐(2026-10-16 표본). 원제목 낱말을 공백·기호 무관하게 이어 붙인 정규식
    if(/^[a-z0-9]+$/.test(s.b)&&s.title){
      if(s.re===undefined){
        const core=_songStripTail(s.title).replace(/\s*[\(\[][^)\]]*[\)\]]\s*$/,'')||s.title;
        const w=String(core).toLowerCase().normalize('NFKC').match(/[a-z0-9]+/g);
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
      if(blocked.has(al.n)||_SONG_COMMON.has(al.n)||!body.includes(al.n))continue;
      const hangul=/^[가-힣]+$/.test(al.n);
      if(hangul?al.n.length<3:al.n.length<5)continue; // 영어 별칭은 5글자부터 — '별빛 ⇐ Stay'·'엉망 ⇐ Mess' 같은 흔한 낱말은 따옴표로만
      if(/^[a-z0-9]+$/.test(al.n)){const w=al.raw.toLowerCase().normalize('NFKC').match(/[a-z0-9]+/g);if(w&&!new RegExp('(^|[^a-z0-9])'+w.join('[^a-z0-9]*')+'(?![a-z0-9])').test(tl))continue;}
      hits.push(s.b);break;
    }
  }
  hits.sort((a,b)=>b.length-a.length).forEach(b=>{if(!out.some(o=>o.includes(b)))add(b);});
  // ③ 아무것도 못 찾았을 때만 해시태그 — 곡과 정확히 같은 태그가 딱 한 곡일 때만(나열형 쇼츠 오탐 방지)
  if(!out.length){
    const tags=[...t.matchAll(/#([^\s#]+)/g)].map(m=>{const n=_songNorm(m[1]);return bset.has(n)?n:(amap.get(n)||null);}).filter(b=>b&&!blocked.has(b));
    const uniq=[...new Set(tags)];
    if(uniq.length===1)add(uniq[0]);
  }
  return out;
}
// 곡 창의 "제목으로 찾은 커버"(2026-10-22) — 주인 제한 없는 제목 검색 결과 중 **그 곡을 부른 영상**만 true.
// 제목에 곡명이 그냥 들어 있는 건 안 믿는다('엄마 잔소리'·'잔소리 STOP 챌린지'). 인정하는 건
//   ① 다른 주인의 같은 곡 키(song_keys '아이즈원:잔소리') ② 따옴표·꺾쇠 안 곡명 ③ "가수 - 곡명" 대시 뒤가 곡명으로 시작(짧은·흔한 곡명 제외)
// 다른 곡에만 연결된 영상(song_keys에 이 곡 없음)은 버린다.
function _songCoverByTitle(v,base){
  if(!v||!base)return false;
  const t=String(v.title||'');
  const keys=Array.isArray(v.song_keys)?v.song_keys:[];
  if(keys.length)return keys.some(k=>String(k).slice(String(k).indexOf(':')+1)===base);
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
  const seen=new Map();
  (albums||[]).forEach(a=>(a&&a.tracks||[]).forEach(tr=>{
    if(!tr||!tr.title||/\((?:inst\.?|instrumental|mr)\)\s*$/i.test(tr.title))return;
    // 한 글자 곡('특 (S-Class)'·'락 (樂) (LALALALA)')도 남긴다 — 본문 포함으론 절대 안 잡히고(길이 문턱) 따옴표·별칭으로만 연결된다
    const b=_songBase(tr.title);if(!b)return;
    let s=seen.get(b);if(!s){s={b,title:tr.title};seen.set(b,s);}
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
  return [...seen.values()];
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
