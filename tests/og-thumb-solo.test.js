// 공유 미리보기(og:image) 커버리지 회귀 테스트 — 특히 솔로 아티스트 (2026-09-11 신설)
//
// 왜 만들었나: 사용자 제보 — "솔로 가수는 링크 복사하면 영상 썸네일이 안 뜨고 K-POP Universe 기본
// 이미지가 뜬다. 그룹이나 그룹 내 멤버는 잘 뜨는데." 실측하니 **솔로 341명 중 339명**이 기본 이미지였다.
//
// 원인은 조회 키였다. 솔로 아티스트는 groups.json에 없고 영상의 `group_ko`가 **본인 이름**이다
// (shared.js `_ytGroupKoFor`: 실존 그룹이면 그룹명, 아니면 a.name.ko). 그런데 수집기
// tools/build_og_thumbs.mjs는 `Object.keys(groups)`만 돌아서 솔로 영상을 한 건도 조회하지 않았다.
// 그룹·그룹멤버가 멀쩡했던 이유도 같다 — 그쪽 키는 groups.json에 있으니까.
//
// ⚠️ 키가 두 종류라는 점이 이 버그의 핵심이고, 그래서 여기서 못박는다:
//    · **조회** 키(DB group_ko)    = 솔로면 본인 이름     ("아이유")
//    · **저장/조회용 캐시** 키      = `a.group.ko|이름`    ("솔로|아이유")  ← build_group_pages.js가 찾는 형태
//    둘을 헷갈리면 수집은 되는데 페이지에선 못 찾는(또는 그 반대) 조용한 실패가 난다.
//
// 실행: node tests/og-thumb-solo.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = (m, extra) => { pass = false; console.log(`❌ ${m}` + (extra ? `\n   → ${extra}` : '')); };

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8')));
const thumbs = JSON.parse(fs.readFileSync(path.join(ROOT, 'og_thumbs.json'), 'utf8'));
const builder = fs.readFileSync(path.join(ROOT, 'tools', 'build_og_thumbs.mjs'), 'utf8');

// ── 1) 수집기가 솔로 키를 조회 대상에 넣는가 ──────────────────────────────────
if (/soloKeys/.test(builder) && /!groups\[a\.group\.ko\]/.test(builder))
  ok('수집기가 솔로(groups.json에 없는 소속) 아티스트를 조회 대상에 포함');
else bad('수집기가 groups.json 키만 돈다 — 솔로 영상이 통째로 조회에서 빠진다');

// ── 1-2) 기존 캐시를 검증하고 오염된 키만 다시 뽑는가 ──────────────────────────
// 솔로 전업만의 문제가 아니다 — 태연·화사·지코처럼 **그룹에 속한 채 병행**하는 멤버도 솔로 활동
// 영상은 group_ko가 본인 이름이라, groups.json 키만 도는 루프엔 안 잡힌다. 그 행이 조회조차 안 되면
// 커버 가드에도 안 걸려서, 태연 썸네일이 성한빈 무대인 채로 **--keep-existing에 그대로 유지**됐다.
// ⚠️ 전 아티스트 이름 키를 매번 조회하는 방식은 폐기했다 — `group_ko=in.(…)`가 인덱스를 못 타서
//    실측 12분을 넘겨 중단했다. 대신 기존 캐시의 영상 id를 **PK로** 확인하고(빠르다), 커버로 판정된
//    키의 주인만 이름 키로 재조회한다(실측 재조회 대상 7명).
if (/prevForAudit/.test(builder) && /id: 'in\.\(/.test(builder) && /reQuery/.test(builder))
  ok('기존 캐시를 PK로 검증하고 오염된 키의 주인만 재조회');
else bad('캐시 검증 경로가 없음 — 한번 잘못 박힌 썸네일이 --keep-existing으로 영구 고착된다');

// ── 1-3) 커버 무대를 대표 썸네일 후보에서 빼는가 ───────────────────────────────
// 공유 미리보기는 "그 사람 얼굴"이어야 한다. 커버 무대는 태깅이 맞더라도 남이 부른 무대일 수 있고,
// 태깅이 틀리면(원곡자가 group_ko에 들어간 행) 바로 남의 무대가 대표 이미지가 된다.
if (/isCoverish/.test(builder) && /dirtyIds/.test(builder))
  ok('커버 무대를 후보에서 제외하고, 예전 캐시가 물고 있으면 교체(dirtyIds)');
else bad('커버 가드가 없음 — 남의 무대가 대표 이미지로 남을 수 있다');

// ── 2) 캐시 키 형식이 빌더가 찾는 것과 같은가 ─────────────────────────────────
{
  const pages = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'utf8');
  const usesPipeKey = /a\.group\.ko \+ '\|' \+ a\.name\.ko/.test(pages);
  const storesPipeKey = /a\.group\.ko \+ '\|' \+ a\.name\.ko/.test(builder);
  if (usesPipeKey && storesPipeKey) ok("캐시 키 형식 일치 — 양쪽 다 `group.ko|이름`");
  else bad('캐시 키 형식이 어긋남', `build_group_pages.js=${usesPipeKey} / build_og_thumbs.mjs=${storesPipeKey}`);
}

// ── 3) 실제 커버리지 — 솔로가 그룹멤버만큼 채워져 있는가 ──────────────────────
const solos = artists.filter(a => a && a.group && a.name && !groups[a.group.ko]);
const grouped = artists.filter(a => a && a.group && a.name && groups[a.group.ko]);
const hasThumb = a => !!(thumbs.members && thumbs.members[a.group.ko + '|' + a.name.ko]);
const soloHit = solos.filter(hasThumb).length;
const groupHit = grouped.filter(hasThumb).length;
const soloRate = solos.length ? soloHit / solos.length : 1;
const groupRate = grouped.length ? groupHit / grouped.length : 1;

console.log(`   솔로 ${soloHit}/${solos.length} (${(soloRate * 100).toFixed(0)}%) · 그룹 멤버 ${groupHit}/${grouped.length} (${(groupRate * 100).toFixed(0)}%)`);

// 절대 기준이 아니라 **그룹 멤버 대비**로 본다 — DB에 영상이 없는 아티스트는 어느 쪽에도 있으므로
// 100%를 요구할 수 없다. 버그였을 때 솔로는 0.6%, 그룹 멤버는 90%대였다(격차가 신호).
if (soloRate >= groupRate * 0.7) ok(`솔로 커버리지가 그룹 멤버와 같은 수준(비율 ${(soloRate / groupRate).toFixed(2)}배)`);
else bad(`솔로 커버리지가 그룹 멤버보다 현저히 낮다 — 조회 키 누락 의심`,
  `솔로 ${(soloRate * 100).toFixed(0)}% vs 그룹 멤버 ${(groupRate * 100).toFixed(0)}%`);

// ── 4) 대표 사례 ─────────────────────────────────────────────────────────────
for (const name of ['아이유', '청하', '태연']) {
  const a = artists.find(x => x.name && x.name.ko === name);
  if (!a) { console.log(`   (참고) ${name} 없음 — 건너뜀`); continue; }
  const key = a.group.ko + '|' + a.name.ko;
  const t = thumbs.members && thumbs.members[key];
  if (t && !/og-image\.png/.test(t)) ok(`${name}(${key}) → 영상 썸네일`);
  else bad(`${name}(${key}) → 썸네일 없음/기본 이미지`, String(t || '(키 없음)'));
}

// ── 5) 생성된 정적 페이지에서 기본 이미지로 떨어진 비율(참고) ──────────────────
// 페이지는 빌드 후에만 갱신되므로 **경고만** 한다(테스트를 실패시키지 않는다) — og_thumbs.json을
// 새로 만들고 아직 build_group_pages.js를 안 돌린 상태가 정상적으로 존재한다.
{
  const dir = path.join(ROOT, 'member');
  if (fs.existsSync(dir)) {
    const names = fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'index.html')));
    let fallback = 0;
    for (const n of names) {
      const h = fs.readFileSync(path.join(dir, n, 'index.html'), 'utf8');
      const m = h.match(/property="og:image" content="([^"]+)"/);
      if (m && /og-image\.png/.test(m[1])) fallback++;
    }
    const pct = names.length ? (fallback / names.length * 100).toFixed(0) : 0;
    console.log(`   [참고] member/ 정적 페이지 ${names.length}개 중 기본 이미지 폴백 ${fallback}개 (${pct}%)` +
      (fallback ? ' — 남아 있으면 `node build_group_pages.js`로 리빌드 필요' : ''));
  }
}

console.log(pass ? '\n✅ og:image 커버리지 테스트 통과' : '\n❌ 실패 있음');
process.exit(pass ? 0 : 1);
