// 음악방송 결방 목록 → music_show_breaks.json (2026-10-19)
//
// 왜: 일요일 인기가요가 결방하면 월요일 This Week 소식에 그날 1위가 비어서 "아직 수집 안 된 건가?"로 보인다(사용자 제보).
// 결방이면 "결방"이라고 작게라도 보여준다. 출처 셋을 합친다:
//   ① 영문 위키 "List of {Show} Chart winners ({연도})" 표의 "No show" 줄 — 정확하지만 반영이 하루 이상 늦을 때가 있다
//   ② 구글 뉴스 RSS "{방송} 결방" — 결방 기사는 보통 며칠 전·당일에 나온다. **제목·요약에 날짜(18일·10월 18일·오늘(18일))가
//      있고 그 날짜가 그 방송 요일과 맞을 때만** 쓴다. "결방 아닌 방송시간 변경" 같은 부정 기사는 뺀다
//   ③ music_show_breaks.json의 manual(사람이 확인해 넣은 것) — 그대로 유지
// 1위 기록이 있는 날은 결방으로 치지 않는다(앱이 한 번 더 거른다).
// 실행: node tools/music_show_breaks.mjs   (music-show-breaks.yml, 하루 3번)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'music_show_breaks.json');
// music_show_wins.show 값 · 방송 요일(0=일) · 위키 문서 이름 · 뉴스 검색어
const SHOWS = {
  '인기가요': { dow: 0, wiki: 'Inkigayo', q: '인기가요' },
  '쇼음악중심': { dow: 6, wiki: 'Show! Music Core', q: '음악중심' },
  '뮤직뱅크': { dow: 5, wiki: 'Music Bank', q: '뮤직뱅크' },
  '엠카운트다운': { dow: 4, wiki: 'M Countdown', q: '엠카운트다운' },
  '쇼챔피언': { dow: 3, wiki: 'Show Champion', q: '쇼챔피언' },
  '더쇼': { dow: 2, wiki: 'The Show', q: '더쇼' },
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const get = url => { try { return execFileSync('curl', ['-skL', '-m', '30', '-A', UA, url], { maxBuffer: 1 << 26 }).toString('utf8'); } catch { return ''; } };
const kst = () => new Date(Date.now() + 9 * 3600e3);
const ymd = d => d.toISOString().slice(0, 10);
const today = ymd(kst());
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const manual = Array.isArray(prev.manual) ? prev.manual : [];
const found = new Map(); // show|date → {show,date,src,note}
const add = (show, date, src, note) => { const k = show + '|' + date; if (!found.has(k)) found.set(k, { show, date, src, ...(note ? { note } : {}) }); };

// ① 위키 — 올해(1월이면 작년도)
const years = [...new Set([kst().getUTCFullYear(), new Date(Date.now() - 20 * 864e5).getUTCFullYear()])];
for (const [show, s] of Object.entries(SHOWS)) {
  for (const y of years) {
    const raw = get(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(`List of ${s.wiki} Chart winners (${y})`.replace(/ /g, '_'))}&action=raw&redirect=yes`);
    if (!raw || raw.length < 3000) continue;
    let pending = 0; // rowspan으로 다음 줄까지 덮는 "No show"
    for (const blk of raw.split(/\n\|-\s*\n/)) {
      const m = blk.match(/\{\{dts\|([A-Za-z]+) (\d{1,2})\}\}/);
      if (!m) continue;
      const mi = MONTHS.indexOf(m[1]); if (mi < 0) continue;
      const date = `${y}-${String(mi + 1).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
      if (/No show/i.test(blk)) { add(show, date, 'wiki'); const rs = blk.match(/No show[\s\S]*?$/) && (blk.match(/rowspan="(\d+)"[^\n]*No show/i) || [])[1]; pending = rs ? +rs - 1 : 0; }
      else if (pending > 0 && !/\[\[|"[^"]+"/.test(blk.replace(m[0], ''))) { add(show, date, 'wiki'); pending--; }
      else pending = 0;
    }
  }
}

// ② 뉴스 — 최근 3주 기사, 날짜가 적힌 것만
const NEG = /결방\s*(아닌|아니|없|NO\b|X\b)|시간\s*변경|정상\s*방송|결방\s*없이/i;
for (const [show, s] of Object.entries(SHOWS)) {
  const xml = get(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${s.q}" 결방`)}+when:21d&hl=ko&gl=KR&ceid=KR:ko`);
  for (const it of xml.split('<item>').slice(1)) {
    const title = (it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc = ((it.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '').replace(/&lt;[\s\S]*?&gt;/g, ' ');
    const pub = Date.parse((it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
    const txt = (title + ' ' + desc).replace(/&amp;/g, '&').replace(/&nbsp;|&amp;nbsp;/g, ' ');
    if (!txt.includes(s.q) || !txt.includes('결방') || NEG.test(txt) || !isFinite(pub)) continue;
    // 그 방송 요일인 날짜 중 기사 시각 기준 -3일~+21일 안에서, 글에 적힌 "N일"과 맞는 날
    const days = new Set([...txt.matchAll(/(?:(\d{1,2})월\s*)?(\d{1,2})일/g)].map(x => (x[1] ? +x[1] + '/' : '') + +x[2]));
    if (!days.size) continue;
    for (let t = pub - 3 * 864e5; t <= pub + 21 * 864e5; t += 864e5) {
      const d = new Date(t + 9 * 3600e3); if (d.getUTCDay() !== s.dow) continue;
      const mo = d.getUTCMonth() + 1, da = d.getUTCDate();
      if (days.has(String(da)) || days.has(mo + '/' + da)) add(show, ymd(d), 'news', title.replace(/&amp;/g, '&').slice(0, 120));
    }
  }
}
for (const m of manual) if (m && m.show && m.date) add(m.show, m.date, 'manual', m.note);

// 최근 60일 ~ 앞으로 30일만 남긴다
const lo = ymd(new Date(Date.now() + 9 * 3600e3 - 60 * 864e5)), hi = ymd(new Date(Date.now() + 9 * 3600e3 + 30 * 864e5));
const breaks = [...found.values()].filter(b => b.date >= lo && b.date <= hi).sort((a, b) => a.date.localeCompare(b.date) || a.show.localeCompare(b.show));
const out = { breaks, manual };
const body = JSON.stringify(out, null, 1) + '\n';
if (body !== JSON.stringify({ breaks: prev.breaks || [], manual: prev.manual || [] }, null, 1) + '\n') fs.writeFileSync(OUT, body);
console.log(`결방 ${breaks.length}건 (오늘 ${today}) — ` + breaks.map(b => `${b.show} ${b.date.slice(5)}(${b.src})`).join(', '));
