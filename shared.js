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
// 유튜브 채널 동기화 조회에 쓰는 키: 실존하는 그룹 소속이면 그 그룹 키를, 아이유처럼 소속 그룹이 없는
// 솔로 아티스트면 본인 이름을 키로 써서 본인 채널을 동기화/조회한다(그룹별 group_ko 컬럼 재사용).
function _ytGroupKoFor(a){return GROUPS[a.group.ko]?a.group.ko:a.name.ko;}

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
const _UNIT_HASHTAG_ONLY_TOKENS=new Set(['AAA','EVOLution','Glow','hatch!','NXT']);
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
  // 세븐틴 소유닛 — 부석순은 한때 groups.json 행성으로 등록됐다가 유닛 표기로 전환(2026-08-12, 사용자 요청).
  // 부석순 이름 유래: 부승관(Seungkwan)·이석민(DK)·권순영(Hoshi) 성명에서 각 한 글자씩.
  '부석순':{names:['부석순','BSS'],members:[{mko:'호시',gko:'세븐틴'},{mko:'도겸',gko:'세븐틴'},{mko:'승관',gko:'세븐틴'}]},
  '정한X원우':{names:['정한X원우','JeongWon'],members:[{mko:'정한',gko:'세븐틴'},{mko:'원우',gko:'세븐틴'}]},
  '호시X우지':{names:['호시X우지'],members:[{mko:'호시',gko:'세븐틴'},{mko:'우지',gko:'세븐틴'}]},
  '에스쿱스X민규':{names:['에스쿱스X민규'],members:[{mko:'에스쿱스',gko:'세븐틴'},{mko:'민규',gko:'세븐틴'}]},
  '도겸X승관':{names:['도겸X승관'],members:[{mko:'도겸',gko:'세븐틴'},{mko:'승관',gko:'세븐틴'}]},
  '아이린&슬기':{names:['아이린&슬기','레드벨벳 아이린&슬기','IRENE & SEULGI'],members:[{mko:'아이린',gko:'레드벨벳'},{mko:'슬기',gko:'레드벨벳'}]},
  'SM THE BALLAD':{names:['SM THE BALLAD','에스엠 더 발라드'],members:[{mko:'규현',gko:'슈퍼주니어'},{mko:'종현',gko:'샤이니'},{mko:'예성',gko:'슈퍼주니어'},{mko:'최강창민',gko:'동방신기'},{mko:'태연',gko:'소녀시대'},{mko:'첸',gko:'엑소'},{mko:'크리스탈',gko:'에프엑스'}]},
  'NCT U':{names:['NCT U','엔시티 유'],members:[
    {mko:'태용',gko:'엔시티 127'},{mko:'도영',gko:'엔시티 127'},{mko:'재현',gko:'엔시티 127'},{mko:'쟈니',gko:'엔시티 127'},{mko:'정우',gko:'엔시티 127'},{mko:'마크',gko:'엔시티 127'},{mko:'해찬',gko:'엔시티 127'},{mko:'유타',gko:'엔시티 127'},
    {mko:'런쥔',gko:'엔시티 드림'},{mko:'제노',gko:'엔시티 드림'},{mko:'재민',gko:'엔시티 드림'},{mko:'천러',gko:'엔시티 드림'},{mko:'지성',gko:'엔시티 드림'},
    {mko:'텐',gko:'웨이션브이'},{mko:'쿤',gko:'웨이션브이'},{mko:'윈윈',gko:'웨이션브이'},{mko:'샤오쥔',gko:'웨이션브이'},{mko:'양양',gko:'웨이션브이'},{mko:'헨드리',gko:'웨이션브이'},
    {mko:'성찬',gko:'라이즈'},{mko:'쇼타로',gko:'라이즈'}
  ]},
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
  '3RACHA':{names:['3RACHA','쓰리라차'],members:[{mko:'방찬',gko:'스트레이키즈'},{mko:'창빈',gko:'스트레이키즈'},{mko:'한',gko:'스트레이키즈'}]},
  '댄스라차':{names:['댄스라차'],members:[{mko:'리노',gko:'스트레이키즈'},{mko:'현진',gko:'스트레이키즈'},{mko:'필릭스',gko:'스트레이키즈'}]},
  '보컬라차':{names:['보컬라차'],members:[{mko:'승민',gko:'스트레이키즈'},{mko:'아이엔',gko:'스트레이키즈'}]},
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
  '빈챈현스':{names:['빈챈현스'],members:[{mko:'유니스',gko:'다이아'},{mko:'기희현',gko:'다이아'},{mko:'예빈',gko:'다이아'},{mko:'정채연',gko:'다이아'}]},
  'L.U.B':{names:['L.U.B','엘유비'],members:[{mko:'주은',gko:'다이아'},{mko:'은채',gko:'다이아'}]},
  // 프리스틴 서브유닛
  'PRISTIN V':{names:['PRISTIN V','프리스틴 V'],members:[{mko:'로아',gko:'프리스틴'},{mko:'은우',gko:'프리스틴'},{mko:'레나',gko:'프리스틴'},{mko:'결경',gko:'프리스틴'}]},
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
  'GD X TAEYANG':{names:['GD X TAEYANG','G-DRAGON X TAEYANG','GOOD BOY'],members:[{mko:'지디',gko:'빅뱅'},{mko:'태양',gko:'빅뱅'}]},
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
  'I.O.I (7인 유닛)':{names:['I.O.I 7인 유닛','Whatta Man'],members:[{mko:'임나영',gko:'아이오아이'},{mko:'김청하',gko:'아이오아이'},{mko:'주결경',gko:'아이오아이'},{mko:'김소혜',gko:'아이오아이'},{mko:'최유정',gko:'아이오아이'},{mko:'김도연',gko:'아이오아이'},{mko:'전소미',gko:'아이오아이'}]},
  'I.O.I (2인 유닛)':{names:['I.O.I 2인 유닛'],members:[{mko:'정채연',gko:'아이오아이'},{mko:'유연정',gko:'아이오아이'}]},
  // 워너원 유닛
  'Triple Position':{names:['Triple Position','트리플 포지션'],members:[{mko:'김재환',gko:'워너원'},{mko:'강다니엘',gko:'워너원'},{mko:'박우진',gko:'워너원'}]},
  'Lean On Me':{names:['Lean On Me','린온미'],members:[{mko:'윤지성',gko:'워너원'},{mko:'하성운',gko:'워너원'}]},
  'The Heal':{names:['The Heal','더 힐'],members:[{mko:'옹성우',gko:'워너원'},{mko:'이대휘',gko:'워너원'}]},
  '남바완':{names:['남바완'],members:[{mko:'박지훈',gko:'워너원'},{mko:'배진영',gko:'워너원'},{mko:'라이관린',gko:'워너원'}]},
  // EXID 서브유닛
  '다소니':{names:['다소니','Dasoni'],members:[{mko:'솔지',gko:'이엑스아이디'},{mko:'하니',gko:'이엑스아이디'}]},
  // SS501 서브유닛
  'FIVE O ONE':{names:['FIVE O ONE','파이브 오 원'],members:[{mko:'김현중',gko:'SS501'},{mko:'허영생',gko:'SS501'},{mko:'김규종',gko:'SS501'}]},
  // 구구단 서브유닛
  '구구단 오구오구':{names:['구구단 오구오구','gugudan OGUOGU'],members:[{mko:'신보라',gko:'구구단'},{mko:'장소진',gko:'구구단'},{mko:'류셰닝',gko:'구구단'},{mko:'정미미',gko:'구구단'},{mko:'김세정',gko:'구구단'},{mko:'강미나',gko:'구구단'},{mko:'김나영',gko:'구구단'}]},
  '구구단 세미나':{names:['구구단 세미나','gugudan SEMINA'],members:[{mko:'김세정',gko:'구구단'},{mko:'김나영',gko:'구구단'}]},
  // B.D.U — 빌드업 서바이벌 프로젝트 보이그룹(2024.06~2026.03), 행성 생성 없음
  'B.D.U':{names:['B.D.U','비디유','Boys Define Universe'],members:[{mko:'빛새온',gko:'솔로'},{mko:'승훈',gko:'씨아이엑스'},{mko:'제이 창',gko:'원팩트'},{mko:'김민서',gko:'솔로'}]},
  'UNB':{names:['UNB','유앤비'],members:[{mko:'강유찬',gko:'에이스'},{mko:'고호정',gko:'핫샷'},{mko:'준',gko:'유키스'},{mko:'이의진',gko:'유앤비'},{mko:'오광석',gko:'유앤비'},{mko:'박대원',gko:'유앤비'},{mko:'이형근',gko:'유앤비'},{mko:'지한솔',gko:'유앤비'},{mko:'김기중',gko:'유앤비'}]}
};
