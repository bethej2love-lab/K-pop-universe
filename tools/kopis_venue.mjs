// KOPIS 상세 API로 공연장 "홀" 이름을 복구한다.
//
// 목록 API(pblprfr)의 prfplcnm 은 시설 단위라 '올림픽공원' 처럼 뭉뚱그려진다.
// 상세 API(pblprfr/{mt20id})의 fcltynm 은 '올림픽공원 (핸드볼경기장)' 처럼 홀까지 준다.
//
//   node tools/kopis_venue.mjs fetch    # events.matched.json 의 id 로 상세 조회 → events.venue.json
//   node tools/kopis_venue.mjs dict     # events.venue.json → tools/venues.json (표준 공연장 사전)
//   node tools/kopis_venue.mjs selftest
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'events.venue.json');
const DICT = path.join(ROOT, 'tools', 'venues.json');

function key() {
  const i = process.argv.indexOf('--key');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (process.env.KOPIS_KEY) return process.env.KOPIS_KEY;
  const f = path.join(ROOT, '.kopis_key');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error('KOPIS 키가 없다. --key / KOPIS_KEY / .kopis_key 중 하나로 넘겨라.');
}

const unent = s => String(s || '')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');
const tag = (xml, t) => {
  const m = xml.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`));
  return m ? unent(m[1]).trim() : '';
};

// ── 정규화 ────────────────────────────────────────────────────────────────
// 네이밍라이츠(후원사명)와 '(구. …)' 같은 이력 표기는 해가 바뀌면 낡는다.
// 지리적으로 안정된 이름만 남기는 게 목표.
const SPONSOR = /^(티켓링크|올림픽|우리금융|한국지역난방공사|하나카드|신한카드|NOL|예스24|YES24|무신사|KSPO|SK|KB|롯데|현대카드|LG|삼성)\s+/;

// 표기가 제각각인 홀 이름을 한 쪽으로 몬다.
const HALL_ALIAS = new Map(Object.entries({
  '라이브 아레나': '핸드볼경기장',
  '티켓링크 라이브 아레나': '핸드볼경기장',
  'SK올림픽핸드볼경기장': '핸드볼경기장',
  'KSPO돔': '체조경기장',
  'KSPO DOME': '체조경기장',
  '올림픽체조경기장': '체조경기장',
  '제1체육관': '체조경기장',
  '주경기장': '주경기장',
  '올림픽주경기장': '주경기장',
  '실내체육관': '실내체육관',
  '올림픽홀': '올림픽홀',
  'SK핸드볼경기장': '핸드볼경기장',
}));

// 시설명 자체의 표기 흔들림.
const FACILITY_ALIAS = new Map(Object.entries({
  '인스파이어 엔터테인먼트 리조트': '인스파이어 아레나',
  '엑스코(exco)': '엑스코',
  '엑스코(EXCO)': '엑스코',
  '벡스코 (BEXCO)': '벡스코',
  '코엑스아티움(Coex Artium)': '코엑스아티움',
}));

const isOldName = s => /^구[.,]?\s*/.test(String(s || '').trim());
// 영문 표기만 있는 괄호는 홀이 아니라 시설의 로마자 별칭이다. '벡스코 (BEXCO)'.
const isRomanAlias = s => /^[A-Za-z0-9 .&'-]+$/.test(String(s || '').trim());

// 최상위 괄호쌍만 순서대로 뽑는다. 중첩 괄호는 통째로 한 덩어리로 남긴다.
//   'KBS스포츠월드(아레나) (KBS아레나)'        → ['아레나', 'KBS아레나']
//   '올림픽공원 (티켓링크 라이브 아레나 (핸드볼경기장))' → ['티켓링크 라이브 아레나 (핸드볼경기장)']
export function topLevelParens(s) {
  const out = [];
  let depth = 0, start = -1;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') { if (depth === 0) start = i + 1; depth++; }
    else if (str[i] === ')') { depth--; if (depth === 0 && start >= 0) { out.push(str.slice(start, i).trim()); start = -1; } if (depth < 0) depth = 0; }
  }
  return out.filter(Boolean);
}

// 홀 이름 안에 또 괄호가 있을 때 어느 쪽이 진짜인지 고른다.
//   '티켓링크 라이브 아레나 (핸드볼경기장)' → 안쪽 (바깥은 후원사명)
//   '마스터카드홀 (구. SOL트래블홀)'        → 바깥 (안쪽은 옛이름)
export function pickHallName(hall) {
  let cur = String(hall || '').trim();
  for (let i = 0; i < 4; i++) {
    const inner = topLevelParens(cur);
    if (!inner.length) break;
    const last = inner[inner.length - 1];
    const outer = cur.slice(0, cur.lastIndexOf('(' + last)).trim() || cur.replace(/\s*\([^()]*\)\s*$/, '').trim();
    cur = (isOldName(last) || isRomanAlias(last)) ? outer : last;
    if (!cur) { cur = last; break; }
  }
  return cur.trim();
}

// 시설 + 홀 로 쪼갠다. fcltynm 형식은 '시설명 (홀명)' 또는 '시설명'.
export function splitFacility(fcltynm) {
  const raw = String(fcltynm || '').trim();
  if (!raw) return { facility: '', hall: '' };
  const parts = topLevelParens(raw);
  if (!parts.length) return { facility: raw, hall: '' };
  const facility = raw.slice(0, raw.indexOf('(')).trim();
  // 괄호가 여러 개면 앞에서부터 훑어 '진짜 홀'로 보이는 첫 번째를 쓴다.
  // 옛이름/로마자 별칭은 홀이 아니므로 건너뛴다.
  const hall = parts.find(p => !isOldName(p) && !isRomanAlias(p)) || '';
  return { facility: facility || raw, hall: pickHallName(hall) };
}

export function canonical(fcltynm) {
  let { facility, hall } = splitFacility(fcltynm);
  facility = FACILITY_ALIAS.get(facility) || facility;
  if (!hall) return facility;
  hall = hall.replace(SPONSOR, '').trim();
  hall = HALL_ALIAS.get(hall) || hall;
  // 홀 이름이 이미 시설명을 품고 있으면 겹쳐 쓰지 않는다.
  if (hall.includes(facility) || facility.includes(hall)) return hall.length >= facility.length ? hall : facility;
  return `${facility} ${hall}`;
}

// ── fetch ────────────────────────────────────────────────────────────────
async function fetchDetail(id, svc) {
  const url = `http://kopis.or.kr/openApi/restful/pblprfr/${id}?service=${svc}`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const xml = await r.text();
      return {
        id,
        fcltynm: tag(xml, 'fcltynm'),
        mt10id: tag(xml, 'mt10id'),
        poster: tag(xml, 'poster'),
        // relates 블록의 첫 링크는 대개 공식 예매처다.
        relate: (xml.match(/<relateurl>([\s\S]*?)<\/relateurl>/) || [, ''])[1].trim(),
      };
    } catch (e) {
      if (a === 2) return { id, error: String(e.message || e) };
      await new Promise(r => setTimeout(r, 800 * (a + 1)));
    }
  }
}

async function cmdFetch() {
  const svc = key();
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'events.matched.json'), 'utf8'));
  const ids = [...new Set(src.map(r => r.id).filter(Boolean))];
  const done = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const todo = ids.filter(i => !done[i] || done[i].error);
  console.log(`상세 조회 대상 ${todo.length}건 (전체 ${ids.length}, 캐시 ${ids.length - todo.length})`);

  const CONC = 4;
  let n = 0;
  for (let i = 0; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    const out = await Promise.all(batch.map(id => fetchDetail(id, svc)));
    out.forEach(o => { done[o.id] = o; });
    n += batch.length;
    if (n % 40 === 0 || n >= todo.length) {
      fs.writeFileSync(CACHE, JSON.stringify(done, null, 0));
      console.log(`  ${n}/${todo.length}`);
    }
    await new Promise(r => setTimeout(r, 120));
  }
  fs.writeFileSync(CACHE, JSON.stringify(done, null, 0));
  const err = Object.values(done).filter(d => d.error).length;
  console.log(`완료. 캐시 ${Object.keys(done).length}건, 실패 ${err}건 → ${CACHE}`);
}

// ── dict ─────────────────────────────────────────────────────────────────
function cmdDict() {
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'events.matched.json'), 'utf8'));
  const cityOf = new Map(src.map(r => [r.id, r.city || '']));

  const byName = new Map();
  const changes = [];
  for (const d of Object.values(cache)) {
    if (!d || d.error || !d.fcltynm) continue;
    const c = canonical(d.fcltynm);
    if (!c) continue;
    const cur = byName.get(c) || { name: c, count: 0, city: cityOf.get(d.id) || '', raw: new Set() };
    cur.count++;
    cur.raw.add(d.fcltynm);
    byName.set(c, cur);
    const old = (src.find(r => r.id === d.id) || {}).venue || '';
    if (old && old !== c) changes.push({ id: d.id, from: old, to: c });
  }

  const list = [...byName.values()]
    .map(v => ({ name: v.name, city: v.city, count: v.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));

  fs.writeFileSync(DICT, JSON.stringify(list, null, 1));
  console.log(`표준 공연장 ${list.length}곳 → ${DICT}`);
  console.log(`이름이 바뀌는 공연 ${changes.length}건`);
  console.log('--- 상위 25 ---');
  list.slice(0, 25).forEach(v => console.log(String(v.count).padStart(4), v.name, v.city ? `(${v.city})` : ''));
  return { list, changes };
}

// ── patch ────────────────────────────────────────────────────────────────
// events_import.json 의 venue 를 표준 이름으로 바꾸고, 이미 DB에 들어간 행을 고칠
// 업데이트 목록(events_venue_fix.json)을 뽑는다.
// (title, date_start) 로 잇는다 — 738/738 전부 붙는 걸 확인하고 고른 키다.
function cmdPatch() {
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const mat = JSON.parse(fs.readFileSync(path.join(ROOT, 'events.matched.json'), 'utf8'));
  const impPath = path.join(ROOT, 'events_import.json');
  const imp = JSON.parse(fs.readFileSync(impPath, 'utf8'));

  const newVenue = new Map();
  for (const r of mat) {
    const d = cache[r.id];
    if (!d || d.error || !d.fcltynm) continue;
    const c = canonical(d.fcltynm);
    if (c) newVenue.set(r.title + '|' + r.date_start, c);
  }

  const fix = [];
  let unchanged = 0, nodata = 0;
  for (const r of imp) {
    const v = newVenue.get(r.title + '|' + r.date_start);
    if (!v) { nodata++; continue; }
    if (v === r.venue) { unchanged++; continue; }
    fix.push({ title: r.title, date_start: r.date_start, from: r.venue, venue: v });
    r.venue = v;
  }
  // 재수집 없이 SQL을 다시 뽑을 때(--from-json) 옛 이름이 되살아나지 않게 원본 캐시도 같이 고친다.
  let matFixed = 0;
  for (const r of mat) {
    const v = newVenue.get(r.title + '|' + r.date_start);
    if (v && v !== r.venue) { r.venue = v; matFixed++; }
  }
  fs.writeFileSync(path.join(ROOT, 'events.matched.json'), JSON.stringify(mat, null, 1));
  fs.writeFileSync(impPath, JSON.stringify(imp, null, 1));

  // 두 번째 실행이면 바꿀 게 없다. 그때 빈 배열로 덮어쓰면 아직 DB에 안 돌린 교정 목록이 날아간다.
  const fixPath = path.join(ROOT, 'events_venue_fix.json');
  if (!fix.length && fs.existsSync(fixPath)) {
    const prev = JSON.parse(fs.readFileSync(fixPath, 'utf8'));
    if (prev.length) { console.log(`바꿀 게 없음 — 기존 교정 목록 ${prev.length}건을 그대로 둔다 (${fixPath})`); }
  } else {
    fs.writeFileSync(fixPath, JSON.stringify(fix, null, 1));
  }
  console.log(`바꿀 것 ${fix.length} · 그대로 ${unchanged} · 상세없음 ${nodata} · 원본캐시 교정 ${matFixed}`);
  const agg = new Map();
  fix.forEach(f => { const k = f.from + ' → ' + f.venue; agg.set(k, (agg.get(k) || 0) + 1); });
  console.log('--- 변경 상위 20 ---');
  [...agg].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, c]) => console.log(String(c).padStart(4), k));
}

// ── selftest ─────────────────────────────────────────────────────────────
function cmdSelftest() {
  const cases = [
    ['올림픽공원 (티켓링크 라이브 아레나 (핸드볼경기장))', '올림픽공원 핸드볼경기장'],
    ['올림픽공원 (올림픽홀)', '올림픽공원 올림픽홀'],
    ['잠실종합운동장 (실내체육관)', '잠실종합운동장 실내체육관'],
    ['예스24 라이브홀 (구. 악스코리아)', '예스24 라이브홀'],
    ['NOL 씨어터 합정(구, 신한카드 SOL페이 스퀘어)', 'NOL 씨어터 합정'],
    ['벡스코 (BEXCO)', '벡스코'],
    ['벡스코 (BEXCO) (오디토리움)', '벡스코 오디토리움'],
    ['KBS스포츠월드(아레나) (KBS아레나)', 'KBS스포츠월드 아레나'],
    ['블루스퀘어 (마스터카드홀 (구. SOL트래블홀))', '블루스퀘어 마스터카드홀'],
    ['엑스코(exco)', '엑스코'],
    ['KBS스포츠월드(아레나)', 'KBS스포츠월드 아레나'],
    ['인스파이어 엔터테인먼트 리조트', '인스파이어 아레나'],
    ['고척스카이돔', '고척스카이돔'],
  ];
  let bad = 0;
  for (const [inp, want] of cases) {
    const got = canonical(inp);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${inp}\n       → ${got}${ok ? '' : `  (기대: ${want})`}`);
  }
  console.log(bad ? `\n${bad}건 실패` : '\n전부 통과');
  process.exitCode = bad ? 1 : 0;
}

// 테스트가 canonical()만 import 할 때 사용법이 출력되면 안 되니, 직접 실행일 때만 명령을 탄다.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const cmd = invokedDirectly ? process.argv[2] : null;
if (invokedDirectly) {
if (cmd === 'fetch') await cmdFetch();
else if (cmd === 'dict') cmdDict();
else if (cmd === 'patch') cmdPatch();
else if (cmd === 'selftest') cmdSelftest();
else console.log('사용법: node tools/kopis_venue.mjs fetch|dict|patch|selftest');
}
