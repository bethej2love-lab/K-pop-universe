// tours_raw.json → kpop_events INSERT SQL. 도시→국가 학습(빈 국가 보정), 내부중복 제거,
// 국가명 한글 정규화, 기존 kpop_events(그룹+날짜) 중복 제거 (2026-09-05).
import fs from 'fs';
const argv = process.argv.slice(2);
const IN = argv.includes('--in') ? argv[argv.indexOf('--in') + 1] : '/tmp/tours_raw.json';
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : process.env.HOME + '/Downloads/kpop_events_tours.sql';
const RAW = JSON.parse(fs.readFileSync(IN, 'utf8'));
const BASE = 'https://dukgguehegnembimqvkm.supabase.co', KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const CC = { 'Japan': '일본', 'United States': '미국', 'South Korea': '대한민국', 'China': '중국', 'Thailand': '태국', 'Taiwan': '대만', 'Philippines': '필리핀', 'Singapore': '싱가포르', 'Indonesia': '인도네시아', 'Malaysia': '말레이시아', 'Canada': '캐나다', 'Australia': '호주', 'France': '프랑스', 'Germany': '독일', 'England': '영국', 'United Kingdom': '영국', 'Mexico': '멕시코', 'Brazil': '브라질', 'Spain': '스페인', 'Netherlands': '네덜란드', 'Chile': '칠레', 'Vietnam': '베트남', 'Saudi Arabia': '사우디아라비아', 'Hong Kong': '홍콩', 'Macau': '마카오', 'Peru': '페루', 'Denmark': '덴마크', 'United Arab Emirates': '아랍에미리트', 'New Zealand': '뉴질랜드', 'Poland': '폴란드', 'Argentina': '아르헨티나' };

(async () => {
  // 1) 평탄화
  let shows = [];
  for (const g of Object.keys(RAW)) for (const s of RAW[g]) shows.push({ group: g, ...s });
  // 2) 도시→국가 학습(비어있지 않은 것에서)
  const cityCC = {};
  for (const s of shows) { const c = (s.country || '').trim(); if (c && c !== 'TBA' && s.city) { (cityCC[s.city] = cityCC[s.city] || {})[c] = (cityCC[s.city][c] || 0) + 1; } }
  const cityBest = {}; for (const city in cityCC) cityBest[city] = Object.entries(cityCC[city]).sort((a, b) => b[1] - a[1])[0][0];
  let filled = 0;
  for (const s of shows) { let c = (s.country || '').trim(); if ((!c || c === 'TBA') && cityBest[s.city]) { s.country = cityBest[s.city]; filled++; } }
  // 3) 국가 없는/TBA 제거
  const before = shows.length;
  shows = shows.filter(s => s.country && s.country.trim() && s.country !== 'TBA');
  // 4) 내부 중복 제거(그룹+날짜+도시+공연장)
  const seen = new Set(); shows = shows.filter(s => { const k = s.group + '|' + s.date + '|' + s.city + '|' + s.venue; if (seen.has(k)) return false; seen.add(k); return true; });
  // 5) 기존 kpop_events 로드(그룹+날짜 중복키)
  let existing = new Set(), from = 0;
  while (true) {
    const r = await fetch(BASE + '/rest/v1/kpop_events?select=date_start,groups', { headers: { ...H, Range: `${from}-${from + 999}` } });
    const j = await r.json(); if (!Array.isArray(j) || !j.length) break;
    j.forEach(e => (e.groups || []).forEach(g => existing.add(g + '|' + (e.date_start || '').slice(0, 10))));
    from += 1000; if (j.length < 1000) break;
  }
  const dupExist = shows.filter(s => existing.has(s.group + '|' + s.date)).length;
  shows = shows.filter(s => !existing.has(s.group + '|' + s.date));
  // 6) 국가 한글화 + SQL
  // 인접 위키링크로 붙은 온라인콘서트 브랜드 주석 제거(예: "GymnasiumBeyond Live")
  const cleanVenue = v => String(v || '').replace(/(Beyond Live|Weverse(?: Con)?[a-z]*|V ?Live|Untact|Live Nation)\s*$/i, '').trim();
  const esc = v => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
  let sql = '-- 위키피디아 콘서트 투어 → kpop_events (해외투어·과거이력 보완)\n';
  sql += `-- 도시학습보정 ${filled} · 국가없음제거 ${before - shows.length - dupExist}·기존중복 ${dupExist} · 최종 ${shows.length}건\nBEGIN;\n`;
  const CITY_FIX = { 'Hong Kong': '홍콩', 'Kowloon': '홍콩', 'Macau': '마카오', 'Macao': '마카오', 'Taipei': '대만', 'Kaohsiung': '대만', 'Taoyuan': '대만' };
  for (const s of shows) {
    const country = CITY_FIX[s.city] || CC[s.country] || s.country;
    const tour = (s.section && s.section.trim()) ? s.section
      : String(s.tour || '').replace(/^List of /, '').replace(/ (concert tours|live performances)$/i, '');
    sql += `INSERT INTO kpop_events (id,title,type,date_start,date_end,venue,city,country,groups) VALUES (gen_random_uuid(),${esc(tour)},'콘서트',${esc(s.date)},${esc(s.date)},${esc(cleanVenue(s.venue))},${esc(s.city)},${esc(country)},ARRAY[${esc(s.group)}]);\n`;
  }
  sql += 'COMMIT;\n';
  fs.writeFileSync(OUT, sql);
  console.log('도시보정:', filled, '| 최종 삽입:', shows.length, '| 기존중복스킵:', dupExist);
  const byG = {}; shows.forEach(s => byG[s.group] = (byG[s.group] || 0) + 1);
  console.log('그룹별:', Object.entries(byG).sort((a, b) => b[1] - a[1]).map(x => x[0] + '(' + x[1] + ')').join(' '));
  console.log('→', OUT);
})();
