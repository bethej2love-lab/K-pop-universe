// 슬림 데이터 생성 — 초기 로드에서 discography를 떼어낸다 (2026-08-31)
//
// 원본(groups.json·artists.json)은 그대로 두고(수정 스크립트들이 계속 이 파일을 씀), 여기서 파생물만
// 만든다. sitemap/SEO 페이지를 build_group_pages.js가 자동 생성하는 것과 같은 "source→artifact" 구조.
//
// 생성물:
//   groups.slim.json / artists.slim.json  — discography·unitDiscography 뺀 초기 로드용(앱이 이걸 로드)
//   disco/g/{그룹}.json                    — 그룹 카드 열 때 로드({g:그룹앨범, m:{멤버:{d,u}}})
//   disco/a/{그룹}__{이름}.json            — 무소속 솔로 카드용({d,u})
//   tracks_index.json                      — 곡 검색(_buildSongIndex) + 피드 b-side(_groupBsideIndex) 공용.
//                                            트랙 제목만 담아 가볍다. 검색/피드 첫 사용 때 lazy 로드.
//
// ⚠️ tracks_index는 원본 트랙을 그대로 담는다(Inst./MR 필터는 런타임이 기존대로 적용). 앨범 상세의
//    커버·발매일·트랙번호 같은 무거운 필드는 disco/ 파일에만 있다.
// ⚠️ fileKey는 런타임(index.html)과 반드시 동일해야 한다 — 여기 규칙을 바꾸면 앱 쪽도 같이 바꿀 것.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const gz = s => zlib.gzipSync(Buffer.from(s)).length;
const kb = n => (n / 1024).toFixed(0) + 'KB';

// 파일명 안전화 — 경로 구분자만 치환하고 끝의 점/공백 정리(SEO 페이지 urlSafeKo와 같은 취지).
// 그 외 한글·괄호는 그대로 둔다(이 호스트는 이미 한글 경로 정적 파일 g/에스파/ 를 서빙함).
const fileKey = s => String(s).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');

// 영문→한국어 발음 룩업 (곡명 한글 검색: "러브다이브"→"LOVE DIVE" 매칭용)
const EN_TO_KO = {
  love:'러브',luv:'러브',lover:'러버',lovely:'러블리',lovey:'러비',
  heart:'하트',hearts:'하트',kiss:'키스',hug:'허그',crush:'크러쉬',
  desire:'디자이어',romance:'로맨스',romantic:'로맨틱',fantasy:'판타지',fancy:'팬시',
  dream:'드림',dreamy:'드리미',magic:'매직',magical:'매지컬',
  beautiful:'뷰티풀',beauty:'뷰티',pretty:'프리티',sweet:'스윗',sugar:'슈가',honey:'허니',
  miss:'미스',missing:'미싱',emotion:'이모션',feeling:'필링',feel:'필',vibe:'바이브',vibes:'바이브',
  dive:'다이브',diving:'다이빙',run:'런',running:'러닝',fly:'플라이',flying:'플라잉',flight:'플라이트',
  dance:'댄스',dancing:'댄싱',sing:'싱',jump:'점프',walk:'워크',rise:'라이즈',rising:'라이징',
  shine:'샤인',shining:'샤이닝',burn:'번',burning:'버닝',break:'브레이크',breaking:'브레이킹',
  fade:'페이드',fall:'폴',falling:'폴링',flow:'플로우',glow:'글로우',kill:'킬',killing:'킬링',
  fire:'파이어',flame:'플레임',flames:'플레임즈',water:'워터',wave:'웨이브',waves:'웨이브',
  ocean:'오션',sea:'씨',sky:'스카이',heaven:'헤븐',
  star:'스타',stars:'스타즈',starry:'스타리',moon:'문',moonlight:'문라이트',
  sun:'선',sunrise:'선라이즈',sunset:'선셋',sunshine:'선샤인',
  cloud:'클라우드',rain:'레인',rainbow:'레인보우',rainy:'레이니',snow:'스노우',wind:'윈드',
  flower:'플라워',flowers:'플라워즈',garden:'가든',forest:'포레스트',jungle:'정글',
  universe:'유니버스',galaxy:'갤럭시',cosmos:'코스모스',planet:'플래닛',space:'스페이스',
  night:'나이트',midnight:'미드나이트',day:'데이',morning:'모닝',evening:'이브닝',
  today:'투데이',tomorrow:'투모로우',tonight:'투나잇',
  forever:'포에버',eternity:'이터니티',eternal:'이터널',moment:'모먼트',time:'타임',
  season:'시즌',winter:'윈터',summer:'썸머',spring:'스프링',autumn:'오텀',
  red:'레드',blue:'블루',green:'그린',yellow:'옐로우',pink:'핑크',purple:'퍼플',orange:'오렌지',
  white:'화이트',black:'블랙',grey:'그레이',gray:'그레이',
  gold:'골드',golden:'골든',silver:'실버',crystal:'크리스탈',diamond:'다이아몬드',ruby:'루비',
  rose:'로즈',violet:'바이올렛',neon:'네온',
  girl:'걸',girls:'걸즈',boy:'보이',boys:'보이즈',man:'맨',woman:'우먼',
  baby:'베이비',babe:'베이브',angel:'엔젤',hero:'히어로',queen:'퀸',king:'킹',
  princess:'프린세스',prince:'프린스',friend:'프렌드',friends:'프렌즈',soul:'소울',monster:'몬스터',
  butter:'버터',dynamite:'다이너마이트',permission:'퍼미션',ditto:'디토',
  thunder:'썬더',lightning:'라이트닝',shadow:'쉐도우',mirror:'미러',paradise:'파라다이스',
  journey:'저니',story:'스토리',stories:'스토리즈',song:'송',music:'뮤직',
  melody:'멜로디',harmony:'하모니',rhythm:'리듬',beat:'비트',sound:'사운드',voice:'보이스',
  key:'키',door:'도어',road:'로드',path:'패스',way:'웨이',bridge:'브릿지',
  ring:'링',crown:'크라운',power:'파워',force:'포스',energy:'에너지',
  light:'라이트',lights:'라이트',storm:'스톰',
  hope:'호프',faith:'페이스',trust:'트러스트',fear:'피어',pain:'페인',
  freedom:'프리덤',free:'프리',wild:'와일드',crazy:'크레이지',real:'리얼',
  new:'뉴',good:'굿',bad:'배드',hot:'핫',cool:'쿨',
  yeah:'예',hey:'헤이',hi:'하이',hello:'헬로',bye:'바이',goodbye:'굿바이',sorry:'쏘리',
  idol:'아이돌',stage:'스테이지',show:'쇼',concert:'콘서트',fan:'팬',fandom:'팬덤',
  superstar:'슈퍼스타',bloom:'블룸',blossom:'블라썸',spark:'스파클',sparkle:'스파클',
  twinkle:'트윙클',glitter:'글리터',fantastic:'판타스틱',wonderful:'원더풀',
  perfect:'퍼펙트',amazing:'어메이징',miracle:'미라클',wonder:'원더',
  better:'베터',best:'베스트',super:'슈퍼',next:'넥스트',back:'백',
  over:'오버',after:'애프터',before:'비포',with:'위드',
  on:'온',off:'오프',out:'아웃',to:'투',for:'포',of:'오브',at:'앳',in:'인',
  mic:'마이크',drop:'드롭',blood:'블러드',sweat:'스웻',tears:'티어즈',world:'월드',
  map:'맵',answer:'앤서',outro:'아우트로',intro:'인트로',
  whistle:'휘슬',playing:'플레잉',type:'타입',
  birthday:'버스데이',holiday:'홀리데이',party:'파티',secret:'시크릿',
  vintage:'빈티지',classic:'클래식',modern:'모던',future:'퓨처',retro:'레트로',
  cyber:'사이버',digital:'디지털',electric:'일렉트릭',ghost:'고스트',phantom:'팬텀',
  dark:'다크',darkness:'다크니스',loud:'라우드',noise:'노이즈',silence:'사일런스',
  zero:'제로',one:'원',two:'투',three:'쓰리',four:'포',five:'파이브',
  six:'식스',seven:'세븐',eight:'에잇',nine:'나인',ten:'텐',million:'밀리언',
  ok:'오케이',okay:'오케이',
};
// 영문 제목 → 한국어 발음 (매핑 안 되는 단어는 건너뜀, 1개 이상 변환되면 반환)
const enKoPho = t => {
  if (/[가-힣]/.test(t)) return ''; // 이미 한글 포함이면 불필요
  const parts = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const mapped = parts.map(w => EN_TO_KO[w]).filter(Boolean);
  return mapped.length ? mapped.join('') : '';
};

const groups = rd('groups.json');           // 객체 {ko:{...,discography}}
const artists = rd('artists.json');          // 배열 [{name,group,discography?,unitDiscography?,...}]
if (!Array.isArray(artists)) throw new Error('artists.json이 배열이 아님 — 구조 확인 필요');

// ── --check: 파일을 안 쓰고 "지금 생성물이 원본과 일치하는가"만 본다 (2026-09-15) ──────────
// 왜 필요한가: disco/·*.slim.json·tracks_index.json은 groups.json/artists.json에서 만들어지는
// 파생물인데, 이 빌드가 **어떤 워크플로에도 안 붙어 있었다**. 즉 앨범을 추가하고 이 스크립트를
// 안 돌리면 원본만 바뀌고 사이트엔 반영이 안 되며, 아무도 그 사실을 모른다.
// 이제 rebuild-artifacts.yml이 자동으로 재생성하고, 이 --check 모드가 CI에서 어긋남을 잡는다.
// ⚠️ 검증용이므로 **절대 파일을 쓰지 않는다** — 테스트가 작업 트리를 더럽히면 안 된다.
const CHECK = process.argv.includes('--check');
const drift = [];                                        // --check에서 어긋난 경로들
const discoDir = path.join(ROOT, 'disco');
const seenDisco = new Set();                             // --check에서 고아 파일 탐지용
if (!CHECK) {
  fs.rmSync(discoDir, { recursive: true, force: true }); // 이전 생성물 정리(고아 파일 방지)
  fs.mkdirSync(path.join(discoDir, 'g'), { recursive: true });
  fs.mkdirSync(path.join(discoDir, 'a'), { recursive: true });
}
// 기대 내용과 디스크 내용을 비교(--check) 하거나 그대로 쓴다. 반환값은 바이트 수(리포트용).
const emit = (p, s) => {
  if (CHECK) {
    seenDisco.add(path.resolve(p));
    let cur = null;
    try { cur = fs.readFileSync(p, 'utf8'); } catch { }
    if (cur !== s) drift.push(path.relative(ROOT, p).replace(/\\/g, '/') + (cur === null ? ' (없음)' : ' (내용 다름)'));
  } else fs.writeFileSync(p, s);
  return Buffer.byteLength(s);
};

const groupBuckets = {};                     // gko -> {g:[]|null, m:{이름:{d,u}}}
const soloFiles = [];                        // {name, data}
const tracks = { groups: {}, members: {} };  // tracks_index 원자료
let trackCount = 0;
const pushTracks = (dest, disco) => {
  for (const al of (disco || [])) for (const t of (al.tracks || [])) {
    if (t && t.title) {
      const ko = enKoPho(t.title);
      dest.push(ko ? [t.title, t.isTitle ? 1 : 0, al.title || '', ko] : [t.title, t.isTitle ? 1 : 0, al.title || '']);
      trackCount++;
    }
  }
};

// ── 그룹 ──
for (const gko of Object.keys(groups)) {
  const disco = groups[gko].discography;
  if (disco && disco.length) {
    (groupBuckets[gko] ??= { g: null, m: {} }).g = disco;
    pushTracks(tracks.groups[gko] ??= [], disco); // b-side는 그룹 트랙만 봄
  }
}

// ── 무소속 솔로 파일키 동명이인 처리 (2026-09-15) ──────────────────────────────
// 버그: 아래 아티스트 루프의 충돌 검사는 **그룹 소속 멤버 경로만** 봤고(`b.m[nm]`), 무소속 솔로
// 경로(soloFiles.push)엔 검사가 없었다. 그래서 같은 파일명을 쓰는 동명이인이 있으면 뒤에 쓴 쪽이
// 앞을 **조용히 덮어썼다**.
//   실측: `솔로__레나` — a0473(Lena, 공원소녀 출신, 2002년생) 솔로 앨범 6장이 a1047(강예빈,
//   프리스틴 출신, 1998년생)의 유닛 앨범 1장에 덮여 통째로 서빙에서 빠져 있었다. 생일·나무위키가
//   다른 별개 인물이라 병합이 아니라 파일키를 갈라야 한다(동명이인 합치기 금지는 이 프로젝트 원칙).
// 규칙: (그룹, 이름)이 겹치는 아티스트가 2명 이상이면 **그 전원**의 파일키에 id를 붙인다.
// ⚠️ 판정 기준은 "디스코가 있는 아티스트"가 아니라 **artists.json 전체**여야 한다 — 앱(index.html의
//    _soloDiscoKey)은 누가 디스코를 갖고 있는지 모른 채(그게 lazy 로드의 목적) 같은 키를 계산해야
//    하기 때문이다. 기준이 어긋나면 앱이 없는 파일을 부르거나 엉뚱한 파일을 부른다.
const soloDupKeys = new Set();
{
  const seen = new Map();
  for (const a of artists) {
    const nm = a.name?.ko, gko = a.group?.ko;
    if (!nm || !gko || groups[gko]) continue;
    const k = fileKey(gko) + '__' + fileKey(nm);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) soloDupKeys.add(k);
}
const soloFileName = a => {
  const base = fileKey(a.group.ko) + '__' + fileKey(a.name.ko);
  return soloDupKeys.has(base) && a.id ? base + '__' + a.id : base;
};

// ── 아티스트 ──
const collisions = [];
const soloSeen = new Set();
for (const a of artists) {
  const nm = a.name?.ko, gko = a.group?.ko;
  const d = a.discography, u = a.unitDiscography;
  const hasD = d && d.length, hasU = u && u.length;
  if (!hasD && !hasU) continue;
  if (!nm || !gko) { collisions.push('이름/그룹 없는 아티스트: ' + JSON.stringify(a.name)); continue; }
  if (hasD) pushTracks(tracks.members[nm + '\u0000' + gko] ??= [], d); // 검색은 솔로 discography만(unitDiscography는 인덱스 안 함)
  if (groups[gko]) {                          // 실존 그룹 → 그룹 파일에 번들
    const b = (groupBuckets[gko] ??= { g: null, m: {} });
    if (b.m[nm]) collisions.push('그룹 내 동명 멤버: ' + gko + '/' + nm);
    b.m[nm] = { d: d || null, u: u || null };
  } else {                                    // 무소속 솔로 → 개별 파일
    const fn = soloFileName(a);
    // 여기까지 와서 또 겹치면 id로도 못 가른 것(=id 중복). 조용히 덮어쓰느니 빌드를 세운다.
    if (soloSeen.has(fn)) collisions.push('솔로 파일키 충돌: ' + fn + ' (id=' + a.id + ')');
    soloSeen.add(fn);
    soloFiles.push({ name: fn, data: { d: d || null, u: u || null } });
  }
}
if (collisions.length) { console.error('⚠️ 키 충돌/이상:\n  ' + collisions.join('\n  ')); process.exit(1); }

// ── 파일 쓰기 ──
let gFiles = 0, aFiles = 0, discoBytes = 0;
const wr = (p, obj) => { discoBytes += emit(p, JSON.stringify(obj)); };
for (const gko of Object.keys(groupBuckets)) { wr(path.join(discoDir, 'g', fileKey(gko) + '.json'), groupBuckets[gko]); gFiles++; }
for (const s of soloFiles) { wr(path.join(discoDir, 'a', s.name + '.json'), s.data); aFiles++; }

// 슬림 원본(discography·unitDiscography 제거)
const groupsSlim = JSON.parse(JSON.stringify(groups));
for (const k of Object.keys(groupsSlim)) delete groupsSlim[k].discography;
const artistsSlim = JSON.parse(JSON.stringify(artists));
for (const a of artistsSlim) { delete a.discography; delete a.unitDiscography; }

// ── 집계·시각화용 파생 필드 (2026-09-02) ────────────────────────────────────
// 원본 co/nat/disbanded는 그대로 두고 여기서 파생만 붙인다. 화면은 원본을 쓰고(_dispAgency·
// _getNatKo·_groupEndDate가 이미 세 필드의 표기 흔들림을 각자 흡수하고 있다), 집계는 이 필드를 쓴다.
// 원본을 고치고 사용처 ~85곳을 따라가는 것보다 파생을 얹는 쪽이 안전하다.

// coKey: 소속사 집계 키. co가 "자회사 / 모회사"면 앞이 레이블, 뒤가 모회사(coParent).
//   "빅히트 뮤직 / HYBE" → coKey:'빅히트뮤직'  coParent:'HYBE'
//   "SM엔터테인먼트"      → coKey:'SM'         coParent 없음
// ⚠️ 표기 흔들림만 흡수한다(공백·'엔터테인먼트'·대소문자). 이름이 비슷한 다른 회사를 합치지
//    않으려면 여기 규칙을 넓히지 말 것 — 실제 표기 통일은 원본 co에서 이미 끝냈다.
const coNorm = s => String(s || '').replace(/\s+/g, '')
  .replace(/엔터테인먼트|엔터|ENTERTAINMENT|ENT\.?/gi, '').replace(/주식회사|㈜/g, '').toUpperCase();
const coFields = co => {
  if (!co) return null;
  const parts = String(co).split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { coKey: coNorm(parts[0]), coParent: coNorm(parts.slice(1).join('/')) };
  return { coKey: coNorm(co) };
};
// natCodes: nat.en의 ISO 코드를 배열로. 복합 국적은 '·'로 이어져 있다("KR·US" → ['KR','US']).
// 이미 코드가 들어 있어 매핑 테이블이 필요 없다 — 흔들린 건 nat.ko 쪽('한국'/'대한민국')이고 그건 표시용.
const natCodes = nat => {
  const en = nat && nat.en;
  if (!en) return [];
  return String(en).split(/[·,]/).map(s => s.trim()).filter(Boolean);
};
// endDate/endPrecision: disbanded 3형식(YYYY.MM.DD / YYYY / true)을 하나로. _groupEndDate와 같은
// 관례 — 연도만이면 그 해 말일, 연·월이면 그 달 말일. true는 "해체는 맞는데 날짜 모름"이라 unknown.
const endFields = d => {
  if (d === undefined || d === null) return { endDate: null, endPrecision: 'active' };
  if (typeof d !== 'string') return { endDate: null, endPrecision: 'unknown' };
  const m = /^(\d{4})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?$/.exec(d.trim());
  if (!m) return { endDate: null, endPrecision: 'unknown' };
  const p2 = n => String(n).padStart(2, '0');
  if (!m[2]) return { endDate: `${m[1]}-12-31`, endPrecision: 'year' };
  if (!m[3]) return { endDate: `${m[1]}-${p2(m[2])}-${new Date(+m[1], +m[2], 0).getDate()}`, endPrecision: 'month' };
  return { endDate: `${m[1]}-${p2(m[2])}-${p2(m[3])}`, endPrecision: 'day' };
};
const unmappedNat = [];
for (const k of Object.keys(groupsSlim)) {
  Object.assign(groupsSlim[k], coFields(groupsSlim[k].co) || {}, endFields(groupsSlim[k].disbanded));
}
for (const a of artistsSlim) {
  Object.assign(a, coFields(a.co) || {});
  const codes = natCodes(a.nat);
  if (codes.length) a.natCodes = codes;
  for (const c of codes) if (!/^[A-Z]{2}$/.test(c)) unmappedNat.push(`${a.name?.ko}: ${c}`);
}
if (unmappedNat.length) console.log(`⚠️ ISO 2자리가 아닌 국적 코드 ${unmappedNat.length}건 — ${unmappedNat.slice(0, 5).join(', ')}`);

const gSlimStr = JSON.stringify(groupsSlim), aSlimStr = JSON.stringify(artistsSlim), tiStr = JSON.stringify(tracks);
emit(path.join(ROOT, 'groups.slim.json'), gSlimStr);
emit(path.join(ROOT, 'artists.slim.json'), aSlimStr);
emit(path.join(ROOT, 'tracks_index.json'), tiStr);

// ── albums_recent.json — 탐험 "이번 주 발매" 선반용 최근 앨범 인덱스 (2026-09-15) ──────────
// 왜 따로 만드나: 앱은 앨범 데이터를 갖고 있지 않다. discography는 슬림에서 빠지고 disco/ 파일로
// **카드를 열 때 그룹별로 lazy 로드**되므로, 피드에서 "최근 발매"를 알려면 388개 파일을 전부
// 받아야 한다. 그래서 최근분만 담은 작은 인덱스를 빌드 때 만들어 둔다(피드가 이것만 lazy 로드).
//
// ⚠️ "최근 N일"이 아니라 **최신 N장**으로 담는다. 날짜로 자르면 빌드 시점이 박제돼서, 재빌드가
//    며칠 안 도는 사이 선반이 조용히 비어버린다. 개수로 담으면 파일이 상하지 않고, 며칠치를
//    보여줄지는 화면이 그때그때 정한다(수집이 아직 얇을 땐 창을 넓혀 쓸 수 있다).
const RECENT_ALBUMS = 400;
{
  const rows = [];
  // 멤버 항목엔 아티스트 id(i)를 꼭 넣는다 — 무소속 솔로는 g가 null이라 이름만으론 동명이인을 못 가른다
  // (2026-10-02 TAN 출신 솔로 지성 신보가 엔시티 드림 지성 것으로 떴다). 앱은 _albumOwnerArt로 i부터 찾는다.
  const push = (owner, ownerKind, gko, list, id) => {
    for (const al of list || []) {
      if (!al || !al.releaseDate || !al.cover) continue;   // 커버 없는 건 이 선반의 존재 이유가 없다
      const row = { o: owner, k: ownerKind, g: gko || null, t: al.title, y: al.type || '', d: al.releaseDate, c: al.cover };
      if (id) row.i = id;
      rows.push(row);
    }
  };
  for (const [gko, g] of Object.entries(groups)) push(gko, 'g', null, g.discography);
  for (const a of artists) {
    const nm = a.name && a.name.ko, gko = a.group && a.group.ko;
    if (!nm) continue;
    push(nm, 'm', gko && groups[gko] ? gko : null, a.discography, a.id);
    for (const u of a.unitDiscography || []) push(nm, 'm', gko && groups[gko] ? gko : null, u && u.albums, a.id);
  }
  rows.sort((x, y) => String(y.d).localeCompare(String(x.d)));
  // 같은 앨범이 그룹과 멤버 양쪽에 들어 있는 경우가 있어 (제목+날짜)로 중복 제거한다.
  const seen = new Set(), out = [];
  for (const r of rows) {
    const k = r.d + '|' + String(r.t).toLowerCase().replace(/\s+/g, '');
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
    if (out.length >= RECENT_ALBUMS) break;
  }
  emit(path.join(ROOT, 'albums_recent.json'), JSON.stringify(out));
  console.log(`albums_recent.json  ${out.length}장 (최신 ${out[0] ? out[0].d : '-'} ~ ${out[out.length - 1] ? out[out.length - 1].d : '-'})`);
}
// 원본에서 사라진 그룹·솔로의 disco 파일이 남아 있으면(고아) 실제 빌드는 rm으로 지우지만 --check는
// 못 지운다 — 그래서 여기서 직접 훑어 어긋남으로 보고한다. 이게 없으면 "그룹 이름이 바뀐 날"
// 옛 파일이 계속 서빙되는 걸 CI가 못 잡는다.
if (CHECK) {
  for (const sub of ['g', 'a']) {
    let files = [];
    try { files = fs.readdirSync(path.join(discoDir, sub)); } catch { }
    for (const f of files) {
      const p = path.resolve(discoDir, sub, f);
      if (!seenDisco.has(p)) drift.push(`disco/${sub}/${f} (원본에 없는 고아 파일)`);
    }
  }
}

// ── 무결성 검증 ──
let origTracks = 0;
for (const gko of Object.keys(groups)) for (const al of (groups[gko].discography || [])) origTracks += (al.tracks || []).filter(t => t && t.title).length;
for (const a of artists) for (const al of (a.discography || [])) origTracks += (al.tracks || []).filter(t => t && t.title).length;
const ok = origTracks === trackCount;

// ── 리포트 ──
const gOrig = fs.statSync(path.join(ROOT, 'groups.json')).size, aOrig = fs.statSync(path.join(ROOT, 'artists.json')).size;
console.log('── 슬림 데이터 생성 완료 ──');
console.log(`groups.json   ${kb(gOrig)}(gzip ${kb(gz(fs.readFileSync(path.join(ROOT,'groups.json'))))}) → slim ${kb(gSlimStr.length)}(gzip ${kb(gz(gSlimStr))})`);
console.log(`artists.json  ${kb(aOrig)}(gzip ${kb(gz(fs.readFileSync(path.join(ROOT,'artists.json'))))}) → slim ${kb(aSlimStr.length)}(gzip ${kb(gz(aSlimStr))})`);
console.log(`tracks_index.json  ${kb(tiStr.length)}(gzip ${kb(gz(tiStr))})  [lazy 로드]`);
console.log(`disco/ 파일: 그룹 ${gFiles} + 솔로 ${aFiles} = ${gFiles + aFiles}개 · 합 ${kb(discoBytes)}`);
console.log(`트랙 무결성: 원본 ${origTracks} vs 인덱스 ${trackCount} ${ok ? '✓ 일치' : '✗ 불일치!'}`);
if (!ok) process.exit(1);
if (CHECK) {
  if (drift.length) {
    console.error(`\n✗ 생성물이 원본과 어긋납니다 (${drift.length}건) — groups.json/artists.json을 고치고 빌드를 안 돌렸을 때 납니다.`);
    drift.slice(0, 20).forEach(d => console.error('  · ' + d));
    if (drift.length > 20) console.error(`  · … 외 ${drift.length - 20}건`);
    console.error('\n고치는 법: node tools/build_slim_data.mjs  (그 뒤 생성물까지 함께 커밋)');
    process.exit(1);
  }
  console.log('✓ 생성물이 원본과 일치 (--check · 파일은 쓰지 않았습니다)');
}
