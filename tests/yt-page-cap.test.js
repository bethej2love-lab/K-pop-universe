// 채널당 페이지 상한 테스트 (2026-09-21)
//
// 왜 이 테스트가 있나: `_ytFetchNewVideos`에 페이지 상한이 **없어서** 매일 루틴이 하루에 한 번만
// 제대로 돌고 있었다. 기준점(sinceId) 영상이 삭제·비공개되면 페이지네이션에서 그 id를 영영 못 만나
// 채널의 맨 처음 영상까지 전부 훑는데, 영상이 수만 개인 방송사 채널이면 수백~수천 페이지다.
// 실측(2026-09-21): 쿼터 리셋 직후 회차만 2시간 16분(루틴 타임아웃에 걸려 잘림) 돌며 411건을 받고
// 하루치 쿼터를 통째로 태웠고, 나머지 7회차는 전부 0~1건. 사용자의 수동 백필도 403이었다.
//
// ⚠️ 소스에 상한 상수가 "있는지"만 보지 않는다 — 실제로 가짜 API를 물려 돌려보고 **몇 번 부르고
//    멈추는지**를 센다. 이 프로젝트엔 소스 문자열 검사가 실제 구멍을 통과시킨 전례가 여럿 있다.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── 함수 본문을 그대로 꺼내 온다 ────────────────────────────────────────────
// ⚠️ 중괄호 깊이 계산을 쓰지 않는다(템플릿 리터럴·주석 때문에 깨지기 쉽다) — admin.js의 최상위
//    함수라 닫는 중괄호가 열 0에 있으므로 줄 시작 '}'까지로 자른다.
const start = src.indexOf('async function _ytFetchNewVideos(');
need(start > 0, '_ytFetchNewVideos 함수를 찾음');
const end = src.indexOf('\n}\n', start);
need(end > start, '함수 끝을 찾음');
const body = src.slice(start, end + 2);

// 상한 상수도 같이 싣는다(함수 밖에 선언돼 있다)
const capLine = src.match(/const YT_MAX_PAGES=\d+;/);
need(!!capLine, '채널당 페이지 상한 상수(YT_MAX_PAGES)가 있음');
const capValue = capLine ? Number(capLine[0].match(/\d+/)[0]) : 0;
need(capValue > 0 && capValue <= 200, `상한이 현실적인 값 (${capValue}페이지 = 영상 ${capValue * 50}개/채널/회차)`);

// ── 가짜 의존성 ─────────────────────────────────────────────────────────────
// 끝나지 않는 채널: 매 페이지 nextPageToken을 주고, sinceId와 같은 id는 **절대** 돌려주지 않는다.
// = 기준점 영상이 삭제된 채널에서 실제로 벌어지던 상황.
let calls = 0;
function makeDeps(stopAtPage) {
  calls = 0;
  return {
    _ytApiGet: async () => {
      calls++;
      const items = Array.from({ length: 50 }, (_, i) => ({
        snippet: {
          resourceId: { videoId: `vid${calls}_${i}` },
          title: `테스트 영상 ${calls}-${i}`,
          publishedAt: '2026-09-01T00:00:00Z',
          thumbnails: { high: { url: 'u', width: 480, height: 360 } },
        },
      }));
      const last = stopAtPage && calls >= stopAtPage;
      return { items, pageInfo: { totalResults: 99999 }, nextPageToken: last ? '' : `tok${calls}` };
    },
    _decodeHtmlEntities: s => s,
    _isBannedVideoTitle: () => false,
    _ytClassify: () => 'live',
    _ytIsShortTitle: () => false,
  };
}
function load(deps) {
  const names = Object.keys(deps);
  // 상한 상수는 함수 밖에 선언돼 있으므로 소스에서 그 줄을 그대로 앞에 붙인다(값을 테스트가 되풀이해
  // 적지 않기 위해 — 소스의 값이 바뀌면 이 테스트도 그 값으로 따라간다).
  const factory = new Function(...names, `${capLine[0]}\n${body}; return _ytFetchNewVideos;`);
  return factory(...names.map(n => deps[n]));
}

(async () => {
  // ── 1) 끝나지 않는 채널에서 상한에 걸려 멈추는가 ──────────────────────────
  {
    const deps = makeDeps(0); // 영원히 다음 페이지가 있는 채널
    const fetchNew = load(deps);
    const r = await fetchNew('UPLOADS', 'KEY', 'never-matching-id', null, '', null);
    need(calls <= capValue, `상한에서 멈춤 — API 호출 ${calls}회 ≤ ${capValue}`);
    need(calls === capValue, `상한만큼은 다 씀 (${calls}/${capValue}페이지)`);
    need(r.cappedOut === true, '상한으로 끊겼음을 호출부에 알림(cappedOut)');
    need(r.interrupted === true, '중단으로 표시됨 — 호출부가 resumeToken을 저장하는 분기');
    need(!!r.resumeToken, `다음 회차가 이어받을 지점이 남음(resumeToken=${r.resumeToken})`);
    need(r.done !== true, '완주로 표시하지 않음(과거가 남아 있으므로)');
    need(!!r.newestId, '채널 최신 영상 id를 돌려줌 — 북마크 갱신용(다음 회차가 같은 낭비를 반복하지 않게)');
    need(r.vids.length === capValue * 50, `받은 만큼은 버리지 않음 (${r.vids.length}개)`);
  }

  // ── 2) 호출부가 상한을 더 좁힐 수 있는가 ──────────────────────────────────
  {
    const deps = makeDeps(0);
    const fetchNew = load(deps);
    const r = await fetchNew('UPLOADS', 'KEY', 'never-matching-id', null, '', null, 3);
    need(calls === 3, `maxPages 인자가 먹힘 (${calls}페이지)`);
    need(r.cappedOut === true, '좁힌 상한에서도 cappedOut');
  }

  // ── 3) 정상 증분(기준점을 만남)은 그대로 끝나는가 ────────────────────────
  //    상한은 "비정상적으로 긴 스캔"만 잘라야 한다. 평상시 신규는 1~2페이지다.
  {
    const deps = makeDeps(0);
    const fetchNew = load(deps);
    const r = await fetchNew('UPLOADS', 'KEY', 'vid2_10', null, '', null); // 2페이지째에 있는 id
    need(calls === 2, `기준점을 만나면 거기서 끝 (${calls}페이지)`);
    need(r.done === true && !r.cappedOut, '정상 완료로 표시(cappedOut 아님)');
    need(r.vids.length === 60, `기준점 이전까지만 담음 (${r.vids.length}개)`);
  }

  // ── 4) 채널 끝까지 갔을 때도 정상 완료인가 ────────────────────────────────
  {
    const deps = makeDeps(2); // 2페이지에서 nextPageToken이 없는 짧은 채널
    const fetchNew = load(deps);
    const r = await fetchNew('UPLOADS', 'KEY', 'never-matching-id', null, '', null);
    need(r.done === true && !r.cappedOut, '채널 끝까지 완주하면 done');
    need(!r.resumeToken, '완주했으면 이어받을 지점이 없음');
  }

  // ── 5) 회차 예산 배선(구조) ───────────────────────────────────────────────
  // 페이지 상한만으로는 "채널 수 × 상한"이 여전히 지갑을 비울 수 있다. 회차 예산이 그 천장이다.
  need(/function _ytSetCallBudget\(/.test(src), '회차 호출 예산 설정 함수가 있음');
  need(/_ytCalls\+\+/.test(src), '공용 호출 경로(_ytApiGet)에서 호출 수를 센다');
  need(/_ytSetCallBudget\(_syncOnly\?_ADM_BUDGET_SYNC:_ADM_BUDGET_FULL\)/.test(src), '루틴이 회차 시작 시 예산을 건다');
  need(/_ytBudgetSpent\(\)>=_syncAllCap/.test(src), '공식 채널 동기화가 회차 예산의 일부만 쓴다(뒤 단계가 굶지 않게)');
  need(/_ytBudgetLeft\(\)<=2/.test(src), '외부 채널 루프도 예산을 보고 접는다');
  // 외부 채널 체크포인트 폴백 — 캐시를 한 번 잃으면 매번 전체 스캔에 들어가던 구멍
  const extIdx = src.indexOf('const resumeKey=`kpu_ext_resume_');
  // ⚠️ 범위를 넉넉히 잡되 전체 파일로 넓히지 않는다 — 공식 채널(_ytSyncGroup)에 **똑같은 줄**이
  //    있어서, 파일 전체를 훑으면 외부 채널 쪽이 비어 있어도 통과한다.
  const extSeg = src.slice(extIdx, extIdx + 6000);
  need(/source_handle.*order\('published_at'/s.test(extSeg), '외부 채널도 체크포인트가 없으면 DB 최신 영상으로 폴백');
  need(/if\(!resumeTok&&newestId\)localStorage\.setItem\(lsKey,newestId\)/.test(extSeg), '외부 채널 북마크를 newestId로 갱신(신규 0건이어도)');

  console.log(pass ? '\n✅ 페이지 상한 테스트 통과' : '\n💥 페이지 상한 테스트 실패');
  process.exit(pass ? 0 : 1);
})();
