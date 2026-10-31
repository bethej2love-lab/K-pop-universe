// RLS 읽기 검사: 오류/알 수 없는 건수를 '0행(차단됨)'으로 해석하지 않는다.
function parseExactCount(response) {
  if (!response.ok) throw new Error('RLS 읽기 HTTP ' + response.status);
  const range = response.headers.get('content-range') || '';
  const match = /^(?:\d+-\d+|\*)\/(\d+)$/.exec(range);
  if (!match) throw new Error('RLS 읽기 정확한 행 수 누락/형식 오류');
  const count = Number(match[1]);
  if (!Number.isSafeInteger(count)) throw new Error('RLS 읽기 행 수 범위 오류');
  return count;
}
module.exports = { parseExactCount };
