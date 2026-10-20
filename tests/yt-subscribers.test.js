// 유튜브 구독자 수 수집 로직 테스트 (2026-10-20) — 네트워크 없이 가짜 응답으로. 실행: node tests/yt-subscribers.test.js
(async()=>{
const { ytSubKey, collectUrls, run, serialize } = await import('../tools/yt_subscribers.mjs');
let fail = 0; const ok = (c, m) => { if (c) console.log('✓', m); else { fail++; console.log('✗', m); } };
ok(ytSubKey('https://youtube.com/@cortis_bighit') === '@cortis_bighit', '@핸들 → 소문자 키');
ok(ytSubKey('https://www.youtube.com/@IVEstarship/videos') === '@ivestarship', '@핸들 뒤 경로 무시');
ok(ytSubKey('https://www.youtube.com/channel/UCEf_Bc-KVd7onSeifS3py9g') === 'UCEf_Bc-KVd7onSeifS3py9g', '채널 ID 그대로');
ok(ytSubKey('https://www.youtube.com/user/SMTOWN') === 'user:smtown', '/user/ 레거시');
ok(ytSubKey('https://www.youtube.com/watch?v=abc') === null, '영상 링크는 키 아님');
const urls = collectUrls({ groups: { A: { links: { youtube: 'https://youtube.com/@aaa' } }, B: { links: {} } }, artists: [{ links: { youtube: 'https://www.youtube.com/@BBB' } }], idolRows: [{ url: 'https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx' }, { url: 'https://youtube.com/@aaa' }] });
ok(urls.length === 3, '링크 모으기(중복 제거)');
let calls = [];
const fake = async u => { calls.push(u);
  if (u.includes('forHandle=%40aaa')) return { items: [{ id: 'UCaaaaaaaaaaaaaaaaaaaaaa' }] };
  if (u.includes('forHandle=%40bbb')) return { items: [{ id: 'UCbbbbbbbbbbbbbbbbbbbbbb' }] };
  if (u.includes('part=statistics')) return { items: [
    { id: 'UCaaaaaaaaaaaaaaaaaaaaaa', statistics: { subscriberCount: '1230000' } },
    { id: 'UCbbbbbbbbbbbbbbbbbbbbbb', statistics: { hiddenSubscriberCount: true } },
    { id: 'UCxxxxxxxxxxxxxxxxxxxxxx', statistics: { subscriberCount: '45600' } }] };
  return { items: [] }; };
const r1 = await run({ urls, prev: { ch: { '@old': { id: 'UCold', s: 1 } } }, fetchJson: fake, log: () => {} });
ok(r1.ch['@aaa'].s === 1230000 && r1.ch['@bbb'].s === null && r1.ch['UCxxxxxxxxxxxxxxxxxxxxxx'].s === 45600, '구독자 수·숨김(null)·채널 ID');
ok(!r1.ch['@old'], '링크에서 빠진 채널은 지움');
ok(r1.units === 3, `첫 실행 유닛 = 핸들 2 + 통계 1 (실제 ${r1.units})`);
calls = [];
const r2 = await run({ urls, prev: { ch: r1.ch }, fetchJson: fake, log: () => {} });
ok(r2.units === 1 && !calls.some(c => c.includes('forHandle')), '두 번째부터는 핸들을 다시 안 풂(통계 1유닛)');
const big = Array.from({ length: 120 }, (_, i) => `https://www.youtube.com/channel/UC${String(i).padStart(22, '0')}`);
const r3 = await run({ urls: big, prev: null, fetchJson: async () => ({ items: [] }), log: () => {} });
ok(r3.units === 3, `채널 120개 → 통계 3번(50개씩) (실제 ${r3.units})`);
const r4 = await run({ urls: ['https://youtube.com/@a1', 'https://youtube.com/@a2', 'https://youtube.com/@a3'], prev: null, fetchJson: async () => ({ items: [] }), resolveMax: 2, log: () => {} });
ok(r4.units <= 3, '한 번에 푸는 핸들 수 상한');
const js = JSON.parse(serialize(r1.ch)); ok(js.ch['@aaa'].s === 1230000 && js.updatedAt, '파일 형식');
console.log(fail ? `\n❌ ${fail} 실패` : '\n✅ 0 실패'); process.exit(fail ? 1 : 0);
})();
