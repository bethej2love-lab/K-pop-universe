// CSS/viewport에 따라 innerText의 div 경계 개행이 사라져도 실패 단계를 놓치지 않는다.
// CDP에서 함수 본문을 그대로 실행하므로 외부 변수/Node 전용 API에 의존하지 않는다.
function routineLogResult(document) {
  const root = document.getElementById('adm-routine-log');
  const rows = Array.from(root?.children || []).map(el => String(el.textContent || '').trim()).filter(Boolean);
  return {
    summary: rows.join('\n'),
    failedSteps: rows.filter(text => text.startsWith('❌') || text.startsWith('■')).length,
    hasLog: rows.length > 0,
  };
}
module.exports = {routineLogResult};
