// 시상식 부문명 영→한 번역기 (2026-11-16) — 위키 자동 수집분의 영어 부문명에 한글 `ko`를 붙인다.
// 구문 사전(긴 것부터) → 단어 사전 순으로 바꾸고, 영어 단어가 남으면 번역 실패(영어 그대로 두고 koAuto 안 붙임).
// 실행: node tools/awards_ko.mjs            → awards/*.json(autoSource)의 부문에 ko 채움 + 번역 못 한 부문명 통계
//       node tools/awards_ko.mjs --dry      → 파일은 안 쓰고 통계만
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 통째 문구(소문자 키) — 시상식에서 고정 표기로 굳은 것들
const PHRASE = [
  ['artist of the year', '올해의 아티스트'], ['song of the year', '올해의 노래'], ['album of the year', '올해의 앨범'], ['record of the year', '올해의 레코드'],
  ['rookie of the year', '올해의 신인'], ['new artist of the year', '올해의 신인'], ['music video of the year', '올해의 뮤직비디오'], ['stage of the year', '올해의 무대'],
  ['discovery of the year', '올해의 발견'], ['worldwide icon of the year', '올해의 월드와이드 아이콘'], ['digital daesang (song of the year)', '음원 대상(올해의 노래)'],
  ['disc daesang (album of the year)', '음반 대상(올해의 앨범)'], ['album daesang (album of the year)', '앨범 대상(올해의 앨범)'], ['digital song daesang (song of the year)', '음원 대상(올해의 노래)'],
  ['digital song bonsang', '음원 본상'], ['album bonsang', '음반 본상'], ['digital music', '음원'], ['physical album', '음반'],
  ["worldwide fans' choice top 10", '월드와이드 팬스 초이스 TOP 10'], ["fans' choice", '팬스 초이스'], ["grand honor's choice", '그랜드 아너스 초이스'],
  ['most popular music video', '인기 뮤직비디오'], ['best music video director', '베스트 뮤직비디오 감독'], ['best music video', '베스트 뮤직비디오'],
  ['rap/hip hop', '랩/힙합'], ['hip hop & urban music', '힙합&어반 뮤직'], ['hiphop & urban music', '힙합&어반 뮤직'], ['r&b/soul', 'R&B/소울'], ['r&b/ballad', 'R&B/발라드'], ['r&b hiphop', 'R&B 힙합'],
  ['house & electronic', '하우스&일렉트로닉'], ['hot trend', '핫 트렌드'], ['top 10', 'TOP 10'], ['millions top 10', '밀리언즈 TOP 10'], ['television / film', 'TV·영화'],
  ['music style', '뮤직 스타일'], ['global streaming', '글로벌 스트리밍'], ['global k-pop artist', '글로벌 K팝 아티스트'], ['k-pop special award', 'K팝 스페셜 어워드'],
  ['1st quarter', '1분기'], ['2nd quarter', '2분기'], ['3rd quarter', '3분기'], ['4th quarter', '4분기'], ['next generation', '넥스트 제너레이션'], ['inspiring achievement', '인스파이어링 어치브먼트'],
  ['world best artist', '월드 베스트 아티스트'], ['asia celebrity', '아시아 셀러브리티'], ['favorite asian artist', '페이보릿 아시안 아티스트'], ['best international artist', '베스트 해외 아티스트'],
  ['most popular artist', '인기 아티스트'], ['best adult contemporary', '베스트 어덜트 컨템포러리'], ['scene stealer', '씬 스틸러'], ['best acting performance', '베스트 연기'],
  ['music video acting', '뮤직비디오 연기'], ['best new artists', '베스트 신인'], ['best new artist', '베스트 신인'], ['hip hop', '힙합'], ['trend of the year', '올해의 트렌드'], ['best selling album', '베스트 셀링 앨범'], ['special jury prize', '심사위원 특별상'],
  ['k-wave popularity award', 'K웨이브 인기상'], ["kakao bank everyone's star", '카카오뱅크 모두의 스타상'], ["mwave global fans' choice", '엠웨이브 글로벌 팬스 초이스'],
  ['(digital category)', '(음원 부문)'], ['(album category)', '(음반 부문)'], ['k-pop', 'K팝'], ['j-pop', 'J팝'], ['netizen popularity', '네티즌 인기상'], ['popularity award', '인기상'], ['best choice', '베스트 초이스'],
];
const WORD = {
  best: '베스트', female: '여자', male: '남자', group: '그룹', solo: '솔로', artist: '아티스트', musician: '뮤지션', new: '신인', rookie: '신인', performance: '퍼포먼스', dance: '댄스', vocal: '보컬',
  rock: '록', 'hip-hop': '힙합', hiphop: '힙합', 'hip hop': '힙합', rap: '랩', ballad: '발라드', indie: '인디', band: '밴드', trot: '트로트', pop: '팝', ost: 'OST', collaboration: '콜라보레이션',
  producer: '프로듀서', song: '노래', album: '앨범', digital: '음원', disc: '음반', bonsang: '본상', daesang: '대상', grand: '그랜드', prize: '상', award: '', main: '본상', mixed: '혼성',
  international: '해외', icon: '아이콘', worldwide: '월드와이드', global: '글로벌', special: '스페셜', discovery: '디스커버리', stage: '무대', video: '비디오', music: '뮤직', top: 'TOP',
  popularity: '인기상', netizen: '네티즌', favorite: '페이보릿', asian: '아시안', fabulous: '파뷸러스', potential: '포텐셜', wave: '웨이브', focus: '포커스', emotive: '이모티브', choice: '초이스',
  artists: '아티스트', males: '남자', females: '여자', rising: '라이징', star: '스타', trend: '트렌드', selling: '셀링', memory: '메모리', record: '레코드', jury: '심사위원', choreography: '안무',
  visionary: '비저너리', folk: '포크', blues: '블루스', songwriter: '송라이터', creator: '크리에이터', couple: '커플', voice: '보이스', legendary: '레전더리', plus: '플러스', idol: '아이돌',
  achievement: '업적', performer: '퍼포머', is: 'IS', presence: '프레전스', history: '히스토리', symbol: '심볼', master: '마스터', professional: '프로페셔널', actress: '여우', hallyu: '한류',
  track: '트랙', zero: '제로', 'k-wave': 'K웨이브', kakao: '카카오', bank: '뱅크', everyone: '모두', popular: '인기', mwave: '엠웨이브', '(digital': '(음원', '(album': '(음반', 'category)': '부문)',
  actor: '배우', acting: '연기', cosmopolitan: '코즈모폴리턴', television: 'TV', film: '영화', of: '', the: '', year: '올해', and: '·', '&': '·', '–': '', '-': '', '/': '/',
};
const KEEP = /^(OST|TOP|R&B|K-pop|K-POP|1theK|MV|DJ|AAA|DCM|\d+)$/i;
const MONTH = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

export function koCategory(en) {
  const mo = /^([A-Za-z]+) (\d{4})$/.exec(String(en || '').trim()); if (mo && MONTH[mo[1].toLowerCase()]) return `${mo[2]}년 ${MONTH[mo[1].toLowerCase()]}월`;
  let s = ' ' + String(en || '').replace(/\s+/g, ' ').trim() + ' ';
  const low = s.toLowerCase();
  // 문구 사전: 소문자로 찾아 자리표시자로 치환(길이 긴 것부터)
  const ph = [...PHRASE].sort((a, b) => b[0].length - a[0].length);
  const toks = []; let cur = low, out = s;
  for (const [k, v] of ph) {
    let i;
    while ((i = cur.indexOf(' ' + k + ' ')) >= 0 || (i = cur.indexOf(' ' + k + ',')) >= 0) {
      const mark = '\u0001' + toks.length + '\u0002'; toks.push(v);
      cur = cur.slice(0, i + 1) + mark + cur.slice(i + 1 + k.length);
      out = out.slice(0, i + 1) + mark + out.slice(i + 1 + k.length);
    }
  }
  // 단어 사전
  const words = out.trim().split(/\s+/);
  const ko = [];
  for (const w of words) {
    const m = /^\u0001(\d+)\u0002$/.exec(w);
    if (m) { ko.push(toks[+m[1]]); continue; }
    const core = w.replace(/[()]/g, ''), lw = core.toLowerCase();
    if (WORD[lw] !== undefined) { if (WORD[lw]) ko.push((w.startsWith('(') ? '(' : '') + WORD[lw] + (w.endsWith(')') ? ')' : '')); continue; }
    if (KEEP.test(core) || /^[가-힣]/.test(core)) { ko.push(w); continue; }
    return null; // 번역 못 하는 단어가 있음
  }
  const r = ko.join(' ').replace(/\s+/g, ' ').replace(/베스트 베스트/g, '베스트').replace(/ ·/g, '·').replace(/· /g, '·').replace(/\s+\)/g, ')').trim();
  return r || null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const dir = path.join(ROOT, 'awards'); let n = 0, ok = 0; const miss = {};
  for (const f of fs.readdirSync(dir).filter(x => /^[a-z]+-\d{4}\.json$/.test(x))) {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (!a.autoSource) continue;
    let ch = false;
    for (const c of a.categories) {
      n++; const k = koCategory(c.en);
      if (k) { ok++; if (c.ko !== k || !c.koAuto) { c.ko = k; c.koAuto = true; ch = true; } }
      else { miss[c.en] = (miss[c.en] || 0) + 1; }
    }
    if (ch && !dry) fs.writeFileSync(path.join(dir, f), JSON.stringify(a, null, 1) + '\n');
  }
  console.log(`부문 ${n}개 중 한글 번역 ${ok}개(${Math.round(ok / n * 100)}%)`);
  const m = Object.entries(miss).sort((a, b) => b[1] - a[1]);
  console.log(`번역 못 한 고유 부문명 ${m.length}개 (상위):\n` + m.slice(0, 60).map(x => x[0] + ' ×' + x[1]).join('\n'));
}
