// 공식 채널의 '출연' 재생목록 목록 만들기 → appearance_playlists.json (2026-10-15)
//
// 왜: 아티스트가 외부 출연 영상(Vogue Singapore 인터뷰·KBS 뉴스·라디오 등)을 자기 공식 채널 재생목록
// ("CORTIS On Air" 같은)에 모아둔다. 그 업로더 채널을 하나하나 등록하면 한 번 나온 채널(스캔 398곳 중 200곳)까지
// 동기화 순번·오태깅 위험을 떠안는다. 대신 재생목록 자체를 동기화 대상으로 삼는다 — 그 그룹이 직접 "우리 출연작"이라
// 모아둔 것이라 그룹 판정이 정확하다. 실제 수집은 admin.js _ytSyncAppearancePlaylists(루틴 1-4)가 이 파일을 읽어서 한다.
//
// 고르는 기준: 공식 채널(groups.json·artists.json links.youtube) 재생목록 중 제목이 출연·방송 성격(PL_RE)이고,
// 첫 페이지에 **다른 채널이 올린 영상이 1개 이상** 있는 것. 자기 영상만 있는 재생목록은 공식 채널 동기화가 이미 받는다.
// 유튜브 API를 쓰지 않는다(페이지의 ytInitialData) — 쿼터 0. curl -k(회사망 TLS 가로채기에서도 동작).
//
// 실행: node tools/build_appearance_playlists.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DRY = process.argv.includes('--dry');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artistsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);

// 동기화 키는 앱과 같은 규칙(shared.js _ytGroupKoFor): 실존 그룹이면 그룹 ko, 아니면(솔로) 본인 이름.
// 그룹 멤버 개인 채널이면 mko로 그 멤버를 고정한다.
const owners = [];
for (const [ko, g] of Object.entries(groups)) { const y = g.links && g.links.youtube; if (y) owners.push({ url: y, gko: ko, mko: null }); }
for (const a of artists) {
  const y = a.links && a.links.youtube; if (!y || owners.some(o => o.url === y)) continue;
  const inGroup = !!groups[a.group && a.group.ko];
  owners.push({ url: y, gko: inGroup ? a.group.ko : a.name.ko, mko: inGroup ? a.name.ko : null });
}

const PL_RE = /on\s?air|출연|appearance|interview|인터뷰|방송|\btv\b|radio|라디오|예능|variety|media|press|매거진|magazine|guest|게스트|외부|broadcast|\bshow\b|talk|토크|news|뉴스/i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try { const { stdout } = await run('curl', ['-skL', '--max-time', '30', '-A', UA, '-H', 'Accept-Language: ko', url], { maxBuffer: 64 << 20 }); if (stdout) return stdout; }
    catch (e) { }
    await sleep(1500);
  }
  return '';
}
function initData(h) { const m = h.match(/var ytInitialData = (\{.*?\});<\/script>/s); try { return m ? JSON.parse(m[1]) : null; } catch { return null; } }
function walk(o, f) { if (!o || typeof o !== 'object') return; f(o); for (const k in o) walk(o[k], f); }
const handleOf = u => decodeURIComponent((u || '').replace(/^.*youtube\.com\//, '').replace(/^@/, '').replace(/[/?#].*$/, '')).toLowerCase();

const out = []; let scanned = 0, plSeen = 0;
async function scanOwner(o) {
  const own = handleOf(o.url);
  const d = initData(await get(o.url.replace(/\/+$/, '') + '/playlists'));
  if (!d) return;
  const pls = [];
  walk(d, x => {
    const l = x.lockupViewModel;
    if (!l || l.contentType !== 'LOCKUP_CONTENT_TYPE_PLAYLIST') return;
    const t = (JSON.stringify(l).match(/"title":\{"content":"([^"]+)"/) || [])[1] || '';
    if (l.contentId && PL_RE.test(t) && !pls.some(p => p.id === l.contentId)) pls.push({ id: l.contentId, t });
  });
  for (const pl of pls.slice(0, 8)) {
    const pd = initData(await get('https://www.youtube.com/playlist?list=' + pl.id));
    plSeen++;
    if (!pd) continue;
    let n = 0, ext = 0;
    walk(pd, x => {
      const l = x.lockupViewModel; if (!l || l.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST') return;
      const h = (JSON.stringify(l).match(/"url":"\/@([^"/?]+)"/) || [])[1];
      n++; if (h && decodeURIComponent(h).toLowerCase() !== own) ext++;
    });
    if (ext > 0) out.push({ pl: pl.id, title: pl.t, gko: o.gko, mko: o.mko, ch: own, n, ext });
    await sleep(250);
  }
}
const CONC = 4; let idx = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (idx < owners.length) {
    const o = owners[idx++];
    try { await scanOwner(o); } catch (e) { console.error('[skip]', o.url, e.message); }
    if (++scanned % 50 === 0) console.log(`진행 ${scanned}/${owners.length} · 재생목록 ${plSeen} · 채택 ${out.length}`);
  }
}));
out.sort((a, b) => a.gko.localeCompare(b.gko, 'ko') || a.pl.localeCompare(b.pl));
console.log(`공식 채널 ${owners.length}곳 · 출연성 재생목록 ${plSeen}개 확인 · 외부 영상 있는 재생목록 ${out.length}개(그룹 ${new Set(out.map(x => x.gko)).size}팀)`);
if (!DRY) {
  const file = path.join(ROOT, 'appearance_playlists.json');
  // 스캔이 통째로 실패해(네트워크·유튜브 차단) 0개가 나오면 기존 파일을 지우지 않는다
  if (!out.length && fs.existsSync(file)) { console.log('⚠️ 0개 — 기존 파일 유지'); process.exit(0); }
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log('저장:', file);
}
