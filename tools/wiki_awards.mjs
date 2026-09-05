// 위키 시상식 대상(大賞) 수집 — "List of awards and nominations received by X"의 수상표에서
// 대상급(Daesang/Grand Prize/올해의 가수·앨범·노래)만 뽑는다. 본상·베스트·신인상 제외 (2026-09-05).
// 실행: node tools/wiki_awards.mjs --group 트와이스 | --all
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const UA = 'kpopuniverse-tourbot/1.0 (before0hwa@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';
const get = url => { for (let t = 0; t < 5; t++) { try { execFileSync('sleep', ['0.5']); } catch (_) {} try { const b = execFileSync('curl', ['-sk', '-m', '40', '-A', UA, url + (url.includes('?') ? '&' : '?') + 'maxlag=5'], { maxBuffer: 1 << 28, encoding: 'utf8' }); if (/^You are making too many/i.test(b.slice(0, 30))) { execFileSync('sleep', ['5']); continue; } return JSON.parse(b); } catch (e) { try { execFileSync('sleep', ['3']); } catch (_) {} } } return null; };
const wikitext = title => { const j = get(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`); return j?.parse?.wikitext || ''; };
const resolveTitle = name => { const j = get(`${API}?action=query&titles=${encodeURIComponent(name)}&redirects=1&format=json&formatversion=2`); const p = j?.query?.pages?.[0]; return (p && !p.missing) ? p.title : name; };

const clean = raw => { let s = String(raw || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/\{\{(?:nowrap|sortname)\|([^{}|]+)[^{}]*\}\}/gi, '$1'); for (let i = 0; i < 4; i++) s = s.replace(/\{\{[^{}]*\}\}/g, ''); s = s.split('{{')[0]; return s.replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim(); };

// 주요 시상식만(큼지막한 대상용) — 마이너·문화·해외 군소상 제외
const MAJOR = /Mnet Asian Music Awards|MAMA Awards|Melon Music Awards|Golden Disc|Seoul Music Awards|Circle Chart Music Awards|Gaon Chart Music Awards|Asia Artist Awards|Genie Music Awards|The Fact Music Awards|Hanteo Music Awards|APAN Music Awards/i;
// 대상 판별: 주요시상식 + (명시적 Daesang/Grand Prize OR 올해의 가수·앨범·노래·레코드). 분기·월간·디지털·장르상 제외
const isDaesang = (cat, cer) => {
  if (!MAJOR.test(cer || '')) return false;
  if (/quarter|monthly|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(cat)) return false;
  if (/digital music|by download|by streaming|streaming|unique listeners|– digital|- digital|– global|- global|retail|social|steady seller|music video|\btour\b|fandom|group of the year|worldwide icon|hallyu|brand|idol of the year|rookie|new artist|bonsang|\bbest\b|popularity|discovery|netizen|performer|overseas|top \d/i.test(cat)) return false;
  if (/daesang|grand prize|grand award/i.test(cat)) return true;
  return /\b(artist|album|song|record) of the year\b/i.test(cat);
};
const isWin = cell => /\{\{\s*won/i.test(cell) || /^\s*won\s*$/i.test(clean(cell));

function parseAwards(tblText) {
  const rows = tblText.split(/\n\|-/);
  let hIdx = rows.findIndex(r => /^\s*!/m.test(r));
  if (hIdx < 0) return [];
  const hcells = [];
  rows[hIdx].split('\n').forEach(ln => { if (/^\s*!/.test(ln)) ln.replace(/^\s*!/, '').split('!!').forEach(c => hcells.push(clean(c.split('|').pop()))); });
  const idx = n => hcells.findIndex(h => new RegExp(n, 'i').test(h));
  const yi = idx('year'), cei = idx('ceremony|award'), ci = idx('category'), ri = idx('result');
  if (ci < 0 || ri < 0) return [];
  const nCols = hcells.length, pending = {}, out = [];
  for (const rowText of rows.slice(hIdx + 1)) {
    const cells = [];
    for (const ln of rowText.split('\n')) {
      if (/^\s*\|\}/.test(ln)) continue;
      if (!/^\s*[|!]/.test(ln)) continue; // 시상식명은 ! scope="row" 행헤더로 들어감 — !도 셀로 취급
      for (const seg of ln.replace(/^\s*[|!]/, '').split(/\|\||!!/)) {
        let attrs = '', val = seg; const bar = seg.indexOf('|');
        if (bar >= 0 && /rowspan|colspan|style|scope|align|class/i.test(seg.slice(0, bar))) { attrs = seg.slice(0, bar); val = seg.slice(bar + 1); }
        const rs = (attrs.match(/rowspan\s*=\s*"?(\d+)/i) || [])[1], cs = (attrs.match(/colspan\s*=\s*"?(\d+)/i) || [])[1];
        cells.push({ raw: val, rowspan: rs ? +rs : 1, colspan: cs ? +cs : 1 });
      }
    }
    if (!cells.length) continue;
    const rowArr = new Array(nCols).fill(null);
    let col = 0, k2 = 0;
    while (col < nCols) {
      if (pending[col] && pending[col].rows > 0) { rowArr[col] = pending[col].val; pending[col].rows--; col++; continue; }
      const cell = cells[k2++]; if (!cell) break;
      for (let k = 0; k < cell.colspan && col + k < nCols; k++) { rowArr[col + k] = cell.raw; if (cell.rowspan > 1) pending[col + k] = { val: cell.raw, rows: cell.rowspan - 1 }; }
      col += cell.colspan;
    }
    const cat = clean(rowArr[ci] || ''); if (!cat) continue;
    const cer = cei >= 0 ? clean(rowArr[cei] || '') : '';
    if (!isWin(rowArr[ri] || '') || !isDaesang(cat, cer)) continue;
    const year = (clean(rowArr[yi] || '').match(/\d{4}/) || [])[0] || '';
    out.push({ year, ceremony: cer, category: cat });
  }
  return out;
}
function collectAwards(canon) {
  const bare = canon.replace(/\s*\(.*\)$/, '');
  let wt = wikitext(`List of awards and nominations received by ${canon}`);
  if (!wt && bare !== canon) wt = wikitext(`List of awards and nominations received by ${bare}`);
  if (!wt) wt = wikitext(canon); // 별도 수상문서 없으면 본문(Awards 섹션)에서
  if (!wt) return [];
  wt = wt.replace(/\{\{anchor\|[^}]*\}\}/gi, ''); // 앵커 템플릿 사전 제거(셀 분리 오염 방지)
  const seen = new Set(), out = [];
  for (const seg of wt.split(/\{\|/).slice(1)) {
    const tbl = seg.split(/\n\|\}/)[0];
    if (!/\|\s*result/i.test(tbl) && !/!\s*result/i.test(tbl)) continue;
    for (const a of parseAwards(tbl)) { const k = a.year + '|' + a.ceremony + '|' + a.category; if (!seen.has(k)) { seen.add(k); out.push(a); } }
  }
  return out;
}

if (argv.includes('--group')) {
  const ko = argv[argv.indexOf('--group') + 1];
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const canon = resolveTitle(G[ko]?.en || ko);
  const aw = collectAwards(canon);
  console.log(`[${ko}/${canon}] 대상 ${aw.length}개`);
  aw.forEach(a => console.log(`  ${a.year} ${a.ceremony} — ${a.category}`));
  process.exit(0);
}
if (argv.includes('--all')) {
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const out = {}; let gi = 0, tot = 0; const names = Object.keys(G);
  for (const ko of names) {
    gi++; const en = G[ko]?.en; if (!en) continue;
    let aw; try { aw = collectAwards(resolveTitle(en)); } catch (e) { aw = []; }
    if (aw.length) { out[ko] = aw; tot += aw.length; }
    process.stderr.write(`\r[${gi}/${names.length}] ${ko} · 대상누적 ${tot} · 그룹 ${Object.keys(out).length}    `);
  }
  fs.writeFileSync('/tmp/awards_raw.json', JSON.stringify(out));
  console.log(`\n\n완료 — ${Object.keys(out).length}그룹 · 대상 ${tot}개 → /tmp/awards_raw.json`);
  process.exit(0);
}
console.log('사용: --group 한글명 | --all');
