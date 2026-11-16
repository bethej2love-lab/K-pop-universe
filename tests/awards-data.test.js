// 시상식 수상 데이터(awards/*.json) 검증 (2026-11-16, 사용자 "수상 정보 다 수집하자")
// 정본은 사람이 출처를 보고 적은 awards/{시상식}-{연도}.json — 모양·출처·그룹/멤버 연결이 깨지지 않았는지, 확인된 핵심 사실이 안 바뀌었는지 본다.
// 실행: node tests/awards-data.test.js
const path = require('path');
(async () => {
  const { loadAwards, resolveWinner } = await import(require('url').pathToFileURL(path.join(__dirname, '..', 'tools', 'awards_check.mjs')).href);
  const awards = loadAwards();
  let failures = 0;
  const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { failures++; console.error('FAIL ' + n + ': ' + e.message); } };
  const assert = require('node:assert/strict');
  const TIERS = new Set(['대상', '본상', '신인', '인기', '특별']);

  check('시상식 파일이 하나 이상 있다', () => assert.ok(awards.length >= 2));
  for (const a of awards) {
    check(a.file + ' — 기본 정보와 출처(https)·수집일', () => {
      assert.ok(a.id && a.edition && a.name && a.nameEn);
      assert.ok(Array.isArray(a.dates) && a.dates.length >= 1 && a.dates.every(d => /^\d{4}(-\d{2}-\d{2})?$/.test(d)), '날짜는 YYYY-MM-DD(자동 수집은 YYYY만 허용)');
      assert.ok(Array.isArray(a.src) && a.src.length >= (a.autoSource ? 1 : 2) && a.src.every(u => /^https:\/\//.test(u)), '출처 URL: 사람 확인분 2개 이상(교차), 자동 수집(autoSource)은 1개 이상');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(a.collectedAt));
    });
    check(a.file + ' — 부문: 이름·등급·수상자', () => {
      assert.ok(a.categories.length > 0);
      for (const c of a.categories) {
        assert.ok(c.ko && c.en, '부문 이름 없음');
        assert.ok(TIERS.has(c.tier), c.ko + ' 등급 ' + c.tier);
        assert.ok(c.winners.length > 0, c.ko + ' 수상자 없음');
        if (c.day) assert.ok(a.dates.includes(c.day), c.ko + ' 날짜 ' + c.day + '가 개최일 밖');
        for (const w of c.winners) assert.ok(w.name && w.name.trim() === w.name, c.ko + ' 수상자 이름');
      }
    });
    check(a.file + ' — 한 부문 안에 같은 수상자가 두 번 들어가지 않는다', () => {
      for (const c of a.categories) { // 이름이 같은 다른 부문(AAA 배우 부문 등)은 서로 별개라 부문 객체 하나 안에서만 본다
        const seen = new Set();
        for (const w of c.winners) {
          const k = [w.name, w.id || '', w.of || '', w.gko || ''].join('|');
          assert.ok(!seen.has(k), '중복: ' + c.ko + ' · ' + k); seen.add(k);
        }
      }
    });
    check(a.file + ' — 우주 밖 표시(!)가 아닌 수상자는 모두 그룹·멤버에 연결된다', () => {
      const bad = [];
      for (const c of a.categories) for (const w of c.winners) {
        const r = resolveWinner(w);
        if (r.kind === 'unresolved' || r.kind === 'ambiguous') bad.push(c.ko + ' · ' + w.name + ' (' + r.kind + ')');
      }
      assert.deepEqual(bad, [], '연결 안 됨 — 동명이인이면 @그룹/#id, 우주 밖이면 ! 표시:\n' + bad.join('\n'));
    });
  }
  // 확인된 핵심 사실(여러 기사에서 교차 확인) — 실수로 바뀌면 잡는다
  const get = (id, ed) => awards.find(a => a.id === id && a.edition === ed);
  const cat = (a, ko, day) => a.categories.find(c => c.ko === ko && (!day || c.day === day));
  const names = c => c.winners.map(w => w.name);
  check('MMA 2026 대상 5개 부문 수상자', () => {
    const m = get('mma', '2026'); assert.ok(m);
    assert.deepEqual(names(cat(m, '올해의 아티스트')), ['방탄소년단']);
    assert.deepEqual(names(cat(m, '올해의 앨범')), ['방탄소년단']);
    assert.deepEqual(names(cat(m, '올해의 글로벌-K 아티스트')), ['에스파']);
    assert.deepEqual(names(cat(m, '올해의 레코드')), ['코르티스']);
    assert.deepEqual(names(cat(m, '올해의 베스트송')), ['아이브']);
    assert.equal(cat(m, '올해의 앨범').work, '아리랑(ARIRANG)');
    assert.equal(m.categories.filter(c => c.tier === '대상').length, 5);
  });
  check('MMA 2026 올해의 신인과 TOP10(10팀)', () => {
    const m = get('mma', '2026');
    assert.deepEqual(names(cat(m, '올해의 신인')), ['롱샷', '알파드라이브원']);
    assert.equal(cat(m, '톱10').winners.length, 10); assert.equal(cat(m, '글로벌 톱10').winners.length, 10);
  });
  check('KGMA 2026 그랜드 상(아티스트 데이·뮤직 데이)', () => {
    const k = get('kgma', '2026'); assert.ok(k);
    assert.deepEqual(names(cat(k, '그랜드 아티스트')), ['영케이']);
    assert.deepEqual(names(cat(k, '그랜드 송')), ['트레저']);
    assert.deepEqual(names(cat(k, '그랜드 레코드')), ['에이티즈']);
    assert.deepEqual(names(cat(k, '그랜드 퍼포머')), ['라이즈']);
    assert.deepEqual(names(cat(k, '그랜드 아너스 초이스', '2026-11-07')), ['리센느', '앤더블']);
    assert.deepEqual(names(cat(k, '그랜드 아너스 초이스', '2026-11-08')), ['있지', '키키']);
    assert.equal(cat(k, '베스트 아티스트').winners.length, 15);
  });
  check('영케이는 데이식스 멤버(Young K)로 연결된다', () => {
    const k = get('kgma', '2026'); const r = resolveWinner(cat(k, '그랜드 아티스트').winners[0]);
    assert.equal(r.kind, 'member'); assert.equal(r.gko, '데이식스');
  });
  check('인덱스(awards/index.json)가 시상식 목록을 담는다', () => {
    const idx = require('../awards/index.json');
    for (const a of awards) assert.ok(idx.awards.some(x => x.id === a.id && x.edition === a.edition), a.file + '이 인덱스에 없음 — node tools/awards_check.mjs --write');
    assert.ok((idx.byGroup['코르티스'] || []).some(x => x.category === '올해의 레코드'));
  });
  console.log(failures ? '실패 ' + failures : '🎉 수상 데이터 테스트 통과');
  process.exit(failures ? 1 : 0);
})();
