// YouTube API 키가 속한 구글 프로젝트 번호 프로브(admin.js _ytKeyProjectFrom/_ytKeyProjectProbe) — 감사 III.D.1c(2026-11-17).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const a = src.indexOf('function _ytKeyProjectFrom('), endMark = 'catch(e){return null;}\n}\n', b = src.indexOf(endMark, a); assert(a > 0 && b > a, '프로브 함수를 못 찾음');
const code = src.slice(a, b + endMark.length);
const calls = []; let body = '';
const ctx = { fetch: async u => { calls.push(String(u)); return { text: async () => body }; }, encodeURIComponent, String, RegExp };
vm.createContext(ctx); vm.runInContext(code, ctx);
// 구글 오류 응답 두 형태 + 키 오류
const disabled = JSON.stringify({ error: { code: 403, message: 'Cloud Translation API has not been used in project 795312566718 before or it is disabled. Enable it by visiting ...', status: 'PERMISSION_DENIED', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', domain: 'googleapis.com', metadata: { consumer: 'projects/795312566718', service: 'translate.googleapis.com' } }] } });
const blocked = JSON.stringify({ error: { code: 403, message: 'Requests to this API translate.googleapis.com method google.cloud.translation.v2.TranslateService.TranslateText are blocked.', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_SERVICE_BLOCKED', metadata: { consumer: 'projects/795312566718', service: 'translate.googleapis.com' } }] } });
const invalid = JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } });
const msgOnly = JSON.stringify({ error: { code: 403, message: 'Cloud Translation API has not been used in project 123456789012 before or it is disabled.' } });
(async () => {
  assert.equal(ctx._ytKeyProjectFrom(disabled), '795312566718');
  assert.equal(ctx._ytKeyProjectFrom(blocked), '795312566718');
  assert.equal(ctx._ytKeyProjectFrom(msgOnly), '123456789012');
  assert.equal(ctx._ytKeyProjectFrom(invalid), null, '키 오류엔 번호가 없다');
  assert.equal(ctx._ytKeyProjectFrom(''), null);
  body = blocked; assert.equal(await ctx._ytKeyProjectProbe('KEY&x=1'), '795312566718');
  assert(calls[0].includes('translate.googleapis.com') && !calls[0].includes('youtube'), '유튜브 API가 아니라 쿼터를 안 쓰는 다른 API로 부른다');
  assert(calls[0].includes(encodeURIComponent('KEY&x=1')), '키는 URL 인코딩');
  assert.equal(await ctx._ytKeyProjectProbe(''), null); assert.equal(calls.length, 1, '키가 없으면 요청하지 않는다');
  console.log('✅ 키 프로젝트 번호 프로브: 두 오류 형태·키 오류·빈 키·쿼터 미사용');
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
