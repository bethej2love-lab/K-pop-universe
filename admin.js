// admin.js — kpop_universe 관리자 전용 도구 모음.
// _isAdmin() 확인 후에만 동적으로 로드되는 일반(비-모듈) 스크립트로, kpop_universe.html과 같은
// 전역 스코프를 공유한다(로딩 시점엔 이미 main 스크립트 실행이 끝나 있으므로 함수 호이스팅 걱정 없음).


function _ytApiKey(){return(localStorage.getItem('kpu_yt_key')||'').trim();}

// YouTube API가 title/description을 HTML 엔티티로 이스케이프해서 내려주는 경우가 있음(예: 어퍼스트로피가
// "&#39;"로, "&"가 "&amp;"로) — JSON이라 자동으로 안 풀리고 그대로 문자열에 박혀서, 화면은 textContent로
// (안전하게) 그대로 찍으니 "&#39;" 텍스트 자체가 그대로 보임(2026-08-18, 사용자 제보). <textarea>에
// innerHTML로 넣었다 .value로 꺼내는 방식이 모든 HTML 엔티티(이름/숫자 둘 다)를 브라우저가 알아서
// 정확히 디코딩해줘서 정규식 나열보다 안전 — 동기화 3곳(채널 훑기/과거 백필/URL 수동추가) 전부 적용.
function _decodeHtmlEntities(str){
  if(!str)return str;
  const ta=document.createElement('textarea');
  ta.innerHTML=str;
  return ta.value;
}

// 제목에 유니코드 "수학용 볼드체" 등 스타일드 문자(예: 𝐇𝐀𝐏𝐏𝐘 𝐁𝐈𝐑𝐓𝐇𝐃𝐀𝐘 — Shorts 제목 강조용으로 흔히 씀)가
// 있으면, 겉보기엔 일반 알파벳과 똑같아 보여도 코드상 완전히 다른 문자라서 일반 ILIKE 검색으론 절대 못
// 찾는다(2026-08-06, 사용자 제보 — 크래비티 카드에서 "birth" 검색이 스타일드 제목의 생일 축하 Shorts를
// 하나도 못 찾던 문제. "happy" 검색은 우연히 같이 붙은 일반 텍스트 해시태그 때문에 걸렸을 뿐이었음).
// 유니코드 NFKC 정규화가 이런 "Mathematical Alphanumeric Symbols" 블록을 일반 알파벳으로 자동 환원해주므로,
// 저장할 때 이 정규화+소문자 버전을 title_norm 컬럼에 같이 저장해두고, 검색어도 똑같이 접어서 그 컬럼끼리
// 비교한다(원래 title 컬럼은 화면 표시용으로 스타일 그대로 유지).

// "Performance Video"/"Dance Practice"류는 실제 무대가 아니라 스튜디오에서 미리 찍은 사전제작 콘텐츠
// 포맷 이름이라, PERFORMANCE/LIVE 단어만 보고 라이브로 오분류되던 문제가 있었음(2026-08-06, 사용자 제보로
// 실측 확인 — "Performance Video"만 761건, TWICE/NMIXX/베이비몬스터 등. "LIVE Dance Practice"류도 동일).
// 직캠/팬캠/CONCERT/라이브처럼 더 확실한 신호가 같이 있으면 그쪽을 우선해서 그래도 라이브로 잡는다.
const _YT_PRERECORDED_RE=/PERFORMANCE\s+VIDEO|DANCE\s+PRACTICE|PRACTICE\s+VIDEO|안무\s*영상|연습\s*영상|MIRRORED/;
const _YT_STRONG_LIVE_RE=/\bCONCERT\b|\bFANCAM\b|라이브|직캠|팬캠/;
// 음악방송(엠카운트다운/뮤직뱅크/인기가요/음악중심/쇼챔피언/THE SHOW) 이름이 제목에 있으면 "라이브"나
// "직캠" 같은 단어가 따로 없어도 사실상 100% 방송 무대 영상이다 — 기존 정규식은 이 프로그램명들을 전혀
// 몰라서 이런 영상이 대량으로 other에 방치돼있었음(2026-08-06, 실측 확인 — 'other'인데 제목에 이 방송명이
// 있는 영상이 최소 1만7천여 건).
const _YT_LIVE_SHOW_RE=/엠카운트다운|뮤직뱅크|인기가요|음악중심|쇼챔피언|M\s*COUNTDOWN|MUSIC\s*BANK|INKIGAYO|MUSIC\s*CORE|SHOW\s*CHAMPION|\bTHE\s+SHOW\b/;
// 브이라이브/유튜브 라이브/위버스 라이브 등 "실시간 방송"(잡담·인스타 라이브·아프리카TV·트위치 다시보기 등)은
// 제목에 "라이브"가 들어있어서 무대 직캠과 똑같이 라이브 탭으로 잡히는데, 실제로는 전혀 다른 콘텐츠라
// 무대 직캠/공연만 나와야 할 라이브 탭을 오염시킴(2026-08-10, 사용자 제보). 바로 이 단어(생방송) 하나만으론
// "생방송 음악중심 직캠"처럼 진짜 방송 무대 직캠 제목과도 겹쳐서 못 씀 — 그래서 플랫폼 이름이 같이 있는
// 경우만 "실시간 방송"으로 확정해서 잡는다.
const _YT_BROADCAST_RE=/브이라이브|V\s*LIVE|VLIVE|위버스\s*라이브|WEVERSE\s*LIVE|유튜브\s*라이브|YOUTUBE\s*LIVE|인스타\s*라이브|인스타그램\s*라이브|INSTAGRAM\s*LIVE|아프리카\s*TV|AFREECA|트위치|TWITCH|틱톡\s*라이브|TIKTOK\s*LIVE|라이브\s*방송|LIVE\s*CHAT|Q\s*&\s*A\s*LIVE/;
// 음악방송 MC 진행분(“MC 컷 모음”, “NEW MC THE SHOW”, “MC석” 등)은 채널이 음방이라 제목의 방송명
// (_YT_LIVE_SHOW_RE)에 걸려 전부 라이브(무대)로 분류돼 있었다 — 실제론 무대가 아니라 진행 영상이라
// 라이브 탭을 오염시킨다(2026-08-26, 사용자 요청 — "제목에 mc 있으면 all로 보내달라").
// ⚠️ MC는 **단독 토큰**일 때만 인정한다. 부분 문자열로 잡으면 MCOUNTDOWN(엠카운트다운) 13,796건과
//    MCND(엠씨엔디) 271건이 통째로 오분류된다. 앞뒤 경계 검사 + 엠씨엔디 명시 제외로 막았고,
//    실측 결과 MCOUNTDOWN 13,796건 중 걸리는 건 113건("MC 컷 모음 … #MCOUNTDOWN"처럼 진짜 MC분),
//    MCND는 0건이다.
// ⚠️ 단, 제목에 직캠/팬캠류가 같이 있으면 라이브로 남긴다 — "MC 정우 서프라이즈 직캠(굿바이 무대)",
//    "MC석 직캠 4K"처럼 실제 촬영된 무대/직캠 영상이라 other로 보내면 그게 더 큰 손실(180건).
const _YT_MC_HOST_RE=/(^|[^A-Za-z가-힣])(MC|엠씨)([^A-Za-z가-힣]|$)/i;
const _YT_MCND_RE=/MCND|엠씨엔디/i;
const _YT_FANCAM_RE=/직캠|팬캠|풀캠|페이스캠|FANCAM|FACECAM|FULL\s*CAM/i;
function _ytIsMcHosting(title){
  const s=title||'';
  return _YT_MC_HOST_RE.test(s)&&!_YT_MCND_RE.test(s)&&!_YT_FANCAM_RE.test(s);
}
// 제목만 보고 "세로(쇼츠)"를 주장하는지. 2026-08-27에 _ytClassify에서 분리해 나왔다 — short는 장르가
// 아니라 **형식**이라 category(단일값 장르)와 직교해야 한다(is_short_migration.sql). 예전엔 여기서
// 'short'를 반환하는 바람에 "#shorts 붙은 직캠"이 라이브 탭에서 통째로 사라졌다.
// ⚠️ 이 판정은 어디까지나 보조다 — 제목에 shorts를 안 쓴 세로 영상이 훨씬 많고(2026-08-26 실측 ~2.8만
//    건), 동기화 시점 썸네일 비율로는 원리적으로 못 잡는다. 실측 판별은 관리자 승격 스윕이 담당한다.
function _ytIsShortTitle(title){
  const t=(title||'').toUpperCase();
  return /\bSHORTS?\b/.test(t)||/#SHORTS?/.test(t);
}
function _ytClassify(title){
  const t=(title||'').toUpperCase();
  if(/OFFICIAL\s+AUDIO|공식\s*음원/.test(t))return'skip';
  if(/\bTEASER\b|티저/.test(t))return'skip';
  // "M/V"(슬래시 표기)를 놓치고 있었음 — M.V./MV/M V는 잡혔는데 슬래시형만 빠져서, 이렇게 쓴 진짜
  // 뮤직비디오가 mv로 안 걸러지고 live 등 다른 카테고리로 새서 무대/직캠 모음에 섞여 들어감
  // (2026-08-20, 사용자 제보 — 전소미 영상이 남돌 무대 모음에 낀 사고).
  if(/\bM[.\/]?V\.?\b|\bMUSIC\s+VIDEO\b|뮤직?\s*비디오|뮤비/.test(t))return'mv';
  if(_YT_BROADCAST_RE.test(t))return'other';
  // MC 진행분은 라이브 판정보다 앞에서 걸러낸다(위 _ytIsMcHosting 주석 참고). 쇼츠 여부는 이제
  // 이 함수와 무관한 별도 플래그(_ytIsShortTitle → is_short)라, MC 쇼츠도 여기선 그냥 other가 되고
  // 세로 표시/Shorts 탭 노출은 플래그가 따로 챙긴다.
  if(_ytIsMcHosting(title))return'other';
  const looksPrerecorded=_YT_PRERECORDED_RE.test(t);
  if((!looksPrerecorded||_YT_STRONG_LIVE_RE.test(t))&&/\bLIVE\b|\bCONCERT\b|\bPERFORMANCE\b|\bFANCAM\b|라이브|직캠|팬캠/.test(t))return'live';
  if(_YT_LIVE_SHOW_RE.test(t))return'live';
  return'other';
}

async function _ytGetUploadsId(ytUrl,key){
  // youtube.com/channel/UC...는 핸들이 아니라 채널ID 자체 직링크라 forHandle/forUsername으로 못 찾음
  // (이즈나·제로베이스원·알파드라이브원·킥플립처럼 이 형식으로 등록된 그룹이 전부 "채널을 찾을 수
  // 없습니다" 오류가 났었음, 2026-08-05 사용자 제보) — id= 파라미터로 바로 조회.
  const cm=ytUrl.match(/youtube\.com\/channel\/([^/?#]+)/);
  const hm=ytUrl.match(/@([^/?#]+)/);
  const um=ytUrl.match(/youtube\.com\/(?:c\/|user\/)?([^/@?#\s]+)/);
  const slug=hm?hm[1]:(um?um[1]:null);
  if(!cm&&!slug)throw new Error('YouTube URL 파싱 실패: '+ytUrl);
  const tryParam=async param=>{
    const r=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${param}&key=${key}`);
    if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
    const d=await r.json();
    if(d.error)throw new Error(d.error.message);
    return d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads||null;
  };
  let uploadsId=cm?await tryParam(`id=${encodeURIComponent(cm[1])}`):null;
  // @핸들 URL이면 forHandle을 우선 쓰지만, youtube.com/dlwlrma처럼 /c/,/user/,@ 없는 구식 커스텀 URL은
  // forUsername(옛 유튜브 아이디 시스템)에 없는 경우가 많아 못 찾을 수 있음 — forHandle을 먼저 시도하고
  // 안 되면 forUsername으로 재시도(아이유 채널에서 실제로 forUsername 단독으로는 조회 실패했음)
  if(!uploadsId&&slug)uploadsId=await tryParam(`forHandle=${encodeURIComponent(slug)}`)||await tryParam(`forUsername=${encodeURIComponent(slug)}`);
  if(!uploadsId)throw new Error('채널을 찾을 수 없습니다 ('+ytUrl+')');
  return uploadsId;
}

// 과거 영상 백필(search API)은 업로드 재생목록이 아니라 channelId로 검색해야 해서, 업로드 재생목록 id
// 대신 채널 자체의 id가 필요함 — _ytGetUploadsId와 핸들 파싱 로직은 같고 뽑아내는 필드만 다름.
async function _ytGetChannelId(ytUrl,key){
  // /channel/UC...는 URL 안에 채널ID가 그대로 들어있어서 API 조회 없이 바로 씀
  const cm=ytUrl.match(/youtube\.com\/channel\/([^/?#]+)/);
  if(cm)return cm[1];
  const hm=ytUrl.match(/@([^/?#]+)/);
  const um=ytUrl.match(/youtube\.com\/(?:c\/|user\/)?([^/@?#\s]+)/);
  const slug=hm?hm[1]:(um?um[1]:null);
  if(!slug)throw new Error('YouTube URL 파싱 실패: '+ytUrl);
  const tryParam=async param=>{
    const r=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&${param}&key=${key}`);
    if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
    const d=await r.json();
    if(d.error)throw new Error(d.error.message);
    return d.items?.[0]?.id||null;
  };
  const channelId=await tryParam(`forHandle=${encodeURIComponent(slug)}`)||await tryParam(`forUsername=${encodeURIComponent(slug)}`);
  if(!channelId)throw new Error('채널을 찾을 수 없습니다 ('+ytUrl+')');
  return channelId;
}

// startPageToken을 주면 처음(최신)이 아니라 그 지점부터 이어서 과거로 계속 파고든다.
// 반환하는 done/interrupted/resumeToken은 호출부가 "다음엔 어디부터 이어서 받을지" 체크포인트로 쓴다 —
// 예전엔 페이지네이션 도중 API 에러(쿼터 초과 등)가 나면 통째로 throw돼서 이미 모은 영상까지 다 날아갔고,
// 재시도해도 항상 최신부터 다시 시작해 매번 같은 지점에서 막혀 과거 영상(예: 오래된 음악방송 무대)에
// 영영 도달 못 하는 문제가 있었음 — 이제 중간에 실패해도 그때까지 모은 건 살리고 이어받을 지점을 남긴다.
// 그룹 해체일(GROUPS[ko].disbanded) 기준 영상 수집 컷오프 — 해체 후 올라온 영상은 그룹 활동과
// 무관한 콘텐츠일 가능성이 높아 애초에 안 끌어온다(2026-08-14, 사용자 요청). disbanded 필드는
// "YYYY"(연도만, 정확한 날짜 모를 때) 또는 "YYYY.MM.DD"(정확한 해체일) 둘 다 지원 — 연도만 있으면
// 그 해 12/31까지는 수집 허용(해체+1년부터 컷). 아직 예전 방식(boolean true)인 그룹은 연도 데이터가
// 채워지기 전까지 컷오프 없이 그대로 동작(하위호환).
// 2026-08-27: 같은 계산이 index.html의 _groupEndDate(멤버 카드 영상 컷오프용)와 두 벌이 돼서
// 그쪽 하나로 합쳤다 — 여기서 갈리면 "수집은 됐는데 카드엔 안 뜸"(또는 그 반대)이 조용히 생긴다.
// 옛 구현은 'YYYY.MM'(일 없음)을 그 해 12/31로 밀어버렸는데(정규식이 월·일을 한 묶음으로 요구),
// _groupEndDate는 그 달의 마지막 날로 정확히 잡는다. 지금 groups.json엔 YYYY.MM 형태가 없어서
// 실질 차이는 없지만, 생기면 그쪽이 맞다.
function _disbandCutoffDate(ko){return _groupEndDate(ko);}
// 그룹은 그대로 활동 중인데 개별 멤버만 탈퇴한 경우(artists.json의 left 필드, "YYYY.MM.DD")의 자동 태깅
// 컷오프 — 위 _disbandCutoffDate와 같은 이유, 대상만 그룹 전체 대신 멤버 한 명. 탈퇴일 이후 올라온
// 영상까지 그 멤버로 계속 태깅되면(특히 흔한 단어/영단어 이름은 오탐까지 겹쳐 악화됨) 탈퇴한 멤버가
// 여전히 활동 중인 것처럼 보이는 문제가 있음(2026-08-19, 사용자 제보 — 온리원오프 Love, 2021.08.02 탈퇴
// 이후에도 계속 신규 영상에 태깅되던 사례로 발견). left 필드가 없으면(탈퇴일 미상) 컷오프 없이 기존대로.
// 탈퇴일 → 'YYYY-MM-DD'(그 날까지는 출연 인정). 형식은 _groupEndDate와 **같은 관례**를 쓴다:
// 'YYYY.MM.DD'가 기본이고, 연도만/연·월만 알면 그 해(달)의 마지막 날까지 쳐준다 — 그 구간 안의
// 영상을 잘라낼 근거가 없으므로 보수적으로 늦게 자르는 쪽. 예전엔 YYYY.MM.DD만 인정하고 나머지는
// null(=컷오프 없음)이라, 연도밖에 모르는 탈퇴일은 아예 적어둘 수가 없었다(2026-09-02 확장).
// ⚠️ 확장 시점 기준 기존 left 276개는 전부 YYYY.MM.DD라 동작 변화 없음(실측 확인).
function _memberLeftCutoffDate(a){
  const l=a&&a.left;
  if(!l)return null;
  const m=/^(\d{4})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?$/.exec(String(l).trim());
  if(!m)return null;
  const p2=n=>String(n).padStart(2,'0');
  if(!m[2])return `${m[1]}-12-31`;
  if(!m[3])return `${m[1]}-${p2(m[2])}-${new Date(+m[1],+m[2],0).getDate()}`;
  return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
}
async function _ytFetchNewVideos(uploadsId,key,sinceId,onProg,startPageToken,cutoffDate){
  const vids=[];let pageToken=startPageToken||'';let total=0;
  let done=false,interrupted=false;
  // 컷오프에 걸려 skip된 영상이라도 "채널의 실제 최신 영상 ID"는 북마크로 남겨야 다음 동기화 때마다
  // 매번 같은 컷오프 이후 구간을 재스캔하지 않는다(newestId는 필터 전 페이지네이션에서 가장 먼저
  // 만나는 항목 = 채널 최신 영상).
  let newestId=null;
  do{
    let d;
    try{
      const url=`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${key}`+(pageToken?'&pageToken='+pageToken:'');
      const r=await fetch(url);
      if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
      d=await r.json();
      if(d.error)throw new Error(d.error.message);
    }catch(e){
      console.error('[yt fetch] 페이지 조회 실패, 다음 번에 이어서 받음:',e.message);
      interrupted=true;
      break; // pageToken은 방금 실패한(=아직 못 받은) 페이지를 그대로 가리키므로 다음 호출에 그대로 넘기면 이어서 받음
    }
    if(!total)total=d.pageInfo?.totalResults||0;
    let hit=false;
    for(const item of(d.items||[])){
      const vid=item.snippet?.resourceId?.videoId;
      if(!vid)continue;
      if(newestId===null)newestId=vid;
      if(vid===sinceId){hit=true;break;}
      const title=_decodeHtmlEntities(item.snippet.title||'');
      if(_isBannedVideoTitle(title))continue; // 성범죄로 퇴출된 인물 관련 영상은 동기화 단계에서부터 저장하지 않음
      // ⚠️ published_at은 **날짜만**(date 컬럼) — 데뷔/탈퇴 게이트·기간 필터가 전부 "YYYY-MM-DD"
      //    문자열 비교라 이 형태를 바꾸면 매칭 로직이 통째로 흔들린다. 그래서 그대로 두고,
      //    유튜브가 주는 정확한 업로드 시각은 published_ts(timestamptz)에 따로 담는다.
      //    이걸 안 담아서 "17시간 전 올라온 영상이 '어제'로 뜬다"는 제보가 있었음(2026-09-02) —
      //    날짜만 있으면 그 날 00:00(UTC)로 읽혀 한국시간 기준 최대 33시간까지 과장된다.
      //    응답(part=snippet)에 이미 들어있는 값이라 API 쿼터 추가 비용은 0.
      const publishedTs=item.snippet.publishedAt||null;
      const publishedAt=(publishedTs||'').slice(0,10);
      if(cutoffDate&&publishedAt>cutoffDate)continue; // 해체 이후 올라온 영상은 수집 대상에서 제외
      const th=item.snippet.thumbnails||{};
      // 쇼츠는 세로 비율을 유지하는 썸네일(medium/default는 항상 16:9로 잘려있어 세로 판별 불가)이
      // 필요해서 maxres/standard/high 중 하나를 봐야 하는데, 우선순위를 maxres부터 두면 저장되는
      // thumb URL 자체가 무겁고(용량 큼) 탐험 탭처럼 여러 개를 한 번에 보여주는 화면에서 로딩이
      // 느려지는 원인이 됨(2026-08-10, 사용자 제보). high(480x360)부터 우선하도록 뒤집음 — 세로
      // 판별에는 어차피 다 같은 비율이라 영향 없고, 용량만 가벼워짐.
      const hiTh=th.high||th.standard||th.maxres;
      const isShortThumb=!!(hiTh&&hiTh.height>hiTh.width);
      // 세로 여부는 category가 아니라 is_short 플래그로 나간다(2026-08-27 직교화). 동기화 시점
      // 썸네일 비율(isShortThumb)은 원리적으로 거의 항상 false지만, 제목의 #shorts 표기는 잡을 수 있어
      // 둘을 OR로 묶는다 — 진짜 판별은 관리자 '가로→쇼츠 일괄 승격' 스윕이 oardefault 실측으로 한다.
      const cat=_ytClassify(title);
      const isShort=isShortThumb||_ytIsShortTitle(title);
      if(cat==='skip')continue;
      vids.push({
        id:vid,
        title,
        description:_decodeHtmlEntities(item.snippet.description||''), // part=snippet 응답에 이미 포함돼있던 걸 그냥 버렸었음 — 쿼터 추가 비용 없이 태깅 보조 텍스트로 재사용
        thumb:isShortThumb?(hiTh.url||th.medium?.url||''):(th.medium?.url||th.high?.url||th.default?.url||''),
        published_at:publishedAt,
        published_ts:publishedTs,
        category:cat,is_short:isShort
      });
    }
    if(hit){done=true;pageToken='';break;}
    pageToken=d.nextPageToken||'';
    if(!pageToken)done=true; // 채널의 가장 과거(맨 처음) 영상까지 완주함
    if(onProg)onProg(vids.length,total);
    if(pageToken)await new Promise(res=>setTimeout(res,80));
  }while(pageToken);
  return{vids,total,done,interrupted,resumeToken:pageToken,newestId};
}

async function _ytSyncGroup(ko,key,onProg,youtubeUrl,syncKey){
  if(!sb)throw new Error('Supabase 연결 없음');
  // youtubeUrl이 명시적으로 오면 그걸 쓰고(아이유처럼 GROUPS에 없는 솔로 채널 동기화용), 아니면 기존처럼 그룹 링크 사용
  const url=youtubeUrl||GROUPS[ko]?.links?.youtube;
  if(!url)throw new Error('YouTube 링크 없음');
  const uploadsId=await _ytGetUploadsId(url,key);
  // 이어받기 체크포인트를 외부 채널 동기화(_ytSyncExtChannels)와 같은 방식(localStorage에 마지막으로
  // 확인한 영상 ID를 직접 저장)으로 바꿈 — 예전엔 매번 DB에서 published_at(날짜만, 시분초 없음) 기준
  // 최신 1개를 다시 추정했는데, 하루에 여러 개 올리는 업로드량 많은 채널(방탄소년단·스트레이키즈 등)은
  // 같은 날짜 동률 때문에 엉뚱한 영상이 기준점으로 잡히거나, 그 영상이 나중에 삭제되면 그 기준점을
  // 채널에서 영원히 못 찾아 매번 채널 전체를 처음부터 훑게 되는 문제가 있었음(2026-08-05, 업로드 많은
  // 그룹들이 매번 오래 걸린다는 제보로 발견). localStorage에 북마크가 아직 없는(이 방식 도입 전) 그룹만
  // DB 조회로 시작점을 잡아 첫 실행에 전체 재수집이 도는 것을 막고, 이후로는 localStorage만 쓴다.
  // syncKey는 체크포인트 전용 키 — ko(=group_ko, 저장되는 값)와 분리해야 하는 이유: 효연처럼 한 사람이
  // 채널을 2개(공식+개인) 가지면 둘 다 group_ko='효연'로 저장돼 같은 사람 콘텐츠로 묶여야 하지만,
  // 체크포인트까지 ko 하나로 공유하면 채널 A 동기화가 남긴 마지막 영상 ID를 채널 B가 못 찾아(다른
  // 채널이니 당연히 없음) 매번 채널 전체를 처음부터 재수집하고, 그 결과로 서로의 체크포인트를 계속
  // 덮어써서 영원히 "완료" 상태에 도달 못 하는 문제가 생김(2026-08-10, 채널 2개 멤버 추가하며 발견).
  const skey=syncKey||ko;
  const lsKey=`kpu_yt_last_${skey}`;
  const resumeKey=`kpu_yt_resume_${skey}`;
  let sinceId=localStorage.getItem(lsKey);
  if(!sinceId){
    const{data:top}=await sb.from(_YT_TABLE).select('id').eq('group_ko',ko).order('published_at',{ascending:false}).limit(1);
    sinceId=top?.[0]?.id||null;
  }
  const resumeTok=localStorage.getItem(resumeKey)||'';
  // GROUPS[ko]가 있는 "그룹 공식 채널" 동기화에만 해체 컷오프가 걸린다 — 솔로/멤버 개인 채널(ko가
  // 사람 이름이라 GROUPS[ko]가 undefined)은 자연히 컷오프 없이 그대로 동기화된다(그룹은 해체해도
  // 멤버 개인 활동은 계속 끌어와야 한다는 요구사항, 2026-08-14).
  const cutoffDate=_disbandCutoffDate(ko);
  const{vids,done,interrupted,resumeToken,newestId}=await _ytFetchNewVideos(uploadsId,key,sinceId,onProg,resumeTok,cutoffDate);
  if(vids.length){
    // 공식 채널 업로드분은 제외 키워드에 걸려도 무관 처리하지 않는다 — 판단은 _shouldJunkFlag
    // 한 곳에 있고(index.html), 여기선 source_tier를 그대로 넘겨 정책을 따른다(2026-08-27).
    const rows=vids.map(v=>({...v,group_ko:ko,title_norm:_titleNorm(v.title),source_handle:skey,source_tier:'official',...(_shouldJunkFlag(v.title,'official')?_flagPatch('무관','auto'):{})}));
    for(let i=0;i<rows.length;i+=200){
      const{error}=await _ytUpsertVideos(rows.slice(i,i+200));
      if(error)throw new Error(error.message);
    }
  }
  // resumeTok 없이(=맨 최신부터) 시작한 실행이었을 때만 북마크를 갱신한다 — 과거를 이어받는 중엔
  // 건드리지 않음(_ytSyncExtChannels와 동일 원칙). newestId를 쓰는 이유는 위 _ytFetchNewVideos 주석 참고
  // (컷오프에 걸려 vids엔 하나도 안 들어가도 채널 자체의 최신 영상 ID로 북마크해야 매번 재스캔 안 함).
  if(!resumeTok&&newestId)localStorage.setItem(lsKey,newestId);
  if(done)localStorage.removeItem(resumeKey);
  else if(interrupted&&resumeToken)localStorage.setItem(resumeKey,resumeToken);
  return vids.length;
}

let _ytSyncing=false;
async function _ytSyncAll(){
  if(_ytSyncing)return;
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _ytSyncing=true;
  const groups=Object.entries(GROUPS).filter(([,v])=>v?.links?.youtube).map(([ko,v])=>({ko,url:v.links.youtube,syncKey:ko}));
  // 아이유처럼 소속 그룹이 없는(GROUPS에 없는) 솔로 아티스트도, 본인 링크에 유튜브가 있으면 본인 이름을 키로 같이 동기화
  const seenSolo=new Set();
  const solos=[];
  ARTISTS.forEach(a=>{
    if(GROUPS[a.group.ko]||!a.links?.youtube||seenSolo.has(a.name.ko))return;
    seenSolo.add(a.name.ko);
    solos.push({ko:a.name.ko,url:a.links.youtube,syncKey:a.name.ko});
  });
  // ⚠️ 개인 채널(효연·슬기·설아)은 2026-08-25에 ext_channels(tier='idol')로 이관돼 여기서 빠졌다.
  // 이 경로는 group_ko를 "본인 이름"으로 저장했는데, 멤버 카드는 group_ko=소속그룹+members에 본인이
  // 있는 영상만 조회하므로 그렇게 저장된 1,072건이 사이트 어디에서도 안 보이는 상태였음(실측).
  // ext 경로(_extBuildRows)는 group_ko=소속그룹 + members=[본인]으로 저장해서 그룹 카드·멤버 카드
  // 양쪽에 정상 노출된다. 개인 채널 동기화는 이제 "외부채널 동기화" 버튼이 담당.
  const targets=[...groups,...solos];
  let done=0;
  for(const{ko,url,syncKey}of targets){
    _ytSetProg(`[${done+1}/${targets.length}] ${ko} 동기화 중...`);
    try{
      const n=await _ytSyncGroup(ko,key,(fetched,total)=>{
        _ytSetProg(`[${done+1}/${targets.length}] ${ko}: ${fetched}${total?'/'+total:''}개`);
      },url,syncKey);
      console.log(`[YT sync] ${ko}: +${n}개`);
    }catch(e){
      console.error(`[YT sync] ${ko} 실패:`,e.message);
      _ytSetProg(`[${done+1}/${targets.length}] ${ko} 오류: ${e.message}`);
      await new Promise(res=>setTimeout(res,600));
    }
    done++;
  }
  _ytSetProg(`공식 채널 완료 — ${targets.length}개`);
  _ytSyncing=false;
}

// 탐험 탭 "이번주 직캠 TOP 10"(_buildFeedWeeklyTopCams)에 쓸 조회수 갱신 — 서버 크론이 없는 정적
// 페이지라 진짜 자동 갱신은 불가능해서, 이미 정기적으로 누르는 "전체 동기화" 버튼에 얹어 그때 같이
// 갱신되게 한다(2026-08-05, 사용자 선택). 랭킹 윈도우(7일)보다 넉넉하게 최근 14일치만 갱신 대상으로
// 삼아서 — 오래된 영상은 어차피 랭킹에 안 쓰이므로 쿼터 낭비를 줄인다. videos.list는 part 개수/id
// 개수(최대 50개)와 무관하게 호출당 쿼터 1이라 저렴함.
const VIEW_COUNT_WINDOW_DAYS=14;
async function _ytRefreshViewCounts(){
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _ytSetProg('조회수 갱신 대상 조회 중…');
  const sinceDate=new Date(Date.now()-VIEW_COUNT_WINDOW_DAYS*86400000).toISOString().slice(0,10);
  const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
    .select('id')
    .gte('published_at',sinceDate)
    .order('id'));
  if(error){_ytSetProg('조회수 갱신 실패: '+error.message);return;}
  if(!rows?.length){_ytSetProg('조회수 갱신: 최근 영상 없음');return;}
  const ids=rows.map(r=>r.id);
  const statsUpdates=[];
  const tsUpdates=[]; // 정확한 업로드 시각(published_ts) 백필 — 아래 주석 참고
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    _ytSetProg(`조회수 조회 중… ${Math.min(i+50,ids.length)}/${ids.length}`);
    try{
      // part에 snippet을 얹어 정확한 업로드 시각(publishedAt)도 같이 받는다. videos.list는 part
      // 개수와 무관하게 **호출당 쿼터 1**이라 추가 비용이 0이고, 이 함수는 이미 "전체 동기화"에
      // 얹혀 최근 14일치를 정기적으로 훑으므로 백필 전용 버튼을 따로 만들 필요가 없다.
      // (옛 행은 published_at이 날짜뿐이라 "N시간 전"을 못 만든다 — 2026-09-02 코르티스 제보)
      const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${chunk.join(',')}&key=${key}`);
      if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
      const d=await r.json();
      if(d.error)throw new Error(d.error.message);
      (d.items||[]).forEach(it=>{
        const vc=parseInt(it.statistics?.viewCount,10);
        if(!isNaN(vc))statsUpdates.push({id:it.id,view_count:vc});
        const ts=it.snippet?.publishedAt;
        if(ts)tsUpdates.push({id:it.id,published_ts:ts});
      });
    }catch(e){console.error('[조회수 갱신] 실패:',e.message);}
  }
  // 업로드 시각 저장 — 컬럼이 아직 없으면(마이그레이션 전) 조용히 건너뛴다. 조회수 갱신이 이것 때문에
  // 실패하면 안 되므로 별도 패스로 두고, 첫 실패에서 컬럼 부재를 감지해 이후 시도를 멈춘다.
  if(_ytHasPubTs&&tsUpdates.length){
    const probe=await sb.from(_YT_TABLE).update({published_ts:tsUpdates[0].published_ts}).eq('id',tsUpdates[0].id);
    if(probe.error&&/published_ts/.test(probe.error.message||'')){
      _ytHasPubTs=false;
      console.warn('[업로드 시각] published_ts 컬럼이 없어 건너뜀 — ALTER TABLE 필요');
    }else{
      const _tb=await _sbUpdateBatch(tsUpdates.slice(1),({id,published_ts})=>sb.from(_YT_TABLE).update({published_ts}).eq('id',id),
        {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`업로드 시각 저장 중… ${done}/${total}`)});
      if(_tb.failed)console.error('[업로드 시각] 재시도 후에도 실패:',_tb.failed,'건 —',_tb.firstErr);
    }
  }
  if(!statsUpdates.length){_ytSetProg('조회수 갱신: 반영할 값 없음');return;}
  let saved=0,failed=0;
  {
    const _ub=await _sbUpdateBatch(statsUpdates,({id,view_count})=>sb.from(_YT_TABLE).update({view_count}).eq('id',id),
      {conc:20,retries:2,onProgress:(done,total,sv)=>_ytSetProg(`조회수 저장 중… ${done}/${total} (저장 ${sv}개)`)});
    saved+=_ub.saved;failed+=_ub.failed;
    if(_ub.failed)console.error('[조회수 갱신] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
  }
  _ytSetProg(`조회수 갱신 완료 — ${saved}개${failed?` · ${failed}개 일시 실패(다음에 재시도)`:''}`);
  _feedDiscoveryBuiltAt=0; // 다음 탐험 탭 오픈 시 주간 TOP 순위 새로 반영
}

// 연도별 TOP 100용 전체 라이브 조회수 갱신.
// API 절약 전략: ① live 카테고리만 (연도별 TOP에 live만 쓰이므로 다른 카테고리 ID는 아예 조회 안 함)
//               ② view_count IS NOT NULL인 것만 (한 번이라도 집계된 적 있는 영상 → 실질적 상위 후보)
//               덕분에 "전체 영상 중 일부"만 YouTube API를 소비하므로 월 1회 돌려도 쿼터 여유 있음.
async function _ytRefreshAllViewCounts(){
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _ytSetProg('갱신 대상 조회 중 (live · 조회수 기집계)…');
  const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
    .select('id')
    .eq('category','live')
    .not('view_count','is',null)
    .order('id'));
  if(error){_ytSetProg('대상 조회 실패: '+error.message);return;}
  if(!rows?.length){_ytSetProg('갱신 대상 없음');return;}
  const ids=rows.map(r=>r.id);
  const totalCalls=Math.ceil(ids.length/50);
  _ytSetProg(`YouTube API 호출 예정: ${totalCalls}회 (${ids.length}개 영상)`);
  const statsUpdates=[];
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    _ytSetProg(`조회수 조회 중… ${Math.min(i+50,ids.length)}/${ids.length} (API ${Math.ceil((i+50)/50)}/${totalCalls}회)`);
    try{
      const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${key}`);
      if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
      const d=await r.json();
      if(d.error)throw new Error(d.error.message);
      (d.items||[]).forEach(it=>{
        const vc=parseInt(it.statistics?.viewCount,10);
        if(!isNaN(vc))statsUpdates.push({id:it.id,view_count:vc});
      });
    }catch(e){_ytSetProg('YouTube API 오류: '+e.message);console.error('[전체 조회수 갱신]',e.message);return;}
  }
  if(!statsUpdates.length){_ytSetProg('갱신할 값 없음 (영상이 모두 삭제되었거나 비공개)');return;}
  let saved=0,failed=0;
  {
    const _ub=await _sbUpdateBatch(statsUpdates,({id,view_count})=>sb.from(_YT_TABLE).update({view_count}).eq('id',id),
      {conc:20,retries:2,onProgress:(done,total,sv)=>_ytSetProg(`저장 중… ${done}/${total} (저장 ${sv}개)`)});
    saved+=_ub.saved;failed+=_ub.failed;
    if(_ub.failed)console.error('[전체 조회수 갱신] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
  }
  _ytSetProg(`전체 조회수 갱신 완료 — ${saved}개${failed?` · ${failed}개 일시 실패(다음에 재시도)`:''} (live 카테고리 · API ${totalCalls}회 사용)`);
  _feedDiscoveryBuiltAt=0;
}

// 카테고리 무관 "진짜 전체" 조회수 순환 갱신(2026-08-19, 사용자 제안) — 위 _ytRefreshAllViewCounts는
// live만 다루고, mv/쇼츠/예능 등 나머지 카테고리(전체 35만여 건 중 live 제외 25만여 건)는 한 번 동기화된
// 뒤로 조회수가 계속 그대로 방치됨. 그렇다고 매번 전체를 다 돌면 API 약 7,150회(전체 35만여 건÷50)로
// 하루 쿼터(1만)를 거의 다 써버려서(2026-08-19 실측) 정기 동기화(search.list, 콜당 100쿼터)와 부딪힘.
// 대신 "가장 오래전에 갱신된 것부터" 고정 배치(기본 5,000개=API 약 100회, 부담 거의 없음)만 매번
// 갱신하는 라운드로빈 방식 — view_count_synced_at 컬럼 기준으로 이번에 갱신한 건 자동으로 맨 뒤로
// 밀리므로, 이 버튼을 정기적으로(월 1회 정도) 누르기만 하면 몇 달에 걸쳐 전체가 공평하게 한 바퀴씩
// 순환 갱신됨 — "어떤 영상이 안 변할지"를 미리 판별하려는 복잡한 로직 없이도 결과적으로 비슷한 효과.
// (view_count_synced_at 컬럼은 admin_migrations.sql — 사용자가 직접 실행 필요, RLS로 Claude가 못 씀)
// 배치 크기 — 유튜브 API videos.list는 콜당 50개·1쿼터라 20,000개=400콜=400쿼터(하루 1만 중 4%)로
// 여유 많다. 정기 동기화(search.list 콜당 100쿼터)와 겹치는 날만 피하면 됨. 자주 눌러도 무방(오래된
// 것부터 순환이라 누를수록 전체가 빨리 한 바퀴). 40만 건이면 ~20번이면 전체 한 바퀴(2026-09-01 상향).
const VIEW_COUNT_ROTATE_BATCH=20000;
async function _ytRotateViewCountRefresh(){
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _ytSetProg('순환 갱신 대상 조회 중 (가장 오래전에 갱신된 것부터, 전체 카테고리)…');
  // ⚠️ PostgREST는 한 요청당 최대 1000행만 준다(db-max-rows) — .limit(5000)을 걸어도 1000개만 왔던 원인
  //    (2026-09-01 사용자 제보 "5000인데 1000만 됨"). 1000개씩 range로 나눠 받아 실제 BATCH만큼 모은다.
  //    view_count_synced_at은 미갱신분이 전부 null(동률)이라 id를 2차 정렬로 붙여야 페이지 경계가 안 어긋난다.
  const ids=[];
  for(let off=0; off<VIEW_COUNT_ROTATE_BATCH; off+=1000){
    const to=Math.min(off+1000,VIEW_COUNT_ROTATE_BATCH)-1;
    const{data,error}=await sb.from(_YT_TABLE).select('id')
      .order('view_count_synced_at',{ascending:true,nullsFirst:true})
      .order('id',{ascending:true})
      .range(off,to);
    if(error){_ytSetProg('대상 조회 실패: '+error.message);return;}
    if(!data?.length)break;
    ids.push(...data.map(r=>r.id));
    if(data.length<to-off+1)break; // 마지막 페이지(테이블 끝)
  }
  if(!ids.length){_ytSetProg('순환 갱신 대상 없음');return;}
  const totalCalls=Math.ceil(ids.length/50);
  _ytSetProg(`YouTube API 호출 예정: ${totalCalls}회 (${ids.length}개 영상)`);
  let savedTotal=0,failedTotal=0;
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    _ytSetProg(`순환 갱신 중… ${Math.min(i+50,ids.length)}/${ids.length} (API ${Math.floor(i/50)+1}/${totalCalls}회, 저장 ${savedTotal}개)`);
    const nowIso=new Date().toISOString();
    const statsUpdates=[];
    try{
      const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${key}`);
      if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
      const d=await r.json();
      if(d.error)throw new Error(d.error.message);
      const returned=new Set();
      (d.items||[]).forEach(it=>{
        returned.add(it.id);
        const vc=parseInt(it.statistics?.viewCount,10);
        if(!isNaN(vc))statsUpdates.push({id:it.id,view_count:vc,touchOnly:false});
      });
      // 삭제/비공개라 API 응답에 아예 안 잡힌 것도 "이번에 확인은 했다"는 뜻으로 synced_at만 갱신하고
      // 기존 view_count는 그대로 둠(null로 덮어써서 데이터를 잃으면 안 됨) — 안 그러면 죽은 영상이 계속
      // "가장 오래됨" 취급돼 매번 맨 앞에 다시 뽑히기만 하고 끝나지 않음.
      chunk.filter(id=>!returned.has(id)).forEach(id=>statsUpdates.push({id,touchOnly:true}));
    }catch(e){
      _ytSetProg(`YouTube API 오류(${savedTotal}개까지 저장된 채로 중단, 다시 누르면 이어서 진행됨): `+e.message);
      console.error('[조회수 순환 갱신]',e.message);
      return;
    }
    const _ub=await _sbUpdateBatch(statsUpdates,({id,view_count,touchOnly})=>
      sb.from(_YT_TABLE).update(touchOnly?{view_count_synced_at:nowIso}:{view_count,view_count_synced_at:nowIso}).eq('id',id),
      {conc:20,retries:2});
    savedTotal+=_ub.saved;failedTotal+=_ub.failed;
    // 실패분은 synced_at이 안 찍혀 다음 순환 때 다시 대상이 되므로 건너뛰고 계속 진행한다.
    if(_ub.failed)console.error('[조회수 순환 갱신] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
  }
  _ytSetProg(`조회수 순환 갱신 완료 — ${savedTotal}개 저장${failedTotal?` · ${failedTotal}개는 일시 실패라 다음 실행 때 재시도됨`:''} (전체 카테고리 · API ${totalCalls}회)`);
  _feedDiscoveryBuiltAt=0;
}

// 진행 표시는 좁은 칸(.sp-yt-prog)이라 긴 메시지가 잘려 보인다 — 결과/오류 메시지는 **콘솔에도 그대로**
// 남긴다(2026-09-03 제보: "이거 전체 내용 조회 가능하게 일단 되어야할듯"). 진행 틱(분석/적용/조회 중…)은
// 수천 번 불려 콘솔을 덮어버리므로 제외하고, 사람이 읽어야 하는 메시지만 남긴다.
const _YT_PROG_TICK=/(분석|적용|조회|수집|스캔|처리)\s*중…/;
function _ytSetProg(msg){
  const el=document.getElementById('sp-yt-prog');if(el)el.textContent=msg;
  if(msg&&!_YT_PROG_TICK.test(msg))console.log('[진행]',msg);
  _admExecBarSync(msg);
}

// 대량 update를 동시요청 제한 + 재시도로 안전하게 보낸다(2026-09-01). 수백 개를 Promise.all로 한꺼번에
// 발사하면 그중 몇 개가 "TypeError: Failed to fetch"(일시적 네트워크 끊김)로 튕기는데, 예전엔 그 1건에
// 전체가 멈췄다. 몇 개씩(conc) 나눠 보내고 실패분은 잠깐 뒤 재시도, 재시도 후에도 실패한 것만 세서 돌려준다.
async function _sbUpdateBatch(items, updateFn, {conc=20, retries=2, onProgress}={}){
  let saved=0, failed=0, firstErr='';
  for(let i=0;i<items.length;i+=conc){
    const slice=items.slice(i,i+conc);
    const rs=await Promise.all(slice.map(async it=>{
      for(let a=0;a<=retries;a++){
        try{
          const{error}=await updateFn(it);
          if(!error)return null;
          if(a===retries)return error.message||String(error);
        }catch(e){
          if(a===retries)return e.message||String(e);
        }
        await new Promise(r=>setTimeout(r, 400*(a+1))); // 백오프 후 재시도
      }
    }));
    rs.forEach(err=>{ if(err){failed++; if(!firstErr)firstErr=err;} else saved++; });
    if(onProgress)onProgress(Math.min(i+conc,items.length), items.length, saved, failed);
  }
  return {saved, failed, firstErr};
}

// ── 실행 버튼 전역 락 + 상단 진행 바 + 최근/마지막 실행 (설정패널 개선 1·2·8, 2026-09-01) ──
// 전체 동기화(수십 분) 도는 중에 재태깅·청소를 눌러 같은 행에 쓰기가 겹치던 사고를 막는다. 실행 계열
// 버튼은 전부 _admExecBind로 감싸 하나의 _admBusy 락을 공유하고, 끝나면 finally로 반드시 푼다.
let _admBusy=null,_admBusyId=null,_admBusyLabel='',_admAbort=false;
const _ADM_EXEC_LABELS={};
function _admIsBusy(){return !!_admBusy||_admRoutineRunning===true;}
function _admExecBind(id,handler,label,opts){
  opts=opts||{};
  const btn=document.getElementById(id);
  if(!btn)return;
  if(label)_ADM_EXEC_LABELS[id]=label;
  btn.addEventListener('click',async function(e){
    if(_admIsBusy()){
      // 실행 중인 바로 그 버튼을 다시 누른 것 = 중단 신호(쇼츠 승격 등) → 핸들러로 넘겨 자체 중단 처리
      if(opts.selfRestop&&id===_admBusyId){try{await handler.call(this,e);}catch(err){console.error(err);}return;}
      _admExecNudge();return;
    }
    _admExecLockOn(id,label||_ADM_EXEC_LABELS[id]||'작업',opts.abortable);
    let ok=true;
    try{await handler.call(this,e);}
    catch(err){ok=false;console.error('[admExec] '+id,err);}
    finally{_admExecLockOff(id,ok);}
  });
}
function _admExecLockOn(id,label,abortable){
  _admBusy=id;_admBusyId=id;_admBusyLabel=label;_admAbort=false;
  const bar=document.getElementById('adm-exec-bar');
  if(!bar)return;
  bar.className='on';
  bar.innerHTML='<span class="aeb-txt"></span>'+(abortable?'<button type="button" class="aeb-stop">✕ 중단</button>':'');
  bar.querySelector('.aeb-txt').textContent='⏳ 실행 중: '+label;
  const stopBtn=bar.querySelector('.aeb-stop');
  if(stopBtn)stopBtn.onclick=()=>{_admAbort=true;const t=bar.querySelector('.aeb-txt');if(t)t.textContent='⏳ 중단 요청됨 — 곧 멈춰요…';};
}
function _admExecLockOff(id,ok){
  const label=_admBusyLabel;
  const result=(document.getElementById('sp-yt-prog')?.textContent||'').trim();
  _admBusy=null;_admBusyId=null;_admBusyLabel='';
  const bar=document.getElementById('adm-exec-bar');
  if(bar)bar.className='';
  try{
    localStorage.setItem('kpu_admLast:'+id,String(Date.now()));
    const logv=JSON.parse(localStorage.getItem('kpu_admExecLog')||'[]');
    logv.unshift({t:Date.now(),label,ok,result:result.slice(0,120)});
    localStorage.setItem('kpu_admExecLog',JSON.stringify(logv.slice(0,5)));
  }catch(_){}
  _admRenderLastRun();_admRenderExecLog();
}
function _admExecNudge(){
  const bar=document.getElementById('adm-exec-bar');
  if(bar){bar.classList.add('nudge');setTimeout(()=>bar.classList.remove('nudge'),450);}
}
function _admExecBarSync(msg){
  if(!_admBusy)return;
  const t=document.querySelector('#adm-exec-bar .aeb-txt');
  if(t)t.textContent='⏳ 실행 중: '+_admBusyLabel+(msg?' · '+msg:'');
}
function _admFmtAgo(ts){
  const d=Date.now()-ts,H=3600000,day=86400000;
  if(!ts||d<0)return'';if(d<H)return'방금';if(d<day)return Math.floor(d/H)+'시간 전';
  const days=Math.floor(d/day);return days===1?'어제':days+'일 전';
}
function _admRenderLastRun(){
  for(const id in _ADM_EXEC_LABELS){
    const btn=document.getElementById(id);if(!btn)continue;
    const ts=+localStorage.getItem('kpu_admLast:'+id);
    let badge=btn.querySelector('.sp-last-badge');
    if(!ts){if(badge)badge.remove();continue;}
    if(!badge){badge=document.createElement('span');badge.className='sp-last-badge';btn.appendChild(badge);}
    badge.textContent=' · '+_admFmtAgo(ts);
  }
}
// 버튼별 ⓘ 클릭 펼침(설정패널 개선 7) — 각 버튼 뒤 .sp-btn-hint를 그 버튼의 ⓘ로 열고 닫는다.
// 상단의 "설명 모두 펼치기" 토글(show-hints)과 독립적으로 동작한다.
function _admWireHints(){
  const sec=document.getElementById('sp-yt-sec');if(!sec)return;
  sec.querySelectorAll('.sp-btn-hint').forEach(hint=>{
    const btn=hint.previousElementSibling;
    if(!btn||btn.tagName!=='BUTTON'||btn.querySelector('.sp-hint-i'))return;
    const i=document.createElement('span');
    i.className='sp-hint-i';i.textContent='ⓘ';i.title='설명 보기';
    i.addEventListener('click',e=>{e.stopPropagation();hint.classList.toggle('open');});
    btn.appendChild(i);
  });
}
function _admRenderExecLog(){
  const box=document.getElementById('adm-exec-log');if(!box)return;
  let logv=[];try{logv=JSON.parse(localStorage.getItem('kpu_admExecLog')||'[]');}catch(_){}
  if(!logv.length){box.innerHTML='';return;}
  box.innerHTML='<div class="ael-h">최근 실행</div>'+logv.map(e=>
    `<div class="ael-row"><span class="ael-t">${_admFmtAgo(e.t)}</span><span class="ael-l">${(e.label||'').replace(/</g,'&lt;')}</span><span class="ael-r ${e.ok?'':'bad'}" title="${(e.result||'').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">${(e.result||'').replace(/</g,'&lt;')}</span></div>`
  ).join('');
}

// 유지보수 버튼들이 조회하는 행 수가 PostgREST 기본 응답 상한(보통 1000행)을 넘으면 나머지가 조용히
// 누락되므로, range()로 계속 이어받아 매칭되는 행을 전부 모아온다. buildQuery는 매 페이지 range()를
// 새로 붙일 수 있도록 아직 실행 안 된 쿼리를 새로 만들어 반환하는 함수여야 하고, 페이지 간 순서가
// 흔들리면 일부 행이 중복되거나 빠질 수 있어 반드시 order()를 포함해야 한다.
// OFFSET(.range()) 페이지네이션은 뒤 페이지로 갈수록 앞의 모든 행을 훑고 버려야 해서, 큰 테이블
// (yt_channel_videos)에서 갈수록 느려지다 결국 statement_timeout에 걸림(2026-08-03, "원곡" 스캔·콜라보
// 재검증 둘 다 실측으로 확인) — "마지막으로 받은 id 다음부터"만 이어받는 키셋 페이지네이션으로 교체해서
// 페이지 위치와 무관하게 매 요청이 항상 가볍게(PK 인덱스 seek) 유지되게 함. 호출부는 전부 buildQuery()
// 안에서 .order('id')를 이미 붙이고 있어야 함(대부분 그렇게 돼있었음) — 여기서 .gt('id',cursor)/.limit()만
// 추가로 체이닝한다.
// onPage(page,rows): 페이지가 도착할 때마다 부른다 — 호출부가 "받는 대로" 화면에 그릴 수 있게 하는 훅
// (2026-09-02, 영상관리 패널 "조금씩 로딩되는 대로 보여줘" 요청). false를 반환하면 조기 중단한다
// (탭을 옮겨 이 조회가 무의미해진 경우 등). 안 넘기면 예전과 100% 같은 동작 — 기존 호출부 무수정.
async function _sbFetchAll(buildQuery,pageSize=1000,onPage){
  const rows=[];let cursor=null;
  while(true){
    let q=buildQuery().limit(pageSize);
    if(cursor!==null)q=q.gt('id',cursor);
    const{data,error}=await q;
    if(error)return{data:null,error};
    if(!data?.length)break;
    rows.push(...data);
    if(onPage){
      let cont=true;
      try{cont=onPage(data,rows);}catch(e){console.error('[sbFetchAll] onPage 예외',e);}
      if(cont===false)return{data:rows,error:null,aborted:true};
    }
    if(data.length<pageSize)break;
    cursor=data[data.length-1].id;
  }
  return{data:rows,error:null};
}

// 밴 인물(성범죄 등) 언급 영상은 동기화 시점부터 걸러지지만(sync-time skip), 그 밴 목록이 생기기 전에
// 이미 들어가 있던 기존 행은 그대로 남아있을 수 있음 — 카드 열 때마다 매번 title ILIKE로 재검사하면
// (와일드카드 LIKE라 인덱스를 못 타서) 느려지므로, 이 버튼으로 한 번 훑어서 hidden 처리해두고
// 평소 조회는 content_flag만 보게 한다(load()의 인덱스 타는 등호 비교 한 줄로 충분해짐).
// 이후로 밴 대상이 새로 늘어나지 않는 한(=_BANNED_VIDEO_NAMES_* 코드가 안 바뀐 한) 이미 훑은 기존 행에서
// 새로 걸릴 게 없으므로(신규 동기화분은 sync-time skip으로 애초에 안 들어옴), 밴 목록 버전이 그대로면
// 전체 테이블 재스캔을 건너뛴다 — 테이블이 커질수록 매번 전량 스캔하는 비용을 아끼기 위함.
function _ytBannedListVersion(){return _BANNED_VIDEO_NAMES_GLOBAL.join(',')+'|'+JSON.stringify(_BANNED_VIDEO_NAMES_SCOPED);}
async function _ytSweepBannedVideos(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-yt-sweep-banned');
  if(btn)btn.disabled=true;
  try{
    const version=_ytBannedListVersion();
    if(localStorage.getItem('kpu_banned_sweep_version')===version){
      _ytSetProg('밴 목록 변경 없음 — 스킵함(코드의 밴 목록을 수정했을 때만 다시 돌리면 됩니다)');
      return;
    }
    _ytSetProg('밴 인물 언급 영상 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko')
      .eq('tags_manual',false) // 관리자가 직접 저장한 행은 절대 안 건드림(2026-08-04, 사용자 요청으로 추가)
      .or('content_flag.is.null,content_flag.neq.hidden')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');localStorage.setItem('kpu_banned_sweep_version',version);return;}
    const toHide=rows.filter(v=>_isBannedVideoTitle(v.title,v.group_ko)).map(v=>v.id);
    if(!toHide.length){_ytSetProg(`검사 완료 — ${rows.length}개 중 해당 없음`);localStorage.setItem('kpu_banned_sweep_version',version);return;}
    await _snapshotBeforeBulk('밴 인물 언급 영상 숨김 정리',toHide);
    for(let i=0;i<toHide.length;i+=200){
      const{error:ue}=await sb.from(_YT_TABLE).update(_flagPatch('hidden','auto',{needs_review:false})).in('id',toHide.slice(i,i+200));
      if(ue)throw new Error(ue.message);
    }
    localStorage.setItem('kpu_banned_sweep_version',version);
    _ytSetProg(`완료! ${rows.length}개 중 ${toHide.length}개 숨김 처리함(숨김 목록에서 검토 가능)`);
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}
// _JUNK_TITLE_KEYWORDS_GLOBAL(띵곡팔이 등)은 신규 동기화 시점엔 자동으로 무관 처리되지만, 목록에 키워드가
// 추가되기 전에 이미 들어온 기존 행은 안 걸러져 있음 — _ytSweepBannedVideos와 같은 패턴(버전 문자열로
// 목록 변경 없으면 스킵, tags_manual 행은 절대 안 건드림)으로 기존 오염분을 정리한다(2026-08-06, 사용자
// 요청 — 김창옥쇼/이호선상담소 추가).
function _ytJunkKeywordsVersion(){return _JUNK_TITLE_KEYWORDS_GLOBAL.join(',');}
async function _ytSweepJunkKeywordVideos(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-yt-sweep-junk');
  if(btn)btn.disabled=true;
  try{
    const version=_ytJunkKeywordsVersion();
    if(localStorage.getItem('kpu_junk_sweep_version')===version){
      _ytSetProg('제외 키워드 목록 변경 없음 — 스킵함(코드의 키워드 목록을 수정했을 때만 다시 돌리면 됩니다)');
      return;
    }
    _ytSetProg('제외 키워드 포함 영상 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,source_tier')
      .eq('tags_manual',false) // 관리자가 직접 저장한 행은 절대 안 건드림
      .or('content_flag.is.null,content_flag.neq.무관')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');localStorage.setItem('kpu_junk_sweep_version',version);return;}
    // 공식 채널 업로드분은 제외 — 동기화 시점과 같은 규칙(_shouldJunkFlag)을 그대로 쓴다.
    const toFlag=rows.filter(v=>_shouldJunkFlag(v.title,v.source_tier)).map(v=>v.id);
    if(!toFlag.length){_ytSetProg(`검사 완료 — ${rows.length}개 중 해당 없음`);localStorage.setItem('kpu_junk_sweep_version',version);return;}
    await _snapshotBeforeBulk('제외 키워드 영상 무관 정리',toFlag);
    for(let i=0;i<toFlag.length;i+=200){
      const{error:ue}=await sb.from(_YT_TABLE).update(_flagPatch('무관','auto')).in('id',toFlag.slice(i,i+200));
      if(ue)throw new Error(ue.message);
    }
    localStorage.setItem('kpu_junk_sweep_version',version);
    _ytSetProg(`완료! ${rows.length}개 중 ${toFlag.length}개 무관 처리함`);
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}
// "형준/SS501 김형준" 사고와 같은 계열 — 단일음절 멤버(예: 올아워즈 "온"/"On")의 영문 표기가 "on"처럼
// 흔한 영단어와 겹치거나, 서로 다른 그룹에 동명이인 멤버(예: 크래비티 "성민"/Seongmin ↔ 슈퍼주니어
// "성민"/Sungmin)가 있어서, 정작 그 그룹 이름은 제목에 전혀 없는데도 다른 그룹의 콜라보로 잘못
// 태깅되는 사고가 반복 발견됨(예: 크래비티 자체 채널 영상 다수, 2026-07-31). _m2ParseTitle에 단일음절
// 멤버 해시태그 전용 매칭 + 자기 채널(selfGko) 동명이인 우선 처리를 추가해 앞으로는 안 생기지만, 이미
// 오염된 기존 with_members/with_groups는 남아있으므로, 전체 영상을 고친 알고리즘으로 다시 검증해서
// 더 이상 근거가 없는 콜라보 태그만 제거한다(group_ko/members는 절대 안 건드림).
// tags_manual=true(관리자가 태그 모달에서 직접 저장·확정한 행)는 알고리즘이 어떻게 판단하든 절대 건드리지
// 않음 — 관리자가 직접 확인해서 저장한 값이 항상 최종 기준(2026-07-31, 자동 재검증이 수동 태그까지
// 지워버린 사고 이후 추가된 안전장치).
// [읽기전용 미리보기](Fable #3, 2026-08-23): "콜라보 오태깅 재검증"이 무엇을 제거할지 실제 UPDATE 없이
// 미리 집계해서 보여준다(드라이런). 재파싱 valid 계산은 _ytSweepAmbiguousCollabMistag와 동일 — 여기선
// 제거될 with 태그를 빈도로 모으고, 이종(타소속사+세대차 6년+) 성격 제거를 따로 세서 콘솔/진행바에 띄운다.
// ── 콜라보 재판정(미리보기 ↔ 실제 스윕 공용) ─────────────────────────────────────
// 2026-08-26, 사용자 제보("3. 콜라보 오태깅 재검증이 잘 매칭되어있는 것까지 제거하는 것 같다").
// 원인은 제거 로직이 아니라 **미리보기가 거짓 보고**를 하고 있던 것이었다. 두 함수가 같은 판정을
// 각자 복붙해뒀는데 미리보기 쪽에만 promote/consolidate(태그를 되살리는 경로)가 빠져 있었고,
// 무엇보다 tags_manual=true 행을 **세기만 하고 목록에서 안 걸러냈다** — 실측(전체 17,185건 재현)
// 결과 미리보기가 "제거 예정"이라 부른 381건 중 **380건이 수동 편집 행**(=실제 스윕은 절대 안 건드림)
// 이라, 콘솔의 "제거될 상위30"이 사실상 보호되는 태그로 도배돼 있었다. 실제로 바뀌는 행은 1건.
// 두 곳이 다시 갈라지지 않도록 판정을 이 함수 하나로 합친다.
// ── 제거 안전장치: "제목/설명에 근거가 뻔히 있는 태그는 지우지 않는다" ──────────────
// 이 스윕의 구조적 결함: **태그는 강한 매처로 붙이고(제목+설명+별칭+영문+해시태그, 그리고 사람 손),
// 제거는 약한 매처(_m2ParseTitle — 사실상 한국어 평문 위주, 설명란을 아예 안 봄)로 판단한다.**
// 강한 매처만 찾을 수 있는 태그는 재검증 때마다 삭제 후보가 된다. 실측(2026-08-26, 전체 17,184건):
// 삭제 후보가 된 태그 515건 중 **281건(55%)이 제목에 눈으로 보인다** — 해시태그 59("#TEMPEST #혁",
// "#EPEX #뮤"), 평문 183("현아&던", "문빈,윤산하,강민"), 영문표기 39("PSY - 챔피언", "#SOYEON").
// 지금 그게 안 지워지고 있는 유일한 이유는 그 행들이 전부 tags_manual=true(=사용자가 손으로 고쳐둔 것)
// 이기 때문이다. 즉 수동 보호가 방파제 역할을 하고 있을 뿐, 보호를 풀면 그대로 날아간다.
// → 근거가 눈에 보이면 제거 후보에서 뺀다. **이름과 그룹이 둘 다** 보여야 인정하는 게 핵심 —
//    이름만으로 인정하면 동명이인 오태깅(드림캐쳐 지유 영상의 "지유(키키)")을 못 걷어낸다.
//    "키키"가 제목에 없으니 그건 그대로 제거 대상으로 남는다.
// 흔한 단어/한 글자 이름은 기존 정책(_isHashtagOnlyName, 한 글자 이름은 해시태그만 인정)을 그대로
// 적용해서 "여름"/"온" 같은 단어가 우연히 들어간 걸 근거로 오인하지 않게 한다.
function _collabEvidenceText(v){return`${v.title||''}\n${v.description||''}`;}
function _collabHasToken(text,tok,hashtagOnly){
  if(!tok)return false;
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(hashtagOnly)return new RegExp('#\\s*'+esc(tok),'i').test(text);
  // 영문/숫자 토큰은 단어 경계를 요구한다(MC 규칙과 같은 이유). 한글은 경계 개념이 약해 포함 검사.
  if(/^[A-Za-z0-9 ._'-]+$/.test(tok)){
    const flat=t=>t.replace(/[\s._'-]+/g,'').toUpperCase();   // "#LE_SSERAFIM" ↔ "LE SSERAFIM"
    return flat(text).includes(flat(tok));
  }
  return text.includes(tok);
}
// 그룹 근거: 한글명 또는 영문명이 보이면 인정
function _collabGroupEvidenced(text,gko){
  if(_collabHasToken(text,gko))return true;
  const info=GROUPS[gko];if(!info)return false;
  if(info.en&&_collabHasToken(text,info.en))return true;
  // altNames(브브걸↔브레이브걸스·하이라이트↔비스트·슈퍼노바↔초신성 등) — 태깅이 altNames로도 붙이므로
  // 재판정 근거도 동등하게 인정(2026-08-26: 재판정 매처를 태깅과 대칭으로).
  return (info.altNames||[]).some(alt=>_collabHasToken(text,alt));
}
// "이름(그룹)" 태그의 근거가 텍스트에 있나 — 이름과 그룹이 **둘 다** 보여야 한다
function _collabMemberEvidenced(text,tag){
  const m=tag.match(/^(.+)\((.+)\)$/);
  if(!m)return false;
  const[,ko,gko]=m;
  if(!_collabGroupEvidenced(text,gko))return false;
  const hashOnly=_isHashtagOnlyName(ko)||ko.length===1; // 한 글자 이름은 해시태그만(기존 정책)
  if(_collabHasToken(text,ko,hashOnly))return true;
  // 겸임 멤버(민현(워너원)·마크(엔시티 드림) 등)는 z.group.ko(주소속)로는 못 찾으므로 _artistGroups로 찾는다
  // — 예전엔 못 찾아 영문/별칭 검사가 통째로 스킵됐음.
  const a=ARTISTS.find(z=>z.name.ko===ko&&_artistGroups(z).some(g=>g.ko===gko));
  if(!a)return false;
  const en=a.name&&a.name.en;
  if(en&&en.length>2&&_collabHasToken(text,en,hashOnly))return true;
  // matchAliases(황민현↔민현·JAY B↔제이비·JIN↔진 등) — 태깅이 별칭으로 붙이므로 재판정 근거도 동등하게 인정.
  return (a.matchAliases||[]).some(al=>al&&_collabHasToken(text,al,_isHashtagOnlyName(al)||al.length===1));
}
function _collabRejudge(v){
  const match=_m2ParseTitle(v.title||'',v.group_ko,undefined,v.published_at);
  const curWG=v.with_groups||[],curWM=v.with_members||[];
  const validGroups=new Set(),validMembers=new Set(),promote=new Map(),consolidate=new Set();
  if(match){
    [match.primaryGroup,...match.withGroups].filter(og=>og&&og!==v.group_ko).forEach(og=>{
      const sec=match.membersByGroup[og]||[];
      const{asGroup,extraMembers}=_classifyGuestGroup(sec,og);
      if(asGroup){
        validGroups.add(og);
        extraMembers.forEach(mko=>validMembers.add(`${mko}(${og})`));
        if(sec.length&&!curWG.includes(og)&&curWM.some(m=>m.endsWith(`(${og})`)))consolidate.add(og);
      }else{
        const tags=sec.map(mko=>`${mko}(${og})`);
        tags.forEach(t=>validMembers.add(t));
        if(curWG.includes(og))promote.set(og,tags);
      }
    });
  }
  // 재파싱이 근거를 못 찾았더라도 제목/설명에 이름+그룹이 뻔히 보이면 유지한다(위 안전장치 주석).
  const ev=_collabEvidenceText(v);
  const newWG=[...new Set([...curWG.filter(g=>validGroups.has(g)||_collabGroupEvidenced(ev,g)),...consolidate])];
  const newWM=[...new Set([...curWM.filter(m=>validMembers.has(m)||_collabMemberEvidenced(ev,m)),...[...promote.values()].flat()])];
  const patch={};
  if(newWG.length!==curWG.length||newWG.some((g,i)=>g!==curWG[i]))patch.with_groups=newWG;
  if(newWM.length!==curWM.length||newWM.some(m=>!curWM.includes(m)))patch.with_members=newWM;
  return{
    curWG,curWM,newWG,newWM,patch,
    changed:!!Object.keys(patch).length,
    lostM:curWM.filter(m=>!newWM.includes(m)),
    lostG:curWG.filter(g=>!newWG.includes(g)),
    wiped:!newWG.length&&!newWM.length,
  };
}
async function _ytSweepDetectPreview(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-detect-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[오태깅 미리보기] 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,description,group_ko,with_members,with_groups,tags_manual,published_at')
      .or('with_members.neq.{},with_groups.neq.{}')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');return;}
    const _xgen=(a,b)=>{const g1=GROUPS[a],g2=GROUPS[b];if(!g1||!g2)return false;const c1=(g1.co||'').trim(),c2=(g2.co||'').trim();const same=!!(c1&&c2)&&c1===c2;const gap=Math.abs((parseInt(g1.debut)||0)-(parseInt(g2.debut)||0));return !same&&gap>=6;};
    const remM=new Map(),remG=new Map();let changed=0,manual=0,wiped=0,xgate=0;const samples=[];
    // 수동 편집 행은 실제 스윕이 절대 안 건드리므로 **집계에서 완전히 분리**한다 — 예전엔 같은
    // 통계에 섞여서 "제거될 상위30"이 보호되는 태그로 도배됐다(위 _collabRejudge 주석 참고).
    const manualSamples=[];
    rows.forEach(v=>{
      const j=_collabRejudge(v);
      if(!j.changed)return;
      if(v.tags_manual){
        manual++;
        if(manualSamples.length<20)manualSamples.push({id:v.id,title:v.title,group_ko:v.group_ko,보호중_유지됨:true,제안됐던제거:[...j.lostM,...j.lostG]});
        return;
      }
      changed++;
      if(j.wiped)wiped++;
      j.lostM.forEach(m=>{remM.set(m,(remM.get(m)||0)+1);const mm=m.match(/^(.+)\((.+)\)$/);if(mm&&_xgen(mm[2],v.group_ko))xgate++;});
      j.lostG.forEach(g=>remG.set(g,(remG.get(g)||0)+1));
      if(samples.length<20)samples.push({id:v.id,title:v.title,group_ko:v.group_ko,제거될멤버:j.lostM,제거될그룹:j.lostG,남을멤버:j.newWM,남을그룹:j.newWG});
    });
    console.log(`[오태깅 미리보기] ⚠️ 아래는 **실제로 바뀔 ${changed}건**만 집계한 것입니다. 수동 편집(tags_manual) ${manual}건은 스윕이 건드리지 않으므로 제외했습니다.`);
    console.log('[오태깅 미리보기] 제거될 with_members 상위30:',[...remM.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30));
    console.log('[오태깅 미리보기] 제거될 with_groups 상위20:',[...remG.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20));
    console.log('[오태깅 미리보기] 실제로 바뀔 샘플20:',samples);
    if(manual)console.log(`[오태깅 미리보기] (참고) 수동 편집이라 그대로 유지되는 행 ${manual}건 — 아래는 "만약 보호가 없었다면" 제안됐을 내용이라 조치 불필요:`,manualSamples);
    _ytSetProg(`미리보기: ${rows.length}개 중 실제로 바뀔 행 ${changed}개`+(manual?` · 수동 편집이라 그대로 두는 행 ${manual}개(변경 없음)`:'')+`. 바뀔 ${changed}개 중 태그 전부빠짐 ${wiped}개, 이종 성격 ${xgate}건. 상세는 콘솔(F12).`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 원곡 태깅 v2 — 곡명 우선 해석기 (2026-08-30, 사용자 요청 — "이름 기반 세대차 이동은 제대로 된 로직이 아니다")
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 기존 1차/2차 원곡 재분류는 "원곡자 이름이 제목에 있어 with로 잡힌 것"을 세대차로 옮기는 사후 처리라
// (a) 원곡자 이름이 제목에 없는 대다수 커버·챌린지는 영영 못 잡고 (b) 6/10년 문턱에 안 걸리면 with로 남으며
// (c) cover_of_song은 따옴표 패턴으로만 따로 채웠다. v2는 **곡명 → 원곡자** 사전을 먼저 만들고, 제목에서 곡명
// 후보를 뽑아 원곡자를 정한 뒤, 커버로 확정되면 with_*를 정리한다(원곡자 이름은 보조 근거).
//
// 사전(_coverIndex) 재료 — 전부 이미 있는 데이터:
//   · GROUPS[*].discography 트랙(268팀, 1.4만 트랙) — 타이틀곡 B등급, 수록곡 C등급
//   · GROUPS[*].songs / ARTISTS[*].songs 대표곡 — B등급
//   · ARTISTS[*].soloDiscography(멤버 솔로) / discography(솔로 아티스트) / unitDiscography(유닛) — B/C
//   · melon_yearly_top100 · spotify_streaming_milestones(DB) — A등급("유명곡")
// 원곡자 표기는 기존 컬럼 관례 그대로: 그룹 → cover_of_groups[gko], 멤버 솔로곡 → cover_of_members["이름(그룹)"],
// 무소속 솔로 → cover_of_members["이름(솔로)"].
//
// 판정 원칙(사용자 결정 2026-08-30):
//   ① 곡명 후보 강도: 크레딧("(원곡: X)"/"Original song by X"/"X - 곡 | Cover by") > 챌린지 해시태그(#곡명_Challenge)
//      > 따옴표 곡명 > 대시 구간 > 평문 사전 스캔(커버/챌린지 문맥이 있을 때만, 4자 이상·비흔한 키만)
//   ② 공연자 본인 곡은 커버가 아니다(제외) — 자기 그룹·자기 멤버·자기 유닛의 곡 전부
//   ③ 여러 원곡자 후보면 등급 A>B>C, 타이틀곡, 곡 발매일<영상일, 원곡자 데뷔<공연자 데뷔 순으로 점수. 동점이
//      서로 다른 원곡자면 태깅하지 않고 needs_review
//   ④ 챌린지도 원곡을 태깅한다(커버 탭 노출 = 덜 유명한 그룹의 노출 기회). 자체 채널 챌린지에 with/님과/선배님
//      같은 동반 표시가 없으면 원곡자 멤버는 출연하지 않은 것 — 원곡자는 cover_of로만, with_*엔 안 넣는다
//   ⑤ 커버로 확정되면 with_*에서 원곡자를 제거하고, 동반 신호(with·X·feat·님과·선배님·함께…)가 없으면 with_*를 비운다
//   ⑥ 원곡자가 우리 시스템 밖(저스틴 비버·10CM·크러쉬…)이면 커버이긴 하나 cover_of는 비워둔다 — 대신 with_*
//      오염(원곡 제목 안의 이름이 게스트로 붙은 것)은 ⑤대로 정리
//   ⑦ 잡지 '커버'·BE ORIGINAL·STUDIO CHOOM ORIGINAL·언더커버 등 _COVER_EXCLUDE 문맥은 처음부터 커버 후보에서 제외

// 곡명 정규화 — NFKC·소문자, 버전/피처링/프로듀서 괄호 제거, "A (B)"의 B가 번역 표기면 A와 B 둘 다 키로.
function _coverSongKeys(raw){
  if(!raw)return[];
  let s=String(raw).normalize('NFKC').toLowerCase().trim();
  s=s.replace(/^[\s\p{Extended_Pictographic}\uFE0F♬♪]+/u,'');
  const out=[];
  const verRe=/^(?:feat|ft|prod|with|duet|sung by|song by|vocal by|remix|inst|instrumental|acoustic|band|piano|live|korean|japanese|english|chinese|kor|jpn|eng|chn|jp|kr|en|cn|clean|explicit|remastered|remaster|original|ost|op|ed|sped up|slowed|demo|bonus|hidden|\d{4}|.*\bver\.?$|.*\bversion$|.*\bmix$|.*remix$|.*edit$|.*ver\.?\)?$)/;
  const isVerParen=inner=>verRe.test(inner.trim())||/(?:^|\s)(?:ver\.?|version|remix|edit|mix|remaster(?:ing|ed)?|inst\.?|instrumental|acoustic|feat\.?|ft\.?|prod\.?|ost|solo|special|bonus track|hidden track|clean|explicit)(?:\s|$)/.test(inner);
  // 괄호 분해: 버전류는 버림, 아니면 별도 키
  const paren=[];
  s=s.replace(/[\(（\[【]([^()（）\[\]【】]*)[\)）\]】]/g,(m,inner)=>{if(!isVerParen(inner))paren.push(inner);return ' ';});
  const clean=t=>t.replace(/[’'"“”‘`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  const main=clean(s);
  if(main.length>=2)out.push(main);
  paren.forEach(p=>{const c=clean(p);if(c.length>=2&&c!==main)out.push(c);});
  // "a & b"→"a and b" 동치, 공백 제거형도 추가(느슨 비교용)
  return [...new Set(out)];
}
function _coverKeyLoose(k){return (k||'').replace(/\s/g,'');}
// 평문 스캔에서 제외할 흔한 단어 키 — 곡명이 곧 일상어인 것들. 크레딧/따옴표/챌린지태그로 명시되면 그대로 인정.
const _COVER_COMMON_KEYS=new Set(['love','home','run','fire','hot','dream','baby','bad','good','crazy','monster','candy','boom','wave','crush','icy','hello','cool','work','stay','tonight','forever','summer','winter','spring','fall','magic','party','dance','music','sorry','happy','sad','angel','queen','king','star','moon','sun','sky','blue','red','black','pink','gold','diamond','one','two','up','down','go','on','off','up up','oh','yes','no','why','who','what','love me','i love you','i need you','call me','kiss','kiss me','bubble','gum','alone','again','goodbye','bye','hi','hey','wow','omg','lie','truth','time','day','night','light','dark','sweet','pretty','beautiful','hero','signal','favorite','regular','secret','danger','shut down','shut up','answer','dive','flower','rain','snow','cherry','honey','sugar','free','freedom','power','energy','fever','miracle','wish','breathe','breath','smile','cry','pop','rock','jump','walk','fly','open','close','yellow','white','green','purple','sweat','chains','body','pose','viral','glow','wicked','sign','beep','echo','maze','alive','automatic','trophy','vacation','freeze','feel','feeling','drama','사랑','행복','여름','겨울','가을','봄','하루','오늘','내일','친구','바다','하늘','별','달','꿈','고백','이별','안녕','미안','사랑해','좋아해','우리','너','나','그대','편지','기억','약속','비','눈','꽃','집','길','밤','아침','시간','거짓말','미쳐','나쁜','예쁘다','예뻐','사랑하기 때문에']);
// 등록 아티스트 이름 키(그룹/멤버/영문) — 크레딧 텍스트에서 "우리 시스템 안의 원곡자"를 찾는 데 씀
let _coverIndex=null;         // Map(key -> [entry]) entry:{origin:{kind:'group'|'member'|'solo',gko,mko,label}, title, tier:'A'|'B'|'C', isTitle, date, keyLoose}
let _coverIndexChart=null;    // 마지막으로 빌드에 쓴 차트 행(같으면 재빌드 안 함)
function _coverOriginLabel(o){return o.kind==='group'?o.gko:`${o.mko}(${o.gko})`;}
function _coverOriginId(o){return o.kind==='group'?`g:${o.gko}`:`m:${o.mko}(${o.gko})`;}
function _coverArtistOriginOf(a){
  // 멤버 솔로곡: "이름(그룹)"; 무소속 솔로(group.ko==='솔로'): "이름(솔로)" — 기존 데이터 관례(아이유(솔로)) 그대로
  const gko=a.group&&GROUPS[a.group.ko]?a.group.ko:'솔로';
  return{kind:gko==='솔로'?'solo':'member',gko,mko:a.name.ko};
}
// 차트 행(chartRows: [{group_ko,member_ko,song_title,...}])은 선택 — 없으면 A등급 없이 빌드
function _coverBuildIndex(chartRows){
  const idx=new Map();
  const add=(key,entry)=>{if(!key||key.length<2)return;if(!idx.has(key))idx.set(key,[]);const arr=idx.get(key);
    const dup=arr.find(e=>_coverOriginId(e.origin)===_coverOriginId(entry.origin)&&e.title===entry.title);
    if(dup){if(entry.tier<dup.tier)dup.tier=entry.tier;if(entry.isTitle)dup.isTitle=true;if(entry.date&&(!dup.date||entry.date<dup.date))dup.date=entry.date;return;}
    arr.push(entry);};
  const put=(origin,title,tier,isTitle,date)=>{_coverSongKeys(title).forEach(k=>add(k,{origin,title,tier,isTitle:!!isTitle,date:date?String(date).replace(/\./g,'-').slice(0,10):null,keyLoose:_coverKeyLoose(k)}));};
  Object.entries(GROUPS).forEach(([gko,g])=>{
    const origin={kind:'group',gko};
    (g.discography||[]).forEach(al=>(al.tracks||[]).forEach(t=>t&&t.title&&put(origin,t.title,t.isTitle?'B':'C',t.isTitle,al.releaseDate)));
    (g.songs||[]).forEach(s=>s&&s.t&&put(origin,s.t,'B',true,null));
  });
  ARTISTS.forEach(a=>{
    const origin=_coverArtistOriginOf(a);
    // ARTISTS[*].discography는 멤버든 무소속이든 "그 사람 명의 솔로 디스코"(602명) — 그룹 디스코는 GROUPS 쪽에만 있다
    [...(a.soloDiscography||[]),...(a.discography||[])].forEach(al=>(al.tracks||[]).forEach(t=>t&&t.title&&put(origin,t.title,t.isTitle?'B':'C',t.isTitle,al.releaseDate)));
    if(origin.kind==='solo')(a.songs||[]).forEach(s=>s&&s.t&&put(origin,s.t,'B',true,null));
    // 유닛곡(GOT the beat, NCT U…): 유닛 멤버 각자에게 "이름(그룹)"으로 — 같은 유닛명은 dedupe되므로 멤버 수만큼 항목이 생김
    (a.unitDiscography||[]).forEach(u=>(u.albums||[]).forEach(al=>(al.tracks||[]).forEach(t=>t&&t.title&&put({kind:'member',gko:origin.gko==='솔로'?'솔로':origin.gko,mko:a.name.ko,unit:u.unitName},t.title,t.isTitle?'B':'C',t.isTitle,al.releaseDate))));
  });
  (chartRows||[]).forEach(r=>{
    if(!r||!r.song_title)return;
    let origin=null;
    if(r.member_ko){const a=ARTISTS.find(x=>x.name.ko===r.member_ko&&(r.group_ko==='솔로'||_artistGroups(x).some(g=>g.ko===r.group_ko)));origin=a?_coverArtistOriginOf(a):(r.group_ko&&r.group_ko!=='솔로'&&GROUPS[r.group_ko]?{kind:'member',gko:r.group_ko,mko:r.member_ko}:{kind:'solo',gko:'솔로',mko:r.member_ko});}
    else if(r.group_ko&&GROUPS[r.group_ko])origin={kind:'group',gko:r.group_ko};
    if(origin)put(origin,r.song_title,'A',true,r.year?`${r.year}-01-01`:null);
  });
  _coverIndex=idx;_coverIndexChart=chartRows||null;
  return idx;
}
function _coverIndexEnsure(chartRows){if(!_coverIndex||(chartRows&&chartRows!==_coverIndexChart))_coverBuildIndex(chartRows);return _coverIndex;}

// 제목에서 커버 문맥/제외 문맥 판정. _COVER_EXCLUDE(index.html)가 있으면 그대로 쓰고 없으면(테스트) 최소 목록.
function _coverContext(title){
  const n=(title||'').normalize('NFKC').toLowerCase();
  const ex=(typeof _COVER_EXCLUDE!=='undefined'?_COVER_EXCLUDE:['be original','choom original','cover story','커버 촬영','undercover','언더커버','discover','recover','moving cover','무빙 커버','digital cover','커버스타','cover star','original ver','the original','original contents','_original','original stage','original spot','비하인드','behind','커버스토리','arena cover','dazed cover','cover highlight','cover highlights']);
  const excluded=ex.some(k=>n.includes(k));
  const cover=/\bcover(?:ed|s)?\b|커버|원곡|original\s*song|original\s*by|original\s*:|原曲|歌ってみた/.test(n);
  const challenge=/challenge|챌린지|チャレンジ/.test(n);
  return{excluded,cover,challenge,hasContext:(cover||challenge)&&!excluded};
}
// 동반 출연 신호 — 있으면 with_*를 비우지 않는다(원곡자만 뺌)
function _coverHasCollabSignal(title){
  return /\bwith\b|\bw\/|\bfeat\.?\b|\bft\.?\b|\bx\b|×|듀엣|합동|함께|님과|선배님과|후배님과|선배님|후배님|さんと|\bvs\b|콜라보|collab/i.test((title||'').normalize('NFKC'));
}
// 제목 → 곡명 후보 [{text, strength:'credit'|'tag'|'quote'|'dash'|'bare', artistText?}]
function _coverCandidates(title){
  const t=(title||'').normalize('NFKC').replace(/[│｜]/g,'|');
  const out=[];
  const push=(text,strength,artistText)=>{const s=(text||'').replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g,'').trim();
    if(strength==='dash'&&/['‘"“「＜《〈]/.test(s))return; // 따옴표를 품은 대시 구간은 따옴표 후보가 대신 처리
    if(s&&s.length>=2&&s.length<=60)out.push({text:s,strength,artistText:artistText||null});};
  // ── 크레딧 절 ──
  // (원곡: X) / (원곡 : X) / (Original song by X) / (Original by X) / (원곡자: X) / 原曲 : X
  // ⚠️ "by?"는 리터럴 b+옵션 y라 'H.O.T.'·'소녀시대'를 못 잡았다(2026-08-30 테스트로 발견) — (?:by\.?)?로.
  const creditRe=/[\(（\[【]\s*(?:\*?\s*원곡자?|original(?:\s*song|\s*track)?(?:\s*by\.?|\s*:)?|原曲)\s*[:：]?\s*([^\)）\]】]{1,60})[\)）\]】]/gi;
  let m;const credits=[];
  while((m=creditRe.exec(t))){credits.push({artist:m[1].trim(),idx:m.index,end:m.index+m[0].length});}
  // 크레딧 바로 앞의 곡명: "…'곡명' (원곡: X)" 또는 "… - 곡명 (원곡: X)" 또는 "♬ 곡명 - 그룹 (원곡: X)"
  credits.forEach(c=>{
    let before=t.slice(0,c.idx);
    // "곡명 Covered by 공연자 (원곡: X)" — 크레딧 앞에 커버 표기가 있으면 곡명은 그 앞
    const cb=before.match(/^(.*?)\s+(?:covered|cover)\s+by\b/i);if(cb)before=cb[1];
    let song=null;
    const q=before.match(/['‘"“「「＜《]([^'’"”」＞》]{1,60})['’"”」＞》]\s*$/);
    if(q)song=q[1];
    else{const d=before.match(/(?:^|[-–—|:,♬♪]\s*|\]\s*)([^\-–—|:,\[\]♬♪]{1,60}?)\s*$/);if(d)song=d[1];}
    push(song,'credit',c.artist);
  });
  // "X - 곡명 | Cover by …", "X - 곡명 (Cover)", "곡명 - X (cover)", "'곡명' (X) Cover", "X 'S' cover", "X의 S 커버"
  const coverWord=/\bcover(?:ed)?\b|커버/i;
  if(coverWord.test(t)&&!credits.length){
    const core=t.replace(/[\[\(【][^\]\)】]*(?:cover|커버|dance|vocal|band|live|shorts|special|archive|us record|on film|from\.|sub)[^\]\)】]*[\]\)】]/gi,' ').replace(/\|.*$/,'').replace(/(?:dance|vocal|band|piano|guitar|acoustic)?\s*cover(?:ed)?\s*(?:by|ver\.?|version|video|live).*$/i,'').replace(/\s*(?:cover|커버)\s*$/i,'');
    const dm=core.match(/^\s*(.{1,50}?)\s+[-–—]\s+(.{1,60}?)\s*$/);
    if(dm){push(dm[2],'dash',dm[1]);push(dm[1],'dash',dm[2]);}
  }
  // "곡명 Covered by 공연자" (대시·따옴표 없음)
  const cbm=t.match(/^\s*(?:[\[【][^\]】]*[\]】]\s*)?(.{2,60}?)\s+(?:covered|cover)\s+by\b/i);
  if(cbm&&!credits.length&&!/['‘"“「]/.test(cbm[1]))push(cbm[1].replace(/^[\s\p{Extended_Pictographic}\uFE0F]+/u,''),'dash');
  // ── 챌린지 해시태그: #Song_Challenge / #SongChallenge / #Song챌린지 / #Song_challenge ──
  const tagRe=/#([^\s#]+?)(?:_?(?:challenge|챌린지|チャレンジ))(?![\p{L}\p{N}])/giu;
  while((m=tagRe.exec(t))){const raw=m[1].replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2');if(!/^(?:dance|댄스|idol|kpop|k-pop|shorts|엠카|mcd|vocal|밴드|band)$/i.test(raw))push(raw,'tag');}
  // "'곡명' 챌린지" / "〈곡명〉 챌린지"
  const qc=/['‘"“「＜《〈]([^'’"”」＞》〉]{1,40})['’"”」＞》〉]\s*(?:댄스\s*)?(?:챌린지|challenge)/gi;
  while((m=qc.exec(t)))push(m[1],'tag');
  // ── 따옴표 구간 ──
  const qRe=/(?:^|[\s\]\)\-–—|:])['‘](.+?)['’](?=[\s\(\)\[\]|,.!?]|$)|["“](.+?)["”]|「(.+?)」|＜(.+?)＞|《(.+?)》|〈(.+?)〉/g;
  while((m=qRe.exec(t))){const inner=m[1]||m[2]||m[3]||m[4]||m[5]||m[6];if(!inner||credits.some(c=>m.index>=c.idx&&m.index<c.end))continue;
    let cleaned=inner.replace(/\s*[\(（][^)）]*(?:원곡|original)[^)）]*[\)）]/i,'');
    // "'HOT(LE SSERAFIM)'"처럼 따옴표 안 괄호가 아티스트명이면 곡명과 분리
    const pa=cleaned.match(/^(.+?)\s*[\(（]([^)）]{1,40})[\)）]\s*$/);
    if(pa&&_coverOriginFromText(pa[2])){push(pa[1],'quote',pa[2]);continue;}
    // "방탄소년단(BTS)-Dynamite"·"TWICE - MORE & MORE"처럼 따옴표 안에 아티스트-곡명이 같이 든 관례 — 양쪽을 각각 후보로
    const qd=cleaned.match(/^\s*(.{1,40}?)\s*[-–—]\s*(.{1,60}?)\s*$/);
    if(qd){push(qd[2],'quote',qd[1]);push(qd[1],'quote',qd[2]);}
    else{
      // "BIGBANG '봄여름가을겨울'"·"SHINee 'Don't Call Me'"처럼 따옴표 바로 앞 같은 구간의 텍스트를 아티스트 후보로
      const seg=t.slice(0,m.index+1).split(/[|｜\[\]\(\)]/).pop().replace(/[-–—:]\s*$/,'').trim();
      const lead=seg.split(/\s+[-–—:]\s+/).pop().trim();
      push(cleaned,'quote',lead&&lead.length<=40?lead:null);
    }}
  // ── 대시 구간(크레딧/따옴표 없을 때 보조) ──
  if(!out.some(o=>o.strength==='credit'||o.strength==='quote')){
    const core=t.replace(/[\[【][^\]】]*[\]】]/g,' ').replace(/\|.*$/,'').replace(/#\S+/g,' ').trim();
    const dm=core.match(/^\s*(.{1,50}?)\s+[-–—]\s+(.{1,60}?)\s*(?:[\(（].*)?$/);
    if(dm){push(dm[2],'dash',dm[1]);push(dm[1],'dash',dm[2]);}
  }
  return out;
}
// 크레딧/대시 옆 텍스트에서 "우리 시스템 안의 원곡자"를 찾는다 → origin 또는 null(외부 아티스트)
function _coverOriginFromText(text){
  if(!text)return null;
  const s=text.normalize('NFKC').trim();
  let r=null;try{r=_m2ParseTitle(s,undefined,false,undefined);}catch(e){}
  if(r&&r.primaryGroup){
    const g=r.primaryGroup;
    const mem=(r.membersByGroup&&r.membersByGroup[g])||[];
    if(GROUPS[g]){
      if(mem.length===1&&!r.withGroups.length){const a=ARTISTS.find(x=>x.name.ko===mem[0]&&_artistGroups(x).some(y=>y.ko===g));if(a&&(a.soloDiscography||a.discography||a.songs))return{kind:'member',gko:g,mko:mem[0]};}
      return{kind:'group',gko:g};
    }
    const a=ARTISTS.find(x=>x.name.ko===g);
    if(a)return _coverArtistOriginOf(a);
  }
  // 영문/한글 솔로명 직접 대조(파서가 짧은 영문(IU 등)을 게이트할 수 있어 보조)
  const key=s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  const a=ARTISTS.find(x=>{const ko=(x.name.ko||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');const en=(x.name.en||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');return key&&(key===ko||(en&&key===en))&&(x.group.ko==='솔로'||x.soloDiscography||x.discography||x.songs);});
  if(a)return _coverArtistOriginOf(a);
  const gk=Object.keys(GROUPS).find(k=>{const ko=k.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');const en=(GROUPS[k].en||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');return key&&(key===ko||(en&&key===en));});
  return gk?{kind:'group',gko:gk}:null;
}
// 공연자(performer) 소속으로 보이는 origin인가 — 자기 곡이면 커버 아님
function _coverIsSelf(origin,performerGko,performerMembers){
  if(!origin)return false;
  if(origin.gko===performerGko)return true;
  if(origin.kind!=='group'&&performerGko&&!GROUPS[performerGko]&&origin.mko===performerGko)return true; // 무소속 솔로(group_ko=아이유)의 자기 곡
  if(origin.kind!=='group'&&performerGko&&(performerMembers||[]).includes(origin.mko))return true;
  // 공연자 그룹 멤버의 솔로곡을 그 그룹이 부른 경우도 자기 곡
  if(origin.kind!=='group'&&origin.gko===performerGko)return true;
  return false;
}
function _coverDebutYear(gko){const g=GROUPS[gko];return g?(parseInt(g.debut)||0):0;}
// 핵심 해석기. row:{title,group_ko,members,with_members,with_groups,published_at}, opts:{chartRows}
// 반환: null(커버 아님/판정 불가) 또는 {isCover, origin|null, song|null, ambiguous, reason, patch}
function _coverResolve(row,opts){
  const idx=_coverIndexEnsure(opts&&opts.chartRows);
  const title=row.title||'';
  const ctx=_coverContext(title);
  if(ctx.excluded)return null;
  let performer=row.group_ko;
  let members=row.members||[];
  const pub=(row.published_at||'').slice(0,10);
  const cands=_coverCandidates(title);
  // 1) 크레딧 원곡자(가장 강함)
  let creditOrigin=null,creditSong=null,creditExternal=false,reassign=null;
  for(const c of cands){
    if(c.strength!=='credit')continue;
    const o=_coverOriginFromText(c.artistText);
    if(o){
      if(_coverIsSelf(o,performer,members)){
        // "(원곡: 저장된 그룹)"인데 with_*에 다른 그룹(멤버)이 붙어 있으면 옛 오저장 — 원곡자가 group_ko에, 실제 공연자가
        // with에 들어간 것(표본: "kep1er - The Boys (원곡 : 소녀시대)"가 group_ko=소녀시대·with 케플러). 공연자를 with 쪽으로 바꿔 재판정.
        const wg=row.with_groups||[],wm=(row.with_members||[]).map(m=>m.match(/^(.+)\((.+)\)$/)).filter(Boolean);
        const gk=wg.length===1?wg[0]:(wg.length===0&&wm.length&&wm.every(x=>x[2]===wm[0][2])?wm[0][2]:null);
        if(gk&&gk!==performer&&GROUPS[gk]){reassign={group_ko:gk,members:wm.filter(x=>x[2]===gk).map(x=>x[1])};performer=gk;members=reassign.members;row=Object.assign({},row,{group_ko:gk,members,with_groups:[],with_members:[]});}
        else return null; // 자기 곡 라이브, 커버 아님
      }
      creditOrigin=o;creditSong=c.text;break;
    }
    creditExternal=true;creditSong=creditSong||c.text;
  }
  // 대시/따옴표 옆 아티스트 텍스트가 시스템 안 원곡자로 풀리면 그 원곡자 항목을 크게 가산(크레딧 다음 강도)
  const sideBoost=new Map();
  cands.forEach(c=>{if(c.strength==='credit'||!c.artistText)return;const o=_coverOriginFromText(c.artistText);if(o&&!_coverIsSelf(o,performer,members))sideBoost.set(_coverOriginId(o),8);});
  const scored=[];
  const weightS={credit:6,tag:5,quote:4,dash:2,bare:1};
  let selfHit=false; // 강한 후보(크레딧/태그/따옴표)가 공연자 자기 곡에 걸림 → 자기 곡 무대, 커버 아님
  const lookup=(text,strength,lockOrigin)=>{
    if(strength!=='bare'){const asArtist=_coverOriginFromText(text);if(asArtist&&(!lockOrigin||_coverIsSelf(asArtist,performer,members)))return;} // 후보 텍스트 자체가 아티스트명("TREASURE")이면 곡명이 아님(아티스트가 따로 명시된 후보는 예외 — 'HOT' vs H.O.T. — 단 공연자 자신의 이름은 항상 제외)
    _coverSongKeys(text).forEach(k=>{
      const hits=idx.get(k)||[];
      if(hits.some(e=>_coverIsSelf(e.origin,performer,members))){if(strength!=='bare')selfHit=true;return;} // 같은 제목의 자기 곡이 있으면 그 곡
      hits.forEach(e=>{
        if(lockOrigin&&_coverOriginId(e.origin)!==_coverOriginId(lockOrigin))return; // "BIGBANG '곡'"처럼 아티스트가 명시된 후보는 그 원곡자 항목만
        if(strength==='bare'&&(_COVER_COMMON_KEYS.has(k)||k.replace(/\s/g,'').length<4))return;
        if(strength==='dash'&&_COVER_COMMON_KEYS.has(k))return;
        if(strength==='quote'&&!ctx.hasContext&&_COVER_COMMON_KEYS.has(k))return;
        let s=weightS[strength]+(e.tier==='A'?3:e.tier==='B'?2:0)+(e.isTitle?1:0);
        if(e.date&&pub){s+=e.date<pub?1:-4;}
        if(e.origin.kind==='group'&&performer&&GROUPS[performer]){const dy=_coverDebutYear(e.origin.gko),py=_coverDebutYear(performer);if(dy&&py)s+=dy<py?1:(dy>py?-1:0);}
        // 유명도(groups.json pri: 4 > 1.5 > 0.6) — "유명 그룹이 원곡자일 확률이 높다"(사용자). 동명 곡 동점 깨기용.
        const pri=e.origin.kind==='solo'?4:((GROUPS[e.origin.gko]||{}).pri||0);s+=pri>=4?2:pri>=1.5?1:0; // 등록된 무소속 솔로(아이유·보아…)는 전부 톱티어
        if(creditOrigin&&_coverOriginId(e.origin)===_coverOriginId(creditOrigin))s+=10;
        s+=sideBoost.get(_coverOriginId(e.origin))||0;
        scored.push({e,s,strength,key:k});
      });
    });
  };
  cands.forEach(c=>{if(c.strength==='credit')return;const lock=c.artistText?_coverOriginFromText(c.artistText):null;lookup(c.text,c.strength,lock&&!_coverIsSelf(lock,performer,members)?lock:null);});
  if(selfHit&&!creditOrigin)return null;
  // 챌린지 태그는 곡명을 줄여 쓰는 관례(#첫만남챌린지 = "첫 만남은 계획대로 되지 않아") — 정확 일치가 없으면 접두 일치
  cands.filter(c=>c.strength==='tag').forEach(c=>{
    const keys=_coverSongKeys(c.text);if(keys.some(k=>idx.has(k)))return;
    const cl=_coverKeyLoose(keys[0]||'');if(cl.length<3)return;
    let best=null;idx.forEach((hits,k)=>{const kl=_coverKeyLoose(k);if(kl.startsWith(cl)&&(!best||kl.length<best.length))best=k;});
    if(best)lookup(best,'tag');
  });
  if(creditSong)lookup(creditSong,'credit');
  // 평문 스캔: 커버/챌린지 문맥이 있을 때만 — 제목 전체를 사전 키(4자+, 비흔한, A/B등급)와 단어경계 대조
  if(ctx.hasContext){
    const norm=' '+title.normalize('NFKC').toLowerCase().replace(/[@#]\S+/g,' ').replace(/[’'"“”‘`]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ')+' ';
    idx.forEach((hits,k)=>{
      if(k.replace(/\s/g,'').length<4||_COVER_COMMON_KEYS.has(k))return;
      if(!hits.some(e=>e.tier!=='C'))return;
      if(norm.includes(' '+k+' '))lookup(k,'bare');
    });
  }
  // 2) 선택 — 같은 원곡자 항목은 최고점만
  const byOrigin=new Map();
  scored.forEach(x=>{const id=_coverOriginId(x.e.origin);if(!byOrigin.has(id)||byOrigin.get(id).s<x.s)byOrigin.set(id,x);});
  const ranked=[...byOrigin.values()].sort((a,b)=>b.s-a.s);
  let origin=null,song=null,ambiguous=false,reason='';
  if(creditOrigin){origin=creditOrigin;const hit=ranked.find(x=>_coverOriginId(x.e.origin)===_coverOriginId(creditOrigin));song=hit?hit.e.title:(creditSong||null);reason='credit';}
  else if(!ranked.some(x=>x.strength!=='bare')&&ctx.cover&&sideBoost.size===1){
    // 디스코에 없는 곡("BIGBANG '봄여름가을겨울' COVER")이라도 아티스트 표기가 시스템 안 원곡자 하나로 풀리면 그대로 인정
    const id=[...sideBoost.keys()][0];const pool=cands.filter(x=>x.artistText&&!_coverOriginFromText(x.text)&&_coverOriginFromText(x.artistText)&&_coverOriginId(_coverOriginFromText(x.artistText))===id);
    const c=pool.find(x=>x.strength==='quote')||pool[0];if(!c)return null;
    origin=_coverOriginFromText(c.artistText);song=c.text;reason='artist';
  }
  else if(ranked.length){
    const top=ranked[0],second=ranked[1];
    if(top.s<(ctx.hasContext?6:8)){reason='weak';}
    else if(second&&top.s-second.s<2&&_coverOriginId(second.e.origin)!==_coverOriginId(top.e.origin)){ambiguous=true;reason='ambiguous';}
    else{origin=top.e.origin;song=top.e.title;reason=top.strength;}
  }
  const isCover=!!(origin||creditExternal||ctx.cover);
  // 3) 패치 — cover_of/with_* 정리
  const curWG=row.with_groups||[],curWM=row.with_members||[],curCG=row.cover_of_groups||[],curCM=row.cover_of_members||[];
  const collab=_coverHasCollabSignal(title);
  const patch={};
  if(origin){
    const label=_coverOriginLabel(origin);
    if(origin.kind==='group'){patch.cover_of_groups=[...new Set([...curCG.filter(g=>g!==label),label])];patch.cover_of_members=curCM;}
    else{patch.cover_of_members=[...new Set([...curCM.filter(m=>m!==label),label])];patch.cover_of_groups=curCG;}
    if(song&&!row.cover_of_song)patch.cover_of_song=song;
    // with_*에서 원곡자 제거(그룹/그 그룹 멤버 표기 모두)
    const og=origin.gko;
    let wg=curWG.filter(g=>g!==og),wm=curWM.filter(m=>!(m.endsWith(`(${og})`)||(origin.kind!=='group'&&m===label)));
    if(!collab){wg=[];wm=[];}
    if(wg.length!==curWG.length||wm.length!==curWM.length){patch.with_groups=wg;patch.with_members=wm;}
  }else if(isCover&&!collab&&(curWG.length||curWM.length)){
    // 외부 원곡 커버인데 with가 붙어있음(원곡 제목/원곡자 표기가 게스트로 오인된 것) → 정리
    patch.with_groups=[];patch.with_members=[];
  }
  if(reassign&&origin){patch.group_ko=reassign.group_ko;patch.members=reassign.members;if(!('with_groups' in patch)){patch.with_groups=[];patch.with_members=[];}}
  if(!origin&&!ambiguous&&!isCover)return null;
  return{isCover,origin,song,ambiguous,reason:reassign?'reassign':reason,patch,collab,candidates:cands};
}


// [원곡 태깅 v2 스윕](2026-08-30) — 위 _coverResolve를 기존 행 전체(커버/챌린지 키워드 or with_* or cover_of_* 있는 행)에
// 돌려 cover_of_groups/members/song·with_*·(옛 오저장이면 group_ko/members)를 한 번에 정정한다. 기존 1차/2차 원곡 재분류·
// 커버곡 제목 추출 3버튼을 대체. 안전장치는 다른 재검증 버튼과 동일: tags_manual·content_flag 제외, 유형별 건수+표본 콘솔 →
// confirm → 스냅샷 → 200건 청크 update. 차트 테이블(melon_yearly_top100·spotify_streaming_milestones)은 있으면 A등급으로 읽고
// 없으면(권한/미생성) 그냥 빠진 채 진행한다.
async function _coverLoadChartRows(){
  if(!sb)return[];
  const out=[];
  for(const[tbl,cols]of[['melon_yearly_top100','group_ko,member_ko,song_title,year'],['spotify_streaming_milestones','group_ko,member_ko,song_title']]){
    try{const{data,error}=await _sbFetchAll(()=>sb.from(tbl).select(cols).order('song_title'));if(!error&&data)out.push(...data);}catch(e){}
  }
  return out;
}
async function _ytSweepCoverV2(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-cover-v2-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[원곡 v2] 차트 테이블 로드 중…');
    const chartRows=await _coverLoadChartRows();
    _coverBuildIndex(chartRows);
    _ytSetProg(`[원곡 v2] 사전 ${_coverIndex.size}키 (차트 ${chartRows.length}행) · 대상 조회 중…`);
    const KW=['*cover*','*커버*','*원곡*','*original*','*challenge*','*챌린지*','*原曲*','*歌ってみた*'];
    const orExpr=[...KW.map(k=>`title_norm.ilike.${k}`),'with_groups.neq.{}','with_members.neq.{}','cover_of_groups.neq.{}','cover_of_members.neq.{}'].join(',');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,cover_of_members,cover_of_groups,cover_of_song,published_at,tags_manual,content_flag')
      .or(orExpr).order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('대상 행이 없어요');return;}
    const EXCLUDE=new Set(['무관','보류','hidden','외부인']);
    const same=(a,b)=>{const x=[...new Set(a||[])].sort(),y=[...new Set(b||[])].sort();return x.length===y.length&&x.every((v,i)=>v===y[i]);};
    let manualSkipped=0,ambiguous=0,external=0;const updates=[];const sample={cover:[],move:[],wipe:[],reassign:[],ambiguous:[]};
    const push=(k,line)=>{if(sample[k].length<60)sample[k].push(line);};
    for(let i=0;i<rows.length;i++){
      if(i%2000===0){_ytSetProg(`[원곡 v2] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      if(v.content_flag&&EXCLUDE.has(v.content_flag))continue;
      let r=null;try{r=_coverResolve(v,{chartRows});}catch(e){console.warn('[원곡 v2] 해석 오류',v.id,e);continue;}
      if(!r)continue;
      if(r.ambiguous){ambiguous++;push('ambiguous',`#${v.id} ${(v.title||'').slice(0,80)}`);continue;}
      if(!r.origin)external++;
      const p=r.patch;const patch={};
      if(p.cover_of_groups&&!same(p.cover_of_groups,v.cover_of_groups))patch.cover_of_groups=p.cover_of_groups;
      if(p.cover_of_members&&!same(p.cover_of_members,v.cover_of_members))patch.cover_of_members=p.cover_of_members;
      if(p.cover_of_song&&!v.cover_of_song)patch.cover_of_song=p.cover_of_song;
      if('with_groups' in p&&!same(p.with_groups,v.with_groups))patch.with_groups=p.with_groups;
      if('with_members' in p&&!same(p.with_members,v.with_members))patch.with_members=p.with_members;
      if(p.group_ko&&p.group_ko!==v.group_ko){patch.group_ko=p.group_ko;patch.members=p.members||[];}
      if(!Object.keys(patch).length)continue;
      if(v.tags_manual){manualSkipped++;continue;}
      updates.push({id:v.id,patch});
      const line=`#${v.id} [${v.group_ko}${patch.group_ko?'→'+patch.group_ko:''}] cover_of ${JSON.stringify(v.cover_of_groups||[])}${JSON.stringify(v.cover_of_members||[])}→${JSON.stringify(patch.cover_of_groups||v.cover_of_groups||[])}${JSON.stringify(patch.cover_of_members||v.cover_of_members||[])} song=${patch.cover_of_song||v.cover_of_song||''} with ${JSON.stringify(v.with_groups||[])}${JSON.stringify(v.with_members||[])}→${JSON.stringify('with_groups' in patch?patch.with_groups:v.with_groups||[])}${JSON.stringify('with_members' in patch?patch.with_members:v.with_members||[])} | ${(v.title||'').slice(0,70)}`;
      if(patch.group_ko)push('reassign',line);
      else if(patch.cover_of_groups||patch.cover_of_members){push((v.with_groups||[]).length||(v.with_members||[]).length?'move':'cover',line);}
      else push('wipe',line);
    }
    const n={cover:updates.filter(u=>(u.patch.cover_of_groups||u.patch.cover_of_members)&&!u.patch.group_ko).length,wipe:updates.filter(u=>!u.patch.cover_of_groups&&!u.patch.cover_of_members&&!u.patch.group_ko).length,reassign:updates.filter(u=>u.patch.group_ko).length};
    console.log(`[원곡 v2] 조회 ${rows.length} · 정정 후보 ${updates.length} (원곡 태깅/이동 ${n.cover} · with만 정리 ${n.wipe} · 옛 오저장 재배정 ${n.reassign}) · 애매 ${ambiguous} · 외부 원곡 ${external} · 수동보호 ${manualSkipped}`);
    Object.entries(sample).forEach(([k,arr])=>{if(arr.length)console.log(`[원곡 v2] 표본 — ${k}:\n`+arr.join('\n'));});
    if(!updates.length){_ytSetProg(`원곡 v2 — 정정할 것 없음 (조회 ${rows.length}, 애매 ${ambiguous}건 콘솔)`);return;}
    if(!await _sweepConfirmSimple("원곡 태깅 v2","정정 실행",`원곡 태깅 v2 — ${updates.length}건 정정할까요?\n\n· 원곡 태깅/with→cover_of 이동 ${n.cover}\n· 커버인데 with만 정리 ${n.wipe}\n· 옛 오저장(원곡자가 group_ko) 재배정 ${n.reassign}\n· 애매(동명곡·판정 불가) ${ambiguous}건은 건드리지 않음(콘솔)\n· 수동편집 ${manualSkipped}건 제외 · 표본 콘솔(F12) · 스냅샷 되돌리기 가능`)){
      _ytSetProg(`취소됨 — 미리보기만 (후보 ${updates.length}, 표본 콘솔).`);return;
    }
    await _snapshotBeforeBulk('원곡 태깅 v2',updates.map(u=>u.id));
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[원곡 v2] ${done}/${total}건 적용 중…`)});
    if(_ub.failed)console.error('[원곡 v2] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! 원곡 v2 ${updates.length}건 정정 (태깅 ${n.cover} / with정리 ${n.wipe} / 재배정 ${n.reassign}). 애매 ${ambiguous}건 콘솔. (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-cover-v2-btn',_ytSweepCoverV2,'원곡 태깅 v2');

// ── [원곡 오탐 청소](2026-08-31) ───────────────────────────────────────────────
// 2026-08-31 실DB 전수 감사(cover_of가 붙은 7,031행)에서 나온 오염을 걷어낸다.
//
// 무엇이 오염인가 — **커버 문맥이 없는데 cover_of가 붙은 행**이다. 대부분 옛 `_ytSweepCoverReclassify`
// ("커버 키워드 + 6년 이상 선배면 원곡자") 휴리스틱의 잔재로, 곡명 근거 없이 세대차만 보고 **게스트
// 출연자를 원곡자로 강등**시킨 것이다. 실제로 "#오하영 선배님❤️" 같은 콜라보가 cover_of_members에
// 들어가 있고, v2가 커버를 확정하면 with_*를 비우는 규칙 때문에 **콜라보 정보 자체가 사라진** 행이 많다.
//
// ⚠️ "커버 문맥 없으면 전부 오탐"이 **아니다**(감사 중간 결론을 실측으로 뒤집었다). 음악방송 커버 무대는
//    제목에 '커버'라는 말이 없는 게 정상이라, 그렇게 잘라내면 정상 커버가 대량으로 날아간다
//    (리센느 '다시 만난 세계'→소녀시대, 아이브 가을 'Pretty Girl (카라)'→카라 …). 그래서 이 스윕은
//    **현재 매처(_coverResolve)에게 다시 물어보고, 매처도 커버 근거를 못 찾은 행만** 건드린다.
//    매처가 여전히 커버라고 하는 행은 손대지 않는다 — 그건 원곡 로직이 아니라 대개 group_ko 오배정
//    문제라(화사 직캠이 group_ko=몬스타엑스로 박혀 자기 곡인 걸 못 알아봄) "② 오태깅 그룹 재배정"의 몫.
//
// 정리 방식은 두 갈래다:
//   ① 제목에 콜라보 동반신호(선배님과/with/님과/함께/feat…)가 있으면 → cover_of를 **with_로 되돌린다**
//      (원래 콜라보였는데 강등된 것이므로, 지우면 정보가 영영 사라진다)
//   ② 없으면 → cover_of를 그냥 비운다
// tags_manual은 어느 쪽이든 불가침. 스냅샷을 떠서 "↩︎ 마지막 일괄 작업 되돌리기"로 복구 가능.
// 되돌리기(cover_of → with_) 판정은 `_coverHasCollabSignal`보다 **좁게** 잡는다. 그쪽은 "with_를 비울지"를
// 정하는 보수적 용도라 `x`/`×`/`vs`까지 콜라보로 세는데, 여기선 그게 그대로 오염이 된다 — 시뮬에서
// "Good Boy Gone Bad - TOMORROW X TOGETHER"의 **그룹명 안에 든 X**가 콜라보로 읽혀서 지디·태양을
// 콜라보 태그로 되돌리려 했다(2026-08-31 실측). 태그를 새로 만드는 방향이므로 근거가 명시적일 때만 한다.
function _coverRestoreSignal(title){
  return /선배님?|후배님?|님과|함께|\bwith\b|\bw\/|\bfeat\.?\b|\bft\.?\b|듀엣|합동|콜라보|collab|さんと/i.test((title||'').normalize('NFKC'));
}
async function _ytSweepCoverCleanup(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-cover-clean-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[원곡 청소] 차트 테이블 로드 중…');
    const chartRows=await _coverLoadChartRows();
    _coverBuildIndex(chartRows);
    _ytSetProg(`[원곡 청소] 사전 ${_coverIndex.size}키 · 대상 조회 중…`);
    // cover_of가 실제로 붙어 있는 행만 — 이 스윕은 "붙은 걸 걷어내는" 일이라 그 외는 볼 필요가 없다.
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,cover_of_members,cover_of_groups,cover_of_song,published_at,tags_manual,content_flag')
      .or('cover_of_groups.neq.{},cover_of_members.neq.{}').order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('cover_of가 붙은 행이 없어요');return;}
    const EXCLUDE=new Set(['무관','보류','hidden','외부인']);
    let manualSkipped=0,hasCtx=0,stillCover=0,excluded=0;
    const updates=[];const sample={restore:[],clear:[]};
    const push=(k,line)=>{if(sample[k].length<60)sample[k].push(line);};
    for(let i=0;i<rows.length;i++){
      if(i%1000===0){_ytSetProg(`[원곡 청소] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      if(v.content_flag&&EXCLUDE.has(v.content_flag)){excluded++;continue;}
      const curCG=v.cover_of_groups||[],curCM=v.cover_of_members||[];
      if(!curCG.length&&!curCM.length)continue;
      // 커버 문맥이 있으면 정상 커버로 보고 손대지 않는다(이 스윕의 사정권 밖).
      if(_coverContext(v.title).hasContext){hasCtx++;continue;}
      // 현재 매처에게 다시 묻는다 — cover_of를 지운 상태로 넣어 "지금 이 제목만 보고도 커버라고 할까?"
      let out=null;
      try{out=_coverResolve(Object.assign({},v,{cover_of_groups:[],cover_of_members:[]}),{chartRows});}catch(e){continue;}
      if(out&&out.origin){stillCover++;continue;} // 매처가 근거를 댐 → 여기서 판단하지 않는다
      if(v.tags_manual){manualSkipped++;continue;} // 수동 확정은 절대 불가침
      const patch={cover_of_groups:[],cover_of_members:[]};
      if(v.cover_of_song)patch.cover_of_song=null;
      const restore=_coverRestoreSignal(v.title);
      if(restore){
        patch.with_groups=[...new Set([...(v.with_groups||[]),...curCG])];
        patch.with_members=[...new Set([...(v.with_members||[]),...curCM])];
      }
      updates.push({id:v.id,patch,restore});
      push(restore?'restore':'clear',`#${v.id} [${v.group_ko}] ${JSON.stringify([...curCG,...curCM])}${restore?' → with_':' → 삭제'} | ${(v.title||'').slice(0,70)}`);
    }
    const nRestore=updates.filter(u=>u.restore).length,nClear=updates.length-nRestore;
    console.log(`[원곡 청소] 조회 ${rows.length} · 정리 후보 ${updates.length} (with_로 되돌림 ${nRestore} · 그냥 해제 ${nClear}) · 커버 문맥 있어 유지 ${hasCtx} · 매처가 커버라 판정해 유지 ${stillCover} · 수동보호 ${manualSkipped} · 플래그 제외 ${excluded}`);
    Object.entries(sample).forEach(([k,arr])=>{if(arr.length)console.log(`[원곡 청소] 표본 — ${k==='restore'?'with_로 되돌림':'그냥 해제'}:\n`+arr.join('\n'));});
    if(!updates.length){_ytSetProg(`원곡 청소 — 정리할 것 없음 (조회 ${rows.length} · 유지 ${hasCtx+stillCover})`);return;}
    // 미리보기 숫자는 confirm과 **독립적으로** 패널에 띄운다 — 예전엔 confirm 안에만 있고 취소하면
    // "취소됨" 한 줄로 덮여서, 숫자를 보려면 F12를 열어야 했다(사용자 제보 2026-08-31). 게다가 브라우저가
    // "추가 대화상자 차단"을 걸면 confirm이 대화상자 없이 바로 false를 반환해 미리보기조차 못 보게 된다.
    const summary=`정리 ${updates.length}건 (with_로 되돌림 ${nRestore} · 해제 ${nClear}) / 유지 ${hasCtx+stillCover}건 (정상 커버 ${hasCtx} · 매처가 커버 판정 ${stillCover}) · 수동보호 ${manualSkipped}`;
    _ytSetProg(`[원곡 청소] 미리보기 — ${summary}`);
    await new Promise(r=>setTimeout(r,50)); // 확인창 뜨기 전에 화면에 먼저 그려지도록
    const msg=`원곡(cover_of) 오탐 ${updates.length}건을 정리할까요?\n\n· 콜라보 동반신호 있음 → with_로 되돌림 : ${nRestore}건\n   (원래 게스트 출연인데 옛 휴리스틱이 원곡자로 강등시킨 것 — 그냥 지우면 콜라보 정보가 사라져요)\n· 근거 없음 → cover_of 해제 : ${nClear}건\n\n손대지 않는 것\n· 커버 문맥이 있는 정상 커버 ${hasCtx}건\n· 매처가 지금도 커버라고 판정한 ${stillCover}건 (대개 group_ko 오배정 문제 — "② 오태깅 그룹 재배정"의 몫)\n· 수동편집 ${manualSkipped}건\n\n표본은 콘솔(F12) · 스냅샷 저장돼서 되돌리기 가능`;
    // 앱 자체 다이얼로그를 우선 쓴다(브라우저 대화상자 차단·PWA 환경에 안 걸림). 없으면 native confirm.
    let ok;
    if(typeof _confirmDialog==='function'){
      ok=await _confirmDialog({title:`원곡 오탐 ${updates.length}건 정리`,msg,okLabel:'정리 실행',wide:true});
    }else ok=confirm(msg);
    if(!ok){
      _ytSetProg(`취소됨 — 적용 안 함. 미리보기: ${summary} · 적용하려면 버튼을 다시 눌러 "정리 실행"을 선택하세요(표본은 F12 콘솔).`);
      return;
    }
    await _snapshotBeforeBulk('원곡 오탐 청소',updates.map(u=>u.id));
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[원곡 청소] ${done}/${total}건 적용 중…`)});
    if(_ub.failed)console.error('[원곡 청소] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! 원곡 오탐 ${updates.length}건 정리 (with_ 되돌림 ${nRestore} / 해제 ${nClear}). 유지 ${hasCtx+stillCover}건. (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-cover-clean-btn',_ytSweepCoverCleanup,'원곡 오탐 청소');

// ── [겸임 멤버 중복 태그 정리](2026-08-31) ─────────────────────────────────────
// 위 _normalizeMemberTags는 **앞으로 붙는** 태그만 고친다. 이미 쌓인 행은 이 스윕이 정리한다.
// 판정 로직을 따로 쓰지 않고 같은 함수를 그대로 통과시키므로 매처와 정리가 어긋날 수 없다.
// ⚠️ 동명이인(세븐틴 민규 / 동키즈 민규)은 합치지 않는다 — _amtSamePerson이 artists.json 항목 기준으로
//    같은 사람일 때만 묶는다. tags_manual은 불가침. 스냅샷 저장 → "↩︎ 마지막 일괄 작업 되돌리기".
async function _ytSweepDualMemberTags(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-dualtag-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[겸임 중복] 대상 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,tags_manual')
      .neq('with_members','{}').order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('with_members가 있는 행이 없어요');return;}
    const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
    let manualSkipped=0;const updates=[];const sample=[];
    for(let i=0;i<rows.length;i++){
      if(i%2000===0){_ytSetProg(`[겸임 중복] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      const out=_normalizeMemberTags({title:v.title,groupKo:v.group_ko,members:v.members||[],withGroups:v.with_groups||[],withMembers:v.with_members||[]});
      if(same(out.withMembers,v.with_members||[])&&same(out.withGroups,v.with_groups||[]))continue;
      if(v.tags_manual){manualSkipped++;continue;}
      const patch={with_members:out.withMembers};
      if(!same(out.withGroups,v.with_groups||[]))patch.with_groups=out.withGroups;
      updates.push({id:v.id,patch});
      if(sample.length<60){
        const removed=(v.with_members||[]).filter(x=>!out.withMembers.includes(x));
        sample.push(`#${v.id} [${v.group_ko}] m:${JSON.stringify(v.members||[])} ${JSON.stringify(v.with_members)}→${JSON.stringify(out.withMembers)} (제거 ${JSON.stringify(removed)}) | ${(v.title||'').slice(0,60)}`);
      }
    }
    console.log(`[겸임 중복] 조회 ${rows.length} · 정리 후보 ${updates.length} · 수동보호 ${manualSkipped}`);
    if(sample.length)console.log('[겸임 중복] 표본:\n'+sample.join('\n'));
    if(!updates.length){_ytSetProg(`겸임 중복 — 정리할 것 없음 (조회 ${rows.length}${manualSkipped?` · 수동보호 ${manualSkipped}`:''})`);return;}
    const summary=`정리 ${updates.length}건 / 조회 ${rows.length} · 수동보호 ${manualSkipped}`;
    _ytSetProg(`[겸임 중복] 미리보기 — ${summary}`);
    await new Promise(r=>setTimeout(r,50));
    const msg=`겸임(이중소속) 멤버 중복 태그 ${updates.length}건을 정리할까요?\n\n· 같은 사람이 두 소속으로 두 번 붙은 것 → 대표 그룹 하나로\n· members에 이미 있는 사람이 with_members에도 든 것 → 제거\n\n동명이인(세븐틴 민규 / 동키즈 민규)은 합치지 않아요 — artists.json에서 같은 인물일 때만.\n남길 대표 그룹은 ①제목에 언급된 그룹 ②artists.json repGroup ③주 소속 순서로 정해집니다.\n\n· 수동편집 ${manualSkipped}건 제외 · 표본 콘솔(F12) · 스냅샷 저장돼서 되돌리기 가능`;
    let ok;
    if(typeof _confirmDialog==='function')ok=await _confirmDialog({title:`겸임 중복 ${updates.length}건 정리`,msg,okLabel:'정리 실행',wide:true});
    else ok=confirm(msg);
    if(!ok){_ytSetProg(`취소됨 — 적용 안 함. 미리보기: ${summary} · 적용하려면 다시 눌러 "정리 실행"을 선택하세요(표본은 F12 콘솔).`);return;}
    await _snapshotBeforeBulk('겸임 멤버 중복 태그 정리',updates.map(u=>u.id));
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[겸임 중복] ${done}/${total}건 적용 중…`)});
    if(_ub.failed)console.error('[겸임 중복] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! 겸임 중복 태그 ${updates.length}건 정리. (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-dualtag-btn',_ytSweepDualMemberTags,'겸임 중복 정리');

// ── [데뷔 이전 영상 정리](2026-08-31) ──────────────────────────────────────────
// _m2DebutBlocks는 **앞으로 붙는** 태그만 막는다. 이미 저장된 행은 이 스윕이 정리한다.
// 판정은 같은 함수를 그대로 쓰므로 매처와 어긋날 수 없다.
//
// 정리 방식: group_ko를 지우는 게 아니라 **'보류'로 보낸다.** '무관'이 아닌 이유 —
// 이 영상들은 대개 "우리 우주 밖"이 아니라 **아직 등록 안 된 그룹의 영상**이다(제국의 아이들·M4·9초 등).
// 나중에 그 그룹을 등록하면 재판정 대상이 되어야 하므로 검수 목록에 남겨둔다.
async function _ytSweepDebutGate(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-debutgate-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[데뷔 게이트] 대상 조회 중…');
    // 가장 늦게 데뷔한 그룹 기준으로도 걸릴 수 없는 최신 영상은 아예 안 긁는다(조회량 절감).
    const maxDebut=Math.max(...Object.values(GROUPS).map(g=>parseInt(String(g.debut).slice(0,4),10)||0));
    const cutoff=`${maxDebut}-12-31`;
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,published_at,content_flag,tags_manual,source_tier')
      .lt('published_at',cutoff).order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('대상 영상이 없어요');return;}
    let manualSkipped=0,alreadyFlagged=0,ownerSkipped=0;
    const updates=[];const byGroup={};const sample=[];
    for(let i=0;i<rows.length;i++){
      if(i%3000===0){_ytSetProg(`[데뷔 게이트] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      if(!_m2DebutBlocks(v.group_ko,v.published_at))continue;
      if(v.content_flag){alreadyFlagged++;continue;}       // 이미 무관/보류/숨김이면 손 안 댐
      if(v.tags_manual){manualSkipped++;continue;}          // 수동 확정 불가침
      if(v.source_tier==='idol'||v.source_tier==='fans'){ownerSkipped++;continue;} // owner 채널은 group_ko 고정
      updates.push(v.id);
      (byGroup[v.group_ko]=byGroup[v.group_ko]||[]).push(v);
      if(sample.length<40)sample.push(`#${v.id} [${v.group_ko} 데뷔 ${GROUPS[v.group_ko].debut}] ${v.published_at} | ${(v.title||'').slice(0,66)}`);
    }
    const top=Object.entries(byGroup).sort((a,b)=>b[1].length-a[1].length).slice(0,15)
      .map(([g,l])=>`  ${String(l.length).padStart(4)} ${g} (데뷔 ${GROUPS[g].debut})`).join('\n');
    console.log(`[데뷔 게이트] 조회 ${rows.length} · 보류 이동 후보 ${updates.length} · 이미 플래그 ${alreadyFlagged} · 수동보호 ${manualSkipped} · owner채널 제외 ${ownerSkipped}`);
    if(top)console.log('[데뷔 게이트] 그룹별 TOP15:\n'+top);
    if(sample.length)console.log('[데뷔 게이트] 표본:\n'+sample.join('\n'));
    if(!updates.length){_ytSetProg(`데뷔 게이트 — 정리할 것 없음 (조회 ${rows.length} · 이미 플래그 ${alreadyFlagged})`);return;}
    const summary=`보류 이동 ${updates.length}건 / 조회 ${rows.length} · 이미 플래그 ${alreadyFlagged} · 수동보호 ${manualSkipped}`;
    _ytSetProg(`[데뷔 게이트] 미리보기 — ${summary}`);
    await new Promise(r=>setTimeout(r,50));
    const msg=`영상 발행일이 그룹 데뷔보다 ${_M2_DEBUT_GRACE_YEARS}년 이상 앞선 ${updates.length}건을 '보류'로 옮길까요?\n\n· 대개 "우주 밖"이 아니라 **아직 등록 안 된 그룹의 영상**이라 '무관'이 아니라 보류로 보냅니다(제국의 아이들·M4·9초 등). 나중에 그 그룹을 등록하면 재판정 대상이 됩니다.\n· 이미 플래그된 ${alreadyFlagged}건 · 수동편집 ${manualSkipped}건 · owner 채널 ${ownerSkipped}건은 손대지 않습니다.\n\n그룹별 건수와 표본 40건을 콘솔(F12)에 출력했어요 — 먼저 확인 권장.\n스냅샷 저장돼서 되돌리기 가능.`;
    let ok;
    if(typeof _confirmDialog==='function')ok=await _confirmDialog({title:`데뷔 이전 영상 ${updates.length}건 보류`,msg,okLabel:'보류로 이동',wide:true});
    else ok=confirm(msg);
    if(!ok){_ytSetProg(`취소됨 — 적용 안 함. 미리보기: ${summary} · 적용하려면 다시 눌러 "보류로 이동"을 선택하세요(표본은 F12 콘솔).`);return;}
    await _snapshotBeforeBulk('데뷔 이전 영상 보류 이동',updates);
    for(let i=0;i<updates.length;i+=200){
      const{error:ue}=await sb.from(_YT_TABLE).update(_flagPatch('보류','auto')).in('id',updates.slice(i,i+200));
      if(ue)throw new Error(ue.message);
      _ytSetProg(`[데뷔 게이트] ${Math.min(i+200,updates.length)}/${updates.length}건 적용 중…`);
    }
    _ytSetProg(`완료! 데뷔 이전 영상 ${updates.length}건 보류 이동. (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-debutgate-btn',_ytSweepDebutGate,'데뷔 이전 정리');

// 오태깅 재배정 계열 스윕이 공유하는 판정 도구(2026-09-03 추출). 예전엔 함수마다 이 넷을 각자 선언했는데,
// 같은 뜻의 목록/정규식이 여러 곳에 흩어지면 한쪽만 고칠 때 조용히 어긋난다(이날 위너 게이트가 정확히
// 그렇게 두 벌이 되면서 서로 다른 기준을 갖게 됐다). 새 재배정 스윕을 추가할 땐 여기서 가져다 쓸 것.
// ⚠️ 전부 화살표 함수로 둔다 — 쓰는 쪽이 `const{_titleHas}=_MISTAG`로 구조분해하므로 메서드 축약형
//    (this._grpToks)을 쓰면 this가 끊겨 즉시 터진다.
const _mtGrpToks=ko=>{const v=GROUPS[ko];return v?[ko,v.en,...(v.altNames||[])].filter(Boolean).map(t=>t.toUpperCase()):[];};
const _mtNorm=t=>' '+(t||'').toUpperCase().replace(/[^가-힣A-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';
// 느슨한 포함 — "저장 그룹이 제목에 근거가 있나"(스킵 판정)처럼 **넓게 걸수록 안전한** 쪽에 쓴다.
const _mtTitleHas=(nu,ko)=>_mtGrpToks(ko).some(t=>nu.includes(t));
// 단독 토큰 — "이 그룹으로 옮겨도 되나"(적용 판정)처럼 **좁게 걸어야 안전한** 쪽에 쓴다.
// _norm이 비영숫자를 공백으로 바꾸고 앞뒤에 공백을 덧대므로, 양쪽 공백까지 포함해 찾으면 부분문자열
// 매칭이 배제된다(미등록 그룹 영상이 제목 속 다른 그룹명 조각에 끌려가는 걸 막는 게 목적).
const _mtTitleHasToken=(nu,ko)=>_mtGrpToks(ko).some(t=>nu.includes(' '+t+' '));
// 콜라보 신호는 원문(구두점 유지)에서 검사 — 정규화하면 w/·feat. 같은 신호가 사라져 콜라보를 놓친다.
const _MT_COLLAB=/with |w\/| feat| ft[ .]|선배|챌린지|challenge|원곡| cover|커버|＆| & |함께|출연|게스트|guest| vs | x /i;
const _MISTAG={_grpToks:_mtGrpToks,_norm:_mtNorm,_titleHas:_mtTitleHas,_titleHasToken:_mtTitleHasToken,COLLAB:_MT_COLLAB};

// [오태깅 그룹 재배정](2026-08-25): 고친 매칭 엔진(_m2ParseTitle)을 기존 저장 행에 다시 돌려서,
// "저장된 group_ko는 제목에 근거가 없는데, 엔진이 제목에 대놓고 있는 '다른 그룹'을 찾은" 행을 그 그룹으로
// 재배정한다. 전수 진단(scratchpad B리포트)에서 이런 3천여 건 대부분이 오염이 아니라 옛 버그로 엉뚱한
// 그룹에 저장됐던 직캠의 '정당한 복구'로 확인됨(하이키·체리블렛·클라씨 등). 엔진을 그대로 재사용하므로
// 매칭 로직을 고칠수록(폴루터 게이트 추가 등) 이 도구도 자동으로 더 정확해진다.
// 안전장치: 저장 그룹이 제목에 있으면 스킵(근거 있음), 엔진 그룹이 제목에 literal로 있을 때만(강한 근거)
// 재배정, 콜라보 신호(with/선배/feat…)는 원문 기준으로 제외(게스트일 뿐 원태그가 맞을 수 있음),
// tags_manual 보호, 드라이런(건수 confirm)+스냅샷 되돌리기. cover_of_*는 안 건드림.
async function _ytSweepMistagReclassify(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-mistagfix-btn');
  // 직전 실행의 분석 결과가 보관돼 있으면 **재분석 없이 바로 적용**한다(2026-08-31 사용자 제보 —
  // "1시간 기다렸는데 취소됨만 뜨고 계산이 다 날아갔다"). 38만 행 재스캔을 다시 시키지 않는 게 요점.
  const _kept=_sweepPeek('sp-mistagfix-btn');
  if(_kept){
    if(btn)btn.disabled=true;
    try{
      _ytSetProg(`[오태깅 재배정] 보관된 분석 결과 ${_kept.count}건을 바로 적용합니다(재스캔 없음)…`);
      _sweepPending.delete('sp-mistagfix-btn');
      await _kept.apply();
    }catch(e){_ytSetProg('오류: '+e.message);}
    finally{if(btn)btn.disabled=false;}
    return;
  }
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[오태깅 재배정] 전체 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,published_at,tags_manual,content_flag').order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('영상이 없어요');return;}
    const EXCLUDE=new Set(['무관','보류','hidden','외부인']);
    const {_grpToks,_norm,_titleHas,COLLAB}=_MISTAG; // 아래 보류/숨김 재배정과 **같은 판정을 공유**한다
    let manualSkipped=0;const updates=[];const sample=[];
    for(let i=0;i<rows.length;i++){
      if(i%5000===0){_ytSetProg(`[오태깅 재배정] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];const g=v.group_ko;
      if(!g||!GROUPS[g])continue;
      if(v.content_flag&&EXCLUDE.has(v.content_flag))continue;
      const nu=_norm(v.title);
      if(_titleHas(nu,g))continue; // 저장 그룹이 제목에 있음 → 근거 있음, 안 건드림
      let m=null;try{m=_m2ParseTitle(v.title,undefined,false,(v.published_at||'').slice(0,10));}catch(e){}
      const ng=m&&m.primaryGroup;
      if(!ng||ng===g)continue;
      if(!_titleHas(nu,ng))continue;         // 엔진 그룹이 제목에 literal로 있어야만 재배정(강한 근거)
      if(COLLAB.test(v.title||''))continue;   // 콜라보/게스트면 원태그가 맞을 수 있어 제외
      if(v.tags_manual){manualSkipped++;continue;}
      const members=(m.membersByGroup&&m.membersByGroup[ng])||[];
      const wgs=m.withGroups||[];
      const wms=[];wgs.forEach(x=>((m.membersByGroup&&m.membersByGroup[x])||[]).forEach(mm=>wms.push(`${mm}(${x})`)));
      updates.push({id:v.id,patch:{group_ko:ng,members,with_groups:wgs,with_members:wms}});
      if(sample.length<40)sample.push(`[${g}→${ng}] ${(v.title||'').slice(0,60)}`);
    }
    console.log('[오태깅 재배정] 재배정 예정 표본(최대40):\n'+sample.join('\n'));
    if(!updates.length){_ytSetProg(`재배정할 오태깅 없음 (전체 ${rows.length} 스캔${manualSkipped?`, 수동보호 ${manualSkipped}`:''})`);return;}
    // 적용부를 함수로 — 취소 시 이걸 보관해두면 다시 누를 때 재분석 없이 바로 돈다(1시간 재스캔 방지).
    const _apply=async()=>{
      await _snapshotBeforeBulk('오태깅 그룹 재배정',updates.map(u=>u.id));
      const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
        {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[오태깅 재배정] ${done}/${total}건 적용 중…`)});
      if(_ub.failed)console.error('[오태깅 재배정] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
      _ytSetProg(`완료! ${updates.length}건 그룹 재배정함.${manualSkipped?` 수동보호 ${manualSkipped}건.`:''} (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
    };
    const msg=`오태깅 그룹 재배정 ${updates.length}건을 적용할까요?\n\n· "저장 그룹은 제목에 근거 없음 + 엔진이 제목의 다른 그룹을 literal로 찾음"인 행\n  (대부분 옛 오저장의 정당한 복구 — 하이키·체리블렛 등)\n· 콜라보(with/선배/feat)·수동편집(${manualSkipped}건)은 자동 제외\n· 표본 40건을 콘솔(F12)에 출력함\n· 스냅샷 저장되어 "↩︎ 마지막 일괄 작업 되돌리기"로 복구 가능`;
    _ytSetProg(`[오태깅 재배정] 분석 완료 — 재배정 예정 ${updates.length}건 (전체 ${rows.length} 스캔, 수동보호 ${manualSkipped})`);
    await new Promise(r=>setTimeout(r,50)); // 확인창 전에 숫자가 화면에 먼저 남게
    if(!await _sweepConfirm('sp-mistagfix-btn',`오태깅 그룹 재배정 ${updates.length}건`,msg,'재배정 실행',updates.length,_apply))return;
    await _apply();
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-mistagfix-btn',_ytSweepMistagReclassify,'오태깅 그룹 재배정');

// [보류/숨김 그룹 재배정](2026-09-03) — 위 ②가 손대지 않는 사각지대 전용.
//
// 왜 따로 만드나: ②는 맨 앞에서 `content_flag`가 무관/보류/hidden/외부인인 행을 **분석 대상에서 통째로
// 제외**한다. 그런데 실측해보니 오염이 바로 거기 고여 있었다 — 스트레이키즈로 잘못 배정된 제로베이스원
// 직캠 285건 중 282건(99%)이 보류/hidden이었고, 콜라보 태그된 12,027건 기준으로 "재배정 자격은 되는데
// 플래그 때문에 스킵되는" 행이 988건이었다(②가 실제로 고친 건 14건). 즉 **오염은 유저에게 안 보이는
// 큐 안에 있는데, 그걸 고칠 도구가 바로 그 큐를 안 보고 있었다.**
//
// ②와 다른 점 세 가지:
//   ① 대상이 보류/hidden **뿐**이다. 무관·외부인은 계속 제외한다 — 그건 "우리 콘텐츠가 아니다"라는
//      판단이라 "어느 그룹이냐"와 다른 축이고, 그룹만 고쳐봐야 의미가 없다.
//   ② 옮겨갈 그룹의 근거를 **단독 토큰**으로 좁힌다(_titleHasToken). 보류 큐엔 서바이벌·미등록 신인
//      영상이 많아서(실측 기준 다수), 제목 속 등록된 그룹명 **조각**에 끌려가면 곧바로 새 오배정이 된다.
//      ②의 느슨한 포함(_titleHas)을 그대로 쓰면 위험한 쪽이 바로 여기다.
//   ③ `content_flag`는 건드리지 않는다. 그룹만 바로잡고, 숨김을 푸는 건 별개 결정으로 남긴다
//      (지금 같이 풀면 아직 그룹이 틀린 행까지 유저 화면에 나온다 — 순서가 중요).
// 공통: tags_manual 보호 · 건수 미리보기 후 확인 · 스냅샷 되돌리기.
async function _ytSweepHeldMistagReclassify(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-heldfix-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[보류/숨김 재배정] 보류·숨김 행 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,published_at,tags_manual,content_flag')
      .in('content_flag',['보류','hidden'])
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('보류/숨김 영상이 없어요');return;}
    const{_norm,_titleHas,_titleHasToken,COLLAB}=_MISTAG;
    let manualSkipped=0,collabSkipped=0,weakEvidence=0;
    const updates=[];const sample=[];const byTarget={};
    for(let i=0;i<rows.length;i++){
      if(i%2000===0){_ytSetProg(`[보류/숨김 재배정] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];const g=v.group_ko;
      if(!g||!GROUPS[g])continue;
      const nu=_norm(v.title);
      if(_titleHas(nu,g))continue;            // 저장 그룹이 제목에 있음 → 근거 있음, 안 건드림
      let m=null;try{m=_m2ParseTitle(v.title,undefined,false,(v.published_at||'').slice(0,10));}catch(e){}
      const ng=m&&m.primaryGroup;
      if(!ng||ng===g)continue;
      if(!_titleHasToken(nu,ng)){weakEvidence++;continue;} // ★ 단독 토큰일 때만(미등록 그룹 보호)
      if(COLLAB.test(v.title||'')){collabSkipped++;continue;}
      if(v.tags_manual){manualSkipped++;continue;}
      const members=(m.membersByGroup&&m.membersByGroup[ng])||[];
      const wgs=m.withGroups||[];
      const wms=[];wgs.forEach(x=>((m.membersByGroup&&m.membersByGroup[x])||[]).forEach(mm=>wms.push(`${mm}(${x})`)));
      updates.push({id:v.id,patch:{group_ko:ng,members,with_groups:wgs,with_members:wms}});
      const key=`${g} → ${ng}`;byTarget[key]=(byTarget[key]||0)+1;
      if(sample.length<40)sample.push(`[${v.content_flag}] ${g}→${ng}  ${(v.title||'').slice(0,66)}`);
    }
    console.log('[보류/숨김 재배정] 재배정 예정 표본(최대40):\n'+sample.join('\n'));
    console.log('[보류/숨김 재배정] 이동 방향별 건수(많은 순):',Object.entries(byTarget).sort((a,b)=>b[1]-a[1]).slice(0,25));
    if(!updates.length){_ytSetProg(`재배정할 게 없음 (보류/숨김 ${rows.length} 스캔${manualSkipped?`, 수동보호 ${manualSkipped}`:''})`);return;}
    const _apply=async()=>{
      await _snapshotBeforeBulk('보류/숨김 그룹 재배정',updates.map(u=>u.id));
      const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
        {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[보류/숨김 재배정] ${done}/${total}건 적용 중…`)});
      if(_ub.failed)console.error('[보류/숨김 재배정] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
      _ytSetProg(`완료! ${updates.length}건 그룹 재배정함(숨김/보류 상태는 그대로 유지). (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
    };
    const msg=`보류/숨김 영상 ${rows.length}건을 훑어 ${updates.length}건을 재배정할까요?\n\n`+
      `· 대상: content_flag가 보류/숨김인 행만 (무관·외부인은 제외)\n`+
      `· 조건: 저장 그룹은 제목에 근거 없음 + 새 그룹명이 제목에 **단독 토큰**으로 있음\n`+
      `· content_flag는 안 건드립니다 — 그룹만 바로잡고 숨김 해제는 별도 결정\n\n`+
      `안 건드리는 것\n`+
      `· 근거가 약한(부분문자열만 일치) ${weakEvidence}건 ← 미등록 그룹 영상 보호\n`+
      `· 콜라보/커버 신호 있는 ${collabSkipped}건\n`+
      `· 수동편집 ${manualSkipped}건\n\n`+
      `⚠️ 표본 40건과 "이동 방향별 건수"를 콘솔(F12)에 출력했어요 — 먼저 훑어보고 실행하세요.\n`+
      `스냅샷 저장되어 "↩︎ 마지막 일괄 작업 되돌리기"로 복구 가능`;
    _ytSetProg(`[보류/숨김 재배정] 분석 완료 — 재배정 예정 ${updates.length}건 (보류/숨김 ${rows.length} 스캔)`);
    await new Promise(r=>setTimeout(r,50));
    if(!await _sweepConfirm('sp-heldfix-btn',`보류/숨김 그룹 재배정 ${updates.length}건`,msg,'재배정 실행',updates.length,_apply))return;
    await _apply();
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-heldfix-btn',_ytSweepHeldMistagReclassify,'보류/숨김 그룹 재배정');

// [탈퇴 후 솔로 영상 귀속](2026-09-03) — 그룹을 떠난 뒤 솔로로 활동하는 사람의 영상이 갈 곳을 준다.
//
// 문제: 탈퇴 게이트(_atmLeftBefore)는 "탈퇴 이후 영상은 그 그룹 콘텐츠가 아니다"라며 옛 그룹을 후보에서
// 뺀다(라이즈 승한 사례). 옳은 판정인데, 뺀 다음 **갈 곳이 없어서** 무매칭 → 보류로 쌓인다. 원호의 2021년
// 솔로 무대가 정확히 그 상태였다.
//
// 해결: 이 프로젝트엔 이미 솔로 규약이 있다 — 아티스트는 `group.ko='솔로'`, 영상은 `group_ko=본인 이름`.
// 아이유·이영지·보아·승한이 그렇게 돌아가고 있고, 멤버 카드 쿼리가 `group_ko.eq.${memberKo}` 절로 두 키를
// 합집합해 가져오므로 **옛 그룹 시절 영상과 솔로 영상이 한 카드에 같이 뜬다.** 그룹 카드 쿼리는 group_ko와
// with_groups만 보므로 옛 그룹은 안 더럽혀진다. 그래서 스키마·쿼리 변경 없이 값만 바꾸면 된다.
//
// 게이트(전부 통과해야 함) — 느슨하면 곧바로 새 오배정이 된다:
//   ① 탈퇴일(left)이 있고 소속 그룹이 하나뿐  ② 사망자 제외(died) — 존엄 문제라 예외 없음
//   ③ 밴 인물 제외(_isBannedVideoTitle)  ④ 이름이 고유(동명이인·영단어·1글자 제외)
//      ⚠️ ④가 없으면 "Love(전 온리원오프)" 같은 흔한 단어가 401건을 쓸어담는다(실측).
//   ⑤ 영상이 탈퇴일 이후  ⑥ 제목에 그 이름이 **단독 토큰**으로 존재
//   ⑦ 저장된 group_ko가 그 사람의 옛 그룹일 때만(엉뚱한 그룹 행은 안 건드림)  ⑧ tags_manual 보호
// 대상은 보류/숨김 행에 한정한다 — 정상 노출 중인 행을 옮기면 유저 화면이 흔들린다.
async function _ytSweepExMemberSolo(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-exsolo-btn');
  if(btn)btn.disabled=true;
  try{
    const _groupsOf=a=>{const s=new Set();if(a.group&&a.group.ko)s.add(a.group.ko);if(Array.isArray(a.groups))a.groups.forEach(g=>{const ko=typeof g==='string'?g:(g&&(g.ko||g.name));if(ko)s.add(ko);});return[...s];};
    const nameCount={};ARTISTS.forEach(a=>{const n=a.name&&a.name.ko;if(n)nameCount[n]=(nameCount[n]||0)+1;});
    const _riskyName=n=>!n||nameCount[n]>1||/^[A-Za-z0-9 ]+$/.test(n)||n.length<2;
    // ⚠️ **전수 자동 스윕이 아니라 사람을 지정해서 돌린다**(2026-09-03, 실측 후 설계 변경).
    // 처음엔 "탈퇴+단일소속+생존+이름고유"를 만족하는 181명을 자동으로 훑게 만들었는데, 실데이터
    // 시뮬레이션에서 정밀도가 형편없었다:
    //   · 게이트 없이:      75건 중 41건이 **"바로"**(비원에이포) — 한국어 부사 "지금 **바로** 댓글로"에 걸림
    //   · 강한 근거만:      17건으로 줄었지만 그마저 대부분이 **미등록 신인 그룹의 동명이인**이었다
    //     (하츠웨이브 리안 ≠ 미래소년 리안, 모디세이 린린 ≠ 체리블렛 린린, 러브홀릭 지선 ≠ 프로미스나인 지선)
    // "이름 고유" 검사는 **등록된** 아티스트만 세므로 미등록 그룹 멤버를 못 본다(dedup의 알려진 한계).
    // 탈퇴자 솔로 영상은 애초에 희소해서 이 노이즈가 신호를 압도한다 — 자동화로 풀 문제가 아니다.
    // 그래서 **관리자가 이름을 직접 지정**한다. 사람이 신원을 확정한 뒤에도 아래 강한 근거 게이트는
    // 그대로 걸린다(같은 이름의 다른 사람이 섞이는 걸 한 겹 더 막기 위해).
    // 명단은 **데이터**다 — artists.json의 구조 자체가 곧 대상 목록이다(2026-09-03).
    // 처음엔 여기서 prompt로 이름을 받게 했는데, 같은 명단을 동기화(_extBuildRows)도 봐야 해서
    // 코드 밖 한 곳(데이터)에 두는 쪽으로 옮겼다. 사람을 추가하려면 artists.json 구조만 바꾸면
    // 이 버튼과 신규 동기화가 **동시에** 그 사람을 처리한다.
    // 명단은 **기존 구조에서 파생한다** — group.ko가 실존 그룹이 아니고(=솔로 전향) groups[]의 옛 소속에
    // 탈퇴일이 찍힌 사람. 새 필드를 두지 않으므로 동기화(_soloReattribGko)와 이 버튼이 **같은 데이터**를
    // 본다. 사람을 추가하려면 artists.json에서 group.ko를 '솔로'로 바꾸고 옛 소속을 groups[]에 left와
    // 함께 남기면 된다(승한·빛새온·김민서가 이미 그 모양).
    const cands=new Map(); // 이름 → {gko, leftISO}
    const rejected=[];
    ARTISTS.forEach(a=>{
      const cur=a.group&&a.group.ko;
      if(!cur||GROUPS[cur])return;                 // 현재 소속이 실존 그룹이면 대상 아님
      const n=a.name&&a.name.ko;
      if(a.died){rejected.push(`${n} — 사망자라 대상 아님`);return;}
      const past=(a.groups||[]).filter(g=>g&&g.ko&&GROUPS[g.ko]);
      if(!past.length)return;                      // 옛 그룹 이력이 없는 원래 솔로(아이유 등)는 옮길 게 없음
      past.forEach(g=>{
        if(!g.left){rejected.push(`${n} — 옛 소속 "${g.ko}"에 탈퇴일이 없어 경계를 못 그음`);return;}
        const L=String(g.left).replace(/\./g,'-');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(L)){rejected.push(`${n} — "${g.ko}" 탈퇴일 "${g.left}" 형식 오류`);return;}
        if(_riskyName(n))rejected.push(`${n} — ⚠️ 이름이 위험(동명이인/영단어/1글자)이지만 진행 — 표본을 꼭 확인하세요`);
        cands.set(n,{gko:g.ko,leftISO:L});         // 옛 소속이 여럿이면 마지막 것 — 표본으로 확인할 것
      });
    });
    if(rejected.length)console.log('[탈퇴 솔로 귀속] 제외/주의:\n  '+rejected.join('\n  '));
    if(!cands.size){_ytSetProg("대상 인물이 없어요 — artists.json에서 group.ko를 '솔로'로 바꾸고 옛 소속을 groups[]에 left와 함께 남겨주세요");return;}
    // ⚠️ **이름을 반드시 보여준다.** 건수만 띄웠더니 "대상 1명"이 나왔는데 그게 누구인지 몰라 원인을
    //    못 찾았다(2026-09-03) — 실제로는 브라우저가 **페이지 로드 시점의 옛 artists.json**을 들고
    //    있어서 새로 바꾼 3명이 안 잡힌 것이었다. ARTISTS는 로드 때 한 번만 읽으므로, 데이터를 고친
    //    뒤엔 **새로고침**해야 한다. 이름이 보이면 그 상황이 한눈에 드러난다.
    const _names=[...cands.entries()].map(([n,i])=>`${n}(전 ${i.gko}, ${i.leftISO}~)`).join(' · ');
    console.log(`[탈퇴 솔로 귀속] 대상 ${cands.size}명: ${_names}`);
    console.log('[탈퇴 솔로 귀속] ⚠️ 명단이 예상과 다르면 페이지를 새로고침하세요 — ARTISTS는 로드 시점 데이터입니다.');
    // ⚠️ 보류/숨김으로 좁히면 안 된다(2026-09-03 실측). 우즈·에반·원호로 시뮬레이션했더니 **전부 0건**이었다 —
    //    이 사람들의 솔로 영상은 보류가 아니라 **정상 노출 중인데 옛 그룹에 붙어 있는** 상태다.
    //    (탈퇴 게이트에 걸려 보류로 가는 건 "새로 들어오는" 영상이고, 기존 재고는 옛 매처가 이미 옛 그룹으로
    //     확정해둔 것들이다.) 그래서 전체를 훑고 클라이언트에서 거른다 — ②와 같은 방식.
    //    무관/외부인은 제외한다("우리 콘텐츠가 아니다"라는 판단이라 귀속과 축이 다름).
    // content_flag는 서버 필터 대신 **클라이언트에서** 거른다. 서버 `.or()`도 정상 동작하지만
    // (실측 384,993건, 인덱스 정상) 전체를 한 번 훑는 다른 스윕들과 조회 형태를 맞춰두는 편이
    // 페이지네이션 동작이 같아 예측하기 쉽다.
    //
    // ⚠️ 아래 "잘림 감지"는 실제로 겪은 버그가 아니라 **예방책**이다. 2026-09-03에 진행 로그의
    //    "384,993건 스캔"이 한 줄 말줄임으로 "38499…"로 보여서 조회가 끊긴 것으로 **두 번 오진했다**
    //    (덤으로 group_ko 필터가 500이라던 것도 오진이었다 — 셸이 한글을 깨뜨려 보낸 것이지
    //    서버는 멀쩡했고 인덱스도 149ms로 정상이었다). 그래도 부분 스캔을 조용히 적용하는 건
    //    위험하므로 감지 자체는 남겨둔다 — 비용은 HEAD 카운트 한 번뿐이다.
    _ytSetProg(`[탈퇴 솔로 귀속] 대상 인물 ${cands.size}명 — 전체 조회 중…`);
    const _cnt=await sb.from(_YT_TABLE).select('id',{count:'exact',head:true});
    const _expected=_cnt&&_cnt.count;
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,published_at,tags_manual,content_flag')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('영상이 없어요');return;}
    // 조용한 잘림 감지 — 전체 건수와 크게 어긋나면 분석 결과를 믿을 수 없으므로 멈춘다.
    if(_expected&&rows.length<_expected*0.95){
      _ytSetProg(`조회가 중간에 끊겼어요 — ${rows.length.toLocaleString()}/${_expected.toLocaleString()}건만 받음. 그대로 진행하면 일부만 처리되니 중단합니다. 잠시 후 다시 시도해주세요.`);
      console.error('[탈퇴 솔로 귀속] 조회 잘림',{받음:rows.length,전체:_expected});
      return;
    }
    const EXCLUDE_FLAG=new Set(['무관','외부인']); // "우리 콘텐츠가 아니다"는 판단이라 귀속과 축이 다름
    const{_norm}=_MISTAG;
    let manualSkipped=0,bannedSkipped=0,beforeLeft=0,wrongBase=0,weakEvidence=0;
    const updates=[];const sample=[];const byPerson={};
    for(let i=0;i<rows.length;i++){
      if(i%2000===0){_ytSetProg(`[탈퇴 솔로 귀속] 분석 중… ${i}/${rows.length} (후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      if(v.content_flag&&EXCLUDE_FLAG.has(v.content_flag))continue; // 서버 대신 여기서 거른다
      const nu=_norm(v.title);const d=(v.published_at||'').slice(0,10);
      for(const[name,info]of cands){
        if(!nu.includes(' '+name.toUpperCase()+' '))continue;   // ⑥ 단독 토큰
        if(v.group_ko!==info.gko){wrongBase++;break;}            // ⑦ 옛 그룹 행만
        if(!d||d<info.leftISO){beforeLeft++;break;}              // ⑤ 탈퇴 이후만
        // ⑨ 강한 근거: 직캠 구조의 **출연자 구간**에 있거나 #해시태그로 명시된 것만.
        //    평문에 이름이 스쳐 지나가는 것으론 부족하다 — "지금 바로 댓글로"의 '바로'(비원에이포)가
        //    41건을 쓸어담았던 실측 사례. 사람을 지정해도 같은 이름의 다른 사람은 여전히 섞일 수 있어
        //    이 겹은 유지한다(하츠웨이브 리안 ≠ 미래소년 리안).
        let _fc=null;try{_fc=(typeof _fancamParseTitle==='function')?_fancamParseTitle(v.title):null;}catch(e){}
        const _inArtist=_fc&&_fc.artistNorm&&_fc.artistNorm.includes(' '+name.toUpperCase()+' ');
        const _hash=new RegExp('#\\s*'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(v.title||'');
        if(!_inArtist&&!_hash){weakEvidence++;break;}
        if(_isBannedVideoTitle(v.title,v.group_ko)){bannedSkipped++;break;} // ③
        if(v.tags_manual){manualSkipped++;break;}                // ⑧
        updates.push({id:v.id,patch:{group_ko:name,members:[name],with_groups:[],with_members:[]}});
        byPerson[name]=(byPerson[name]||0)+1;
        if(sample.length<40)sample.push(`[${v.content_flag}] ${info.gko}→${name}  ${(v.title||'').slice(0,62)}`);
        break;
      }
    }
    console.log('[탈퇴 솔로 귀속] 예정 표본(최대40):\n'+sample.join('\n'));
    console.log('[탈퇴 솔로 귀속] 인물별 건수:',Object.entries(byPerson).sort((a,b)=>b[1]-a[1]));
    if(!updates.length){_ytSetProg(`옮길 게 없음 — 대상 ${cands.size}명(${[...cands.keys()].join(", ")}) · ${rows.length.toLocaleString()}건 스캔. 명단이 예상과 다르면 새로고침 후 재시도(콘솔 F12에 상세)`);return;}
    const _apply=async()=>{
      await _snapshotBeforeBulk('탈퇴 후 솔로 영상 귀속',updates.map(u=>u.id));
      const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
        {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[탈퇴 솔로 귀속] ${done}/${total}건 적용 중…`)});
      if(_ub.failed)console.error('[탈퇴 솔로 귀속] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
      _ytSetProg(`완료! ${updates.length}건을 본인 이름으로 귀속함(보류/숨김 상태는 그대로). (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
    };
    const msg=`탈퇴 후 솔로 영상 ${updates.length}건을 본인 이름으로 옮길까요?\n\n`+
      `· 대상 인물 ${cands.size}명 (탈퇴 + 단일소속 + 생존 + 이름 고유 + 탈퇴일 정확)\n`+
      `· group_ko를 "옛 그룹" → "본인 이름"으로. 멤버 카드는 두 키를 합쳐 보므로 카드에선 그대로 다 보이고,\n`+
      `  옛 그룹 카드에서만 빠집니다(솔로 활동이 옛 그룹 콘텐츠로 잡히던 것 해소)\n`+
      `· content_flag는 안 건드립니다\n\n`+
      `안 건드리는 것\n`+
      `· 탈퇴 이전 영상 ${beforeLeft}건 (그 시절엔 진짜 그 그룹 콘텐츠)\n`+
      `· 저장 그룹이 그 사람의 옛 그룹이 아닌 ${wrongBase}건\n`+
      `· 근거 약함(직캠 출연자 구간·#해시태그 아님) ${weakEvidence}건 ← 같은 이름의 다른 사람 방어\n`+
      `· 밴 인물 ${bannedSkipped}건 · 수동편집 ${manualSkipped}건\n\n`+
      `⚠️ 표본 40건과 인물별 건수를 콘솔(F12)에 출력했어요 — 먼저 훑어보고 실행하세요.\n`+
      `스냅샷 저장되어 되돌리기 가능`;
    _ytSetProg(`[탈퇴 솔로 귀속] 분석 완료 — 예정 ${updates.length}건 (인물 ${Object.keys(byPerson).length}명)`);
    await new Promise(r=>setTimeout(r,50));
    if(!await _sweepConfirm('sp-exsolo-btn',`탈퇴 후 솔로 영상 귀속 ${updates.length}건`,msg,'귀속 실행',updates.length,_apply))return;
    await _apply();
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-exsolo-btn',_ytSweepExMemberSolo,'탈퇴 후 솔로 영상 귀속');

// [음악방송 직캠 재검증](2026-08-29, 사용자 요청 — "적어도 음악방송 직캠은 오태깅이 없어야") — 제목이
// _fancamParseTitle 구조([태그] 그룹 멤버 '곡명' … / 쇼챔·잇츠라이브·킬링보이스)로 잡히는 행만 골라, 구조
// 파서가 반영된 지금의 _m2ParseTitle 결과와 저장값(group_ko/members/with_*)을 비교해 어긋난 것만 바로잡는다.
// 위 _ytSweepMistagReclassify와 같은 안전장치: ① 새 그룹은 출연자 구간(또는 영문 괄호)에 literal로 있어야
// 재배정 ② tags_manual·content_flag(무관/보류/hidden/외부인) 제외 ③ owner 고정 채널(idol/fans tier)은 제외
// ④ 건수·유형별 표본을 콘솔에 먼저 출력하고 확인 후 적용 ⑤ 스냅샷 → "마지막 일괄 작업 되돌리기" 가능.
// 조회는 전량이 아니라 직캠/방송 키워드 ilike로 서버에서 걸러 받는다(Supabase egress 절약).
async function _ytSweepFancamMistag(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-fancamfix-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[직캠 재검증] 직캠 구조 제목 조회 중…');
    const KW=['*직캠*','*팬캠*','*FANCAM*','*FAN CAM*','*FACECAM*','*풀캠*','*세로캠*','*페이스캠*','*보이스캠*','*킬링보이스*','*잇츠라이브*','*MusicBank*','*Inkigayo*','*MCOUNTDOWN*','*Show Champion*','*쇼챔*','*안방1열*','*MPD*'];
    const orExpr=KW.map(k=>`title.ilike.${k}`).join(',');
    const cols='id,title,group_ko,members,with_members,with_groups,published_at,tags_manual,content_flag'+(_ytHasSourceCols?',source_tier':'');
    let{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE).select(cols).or(orExpr).order('id'));
    if(error&&/source_tier/.test(error.message||'')){_ytHasSourceCols=false;({data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE).select('id,title,group_ko,members,with_members,with_groups,published_at,tags_manual,content_flag').or(orExpr).order('id')));}
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('직캠 구조 제목이 없어요');return;}
    const EXCLUDE=new Set(['무관','보류','hidden','외부인']);
    const OWNER_TIERS=new Set(['idol','fans']);
    const same=(a,b)=>{const x=[...new Set(a||[])].sort(),y=[...new Set(b||[])].sort();return x.length===y.length&&x.every((v,i)=>v===y[i]);};
    let structured=0,manualSkipped=0,ownerSkipped=0;
    const updates=[];const sample={group:[],members:[],with:[]};
    for(let i=0;i<rows.length;i++){
      if(i%3000===0){_ytSetProg(`[직캠 재검증] 분석 중… ${i}/${rows.length} (구조 ${structured} · 후보 ${updates.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      if(v.content_flag&&EXCLUDE.has(v.content_flag))continue;
      const fc=_fancamParseTitle(v.title);
      if(!fc)continue;
      structured++;
      if(v.tags_manual){manualSkipped++;continue;}
      if(v.source_tier&&OWNER_TIERS.has(v.source_tier)){ownerSkipped++;continue;}
      let m=null;try{m=_m2ParseTitle(v.title,undefined,false,(v.published_at||'').slice(0,10));}catch(e){}
      if(!m||!m.primaryGroup)continue;
      const ng=m.primaryGroup,g=v.group_ko;
      // 강한 근거 게이트 — 새 primary가 출연자 구간(정규화) 또는 영문 괄호 구간에 literal로 있어야 함
      const gt=[ng,GROUPS[ng]&&GROUPS[ng].en,...((GROUPS[ng]&&GROUPS[ng].altNames)||[])].filter(Boolean).map(_fancamNormTok).filter(Boolean);
      const literal=gt.some(t=>fc.artistNorm.includes(' '+t+' ')||(fc.enNorm&&fc.enNorm.includes(' '+t+' ')));
      if(!literal)continue;
      const members=(m.membersByGroup[ng]||[]);
      let withGroups=[],withMembers=[];
      (m.withGroups||[]).forEach(og=>{const{asGroup,extraMembers}=_classifyGuestGroup(m.membersByGroup[og]||[],og);if(asGroup)withGroups.push(og);extraMembers.forEach(mko=>withMembers.push(`${mko}(${og})`));});
      ({withGroups,withMembers}=_normalizeMemberTags({title:v.title,groupKo:ng,members,withGroups,withMembers})); // 겸임 중복 제거
      const patch={};const kinds=[];
      if(ng!==g){patch.group_ko=ng;patch.members=members;patch.with_groups=withGroups;patch.with_members=withMembers;kinds.push('group');}
      else{
        if(!same(members,v.members)){patch.members=members;kinds.push('members');}
        if(!same(withGroups,v.with_groups)||!same(withMembers,v.with_members)){patch.with_groups=withGroups;patch.with_members=withMembers;kinds.push('with');}
      }
      if(!kinds.length)continue;
      updates.push({id:v.id,patch,kinds});
      const line=`#${v.id} [${g}→${ng}] m:${JSON.stringify(v.members||[])}→${JSON.stringify(members)} w:${JSON.stringify(v.with_groups||[])}/${JSON.stringify(v.with_members||[])}→${JSON.stringify(withGroups)}/${JSON.stringify(withMembers)} | ${(v.title||'').slice(0,70)}`;
      kinds.forEach(k=>{if(sample[k].length<60)sample[k].push(line);});
    }
    const nG=updates.filter(u=>u.kinds.includes('group')).length,nM=updates.filter(u=>u.kinds.includes('members')).length,nW=updates.filter(u=>u.kinds.includes('with')).length;
    console.log(`[직캠 재검증] 키워드 조회 ${rows.length} · 구조 인식 ${structured} · 수동보호 ${manualSkipped} · owner채널 제외 ${ownerSkipped} · 정정 후보 ${updates.length} (그룹 ${nG} / 멤버 ${nM} / 콜라보 ${nW})`);
    console.log('[직캠 재검증] 그룹 재배정 표본:\n'+sample.group.join('\n'));
    console.log('[직캠 재검증] 멤버 정정 표본:\n'+sample.members.join('\n'));
    console.log('[직캠 재검증] 콜라보 정정 표본:\n'+sample.with.join('\n'));
    if(!updates.length){_ytSetProg(`직캠 구조 ${structured}건 검사 — 정정할 오태깅 없음${manualSkipped?` (수동보호 ${manualSkipped})`:''}`);return;}
    if(!await _sweepConfirmSimple("음악방송 직캠 재검증","정정 실행",`음악방송 직캠 재검증 — ${updates.length}건 정정할까요?\n\n· 그룹 재배정 ${nG} / 멤버 정정 ${nM} / 콜라보 정정 ${nW}\n· 구조 인식 ${structured}건 중, 새 그룹이 출연자 구간에 literal로 있는 것만\n· 수동편집 ${manualSkipped}건 · owner 고정 채널 ${ownerSkipped}건 자동 제외\n· 유형별 표본(최대 60)을 콘솔(F12)에 출력함 — 먼저 확인 권장\n· 스냅샷 저장되어 "마지막 일괄 작업 되돌리기"로 복구 가능`)){
      _ytSetProg(`취소됨 — 미리보기만 (정정 후보 ${updates.length}건, 표본 콘솔).`);return;
    }
    await _snapshotBeforeBulk('음악방송 직캠 재검증',updates.map(u=>u.id));
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[직캠 재검증] ${done}/${total}건 적용 중…`)});
    if(_ub.failed)console.error('[직캠 재검증] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! 직캠 ${updates.length}건 정정 (그룹 ${nG} / 멤버 ${nM} / 콜라보 ${nW}). (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-fancamfix-btn',_ytSweepFancamMistag,'직캠 재검증');

// [숨김 목록 재판정](2026-08-27) — 위 _ytSweepMistagReclassify가 content_flag 있는 행을 통째로
// 제외(EXCLUDE)해서, **숨김 처리된 오태깅은 어떤 스윕으로도 영원히 안 닿는 사각지대**였다.
// 실측: hidden 2,822건(tags_manual=false) 중 지금 매처로 같은 그룹이 나오는 건 417건뿐이고,
// 나머지는 짧은 이름 게이트(a.name.ko 1음절 → 해시태그 전용)가 들어오기 **전에** 쌓인 오매칭이었다.
//   더보이즈 "뉴"(NEW) → "THE NEW SIX"·"New York"·"Brand New"
//   스트레이키즈 "한"(HAN) · 세븐틴 "준"(JUN) · 스테이씨 "윤"(YOON) → 강승윤·윤두준·윤보미…
// 그래서 이건 "숨김을 푸는" 버튼이 아니라 **"옛 판정을 지금 판정으로 갈아끼우는"** 버튼이다.
//
// ⚠️ 2026-08-20에 신뢰도 재스캔 버튼이 정상영상 35,168건을 대량 오숨김시킨 사고가 있었다. 그래서
//    _ytSweepMistagReclassify가 쓰던 안전장치를 **그대로** 가져왔다(약한 추론으론 절대 안 옮김):
//    ① 새 그룹명이 제목에 literal로 있어야만 재배정 ② 콜라보/커버 신호 있으면 제외(원태그가 맞을 수
//    있음) ③ tags_manual=true 제외 ④ 스냅샷 후 적용(되돌리기 가능) ⑤ confirm 취소 시 미리보기만.
// 무매칭분을 '무관'이 아니라 '보류'로 보내는 이유: 매처가 못 잡는 것과 우주 밖인 것은 다르다.
// 실제로 무매칭 990건에 "THE NEW SIX - FUEGO | Show! MusicCore"처럼 **실존 그룹인데 아직 못 잡는**
// 것이 섞여 있어서, 무관으로 밀면 영영 안 보인다. 보류는 카드에서 빠지되 검수 목록에 남는다.
async function _ytSweepHiddenRejudge(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-hidden-rejudge-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[숨김 재판정] 숨김 목록 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,published_at')
      .eq('content_flag','hidden')
      .eq('tags_manual',false) // 사람이 직접 숨긴 건 절대 안 건드림(프로젝트 헌법)
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('재판정할 숨김 영상이 없어요');return;}
    // 판정 보조 함수는 _ytSweepMistagReclassify와 글자 그대로 같은 것을 쓴다 — 둘이 갈라지면
    // "재배정 버튼은 옮기는데 재판정 버튼은 안 옮기는" 식의 조용한 불일치가 생긴다.
    const _grpToks=ko=>{const v=GROUPS[ko];return v?[ko,v.en,...(v.altNames||[])].filter(Boolean).map(t=>t.toUpperCase()):[];};
    const _norm=t=>' '+(t||'').toUpperCase().replace(/[^가-힣A-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';
    const _titleHas=(nu,ko)=>_grpToks(ko).some(t=>nu.includes(t));
    const COLLAB=/with |w\/| feat| ft[ .]|선배|챌린지|challenge|원곡| cover|커버|＆| & |함께|출연|게스트|guest| vs | x /i;
    const moves=[],holds=[];let same=0,weak=0,collab=0;
    const sMove=[],sHold=[];
    for(let i=0;i<rows.length;i++){
      if(i%2000===0){_ytSetProg(`[숨김 재판정] 분석 중… ${i}/${rows.length} (재배정 ${moves.length} · 보류 ${holds.length})`);await new Promise(r=>setTimeout(r));}
      const v=rows[i];
      let m=null;try{m=_m2ParseTitle(v.title,undefined,false,(v.published_at||'').slice(0,10));}catch(e){}
      const ng=m&&m.primaryGroup;
      if(!ng){ // 아무 그룹도 안 잡힘 → 숨김 유지가 아니라 보류로(검수 목록에 올린다)
        holds.push(v.id);
        if(sHold.length<40)sHold.push(`[${v.group_ko}] ${(v.title||'').slice(0,64)}`);
        continue;
      }
      if(ng===v.group_ko){same++;continue;}                    // 판정 근거 유지 → 손대지 않음
      const nu=_norm(v.title);
      if(!_titleHas(nu,ng)){weak++;continue;}                  // 약한 추론 → 안 옮김
      if(COLLAB.test(v.title||'')){collab++;continue;}         // 콜라보/커버 → 원태그가 맞을 수 있음
      const members=(m.membersByGroup&&m.membersByGroup[ng])||[];
      const wgs=m.withGroups||[];
      const wms=[];wgs.forEach(x=>((m.membersByGroup&&m.membersByGroup[x])||[]).forEach(mm=>wms.push(`${mm}(${x})`)));
      moves.push({id:v.id,patch:{group_ko:ng,members,with_groups:wgs,with_members:wms,..._flagPatch(null,'auto')}});
      if(sMove.length<40)sMove.push(`[${v.group_ko}→${ng}] ${(v.title||'').slice(0,60)}`);
    }
    console.log(`[숨김 재판정] 재배정 예정 표본(최대40):\n${sMove.join('\n')}\n\n[숨김 재판정] 보류 이동 표본(최대40):\n${sHold.join('\n')}`);
    if(!moves.length&&!holds.length){_ytSetProg(`옮길 것 없음 (숨김 ${rows.length}건 중 판정 동일 ${same}, 약한추론 ${weak}, 콜라보 ${collab})`);return;}
    if(!await _sweepConfirmSimple("숨김 재판정","적용",`숨김 ${rows.length}건을 지금 매처로 재판정한 결과예요.\n\n· 다른 그룹으로 재배정 + 숨김 해제 : ${moves.length}건\n   (제목에 그 그룹명이 literal로 있는 것만)\n· 아무 그룹도 안 잡혀 '보류'로 이동 : ${holds.length}건\n   (무관 아님 — 카드에선 빠지되 검수 목록에 남음)\n\n· 판정 그대로라 손 안 댐 ${same}건 / 약한추론 제외 ${weak}건 / 콜라보·커버 제외 ${collab}건\n· 표본 각 40건을 콘솔(F12)에 출력했어요 — 먼저 확인 권장\n· 스냅샷 저장되어 "↩︎ 마지막 일괄 작업 되돌리기"로 복구 가능\n\n적용할까요?`)){
      _ytSetProg(`취소됨 — 미리보기만 (재배정 ${moves.length} · 보류 ${holds.length}, 표본 콘솔).`);return;
    }
    await _snapshotBeforeBulk('숨김 목록 재판정',[...moves.map(u=>u.id),...holds]);
    {
      const _ub=await _sbUpdateBatch(moves,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
        {conc:20,retries:2,onProgress:(d,t)=>_ytSetProg(`[숨김 재판정] 재배정 ${d}/${t}건…`)});
      if(_ub.failed)console.error('[숨김 재판정] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    }
    for(let i=0;i<holds.length;i+=200){
      const{error:ue}=await sb.from(_YT_TABLE).update(_flagPatch('보류','auto')).in('id',holds.slice(i,i+200));
      if(ue)throw new Error(ue.message);
      _ytSetProg(`[숨김 재판정] 보류 이동 ${Math.min(i+200,holds.length)}/${holds.length}건…`);
    }
    _vmCache&&_vmCache.clear&&_vmCache.clear(); // 영상관리 패널 탭 캐시가 옛 목록을 들고 있지 않도록
    try{_vmIdbClear();}catch(_){}               // 디스크(IndexedDB) 캐시도 같이 — 안 그러면 새로고침 후 부활
    _ytSetProg(`완료! 재배정 ${moves.length}건 · 보류 이동 ${holds.length}건 (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
_admExecBind('sp-hidden-rejudge-btn',_ytSweepHiddenRejudge,'숨김 재판정');
// [원곡 소급 재분류 2차](2026-08-23): 커버 키워드는 없지만 "타소속사 + 10년 이상 선배" with 태그 —
// 후배가 선배 명곡을 커버한 케이스가 압도적(CSV 실측: 방탄→라이즈·S.E.S.→앤팀·핑클→보넥도 등 408건).
// 1차(키워드+6년)가 못 잡는 무키워드 원곡을 cover_of로. ⚠️ 진짜 콜라보 위험은 대부분 "같은 소속사"(가족
// 콜라보)에 몰려 있어 그건 제외, 제목에 합동/페스티벌 키워드 있는 것도 제외. 1차와 동일한 안전장치.
// 잠금-빈값 멤버 채우기(2026-08-23) — tags_manual=true 로 잠겼는데 members가 빈 직캠들을 자동태깅과 동일한
// 매처로 채운다. 왜 이런 행이 생기나: tags_manual=true는 오직 관리자 액션(태그모달 저장·벌크작업)에서만
// 설정되는데, category 등 "멤버가 아닌" 필드를 벌크 변경할 때 쓰는 트리거 우회 two-step(해제→수정→재잠금)
// 에서 members는 원래 []인 채 그대로 다시 잠겨버림 — 인제스트(_extBuildRows)는 tags_manual을 안 건드리므로
// 이 잠금은 "관리자가 일부러 멤버를 비운 것"이 아니라 벌크작업의 부수효과다. 그 결과 자동태깅이 잠금을
// 존중해 영영 스킵 → 아이칠린 이지/지윤, 러블리즈 JIN, 엔싸인 멤버 등 수백 건이 solo 0으로 남아있었음
// (2026-08-23 라이브 solo 전수 스캔에서 잠금-빈값 297건/42명으로 측정). 자동태깅과 유일하게 다른 점은
// 대상이 tags_manual=true라는 것뿐이고, 매칭 근거(_atmResolveMembers)·게이트(단일음절·흔한단어·별칭)는
// 100% 동일. 콜라보 흔적(with_members/with_groups)이 있는 행은 솔로가 아니므로 제외. 쓰기는 편집 모달과
// 똑같이 잠금 해제→members 세팅→재잠금(스냅샷으로 되돌리기 가능).
async function _ytSweepFillLockedEmpty(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-lockfill-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[잠금-빈값 채우기] 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,with_groups,published_at')
      .eq('tags_manual',true)
      .or('members.eq.{},members.is.null')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 잠금-빈값 영상이 없어요');return;}
    // 솔로 후보만: members 비었고 콜라보 흔적도 없는 행
    const cands=rows.filter(v=>!v.members?.length&&!v.with_members?.length&&!v.with_groups?.length);
    if(!cands.length){_ytSetProg(`잠금-빈값 솔로 후보 없음 (조회 ${rows.length}건).`);return;}
    // description은 매칭에 필요한 후보 행만 가볍게 별도 조회(egress 절약 — 자동태깅과 동일 정책)
    const descById=new Map();
    const ids=cands.map(v=>v.id);
    for(let i=0;i<ids.length;i+=500){
      const{data:dr,error:de}=await sb.from(_YT_TABLE).select('id,description').in('id',ids.slice(i,i+500));
      if(de){console.error('[잠금-빈값] description 조회 실패:',de.message);continue;}
      (dr||[]).forEach(r=>descById.set(r.id,r.description));
    }
    // 그룹별 로스터 캐시 — 자동태깅(_ytAutoTagMembers)과 동일 구성(_artistGroups로 겸임 포함, left/aliases 유지)
    const rosterCache=new Map();
    const rosterOf=gko=>{
      if(rosterCache.has(gko))return rosterCache.get(gko);
      const r=_atmRosterFor(gko);
      rosterCache.set(gko,r);return r;
    };
    // 흔한 영단어와 겹치는 이름(온리원오프 Love 등)은 곡 제목의 그 단어에 오매칭될 수 있어, 단독으로만
    // 잡히면 자동채움에서 빼고 수동확인 목록(콘솔)으로 돌린다 — 99.99% 목표상 새 오태깅 유발 방지.
    const _RISKY_EN=new Set(['love','rise','sun','star','baby','angel','king','queen','prince','one','win','wish','joy','hope','sky','moon','luna','ace','max']);
    const updates=[];const samples=[];const riskyManual=[];
    cands.forEach(v=>{
      const roster=rosterOf(v.group_ko);
      if(!roster.length)return;
      const hit=_atmResolveMembers(v.title||'',descById.get(v.id),roster,v.group_ko,v.published_at);
      if(!hit.length)return;
      const members=[...new Set(hit)];
      if(members.length===1&&_RISKY_EN.has(String(members[0]).toLowerCase().replace(/[^a-z]/g,''))){
        riskyManual.push({id:v.id,group_ko:v.group_ko,멤버후보:members[0],title:(v.title||'').slice(0,58)});
        return;
      }
      updates.push({id:v.id,members});
      if(samples.length<30)samples.push({group_ko:v.group_ko,채울멤버:members,title:(v.title||'').slice(0,58)});
    });
    if(riskyManual.length)console.log(`[잠금-빈값 채우기] 흔한영단어 단독매칭 ${riskyManual.length}건은 자동채움 제외(곡 제목 오매칭 위험) — 직접 확인:`,riskyManual);
    console.log(`[잠금-빈값 채우기] 후보 ${updates.length}건 (전체 잠금-빈값 ${cands.length}건 중) 샘플:`,samples);
    if(!updates.length){_ytSetProg(`채울 것 없음 — 잠금-빈값 ${cands.length}건 중 확정 매칭 0 (진짜 소스없음/모호).`);return;}
    if(!confirm(`잠금(tags_manual=true)인데 members가 비어있던 영상 ${updates.length}건에 멤버를 채울까요?\n\n· 자동태깅과 동일 매처로 자기 그룹 멤버 확정 매칭된 것만 (단일음절·흔한단어·별칭 게이트 동일)\n· 콜라보 흔적 있는 행은 제외 (솔로만)\n· 잠금은 유지: 해제→채움→재잠금\n· 스냅샷 저장돼 되돌리기 가능 · 샘플 ${samples.length}건 콘솔`))
      {_ytSetProg(`취소됨 — 미리보기만 (채울 예정 ${updates.length}건, 콘솔 샘플).`);return;}
    await _snapshotBeforeBulk('잠금-빈값 멤버 채우기',updates.map(u=>u.id));
    // DB 트리거 우회 two-step(편집 모달과 동일): tags_manual=true라 그냥은 members 변경이 막힘
    // two-step을 동시요청 제한+재시도로 안전하게(Failed to fetch 방지) — 전 항목 1단계(멤버 채우고 잠금
    // 해제) 후 전 항목 2단계(다시 잠금). 각 행의 1→2 순서는 유지된다.
    const _u1=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update({members:u.members,tags_manual:false}).eq('id',u.id),
      {conc:20,retries:2,onProgress:(d,t)=>_ytSetProg(`[잠금-빈값 채우기] ${d}/${t}건 (1/2단계)`)});
    const _u2=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update({tags_manual:true}).eq('id',u.id),
      {conc:20,retries:2,onProgress:(d,t)=>_ytSetProg(`[잠금-빈값 채우기] ${d}/${t}건 (2/2단계)`)});
    if(_u1.failed||_u2.failed)console.error('[잠금-빈값 채우기] 재시도 후에도 실패:',_u1.failed,'/',_u2.failed,'—',_u1.firstErr||_u2.firstErr);
    _ytSetProg(`완료! 잠금-빈값 ${updates.length}건에 멤버를 채웠어요(잠금 유지).`+(riskyManual.length?` 흔한영단어 ${riskyManual.length}건은 수동확인(콘솔).`:'')+` 카드 라이브 only 탭 확인해보세요.`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
// 고아 태그 정정(2026-08-23) — members/with_members에 "정식명(name.ko)이 아닌데 그 그룹에서 알려진
// 별칭/표시명"으로 태깅된 고아 태그(여정→전여여정, 홍의진→의진 등)를 정식명으로 재태깅한다. 이런 고아는
// 외부채널 태깅(_m2ParseTitle이 활동명으로 매칭)이나 병합 이전 데이터에서 생기며, 카드는 정식명으로만
// 영상을 모으므로 고아 이름 태그는 어느 카드에도 안 떠서 사라진다. 사람은 그대로 두고 이름 형태만 바꾸는
// 순수 정규화라 matchAliases·groups[].name 오버라이드로 확실히 아는 것만 매핑해 안전(모르는 고아는
// 동명이인일 수 있어 손대지 않고 콘솔 리뷰로만 — 별칭 추가하면 다음 실행에서 정정됨).
async function _ytSweepCanonicalizeMembers(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-canon-btn');
  if(btn)btn.disabled=true;
  try{
    const CANON=new Set();
    ARTISTS.forEach(a=>{const c=a.name&&a.name.ko;if(c)CANON.add(c);});
    const MAP=new Map(); // `${gko}|${form}` → 정식명
    ARTISTS.forEach(a=>{
      const canon=a.name&&a.name.ko;if(!canon)return;
      const gkos=_artistGroups(a).map(g=>g.ko);
      (a.matchAliases||[]).forEach(al=>{if(al&&al!==canon)gkos.forEach(g=>MAP.set(`${g}|${al}`,canon));});
      (a.groups||[]).forEach(g=>{if(g&&g.name&&g.name!==canon)MAP.set(`${g.ko}|${g.name}`,canon);});
    });
    _ytSetProg('[고아태그 정정] 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,group_ko,members,with_members,tags_manual')
      .or('members.neq.{},with_members.neq.{}').order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');return;}
    const remap=(name,gko)=>CANON.has(name)?name:(MAP.get(`${gko}|${name}`)||name);
    const updates=[];const samples=[];const orphanUnknown=new Map();
    rows.forEach(v=>{
      const gko=v.group_ko;
      const curM=v.members||[],curWM=v.with_members||[];
      const newM=curM.map(m=>remap(m,gko));
      const newWM=curWM.map(wm=>{const mm=wm.match(/^(.+)\((.+)\)$/);if(!mm)return wm;const nm=remap(mm[1],mm[2]);return nm===mm[1]?wm:`${nm}(${mm[2]})`;});
      const mChanged=newM.some((m,i)=>m!==curM[i]);
      const wmChanged=newWM.some((m,i)=>m!==curWM[i]);
      curM.forEach(m=>{if(!CANON.has(m)&&!MAP.get(`${gko}|${m}`))orphanUnknown.set(`${gko}|${m}`,(orphanUnknown.get(`${gko}|${m}`)||0)+1);});
      if(!mChanged&&!wmChanged)return;
      const patch={};
      if(mChanged)patch.members=[...new Set(newM)];
      if(wmChanged)patch.with_members=[...new Set(newWM)];
      updates.push({id:v.id,patch,locked:!!v.tags_manual});
      if(samples.length<30)samples.push({group_ko:gko,before:curM,after:patch.members||curM,title:(v.title||'').slice(0,45)});
    });
    const orphanList=[...orphanUnknown.entries()].map(([k,c])=>({key:k,count:c})).sort((a,b)=>b.count-a.count);
    console.log('[고아태그 정정] 재태깅 샘플:',samples);
    console.log(`[고아태그 정정] 미매핑 고아(동명이인 의심 — 손 안 댐, 별칭 추가하면 다음번 정정) ${orphanList.length}종:`,orphanList.slice(0,40));
    if(!updates.length){_ytSetProg(`정정할 고아태그 없음. 미매핑 고아 ${orphanList.length}종은 콘솔(별칭 추가 대상).`);return;}
    const lockedCnt=updates.filter(u=>u.locked).length;
    if(!await _sweepConfirmSimple("고아 태그 정정","정정 실행",`정식명이 아닌 별칭/표시명으로 태깅된 고아 태그 ${updates.length}건을 정식명으로 정정할까요?\n\n· 여정→전여여정, 홍의진→의진처럼 "같은 사람, 이름형태만" 정정\n· matchAliases·groups[].name으로 확실히 아는 것만 (모르는 고아 ${orphanList.length}종은 손 안 댐)\n· 잠금행 ${lockedCnt}건은 해제→정정→재잠금\n· 스냅샷 저장돼 되돌리기 가능 · 샘플 콘솔`))
      {_ytSetProg(`취소됨 — 미리보기만 (정정 예정 ${updates.length}건).`);return;}
    await _snapshotBeforeBulk('고아태그 정정(별칭→정식명)',updates.map(u=>u.id));
    // two-step을 동시요청 제한+재시도로(Failed to fetch 방지). 1단계: 전 항목(잠금행은 해제하며 정정),
    // 2단계: 잠금행만 재잠금. 각 잠금행의 1→2 순서는 유지된다.
    const _relock=updates.filter(u=>u.locked);
    const _u1=await _sbUpdateBatch(updates,u=>u.locked
      ? sb.from(_YT_TABLE).update({...u.patch,tags_manual:false}).eq('id',u.id)
      : sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(d,t)=>_ytSetProg(`[고아태그 정정] ${d}/${t}건 처리 중…`)});
    const _u2=_relock.length?await _sbUpdateBatch(_relock,u=>sb.from(_YT_TABLE).update({tags_manual:true}).eq('id',u.id),{conc:20,retries:2}):{failed:0,firstErr:''};
    if(_u1.failed||_u2.failed)console.error('[고아태그 정정] 재시도 후에도 실패:',_u1.failed,'/',_u2.failed,'—',_u1.firstErr||_u2.firstErr);
    _ytSetProg(`완료! 고아태그 ${updates.length}건을 정식명으로 정정(잠금 ${lockedCnt}건 유지). 미매핑 고아 ${orphanList.length}종은 콘솔(별칭 추가 대상).`);
  }catch(e){_ytSetProg('오류: '+e.message);}
  finally{if(btn)btn.disabled=false;}
}
async function _ytSweepAmbiguousCollabMistag(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-collabfix-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[콜라보 오태깅 재검증] 조회 중…');
    // tags_manual 필터를 조회 단계에서 빼고 여기서 나눠 처리한다 — 예전엔 .eq('tags_manual',false)로
    // 아예 안 봐서, "근거 없는 태그가 실제로 몇 개나 있는지"조차 알 수 없었음. 수동 편집 행은 여전히
    // 절대 안 고치지만(아래 updates에 안 넣음), 몇 개나 걸렸는지는 세서 보여준다 — 관리자가 그 행들이
    // 진짜 원인인지 직접 확인할 수 있게(2026-08-05, 사용자 제보 — "재검증 눌러도 오염 없다는데 실제로는
    // 드림캐쳐 지유 영상에 키키 지유가 계속 남아있다"는 사례로 발견. 그 영상들이 tags_manual=true라
    // 재검증 조회 대상에서부터 빠져있었을 가능성이 높음).
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,description,group_ko,with_members,with_groups,tags_manual,published_at')
      .or('with_members.neq.{},with_groups.neq.{}')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');return;}
    const updates=[];
    let manualSkipped=0;
    // 콜라보 태그가 완전히 다 빠지는 행 — 위 _ytSweepMembersMistag와 동일 이유로 자동 무관 처리는 안 하고
    // 목록만 콘솔에 남긴다(2026-08-19, 사용자 요청).
    const wipedOut=[];
    rows.forEach(v=>{
      // 판정은 _collabRejudge 하나로 통일 — 미리보기와 실제가 갈라져서 "미리보기가 지운다고 한 게
      // 실제로는 안 지워지는(그 반대도)" 상태였다(2026-08-26 수정, 그 함수 주석 참고).
      const j=_collabRejudge(v);
      if(!j.changed)return;
      if(v.tags_manual){manualSkipped++;return;} // 수동 편집 행은 절대 안 고침 — 대신 개수만 집계
      updates.push({id:v.id,patch:j.patch});
      if(j.wiped)wipedOut.push({id:v.id,title:v.title,removedGroups:j.curWG,removedMembers:j.curWM});
    });
    if(!updates.length){
      _ytSetProg(`검사 완료 — ${rows.length}개 중 오염 없음`+(manualSkipped?` (단, 수동 편집이라 건드리지 않고 넘어간 것 ${manualSkipped}개 있음 — 직접 확인 필요)`:''));
      return;
    }
    if(wipedOut.length){
      console.log(`[콜라보 오태깅 재검증] 콜라보 태그가 전부 빠진 행 ${wipedOut.length}개 — 무관 콘텐츠인지 직접 확인 필요:`,wipedOut);
    }
    // (전체) 버튼 규칙(설정패널 개선 4): 확인창. 단 데일리 루틴이 부를 땐 skip(다이얼로그로 멈추면 안 됨).
    if(updates.length&&!_admRoutineRunning&&typeof _confirmDialog==='function'&&!(await _confirmDialog({title:'콜라보 오태깅 재검증 (전체)',msg:`기존 콜라보 태그 <b>${updates.length}건</b>을 최신 로직으로 재검증·정리해요. 수동태그는 보호되고, 되돌리기 스냅샷을 떠둬요.`,okLabel:'재검증 실행',wide:true})))return;
    await _snapshotBeforeBulk('콜라보 오태깅 재검증(전체)',updates.map(u=>u.id));
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[콜라보 오태깅 재검증] ${done}/${total}개 처리 중…`)});
    if(_ub.failed)console.error('[콜라보 오태깅 재검증] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! ${rows.length}개 중 ${updates.length}개에서 근거 없는 콜라보 태그 제거함`+(wipedOut.length?` (그중 ${wipedOut.length}개는 태그가 전부 빠짐 — 콘솔 확인 필요)`:'')+(manualSkipped?` (수동 편집이라 안 건드리고 넘어간 것 ${manualSkipped}개 — 직접 확인 필요)`:''));
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// 지유/키키 사례를 "지유"라는 이름 하나에만 국한하지 않고, 로스터 전체의 동명이인(같은 name.ko를 쓰는
// 서로 다른 그룹 멤버) 쌍 전부에 대해 같은 패턴(group_ko가 A인데 with_members에 동명이인의 B 표기가
// 걸린 행)을 훑는 범용 스캔 — 외부 채널 동기화가 selfGko 없이 이름만으로 group_ko를 잘못 결정했던
// 과거 오염을 이름 하나하나 수동 발견하지 않고 한 번에 찾기 위함(2026-08-05, 사용자 요청 — "이런
// 동명이인 문제가 많을 듯, 근본적으로 바로잡을 대책 필요"). _m2ParseTitle 자체의 재발 방지(동명이인
// 충돌을 selfGko로 못 가르면 양쪽 다 버림)는 이미 적용돼있어 새로 동기화되는 영상엔 안 생기고, 이건
// 그 전에 이미 들어간 기존 행만 정리하는 스캔이다.
// 판정 기준: 제목에 "재배정 대상 그룹" 이름/영문명만 있고 "현재 배정된 그룹" 이름/영문명은 없으면
// 확실한 오배정으로 보고 자동 재배정. 둘 다 있거나 둘 다 없으면(제목만으론 못 가르는 진짜 애매한 경우)
// 건드리지 않고 콘솔에 목록만 남긴다 — 잘못 재배정하는 것보다 애매한 채로 두는 게 안전함.
// tags_manual=true(수동 편집) 행은 확신도와 무관하게 무조건 손대지 않는다 — 지유/키키 단일 케이스 때는
// 우회해도 되는지 그때그때 확인받았지만, 이건 로스터 전체 동명이인 쌍을 한꺼번에 훑는 훨씬 넓은 범위라
// 수동편집분은 전부 건드리지 말고 확인 목록에만 넣어달라는 요청(2026-08-05).
async function _ytScanAmbiguousNameGroupMisassignment(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-scan-namecollide-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[동명이인 그룹 오배정 스캔] 동명이인 목록 계산 중…');
    const nameToGroups=new Map();
    ARTISTS.forEach(a=>{
      if(!nameToGroups.has(a.name.ko))nameToGroups.set(a.name.ko,new Set());
      nameToGroups.get(a.name.ko).add(a.group.ko);
    });
    const collisions=[...nameToGroups.entries()].filter(([,gkos])=>gkos.size>1);
    if(!collisions.length){_ytSetProg('동명이인 자체가 없어요');return;}
    const mentions=(t,gko)=>{
      const info=GROUPS[gko]||{};
      return[gko,info.en,...(info.altNames||[])].filter(Boolean).some(tok=>new RegExp(_atmEscRe(tok),'i').test(t||''));
    };
    let pairsChecked=0,rowsFound=0,fixed=0,manualSkipped=0,failed=0;
    const ambiguous=[];
    for(const[name,gkoSet]of collisions){
      const gkos=[...gkoSet];
      for(let i=0;i<gkos.length;i++){
        for(let j=0;j<gkos.length;j++){
          if(i===j)continue;
          const homeGko=gkos[i],otherGko=gkos[j];
          const crossTag=`${name}(${otherGko})`;
          pairsChecked++;
          _ytSetProg(`[동명이인 그룹 오배정 스캔] ${pairsChecked}/${collisions.length*2}쌍 확인 중… (지금까지 ${fixed}개 재배정)`);
          const{data:rows,error}=await sb.from(_YT_TABLE)
            .select('id,title,group_ko,members,with_members,tags_manual')
            .eq('group_ko',homeGko)
            .contains('with_members',[crossTag]);
          if(error||!rows?.length)continue;
          for(const v of rows){
            rowsFound++;
            if(v.tags_manual){manualSkipped++;continue;} // 확신도 상관없이 무조건 스킵
            const hasHome=mentions(v.title,homeGko),hasOther=mentions(v.title,otherGko);
            if(!(hasOther&&!hasHome)){ambiguous.push({id:v.id,title:v.title,homeGko,otherGko});continue;}
            const newWithMembers=(v.with_members||[]).filter(m=>m!==crossTag);
            const patch={group_ko:otherGko,members:[name],with_members:newWithMembers};
            try{
              const{error:e}=await sb.from(_YT_TABLE).update(patch).eq('id',v.id);
              if(e)throw e;
              fixed++;
            }catch(e){console.error('[동명이인 그룹 오배정 스캔] 실패',v.id,e.message);failed++;}
          }
        }
      }
    }
    if(ambiguous.length){console.log('[동명이인 그룹 오배정 스캔] 애매해서 안 건드린 목록:',ambiguous);}
    _ytSetProg(`완료! 동명이인 ${collisions.length}개, 발견된 오배정 후보 ${rowsFound}개 중 ${fixed}개 자동 재배정`+
      (manualSkipped?`, 수동편집이라 안 건드리고 넘어간 것 ${manualSkipped}개(직접 확인 필요)`:'')+
      (ambiguous.length?`, 제목만으론 판단 안 되는 애매한 것 ${ambiguous.length}개(콘솔에 목록 출력함, 직접 확인 필요)`:'')+
      (failed?` — 실패 ${failed}개(콘솔 확인)`:''));
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// _ytSweepAmbiguousCollabMistag와 같은 계열이지만 with_members/with_groups(다른 그룹 콜라보)가 아니라
// members(자기 채널 자체 출연자) 컬럼을 재검증한다 — "이유"(에버글로우)처럼 흔한 단어와 겹치는 이름이
// _ATM_HASHTAG_ONLY_NAMES에 새로 추가되면, 이미 members에 평문 매칭으로 잘못 들어간 값은 이걸로 걷어낸다.
// _ytAutoTagMembers는 members가 "비어있는" 행만 채우므로 이미 채워진(오염된) 행은 절대 건드리지 않음 —
// 그래서 별도 재검증 스윕이 필요함. tags_manual=true(관리자 직접 저장)는 여기서도 절대 안 건드림.
// ── 편집 모달 오태깅 규칙 등록 + 이름 한정 재검증(2026-08-30) ────────────────────────────────
// 흔한단어 보호(_ATM_DYNAMIC_HASHTAG_NAMES ← name_match_whitelist)는 유일하게 UI 추가 경로가 없어(스캔 화면
// 제거 후 SQL 전용) 오태깅이 계속 쌓였다. 이제 연필(편집) 모달에서 잘못 붙은 이름 옆 ⚑로 그 자리에서 규칙을
// 등록하고, 곧바로 그 이름이 평문으로 붙은 다른 자동태깅 행을 한정 재검증해 기존 오염까지 같이 정리한다.
// 이름은 실제 로스터(ARTISTS)에 있는 등록명만 허용 — 유령 항목('JIN' 같은 죽은 규칙) 방지.
async function _atmRegisterHashtagName(name){
  if(!sb)return{ok:false,msg:'Supabase 연결 없음'};
  name=(name||'').trim();
  if(!name)return{ok:false,msg:'이름이 비었어요'};
  const exists=ARTISTS.some(a=>a.name.ko===name||(a.name.en&&a.name.en.toLowerCase()===name.toLowerCase()));
  if(!exists)return{ok:false,msg:`"${name}"은(는) 등록된 멤버 이름이 아니에요 — 정확한 등록명으로만 규칙을 만들 수 있어요.`};
  if(_ATM_HASHTAG_ONLY_NAMES.has(name)||_ATM_DYNAMIC_HASHTAG_NAMES.has(name))return{ok:true,already:true};
  const{error}=await sb.from('name_match_whitelist').insert({name});
  if(error&&!/duplicate|unique/i.test(error.message||''))return{ok:false,msg:'추가 실패: '+error.message};
  _ATM_DYNAMIC_HASHTAG_NAMES.add(name);
  return{ok:true};
}
// 이름 한정 멤버 재검증 — _ytSweepMembersMistag(전체)와 같은 로직·안전장치(스냅샷·수동보호·200배치)를 members에
// 그 이름이 든 자동태깅 행으로만 좁혀 돌린다. 규칙 등록 직후 기존 오염을 그 이름에 한해 즉시 정리하는 용도.
async function _atmScopedMemberReverify(name){
  if(!sb)return;
  _ytSetProg(`["${name}" 재검증] 조회 중…`);
  const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
    .select('id,title,description,group_ko,members,published_at')
    .eq('tags_manual',false).contains('members',[name]).order('id'));
  if(error){_ytSetProg('조회 실패: '+error.message);return;}
  if(!rows?.length){_ytSetProg(`"${name}"이(가) 자동 태깅된 영상이 없어요`);return;}
  const updates=[];const wiped=[];
  rows.forEach(v=>{
    const roster=_atmRosterFor(v.group_ko);
    if(!roster.length)return;
    const validSet=new Set(_atmResolveMembers(v.title,v.description,roster,v.group_ko,v.published_at));
    const curM=v.members||[];
    const newM=curM.filter(mko=>validSet.has(mko));
    if(newM.length!==curM.length){updates.push({id:v.id,patch:{members:newM}});if(!newM.length)wiped.push({id:v.id,removed:curM});}
  });
  if(!updates.length){_ytSetProg(`검사 완료 — "${name}" 관련 근거없는 태그 없음 (${rows.length}개 확인)`);return;}
  if(!confirm(`"${name}"이(가) 근거 없이(평문 매칭) 붙은 영상 ${updates.length}개에서 이 이름을 뺄까요?\n\n· 자동 태깅(tags_manual=false)만 · 스냅샷 저장되어 되돌리기 가능\n· 그룹 배정까지 틀린 경우(예: group_ko가 이 이름 때문에 잘못 정해진 것)는 "② 오태깅 그룹 재배정"을 따로 돌리세요.`)){_ytSetProg(`취소됨 — 재검증 예정 ${updates.length}개(미적용).`);return;}
  await _snapshotBeforeBulk(`"${name}" 이름 한정 멤버 재검증`,updates.map(u=>u.id));
  {
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(d,t)=>_ytSetProg(`["${name}" 재검증] ${d}/${t}개…`)});
    if(_ub.failed){_ytSetProg(`"${name}" 재검증: ${_ub.failed}건 저장 실패(다시 눌러 재시도) — ${_ub.firstErr}`);}
  }
  if(wiped.length)_tagReviewEnqueueBatch(wiped.map(w=>({videoId:w.id,reason:'members_wiped',source:'scoped_reverify',detail:{removed:w.removed}}))); // 태그 전부 빠진 건 검수 대기로
  _ytSetProg(`완료! "${name}"을(를) ${updates.length}개 영상에서 제거함.`+(wiped.length?` (그중 ${wiped.length}개는 태그가 전부 빠져 검수 대기에 올림)`:'')+` (되돌리기: "↩︎ 마지막 일괄 작업 되돌리기")`);
}
// ⚑ 흐름: 흔한단어 규칙 등록 → 곧바로 그 이름 한정 재검증 제안. 발견→규칙→청소가 한 자리에서 끝난다.
async function _atmMemberRuleFlow(name){
  if(!confirm(`"${name}"을(를) 흔한 단어로 등록할까요?\n\n앞으로 제목에 #${name} 해시태그가 명시된 경우만 이 이름으로 매칭돼요. 평문 "${name}"만 있는 무관한 영상엔 더 이상 안 붙어요.`))return;
  const r=await _atmRegisterHashtagName(name);
  if(!r.ok){alert(r.msg);return;}
  _ytSetProg(r.already?`"${name}"은(는) 이미 흔한단어 보호 목록에 있어요.`:`"${name}"을(를) 흔한단어 보호에 등록했어요(#해시태그만 인정).`);
  await _atmScopedMemberReverify(name); // 기존 오염분 정리 제안(내부에서 건수 확인 후 confirm)
}
// ── 태깅 검수 대기열(2026-08-30) ────────────────────────────────────────────────
// 스윕이 판단 못 한 "고신뢰 애매" 케이스만 DB에 쌓아 화면에 띄운다(예전엔 console.log 무덤이라 손이 안 감).
// 테이블(tag_review_queue)이 아직 없으면(마이그 전) 전부 조용히 no-op — 앱이 안 깨지게.
async function _tagReviewEnqueue(videoId,reason,source,detail){
  if(!sb||!videoId||!reason)return;
  try{await sb.from('tag_review_queue').upsert({video_id:videoId,reason,source:source||null,detail:detail||null},{onConflict:'video_id,reason',ignoreDuplicates:true});}catch(e){/* 테이블 없거나 권한 없음 — 조용히 */}
}
async function _tagReviewEnqueueBatch(items){ // [{videoId,reason,source,detail}]
  if(!sb||!items||!items.length)return;
  try{
    const payload=items.filter(x=>x&&x.videoId&&x.reason).map(x=>({video_id:x.videoId,reason:x.reason,source:x.source||null,detail:x.detail||null}));
    for(let i=0;i<payload.length;i+=200)await sb.from('tag_review_queue').upsert(payload.slice(i,i+200),{onConflict:'video_id,reason',ignoreDuplicates:true});
  }catch(e){/* 조용히 */}
}
async function _tagReviewCount(){
  if(!sb)return null;
  try{const{count,error}=await sb.from('tag_review_queue').select('id',{count:'exact',head:true}).is('resolved_at',null);return error?null:(count||0);}catch(e){return null;}
}
async function _tagReviewResolve(id){
  if(!sb||!id)return;
  try{await sb.from('tag_review_queue').update({resolved_at:new Date().toISOString()}).eq('id',id);}catch(e){}
}
// ── 수동 편집 이력(2026-08-31) ────────────────────────────────────────────────
// "학습하는 태깅 파이프라인"의 원료. 지금까지 수동 편집은 tags_manual=true 플래그만 남기고 **무엇을
// 무엇으로 고쳤는지**는 어디에도 안 남아서, 자동 태깅이 뭘 틀렸는지에 대한 가장 값진 신호가 편집할
// 때마다 버려지고 있었다(사용자 요청: "내 수동 태깅 편집 결과를 보고 학습해서 로직을 고도화"). 여기
// 쌓인 before/after가 나중에 회귀 골든셋·규칙 후보 자동 제안의 입력이 된다.
// 테이블(tag_edit_log)이 없으면 전부 조용히 no-op — tag_review_queue와 같은 방어 패턴.
// ── 겸임(이중소속) 멤버 태그 정규화(2026-08-31) ──────────────────────────────────
// 사용자 제보 — "사실상 동일인물인데 이중 소속인 친구들 더블 태깅이 너무 많이 됐다".
// 실측(with_members 있는 행 6,000 표본): 같은 사람이 두 그룹으로 중복 99행, members에 이미 있는
// 사람이 with_members에도 든 것 164행(그중 동일인물 57 + 솔로 자기키 49).
//
// 원인: 2026-08-26에 "부소속 태그가 조용히 버려지던 버그"를 고치면서 매처가 전 소속(_artistGroups)을
// 보게 됐는데, **한 사람당 태그 하나**라는 규칙이 같이 안 들어갔다. 그래서 이진혁이 `이진혁(업텐션)`과
// `이진혁(엑스원)`으로 두 번, 엄지가 members[엄지]와 with[엄지(여자친구)]로 두 번 붙는다.
//
// ⚠️ 동명이인은 건드리면 안 된다 — 세븐틴 민규와 동키즈 민규는 **다른 사람**이라 둘 다 맞을 수 있다.
//    그래서 "같은 artists.json 항목이 두 그룹에 다 걸쳐 있을 때"만 동일인물로 보고 합친다.
// ⚠️ `승한(승한)` 같은 표기는 버그가 아니다 — 솔로는 group_ko 키가 본인 이름이라(_ytGroupKoFor) 그게
//    정상 표기이고 읽는 쪽도 그렇게 파싱한다. 그 행들의 진짜 문제는 members와의 중복이라 아래 ②가 잡는다.
let _amtIndex=null; // 이름 → [그 이름을 쓰는 아티스트 각각의 소속 키 Set]
function _amtBuildIndex(){
  const idx=new Map();
  for(const a of ARTISTS){
    const ko=a.name&&a.name.ko;if(!ko)continue;
    const gs=new Set();
    for(const g of _artistGroups(a))if(g&&g.ko)gs.add(g.ko);
    gs.add(_ytGroupKoFor(a)); // 솔로 자기키(그룹 미소속이면 본인 이름)도 같은 사람의 소속으로 친다
    if(!idx.has(ko))idx.set(ko,[]);
    idx.get(ko).push({gs,repForced:a.repGroup||null,rep:(a.group&&a.group.ko)||null});
  }
  return idx;
}
// 이름 ko를 쓰는 아티스트 중 그룹 g를 소속으로 갖는 항목(동명이인이면 여럿일 수 있음)
function _amtEntries(ko,g){
  if(!_amtIndex)_amtIndex=_amtBuildIndex();
  return (_amtIndex.get(ko)||[]).filter(e=>e.gs.has(g));
}
// 같은 사람인가 — 한 아티스트 항목이 두 그룹을 **모두** 소속으로 갖고 있으면 동일인물
function _amtSamePerson(ko,g1,g2){
  if(g1===g2)return true;
  if(!_amtIndex)_amtIndex=_amtBuildIndex();
  return (_amtIndex.get(ko)||[]).some(e=>e.gs.has(g1)&&e.gs.has(g2));
}
// 겸임 멤버의 대표 그룹 고르기 — ①제목에 literal로 언급된 그룹 ②artists.json repGroup ③주 소속 ④첫 번째.
// 제목을 먼저 보는 이유: 마시로가 케플러 영상에선 `마시로(케플러)`, 메이딘 영상에선 `마시로(메이딘)`이어야
// 맞는데, 전역 대표 하나로 고정하면 그 맥락이 날아간다.
// 제목에 그룹명(한글·영문·별칭)이 literal로 있나 — 공백을 지우고 대조해 "NINE to SIX"/"nineto six" 같은
// 표기 흔들림을 흡수한다. 한 글자짜리는 오탐이 심해 제외.
function _amtGroupNamedInTitle(g,title){
  const gr=GROUPS[g];
  const t=(title||'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
  const names=[g,gr&&gr.en,...((gr&&gr.alias)||[]),...((gr&&gr.altNames)||[])].filter(Boolean);
  return names.some(n=>{const s=String(n).toLowerCase().replace(/\s/g,'');return s.length>=2&&t.includes(s);});
}
function _amtPickGroup(ko,cands,title){
  if(cands.length<=1)return cands[0];
  const named=cands.filter(g=>_amtGroupNamedInTitle(g,title));
  if(named.length===1)return named[0];
  const pool=named.length?named:cands;
  if(!_amtIndex)_amtIndex=_amtBuildIndex();
  const ents=_amtIndex.get(ko)||[];
  // ② artists.json repGroup — 사람이 못박은 값이 가장 우선
  for(const e of ents)if(e.repForced&&pool.includes(e.repForced))return e.repForced;
  // ③ 프로젝트/서바이벌 그룹(projectRing)보다 정규 그룹을 우선. 주 소속이 해체된 프로젝트 그룹으로
  //    박혀 있는 경우가 있어서(이대휘·박우진의 주 소속이 워너원) 그대로 두면 현 소속 대신 옛 소속이
  //    남는다. groups.json에 이미 있는 표식을 쓰므로 사람이 따로 채울 게 없다.
  const regular=pool.filter(g=>!(GROUPS[g]&&GROUPS[g].projectRing));
  if(regular.length===1)return regular[0];
  const pool2=regular.length?regular:pool;
  // ④ 주 소속
  for(const e of ents)if(e.rep&&pool2.includes(e.rep))return e.rep;
  return pool2[0];
}
// with_members/members를 한 번에 정리한다. 태그를 만드는 지점마다 이 함수를 통과시켜 규칙을 한 곳에 둔다.
// ⚠️ 파라미터에 구조분해(`function f({a,b})`)를 쓰지 말 것 — tools/m2_harness.js가 함수를 슬라이스할 때
// 선언 뒤 **첫 `{`를 본문 시작으로** 보기 때문에, 구조분해 괄호에서 잘려 회귀 테스트가 통째로 깨진다.
function _normalizeMemberTags(opt){
  const title=opt.title,groupKo=opt.groupKo,members=opt.members,withGroups=opt.withGroups,withMembers=opt.withMembers;
  const mem=new Set(members||[]);
  const parsed=[];
  for(const w of (withMembers||[])){
    const m=String(w).match(/^(.+)\((.+)\)$/);
    if(!m){parsed.push({raw:w,ko:null,g:null});continue;}
    parsed.push({raw:w,ko:m[1],g:m[2]});
  }
  // ① 같은 사람이 여러 그룹으로 들어간 것 → 대표 그룹 하나로
  const byName=new Map();
  parsed.forEach(p=>{if(!p.ko)return;if(!byName.has(p.ko))byName.set(p.ko,[]);byName.get(p.ko).push(p);});
  const drop=new Set();
  byName.forEach((list,ko)=>{
    const gs=[...new Set(list.map(p=>p.g))];
    if(gs.length<2)return;
    // 동일인물인 소속끼리만 묶는다(동명이인은 각자 남긴다)
    const clusters=[];
    gs.forEach(g=>{
      const c=clusters.find(cl=>cl.some(x=>_amtSamePerson(ko,x,g)));
      if(c)c.push(g);else clusters.push([g]);
    });
    clusters.forEach(cl=>{
      if(cl.length<2)return;
      const keep=_amtPickGroup(ko,cl,title);
      list.forEach(p=>{if(cl.includes(p.g)&&p.g!==keep)drop.add(p.raw);});
    });
  });
  // ② members(=이 영상 group_ko 소속)에 이미 있는 사람이 with_members에도 있으면 중복 — 같은 사람일 때만 제거
  parsed.forEach(p=>{
    if(!p.ko||drop.has(p.raw))return;
    if(!mem.has(p.ko))return;
    if(groupKo&&_amtSamePerson(p.ko,p.g,groupKo))drop.add(p.raw);
  });
  // ③ 동명이인 교차 태그 — ②에서 "다른 사람"이라 살려둔 것들. 실측(2026-08-31) 124건 중 **114건(92%)이
  //    제목에 그 그룹명이 아예 없었다**: 엑스원 김우석 영상에 판타지보이즈 김우석이 52건, 밴드 LUCY
  //    영상에 위키미키/우아 루시가 15건. 이름이 겹치는데 근거가 이름뿐이면 그건 매칭이 아니라 우연이다.
  //    그래서 **제목에 그 그룹명이 literal로 있을 때만** 인정한다(_ATM_HASHTAG_ONLY_NAMES와 같은 원칙).
  //    ⚠️ 이 영상 members에 같은 이름이 있을 때(=홈 로스터와 충돌)로 범위를 좁힌다 — 그게 실측으로
  //    오탐이 확인된 구간이고, 넓히면 근거를 못 잰 정상 태그까지 날아간다.
  parsed.forEach(p=>{
    if(!p.ko||drop.has(p.raw))return;
    if(!mem.has(p.ko)||!groupKo)return;
    if(_amtSamePerson(p.ko,p.g,groupKo))return; // 동일인물은 ②가 이미 처리
    if(!_amtGroupNamedInTitle(p.g,title))drop.add(p.raw);
  });
  const outWM=[];const seen=new Set();
  parsed.forEach(p=>{if(drop.has(p.raw)||seen.has(p.raw))return;seen.add(p.raw);outWM.push(p.raw);});
  // with_groups도 중복 제거(정렬은 바꾸지 않는다 — 기존 비교 로직이 순서를 보는 곳이 있음)
  const outWG=[];const seenG=new Set();
  (withGroups||[]).forEach(g=>{if(seenG.has(g))return;seenG.add(g);outWG.push(g);});
  return{withMembers:outWM,withGroups:outWG};
}

const _TAG_LOG_FIELDS=['group_ko','members','with_members','with_groups','cover_of_members','cover_of_groups','cover_of_song','content_flag','category','is_short'];
// 배열/스칼라를 순서 무관하게 비교 — members는 저장 순서가 매번 달라서 그대로 비교하면 안 바뀐 것도
// "바뀜"으로 잡힌다(로그가 노이즈로 가득 차면 학습 재료로 못 씀).
function _tagLogSame(a,b){
  if(Array.isArray(a)||Array.isArray(b)){
    const x=[...(a||[])].map(String).sort(),y=[...(b||[])].map(String).sort();
    return x.length===y.length&&x.every((v,i)=>v===y[i]);
  }
  return (a??null)===(b??null);
}
function _tagLogDiff(before,after){
  return _TAG_LOG_FIELDS.filter(f=>f in after&&!_tagLogSame(before?.[f],after[f]));
}
// entries: [{videoId,title,before,after,source}] — 실제로 바뀐 게 없는 항목은 알아서 버린다.
async function _tagEditLog(entries){
  if(!sb||!entries)return;
  const list=(Array.isArray(entries)?entries:[entries]).filter(e=>e&&e.videoId);
  if(!list.length)return;
  try{
    const editor=(await sb.auth.getUser())?.data?.user?.email||null;
    const rows=[];
    for(const e of list){
      const before=e.before||{},after=e.after||{};
      const changed=_tagLogDiff(before,after);
      if(!changed.length)continue; // 값이 그대로면 기록 안 함(저장만 다시 누른 경우)
      // 바뀐 필드만 남긴다 — 전체 스냅샷을 넣으면 로그가 수십 배로 커지는데, 학습에 쓰는 건 차이뿐이다.
      const b={},a={};
      changed.forEach(f=>{b[f]=before[f]??null;a[f]=after[f]??null;});
      rows.push({video_id:e.videoId,title:e.title||null,before:b,after:a,changed,source:e.source||null,editor});
    }
    if(!rows.length)return;
    // 제목은 로그만 보고도 사례를 읽을 수 있게 비정규화해 두는 값이라, 호출부가 못 넘긴 경우(카드
    // 그리드처럼 DOM에 제목이 없는 경로) 여기서 한 번에 채운다. 실패하면 제목 없이 그냥 남긴다.
    const needTitle=rows.filter(r=>!r.title).map(r=>r.video_id);
    if(needTitle.length){
      try{
        const byId=new Map();
        for(let i=0;i<needTitle.length;i+=300){
          const{data:tRows}=await sb.from(_YT_TABLE).select('id,title').in('id',needTitle.slice(i,i+300));
          (tRows||[]).forEach(t=>byId.set(t.id,t.title));
        }
        rows.forEach(r=>{if(!r.title)r.title=byId.get(r.video_id)||null;});
      }catch(e){/* 제목 없이 진행 */}
    }
    for(let i=0;i<rows.length;i+=200)await sb.from('tag_edit_log').insert(rows.slice(i,i+200));
  }catch(err){/* 테이블 없거나 권한 없음 — 편집 자체는 이미 저장됐으므로 조용히 넘어간다 */}
}
const _TAGQ_REASON_LABEL={members_wiped:'재검증에서 멤버 태그가 전부 빠짐 — 무관 콘텐츠인지 직접 판단'};
async function _openTagReviewQueue(){
  if(!sb){alert('Supabase 연결 없음');return;}
  let ov=document.getElementById('tagq-overlay');if(ov)ov.remove();
  ov=document.createElement('div');ov.id='tagq-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:125;background:rgba(8,10,22,0.98);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;flex-direction:column;';
  document.body.appendChild(ov);
  const hd=document.createElement('div');hd.style.cssText='display:flex;align-items:center;gap:8px;padding:calc(14px + env(safe-area-inset-top,0px)) 16px 10px;';
  const ttl=document.createElement('div');ttl.style.cssText='flex:1;font-size:15px;font-weight:700;color:#eef4ff;';ttl.textContent='검수 대기';
  const cls=document.createElement('button');cls.textContent='✕';cls.style.cssText='background:none;border:none;color:rgba(200,215,245,0.7);font-size:18px;cursor:pointer;padding:4px 8px;';cls.addEventListener('click',()=>ov.remove());
  hd.appendChild(ttl);hd.appendChild(cls);
  const list=document.createElement('div');list.style.cssText='flex:1;min-height:0;overflow-y:auto;padding:2px 12px 24px;color:rgba(200,215,245,0.6);font-size:13px;';
  ov.appendChild(hd);ov.appendChild(list);
  list.textContent='불러오는 중…';
  let q;try{q=await sb.from('tag_review_queue').select('id,video_id,reason,detail,created_at').is('resolved_at',null).order('created_at',{ascending:true}).limit(500);}catch(e){q={error:{message:e.message}};}
  if(!q||q.error){list.textContent=q&&q.error?('검수 대기열을 못 불러왔어요 — 테이블 마이그레이션(tag_review_queue_migration.sql)이 필요할 수 있어요. '+(q.error.message||'')):'조회 실패';return;}
  const rows=q.data||[];
  if(!rows.length){list.textContent='검수 대기 없음 🎉';return;}
  const ids=[...new Set(rows.map(r=>r.video_id))];
  const vmap=new Map();
  for(let i=0;i<ids.length;i+=200){try{const{data}=await sb.from(_YT_TABLE).select('id,title,group_ko,members').in('id',ids.slice(i,i+200));(data||[]).forEach(v=>vmap.set(v.id,v));}catch(e){}}
  list.innerHTML='';
  ttl.textContent=`검수 대기 (${rows.length})`;
  rows.forEach(r=>{
    const v=vmap.get(r.video_id);
    const row=document.createElement('div');row.style.cssText='padding:11px 6px;border-bottom:0.5px solid rgba(255,255,255,0.06);';
    const t=document.createElement('div');t.style.cssText='font-size:13px;color:#eaf1ff;line-height:1.35;';t.textContent=(v?_cleanTitle(v.title):r.video_id)||r.video_id;
    const meta=document.createElement('div');meta.style.cssText='font-size:10.5px;color:rgba(150,175,225,0.6);margin-top:2px;';
    meta.textContent=(v?`${v.group_ko||'?'} · `:'')+(_TAGQ_REASON_LABEL[r.reason]||r.reason);
    const btns=document.createElement('div');btns.style.cssText='display:flex;gap:6px;margin-top:7px;';
    const mkb=(label,style,on)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='background:rgba(120,150,230,0.16);border:0.5px solid rgba(160,185,240,0.3);color:#dbe6ff;border-radius:12px;padding:5px 11px;font-size:11px;cursor:pointer;'+(style||'');b.addEventListener('click',on);return b;};
    btns.appendChild(mkb('편집','',()=>_openVidTagModal({id:r.video_id,title:v?v.title:''},v?v.group_ko:'')));
    btns.appendChild(mkb('✓ 해결','background:rgba(90,170,120,0.16);border-color:rgba(120,200,150,0.35);color:#cdefd8;',async(e)=>{e.currentTarget.disabled=true;await _tagReviewResolve(r.id);row.remove();ttl.textContent=`검수 대기 (${list.querySelectorAll(':scope > div').length})`;if(!list.children.length)list.textContent='검수 대기 없음 🎉';}));
    row.appendChild(t);row.appendChild(meta);row.appendChild(btns);
    list.appendChild(row);
  });
}
async function _ytSweepMembersMistag(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-membersfix-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[자체 멤버 태깅 재검증] 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,description,group_ko,members,published_at')
      .eq('tags_manual',false)
      .not('members','eq','{}')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');return;}
    const updates=[];
    // 태그가 완전히 다 빠지는 행(진짜 무관 콘텐츠일 수도, 그냥 특정 멤버명이 제목에 없을 뿐인 정상
    // 자체채널 영상일 수도 있음 — 이 스윕은 판단 안 하고 목록만 콘솔에 남긴다. 무관 처리 여부는 관리자가
    // 직접 확인해서 판단(2026-08-19, 사용자 요청 — 자동으로 content_flag='무관' 처리는 위험하다고 판단).
    const wipedOut=[];
    rows.forEach(v=>{
      const roster=_atmRosterFor(v.group_ko);
      if(!roster.length)return;
      const validSet=new Set(_atmResolveMembers(v.title,v.description,roster,v.group_ko,v.published_at));
      const curM=v.members||[];
      const newM=curM.filter(mko=>validSet.has(mko));
      if(newM.length!==curM.length){
        updates.push({id:v.id,patch:{members:newM}});
        if(!newM.length)wipedOut.push({id:v.id,title:v.title,removed:curM});
      }
    });
    if(!updates.length){_ytSetProg(`검사 완료 — ${rows.length}개 중 오염 없음`);return;}
    if(wipedOut.length){
      console.log(`[자체 멤버 태깅 재검증] 태그가 전부 빠진 행 ${wipedOut.length}개 — 무관 콘텐츠인지 직접 확인 필요:`,wipedOut);
      // 콘솔 무덤 대신 검수 대기열에도 적재(2026-08-30) — 홈 카운트 → 목록 → 편집/해결로 이어진다.
      _tagReviewEnqueueBatch(wipedOut.map(w=>({videoId:w.id,reason:'members_wiped',source:'members_reverify',detail:{removed:w.removed}})));
    }
    if(updates.length&&!_admRoutineRunning&&typeof _confirmDialog==='function'&&!(await _confirmDialog({title:'자체 멤버 태깅 재검증 (전체)',msg:`그룹 자체 채널 멤버 태그 <b>${updates.length}건</b>을 최신 매칭으로 재검증해요. 그룹은 안 건드리고, 되돌리기 스냅샷을 떠둬요.`,okLabel:'재검증 실행',wide:true})))return;
    await _snapshotBeforeBulk('자체 멤버 태깅 재검증(전체)',updates.map(u=>u.id));
    // 200개를 한꺼번에 Promise.all로 쏘면 그중 하나가 일시적 네트워크 끊김(Failed to fetch)으로 튕길 때
    // 전체가 죽는다(2026-09-01 사용자 제보). 동시요청 20개 제한 + 실패분 재시도로 안전하게(_sbUpdateBatch).
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[자체 멤버 태깅 재검증] ${done}/${total}개 처리 중…`)});
    if(_ub.failed)console.error('[자체 멤버 태깅 재검증] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! ${rows.length}개 중 ${updates.length}개에서 근거 없는 멤버 태그 제거함`+(_ub.failed?` · ${_ub.failed}개는 저장 실패(다시 눌러 재시도)`:'')+(wipedOut.length?` (그중 ${wipedOut.length}개는 태그가 전부 빠짐 — 콘솔 확인 후 무관 처리 여부 직접 판단 필요)`:''));
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// 커버곡 원곡 제목 자동 추출(2026-08-19, 사용자 요청 — "특정 커버곡 모아보기" 기능의 전제 작업, 일회성
// 스크립트가 아니라 반복 재실행 가능한 버튼으로). cover_of_members/cover_of_groups(원곡 아티스트)가
// 채워진 영상 중엔 진짜 커버곡이 아니라 검수 센터에서 "실제 출연/콜라보가 아니다"로 재분류돼 이 필드로
// 옮겨진 것도 섞여있음(실측: 전체 1,854건 중 제목에 커버/원곡/Original 관련 키워드까지 있는 진짜 커버는
// 763건뿐) — 그래서 cover_of_members/groups 하나만 보고 곡명을 추출하면 안 되고, 반드시 제목 키워드
// 교차검증(아래 쿼리의 두 번째 .or)까지 같이 걸어야 함. 제목에서 곡명 후보를 뽑은 뒤, 그 원곡 아티스트의
// 디스코그래피(groups.json)에서 실제로 확인되는 것만 cover_of_song에 저장한다 — 후보를 못 뽑거나
// 디스코그래피에 없으면(솔로 아티스트는 애초에 디스코그래피 데이터가 없어 확인 불가) 그냥 비워둠, 틀린
// 곡명을 저장하느니 안 채우는 게 안전(프로젝트 전역 원칙 — 확실한 것만 자동, 애매하면 다음 실행에 맡김).
// cover_of_song이 이미 있는 행은 쿼리에서부터 제외하므로, 다시 눌러도 새로 늘어난 커버 영상이나(동기화로
// 새로 들어옴) 지난번엔 실패했지만 이번엔 잡히는 것(디스코그래피가 그 사이 보강됨, 매칭 로직 개선 등)만
// 처리됨 — 매번 전량 재스캔이 아니라서 반복 실행 부담이 적음. tags_manual=true는 다른 재검증 버튼들과
// 동일하게 절대 건드리지 않음.
function _ytCoverSongCandidate(title){
  // 이모지로 시작하는 제목이 많아서(장식용 접두), "by" 패턴이 그걸 곡명 일부로 같이 집어삼키는 걸
  // 막기 위해 선행 이모지/공백부터 제거하고 시작한다(2026-08-19, 실제 샘플로 검증 중 발견).
  const t=(title||'').replace(/^[\s\p{Extended_Pictographic}️]+/u,'');
  const patterns=[
    // 따옴표 안쪽은 탐욕적으로(.{1,40}, 아포스트로피 등을 굳이 배제하지 않음) 매칭 — 영문 곡명에 흔한
    // "Life's Too Short" 같은 내부 아포스트로피를 진짜 닫는 따옴표로 착각해 잘라먹지 않게 하기 위함
    // (2026-08-19, 실제 샘플에서 "Life's Too Short"가 "s Too Short"로 잘리는 걸 발견해 수정).
    /['"“‘](.{1,40})['"”’]\s*\(?\s*(?:원곡|Original)/,   // '곡명' (원곡: ...) / "곡명" (Original ...)
    /['"“‘](.{1,40})['"”’]\s*(?:COVER|Cover|커버)/,      // '곡명' Cover / "곡명" 커버
    /-\s*([^()\-]{1,40}?)\s*\(\s*(?:원곡|Original)/,     // ... - 곡명 (원곡: ...)
    /^(.{1,40}?)\s+by\s+.{1,30}?\(\s*Original\s*Song/i,  // 곡명 by 커버아티스트 (Original Song: ...)
  ];
  for(const re of patterns){
    const m=t.match(re);
    if(m&&m[1]){
      const cand=m[1].trim();
      if(cand)return cand;
    }
  }
  return null;
}
// "이름(그룹)" 형식이면 그 그룹의 디스코그래피, 순수 그룹명이면 그 그룹 자체의 디스코그래피 트랙 제목
// 전부를 모아 반환 — 솔로 아티스트(group.ko==='솔로')는 groups.json에 항목 자체가 없어 빈 배열이 되고,
// 그 경우 이 원곡은 확인 불가(아래 _ytMatchCoverSong에서 자연히 매칭 실패로 처리됨)로 남는다.
function _ytCoverOrigTrackTitles(nameWithGroup){
  const m=nameWithGroup.match(/\(([^)]+)\)\s*$/);
  const gko=m?m[1]:nameWithGroup;
  const disc=GROUPS[gko]?.discography;
  if(!disc)return[];
  const out=[];
  disc.forEach(al=>(al.tracks||[]).forEach(t=>{if(t.title)out.push(t.title);}));
  return out;
}
// 공백/기호까지 지운 느슨한 비교용 — "God's Menu"처럼 아포스트로피 유무 등 사소한 표기차 흡수
function _ytCoverSongLoose(s){return _titleNorm(s).replace(/[\s'".,!?()\-_]/g,'');}
function _ytMatchCoverSong(candidate,origNames){
  const candNorm=_titleNorm(candidate),candLoose=_ytCoverSongLoose(candidate);
  for(const nm of origNames){
    for(const track of _ytCoverOrigTrackTitles(nm)){
      const tNorm=_titleNorm(track),tLoose=_ytCoverSongLoose(track);
      if(tNorm.includes(candNorm)||candNorm.includes(tNorm))return track;
      if(tLoose.includes(candLoose)||candLoose.includes(tLoose))return track;
    }
  }
  return null;
}
// ── 일괄 작업 실행 취소(undo) 스냅샷 ─────────────────────────────────────────────
// 대량 스윕/재검증/재스캔 버튼이 수백~수만 행을 자동으로 바꾸기 "직전"에, 바뀔 행들의 현재값을
// admin_bulk_snapshots 테이블에 1회분(batch)으로 떠둔다. 오조작 시 "↩︎ 마지막 일괄 작업 되돌리기"
// 버튼이 그 batch를 통째로 복원 — undo가 곧 백업이 되는 구조(2026-08-22, 자문 백업전략 #1, 3.5만
// 재스캔 사고 재발 방지책). 어느 버튼이 어느 컬럼을 바꾸든 하나의 헬퍼로 커버하려고, 이 관리도구들이
// 바꿀 수 있는 컬럼 전부를 고정 목록으로 떠둔다(안 바뀐 컬럼까지 복원해도 값이 같아 무해).
const _BULK_SNAP_TABLE='admin_bulk_snapshots';
const _BULK_SNAP_COLS=['group_ko','members','with_members','with_groups','content_flag','needs_review','cover_of_members','cover_of_groups','cover_of_song','tags_manual','category','is_short','reviewed_at','flag_source','flagged_at'];
let _snapHasReviewedAt=true;
// flag_source/flagged_at(2026-08-27 신설)도 스냅샷에 넣는다 — content_flag만 되돌리고 출처를 안
// 되돌리면 "정상인데 auto가 숨긴 흔적이 남은" 유령 상태가 생긴다. 컬럼이 아직 없는 환경(마이그레이션
// 전)에서 select가 400을 내면 reviewed_at·is_short과 같은 방식으로 한 번만 빼고 재시도한다.
let _snapHasFlagSrc=true;
// is_short도 같은 사정 — is_short_migration.sql 실행 전이면 컬럼이 없어서 스냅샷 select가 400을 낸다.
// 스냅샷은 모든 일괄 작업의 전제라 여기서 막히면 일괄 기능이 통째로 죽으므로 한 번만 빼고 재시도한다.
let _snapHasIsShort=true;
const _snapCols=()=>_BULK_SNAP_COLS.filter(c=>(c!=='reviewed_at'||_snapHasReviewedAt)&&(c!=='is_short'||_snapHasIsShort)&&((c!=='flag_source'&&c!=='flagged_at')||_snapHasFlagSrc));
// 영향받는 id들의 "바꾸기 전" 값을 떠서 batch로 저장한다. 실패해도(테이블 없음/권한 등) 원래 작업은
// 막지 않고 안내만 남긴다 — 스냅샷이 안 됐다고 관리도구 자체가 멈추면 안 됨(그만큼 되돌리기만 불가).
// forceBatchId: 여러 번 나눠 호출해도 같은 batch로 묶고 싶을 때(예: 청크로 진행되는 쇼츠 승격 스윕의
// 한 번의 실행 전체를 하나의 되돌리기 단위로) 넘긴다. 안 넘기면 매 호출마다 새 batch.
async function _snapshotBeforeBulk(opLabel,ids,forceBatchId){
  if(!sb||!ids||!ids.length)return null;
  // 일괄 작업은 수천 행을 한꺼번에 바꾸므로 영상 관리 패널의 탭 캐시를 전부 버린다 — 모든 일괄
  // 버튼이 이 함수를 반드시 거치므로(스냅샷은 일괄 작업의 전제) 여기 한 곳이면 충분하다.
  try{_vmCache.clear();_vmIdbClear();}catch(_){}
  const uniq=[...new Set(ids)];
  const batchId=forceBatchId||((self.crypto&&self.crypto.randomUUID)?self.crypto.randomUUID():('b'+Date.now()+Math.random().toString(36).slice(2)));
  try{
    let saved=0;
    for(let i=0;i<uniq.length;i+=200){
      const chunk=uniq.slice(i,i+200);
      let{data:rows,error}=await sb.from(_YT_TABLE).select(['id',..._snapCols()].join(',')).in('id',chunk);
      // reviewed_at 추가 SQL 전이면 여기서 400이 나고, 스냅샷은 모든 일괄 작업의 전제라 일괄 기능이
      // 통째로 막힌다 — 한 번만 컬럼을 빼고 재시도한 뒤 이후로는 뺀 목록을 쓴다(2026-08-25).
      if(error&&_snapHasReviewedAt&&/reviewed_at/.test(error.message||'')){
        _snapHasReviewedAt=false;
        ({data:rows,error}=await sb.from(_YT_TABLE).select(['id',..._snapCols()].join(',')).in('id',chunk));
      }
      if(error&&_snapHasIsShort&&/is_short/.test(error.message||'')){
        _snapHasIsShort=false;
        ({data:rows,error}=await sb.from(_YT_TABLE).select(['id',..._snapCols()].join(',')).in('id',chunk));
      }
      if(error&&_snapHasFlagSrc&&/flag_source|flagged_at/.test(error.message||'')){
        _snapHasFlagSrc=false;
        ({data:rows,error}=await sb.from(_YT_TABLE).select(['id',..._snapCols()].join(',')).in('id',chunk));
      }
      if(error)throw new Error(error.message);
      if(!rows||!rows.length)continue;
      const snapRows=rows.map(r=>{
        const before={};
        _snapCols().forEach(c=>{before[c]=r[c];});
        return{batch_id:batchId,op_label:opLabel,row_id:String(r.id),before_data:before};
      });
      const{error:insErr}=await sb.from(_BULK_SNAP_TABLE).insert(snapRows);
      if(insErr)throw new Error(insErr.message);
      saved+=snapRows.length;
    }
    // 오래된 스냅샷(30일 경과) 정리 — 무한 누적 방지, 실패해도 무시
    try{const cutoff=new Date(Date.now()-30*24*3600*1000).toISOString();await sb.from(_BULK_SNAP_TABLE).delete().lt('created_at',cutoff);}catch(_){}
    return{batchId,saved};
  }catch(e){
    _ytSetProg('ℹ️ 되돌리기 준비 안 됨(작업은 정상 진행됨) — '+e.message+' · admin_bulk_snapshots 테이블 SQL을 1회 실행하면 켜집니다.');
    return null;
  }
}
// 가장 최근 일괄 작업(batch)을 이전 상태로 복원한다. 되돌린 batch는 삭제해서 중복 되돌리기를 막는다
// (그 전 batch가 새 "마지막"이 되어 연속 undo도 가능). tags_manual 값도 스냅샷 시점 그대로 복원됨.
// 되돌리기 — 최근 일괄 작업 '목록'을 보여주고 고른 배치를 복원(설정패널 개선 10). 스냅샷 테이블은
// batch당 여러 행이라, 최근 창을 페이지로 긁어 batch_id로 중복 제거해 최근 배치 목록을 만든다
// (큰 배치가 1페이지를 다 채워도 다음 페이지까지 가서 서로 다른 배치를 모은다).
async function _ytUndoLastBulk(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const box=document.getElementById('adm-undo-list');
  _ytSetProg('[되돌리기] 최근 일괄 작업 목록 조회 중…');
  const seen=new Map();
  try{
    for(let p=0;p<12&&seen.size<8;p++){
      const{data,error}=await sb.from(_BULK_SNAP_TABLE).select('batch_id,op_label,created_at').order('created_at',{ascending:false}).range(p*1000,p*1000+999);
      if(error){_ytSetProg('되돌리기 조회 실패: '+error.message+' (admin_bulk_snapshots 테이블 SQL을 실행했는지 확인)');return;}
      if(!data||!data.length)break;
      for(const r of data)if(!seen.has(r.batch_id))seen.set(r.batch_id,{op:r.op_label,at:r.created_at});
      if(data.length<1000)break;
    }
  }catch(e){_ytSetProg('되돌리기 조회 오류: '+e.message);return;}
  const batches=[...seen.entries()].slice(0,8);
  if(!batches.length){_ytSetProg('되돌릴 일괄 작업이 없어요 (스윕/재검증을 실행한 적이 있어야 해요)');if(box)box.innerHTML='';return;}
  _ytSetProg(`최근 일괄 작업 ${batches.length}건 — 아래에서 되돌릴 항목을 고르세요`);
  if(!box)return;
  box.innerHTML=batches.map(([id,b],idx)=>{
    const when=new Date(b.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    return `<div class="aul-row"><span class="aul-info">${idx===0?'<b>최근</b> ':''}${(b.op||'(이름없음)').replace(/</g,'&lt;')}<span class="aul-meta">${when}</span></span><button class="aul-btn" data-batch="${id}">↩︎ 되돌리기</button></div>`;
  }).join('');
  box.querySelectorAll('.aul-btn').forEach((btn,idx)=>{
    btn.addEventListener('click',async()=>{
      if(_admIsBusy()){_admExecNudge();return;}
      const[id,b]=batches[idx];
      if(!confirm(`"${b.op}" 작업을 되돌릴까요?\n\n이 작업으로 바뀐 행들을 그 직전 상태로 복원합니다.`))return;
      _admExecLockOn('sp-yt-undo-bulk-btn','되돌리기: '+b.op);
      try{await _ytUndoBatch(id,b.op);box.innerHTML='';}
      catch(e){_ytSetProg('되돌리기 오류: '+e.message);}
      finally{_admExecLockOff('sp-yt-undo-bulk-btn',true);}
    });
  });
}
// 한 배치를 실제로 복원 — before_data를 그대로 되써넣고 그 배치 스냅샷을 지운다.
async function _ytUndoBatch(batchId,opLabel){
  const{data:snaps,error:sErr}=await _sbFetchAll(()=>sb.from(_BULK_SNAP_TABLE).select('row_id,before_data').eq('batch_id',batchId).order('snap_id'));
  if(sErr){_ytSetProg('되돌리기 데이터 로드 실패: '+sErr.message);return;}
  if(!snaps||!snaps.length){_ytSetProg('되돌릴 스냅샷 데이터가 없어요');return;}
  const _ub=await _sbUpdateBatch(snaps,s=>sb.from(_YT_TABLE).update(s.before_data).eq('id',s.row_id),
    {conc:20,retries:2,onProgress:(d,t)=>_ytSetProg(`[되돌리기] ${d}/${t}개 복원 중…`)});
  if(_ub.failed)throw new Error(`되돌리기 ${_ub.failed}건 실패(재시도 후) — ${_ub.firstErr}`); // 부분 복원 방지: 실패 시 중단
  const restored=snaps.length;
  await sb.from(_BULK_SNAP_TABLE).delete().eq('batch_id',batchId);
  try{_vmCache.clear();_vmIdbClear();}catch(_){}
  _ytSetProg(`되돌리기 완료! "${opLabel}"으로 바뀐 ${restored}개 행을 이전 상태로 복원했어요.`);
}

// 라이브(직캠/무대) 판정용 정규식(_ytClassify)이 채널 동기화 시점에 딱 한 번만 돌고 이후 재검증이
// 전혀 없어서(쇼츠는 _probeShortsBatch로 썸네일 실측 보정이 있는 것과 대조적), "Performance Video"류
// 사전제작 콘텐츠가 라이브로 오분류되거나, 반대로 음악방송 이름(엠카운트다운 등)만 있고 "직캠"/"라이브"
// 단어가 없는 진짜 방송 무대 영상이 other로 방치되는 문제가 대량으로 쌓여있었음(2026-08-06, 사용자 제보
// + 실측 확인: 'other'인데 방송명이 있는 영상 최소 1만7천여 건, 'live'인데 "Performance Video"인 영상
// 761건). _ytClassify 자체를 고친 뒤(위 참고) 이미 저장된 기존 행에도 소급 적용하는 재분류 스윕.
// tags_manual=true(관리자가 태그 모달에서 직접 category를 저장한 행)는 다른 재검증 버튼들과 동일하게
// 절대 건드리지 않음.
//
// ⚠️ 2026-08-27 직교화로 쇼츠 제외를 **없앴다**. 예전엔 category가 단일값이라 short와 장르가 배타적
// 이었고, 그래서 "제목만으로 재분류하면 쇼츠가 live로 되돌아간다"는 이유로 쇼츠를 통째로 뺐었다. 지금은
// 세로 여부가 is_short 플래그로 빠져나갔으므로(is_short_migration.sql) 쇼츠에도 장르를 붙이는 게 맞고,
// 오히려 그래야 세로 직캠이 Live 탭에 뜬다. **is_short_migration.sql을 돌린 뒤 이 버튼을 한 번 실행하면
// 기존 category='short' 약 84,286건의 장르 재추론(직교화 3단계)이 그대로 끝난다** — 별도 일회용 버튼을
// 만들지 않은 이유가 이것이고, 되돌리기(category 스냅샷)도 이미 붙어 있다.
async function _ytSweepCategoryMistag(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-catfix-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[영상 카테고리 재분류] 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,category,is_short')
      .eq('tags_manual',false)
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');return;}
    const updates=[];
    rows.forEach(v=>{
      const newCat=_ytClassify(v.title||'');
      // skip은 동기화 시점에 "아예 저장하지 않는다"는 의미라 이미 저장된 행엔 적용 대상이 아니다.
      // (_ytClassify는 2026-08-27부터 'short'를 반환하지 않는다 — 세로는 is_short 플래그 소관.)
      if(!newCat||newCat==='skip')return;
      if(newCat===v.category)return;
      // 레거시 category='short' 행은 여기서 장르를 되찾는다. is_short는 SQL 백필로 이미 true이므로
      // 건드리지 않는다 — 혹시 백필 전이면 같이 세워줘야 세로 표시가 안 끊긴다.
      const patch={category:newCat};
      if(v.category==='short'&&v.is_short!==true)patch.is_short=true;
      updates.push({id:v.id,patch});
    });
    if(!updates.length){_ytSetProg(`검사 완료 — ${rows.length}개 중 바뀔 항목 없음`);return;}
    if(updates.length&&!_admRoutineRunning&&typeof _confirmDialog==='function'&&!(await _confirmDialog({title:'영상 카테고리 재분류 (전체)',msg:`라이브/쇼츠/예능 등 카테고리 <b>${updates.length}건</b>을 최신 로직으로 재분류해요. 되돌리기 스냅샷을 떠둬요.`,okLabel:'재분류 실행',wide:true})))return;
    await _snapshotBeforeBulk('영상 카테고리 재분류(전체)',updates.map(u=>u.id));
    const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),
      {conc:20,retries:2,onProgress:(done,total)=>_ytSetProg(`[영상 카테고리 재분류] ${done}/${total}개 처리 중…`)});
    if(_ub.failed)console.error('[영상 카테고리 재분류] 재시도 후에도 실패:',_ub.failed,'건 —',_ub.firstErr);
    _ytSetProg(`완료! ${rows.length}개 중 ${updates.length}개 카테고리 갱신함`);
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// ── 가로→쇼츠 일괄 승격 스윕 ────────────────────────────────────────────────────
// 동기화 시점 세로 판별이 원리적으로 불가능하다(2026-08-26 조사): 쇼츠 썸네일도 high/standard/maxres가
// 전부 가로(480x360·640x480·1280x720)라 hiTh.height>hiTh.width가 참이 될 수 없고, 원본 세로 비율을
// 유지하는 건 oardefault.jpg(1080x1920)뿐이다. 그 결과 세로 판별은 사실상 제목 정규식으로만 걸려왔고,
// 세로 영상 약 2.8만 건이 가로 카드로 찌그러져 노출돼 왔다. 이 스윕은 아직 세로가 아닌 행을 id
// 오름차순으로 훑으며 oardefault.jpg를 실측(_probeIsPortrait, index.html 정의 — 같은 페이지 전역)해
// 세로면 **is_short=true로 승격만** 한다. 반대 방향(강등)은 오판 위험이 커서 하지 않으며 조회에서
// 이미 세로인 행을 아예 제외한다.
// ⚠️ 2026-08-27 직교화 전엔 category를 'short'로 덮어써서 승격할 때마다 장르가 날아갔다 — 지금은
//    플래그만 세우므로 라이브 직캠이 Live 탭에 남은 채로 9:16이 된다(is_short_migration.sql). 대상이 ~28만 건이라 브라우저 이미지 프로브로 오래 걸려(동시 12개 ~90분)
// localStorage 커서로 **중단/재개**를 지원한다 — 이미 승격된 행은 다음 조회에서 자동 제외되고, 커서
// 덕에 이미 확인한 가로 행을 재프로브하지 않는다. tags_manual 행은 다른 스윕과 동일하게 보호. 한 번의
// 실행 전체가 하나의 batch로 스냅샷돼 "↩︎ 되돌리기"로 통째 복원 가능(재개하면 새 batch).
let _shortsPromoteRunning=false;
const _SHORTS_PROMOTE_CURSOR_KEY='_kpu_shortsPromoteCursor';
async function _ytSweepPromoteShorts(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-shortspromote-btn');
  if(_shortsPromoteRunning){ // 실행 중 다시 누르면 중단 요청(현재 청크까지 마치고 멈춤)
    _shortsPromoteRunning=false;
    _ytSetProg('[쇼츠 승격] 중단 요청됨 — 현재 청크 마무리 후 멈춥니다…');
    return;
  }
  if(typeof _probeIsPortrait!=='function'){_ytSetProg('오류: 세로 판별 함수(_probeIsPortrait)를 찾을 수 없어요');return;}
  // 진행은 short_probed_at 표식으로 관리한다(id 커서 폐기, 2026-08-31) — 확인한 행은 표식이 박혀
  // 조회에서 영구 제외되므로 커서 없이 매번 "남은 것"만 집힌다. 정렬을 부분 인덱스(published_at DESC)에
  // 맞춰 statement timeout을 없애고(예전 id 정렬은 28만 행 통째 정렬→타임아웃), 최신 영상부터 처리해
  // 카드/피드 여백이 먼저 사라지게 한다.
  localStorage.removeItem(_SHORTS_PROMOTE_CURSOR_KEY); // 낡은 커서 잔재 정리
  const runBatchId=(self.crypto&&self.crypto.randomUUID)?self.crypto.randomUUID():('sp'+Date.now());
  _shortsPromoteRunning=true;
  if(btn){btn.textContent='⏹️ 쇼츠 승격 중단';btn.style.borderColor='#d08a8a';}
  const CHUNK=400, CONC=12;
  let scanned=0, promoted=0, snapOff=false;
  try{
    let remain=null; // 진행률 표시용 대략치(실패해도 무시)
    try{const{count}=await sb.from(_YT_TABLE).select('id',{count:'exact',head:true}).eq('tags_manual',false).eq('is_short',false).is('short_probed_at',null);remain=count;}catch(_){}
    while(_shortsPromoteRunning){
      const{data:rows,error}=await sb.from(_YT_TABLE)
        .select('id')
        .eq('tags_manual',false).eq('is_short',false).is('short_probed_at',null)
        .order('published_at',{ascending:false}).limit(CHUNK);
      if(error){_ytSetProg('조회 실패: '+error.message+' (표식까지는 저장됨, 다시 눌러 이어서)');break;}
      if(!rows||!rows.length){_ytSetProg(`✅ 쇼츠 승격 완료! 전량 스캔 끝 — 총 ${promoted}개를 쇼츠로 승격(스캔 ${scanned}개).`);localStorage.removeItem(_SHORTS_PROMOTE_CURSOR_KEY);break;}
      // 세로 실측(동시 CONC개) — oardefault.jpg가 로드되고 세로면 쇼츠
      const portraitIds=[],probedIds=[]; let idx=0;
      const worker=async()=>{while(idx<rows.length){if(!_shortsPromoteRunning)return;const r=rows[idx++];const isP=await _probeIsPortrait(r.id);scanned++;probedIds.push(r.id);if(isP)portraitIds.push(r.id);}};
      await Promise.all(Array.from({length:CONC},worker));
      // 승격(세로만) — 실행 전체를 runBatchId 하나로 스냅샷
      if(portraitIds.length){
        if(!snapOff){const s=await _snapshotBeforeBulk('가로→쇼츠 승격',portraitIds,runBatchId);if(s===null)snapOff=true;}
        {
          const _ub=await _sbUpdateBatch(portraitIds,id=>sb.from(_YT_TABLE).update({is_short:true}).eq('id',id),{conc:20,retries:2});
          if(_ub.failed)throw new Error(`쇼츠 승격 ${_ub.failed}건 저장 실패(재시도 후) — ${_ub.firstErr}`); // 중단·재개형이라 실패 시 멈추고 다시 눌러 이어서
        }
        promoted+=portraitIds.length;
      }
      // **실제로 프로브한 행만** "실측 확인함"으로 표식(2026-08-31) → 다음 스윕(브라우저/서버
      // tools/shorts_promote.mjs)이 재프로브 안 함. ⚠️ 청크 도중 중단 시 안 본 행(probedIds 밖)은
      // 표식을 안 남겨야 다음에 다시 훑는다 — rows 전체를 찍으면 안 본 쇼츠가 영영 스킵됨.
      // 조회가 short_probed_at IS NULL만 보므로 확인된 가로는 영구 제외돼 처음부터 다시 눌러도 재프로브 0.
      if(probedIds.length){const _now=new Date().toISOString();
       for(let i=0;i<probedIds.length;i+=100){const _ids=probedIds.slice(i,i+100);
         const{error:_mErr}=await sb.from(_YT_TABLE).update({short_probed_at:_now}).in('id',_ids);
         if(_mErr)throw new Error(_mErr.message);}}
      const pct=remain?` · ~${Math.min(99,Math.round(scanned/remain*100))}%`:'';
      _ytSetProg(`[쇼츠 승격] 스캔 ${scanned}${remain?'/'+remain:''}${pct} · 승격 ${promoted}개`);
    }
    if(!_shortsPromoteRunning){
      _ytSetProg(`⏸️ 쇼츠 승격 중단됨 (누적 승격 ${promoted}개). 버튼 다시 눌러 남은 것부터 이어서.`);
    }
  }catch(e){
    _ytSetProg('쇼츠 승격 오류: '+e.message+' (확인한 데까진 표식 저장됨, 다시 눌러 이어서)');
  }finally{
    _shortsPromoteRunning=false;
    if(btn){btn.textContent='⬆️ 가로→쇼츠 일괄 승격';btn.style.borderColor='';}
  }
}


// 흔한단어 보호 목록(해시태그로만 인정하는 이름) 조회/관리 — 하드코딩(_ATM_HASHTAG_ONLY_NAMES)은 코드
// 배포가 있어야 빠지므로 여기선 읽기 전용으로만 보여주고, DB(name_match_whitelist, admin이 스캔에서
// 바로 추가한 것)는 즉시 제거도 가능하게 한다(2026-08-04, 사용자 요청 — "필요에 따라 추가/삭제").
// 흔한단어 보호 목록에 있는 이름으로 실제 ARTISTS 멤버를 찾아 그 멤버 카드로 이동 — 어느 그룹 소속인지
// 이름 텍스트만 봐서는 안 보여서 바로 확인하러 갈 방법이 없었음(2026-08-04, 사용자 요청).
function _dqGotoArtist(artist){
  document.getElementById('hnn-overlay').classList.remove('open');
  if(isMob()){
    _navHistoryActive=true;showT(artist,window.innerWidth/2,window.innerHeight*0.4,false,null,false);_navHistoryActive=false;
    openMobSheet(document.getElementById('tt'));
  }else{
    showT(artist,window.innerWidth/2,window.innerHeight*0.4);
    // showT 내부에서 openSidePanel/openMemberPanel이 호출되지만,
    // 이벤트 버블링으로 window click이 먼저 도달해 카드를 닫아버리는 타이밍 문제를 방지:
    // 클릭 이벤트 큐가 소진된 다음 프레임에 패널이 실제로 열려있는지 확인 후 보완 오픈.
    requestAnimationFrame(()=>{
      const ttEl=document.getElementById('tt');
      if(!memberPanelEl.classList.contains('open')&&!sidePanelEl.classList.contains('open')){
        openSidePanel(ttEl);
      }
    });
  }
}
function _dqGotoArtistByName(name){
  const artist=ARTISTS.find(a=>a.name.ko===name||(a.name.en&&a.name.en.toLowerCase()===name.toLowerCase()));
  if(!artist)return;
  _dqGotoArtist(artist);
}
// 동명이인(이름 중복) 목록 — artists.json 로스터 안에서 같은 이름(name.ko)을 쓰는 사람이 2명 이상이면
// 전부 모아서 보여줌. 위 "동명이인 오염 의심 스캔"과 달리 DB를 전혀 안 건드리고 이미 로드된 ARTISTS
// 배열만 훑는 거라 패널을 열자마자 즉시 계산해서 보여줄 수 있음(2026-08-05, 사용자 요청 — 스캔 버튼
// 없이도 바로 확인 가능하게).
function _renderHnnDuplicateNames(){
  const listEl=document.getElementById('hnn-dup-list');
  if(!listEl)return;
  const byName=new Map();
  ARTISTS.forEach(a=>{
    if(!byName.has(a.name.ko))byName.set(a.name.ko,[]);
    byName.get(a.name.ko).push(a);
  });
  const dups=[...byName.entries()].filter(([,list])=>list.length>1).sort((a,b)=>a[0].localeCompare(b[0],'ko'));
  listEl.innerHTML='';
  if(!dups.length){listEl.innerHTML='<div id="hnn-dup-empty">중복된 이름 없음</div>';return;}
  // 이름 줄+칩 줄을 따로 두면(2줄) 127개 그룹(277명)이 전부 2줄씩 차지해 스크롤이 너무 길어짐 —
  // 이름은 클릭 안 되는 라벨이라는 걸 톤으로만 구분하고, 칩들과 한 줄(flex-wrap)로 합쳐서 압축
  // (2026-08-11, 사용자 제보 — "이름 텍스트 눌러도 카드로 연결 안 됨"이라 아예 헷갈리지 않게 톤을 낮춤).
  dups.forEach(([name,list])=>{
    const item=document.createElement('div');item.className='hnn-dup-item';
    const nameEl=document.createElement('span');nameEl.className='hnn-dup-name';nameEl.textContent=name;
    item.appendChild(nameEl);
    list.forEach(a=>{
      const chip=document.createElement('span');chip.className='hnn-dup-person';
      chip.textContent=a.group.ko+(a.active===false?' · 비활동':'');
      chip.title='눌러서 이 멤버 카드로 이동';
      chip.addEventListener('click',e=>{e.stopPropagation();_dqGotoArtist(a);});
      item.appendChild(chip);
    });
    listEl.appendChild(item);
  });
}
function _renderHnnWhitelist(){
  const listEl=document.getElementById('hnn-wl-list');
  if(!listEl)return;
  listEl.innerHTML='';
  const fixedNames=[..._ATM_HASHTAG_ONLY_NAMES].sort((a,b)=>a.localeCompare(b,'ko'));
  const dynamicNames=[..._ATM_DYNAMIC_HASHTAG_NAMES].sort((a,b)=>a.localeCompare(b,'ko'));
  if(!fixedNames.length&&!dynamicNames.length){listEl.innerHTML='<div style="padding:2px 0;font-size:11px;color:rgba(155,178,228,0.4);">없음</div>';return;}
  function makeChip(name,removable){
    const chip=document.createElement('span');chip.className='hnn-wl-chip'+(removable?'':' hnn-wl-fixed');
    const nameEl=document.createElement('span');nameEl.className='hnn-wl-name';nameEl.textContent=name;
    nameEl.title='눌러서 이 멤버 카드로 이동';
    nameEl.addEventListener('click',e=>{e.stopPropagation();_dqGotoArtistByName(name);});
    chip.appendChild(nameEl);
    if(removable){
      const rm=document.createElement('button');rm.type='button';rm.className='hnn-wl-rm';rm.textContent='×';
      rm.title='보호 목록에서 제거(이후 평문 매칭이 다시 허용됨)';
      rm.addEventListener('click',async e=>{
        e.stopPropagation();
        if(!sb)return;
        if(!confirm(`"${name}"을(를) 보호 목록에서 제거할까요? 이후 이 이름이 해시태그 없이 평문으로도 다시 매칭될 수 있어요.`))return;
        rm.disabled=true;
        const{error}=await sb.from('name_match_whitelist').delete().eq('name',name);
        if(error){alert('제거 실패: '+error.message);rm.disabled=false;return;}
        _ATM_DYNAMIC_HASHTAG_NAMES.delete(name);
        _renderHnnWhitelist();
      });
      chip.appendChild(rm);
    }
    return chip;
  }
  // 코드에 고정된 항목(×로 못 지움, 재배포해야 빠짐)과 관리자가 스캔 화면에서 직접 추가한 항목(×로
  // 바로 제거 가능)을 구분해서 보여줌 — 예전엔 흐림 처리+마우스 오버 툴팁만으로 구분해서 뭐가 다른지
  // 헷갈렸음(2026-08-04, 사용자 제보로 발견).
  if(dynamicNames.length){
    const lbl=document.createElement('div');lbl.className='hnn-wl-sublbl';lbl.textContent='직접 추가함 (× 눌러서 바로 제거 가능)';
    listEl.appendChild(lbl);
    const row=document.createElement('div');row.className='hnn-wl-row';
    dynamicNames.forEach(name=>row.appendChild(makeChip(name,true)));
    listEl.appendChild(row);
  }
  if(fixedNames.length){
    const lbl=document.createElement('div');lbl.className='hnn-wl-sublbl';lbl.textContent='코드에 고정됨 (재배포해야 제거 가능)';
    listEl.appendChild(lbl);
    const row=document.createElement('div');row.className='hnn-wl-row';
    fixedNames.forEach(name=>row.appendChild(makeChip(name,false)));
    listEl.appendChild(row);
  }
}
// 기타 태깅 예외 규칙 3종(성씨제외/동시매칭무시/리터럴전용) — 위 흔한단어 보호 목록과 동일한 톤/구조로
// atm_exception_rules(type,key,value) DB 테이블을 표시+추가+제거. 하드코딩분(admin.js 코드)은 여기서
// 안 보여줌(그 수가 적고 재배포로만 바뀌니 굳이 UI로 노출할 필요 없음 — 화이트리스트처럼 fixed 항목을
// 같이 보여주면 오히려 "여기서 다 관리되는 것"처럼 오해할 수 있어서 DB분만 표시, 2026-08-20).
function _hnnAtmChip(label,removeHandler){
  const chip=document.createElement('span');chip.className='hnn-atm-chip';
  const nameEl=document.createElement('span');nameEl.textContent=label;
  chip.appendChild(nameEl);
  const rm=document.createElement('button');rm.type='button';rm.className='hnn-atm-rm';rm.textContent='×';
  rm.addEventListener('click',async e=>{e.stopPropagation();rm.disabled=true;await removeHandler(rm);});
  chip.appendChild(rm);
  return chip;
}
async function _renderHnnAtmRules(){
  const surEl=document.getElementById('hnn-atm-surname-list');
  const comatchEl=document.getElementById('hnn-atm-comatch-list');
  const litEl=document.getElementById('hnn-atm-literal-list');
  if(!surEl||!comatchEl||!litEl)return;
  surEl.innerHTML='';comatchEl.innerHTML='';litEl.innerHTML='';
  [..._ATM_DYNAMIC_SURNAME_EXCLUDE.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ko')).forEach(([name,surnames])=>{
    [...surnames].forEach(sur=>{
      surEl.appendChild(_hnnAtmChip(`${name} / ${sur}`,async rm=>{
        if(!sb)return;
        if(!confirm(`"${name}"의 성씨 예외("${sur}")를 제거할까요?`)){rm.disabled=false;return;}
        const rest=[...surnames].filter(s=>s!==sur);
        const{error}=rest.length
          ?await sb.from('atm_exception_rules').update({value:rest}).eq('type','surname_exclude').eq('key',name)
          :await sb.from('atm_exception_rules').delete().eq('type','surname_exclude').eq('key',name);
        if(error){alert('제거 실패: '+error.message);rm.disabled=false;return;}
        surnames.delete(sur);
        if(!surnames.size)_ATM_DYNAMIC_SURNAME_EXCLUDE.delete(name);
        _renderHnnAtmRules();
      }));
    });
  });
  [..._ATM_DYNAMIC_AMBIGUOUS_COMATCH].sort((a,b)=>a.localeCompare(b,'ko')).forEach(gko=>{
    comatchEl.appendChild(_hnnAtmChip(gko,async rm=>{
      if(!sb)return;
      if(!confirm(`"${gko}"를 목록에서 제거할까요?`)){rm.disabled=false;return;}
      const{error}=await sb.from('atm_exception_rules').delete().eq('type','ambiguous_comatch').eq('key',gko);
      if(error){alert('제거 실패: '+error.message);rm.disabled=false;return;}
      _ATM_DYNAMIC_AMBIGUOUS_COMATCH.delete(gko);
      _renderHnnAtmRules();
    }));
  });
  [..._ATM_DYNAMIC_LITERAL_ONLY].sort((a,b)=>a.localeCompare(b,'ko')).forEach(tok=>{
    litEl.appendChild(_hnnAtmChip(tok,async rm=>{
      if(!sb)return;
      if(!confirm(`"${tok}"를 목록에서 제거할까요?`)){rm.disabled=false;return;}
      const{error}=await sb.from('atm_exception_rules').delete().eq('type','literal_only').eq('key',tok);
      if(error){alert('제거 실패: '+error.message);rm.disabled=false;return;}
      _ATM_DYNAMIC_LITERAL_ONLY.delete(tok);
      _renderHnnAtmRules();
    }));
  });
}
document.getElementById('hnn-atm-surname-add')?.addEventListener('click',async()=>{
  if(!sb)return;
  const nameEl=document.getElementById('hnn-atm-surname-name'),valEl=document.getElementById('hnn-atm-surname-value');
  const name=(nameEl.value||'').trim(),sur=(valEl.value||'').trim();
  if(!name||!sur)return;
  if(!ARTISTS.some(a=>a.name.ko===name)){alert(`"${name}"은(는) 등록된 멤버 이름이 아니에요 — 정확한 등록명으로 넣어야 규칙이 작동해요(유령 규칙 방지).`);return;} // 입력검증(2026-08-30)
  const existing=_ATM_DYNAMIC_SURNAME_EXCLUDE.get(name);
  const merged=[...(existing||[]),sur];
  const{error}=await sb.from('atm_exception_rules').upsert({type:'surname_exclude',key:name,value:merged},{onConflict:'type,key'});
  if(error){alert('추가 실패: '+error.message);return;}
  if(!_ATM_DYNAMIC_SURNAME_EXCLUDE.has(name))_ATM_DYNAMIC_SURNAME_EXCLUDE.set(name,new Set());
  _ATM_DYNAMIC_SURNAME_EXCLUDE.get(name).add(sur);
  nameEl.value='';valEl.value='';
  _renderHnnAtmRules();
});
document.getElementById('hnn-atm-comatch-add')?.addEventListener('click',async()=>{
  if(!sb)return;
  const valEl=document.getElementById('hnn-atm-comatch-value');
  const gko=(valEl.value||'').trim();
  if(!gko)return;
  if(!GROUPS[gko]){alert(`"${gko}"은(는) 등록된 그룹명이 아니에요 — 정확한 그룹 키로 넣어야 규칙이 작동해요(유령 규칙 방지).`);return;} // 입력검증(2026-08-30)
  const{error}=await sb.from('atm_exception_rules').upsert({type:'ambiguous_comatch',key:gko,value:null},{onConflict:'type,key'});
  if(error){alert('추가 실패: '+error.message);return;}
  _ATM_DYNAMIC_AMBIGUOUS_COMATCH.add(gko);
  valEl.value='';
  _renderHnnAtmRules();
});
document.getElementById('hnn-atm-literal-add')?.addEventListener('click',async()=>{
  if(!sb)return;
  const valEl=document.getElementById('hnn-atm-literal-value');
  const tok=(valEl.value||'').trim();
  if(!tok)return;
  const{error}=await sb.from('atm_exception_rules').upsert({type:'literal_only',key:tok,value:null},{onConflict:'type,key'});
  if(error){alert('추가 실패: '+error.message);return;}
  _ATM_DYNAMIC_LITERAL_ONLY.add(tok);
  valEl.value='';
  _renderHnnAtmRules();
});
// 그룹별 요약/멤버별 의심 후보 스캔("_hnnScan")과 그룹별 무맥락 정리("_dqOpenGroupJunk")는 실사용이
// 없어서 제거함(2026-08-12, 사용자 요청 — "더 이상 새로 걸리는 게 거의 없다", 흔한단어/동명이인은
// 발견 시 개별 대응하는 걸로). 동명이인 목록(_renderHnnDuplicateNames)·흔한단어 보호 목록
// (_renderHnnWhitelist)은 여전히 유용해서 남겨둠 — 새 이름 추가는 이제 스캔 화면 대신 SQL로 직접.
let _wonkokScanned=false;
function _hnnSwitchTab(tab){
  document.querySelectorAll('.hnn-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.hnn-pane').forEach(p=>p.classList.toggle('active',p.id==='hnn-pane-'+tab));
  if(tab==='wonkok'&&!_wonkokScanned){_wonkokScanned=true;setTimeout(()=>document.getElementById('wonkok-scan-btn')?.click(),80);}
}
document.querySelectorAll('.hnn-tab').forEach(t=>t.addEventListener('click',()=>_hnnSwitchTab(t.dataset.tab)));
document.getElementById('hnn-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');});
document.getElementById('sp-hnn-btn')?.addEventListener('click',()=>{_admDockShow('hnn-overlay');_renderHnnWhitelist();_renderHnnDuplicateNames();_renderHnnAtmRules();_hnnSwitchTab('quality');});
document.getElementById('hnn-close')?.addEventListener('click',()=>{
  document.getElementById('hnn-overlay').classList.remove('open');
  // ⚠️ 예전엔 여기서 _wonkokScanned=false로 리셋해서, 검수 센터를 닫았다 열 때마다 원곡 스캔을
  // 처음부터 다시 돌렸음 — 스캔 자체가 무거워서 그것만으로 이 탭을 못 쓰게 만든 원인 중 하나였다
  // (2026-08-25 사용자 제보). 결과는 세션 동안 그대로 두고, 다시 훑고 싶으면 "다시 스캔" 버튼을 쓴다.
});

// ── "원곡: X" 오태깅 의심 목록 ── 다른 사람이 부른 커버 영상 제목에 "(원곡 : 이름)" 식으로 원곡자를
// 표기해둔 걸, 자동 태깅이 "그 원곡자가 출연한다"고 잘못 읽어 members/with_members/with_groups를
// 원곡자 쪽으로 붙여버리는 경우가 실측으로 다수 확인됨(예: 다른 가수의 커버 무대인데 원곡 아티스트의
// 그룹 카드에 노출됨). 완전 자동 처리는 안 하고(오탐 있음 확인됨) 관리자가 후보 목록을 보고 체크박스로
// 골라 확정하게 한다. 괄호는 "(...)" 뿐 아니라 "[Dance Cover] 아이브..."처럼 대괄호도 흔히 씀 — 둘 다 인식.
// 예전엔 members(자체 채널 출연자) 대상 도구와 with_members/with_groups(콜라보 태그) 대상 도구가
// 따로 있었는데, 감지 로직이 사실상 같아서(같은 절 파싱 헬퍼를 공유하고 있었음) 하나로 합침
// (2026-08-04, 사용자 요청 — "따로 있는 게 효율적인가?").
const _WONKOK_BRACKETS={'(':')','[':']'};
// "BE ORIGINAL" 시리즈는 콘텐츠명이지 원곡 크레딧이 아님 — _wonkokStripClause/_wonkokParseClause/
// _wonkokScan 셋 다 같이 참조하는 공용 헬퍼라 최상위(모듈) 스코프에 둬야 한다. 예전엔 _wonkokScan
// 함수 안에서만 지역 const로 선언해서, 그 안에서만 쓰일 땐 괜찮았는데 실제로는 이 두 함수도 이
// 이름을 참조하고 있어서(그 함수들은 이 지역변수를 볼 수 없는 별도 스코프) 스캔이 후보 상세 파싱
// 단계까지 진행되면 "_isBeOriginal is not defined"로 죽는 버그가 있었음(2026-08-11, 사용자 제보).
// "BE ORIGINAL" 외에 "POP ORIGINAL", 그리고 "*_original"(POP_ORIGINAL 등 언더스코어로 이어붙인
// 시리즈 태그)도 같은 댄스/퍼포먼스 콘텐츠 시리즈명이지 원곡 크레딧이 아니라 함께 제외(2026-08-19,
// 사용자 요청 — 커버 끌어오기 오탐 제거). 함수명은 히스토리상 그대로 두되 대상은 아래처럼 넓어짐.
function _isBeOriginal(t){return/\b(?:be|pop)[\s_-]+original\b/i.test(t)||/_original\b/i.test(t);}
function _wonkokStripClause(title){
  let out='',i=0;
  while(i<title.length){
    const close=_WONKOK_BRACKETS[title[i]];
    if(close){
      let depth=0,j=i;
      for(;j<title.length;j++){
        if(title[j]===title[i])depth++;
        else if(title[j]===close){depth--;if(depth===0)break;}
      }
      const inner=title.slice(i+1,Math.min(j,title.length));
      // "(원곡: X)" 뿐 아니라 "(BTS 커버)"/"[Dance Cover]"처럼 괄호 안에 커버/cover 단어가 있는 경우도
      // 같은 위험군이라 통째로 걷어낸다 — 원곡자 이름이 이 괄호 안에 커버 표시와 같이 적히는 관례가 흔함.
      if(/^\s*원곡\s*[:：]?/.test(inner)||/커버|cover/i.test(inner)||(/\boriginal\b/i.test(inner)&&!_isBeOriginal(inner))){i=j<title.length?j+1:title.length;continue;}
    }
    out+=title[i];i++;
  }
  return out;
}
function _wonkokNorm(title){return' '+(title||'').toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';}
function _wonkokHit(norm,name){
  if(!name||name.length<2)return false;
  const n=name.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
  return n&&norm.includes(' '+n+' ');
}
// "(원곡: X)"/"(X 커버)" 절 안의 텍스트를 원곡자 후보(origText)와 실제 출연자(performerText)로 나눈다.
// "Cover by X"/"커버 by X"처럼 by 뒤에 오는 이름은 원곡자가 아니라 이 영상을 실제로 부르거나 촬영한
// 사람(출연자)을 가리키므로, by 앞(origText)에서만 원곡자를 찾고 by 뒤(performerText)에 있는 이름은
// 오히려 "진짜 출연자"로 보호해서 members/with_members에서 지우지 않는다(2026-08-04, 사용자 요청 —
// "by 뒤에 출연자가 올 거 아냐 원곡자가 아니라").
function _wonkokParseClause(title){
  let i=0;
  while(i<(title||'').length){
    const close=_WONKOK_BRACKETS[title[i]];
    if(close){
      let depth=0,j=i;
      for(;j<title.length;j++){
        if(title[j]===title[i])depth++;
        else if(title[j]===close){depth--;if(depth===0)break;}
      }
      const inner=title.slice(i+1,Math.min(j,title.length));
      const m=/^\s*원곡\s*[:：]?\s*/.exec(inner);
      let rest=null;
      if(m)rest=inner.slice(m[0].length);
      // "(BTS 커버)"류 — "원곡:" 같은 고정 접두사가 없어서 뗄 게 없으므로 괄호 안 전체를 원곡자
      // 후보 텍스트로(원곡자 이름이 커버 표시와 같은 괄호 안에 같이 적히는 관례를 그대로 활용).
      else if(/커버|cover/i.test(inner)||(/\boriginal\b/i.test(inner)&&!_isBeOriginal(inner)))rest=inner;
      if(rest!==null){
        const bm=/\bby\b/i.exec(rest);
        if(bm)return{origText:rest.slice(0,bm.index).trim(),performerText:rest.slice(bm.index+bm[0].length).trim()};
        return{origText:rest.trim(),performerText:''};
      }
      i=j<title.length?j+1:title.length;continue;
    }
    i++;
  }
  return{origText:'',performerText:''};
}
function _wonkokNameHits(mko,groupKo,norm){
  if(!norm)return false;
  const artist=ARTISTS.find(a=>a.group.ko===groupKo&&a.name.ko===mko);
  const variants=artist?_m2NameVariants(artist):[mko];
  return variants.some(variant=>_wonkokHit(norm,variant));
}
// 원곡 커버 후보 멤버 하나가 개인(cover_of_members) vs 그룹(cover_of_groups) 중 어디로 귀속될지는
// "(원곡: ...)" 절의 원곡자 텍스트(by 앞)에 그 멤버 이름이 실제로 적혀있는지로 판단한다 — 절에 "이효리"
// 처럼 특정 인물이 콕 집혀있으면 그 사람 개인 귀속(예: "핑클 이효리"), 절이 "아이브"처럼 그룹명만 있고
// 특정 멤버가 안 적혀있으면(멤버가 매칭된 건 절 밖의 다른 이유 — 설명란 등 — 때문) 그룹 귀속.
function _wonkokNamedInClause(mko,groupKo,title){
  const{origText}=_wonkokParseClause(title);
  return origText?_wonkokNameHits(mko,groupKo,_wonkokNorm(origText)):false;
}
let _wonkokCandidates=[];
let _wonkokScanning=false;
async function _wonkokScan(){
  if(_wonkokScanning||!sb)return;
  _wonkokScanning=true;
  const btn=document.getElementById('wonkok-scan-btn');
  const statusEl=document.getElementById('wonkok-status');
  if(btn)btn.disabled=true;
  document.getElementById('wonkok-toolbar').style.display='none';
  document.getElementById('wonkok-list').innerHTML='';
  try{
    // "title ILIKE '%원곡%'"는 검색어가 2글자라 pg_trgm 인덱스도 트라이그램을 못 뽑아 못 타고(3글자 미만
    // 패턴은 인덱스 가속이 안 됨), 8만+ 행을 매번 통째로 순차스캔하면서 유니코드 대소문자무시 패턴매칭까지
    // 겹쳐 statement_timeout에 걸림 — 그래서 서버에는 title 패턴매칭을 아예 안 시키고, id·title만 가볍게
    // (필터 없는 순수 PK 순서 스캔이라 빠름) 전량 페이지네이션으로 받아온 뒤 "원곡" 포함 여부는
    // 클라이언트에서 문자열 검사로 판정한다. 매칭된 소수의 id만 골라 나머지 컬럼을 추가로 조회.
    // ⚠️ 예전엔 여기서 **전체 371,448행을 통째로** 페이지네이션해서 받아온 뒤 클라이언트에서 "원곡"
    // 문자열을 찾았다. `ILIKE '%원곡%'`가 2글자라 pg_trgm 인덱스를 못 타는 게 이유였는데, 그 대가로
    // 검수 센터를 열 때마다 372페이지를 긁어서 몇 분씩 걸렸고 실제로 못 쓰는 기능이 돼 있었음
    // (2026-08-25 사용자 제보). PostgREST의 `imatch`(= `~*` 정규식)를 쓰면 서버에서 바로 걸러진다.
    // 실측: 전체 371,448 → 제목 후보 9,484 + with태그 보유 20,951 (합쳐도 8%).
    // 아래 두 축은 **판정 조건이 서로 달라서** 각각 받아온다:
    //   ① 제목에 원곡/커버 표시가 있는 것 → 괄호절 파서 대상
    //   ② with_groups/with_members가 있는 것 → "여러 그룹 커버 메들리"(multiGroupIds) 구조 신호 대상
    // ⚠️ 정규식은 아래 _wonkokIndicatorRe와 **같은 의미**를 유지해야 한다(한쪽만 고치면 조용히 후보가
    //    빠짐). 서버 필터는 넓게 잡고 정밀 판정은 그대로 클라이언트에서 한다.
    statusEl.textContent='후보 조회 중…';
    const _wkSeen=new Set();
    const idTitleRows=[];
    const _wkPull=async(label,build)=>{
      let last=null;
      while(true){
        let q=build().order('id').limit(1000);
        if(last!==null)q=q.gt('id',last);
        const{data,error:idErr}=await q;
        if(idErr)throw new Error(`${label} 조회 실패(${idTitleRows.length}개까지 받음): ${idErr.message}`);
        if(!data?.length)break;
        data.forEach(v=>{if(!_wkSeen.has(v.id)){_wkSeen.add(v.id);idTitleRows.push(v);}});
        statusEl.textContent=`후보 조회 중… (${idTitleRows.length}개)`;
        if(data.length<1000)break;
        last=data[data.length-1].id;
      }
    };
    const _WK_COLS='id,title,group_ko,with_members,with_groups';
    await _wkPull('제목 후보',()=>sb.from(_YT_TABLE).select(_WK_COLS).filter('title','imatch','원곡|커버|cover|original'));
    await _wkPull('with태그 후보',()=>sb.from(_YT_TABLE).select(_WK_COLS).or('with_groups.neq.{},with_members.neq.{}'));
    const _wonkokIndicatorRe=/원곡|커버|cover|\boriginal\b/i;
    const hitIds=(idTitleRows||[]).filter(v=>{
      const t=v.title||'';
      if(!_wonkokIndicatorRe.test(t))return false;
      // "original"만 매칭됐는데 "be original" 패턴이면 제외
      if(/\boriginal\b/i.test(t)&&!/원곡|커버|cover/i.test(t))return !_isBeOriginal(t);
      return true;
    }).map(v=>v.id);
    // "한 그룹이 여러 그룹 노래를 커버해서 그 원곡자들이 전부 with_members/with_groups(콜라보)로 잘못
    // 들어간" 경우 — with_groups + with_members에서 뽑아낸 그룹이 자기 자신 빼고 2개 이상이면 후보로
    // 삼는다. 실제로 한 영상에서 서로 다른 그룹 2곳 이상과 동시에 진짜 콜라보할 가능성보다, 커버
    // 메들리에서 원곡자들이 콜라보로 오인식됐을 가능성이 훨씬 높음 — "(원곡: ...)" 괄호 절이 없어도
    // (원곡 표기가 제목 여기저기 흩어져 있어 깔끔한 절로 안 묶여도) 이 구조적 신호만으로 잡는다
    // (2026-08-04, 사용자 요청 — "한 그룹이 여러 그룹 노래를 커버한 경우에 다 with로 들어간 경우").
    const multiGroupIds=[];
    (idTitleRows||[]).forEach(v=>{
      const gset=new Set(v.with_groups||[]);
      (v.with_members||[]).forEach(s=>{
        const m=s.match(/^(.*)\((.*)\)$/);
        if(m)gset.add(m[2]);
      });
      gset.delete(v.group_ko);
      if(gset.size>=2)multiGroupIds.push(v.id);
    });
    const multiGroupIdSet=new Set(multiGroupIds);
    // "Dance Cover"/"커버댄스"류 — "(원곡: X)"/"(X 커버)"처럼 커버 표시가 괄호 절 안에 깔끔하게 안
    // 묶이고 제목 평문에 그냥 노출된 경우(예: "미쓰에이 Bad Girl Good Girl 커버댄스 by 체리블렛",
    // "PRIMROSE 'HUSH'(miss A) Dance COVER Video") — 위 괄호절 파서로는 못 잡아서 신인 그룹이 선배
    // 그룹 안무를 커버한 영상 다수가 계속 with_groups(콜라보)로 잘못 남아있었음(2026-08-11, 사용자
    // 제보 — "신인 아이돌이 메이저 선배 그룹 커버댄스 하는 영상 오류 많다"). multiGroupIds와 같은
    // 구조적 신호 방식이지만, 이쪽은 그룹이 하나만 걸려도(대부분 실측 케이스가 with_groups 딱 1개)
    // 후보로 삼는다 — 대신 그 그룹/멤버 이름이 실제로 제목에 등장하는지는 아래 후보 검사 단계에서
    // 한 번 더 확인해서(이름이 우연히도 전혀 안 나오면 걸러짐) 오탐을 줄인다.
    const _DANCE_COVER_RE=/dance\s*cover|커버\s*댄스|cover\s*dance|cover\s*video/i;
    const danceCoverIds=(idTitleRows||[]).filter(v=>_DANCE_COVER_RE.test(v.title||'')).map(v=>v.id);
    const danceCoverIdSet=new Set(danceCoverIds);
    const allIds=[...new Set([...hitIds,...multiGroupIds,...danceCoverIds])];
    if(!allIds.length){
      _wonkokCandidates=[];
      statusEl.textContent=`스캔 완료 — 전체 ${idTitleRows?.length||0}개 중 후보 0개`;
      _renderWonkokList();
      return;
    }
    statusEl.textContent=`후보 ${allIds.length}개 상세 조회 중…`;
    const rows=[];
    for(let i=0;i<allIds.length;i+=200){
      // members(자체 출연)와 with_members/with_groups(콜라보 태그)를 한 쿼리로 같이 조회 — 예전엔 이걸
      // 두 도구가 따로 조회했음.
      const{data,error}=await sb.from(_YT_TABLE)
        .select('id,title,group_ko,members,with_members,with_groups,thumb,content_flag,cover_of_members,cover_of_groups')
        .in('id',allIds.slice(i,i+200))
        .eq('tags_manual',false); // 관리자가 이미 직접 확정한 태그는 오태깅 후보로 다시 흔들지 않음
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      rows.push(...(data||[]));
    }
    const filtered=rows.filter(v=>((v.members||[]).length>0||(v.with_members||[]).length>0||(v.with_groups||[]).length>0)&&v.content_flag!=='무관'&&v.content_flag!=='hidden');
    statusEl.textContent=`${filtered.length}개 후보 검사 중…`;
    const candidates=[];
    for(const v of filtered){
      const{origText,performerText}=_wonkokParseClause(v.title||'');
      const isMultiGroupCover=multiGroupIdSet.has(v.id);
      let toMoveMem=[],toMoveWithMem=[],toMoveWithGrp=[];
      if(origText){
        const origNorm=_wonkokNorm(origText);
        const perfNorm=performerText?_wonkokNorm(performerText):null;
        // members: 절을 뺀 나머지 제목에 이름이 안 남아있고(본인이 직접 부른 커버가 아니라는 뜻) + by 뒤
        // 출연자 텍스트에도 없어야 진짜 "원곡자 크레딧만 있는" 오태깅으로 본다.
        const strippedNorm=_wonkokNorm(_wonkokStripClause(v.title||''));
        toMoveMem=(v.members||[]).filter(mko=>{
          if(perfNorm&&_wonkokNameHits(mko,v.group_ko,perfNorm))return false;
          if(_wonkokNameHits(mko,v.group_ko,strippedNorm))return false;
          return _wonkokNameHits(mko,v.group_ko,origNorm);
        });
        // with_members/with_groups: 원곡자 텍스트(by 앞)에 이름이 있으면 후보 — by 뒤(출연자 텍스트)에
        // 있으면 실제 이 영상에 나온 사람이므로 후보에서 뺀다.
        toMoveWithMem=(v.with_members||[]).filter(s=>{
          const m=s.match(/^(.*)\((.*)\)$/);
          if(!m)return false;
          const[,mko,gko]=m;
          if(perfNorm&&_wonkokNameHits(mko,gko,perfNorm))return false;
          return _wonkokNameHits(mko,gko,origNorm);
        });
        toMoveWithGrp=(v.with_groups||[]).filter(gko=>{
          const en=(GROUPS[gko]||{}).en||'';
          if(perfNorm&&(_wonkokHit(perfNorm,gko)||(en&&_wonkokHit(perfNorm,en))))return false;
          return _wonkokHit(origNorm,gko)||(en&&_wonkokHit(origNorm,en));
        });
      }
      if(danceCoverIdSet.has(v.id)){
        // "Dance Cover"/"커버댄스"류(괄호 절 없이 평문에 노출) — with_members/with_groups에 걸린
        // 그룹/멤버 이름이 제목에 실제로 등장하는 경우만 원곡자 후보로 삼는다(이름이 전혀 안 나오면
        // 이 영상과 무관한 태그일 수 있으니 건드리지 않고 그대로 둠 — 오탐 방지).
        const titleNorm=_wonkokNorm(v.title||'');
        const dcWithMem=(v.with_members||[]).filter(s=>{
          const m=s.match(/^(.*)\((.*)\)$/);
          if(!m)return false;
          return _wonkokNameHits(m[1],m[2],titleNorm);
        });
        const dcWithGrp=(v.with_groups||[]).filter(gko=>{
          const en=(GROUPS[gko]||{}).en||'';
          return _wonkokHit(titleNorm,gko)||(en&&_wonkokHit(titleNorm,en));
        });
        toMoveWithMem=[...new Set([...toMoveWithMem,...dcWithMem])];
        toMoveWithGrp=[...new Set([...toMoveWithGrp,...dcWithGrp])];
      }
      if(isMultiGroupCover){
        // 괄호 절 기반 판정과 별개로, 여러 그룹 커버 신호가 있으면 with_members/with_groups 전체를
        // 원곡자 후보로 합침(이미 위에서 일부 골라졌으면 합집합).
        toMoveWithMem=[...new Set([...toMoveWithMem,...(v.with_members||[])])];
        toMoveWithGrp=[...new Set([...toMoveWithGrp,...(v.with_groups||[])])];
      }
      if(toMoveMem.length||toMoveWithMem.length||toMoveWithGrp.length){
        candidates.push({...v,toMoveMem,toMoveWithMem,toMoveWithGrp,isMultiGroupCover});
      }
    }
    _wonkokCandidates=candidates;
    statusEl.textContent=`스캔 완료 — 전체 ${idTitleRows?.length||0}개 중 오태깅 의심 ${candidates.length}개`;
    _renderWonkokList();
  }catch(e){
    statusEl.textContent='오류: '+e.message;
  }finally{
    _wonkokScanning=false;
    if(btn)btn.disabled=false;
  }
}
function _renderWonkokList(){
  const listEl=document.getElementById('wonkok-list');
  const toolbarEl=document.getElementById('wonkok-toolbar');
  listEl.innerHTML='';
  if(!_wonkokCandidates.length){
    listEl.innerHTML='<div id="wonkok-empty">의심 후보가 없어요</div>';
    toolbarEl.style.display='none';
    return;
  }
  toolbarEl.style.display='flex';
  document.getElementById('wonkok-select-all').checked=true;
  _wonkokCandidates.forEach(v=>{
    const item=document.createElement('div');item.className='wk-item';item.dataset.vidId=v.id;
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;
    cb.addEventListener('change',_updateWonkokCount);
    const img=document.createElement('img');img.className='wk-thumb';img.src=v.thumb||'';img.loading='lazy';
    const info=document.createElement('div');info.className='wk-info';
    const grp=document.createElement('div');grp.className='wk-group';
    // 이동 시 실제로 적용될 귀속(그룹 vs 개인)을 미리 보여줌 — "(원곡: ...)" 절 안에 멤버 이름이
    // 콕 집혀있으면 개인 귀속, 절에 그룹명만 있으면 그룹 전체 귀속.
    const namedMembers=v.toMoveMem.filter(mko=>_wonkokNamedInClause(mko,v.group_ko,v.title));
    const groupLevel=v.toMoveMem.some(mko=>!_wonkokNamedInClause(mko,v.group_ko,v.title));
    const parts=[];
    if(groupLevel)parts.push('그룹 전체로 귀속');
    if(namedMembers.length)parts.push(`<b>${namedMembers.join(', ')}</b> 개인으로 귀속`);
    if(v.toMoveWithMem.length)parts.push(`콜라보 <b>${v.toMoveWithMem.map(s=>s.replace(/\(.*\)$/,'')).join(', ')}</b> → 원곡자로`);
    if(v.toMoveWithGrp.length)parts.push(`콜라보 그룹 <b>${v.toMoveWithGrp.join(', ')}</b> → 원곡자로`);
    const multiGroupBadge=v.isMultiGroupCover?'<span class="wk-multigrp-badge">여러 그룹 커버 감지</span> ':'';
    grp.innerHTML=`${multiGroupBadge}${v.group_ko||''} · ${parts.join(' / ')}`;
    const ttl=document.createElement('div');ttl.className='wk-title';ttl.textContent=v.title||'';
    info.appendChild(grp);info.appendChild(ttl);
    const editBtn=document.createElement('button');editBtn.className='vid-edit-btn';editBtn.type='button';editBtn.textContent='✎';
    editBtn.title='직접 재태깅';
    editBtn.addEventListener('click',e=>{e.stopPropagation();_openVidTagModal({id:v.id,title:v.title},v.group_ko);});
    item.appendChild(cb);item.appendChild(img);item.appendChild(info);item.appendChild(editBtn);
    listEl.appendChild(item);
  });
  _updateWonkokCount();
}
function _updateWonkokCount(){
  const total=_wonkokCandidates.length;
  const checked=document.querySelectorAll('#wonkok-list .wk-item input[type=checkbox]:checked').length;
  document.getElementById('wonkok-count').textContent=`${checked}/${total}개 선택됨`;
  const applyBtn=document.getElementById('wonkok-apply-btn');
  if(applyBtn)applyBtn.disabled=checked===0;
  const allEl=document.getElementById('wonkok-select-all');
  if(allEl)allEl.checked=checked===total&&total>0;
}
document.getElementById('wonkok-select-all')?.addEventListener('change',e=>{
  document.querySelectorAll('#wonkok-list .wk-item input[type=checkbox]').forEach(cb=>{cb.checked=e.target.checked;});
  _updateWonkokCount();
});
// 선택 항목 적용: members/with_members/with_groups에서 이동 대상만 빼고, cover_of_members/
// cover_of_groups로 옮긴다(content_flag='무관'만 찍으면 원래 컬럼값이 그대로 남아 연결 카드 등에
// 유령처럼 계속 걸리는 문제가 있었음).
const WONKOK_APPLY_LABEL='선택 항목 원곡 커버로 이동';
document.getElementById('wonkok-apply-btn')?.addEventListener('click',async()=>{
  if(!sb)return;
  const btn=document.getElementById('wonkok-apply-btn');
  const items=[...document.querySelectorAll('#wonkok-list .wk-item')].filter(el=>el.querySelector('input[type=checkbox]').checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const idSet=new Set(ids);
  const targets=_wonkokCandidates.filter(v=>idSet.has(v.id));
  try{
    for(const v of targets){
      const newCoverMembers=new Set(v.cover_of_members||[]);
      const newCoverGroups=new Set(v.cover_of_groups||[]);
      const moveMemSet=new Set(v.toMoveMem);
      const moveWithMemSet=new Set(v.toMoveWithMem);
      const moveWithGrpSet=new Set(v.toMoveWithGrp);
      v.toMoveMem.forEach(mko=>{
        if(_wonkokNamedInClause(mko,v.group_ko,v.title))newCoverMembers.add(`${mko}(${v.group_ko})`);
        else newCoverGroups.add(v.group_ko);
      });
      v.toMoveWithMem.forEach(s=>newCoverMembers.add(s));
      v.toMoveWithGrp.forEach(g=>newCoverGroups.add(g));
      const newMembers=(v.members||[]).filter(mko=>!moveMemSet.has(mko));
      const newWithMembers=(v.with_members||[]).filter(s=>!moveWithMemSet.has(s));
      const newWithGroups=(v.with_groups||[]).filter(g=>!moveWithGrpSet.has(g));
      const{error}=await sb.from(_YT_TABLE).update({
        members:newMembers,
        with_members:newWithMembers,
        with_groups:newWithGroups,
        cover_of_members:[...newCoverMembers],
        cover_of_groups:[...newCoverGroups]
      }).eq('id',v.id);
      if(error)throw error;
    }
  }catch(e){
    btn.disabled=false;btn.textContent=WONKOK_APPLY_LABEL;
    document.getElementById('wonkok-status').textContent='오류: '+e.message;
    return;
  }
  _wonkokCandidates=_wonkokCandidates.filter(v=>!idSet.has(v.id));
  items.forEach(el=>el.remove());
  document.getElementById('wonkok-status').textContent=`${ids.length}개 커버로 이동 완료 — 남은 후보 ${_wonkokCandidates.length}개`;
  btn.textContent=WONKOK_APPLY_LABEL;
  _updateWonkokCount();
  if(!_wonkokCandidates.length)_renderWonkokList();
});
document.getElementById('wonkok-scan-btn')?.addEventListener('click',_wonkokScan);
document.getElementById('wonkok-close')?.addEventListener('click',()=>document.getElementById('hnn-overlay').classList.remove('open'));

// ── 전체 영상 검색(admin) ── 그룹/멤버 무관하게 title 검색. 3글자 이상은 서버 ILIKE(트라이그램 인덱스로
// 빠름), 1~2글자는 인덱스 가속이 안 되므로(pg_trgm은 3글자 미만 패턴을 못 씀) id/title/group_ko/thumb/
// category 전량을 한 번 키셋 페이지네이션으로 캐시해서 브라우저에서 검색한다 — "원곡" 스캔 타임아웃을
// 고치며 확인한 방식(필터 없는 순수 PK 순서 스캔은 빠름)을 그대로 재사용. 캐시는 페이지를 새로고침하기
// 전까지 유지(패널을 여러 번 열어도 매번 재조회하지 않음).
let _avsAllRows=null;
async function _avsEnsureCache(){
  if(_avsAllRows)return _avsAllRows;
  const statusEl=document.getElementById('avs-status');
  const rows=[];
  let lastId=null;
  while(true){
    let q=sb.from(_YT_TABLE).select('id,title,group_ko,thumb,category,is_short,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups').order('id').limit(1000);
    if(lastId!==null)q=q.gt('id',lastId);
    const{data,error}=await q;
    if(error)throw error;
    if(!data?.length)break;
    // 3글자 이상 검색(ilike)은 title_norm 컬럼과 비교해 대소문자·유니코드 스타일드 문자를 다 흡수하는데,
    // 이 1~2글자 캐시 경로는 원래 title 그대로 .includes()로 비교해서 대소문자가 다르면(예: 소문자로
    // "v" 검색 — 제목엔 "V") 매칭이 안 되던 버그가 있었음(2026-08-14, 사용자 제보). 매 키 입력마다 매번
    // 정규화하면 느려지니 캐시 시점에 한 번만 미리 계산해둔다.
    data.forEach(v=>{v._tn=_titleNorm(v.title);v._gtn=_titleNorm(v.group_ko);});
    rows.push(...data);
    if(statusEl)statusEl.textContent=`전체 목록 준비 중… (${rows.length}개)`;
    if(data.length<1000)break;
    lastId=data[data.length-1].id;
  }
  _avsAllRows=rows;
  return rows;
}

// ── 영상 관리 통합 패널 ──
let _vmTab='all';       // 'all' | 'nomem' | 'hidden' | 'channels'
let _vmChTab='official'; // 'official' | 'ext'
let _vmChTierFilter='all'; // 'all' | 'music' | 'variety' | 'magazine' | 'idol' | 'show' — "그외" 탭 안에서만 씀
let _vmRows=[];
let _vmSearchGen=0;
let _vmSearchTimer=null;
let _vmSearch2=''; // 1차 검색 결과(_vmRows) 안에서 한 번 더 좁히는 재검색어 — 새 조회 없이 클라이언트 필터만
let _vmSearch2Timer=null;
// '전체' 탭 검색은 content_flag 상관없이 다 섞여 나오는데(무관/숨김/기타/외부인/개별출연 포함), 그중
// 정상 노출 중인 것만 보고 싶을 때가 있어서 추가한 클라이언트 사이드 토글(2026-08-14, 사용자 요청).
let _vmOnlyNormal=false;

// ── 그룹배정 검수 큐의 정의(한 곳) ────────────────────────────────────────────
// needs_review=true 이면서 **아직 '무관'으로 정리되지 않은** 것. 2026-08-27 사용자 제보 — 검수 탭에서
// 본 영상을 나중에 무관 처리했는데도 큐에 계속 남아 있었다(실측 156건 중 11건이 그 상태). 무관은
// "이 그룹배정이 틀렸다"는 판정이라 검수를 이미 마친 것과 같으므로 큐에서 빠지는 게 맞다.
// ⚠️ 큐 목록(_vmLoad의 review 탭)과 관리자 홈 카운트 카드가 **반드시 같은 정의**를 써야 한다 —
//    한쪽만 고치면 "카드엔 156개인데 열어보면 145개"로 어긋난다(같은 날 루틴/버튼 드리프트 사고와
//    같은 종류라 아예 함수 하나로 묶었다). tests/routine-parity.test.js가 이 대응도 검사한다.
function _vmReviewQueueFilter(q){
  // tags_manual 제외(2026-08-31 사용자 제보 — "내가 수동편집한 건 아예 안 떠야지"). 편집 모달에서
  // 직접 고쳐 저장한 행은 사람이 이미 판단을 끝낸 것이라 "그룹배정이 맞나?"를 다시 물을 이유가 없다.
  // (예전엔 편집 저장이 needs_review를 안 내려서, 큐에서 열어 고쳐도 그 자리에 계속 남았다.)
  return q.eq('needs_review',true).or('content_flag.is.null,content_flag.neq.무관').or('tags_manual.is.null,tags_manual.is.false');
}

// ── 탭 조회 결과 캐시 ─────────────────────────────────────────────────────────
// 탭을 옮겼다 돌아올 때마다 같은 쿼리를 통째로 다시 던지고 있었다 — 검수 큐·strictSync·카테고리 잠금은
// _sbFetchAll로 수만 행을 긁어서 몇 초씩 걸린다(2026-08-27 사용자 요청).
// 이미 캐시되던 것: '전체' 탭의 1~2글자 검색(_avsEnsureCache — 페이지 새로고침 전까지 전량 유지)과
// '채널' 탭(_EXT_CHANNELS 메모리 배열이라 네트워크 자체가 없음). 나머지 탭은 전부 매번 재조회였다.
// (구 _VM_CACHE_TTL 3분 자동만료는 vm개선 3(a)에서 제거 — 세션 동안 캐시 유지, 갱신은 수동 ↻로만)
const _vmCache=new Map();   // key(tab \0 검색어) → {rows, status, ts}
let _vmCacheKeyCur=null;
const _vmCacheKey=(tab,term)=>tab+' '+(term||'');
// 쓰기가 일어나면 지금 보고 있는 탭 말고 다른 탭 캐시는 버린다 — 무관 처리 한 번으로 '무관' 탭과 검수
// 큐가 동시에 바뀌므로, 남겨두면 다른 탭에서 사라진 행이 되살아난 것처럼 보인다.
function _vmCacheDropOthers(){
  for(const k of[..._vmCache.keys()])if(k!==_vmCacheKeyCur)_vmCache.delete(k);
  // 디스크 쪽은 지금 보고 있는 것 하나만 남기고 전부 폐기(메모리에 없던 지난 세션 캐시 포함).
  _vmIdbTx('readonly',st=>st.getAllKeys?st.getAllKeys():null)
    .then(keys=>(keys||[]).forEach(k=>{if(k!==_vmCacheKeyCur)_vmIdbDel(k);}));
}
// vm개선 3b(안전형) — 쓰기 후 모든 타탭을 버리는 대신, 이 쓰기로 멤버십이 바뀌는 탭만 폐기한다:
// 검수계열(항상) + toFlag의 상태탭(도착) + 현재 상태탭(출발). 그 외 상태탭(안 바뀜)·전체검색은 캐시 유지.
// ⚠️ Fable의 "행 삽입" 대신 '폐기 후 재조회'로 — 탭별 컬럼/검색필터/정렬 불일치 리스크 회피.
// ⚠️ 현재 탭이 상태탭이 아니면(전체 등) 출발 상태가 행마다 달라 불명 → 상태탭 전부 폐기(안전 폴백).
function _vmCacheDropAffected(toFlag){
  const FLAG_TAB={'무관':'nomem','보류':'hold','hidden':'hidden'},STATUS=['nomem','hold','hidden'];
  const drop=new Set(['ss','review','orphan','catlock','new']); // 검수계열은 플래그 붙으면 큐서 빠짐
  if(FLAG_TAB[toFlag])drop.add(FLAG_TAB[toFlag]);
  if(STATUS.includes(_vmTab))drop.add(_vmTab); else STATUS.forEach(t=>drop.add(t));
  for(const k of[..._vmCache.keys()]){if(k===_vmCacheKeyCur)continue;const tab=k.slice(0,k.indexOf(' '));if(drop.has(tab))_vmCache.delete(k);}
  // ⚠️ 메모리에 없고 디스크에만 있는 탭도 같이 버려야 한다 — 위 루프는 _vmCache만 훑으므로, 지난
  //    세션에 봤던 탭(메모리엔 없음)의 IDB 캐시가 남아 새로고침 후 처리한 행이 되살아난다.
  _vmIdbDropTabs(drop,_vmCacheKeyCur);
}
// 현재 탭 캐시를 지금 _vmRows 상태로 덮어쓴다(조회 직후, 그리고 행을 갱신·삭제한 뒤에 부른다).
let _vmIdbSaveTimer=null;
function _vmCacheSync(){
  if(!_vmCacheKeyCur)return;
  // 탭 라벨의 개수 배지도 여기서 같이 갱신한다 — 조회 직후에도, 일괄 처리로 행이 빠진 뒤에도
  // 이 함수가 불리므로 배지가 목록과 항상 붙어 다닌다(따로 부르면 한쪽만 갱신되는 드리프트가 생김).
  _vmSetTabCount(_vmTab,_vmRows.length);
  const status=document.getElementById('vm-status')?.textContent||'';
  _vmCache.set(_vmCacheKeyCur,{rows:_vmRows,status,ts:Date.now()});
  // 디스크(IndexedDB)에도 남긴다 — 새로고침 후 복원용. 이 함수는 행 하나 고칠 때마다도 불리므로
  // 수 MB를 매번 쓰지 않도록 디바운스한다(마지막 상태만 남으면 충분).
  clearTimeout(_vmIdbSaveTimer);
  const key=_vmCacheKeyCur,rows=_vmRows;
  _vmIdbSaveTimer=setTimeout(()=>_vmIdbPut(key,rows,status),1200);
}
// vm개선 3(2026-09-01) — 캐시 세션 유지 + 재진입 복원.
const _VM_LAST_LS='kpu_vm_last';
function _vmSaveLast(){
  try{localStorage.setItem(_VM_LAST_LS,JSON.stringify({tab:_vmTab,search:document.getElementById('vm-search')?.value||'',scrollTop:document.getElementById('vm-list')?.scrollTop||0}));}catch(e){}
}
// 현재 탭 캐시를 버리고 강제 재조회(상태줄 ↻ 버튼) — TTL을 없앤 대신 수동 갱신 경로.
function _vmForceReload(){ if(_vmCacheKeyCur){_vmCache.delete(_vmCacheKeyCur);_vmIdbDel(_vmCacheKeyCur);} _vmLoad(undefined,true); }

// ── 마지막 조회분 영속 캐시(IndexedDB, 2026-09-02) ────────────────────────────────
// 위 _vmCache는 메모리라 **새로고침 한 번에 통째로 날아간다** — 어드민이 패널을 다시 열 때마다 수천 행을
// 처음부터 다시 받고 있었다("매번 조회하는 거 너무 불편하다", 사용자 제보). 마지막 결과를 그대로 저장해
// 두고 다음 세션에서 즉시 복원한다. localStorage가 아니라 IndexedDB인 이유는 용량 — 무관 탭만 7,443행
// (행당 약 330B, 약 2.4MB)이라 localStorage 총 5MB 한도를 혼자 절반 넘게 먹는다.
// ⚠️ 이건 어디까지나 "지난번에 본 것"이다. 그래서 복원 시 항상 조회 시각(N분 전/N시간 전)과 ↻를 같이
//    띄우고, 캐시를 버리는 모든 경로(_vmCacheDropOthers/_vmCacheDropAffected/clear)에서 IDB도 같이
//    지운다 — 안 그러면 새로고침 후에 이미 처리한 행이 되살아난 것처럼 보인다.
const _VM_IDB_NAME='kpu_admin',_VM_IDB_STORE='vm_cache',_VM_IDB_MAX_AGE=7*864e5; // 7일 지나면 안 씀
let _vmIdbP=null;
function _vmIdb(){
  if(_vmIdbP)return _vmIdbP;
  _vmIdbP=new Promise(res=>{
    let rq;
    try{rq=indexedDB.open(_VM_IDB_NAME,1);}catch(e){return res(null);}
    rq.onupgradeneeded=()=>{const db=rq.result;if(!db.objectStoreNames.contains(_VM_IDB_STORE))db.createObjectStore(_VM_IDB_STORE);};
    rq.onsuccess=()=>res(rq.result);
    rq.onerror=rq.onblocked=()=>res(null);
  });
  return _vmIdbP;
}
// 저장소가 없거나(사생활 보호 모드 등) 실패해도 앱은 그냥 네트워크 조회로 돌아간다 — 전부 fail-open.
function _vmIdbTx(mode,fn){
  return _vmIdb().then(db=>{
    if(!db)return null;
    return new Promise(res=>{
      try{
        const rq=fn(db.transaction(_VM_IDB_STORE,mode).objectStore(_VM_IDB_STORE));
        if(!rq)return res(null);
        rq.onsuccess=()=>res(rq.result===undefined?null:rq.result);
        rq.onerror=()=>res(null);
      }catch(e){res(null);}
    });
  }).catch(()=>null);
}
const _vmIdbGet=key=>_vmIdbTx('readonly',st=>st.get(key));
const _vmIdbDel=key=>_vmIdbTx('readwrite',st=>st.delete(key));
const _vmIdbClear=()=>_vmIdbTx('readwrite',st=>st.clear());
// 해당 탭의 디스크 캐시를 **검색어별 변형까지 전부** 지운다. 키가 `탭 검색어` 형태라 탭만 알고
// 지우려 하면 `탭 ` 하나만 지워져서, "무관 탭에서 검색해둔 목록"이 남아 새로고침 후 이미 처리한
// 행이 되살아난다 — 실제 키를 열거해서 접두사로 지운다.
async function _vmIdbDropTabs(tabs,keepKey){
  const keys=await _vmIdbTx('readonly',st=>st.getAllKeys?st.getAllKeys():null);
  if(!keys)return;
  for(const k of keys){
    if(k===keepKey)continue;
    const t=String(k).slice(0,String(k).indexOf(' '));
    if(tabs.has(t))_vmIdbDel(k);
  }
}
function _vmIdbPut(key,rows,status){
  // 구조화 복제(structured clone)라 순환참조·DOM이 들어있으면 통째로 실패한다 — _vmRows는 순수 데이터지만
  // orphan 탭의 _orphans처럼 파생 필드가 붙어도 문자열 배열이라 안전하다.
  return _vmIdbTx('readwrite',st=>st.put({rows,status,ts:Date.now()},key));
}
// 캐시 복원 시 상태줄에 "N분 전 · ↻" 표시. 조회 시각(ts)은 실제 조회 시점 그대로 — 볼 때마다 갱신하면
// (슬라이딩) 얼마나 오래된 목록인지 알 수 없게 된다.
function _vmAppendCacheChrome(statusEl,ts,fromDisk){
  const ago=Date.now()-ts;
  const label=ago<60000?'방금':ago<3600000?`${Math.round(ago/60000)}분 전`
    :ago<86400000?`${Math.round(ago/3600000)}시간 전`:`${Math.round(ago/86400000)}일 전`;
  const ref=document.createElement('span');
  ref.innerHTML=` <span style="opacity:.55">· ${label} 조회${fromDisk?' (저장된 목록)':''}</span> <button class="vm-reload-btn" type="button" title="다시 조회" style="background:none;border:none;color:rgba(155,178,228,0.5);cursor:pointer;font-size:12px;padding:0 3px;vertical-align:middle;">↻</button>`;
  ref.querySelector('.vm-reload-btn')?.addEventListener('click',_vmForceReload);
  statusEl.appendChild(ref);
}

// ── 받는 대로 그리기(2026-09-02) ────────────────────────────────────────────────
// _sbFetchAll의 onPage 훅에 물릴 콜백을 만든다. _vmRenderVideoList는 목록을 통째로 다시 그리므로
// 페이지마다 부르면 오히려 버벅인다 → 첫 페이지는 즉시, 이후는 500ms 스로틀.
// ⚠️ 사용자가 이미 체크박스를 건드렸으면 다시 그리지 않는다 — 재렌더가 선택을 전부 날리기 때문.
//    스크롤 위치도 재렌더 전후로 보존한다(로딩 중에 목록이 맨 위로 튀지 않게).
function _vmProgressive(myGen,sortFn,label){
  let last=0;
  return (page,acc)=>{
    if(myGen!==_vmSearchGen)return false; // 탭이 바뀌었으면 이 조회는 버린다
    const first=acc.length<=page.length;
    if(!first&&Date.now()-last<500)return true;
    if(document.querySelector('#vm-list input[type=checkbox]:checked'))return true;
    last=Date.now();
    _vmRows=sortFn?sortFn(acc):acc.slice();
    const st=document.getElementById('vm-status');
    if(st)st.textContent=`${label} 조회 중… ${acc.length}개`;
    const lst=document.getElementById('vm-list');
    const sc=lst?lst.scrollTop:0;
    _vmRenderVideoList();
    if(lst)lst.scrollTop=sc;
    return true;
  };
}

// ── 전체 개수 상시 표시(2026-09-01, vm개선 2) — 패널 상단에 전체·상태별 카운트 ──────────────
// content_flag 인덱스가 있어 count(head)는 빠름. 캐시(localStorage)를 즉시 그린 뒤 백그라운드로 갱신,
// 쓰기가 일어나면 디바운스 재조회(_vmScheduleTotals). 완전 정확한 로컬 가감 대신 재조회로 단순·정확 우선.
const _VM_TOTALS_LS='kpu_vm_totals';
let _vmTotalsTimer=null;
function _vmRenderTotals(){
  const el=document.getElementById('vm-totals');if(!el)return;
  let c=null;try{c=JSON.parse(localStorage.getItem(_VM_TOTALS_LS)||'null');}catch(e){}
  if(!c||!c.counts){el.classList.remove('show');return;}
  const k=c.counts,ago=Math.max(0,Math.round((Date.now()-c.ts)/60000)),n=x=>Number(x||0).toLocaleString();
  const etc=Math.max(0,k.total-(k.normal+k.nomem+k.hold+k.hidden));
  el.innerHTML=`전체 <b>${n(k.total)}</b> · 정상 <b>${n(k.normal)}</b> · 무관 <b>${n(k.nomem)}</b> · 보류 <b>${n(k.hold)}</b> · 숨김 <b>${n(k.hidden)}</b> · 기타 <b>${n(etc)}</b> <span style="opacity:.6">· ${ago}분 전</span> <button class="vm-totals-refresh" type="button" title="다시 조회">↻</button>`;
  el.querySelector('.vm-totals-refresh')?.addEventListener('click',()=>_vmFetchTotals());
  el.classList.add('show');
}
async function _vmFetchTotals(){
  if(!sb)return;
  const cnt=async(f)=>{let q=sb.from(_YT_TABLE).select('id',{count:'exact',head:true});
    if(f==='__null')q=q.is('content_flag',null);else if(f)q=q.eq('content_flag',f);
    try{const{count}=await q;return count||0;}catch(e){return 0;}};
  const[total,normal,nomem,hold,hidden]=await Promise.all([cnt(null),cnt('__null'),cnt('무관'),cnt('보류'),cnt('hidden')]);
  localStorage.setItem(_VM_TOTALS_LS,JSON.stringify({counts:{total,normal,nomem,hold,hidden},ts:Date.now()}));
  _vmRenderTotals();
}
function _vmScheduleTotals(){clearTimeout(_vmTotalsTimer);_vmTotalsTimer=setTimeout(_vmFetchTotals,800);}
// 좌측 도킹 슬롯(z58)을 관리 패널 4개(홈·hnn·vm·gp)가 공유하는데 서로 안 닫아 겹쳐 보이던 버그
// (2026-09-01 사용자 제보 — hnn 열린 채 vm 열면 vm이 밑에 깔림). 하나 열 때 나머지는 반드시 닫는다.
// ⚠️ _bringToFront는 안 씀 — 카드 위로 올라가 도킹 목적이 뒤집힘(CSS 1584 주석).
function _admDockShow(id){
  ['adm-home-overlay','hnn-overlay','vm-overlay','gp-overlay'].forEach(o=>{
    document.getElementById(o)?.classList[o===id?'add':'remove']('open');
  });
}
function _vmOpen(tab){
  // vm개선 3(c): tab 인자 없이(설정 버튼으로) 열면 마지막 탭·검색어·스크롤 복원. 홈 카드처럼 tab을
  // 명시해 열면 그 탭 우선(복원 안 함).
  let saved=null;
  if(!tab){try{saved=JSON.parse(localStorage.getItem(_VM_LAST_LS)||'null');}catch(e){}}
  _vmTab=tab||(saved&&saved.tab)||'all';
  document.querySelectorAll('.vm-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===_vmTab));
  document.getElementById('vm-search').value=(saved&&saved.search)||'';
  document.getElementById('vm-search-2').value='';
  _vmSearch2='';
  _admDockShow('vm-overlay');
  _vmApplyTab();
  _vmRenderTotals();_vmFetchTotals(); // 캐시 즉시 표시 + 백그라운드 갱신(vm개선 2)
  if(saved&&saved.scrollTop){setTimeout(()=>{const l=document.getElementById('vm-list');if(l)l.scrollTop=saved.scrollTop;},180);}
}
// ── 상태 이동 버튼 4종(2026-08-27 정리) ──────────────────────────────────────
// 각 버튼의 뜻은 탭과 무관하게 **고정**이다. 예전엔 뜻이 고정된 3개(정상·보류·무관)와, 탭마다 뜻이
// 바뀌는 vm-apply-btn(→무관/→숨김/→정상)이 섞여 있었고, 거기에 vm-move-* 4개를 또 얹어서 같은
// 동작 버튼이 두 벌씩 떴다(사용자 제보). vm-apply-btn을 없애고 이 4개로 통일했다 — "이 탭에서 이
// 버튼이 무슨 뜻이지"를 생각할 필요가 없어야 검수 속도가 난다.
const _VM_FLAG_BTNS=[['vm-normal-btn',null],['vm-nomem-btn','무관'],['vm-hold-btn','보류'],['vm-hidden-btn','hidden']];
// 이 탭이 "그 플래그의 목록"인가 — 노출 판정과 목록 잔류 판정(_vmBulkSetFlag)이 **같은 표**를 봐야
// "버튼은 있는데 눌러도 목록에서 안 빠지는" 식의 어긋남이 안 생긴다.
const _vmTabFlag=()=>({nomem:'무관',hold:'보류',hidden:'hidden'}[_vmTab]);
function _vmSyncFlagBtns(){
  const tabFlag=_vmTabFlag();
  const on=_vmTab!=='channels';
  _VM_FLAG_BTNS.forEach(([id,flag])=>{
    // 목록 탭이 아니면(all·검수 계열) tabFlag가 undefined라 어느 flag와도 안 같아 4개 전부 뜬다.
    // 목록 탭이면 그 탭 자신의 상태로 가는 버튼만 빠진다(제자리 이동이라 의미가 없다).
    const el=document.getElementById(id);
    if(el)el.style.display=(on&&flag!==tabFlag)?'':'none';
  });
}
// 탭 라벨의 "마지막 조회 시점 개수"(2026-08-27, 사용자 요청 — "실시간은 아니어도 이전 조회했을 때
// 몇 개였는지 보이면 좋겠다"). 실시간 집계는 탭마다 count 쿼리를 또 던져야 해서 패널 열 때마다 느려진다.
const _vmTabCount=new Map(); // tab → 마지막 조회에서 본 행 수
function _vmSetTabCount(tab,n){
  _vmTabCount.set(tab,n);
  const btn=document.querySelector(`.vm-tab[data-tab="${tab}"]`);
  if(!btn)return;
  if(!btn.dataset.baseLabel)btn.dataset.baseLabel=btn.textContent.trim();
  let badge=btn.querySelector('.vm-tab-count');
  if(!badge){badge=document.createElement('span');badge.className='vm-tab-count';btn.appendChild(badge);}
  badge.textContent=' '+n;
}
function _vmApplyTab(){
  const isCh=_vmTab==='channels';
  document.getElementById('vm-list').style.display=isCh?'none':'';
  document.getElementById('vm-ch-inner').style.display=isCh?'flex':'none';
  // 검수 탭들은 검색 불필요(고정 대상 목록). 채널 탭은 재검색(vm-search-2, 결과 내 좁히기)까진 필요
  // 없지만 1차 검색창은 채널명/핸들 검색용으로 그대로 쓴다(2026-08-21 — 예전엔 여기도 숨겨져 있었음).
  const isReviewLike=_vmTab==='ss'||_vmTab==='review'||_vmTab==='catlock'||_vmTab==='new'||_vmTab==='orphan';
  const searchEl=document.getElementById('vm-search');
  searchEl.style.display=isReviewLike?'none':'';
  searchEl.placeholder=isCh?'채널명·핸들 검색…':'제목·그룹 검색…';
  document.getElementById('vm-search-2').style.display=(isCh||isReviewLike)?'none':'';
  document.getElementById('vm-toolbar').style.display='none';
  document.getElementById('vm-status').textContent='';
  // '정상만' 토글은 content_flag가 안 섞이는 다른 탭(무관/숨김/검수)에선 의미가 없으므로 전체 탭에서만 노출.
  // 탭을 옮기면 기존 필터 상태가 새 탭에 그대로 남아있으면 헷갈리니 매번 초기화한다.
  _vmOnlyNormal=false;
  const onlyNormalBtn=document.getElementById('vm-only-normal-btn');
  if(onlyNormalBtn){onlyNormalBtn.style.display=_vmTab==='all'?'':'none';onlyNormalBtn.classList.remove('active');}
  _vmSyncFlagBtns();
  if(isCh){
    _vmChTab='official';
    _vmChTierFilter='all';
    document.querySelectorAll('.vm-ch-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='official'));
    _vmRenderChTierChips();
    _vmRenderChannels('');
  }else{
    _vmLoad();
  }
}
async function _vmLoad(searchTerm,preserveSearch2){
  if(!sb)return;
  const tab=_vmTab;
  const myGen=++_vmSearchGen;
  // 1차 검색어(전체 검색창)가 실제로 바뀌면 이전 결과 기준으로 좁혀뒀던 재검색어는 더 이상 의미가 없으므로
  // 초기화한다 — 단, 편집 모달 저장 후처럼 1차 검색어는 그대로 두고 목록만 새로고침하는 경우(preserveSearch2)엔
  // 사용자가 입력해둔 2차 검색어를 지우면 안 됨(2026-08-18, 사용자 제보 — 이중 검색 중 영상 편집·저장하면
  // 2차 검색어가 매번 날아감).
  if(!preserveSearch2){
    _vmSearch2='';
    const search2El=document.getElementById('vm-search-2');if(search2El)search2El.value='';
  }
  const statusEl=document.getElementById('vm-status');
  const listEl=document.getElementById('vm-list');
  const toolbarEl=document.getElementById('vm-toolbar');
  toolbarEl.style.display='none';
  listEl.innerHTML='';
  statusEl.textContent='조회 중…';
  const term=(searchTerm!==undefined?searchTerm:(document.getElementById('vm-search').value||'')).trim();
  // 같은 탭·같은 검색어를 TTL 안에 다시 열면 네트워크 없이 그대로 복원한다. 캐시에 담기는 rows는
  // _vmRows와 같은 배열 참조라, 행 하나만 고치는 경로(_vmRefreshRows 등)가 _vmCacheSync를 부르면
  // 캐시도 같이 최신이 된다. 쓰기가 나면 다른 탭 캐시는 _vmCacheDropOthers로 버린다.
  const cacheKey=_vmCacheKey(tab,term);
  _vmCacheKeyCur=cacheKey;
  const _cached=_vmCache.get(cacheKey);
  if(_cached){ // vm개선 3(a): TTL 없앰 — 세션 동안 캐시 유지, 갱신은 아래 ↻(수동)로만
    _vmRows=_cached.rows;
    statusEl.textContent=_cached.status;
    _vmAppendCacheChrome(statusEl,_cached.ts); // "N분 전 · ↻"
    _vmSetTabCount(tab,_vmRows.length); // 개수 배지만 갱신(ts는 안 건드림)
    _vmRenderVideoList();
    return;
  }
  // 메모리에 없으면 지난 세션 조회분(IndexedDB)을 먼저 그린다 — 새로고침해도 마지막으로 본 목록이
  // 그대로 뜬다(2026-09-02). 갱신은 ↻로만 — 자동 재조회하면 영속 캐시를 둔 의미가 없다.
  if(tab!=='all'||term){
    const _disk=await _vmIdbGet(cacheKey);
    if(myGen!==_vmSearchGen)return;
    if(_disk&&Array.isArray(_disk.rows)&&_disk.rows.length&&Date.now()-_disk.ts<_VM_IDB_MAX_AGE){
      _vmCache.set(cacheKey,{rows:_disk.rows,status:_disk.status,ts:_disk.ts});
      _vmRows=_disk.rows;
      statusEl.textContent=_disk.status||`${_disk.rows.length}개`;
      _vmAppendCacheChrome(statusEl,_disk.ts,true);
      _vmSetTabCount(tab,_vmRows.length);
      _vmRenderVideoList();
      return;
    }
  }
  try{
    let rows;
    if(tab==='all'){
      // 전체 탭: avs-style (3+ chars → ilike, 1-2 → 캐시)
      if(!term){_vmRows=[];listEl.innerHTML='<div style="padding:24px;text-align:center;color:rgba(155,178,228,0.45);font-size:12px;">제목이나 그룹명으로 검색하세요</div>';statusEl.textContent='';return;}
      let hits;
      if(term.length>=3){
        const{data,error}=await sb.from(_YT_TABLE).select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups').ilike('title_norm',`%${_titleNorm(term)}%`).order('id').limit(1000);
        if(myGen!==_vmSearchGen)return;
        if(error){statusEl.textContent='조회 실패: '+error.message;return;}
        hits=data||[];
      }else{
        const all=await _avsEnsureCache();
        if(myGen!==_vmSearchGen)return;
        const tn=_titleNorm(term);
        hits=all.filter(v=>v._tn.includes(tn)||v._gtn.includes(tn)).slice(0,1000);
      }
      _vmRows=hits;
      statusEl.textContent=`${hits.length}개 표시${hits.length>=1000?' (최대 1000개)':''}`;
      _vmCacheSync();_vmRenderVideoList();
      return;
    }
    if(tab==='new'){
      // 새로 들어온 영상 — created_at > 기준선(출처컬럼 추가 시점). 최신순. 그때그때 품질관리용(보고 바로 편집).
      const{data,error}=await sb.from(_YT_TABLE).select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups,source_tier').gt('created_at',_ADM_CREATED_BASELINE).order('created_at',{ascending:false}).limit(1000);
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      _vmRows=data||[];
      statusEl.textContent=`${_vmRows.length}개 (새로 들어온 순)${_vmRows.length>=1000?' · 최대 1000개':''}`;
      _vmCacheSync();_vmRenderVideoList();
      return;
    }
    if(tab==='ss'){
      // strictSync 그룹 오염 검수 — tags_manual=false 행만 (관리자가 이미 확인한 건 제외)
      // ⚠️ content_flag가 이미 붙은 행(무관/숨김/보류)도 제외한다(2026-08-25, 사용자 제보).
      //    예전엔 이 조건이 없어서, 무관/보류 처리하면 그 자리에선 목록에서 빠지는데 탭을 다시 열면
      //    그대로 다시 올라왔다 — "검수 대상 N개"가 아무리 처리해도 안 줄어드는 것처럼 보임.
      //    이 탭의 질문은 "이 그룹 콘텐츠가 맞나"이고 플래그가 붙었다는 건 그 답이 났다는 뜻이다.
      //    (보류는 별도 '보류' 탭에서 다시 볼 수 있으므로 여기서 빼도 유실되지 않는다)
      const ssGkos=[..._STRICT_SYNC_GROUPS];
      if(!ssGkos.length){statusEl.textContent='strictSync 그룹이 없어요';_vmRows=[];_vmCacheSync();_vmRenderVideoList();return;}
      // ⚠️ 예전엔 `.in('group_ko', 23개).order('id')` 한 방으로 받았는데 **19.2초** 걸렸음 —
      // group_ko 인덱스는 있지만 전역 id 정렬과 안 맞아서, 페이지마다 매칭 3.3%(12,113/371,448)를
      // 찾느라 테이블을 훑는 꼴이었다. 그룹별로 쪼개면 각 쿼리가 group_ko 인덱스를 그대로 타고
      // 정렬도 그 안에서만 하면 돼서 **0.6초**로 떨어진다(실측, 32배). 인덱스 추가 불필요.
      // 동시 6개는 다른 대량 조회(name_pollution_probe 등)에서 쓰던 것과 같은 수준 — 더 늘려도
      // 이득이 크지 않고 무료 티어 커넥션만 압박한다.
      const _SS_COLS='id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups';
      let _ssHasReviewedAt=true;
      let error=null;const collected=[];let _ssCursor=0;
      const _sortSs=arr=>arr.slice().sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
      const _ssProgress=_vmProgressive(myGen,_sortSs,'검수 대상');
      const _ssWorker=async()=>{
        while(_ssCursor<ssGkos.length&&!error){
          const gko=ssGkos[_ssCursor++];
          const _ssQuery=()=>{
            let q=sb.from(_YT_TABLE).select(_SS_COLS).eq('group_ko',gko).eq('tags_manual',false).is('content_flag',null);
            if(_ssHasReviewedAt)q=q.is('reviewed_at',null);
            return q.order('id');
          };
          let{data:d,error:e}=await _sbFetchAll(_ssQuery);
          // reviewed_at 컬럼 추가 SQL을 아직 안 돌린 상태로 배포되면 여기서 400이 나 검수 탭이 통째로
          // 안 열린다 — 그 경우 컬럼 없이 한 번 더 조회해서 최소한 예전 동작은 유지한다(2026-08-25).
          if(e&&_ssHasReviewedAt&&/reviewed_at/.test(e.message||'')){
            _ssHasReviewedAt=false;
            ({data:d,error:e}=await _sbFetchAll(_ssQuery));
          }
          if(e){error=e;return;}
          collected.push(...(d||[]));
          // 예전엔 개수 텍스트만 갱신했다 — 목록은 23개 그룹을 다 받고서야 한 번에 떴다. 같은 훅으로
          // 받는 대로 그린다(2026-09-02). d가 빈 배열일 수 있어 first 판정이 흔들리지 않게 acc만 넘긴다.
          _ssProgress(d||[],collected);
        }
      };
      await Promise.all(Array.from({length:6},_ssWorker));
      const data=collected;
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      const all=_sortSs(data||[]);
      _vmRows=all;
      statusEl.textContent=`검수 대상 ${all.length}개 (strictSync 그룹: ${ssGkos.join(', ')})`;
      _vmCacheSync();_vmRenderVideoList();
      return;
    }
    if(tab==='review'){
      // 그룹배정 검수 큐 — _extBuildRows가 owner 없는 외부/모음채널에서 멤버 이름 하나만으로(강한 근거
      // 없이) group_ko를 역추론했을 때 needs_review:true+content_flag:'hidden'으로 저장해둔 것들
      // (2026-08-20 도입). 여기서 승인하면 그 즉시 실제 그룹으로 확정(content_flag 해제), 거부하면
      // 무관 처리 — 둘 다 needs_review는 false로 내려 큐에서 빠짐.
      const _sortRev=arr=>arr.slice().sort((a,b)=>
        String(b.created_at||'').localeCompare(String(a.created_at||''))
        ||(a.group_ko||'').localeCompare(b.group_ko||'','ko')
        ||(a.title||'').localeCompare(b.title||'','ko'));
      const{data,error}=await _sbFetchAll(()=>_vmReviewQueueFilter(sb.from(_YT_TABLE)
        .select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups,created_at'))
        .order('id'),1000,_vmProgressive(myGen,_sortRev,'검수 대기'));
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      // ⚠️ 정렬을 그룹명순 → **유입 최신순**으로 바꿨다(2026-08-25). 이 큐는 "하루 신규분만 보고
      // 끝낸다"는 규칙으로 운영하기로 했는데(누적 3천 건을 다 봐야 한다는 부담이 1년간 안 누른
      // 원인이었음), 그러려면 새로 들어온 게 맨 위에 있어야 한다. created_at이 없는 옛 행은 뒤로.
      const all=(data||[]).sort((a,b)=>
        String(b.created_at||'').localeCompare(String(a.created_at||''))
        ||(a.group_ko||'').localeCompare(b.group_ko||'','ko')
        ||(a.title||'').localeCompare(b.title||'','ko'));
      _vmRows=all;
      const nNew=all.filter(v=>String(v.created_at||'')>_ADM_CREATED_BASELINE).length;
      statusEl.textContent=`그룹배정 검수 대상 ${all.length}개`+(nNew?` (신규 유입 ${nNew}개 — 위쪽부터)`:'')+` — 멤버 이름 하나만으로 그룹을 추측한 영상들이에요`;
      _vmCacheSync();_vmRenderVideoList();
      return;
    }
    if(tab==='orphan'){
      // members에 이름은 있는데 그 행의 group_ko가 그 사람 소속이 아니라 **어느 카드에서도 조회되지
      // 않는** 태그. 멤버 카드 조건이 and(group_ko.eq.그룹, members.cs.{이름})이라, group_ko가 안 맞으면
      // 그 태그는 저장돼 있어도 화면에 영향을 주지 못한다(2026-08-27 우즈/조승연 제보로 발견).
      // 판정은 서버에서 못 한다(로스터가 artists.json에만 있음) → members 비어있지 않은 행만 긁어와
      // 클라이언트에서 거른다. 미등록 이름(로스터에 아예 없는 이름)은 별개 문제라 제외한다.
      const _fits=(name,gko)=>ARTISTS.some(a=>a.name.ko===name&&_artistGroups(a).some(g=>g.ko===gko));
      const _known=name=>ARTISTS.some(a=>a.name.ko===name);
      // 이 탭은 후보 판정이 클라이언트에 있어서(로스터가 artists.json에만 있음) 걸러내기까지가 한 세트다.
      // 받는 대로 그리려면 페이지마다 같은 변환을 돌려야 하므로 함수로 빼둔다.
      const _pickOrphans=arr=>arr.map(v=>{
        const orphans=(v.members||[]).filter(m=>_known(m)&&!_fits(m,v.group_ko));
        return orphans.length?{...v,_orphans:orphans}:null;
      }).filter(Boolean).sort((a,b)=>(b.tags_manual?1:0)-(a.tags_manual?1:0)||(a.group_ko||'').localeCompare(b.group_ko||'','ko'));
      const{data,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups,tags_manual')
        .not('members','eq','{}')
        .order('id'),1000,_vmProgressive(myGen,_pickOrphans,'고아 태그'));
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      const all=_pickOrphans(data||[]);
      _vmRows=all;
      const nMan=all.filter(v=>v.tags_manual).length;
      const nTags=all.reduce((n,v)=>n+v._orphans.length,0);
      statusEl.textContent=`고아 멤버태그 ${nTags}개 / 영상 ${all.length}개`+(nMan?` (수동 저장 ${nMan}개 — 위쪽부터)`:'')+' — 태그는 있는데 소속 그룹이 안 맞아 어디에도 안 보이는 것들이에요';
      _vmCacheSync();_vmRenderVideoList();
      return;
    }
    if(tab==='catlock'){
      // "OO 최애직캠"처럼 채널마다 반복되는 브랜드명이 붙어도 제목에 "직캠"류 단어가 있으면 _ytClassify가
      // 이미 category='live'로 잡아준다 — 안 잡히는 진짜 문제는 tags_manual=true(사람이 직접 수정)라
      // "영상 카테고리 재분류(전체)"(_ytSweepCategoryMistag)가 애초에 건드리지 않고 조용히 건너뛰는
      // 경우들이었음. 그 목록이 지금까지 안 보여서 실수로 잘못 저장된 건지 의도적으로 다르게 둔 건지
      // 확인할 방법이 없었음(2026-08-21, 사용자 요청) — tags_manual=true 안 건드리는 원칙은 그대로 두고,
      // 후보만 여기서 보여줘서 사람이 하나씩 직접(✎) 확인·수정하게 한다.
      // 후보 판정(_ytClassify)이 클라이언트에 있어 페이지마다 같은 변환이 필요하다(위 orphan과 동일 구조).
      const _pickCatlock=arr=>arr.filter(v=>_ytClassify(v.title||'')==='live')
        .sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
      const{data,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups,category,is_short')
        .eq('tags_manual',true)
        .neq('category','live')
        // 예전엔 여기서 쇼츠도 뺐다 — category가 단일값이라 short면 live일 수 없었기 때문. 2026-08-27
        // 직교화로 세로 직캠도 category='live'가 될 수 있게 됐으니 후보에서 빼면 안 된다.
        .order('id'),1000,_vmProgressive(myGen,_pickCatlock,'라이브 후보'));
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      const all=_pickCatlock(data||[]);
      _vmRows=all;
      statusEl.textContent=`라이브로 보이는데 수동 편집으로 다른 카테고리로 저장된 영상 ${all.length}개 — ✎로 하나씩 확인해주세요`;
      _vmCacheSync();_vmRenderVideoList();
      return;
    }
    // nomem / hold / hidden 탭
    // flag_source를 같이 읽는다(2026-08-27) — 이 세 탭의 존재 이유가 "내가 분류한 것"을 훑는 건데,
    // 실제로는 자동분이 99%(숨김 2,822건 중 사람이 숨긴 건 22건)라 출처가 안 보이면 어느 게 내 판단인지
    // 알 수 없다. 배지에 · 를 붙여 자동분을 구분한다. 컬럼이 없는 환경이면 값이 undefined라 표시만 빠짐.
    const flag=tab==='nomem'?'무관':tab==='hold'?'보류':'hidden';
    let q=sb.from(_YT_TABLE).select('id,title,group_ko,thumb,content_flag,flag_source,members,with_members,with_groups,cover_of_members,cover_of_groups');
    q=q.eq('content_flag',flag);
    if(term)q=q.or(`title.ilike.${_pgFilterVal('%'+term+'%')},group_ko.ilike.${_pgFilterVal('%'+term+'%')}`);
    const _sortFlag=arr=>arr.slice().sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
    const{data,error}=await _sbFetchAll(()=>q.order('id'),1000,_vmProgressive(myGen,_sortFlag,flag==='hidden'?'숨김':flag));
    if(myGen!==_vmSearchGen)return;
    if(error){statusEl.textContent='조회 실패: '+error.message;return;}
    const all=_sortFlag(data||[]);
    _vmRows=all;
    statusEl.textContent=term?`검색 결과 ${all.length}개`:`총 ${all.length}개`;
    _vmCacheSync();_vmRenderVideoList();
  }catch(e){
    if(myGen!==_vmSearchGen)return;
    statusEl.textContent='오류: '+e.message;
  }
}
// 그룹 태그 하나만으로는 실제 무슨 콘텐츠인지(개인 태깅/콜라보/커버) 알 수 없어서, 편집 모달을 열지
// 않고도 목록에서 바로 파악할 수 있게 멤버·함께한(콜라보)·원곡 정보를 한 줄로 요약(2026-08-18, 사용자 요청).
function _vmTagsLine(v){
  const parts=[];
  // 고아 멤버태그 탭에선 어느 이름이 문제인지 바로 보여야 한다 — 목록만 보고 "이 영상은 group_ko를
  // 옮길 것인가, 저 이름을 with_members로 뺄 것인가"를 판단해야 하기 때문(2026-08-27).
  if((v.members||[]).length)parts.push(`멤버: ${v.members.map(m=>(v._orphans||[]).includes(m)?`⚠️${m}`:m).join(', ')}`);
  const withAll=[...(v.with_members||[]),...(v.with_groups||[])];
  if(withAll.length)parts.push(`함께: ${withAll.join(', ')}`);
  const coverAll=[...(v.cover_of_members||[]),...(v.cover_of_groups||[])];
  if(coverAll.length)parts.push(`원곡: ${coverAll.join(', ')}`);
  return parts.join(' · ');
}
function _vmSearch2Rows(){
  let rows=_vmOnlyNormal?_vmRows.filter(v=>!v.content_flag):_vmRows;
  if(_vmSearch2){
    const t=_vmSearch2.toLowerCase();
    rows=rows.filter(v=>(v.title||'').toLowerCase().includes(t)||(v.group_ko||'').toLowerCase().includes(t));
  }
  return rows;
}
function _vmRenderVideoList(){
  const listEl=document.getElementById('vm-list');
  const toolbarEl=document.getElementById('vm-toolbar');
  const tab=_vmTab;
  listEl.innerHTML='';
  const rows=_vmSearch2Rows();
  if(!_vmRows.length){
    const emptyMsg=tab==='all'?'검색 결과가 없어요':tab==='new'?'새로 들어온 영상이 없어요':tab==='nomem'?'무관 처리된 영상이 없어요':tab==='hold'?'보류된 영상이 없어요':tab==='review'?'검수 대기 중인 영상이 없어요':tab==='catlock'?'라이브 후보 중 수동 편집으로 막힌 영상이 없어요':'숨김 처리된 영상이 없어요';
    listEl.innerHTML=`<div style="padding:24px;text-align:center;color:rgba(155,178,228,0.45);font-size:12px;">${emptyMsg}</div>`;
    toolbarEl.style.display='none';
    return;
  }
  if(!rows.length){
    listEl.innerHTML=`<div style="padding:24px;text-align:center;color:rgba(155,178,228,0.45);font-size:12px;">재검색 결과가 없어요</div>`;
    toolbarEl.style.display='none';
    return;
  }
  // review 탭도 체크박스를 켠다(2026-08-25) — 예전엔 한 건씩 승인/거부만 가능해서 3천 건짜리 큐를
  // 사실상 처리할 수 없었고, 그래서 검수 자체가 방치돼 있었음(사용자 확인). 일괄 승인/거부로 전환.
  const isReview=tab==='review';
  const showCheckbox=isReview||tab==='nomem'||tab==='hold'||tab==='hidden'||tab==='ss'||tab==='all'||tab==='new';
  if(showCheckbox){
    toolbarEl.style.display='flex';
    document.getElementById('vm-select-all-row').style.display='';
    document.getElementById('vm-select-all').checked=false;
    // review 탭에선 이 탭의 질문("이 그룹배정이 맞나")과 무관한 버튼들을 숨겨서 오조작을 막는다.
    ['vm-indiv-btn','vm-coverclear-btn','vm-coverset-btn'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.style.display=isReview?'none':'';
    });
    ['vm-review-approve-btn','vm-review-reject-btn'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.style.display=isReview?'':'none';
    });
    // 상태 이동 4종(정상/무관/보류/숨김)의 노출은 _vmSyncFlagBtns가 탭 전환 시 한 곳에서 정한다 —
    // 여기서 또 개별로 건드리면 두 곳이 갈라져 "탭에 따라 있다가 없다가" 하는 버튼이 생긴다.
    const confirmBtn=document.getElementById('vm-confirm-btn');
    if(confirmBtn)confirmBtn.style.display=tab==='ss'?'':'none';
    _vmUpdateCount();
  }else{
    toolbarEl.style.display='none';
  }
  rows.forEach(v=>{
    const item=document.createElement('div');item.className='vm-item';item.dataset.vidId=v.id;
    if(showCheckbox){
      const cb=document.createElement('input');cb.type='checkbox';cb.style.flexShrink='0';
      cb.addEventListener('change',_vmUpdateCount);
      item.appendChild(cb);
    }
    const img=document.createElement('img');img.className='vm-thumb';img.src=v.thumb||`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;img.loading='lazy';
    const info=document.createElement('div');info.className='vm-info';
    const grp=document.createElement('div');grp.className='vm-group';grp.textContent=v.group_ko||'';
    const ttl=document.createElement('div');ttl.className='vm-title';ttl.textContent=v.title||'';
    info.appendChild(grp);info.appendChild(ttl);
    const tagsLine=_vmTagsLine(v);
    if(tagsLine){
      const tags=document.createElement('div');tags.className='vm-tags';tags.textContent=tagsLine;
      info.appendChild(tags);
    }
    const actions=document.createElement('div');actions.className='vm-actions';
    if(tab==='review'){
      // 그룹배정 검수 큐 전용 버튼 — 일반 flagBtn의 무관→숨김→정상 순환은 "이 그룹배정이 맞는지"라는
      // 이 탭의 질문과 안 맞아서(정상=현재도 hidden 상태인 게 뭘 뜻하는지 헷갈림) 승인/거부 이진 버튼으로
      // 대체. 둘 다 needs_review를 false로 내려야 큐에서 실제로 빠짐(2026-08-20).
      const approveBtn=document.createElement('button');approveBtn.className='vm-flag-btn vm-flag-normal';approveBtn.type='button';approveBtn.textContent='정상';
      approveBtn.addEventListener('click',e=>{e.stopPropagation();_vmReviewDecide(v,item,true,approveBtn,rejectBtn);});
      const rejectBtn=document.createElement('button');rejectBtn.className='vm-flag-btn vm-flag-nomem';rejectBtn.type='button';rejectBtn.textContent='무관';
      rejectBtn.addEventListener('click',e=>{e.stopPropagation();_vmReviewDecide(v,item,false,approveBtn,rejectBtn);});
      actions.appendChild(approveBtn);actions.appendChild(rejectBtn);
    }else{
      // flag badge button (클릭하면 무관→숨김→정상 순으로 순환 — 기타/외부인/개별출연은 순환 대상이
      // 아니라 그대로 표시만 하고, 클릭 한 번에 그 값이 지워지지 않게 함)
      const flag=v.content_flag||null;
      const flagBtn=document.createElement('button');flagBtn.className='vm-flag-btn';flagBtn.type='button';
      _vmSetFlagLabel(flagBtn,flag);
      // 자동 판정분 표시(2026-08-27) — 사람이 찍은 것과 매처가 찍은 것을 눈으로 갈라야 검수가 된다.
      // flag_source가 없는 옛 행은 표시가 안 붙는데, 그 자체가 "이 컬럼 생기기 전 것"이라는 정보다.
      if(v.flag_source==='auto'){flagBtn.classList.add('vm-flag-auto');flagBtn.title='자동 판정 (사람이 확인하지 않음)';}
      else if(v.flag_source==='manual')flagBtn.title='직접 지정함';
      flagBtn.addEventListener('click',e=>{e.stopPropagation();_vmCycleFlagInline(v,flagBtn,item);});
      actions.appendChild(flagBtn);
    }
    // edit button
    const editBtn=document.createElement('button');editBtn.className='vid-edit-btn';editBtn.type='button';editBtn.textContent='✎';
    editBtn.addEventListener('click',e=>{e.stopPropagation();_openVidTagModal({id:v.id,title:v.title},v.group_ko);});
    actions.appendChild(editBtn);
    item.appendChild(img);item.appendChild(info);item.appendChild(actions);
    listEl.appendChild(item);
  });
  if(showCheckbox)_vmUpdateCount();
}
// content_flag는 null/기타/외부인/개별출연/무관/hidden 중 하나 — 이 뱃지는 그중 무관↔hidden만 클릭으로
// 순환시키는 빠른 토글이라(기타/외부인/개별출연은 편집 모달에서만 지정), 그 세 값은 "정상"으로 뭉뚱그려서
// 지우면 안 되고 그 값 그대로 보여줘야 함 — 예전엔 null 아니고 '무관'도 아니면 전부 "숨김"으로 표시하고,
// 클릭하면 곧장 null로 리셋해버려서 '개별출연' 등을 저장해둔 영상이 뱃지만 보면 숨김처럼 보이고 클릭
// 한 번에 그 값이 날아가는 문제가 있었음(2026-08-04, 사용자 제보로 발견).
function _vmSetFlagLabel(btn,flag){
  btn.className='vm-flag-btn';
  if(!flag){btn.textContent='정상';btn.classList.add('vm-flag-normal');}
  else if(flag==='무관'){btn.textContent='무관';btn.classList.add('vm-flag-nomem');}
  else if(flag==='hidden'){btn.textContent='숨김';btn.classList.add('vm-flag-hidden');}
  else if(flag==='보류'){btn.textContent='보류';btn.classList.add('vm-flag-hold');} // 유니버스 미등록 아이돌 — 검토 대기
  else{btn.textContent=flag;btn.classList.add('vm-flag-other');} // 기타/외부인/개별출연 — 있는 그대로 표시
}
function _vmCycleFlagInline(v,btn,item){
  // 무관→hidden→정상 순으로 순환. 기타/외부인/개별출연처럼 이 순환 대상이 아닌 값이면 "정상"에서
  // 시작한 것처럼 무관으로 보내고(그 값을 조용히 지우고 곧장 hidden으로 건너뛰지 않게), 순환이 끝나면
  // 정상(null)으로 돌아가 완전히 지워지는 건 그대로 유지(관리자가 명시적으로 한 바퀴 돌린 것이므로).
  const cur=v.content_flag||null;
  const next=cur==='무관'?'hidden':(cur==='hidden'?'보류':(cur==='보류'?null:'무관')); // 무관→숨김→보류→정상 순환
  _vmSetFlag(v,next,btn,item);
}
async function _vmSetFlag(v,newFlag,btn,item){
  if(!sb)return;
  btn.disabled=true;
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch(newFlag,'manual')).eq('id',v.id);
  if(error){btn.disabled=false;_showShareToast('오류: '+error.message);return;}
  _tagEditLog({videoId:v.id,title:v.title,before:{content_flag:v.content_flag||null},after:{content_flag:newFlag||null},source:'vm_flag'});
  v.content_flag=newFlag;
  _vmSetFlagLabel(btn,newFlag);
  btn.disabled=false;
  _vmScheduleTotals(); // 총계 재조회(vm개선 2)
  // 탭 필터와 안 맞는 항목은 페이드 아웃 후 제거
  const tab=_vmTab;
  // review 탭 추가(2026-08-27): 여기서 무관으로 바꾸면 그건 '그룹배정이 틀렸다'는 판정이라 큐에서
  // 빠지는 게 맞다(_vmReviewQueueFilter·stillFits와 같은 기준).
  const mismatch=(tab==='nomem'&&newFlag!=='무관')||(tab==='hold'&&newFlag!=='보류')||(tab==='hidden'&&newFlag!=='hidden')||(tab==='review'&&newFlag==='무관');
  if(mismatch){
    item.style.opacity='0.3';
    setTimeout(()=>{
      _vmRows=_vmRows.filter(r=>r.id!==v.id);
      item.remove();
      _vmUpdateCount();
      document.getElementById('vm-status').textContent=`총 ${_vmRows.length}개`;
      _vmCacheSync();_vmCacheDropAffected(newFlag);
      if(!_vmRows.length)_vmRenderVideoList();
    },500);
  }
}
// 그룹배정 검수 큐(review 탭) 전용 — 승인이면 실제 그룹으로 확정(content_flag 해제), 거부면 이 그룹배정이
// 틀렸다는 뜻이므로 무관 처리. 둘 다 needs_review를 내려야 큐에서 실제로 빠짐(2026-08-20).
async function _vmReviewDecide(v,item,approve,approveBtn,rejectBtn){
  if(!sb)return;
  approveBtn.disabled=true;rejectBtn.disabled=true;
  const newFlag=approve?null:'무관';
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch(newFlag,'manual',{needs_review:false})).eq('id',v.id);
  if(error){approveBtn.disabled=false;rejectBtn.disabled=false;_showShareToast('오류: '+error.message);return;}
  item.style.opacity='0.3';
  setTimeout(()=>{
    _vmRows=_vmRows.filter(r=>r.id!==v.id);
    item.remove();
    document.getElementById('vm-status').textContent=`그룹배정 검수 대상 ${_vmRows.length}개 남음`;
    _vmCacheSync();_vmCacheDropAffected(newFlag);
    if(!_vmRows.length)_vmRenderVideoList();
  },400);
}
// 일괄 승인/거부(2026-08-25) — 개별 _vmReviewDecide와 같은 규칙: 승인=content_flag 해제(실제 그룹으로
// 확정), 거부=무관 처리. 둘 다 needs_review를 내려야 큐에서 빠진다.
// ⚠️ 되돌릴 수 있어야 하므로 다른 일괄 버튼들과 동일하게 실행 직전 스냅샷을 뜬다.
async function _vmReviewBulk(approve){
  if(!sb)return;
  const ids=[...document.querySelectorAll('#vm-list .vm-item input[type=checkbox]:checked')]
    .map(c=>c.closest('.vm-item')?.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  const label=approve?'정상':'무관';
  if(!confirm(`선택한 ${ids.length}개를 '${label}'(으)로 처리할까요?\n\n· 정상: 지금 배정된 그룹이 맞음 → 정상(숨김 해제)\n· 무관: 그룹배정이 틀림 → '무관'\n\n되돌리기 스냅샷이 저장돼요.`))return;
  const aBtn=document.getElementById('vm-review-approve-btn'),rBtn=document.getElementById('vm-review-reject-btn');
  if(aBtn)aBtn.disabled=true;if(rBtn)rBtn.disabled=true;
  const statusEl=document.getElementById('vm-status');
  try{
    await _snapshotBeforeBulk(`그룹배정 검수 일괄 ${label}`,ids);
    for(let i=0;i<ids.length;i+=200){
      const chunk=ids.slice(i,i+200);
      const{error}=await sb.from(_YT_TABLE).update(_flagPatch(approve?null:'무관','manual',{needs_review:false})).in('id',chunk);
      if(error)throw new Error(error.message);
      if(statusEl)statusEl.textContent=`${label} 처리 중… ${Math.min(i+200,ids.length)}/${ids.length}`;
    }
    // 재조회 없이 목록에서만 걷어낸다 — 3천 건짜리 큐를 매번 다시 긁으면 그것만으로 몇 초씩 걸림
    const gone=new Set(ids);
    _vmRows=_vmRows.filter(r=>!gone.has(r.id));
    _vmRenderVideoList();
    if(statusEl)statusEl.textContent=`${ids.length}개 ${label} 완료 — 그룹배정 검수 대상 ${_vmRows.length}개 남음`;
    // 위 _snapshotBeforeBulk가 캐시를 통째로 비웠으므로, 걷어낸 뒤 상태를 현재 탭 캐시로 다시 심는다
    // (안 하면 이 탭도 캐시가 비어 다음 방문에 3천 건을 또 긁는다).
    _vmCacheSync();
    _vmScheduleTotals(); // 총계 재조회(vm개선 2)
    _showShareToast(`${ids.length}개 ${label}됨`);
  }catch(e){
    if(statusEl)statusEl.textContent='오류: '+e.message;
    _showShareToast('오류: '+e.message);
  }finally{
    if(aBtn)aBtn.disabled=false;if(rBtn)rBtn.disabled=false;
    _vmUpdateCount();
  }
}
document.getElementById('vm-review-approve-btn')?.addEventListener('click',()=>_vmReviewBulk(true));
document.getElementById('vm-review-reject-btn')?.addEventListener('click',()=>_vmReviewBulk(false));
// 검수(ss) 탭 전용 "선택-확인"(2026-08-25) — "봤고 태그가 맞다"를 기록하는 유일한 수단.
// ⚠️ tags_manual=true를 이 용도로 쓰면 안 된다. 그건 "관리자가 태그를 직접 고쳤으니 자동 태깅이
//    건드리지 말 것"이라는 뜻이고(프로젝트 전역 원칙), 눈으로 훑어 통과시킨 1만여 건에 그걸 찍으면
//    앞으로의 매처 개선이 그 행들엔 영원히 반영되지 않는다. 그래서 reviewed_at 컬럼을 따로 둔다.
// 되돌리기: reviewed_at도 _BULK_SNAP_COLS에 들어 있어 다른 일괄 작업과 똑같이 스냅샷으로 복구된다.
document.getElementById('vm-confirm-btn')?.addEventListener('click',async()=>{
  if(!sb)return;
  const btn=document.getElementById('vm-confirm-btn');
  const items=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  if(!confirm(`선택한 ${ids.length}개를 '확인'으로 처리할까요?\n\n태그가 맞다고 보고 검수 큐에서 빼요.\n영상 자체는 그대로 노출되고, 자동 태깅도 계속 적용돼요.\n되돌리기 스냅샷이 저장돼요.`))return;
  btn.disabled=true;const orig=btn.textContent;btn.textContent='처리 중…';
  const statusEl=document.getElementById('vm-status');
  try{
    await _snapshotBeforeBulk('검수 탭 일괄 확인',ids);
    const now=new Date().toISOString();
    for(let i=0;i<ids.length;i+=200){
      const{error}=await sb.from(_YT_TABLE).update({reviewed_at:now}).in('id',ids.slice(i,i+200));
      if(error)throw new Error(error.message);
      if(statusEl)statusEl.textContent=`확인 처리 중… ${Math.min(i+200,ids.length)}/${ids.length}`;
    }
    const gone=new Set(ids);
    _vmRows=_vmRows.filter(v=>!gone.has(v.id));
    _vmCacheSync();_vmCacheDropAffected(approve?null:'무관'); // 목록에서 걷어낸 결과를 캐시에도 반영(2026-08-27)
    _vmRenderVideoList();
    if(statusEl)statusEl.textContent=`${ids.length}개 확인 완료 — 검수 대상 ${_vmRows.length}개 남음`;
    _showShareToast(`${ids.length}개 확인 처리됨`);
  }catch(e){
    if(statusEl)statusEl.textContent='오류: '+e.message;
    _showShareToast('오류: '+e.message);
  }finally{btn.disabled=false;btn.textContent=orig;_vmUpdateCount();}
});
function _vmUpdateCount(){
  const total=document.querySelectorAll('#vm-list .vm-item').length;
  const checked=document.querySelectorAll('#vm-list .vm-item input[type=checkbox]:checked').length;
  document.getElementById('vm-count').textContent=`${checked}/${total}개 선택됨`;
  _VM_FLAG_BTNS.forEach(([id])=>{const b=document.getElementById(id);if(b)b.disabled=checked===0;});
  const indivBtn=document.getElementById('vm-indiv-btn');
  if(indivBtn)indivBtn.disabled=checked===0;
  const confirmBtn2=document.getElementById('vm-confirm-btn');
  if(confirmBtn2)confirmBtn2.disabled=checked===0;
  const coverClearBtn=document.getElementById('vm-coverclear-btn');
  if(coverClearBtn)coverClearBtn.disabled=checked===0;
  const allEl=document.getElementById('vm-select-all');
  if(allEl)allEl.checked=total>0&&checked===total;
}
// "그외"(ext) 채널은 이제 DB(ext_channels) 기반이라 여기서 유형 변경(select)/삭제 버튼을 바로 붙여
// 코드 배포 없이 관리 가능하게 함 — "공식"(그룹/멤버 자체 채널, _officialChannels)은 GROUPS 데이터에서
// 자동 생성되는 목록이라 여기서 개별 편집 대상이 아님(2026-08-12, 사용자 요청).
const _EXT_TIER_OPTIONS=[['music','음악'],['variety','예능'],['magazine','잡지'],['idol','아이돌개인'],['show','드라마/영화'],['fans','팬']];
// "그외" 탭에서 유형별로 걸러보는 칩 — official 탭에선 숨김(2026-08-21, 사용자 요청 — 5종이 한 리스트에
// 섞여 있어 특정 유형만 확인하기 번거로움).
function _vmRenderChTierChips(){
  const wrap=document.getElementById('vm-ch-tier-filter');
  if(!wrap)return;
  const isOfficial=_vmChTab==='official';
  wrap.style.display=isOfficial?'none':'flex';
  if(isOfficial){wrap.innerHTML='';return;}
  wrap.innerHTML='';
  [['all','전체'],..._EXT_TIER_OPTIONS].forEach(([v,label])=>{
    const b=document.createElement('button');
    b.type='button';b.className='ec-tier-chip'+(v===_vmChTierFilter?' active':'');
    b.textContent=label;
    b.addEventListener('click',()=>{
      _vmChTierFilter=v;
      wrap.querySelectorAll('.ec-tier-chip').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      _vmRenderChannels(document.getElementById('vm-search')?.value||'');
    });
    wrap.appendChild(b);
  });
}
function _vmRenderChannels(term){
  const listEl=document.getElementById('vm-ch-list');
  const q=(term||'').trim().toLowerCase();
  const isOfficial=_vmChTab==='official';
  let all=isOfficial?_officialChannels():_EXT_CHANNELS;
  if(!isOfficial&&_vmChTierFilter!=='all')all=all.filter(ch=>ch.tier===_vmChTierFilter);
  const rows=q?all.filter(ch=>ch.name.toLowerCase().includes(q)||(ch.handle||'').toLowerCase().includes(q)):all;
  document.getElementById('vm-ch-count').textContent=`총 ${all.length}개 중 ${rows.length}개 표시`;
  const addRow=document.getElementById('vm-ch-add-row');
  if(addRow)addRow.style.display=isOfficial?'none':'flex';
  if(!rows.length){
    listEl.innerHTML=`<div style="padding:16px;text-align:center;color:rgba(155,178,228,0.45);font-size:12px;">${q?'검색 결과가 없어요':'등록된 채널이 없어요'}</div>`;
    return;
  }
  listEl.innerHTML='';
  rows.forEach(ch=>{
    const item=document.createElement('div');item.className='ec-item';
    const info=document.createElement('div');info.className='ec-info';
    const name=document.createElement('div');name.className='ec-name';name.textContent=ch.name;
    info.appendChild(name);
    // 아이돌개인 채널이면 소유 아이돌 이름을 옆에 표기(공동운영이면 여러 명 · 로 구분, 2026-08-22)
    if(ch.tier==='idol'&&ch.owner?.mko){
      const own=document.createElement('div');own.className='ec-owner';
      own.textContent='👤 '+ch.owner.mko.split(',').map(s=>s.trim()).filter(Boolean).join(' · ');
      own.style.cssText='font-size:11px;color:rgba(155,178,228,0.72);margin-top:1px;';
      info.appendChild(own);
    }
    // 팬 채널이면 대상(전용멤버 있으면 그 멤버 · 그룹)을 표기 — 아이돌개인처럼 어드민에서 소속이 보이게
    // (2026-09-01, 사용자 제보 "팬채널 소유자/그룹이 표기 안 됨"). 멤버 미지정이면 그룹만 보여 "그룹 팬채널"임을 알 수 있다.
    else if(ch.tier==='fans'&&(ch.owner?.gko||ch.owner?.mko)){
      const own=document.createElement('div');own.className='ec-owner';
      const mem=ch.owner.mko?ch.owner.mko.split(',').map(s=>s.trim()).filter(Boolean).join(' · '):'';
      own.textContent='💛 '+[mem,ch.owner.gko].filter(Boolean).join(' / ')+(mem?'':' (그룹 팬채널)');
      own.style.cssText='font-size:11px;color:rgba(155,178,228,0.72);margin-top:1px;';
      info.appendChild(own);
    }
    if(ch.handle){const handle=document.createElement('div');handle.className='ec-handle';handle.textContent='@'+ch.handle;info.appendChild(handle);}
    item.appendChild(info);
    if(!isOfficial){
      const tierSel=document.createElement('select');tierSel.className='ec-tier-sel';
      _EXT_TIER_OPTIONS.forEach(([v,label])=>{
        const opt=document.createElement('option');opt.value=v;opt.textContent=label;opt.selected=ch.tier===v;tierSel.appendChild(opt);
      });
      tierSel.addEventListener('click',e=>e.stopPropagation());
      tierSel.addEventListener('change',()=>_ecUpdateTier(ch.handle,tierSel.value));
      item.appendChild(tierSel);
      // 기본 카테고리(제목으로 분류 안 된 영상의 행선지) — 채널마다 성격이 달라 유형으로 강제하지 않음
      const catSel=document.createElement('select');catSel.className='ec-tier-sel';catSel.title='분류 안 된 영상 기본 탭';
      [['','기본'],['none','전체탭만'],['variety','예능'],['show','드라마/영화'],['live','라이브'],['mv','뮤비']].forEach(([v,label])=>{
        const o=document.createElement('option');o.value=v;o.textContent=label;
        if((ch.defaultCategory||'')===v)o.selected=true;
        catSel.appendChild(o);
      });
      catSel.addEventListener('click',e=>e.stopPropagation());
      catSel.addEventListener('change',()=>_ecUpdateField(ch.handle,{default_category:catSel.value||null},'defaultCategory',catSel.value,'기본 카테고리 변경됨'));
      item.appendChild(catSel);
      // 대표 채널 — 한 멤버가 채널 여러 개일 때 카드 유튜브 아이콘이 가리킬 하나(아이돌개인만)
      if(ch.tier==='idol'){
        const pw=document.createElement('label');pw.className='ec-primary-lbl';pw.title='멤버 카드 유튜브 아이콘이 가리킬 대표 채널';
        const pc=document.createElement('input');pc.type='checkbox';pc.checked=!!ch.isPrimary;
        pc.addEventListener('click',e=>e.stopPropagation());
        pc.addEventListener('change',()=>_ecUpdateField(ch.handle,{is_primary:pc.checked},'isPrimary',pc.checked,'대표 채널 변경됨'));
        pw.appendChild(pc);pw.appendChild(document.createTextNode('대표'));
        item.appendChild(pw);
      }
      const delBtn=document.createElement('button');delBtn.className='ec-del-btn';delBtn.type='button';delBtn.textContent='삭제';
      delBtn.addEventListener('click',e=>{e.stopPropagation();_ecDeleteChannel(ch.handle,ch.name);});
      item.appendChild(delBtn);
    }
    const link=document.createElement('a');link.className='ec-link';link.href=ch.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='열기';
    item.appendChild(link);
    listEl.appendChild(item);
  });
}
// ext_channels 단일 필드 즉시 저장(유형 변경과 같은 패턴) — patch는 DB 컬럼명, localKey는 _EXT_CHANNELS
// 캐시의 카멜케이스 키. 저장 성공해야 로컬 캐시도 바꾼다(실패 시 화면과 DB가 어긋나지 않게).
async function _ecUpdateField(handle,patch,localKey,localVal,okMsg){
  if(!sb)return;
  const{error}=await sb.from('ext_channels').update(patch).eq('handle',handle);
  if(error){_showShareToast('오류: '+error.message);return;}
  const ch=_EXT_CHANNELS.find(c=>c.handle===handle);
  if(ch)ch[localKey]=localVal;
  _showShareToast(okMsg);
}
async function _ecUpdateTier(handle,newTier){
  if(!sb)return;
  const{error}=await sb.from('ext_channels').update({tier:newTier}).eq('handle',handle);
  if(error){_showShareToast('오류: '+error.message);return;}
  const ch=_EXT_CHANNELS.find(c=>c.handle===handle);
  if(ch)ch.tier=newTier;
  _showShareToast('유형 변경됨');
}
async function _ecDeleteChannel(handle,name){
  if(!sb)return;
  if(!confirm(`"${name}" 채널을 목록에서 삭제할까요? 이미 동기화된 영상은 그대로 남고, 앞으로 이 채널에서 새 영상만 안 받아옵니다.`))return;
  const{error}=await sb.from('ext_channels').delete().eq('handle',handle);
  if(error){_showShareToast('오류: '+error.message);return;}
  _EXT_CHANNELS=_EXT_CHANNELS.filter(c=>c.handle!==handle);
  _vmRenderChannels(document.getElementById('vm-search')?.value||'');
  _showShareToast('채널 삭제됨');
}
// 이름 하나로 여러 명(동명이인)이 잡히면 owner_mko만으로는 그 중 누구인지 알 수 없어 나중에 엉뚱한
// 사람으로 고정될 수 있음(_extOwnerGko가 ARTISTS.find로 이름만 보고 첫 매치를 집던 문제, 2026-08-21
// 사용자 제보). 등록 시점에 후보가 2명 이상이면 그룹 선택 드롭다운을 띄워 명시적으로 고르게 한다.
function _ecUpdateOwnerGkoOptions(){
  const nameEl=document.getElementById('vm-ch-add-owner');
  const gkoSel=document.getElementById('vm-ch-add-owner-gko');
  if(!nameEl||!gkoSel)return;
  // 공동운영 지원(2026-08-22): 소유자를 쉼표로 여러 명 넣을 수 있음(예: "백승, 뮤"). 이름이 동명이인이거나
  // 소유자들의 그룹이 갈리면 그룹을 명시적으로 고르게 한다(공동소유자는 같은 그룹이 원칙이라 보통은 자동 확정).
  const names=nameEl.value.split(',').map(s=>s.trim()).filter(Boolean);
  const groupSet=new Set();let anyAmbiguous=false;
  names.forEach(nm=>{
    const ms=ARTISTS.filter(a=>a.name.ko===nm);
    if(ms.length>=2)anyAmbiguous=true;
    if(ms.length)ms.forEach(a=>groupSet.add(_ytGroupKoFor(a)));
    else groupSet.add(nm); // GROUPS 밖 솔로 — 이름 자체가 그룹 키
  });
  if(!anyAmbiguous&&groupSet.size<=1){gkoSel.style.display='none';gkoSel.innerHTML='';return;}
  gkoSel.innerHTML='<option value="">그룹 선택…(동명이인/공동소유)</option>'+[...groupSet].map(g=>`<option value="${g}">${g}</option>`).join('');
  gkoSel.style.display='';
}
document.getElementById('vm-ch-add-owner')?.addEventListener('input',_ecUpdateOwnerGkoOptions);
async function _ecAddChannel(){
  if(!sb)return;
  const handleEl=document.getElementById('vm-ch-add-handle');
  const nameEl=document.getElementById('vm-ch-add-name');
  const tierEl=document.getElementById('vm-ch-add-tier');
  const ownerEl=document.getElementById('vm-ch-add-owner');
  const ownerGkoEl=document.getElementById('vm-ch-add-owner-gko');
  const targetGkoEl=document.getElementById('vm-ch-add-target-gko');
  const defCatEl=document.getElementById('vm-ch-add-defcat');
  const primaryEl=document.getElementById('vm-ch-add-primary');
  const handle=(handleEl?.value||'').trim().replace(/^@/,'');
  const name=(nameEl?.value||'').trim();
  const tier=tierEl?.value||'variety';
  const ownerNames=(ownerEl?.value||'').split(',').map(s=>s.trim()).filter(Boolean); // 공동운영 채널: 쉼표로 여러 명(2026-08-22)
  const ownerMko=ownerNames.join(',');
  if(!handle||!name){_showShareToast('핸들과 이름을 입력해주세요');return;}
  if(_EXT_CHANNELS.some(c=>c.handle.toLowerCase()===handle.toLowerCase())){_showShareToast('이미 등록된 채널이에요');return;}
  let ownerGko=null;
  // 소유자(멤버)를 실명으로 지정하는 유형: 아이돌개인은 필수, 팬은 선택(개인 팬채널이면 그 멤버, 아니면 아래 그룹급).
  const memberOwned=(tier==='idol')||(tier==='fans'&&ownerNames.length>0);
  if(memberOwned){
    if(tier==='idol'&&!ownerNames.length){_showShareToast('아이돌개인 유형은 소유자 이름이 필요해요');return;}
    // 공동운영이면 소유자 여러 명 — 그룹(owner_gko)은 공동소유자가 공유한다고 보고 하나로 확정한다.
    const gkoSet=new Set();let anyAmbiguous=false;
    ownerNames.forEach(nm=>{
      const ms=ARTISTS.filter(a=>a.name.ko===nm);
      if(ms.length>=2)anyAmbiguous=true;
      if(ms.length===1)gkoSet.add(_ytGroupKoFor(ms[0]));
      else if(!ms.length)gkoSet.add(nm); // GROUPS에 없는 솔로 — 이름 자체가 그룹 키
    });
    const picked=(ownerGkoEl&&ownerGkoEl.style.display!=='none')?(ownerGkoEl.value||''):'';
    if(anyAmbiguous||gkoSet.size>1){
      if(!picked){_showShareToast('소유자의 그룹을 선택해주세요(동명이인이거나 소유자들 그룹이 갈려요)');return;}
      ownerGko=picked;
    }else{
      ownerGko=picked||[...gkoSet][0]||ownerNames[0];
    }
  }else if(tier==='fans'){
    // 멤버 없이 등록한 팬 채널 = 그룹 전체가 대상 — owner_mko 없이 owner_gko만 채워서 그룹급으로 동작
    // (개인 팬채널이면 위 memberOwned 분기에서 그 멤버로 고정 태깅 + category는 그대로 'fan').
    const targetGko=(targetGkoEl?.value||'').trim();
    if(!targetGko||!_isValidVidGroupKo(targetGko)){_showShareToast('팬 채널은 전용 멤버 실명, 또는 대상 그룹을 입력해주세요');return;}
    ownerGko=targetGko;
  }
  // is_primary는 아이돌개인 채널에만 의미가 있음 — 한 멤버가 채널을 여러 개 가질 수 있는데
  // 멤버 카드 SNS 아이콘은 유튜브 슬롯이 하나뿐이라 어느 걸 걸지 정해야 한다(2026-08-25).
  const row={handle,url:`https://www.youtube.com/@${handle}`,name,tier,owner_mko:memberOwned?ownerMko:null,owner_gko:(memberOwned||tier==='fans')?ownerGko:null,
    default_category:(defCatEl?.value||'')||null,is_primary:tier==='idol'?!!primaryEl?.checked:false};
  const{error}=await sb.from('ext_channels').insert(row);
  if(error){_showShareToast('오류: '+error.message);return;}
  _EXT_CHANNELS.push({handle:row.handle,url:row.url,name:row.name,tier:row.tier,defaultCategory:row.default_category||'',isPrimary:!!row.is_primary,...((row.owner_mko||row.owner_gko)?{owner:{mko:row.owner_mko||null,gko:row.owner_gko||null}}:{})});
  if(handleEl)handleEl.value='';if(nameEl)nameEl.value='';if(ownerEl)ownerEl.value='';if(tierEl)tierEl.value='variety';
  if(ownerGkoEl){ownerGkoEl.value='';ownerGkoEl.style.display='none';ownerGkoEl.innerHTML='';}
  if(targetGkoEl){targetGkoEl.value='';targetGkoEl.style.display='none';}
  if(defCatEl)defCatEl.value='';
  if(primaryEl)primaryEl.checked=false;
  const primWrap=document.getElementById('vm-ch-add-primary-wrap');if(primWrap)primWrap.style.display='none';
  _vmRenderChannels(document.getElementById('vm-search')?.value||'');
  _showShareToast('채널 추가됨');
}
document.getElementById('vm-ch-add-btn')?.addEventListener('click',_ecAddChannel);
document.getElementById('vm-ch-add-tier')?.addEventListener('change',e=>{
  const ownerEl=document.getElementById('vm-ch-add-owner');
  const targetGkoEl=document.getElementById('vm-ch-add-target-gko');
  // 소유자(멤버 실명) 입력칸 — 아이돌개인은 필수, 팬은 선택(개인 팬채널이면 그 멤버 지정, 비우면 그룹급).
  if(ownerEl)ownerEl.style.display=(e.target.value==='idol'||e.target.value==='fans')?'':'none';
  if(targetGkoEl){
    targetGkoEl.style.display=e.target.value==='fans'?'':'none';
    if(e.target.value==='fans')_ensureVidTagGroupList();
  }
  // 동명이인 그룹선택 드롭다운은 소유자 입력을 쓰는 유형(idol/fans)에서만 유지 — 나머지 유형으로 바꾸면 비움
  if(e.target.value!=='idol'&&e.target.value!=='fans'){
    const gkoSel=document.getElementById('vm-ch-add-owner-gko');
    if(gkoSel){gkoSel.value='';gkoSel.style.display='none';gkoSel.innerHTML='';}
  }
  // "대표" 체크박스는 아이돌개인에만 의미 있음(멤버 카드 유튜브 아이콘이 어느 채널을 가리킬지)
  const primWrap=document.getElementById('vm-ch-add-primary-wrap');
  if(primWrap)primWrap.style.display=e.target.value==='idol'?'inline-flex':'none';
  if(e.target.value!=='idol'){const p=document.getElementById('vm-ch-add-primary');if(p)p.checked=false;}
});

// 그룹 우선순위(A>B>C) — 어드민 전용 데이터 관리 우선순위 표시, 유저에게는 절대 노출 안 됨(2026-08-12).
// 레벨 없는 그룹은 group_priority 테이블에 행 자체가 없음(= 미지정).
let _groupPriority=new Map(); // ko -> 'A'|'B'|'C'
let _gpTab='all',_gpSearchTimer=null;
async function _loadGroupPriority(){
  if(!sb)return;
  try{
    // ⚠️ 전량 조회 — id 컬럼이 없어 _sbFetchAll(키셋)은 못 쓰고 _sbSelectAll(range)을 쓴다.
    const{data,error}=await _sbSelectAll(()=>sb.from('group_priority').select('ko,level').order('ko'));
    if(error){console.error('group_priority 로드 실패',error.message);return;}
    _groupPriority=new Map((data||[]).map(r=>[r.ko,r.level]));
  }catch(e){console.error('group_priority 로드 실패',e);}
}
_loadGroupPriority();
const _GP_LEVEL_ORDER={A:0,B:1,C:2};
// 그룹 전체 멤버가 active===false면 해체로 판단 (artists.json 기준, lazy cache)
const _disbandedCache=new Map();
function _isGroupDisbanded(ko){
  if(_disbandedCache.has(ko))return _disbandedCache.get(ko);
  const members=ARTISTS.filter(a=>a.group.ko===ko);
  const result=members.length>0&&members.every(a=>a.active===false);
  _disbandedCache.set(ko,result);
  return result;
}
function _gpRenderList(term){
  const listEl=document.getElementById('gp-list');
  if(!listEl)return;
  const q=(term||'').trim().toLowerCase();
  let rows=Object.keys(GROUPS).map(ko=>({ko,info:GROUPS[ko],level:_groupPriority.get(ko)||''}));
  if(q)rows=rows.filter(r=>r.ko.toLowerCase().includes(q)||(r.info.en||'').toLowerCase().includes(q));
  if(_gpTab==='survival')rows=rows.filter(r=>!!r.info.projectRing);
  else if(_gpTab!=='all')rows=rows.filter(r=>_gpTab==='none'?!r.level:r.level===_gpTab);
  rows.sort((a,b)=>{
    if(_gpTab==='all'){
      const oa=a.level?_GP_LEVEL_ORDER[a.level]:3,ob=b.level?_GP_LEVEL_ORDER[b.level]:3;
      if(oa!==ob)return oa-ob;
    }
    return a.ko.localeCompare(b.ko,'ko');
  });
  // 레벨별 카운트 → 탭 표기 갱신
  const allKeys=Object.keys(GROUPS);
  const lvlCnt={A:0,B:0,C:0,none:0};
  allKeys.forEach(ko=>{const l=_groupPriority.get(ko)||'';if(l==='A')lvlCnt.A++;else if(l==='B')lvlCnt.B++;else if(l==='C')lvlCnt.C++;else lvlCnt.none++;});
  const survivalCnt=allKeys.filter(ko=>GROUPS[ko].projectRing).length;
  document.querySelectorAll('.gp-tab').forEach(t=>{
    const cnt=t.querySelector('.gp-tab-cnt');if(!cnt)return;
    const l=t.dataset.lvl;
    cnt.textContent=`(${l==='all'?allKeys.length:l==='none'?lvlCnt.none:l==='survival'?survivalCnt:lvlCnt[l]||0})`;
  });
  document.getElementById('gp-count').textContent=`총 ${allKeys.length}개 중 ${rows.length}개 표시`;
  if(!rows.length){
    listEl.innerHTML=`<div id="gp-empty">${q?'검색 결과가 없어요':'해당 레벨의 그룹이 없어요'}</div>`;
    return;
  }
  listEl.innerHTML='';
  rows.forEach(r=>{
    const item=document.createElement('div');item.className='gp-item';
    const info=document.createElement('div');info.className='gp-info';
    const name=document.createElement('div');name.className='gp-name';
    const nameText=document.createElement('span');nameText.className='gp-name-text';nameText.textContent=r.ko;
    name.appendChild(nameText);
    if(_isGroupDisbanded(r.ko)){const tag=document.createElement('span');tag.className='gp-disbanded-tag';tag.textContent='해체';name.appendChild(tag);}
    if(r.info.projectRing){const tag=document.createElement('span');tag.className='gp-survival-tag';tag.textContent='서바이벌';name.appendChild(tag);}
    info.appendChild(name);
    const subParts=[r.info.en,r.info.co].filter(Boolean);
    if(subParts.length){const sub=document.createElement('div');sub.className='gp-sub';sub.textContent=subParts.join(' · ');info.appendChild(sub);}
    item.appendChild(info);
    const sel=document.createElement('div');sel.className='gp-level-sel';
    [['A','A'],['B','B'],['C','C'],['','미지정']].forEach(([lvl,label])=>{
      const btn=document.createElement('button');btn.type='button';btn.className='gp-lvl-btn'+(lvl===''?' gp-lvl-clear':'');
      btn.dataset.lvl=lvl;btn.textContent=label;
      if((r.level||'')===lvl)btn.classList.add('active');
      btn.addEventListener('click',()=>_gpSetLevel(r.ko,lvl));
      sel.appendChild(btn);
    });
    item.appendChild(sel);
    listEl.appendChild(item);
  });
}
async function _gpSetLevel(ko,level){
  if(!sb)return;
  if(level)_groupPriority.set(ko,level);else _groupPriority.delete(ko);
  _gpRenderList(document.getElementById('gp-search')?.value||'');
  try{
    if(level){
      const{error}=await sb.from('group_priority').upsert({ko,level},{onConflict:'ko'});
      if(error)throw error;
    }else{
      const{error}=await sb.from('group_priority').delete().eq('ko',ko);
      if(error)throw error;
    }
  }catch(e){
    console.error('그룹 우선순위 저장 실패',e);
    _showShareToast('오류: '+(e.message||'저장 실패'));
  }
}
document.getElementById('sp-gp-btn')?.addEventListener('click',()=>{
  _admDockShow('gp-overlay');
  _gpTab='all';
  document.querySelectorAll('.gp-tab').forEach(t=>t.classList.toggle('active',t.dataset.lvl==='all'));
  const searchEl=document.getElementById('gp-search');if(searchEl)searchEl.value='';
  _gpRenderList('');
});
document.getElementById('gp-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');});
document.getElementById('gp-close')?.addEventListener('click',()=>document.getElementById('gp-overlay').classList.remove('open'));
document.querySelectorAll('.gp-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    _gpTab=btn.dataset.lvl;
    document.querySelectorAll('.gp-tab').forEach(t=>t.classList.toggle('active',t===btn));
    _gpRenderList(document.getElementById('gp-search')?.value||'');
  });
});
document.getElementById('gp-search')?.addEventListener('input',()=>{
  clearTimeout(_gpSearchTimer);
  const val=document.getElementById('gp-search').value;
  _gpSearchTimer=setTimeout(()=>_gpRenderList(val),200);
});

// 사용자 피드백 조회 — 어드민 전용, 읽기+삭제만(상태 추적 없음, 처리 끝난 건 삭제로 정리)(2026-08-18)
let _feedbackRows=[],_fbvTab='all';
const _FB_CAT_LABEL={bug:'버그 제보',suggest:'제안',etc:'기타'};
async function _loadFeedback(){
  if(!sb)return;
  try{
    // ⚠️ 유저가 보내는 만큼 늘어나는 테이블 — created_at 동률 대비로 id를 2차 정렬에 붙인다.
    const{data,error}=await _sbSelectAll(()=>sb.from('feedback').select('*').order('created_at',{ascending:false}).order('id'));
    if(error){console.error('feedback 로드 실패',error.message);return;}
    _feedbackRows=data||[];
  }catch(e){console.error('feedback 로드 실패',e);}
}
function _fbvRenderList(){
  const listEl=document.getElementById('fbv-list');
  if(!listEl)return;
  let rows=_feedbackRows;
  if(_fbvTab!=='all')rows=rows.filter(r=>r.category===_fbvTab);
  const cnt={bug:0,suggest:0,etc:0};
  _feedbackRows.forEach(r=>{if(cnt[r.category]!==undefined)cnt[r.category]++;});
  document.querySelectorAll('.fbv-tab').forEach(t=>{
    const c=t.querySelector('.fbv-tab-cnt');if(!c)return;
    const cat=t.dataset.cat;
    c.textContent=`(${cat==='all'?_feedbackRows.length:cnt[cat]||0})`;
  });
  document.getElementById('fbv-count').textContent=`총 ${rows.length}개`;
  if(!rows.length){
    listEl.innerHTML=`<div id="fbv-empty">${_fbvTab==='all'?'피드백이 없어요':'해당 카테고리 피드백이 없어요'}</div>`;
    return;
  }
  listEl.innerHTML='';
  rows.forEach(r=>{
    const item=document.createElement('div');item.className='fbv-item';
    const top=document.createElement('div');top.className='fbv-item-top';
    const tag=document.createElement('span');tag.className='fbv-cat-tag fbv-cat-'+r.category;tag.textContent=_FB_CAT_LABEL[r.category]||r.category;
    top.appendChild(tag);
    const date=document.createElement('span');date.className='fbv-date';
    date.textContent=r.created_at?new Date(r.created_at).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    top.appendChild(date);
    const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='fbv-del-btn';delBtn.textContent='삭제';
    delBtn.addEventListener('click',()=>_fbvDelete(r.id));
    top.appendChild(delBtn);
    item.appendChild(top);
    const msg=document.createElement('div');msg.className='fbv-msg';msg.textContent=r.message;
    item.appendChild(msg);
    const metaParts=[r.nickname,r.contact,r.page_url].filter(Boolean);
    if(metaParts.length){
      const meta=document.createElement('div');meta.className='fbv-meta';meta.title=metaParts.join(' · ');meta.textContent=metaParts.join(' · ');
      item.appendChild(meta);
    }
    listEl.appendChild(item);
  });
}
async function _fbvDelete(id){
  if(!sb)return;
  if(!confirm('이 피드백을 삭제할까요?'))return;
  const{error}=await sb.from('feedback').delete().eq('id',id);
  if(error){_showShareToast('오류: '+error.message);return;}
  _feedbackRows=_feedbackRows.filter(r=>r.id!==id);
  _fbvRenderList();
}
document.getElementById('sp-fb-btn')?.addEventListener('click',async()=>{
  document.getElementById('fbv-overlay').classList.add('open');
  _fbvTab='all';
  document.querySelectorAll('.fbv-tab').forEach(t=>t.classList.toggle('active',t.dataset.cat==='all'));
  document.getElementById('fbv-list').innerHTML='<div id="fbv-empty">불러오는 중…</div>';
  await _loadFeedback();
  _fbvRenderList();
});
document.getElementById('fbv-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');});
document.getElementById('fbv-close')?.addEventListener('click',()=>document.getElementById('fbv-overlay').classList.remove('open'));
document.querySelectorAll('.fbv-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    _fbvTab=btn.dataset.cat;
    document.querySelectorAll('.fbv-tab').forEach(t=>t.classList.toggle('active',t===btn));
    _fbvRenderList();
  });
});

// vm 패널 이벤트
document.getElementById('vm-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');});
document.getElementById('vm-close')?.addEventListener('click',()=>document.getElementById('vm-overlay').classList.remove('open'));
document.querySelectorAll('.vm-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    _vmTab=btn.dataset.tab;
    document.querySelectorAll('.vm-tab').forEach(t=>t.classList.toggle('active',t===btn));
    document.getElementById('vm-search').value='';
    _vmApplyTab();
    _vmSaveLast(); // vm개선 3(c)
  });
});
let _vmScrollTimer=null;
document.getElementById('vm-list')?.addEventListener('scroll',()=>{clearTimeout(_vmScrollTimer);_vmScrollTimer=setTimeout(_vmSaveLast,300);},{passive:true});
document.getElementById('vm-search')?.addEventListener('input',()=>{
  const val=document.getElementById('vm-search').value;
  if(_vmTab==='channels'){_vmRenderChannels(val);return;} // 채널 목록은 이미 메모리에 있는 배열 필터라 디바운스 불필요
  clearTimeout(_vmSearchTimer);
  _vmSearchTimer=setTimeout(()=>{_vmLoad(val);_vmSaveLast();},300);
});
// 재검색은 새 조회 없이 이미 받아온 _vmRows를 그대로 다시 필터링만 하므로 디바운스를 짧게 둬도 부담 없음
document.getElementById('vm-search-2')?.addEventListener('input',()=>{
  clearTimeout(_vmSearch2Timer);
  const val=document.getElementById('vm-search-2').value;
  _vmSearch2Timer=setTimeout(()=>{_vmSearch2=val.trim();_vmRenderVideoList();},120);
});
document.getElementById('vm-only-normal-btn')?.addEventListener('click',()=>{
  _vmOnlyNormal=!_vmOnlyNormal;
  document.getElementById('vm-only-normal-btn').classList.toggle('active',_vmOnlyNormal);
  _vmRenderVideoList();
});
document.getElementById('vm-select-all')?.addEventListener('change',e=>{
  document.querySelectorAll('#vm-list .vm-item input[type=checkbox]').forEach(cb=>{cb.checked=e.target.checked;});
  _vmUpdateCount();
});
const _VM_FLAG_LABEL={'무관':'무관','보류':'보류','hidden':'숨김'};
// 선택 항목의 content_flag를 임의의 상태로 바꾼다(2026-08-27, 4상태 대칭).
// 예전엔 탭마다 탈출구가 "정상(null)" 하나뿐이라, 잘못 분류된 걸 발견해도 옆 상태로 못 옮기고
// 정상으로 되돌린 뒤 다시 찾아 분류해야 하는 막다른 골목이었다(사용자 제보 — "숨김 탭에 선택-무관
// 버튼이 없는데 있는 게 좋지 않을까"). 세 상태의 뜻이 서로 다르므로(숨김=우주 안인데 노출 금지 /
// 무관=우주 밖 / 보류=판단 유예) 옆으로 옮기는 건 정상적인 검수 동작이다.
async function _vmBulkSetFlag(newFlag,btnId){
  if(!sb)return;
  const btn=document.getElementById(btnId);
  const items=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  const restore=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='처리 중…';}
  // 되돌리기 스냅샷 — 예전엔 "선택-무관" 하나만 이걸 남기고 보류/정상은 안 남겼는데, 셋 다 수백 행을
  // 한 번에 바꾸는 같은 성격의 동작이라 기준이 갈릴 이유가 없다. 이 프로젝트는 undo가 곧 백업이다
  // (2026-08-22 백업전략 #1, 3.5만 재스캔 사고 재발 방지책). 실패해도 원 작업은 막지 않는다.
  await _snapshotBeforeBulk(`영상 관리 일괄 ${newFlag?(_VM_FLAG_LABEL[newFlag]||newFlag):'정상'}`,ids);
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch(newFlag,'manual')).in('id',ids);
  const done=()=>{if(btn){btn.disabled=false;btn.textContent=restore;}};
  if(error){done();document.getElementById('vm-status').textContent='오류: '+error.message;return;}
  _vmScheduleTotals(); // 총계 재조회(vm개선 2)
  const idSet=new Set(ids);
  // 편집 이력 — '보류' 더미가 바로 여기서 만들어진다. 어떤 영상을 사람이 보류로 보냈는지가 곧
  // "매처가 이 영상을 잘못 잡았다"는 라벨이라, 학습 재료로는 태그 편집만큼 값지다.
  // (_vmRows에 이미 편집 전 상태가 있어서 추가 조회 없이 before를 뜬다.)
  _tagEditLog(_vmRows.filter(v=>idSet.has(v.id)).map(v=>({videoId:v.id,title:v.title,before:{content_flag:v.content_flag||null},after:{content_flag:newFlag||null},source:'vm_bulk_flag'})));
  // 이 탭이 "그 플래그의 목록"인가 — 목록의 정체성과 다른 값으로 바뀐 행만 화면에서 걷어낸다.
  const tabFlag=_vmTabFlag();
  const staysInList=tabFlag===undefined||newFlag===tabFlag;
  if(staysInList){
    // 전체 탭은 검색 결과 목록이라 플래그를 바꿔도 그대로 남아있어야 함(nomem/hidden 탭처럼 그 자체가
    // "무관/숨김 목록"이 아니므로) — 행을 지우지 않고 배지와 체크박스만 갱신한다.
    _vmRows.forEach(v=>{if(idSet.has(v.id))v.content_flag=newFlag;});
    _vmCacheSync();
    items.forEach(el=>{
      const cb=el.querySelector('input[type=checkbox]');if(cb)cb.checked=false;
      const flagBtn=el.querySelector('.vm-flag-btn');
      if(flagBtn){
        const cls=newFlag==='hidden'?'vm-flag-hidden':newFlag==='보류'?'vm-flag-hold':newFlag==='무관'?'vm-flag-nomem':'vm-flag-none';
        flagBtn.className='vm-flag-btn '+cls;
        flagBtn.textContent=newFlag?(_VM_FLAG_LABEL[newFlag]||newFlag):'정상';
      }
    });
    document.getElementById('vm-status').textContent=`${ids.length}개 ${newFlag?(_VM_FLAG_LABEL[newFlag]||newFlag):'정상'} 처리 완료`;
  }else{
    _vmRows=_vmRows.filter(v=>!idSet.has(v.id));
    _vmCacheSync();_vmCacheDropAffected(newFlag); // 목록에서 걷어낸 결과를 캐시에도 반영(2026-08-27)
    items.forEach(el=>el.remove());
    const to=newFlag?(_VM_FLAG_LABEL[newFlag]||newFlag):'정상';
    document.getElementById('vm-status').textContent=`${ids.length}개 → ${to} — 남은 ${_vmRows.length}개`;
    if(!_vmRows.length)_vmRenderVideoList();
  }
  done();
  _vmUpdateCount();
}
_VM_FLAG_BTNS.forEach(([id,flag])=>document.getElementById(id)?.addEventListener('click',()=>_vmBulkSetFlag(flag,id)));
// 탭과 무관하게 항상 '개별출연'으로 고정 — 각자 그룹/멤버 카드엔 그대로 노출되지만 "함께한 멤버"/연결
// 카드 집계에서는 빠지는 플래그(진짜 콜라보가 아니라 같은 영상에 각자 따로 출연한 경우), 2026-08-04
// 사용자 요청으로 무관 처리 버튼과 동일한 자리에 원클릭 버튼으로 추가.
document.getElementById('vm-indiv-btn')?.addEventListener('click',async()=>{
  if(!sb)return;
  const btn=document.getElementById('vm-indiv-btn');
  const items=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const newFlag='개별출연';
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch(newFlag,'manual')).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='선택-개별';document.getElementById('vm-status').textContent='오류: '+error.message;return;}
  const idSet=new Set(ids);
  if(_vmTab==='all'){
    _vmRows.forEach(v=>{if(idSet.has(v.id))v.content_flag=newFlag;});
    items.forEach(el=>{
      const cb=el.querySelector('input[type=checkbox]');if(cb)cb.checked=false;
      const flagBtn=el.querySelector('.vm-flag-btn');
      if(flagBtn)_vmSetFlagLabel(flagBtn,newFlag);
    });
    document.getElementById('vm-status').textContent=`${ids.length}개 개별출연 처리 완료`;
  }else{
    _vmRows=_vmRows.filter(v=>!idSet.has(v.id));
    _vmCacheSync();_vmCacheDropAffected(); // 목록에서 걷어낸 결과를 캐시에도 반영(2026-08-27)
    items.forEach(el=>el.remove());
    document.getElementById('vm-status').textContent=`${ids.length}개 처리 완료 — 남은 ${_vmRows.length}개`;
    if(!_vmRows.length)_vmRenderVideoList();
  }
  btn.textContent='선택-개별';
  _vmUpdateCount();
});
// 선택 항목 원곡 정보 제외 — cover_of_members/cover_of_groups만 비운다. content_flag는 안 건드리므로
// (원곡 오태깅과 무관/숨김 여부는 별개) 위 개별출연/무관 버튼과 달리 어느 탭에서 눌러도 목록에서 항목이
// 사라지지 않는다(2026-08-14, 사용자 요청 — 원곡 커버 검수 화면 없이도 바로 지울 수 있으면 좋겠다는 요청).
document.getElementById('vm-coverclear-btn')?.addEventListener('click',async()=>{
  if(!sb)return;
  const btn=document.getElementById('vm-coverclear-btn');
  const items=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const{error}=await sb.from(_YT_TABLE).update({cover_of_members:[],cover_of_groups:[]}).in('id',ids);
  btn.textContent='선택-원곡제외';
  if(error){btn.disabled=false;document.getElementById('vm-status').textContent='오류: '+error.message;return;}
  const idSet=new Set(ids);
  _vmRows.forEach(v=>{if(idSet.has(v.id)){v.cover_of_members=[];v.cover_of_groups=[];}});
  items.forEach(el=>{const cb=el.querySelector('input[type=checkbox]');if(cb)cb.checked=false;});
  document.getElementById('vm-status').textContent=`${ids.length}개 원곡 정보 제외 완료`;
  _vmUpdateCount();
});
document.getElementById('vm-edit-btn')?.addEventListener('click',()=>{
  if(!sb||!_isAdmin())return;
  const ids=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked).map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  const idSet=new Set(ids);
  const selRows=_vmRows.filter(v=>idSet.has(v.id));
  const kos=new Set(selRows.map(v=>v.group_ko).filter(Boolean));
  const ko=selRows[0]?.group_ko||'';
  _openVidTagModalBulk(ids,ko);
  // 검색 결과가 여러 그룹에 걸쳐 있을 수 있는 전체 탭 특성상, 멤버 체크박스는 첫 영상의 그룹 기준으로만
  // 그려짐 — "덮어쓰기"를 켜면 다른 그룹 영상까지 그 그룹 멤버로 잘못 씌워질 수 있어 미리 경고해둔다.
  if(kos.size>1){
    const statusEl=document.getElementById('vid-tag-status');
    if(statusEl)statusEl.textContent=`선택한 영상이 ${kos.size}개 그룹에 걸쳐 있어요 — "멤버/콜라보 태그도 덮어쓰기"는 끄고 사용하세요`;
  }
});
document.querySelectorAll('.vm-ch-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    _vmChTab=btn.dataset.tab;
    _vmChTierFilter='all';
    document.querySelectorAll('.vm-ch-tab').forEach(t=>t.classList.toggle('active',t===btn));
    document.getElementById('vm-search').value='';
    _vmRenderChTierChips();
    _vmRenderChannels('');
  });
});

// ── 멤버+콜라보 자동 태깅(미태깅분) — 2026-07-21에 스크래치패드 스크립트로 1회성으로 돌렸던
// 매칭 로직(성+이름 실명표기/조사/해시태그/영문 토큰) 그대로 앱에 내장. 2026-07-29에 콜라보
// 감지(with_members/with_groups)도 추가— 자체 채널 챌린지 영상은 "챌린지"라는 표시 없이 바로
// 다른 그룹 멤버 이름만 나오는 경우가 많고, 로스터가 계속 늘어나서 예전엔 못 잡던 이름이 새로
// 잡히기도 하므로, 외부채널 태깅에 쓰던 _m2ParseTitle을 그대로 재사용해 같이 훑는다.
const _ATM_KOREAN_SURNAMES=new Set(['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','전','홍',
  '유','고','문','양','손','배','백','허','남','심','노','하','곽','성','차','주','우','구','민','류','나',
  '진','지','엄','채','원','천','방','공','현','함','변','염','여','추','도','소','석','선','설','마','길','연','위','표','명','기',
  '반','왕','금','옥','육','인','맹','제','모','피','두','예','경','봉','사','부','편','가','복','간','승','팽','상',
  '황보','제갈','남궁','선우']);
function _atmEscRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function _atmTokenize(title){return(title||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);}
// 단일음절이 아니어도(_atmMatchesMember의 multiChar 보호를 안 받는 이름이어도) 아주 흔한 단어/영어 축약형과
// 겹쳐서 평문 매칭 시 대량 오탐이 나는 이름 — 발견될 때마다 여기 추가. 해시태그로 명시된 경우만 인정한다.
// "여름"(우주소녀) — 그냥 "여름"(summer)이라는 흔한 단어라 무관한 영상에 계속 걸림, 심지어 온앤오프 자체
// 곡 제목("여름 쏙")에도 우연히 들어있어 그쪽 채널까지 오염시킴.
// "아이엠"(몬스타엑스) — 영문 "I.M"이 "I'm"(아포스트로피도 비문자라 토큰화하면 "i"+"m"으로 갈라짐)과 완전히
// 겹쳐서 "I'm ~"으로 시작하는 흔한 캡션이 전부 잡힘(2026-07-31, 둘 다 실측으로 대량 오염 확인).
// "가을"(아이브)/"하늘"(키스오브라이프)/"바다"(S.E.S.) — 계절/자연을 뜻하는 흔한 단어를 그대로 활동명으로
// 쓰는 경우도 같은 위험군이라 같이 등록(여름 케이스 수정 검증 중 "가을"이 무관한 제목에 실제로 잡히는 걸
// 발견해서 같이 발견된 나머지도 선제적으로 추가함). 비(솔로)/봄(앳하트)은 이미 1글자라 별도 규칙으로 보호됨.
// "이유"(에버글로우) — "이유"가 "reason"이라는 흔한 단어라 무관한 제목("헤어진 이유", "안 되는 이유" 등)에
// 대량으로 걸림(2026-08-03, 사용자 제보로 발견).
// 2026-08-03 추가분 — 두 가지 원인이 섞여있음(둘 다 이 목록 하나로 막힘, _atmMatchesMember 참고):
// "Love"(온리원오프)/"JIN"(러블리즈)/"이런"(에버글로우)/"뉴"(더보이즈, 한글 자체는 1음절이라 이미
// 보호되지만 영문 "New"가 안 막혀서 추가) — 이름 자체가 흔한 단어인 기존 패턴과 동일.
// "고우리"(레인보우)/"유사랑"(이즈나) — 새로 발견된 패턴: 이름 앞글자가 흔한 성씨(고/유)와 우연히
// 겹쳐서 "성+이름 구조"로 오인식 → 성을 뗀 나머지("우리"/"사랑")가 그 자체로 극히 흔한 단어라 평문
// 매칭 시 대량 오염됨(_atmStripSurname 로직이 원인, 사용자 제보로 발견).
// "종현"(샤이니)/"문빈"(아스트로)/"구하라"(카라)/"설리"(에프엑스) — 위와는 다른 이유로 등록: 동명이인/흔한
// 단어 충돌이 아니라 고인이 된 멤버들이라, 평문 언급(추모글·회고 클립·다른 사람 언급 등)만으로 새 영상이
// 계속 태깅되는 걸 원치 않는다는 요청(2026-08-04)에 따라 명시적 해시태그가 있을 때만 인정하게 제한.
// "노을"(레인보우) — "노을"이 "석양"을 뜻하는 흔한 단어라 무관한 영상(감성 브이로그, 풍경 영상, 동명 곡
// 등)에 대량으로 걸림 — 제목에 "레인보우"조차 없는 영상이 group_ko='레인보우'로 대거 오염된 원인
// (_m2ParseTitle의 멤버 이름 역추론 폴백이 "노을"만 보고 그룹을 추론함, 2026-08-04 사용자 제보로 발견).
// "여름"/"가을"/"하늘"/"바다"와 완전히 같은 패턴인데 그동안 빠져있었음.
// "조현영"(레인보우) — "고우리"/"유사랑"과 똑같은 성씨-스트립 패턴: "조"(흔한 성씨)를 떼면 "현영"만
// 남는데, 이건 레인보우와 무관한 유명 배우 이름이라 그 사람 관련 영상까지 레인보우로 오염됨
// (2026-08-04, "노을" 수정 후 사용자가 "이거 말고도 더 있는 것 같다"고 재확인 요청해서 발견).
// 레인보우 정리 후에도 "진짜 무맥락 영상"이 많다는 재확인 끝에 같은 패턴이 다른 그룹에도 널리 퍼져있는
// 걸 발견(2026-08-04) — 전부 "멤버 이름 = 극흔한 단어/브랜드명"이라 _m2ParseTitle의 멤버 이름 역추론
// 폴백에 걸림:
// "테오"(다크비) — 완전히 무관한 유튜브 채널 "TEO"의 영상들이 이 채널명 하나만으로 다크비로 대량 오염.
// "바로"(비원에이포) — "즉시/바로"라는 뜻의 극흔한 부사.
// "여정"(티오원) — "journey"라는 뜻의 극흔한 명사(예: "지구 닦기 여정" 같은 무관한 제목에 걸림).
// "온다"(에버글로우) — "(계절/때가) 온다"는 극흔한 동사. 당시 에버글로우 전용 무관 영상 정리 버튼의
// 화이트리스트에 "온다"/"ONDA"가 들어있어서 오히려 이 원인으로 오염된 행을 안 지우고 보호하고 있었음 —
// 이런 그룹별 하드코딩 버튼들은 이후 "데이터 퀄리티" 패널의 그룹별 "정리" 기능(GROUPS/ARTISTS에서
// 신호를 자동으로 뽑고 이 보호 목록에 있는 이름은 자동으로 제외하는 방식)으로 통합돼서 제거됨
// (2026-08-04, 사용자 요청 — "이런 애들 계속 따로 만들지 말고 한번에 관리하는 탭").
// 'JIN'(영문 대문자)로 잘못 들어가 있던 걸 발견 — 이 Set은 항상 등록명의 한글(m.ko)로 조회되는데
// 방탄소년단 진의 name.ko는 "진"이라 'JIN'은 절대 매칭될 수 없는 죽은 항목이었음(2026-08-05, 사용자가
// 박우진/권진아/진현주 영상에 방탄소년단 진이 잘못 얽혀있다고 제보하며 발견). 'Love'는 실제로 그 멤버의
// name.ko 자체가 "Love"라 정상.
// 2026-08-14: 종현/문빈/구하라/설리는 _ATM_NO_CONTEXT_RELAX_NAMES(아래)에도 같이 걸려있는 민감한
// 이름(고인)이라 재배포 없이 한 번의 실수 클릭으로 보호가 풀리지 않도록 계속 하드코딩으로 남긴다.
// 나머지는 DB(name_match_whitelist)로 이전 — 이제 보호 목록 화면에서 × 눌러 즉시 제거 가능해짐
// (SQL은 대화 참고, admin이 직접 실행).
const _ATM_HASHTAG_ONLY_NAMES=new Set(['종현','문빈','구하라','설리']);
// 보니/미소(드림노트): "알고 보니"/"어쩌다 보니"/"미소 짓다"처럼 흔한 관용구·단어의 일부로 대량 오매칭됨
// (2026-08-06, 사용자 제보 — 실측 결과 보니 151건 중 상당수, 미소 76건 다수가 무관 예능/뉴스 클립).
// 하드코딩 목록 + DB(name_match_whitelist, admin이 스캔 화면에서 바로 추가) 목록을 합쳐서 판단.
function _isHashtagOnlyName(name){return _ATM_HASHTAG_ONLY_NAMES.has(name)||_ATM_DYNAMIC_HASHTAG_NAMES.has(name);}
// 트리플에스처럼 등록된 이름 자체가 "성+이름"(예: 김채원)인 그룹은, 영상 제목에서 성 없이 이름만
// 쓰는(흔한) 표기를 못 잡는 문제가 있었음 — 반대로 프로미스나인처럼 이름만 등록된 경우는 제목에 성이
// 붙어도 이미 아래 surRe로 잡혔음. 등록명이 알려진 성으로 시작하면 성을 뗀 나머지도 매칭 대상에 넣는다.
// 2글자 성(황보/제갈/남궁/선우)을 1글자 성보다 먼저 검사해 "남궁"을 "남"+"궁OO"로 잘못 자르지 않게 함.
function _atmStripSurname(nameChars){
  const two=nameChars.length>=4?nameChars.slice(0,2).join(''):null;
  if(two&&_ATM_KOREAN_SURNAMES.has(two))return nameChars.slice(2).join('');
  if(nameChars.length>=3&&_ATM_KOREAN_SURNAMES.has(nameChars[0]))return nameChars.slice(1).join('');
  return null;
}
// 영문명을 비교용 키로 정규화 — _atmMatchesMember가 영문 매칭에 쓰는 토큰 분해와 **같은 규칙**이어야
// 한다("Jang Hyeri"→"jang hyeri"). 성 뗀 영문 변형이 같은 그룹 멤버의 정식 영문명과 겹치는지 판정하는
// 가드가 이 키로 대조한다(2026-09-02).
function _atmEnKey(en){return String(en||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ');}
// 성 뗀 이름 변형(한글 givenOnly / 영문 rest)이 **같은 그룹 안 다른 멤버의 정식 등록명**과 겹치는지.
// 겹치면 그 변형으로는 매칭하지 않는다 — 장혜리(Jang Hyeri)의 "혜리"/"hyeri"가 같은 걸스데이 현 멤버
// 혜리(Hyeri)를 가리키므로, 혜리 영상마다 장혜리가 딸려붙었다.
// ⚠️ 전역(모든 아티스트)으로 넓히지 말 것. 이 경로는 group_ko가 이미 확정된 **자체 채널** 매칭이라
// 다른 그룹의 동명이인은 애초에 충돌이 아니다("스트레이키즈 채널의 #chan"은 티오원 찬일 수 없다).
// 2026-09-01 수정이 한글 쪽을 전역으로 걸었다가, 실충돌 1명(장혜리)을 잡으려고 188명(안유진→#유진,
// 홍은채→#은채, 강혜원→#혜원 …)의 정상 매칭까지 꺼진 것을 2026-09-02 실측으로 발견해 그룹 한정으로
// 좁혔다. 영문 경로(#HYERI)는 그 수정에서 아예 빠져 있어 오태깅 292건이 남아 있었고, 여기서 같이 막는다.
function _atmNameTakenByGroupmate(nm,gko,isEn){
  if(!nm||!gko)return false;
  return ARTISTS.some(o=>(isEn?(o.name.en&&_atmEnKey(o.name.en)===nm):o.name.ko===nm)
    &&_artistGroups(o).some(g=>g.ko===gko));
}
// 자체 채널 멤버 매칭용 로스터. 태깅/재검증 스윕이 전부 이걸 써야 기준이 갈리지 않는다 — 예전엔 다섯
// 군데가 각자 손으로 만들면서 두 가지가 어긋나 있었다(2026-09-02에 한 곳으로 모음).
//   ① left를 a.left(대표값)로만 넘겨서 **그룹별 탈퇴일 override를 통째로 무시**했다. 겸임 멤버는
//      그룹마다 탈퇴 시점이 다르다(위키미키 최유정은 위키미키에선 2024.08.08 탈퇴, 아이오아이에선
//      현역) — _atmResolveMembers의 발행일 컷오프가 이 값을 보므로, 그룹별 값이 우선이어야 한다.
//   ② 재검증 쪽(_atmScopedMemberReverify/_ytSweepMembersMistag)만 aliases를 안 실었다. 그러면 별칭으로만
//      잡히던 멤버(JAY B→제이비 등)가 재검증에서 "근거 없음"으로 판정돼 멀쩡한 태그가 걷혔다.
function _atmRosterFor(gko){
  return ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko)).map(a=>{
    const e=_artistGroups(a).find(g=>g.ko===gko)||{};
    return{ko:a.name.ko,en:a.name.en,left:(e.left!==undefined?e.left:a.left),aliases:a.matchAliases};
  });
}
// "가인"(브라운아이드걸스)의 "성+이름" 매칭에서 흔한 성씨 "송"이 우연히 걸려 무관한 트롯 가수 "송가인"이
// 대량으로 오태깅됨 — 가인의 실명은 "손가인"이라 "손"은 그대로 인정하고 "송"만 예외 처리한다
// (2026-08-04, 사용자 제보). 이름별로 특정 성씨만 배제해야 하는 경우가 더 생기면 여기에 추가.
const _ATM_SURNAME_EXCLUDE={'가인':new Set(['송'])};
// 흔한단어 보호 목록 중 고인이 된 멤버들(종현/문빈/구하라/설리)은 "흔한 단어와 겹쳐서"가 아니라 "평문
// 언급만으로 새 영상이 계속 태깅되는 걸 원치 않는다"는 별개의 이유로 해시태그 전용이라(2026-08-04 사용자
// 요청), 아래 "그룹명+직캠 문맥이면 평문도 인정" 완화 대상에서 반드시 제외해야 함 — 문맥이 아무리 맞아도
// 이 넷은 계속 해시태그가 있어야만 인정.
const _ATM_NO_CONTEXT_RELAX_NAMES=new Set(['종현','문빈','구하라','설리']);
// 흔한단어라 평문 매칭을 막아둔 이름(가을 등)이라도, 제목에 소속 그룹명 + "직캠"이 같이 있으면 그 영상은
// 거의 확실히 그 멤버 개인 직캠이라 오염 위험이 낮음 — 평문 매칭을 다시 허용한다(2026-08-05, 아이브
// 가을 사례 — "아이브 가을 직캠"처럼 그룹명+직캠이 다 있는데도 해시태그가 없어서 계속 미태깅으로 남던
// 문제). groupKo는 호출부에서 이 멤버가 속한 채널의 그룹으로 넘겨준다.
function _atmContextRelaxesHashtagOnly(name,title,groupKo){
  if(_ATM_NO_CONTEXT_RELAX_NAMES.has(name))return false;
  if(!groupKo||!/직캠/.test(title))return false;
  const g=GROUPS[groupKo];
  if(!g)return false;
  const toks=[groupKo,g.en].filter(Boolean);
  return toks.some(t=>title.toUpperCase().includes(t.toUpperCase()));
}
// "하루"(=하루/a day, 일반명사)가 넥스지 멤버 하루로 오매칭되던 것 방어(2026-08-29 사용자 제보 — "○○의 하루"
// 브이로그류가 그룹 확정 문맥에선 흔한단어 게이트가 안 걸려 평문으로 멤버 하루에 붙어, 매일 동기화마다 재오염).
// 일반명사 문맥("X의 하루"=누구의 하루·"하루종일"·"하루하루")의 "하루"만 매칭 전에 지운다. 소유자는 보존
// (리쿠'의' 하루 → 리쿠는 남김), "하루의 …"(하루가 소유자)·"#하루"·"하루 직캠" 등 진짜 멤버 언급도 보존.
// 두 매처(_atmMatchesMember/_atmResolveMembers·_m2ParseTitle)가 공유한다.
function _atmStripCommonNounCtx(title){
  let t=title||'';
  // "bts of ○○" = behind the scenes. 방탄소년단(BTS)과 철자가 같아 콜라보로 잘못 잡힌다 —
  // 실측(2026-08-31): 제목에 'bts of'가 든 62건 중 **55건이 방탄소년단 태그**였고 전부 오탐이었다
  // (`bts of impossible: day 3 #RIIZE`, `bts of We are FIFTY FIFTY` …). 관용구라 정밀하게 걷어낼 수
  // 있어서 BTS 전체를 해시태그 전용으로 묶는 것(정상 태깅을 대량으로 죽임)보다 낫다.
  // ⚠️ 'bts' 단독은 건드리지 않는다 — 그건 진짜 방탄소년단인 경우가 대부분이다. 'of'가 뒤따를 때만.
  if(/bts\s+of\b/i.test(t))t=t.replace(/\bbts(?=\s+of\b)/gi,' ');
  if(t.indexOf('하루')<0)return t;
  return t
    .replace(/(?<=[가-힣]의\s)하루(?![가-힣])/g,' ') // "○○의 하루" — 소유된 일반명사만 제거(소유자 토큰은 남김)
    .replace(/하루\s*종일/g,' ')
    .replace(/하루하루/g,' ');
}
function _atmMatchesMember(m,title,tokens,groupKo){
  const name=m.ko;
  if(!name)return false;
  const hashtagOnly=_isHashtagOnlyName(name)&&!_atmContextRelaxesHashtagOnly(name,title,groupKo);
  // 이니셜형 이름(B.I, J.R …)은 아래 한글 경계 규칙 `(?<![가-힣])B\.I(?![가-힣])`으로는 못 거른다 —
  // "B.I.G"의 다음 글자가 '.'이라 한글이 아니어서 그냥 통과한다. 실측(2026-08-31): 비아이지(B.I.G) 영상
  // 38건이 아이콘 B.I로 잡혀 group_ko까지 아이콘으로 오배정됐다(비아이지는 GROUPS 미등록).
  // 양옆에 점이나 영숫자가 안 붙을 때만 인정한다 — "B.I.G"는 탈락, "B.I X BOBBY"·"#B.I"는 통과.
  if(/^[A-Za-z](?:\.[A-Za-z])+\.?$/.test(name)){
    const seq=[...name.replace(/\./g,'')].map(_atmEscRe).join('[.\\s]*');
    return new RegExp(`(?<![a-z0-9.])${seq}(?![a-z0-9.])`,'i').test(title);
  }
  const nameChars=[...name];
  const multiChar=nameChars.length>1&&!hashtagOnly;
  const particles=['이','가','은','는','을','를','과','와','도','만','의','에','께','님','씨','아','야','랑','한테','에게'].map(_atmEscRe).join('|');
  // matchAliases(정식 표기가 영문인 멤버의 한글 로마자 별칭 — JAY B→제이비, 러블리즈 진→진 등): 이 함수는
  // "자체 채널(group 확정)"에서만 쓰이므로 별칭 평문 매칭이 안전. 다자 별칭은 단독/조사, 단일음절은 해시태그만.
  if(m.aliases&&m.aliases.length&&m.aliases.some(al=>{
    if(!al)return false;
    if([...al].length>1)return new RegExp(`(?<![가-힣])${_atmEscRe(al)}(?:${particles}){0,2}(?![가-힣])`).test(title)||new RegExp(`#${_atmEscRe(al)}(?![가-힣])`).test(title);
    return new RegExp(`#${_atmEscRe(al)}(?![가-힣])`).test(title);
  }))return true;
  if(multiChar){
    if(new RegExp(`(?<![가-힣])${_atmEscRe(name)}(?![가-힣])`).test(title))return true; // 이름 단독
    if(new RegExp(`(?<![가-힣])${_atmEscRe(name)}(?:${particles}){0,2}(?![가-힣])`).test(title))return true; // 이름+조사
    const surRe=new RegExp(`([가-힣])${_atmEscRe(name)}(?:${particles}){0,2}(?![가-힣])`,'g');
    const surExclude=_ATM_SURNAME_EXCLUDE[name];
    const surExcludeDyn=_ATM_DYNAMIC_SURNAME_EXCLUDE.get(name); // DB 이전분(2026-08-20)
    let sm;while((sm=surRe.exec(title))){if(_ATM_KOREAN_SURNAMES.has(sm[1])&&!(surExclude&&surExclude.has(sm[1]))&&!(surExcludeDyn&&surExcludeDyn.has(sm[1])))return true;} // 성+이름(+조사)
    const givenOnly=_atmStripSurname(nameChars);
    // 성 뗀 이름 변형이 '같은 그룹 멤버의 정식 등록명'과 같으면 이 경로에서도 쓰지 않는다. 예:
    // 장혜리→"혜리"가 같은 걸스데이 현 멤버 혜리(name.ko='혜리')와 같아, 혜리 영상마다 장혜리가
    // 딸려붙던 오태깅의 원인(2026-09-01 실측 388건). 평문·해시태그 둘 다 막는다 — '#혜리'도 현 혜리를
    // 가리킴. 그룹 한정인 이유는 _atmNameTakenByGroupmate 주석 참고(전역으로 걸었다가 188명 오차단).
    if(givenOnly&&givenOnly.length>=2&&!_atmNameTakenByGroupmate(givenOnly,groupKo)){
      if(new RegExp(`(?<![가-힣])${_atmEscRe(givenOnly)}(?:${particles}){0,2}(?![가-힣])`).test(title))return true; // 등록명이 성+이름인데 제목엔 이름만
      if(new RegExp(`#${_atmEscRe(givenOnly)}(?![가-힣])`).test(title))return true; // #이름(성 뺀 버전)
    }
  }
  if(new RegExp(`#${_atmEscRe(name)}(?![가-힣])`).test(title))return true; // #이름(단일음절/흔한 이름도 해시태그는 허용)
  if(m.en){
    const parts=m.en.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if(hashtagOnly){
      // 흔한 단어/영어 축약형과 겹치는 이름은 평문 토큰 매칭을 아예 안 하고 영문 해시태그(#IM 등, 점/공백
      // 다 뗀 압축형)만 인정 — "I'm"이 "I.M"으로 잘못 잡히는 사고 재발 방지.
      const compact=parts.join('');
      return compact?new RegExp(`#${_atmEscRe(compact)}(?![가-힣a-z0-9])`,'i').test(title):false;
    }
    if(parts.length===1){
      if(tokens.includes(parts[0]))return true;
      // 성+이름 사이 띄어쓰기 대응 (예: "seong hyeon" → "seonghyeon")
      for(let i=0;i<tokens.length;i++){
        let joined=tokens[i];
        for(let j=i+1;j<tokens.length&&joined.length<parts[0].length;j++)joined+=tokens[j];
        if(joined===parts[0])return true;
      }
    }
    if(parts.length>1){
      // 이니셜형 영문명(B.I, J.R …)은 토큰 대조를 쓰면 안 된다 — _atmTokenize가 "B.I.G"를 b/i/g로 쪼개서
      // ['b','i']가 앞 두 토큰과 그대로 맞아떨어진다. 실측(2026-08-31): 비아이지(B.I.G) 영상 38건이
      // 아이콘 B.I로 잡혀 group_ko까지 아이콘으로 오배정됐다(비아이지는 GROUPS 미등록이라 막을 그룹명도 없음).
      // 원문에서 **양옆에 점이나 영숫자가 안 붙을 때만** 인정한다 — "B.I.G"는 뒤에 점이 붙어 탈락하고,
      // "B.I X BOBBY"처럼 공백으로 떨어진 정상 표기는 그대로 통과한다(토큰 방식으로는 이 둘을 못 가른다).
      if(parts.every(p=>p.length===1)){
        const seq=parts.map(_atmEscRe).join('[.\\s]*');
        return new RegExp(`(?<![a-z0-9.])${seq}(?![a-z0-9.])`,'i').test(title);
      }
      for(let i=0;i<=tokens.length-parts.length;i++){if(parts.every((p,j)=>tokens[i+j]===p))return true;}
      // 영문명도 한글과 같은 이유로 "성" 파트(보통 첫 단어)를 뺀 나머지만 제목에 있어도 잡히게 함
      const rest=parts.slice(1);
      // ⚠️ 위 한글 givenOnly 가드와 **같은 규칙의 영문판**. 장혜리(en:'Jang Hyeri')의 성 뗀 "hyeri"가
      // 같은 그룹 혜리(en:'Hyeri')와 겹쳐, 설명란 해시태그 "#HYERI"/"#hyeri"로 장혜리가 딸려붙었다.
      // 2026-09-01 수정이 한글("#혜리")만 막고 이 영문 경로는 빠뜨려서 오태깅 292건이 그대로 남아
      // 있었다(2026-09-02 실측·재현). 토큰 비교라 대소문자는 이미 무시됨 — "#HYERI"도 같은 구멍.
      const restKey=rest.join(' ');
      if(!_atmNameTakenByGroupmate(restKey,groupKo,true)){
        if(rest.length===1){
          if(tokens.includes(rest[0]))return true;
        }else if(rest.length>1){
          for(let i=0;i<=tokens.length-rest.length;i++){if(rest.every((p,j)=>tokens[i+j]===p))return true;}
        }
      }
    }
  }
  return false;
}
// 그룹 전체 로스터가 한꺼번에 매칭되는 경우를 채널 "시그니처 블록"(예: 리센느처럼 매 영상 설명란 끝에
// 현재 멤버 전원 해시태그를 고정으로 붙이는 관행)으로 의심하고 제목 매칭 결과를 우선시하는 공용 헬퍼.
// 실제로는 리브 한 명만 나오는 솔로 영상("리브다아ㅏ")인데도 설명란의 전원 해시태그 때문에 members에
// 5명이 다 태깅돼 미나미 연결 카드에까지 리브 단독 영상이 섞여 나오던 오염 사고로 발견됨(2026-08-03).
// 신규 태깅(_ytAutoTagMembers)과 재검증(_ytSweepMembersMistag) 양쪽이 이 헬퍼를 공유해야, 재검증
// 버튼을 눌렀을 때 이미 오염된 기존 행도 같은 기준으로 걷어낼 수 있다.
// 설명란에서 "출연 근거가 아닌 언급"을 걷어낸다(2026-08-31, 사용자 발견 — "그룹 전체 무대인데 위너는
// 송민호만 체크돼 있다"). 실측: 위너 표본 40건 중 30건이 제목엔 근거가 없고 설명란에서만 매칭됐는데,
// 걸린 문자열이 전부 출연이 아니라 **크레딧·목록·링크**였다.
//   앨범 트랙리스트   ・FIANCE (MINO) ・CALL ANYTIME feat.MINO (JINU)
//   멀티앵글 목록     [MULTI ANGLE] ・EVERYDAY_YOON / JINU / HOONY / MINO
//   관련 영상 링크    WINNER's 걔 세(I'm him) MINO SOLO M/V @ http://…
// 네 명이 다 적힌 목록인데 한 명만 붙는 이유는, MINO만 등록 영문명이고 YOON·JINU·HOONY는 별명이라
// 로스터에 없기 때문이다 — 그래서 그룹 단체 영상이 특정 멤버 단독처럼 보인다.
// ⚠️ 이름 목록이 아니라 **포맷 마커**로 자른다(줄 단위). 새 사례에 일반화되고, 설명란 끝의 출연자
//    해시태그 나열(#세림 #앨런 …)은 마커가 없어 그대로 살아남는다 — 그건 진짜 출연 근거다.
const _ATM_DESC_NOISE_LINE=/https?:\/\/|^\s*[・･·]|MULTI[ _-]?ANGLE|\bfeat\.|\bft\.|\bProd\.|作詞|作曲|編曲|\bLyrics?\s*by\b|\bCompos(?:ed|er)\b|\bArranged?\b|작사|작곡|편곡|Track\s*list|트랙\s*리스트|^\s*\d{1,2}[.\x29]\s/i; // ⚠️ 닫는 괄호는 반드시 \x29로 쓸 것 — 리터럴로 두면 m2_harness가 괄호 깊이를 세다 슬라이스가 깨진다(2026-08-31 실제로 겪음)
function _atmStripDescNoise(description){
  if(!description)return description;
  return String(description).split('\n').filter(l=>!_ATM_DESC_NOISE_LINE.test(l)).join('\n');
}
function _atmResolveMembers(title,description,roster,groupKo,publishedAt){
  // publishedAt(영상 발행일, "YYYY-MM-DD")이 주어지면 그 시점에 이미 탈퇴한 멤버는 매칭 후보에서 제외
  // (_memberLeftCutoffDate 참고) — 그룹은 활동 중이어도 탈퇴 멤버는 그 이후 영상에 안 나오는 게 정상.
  const roster2=publishedAt?roster.filter(m=>{const c=_memberLeftCutoffDate(m);return !c||publishedAt<=c;}):roster;
  const rawT=title||'';
  const t=_atmStripCommonNounCtx(rawT); // "○○의 하루" 등 일반명사 문맥의 "하루" 제거 후 매칭
  const hitTitle=roster2.filter(m=>_atmMatchesMember(m,t,_atmTokenize(t),groupKo)).map(m=>m.ko);
  const desc=_atmStripDescNoise(description); // 트랙리스트·크레딧·링크 줄은 출연 근거가 아니다
  const searchText=_atmStripCommonNounCtx(desc?`${rawT}\n${desc}`:rawT);
  const hitFull=roster2.filter(m=>_atmMatchesMember(m,searchText,_atmTokenize(searchText),groupKo)).map(m=>m.ko);
  if(roster2.length>0&&hitFull.length===roster2.length&&hitTitle.length<roster2.length)return hitTitle;
  return hitFull;
}
async function _ytAutoTagMembers(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-yt-autotag');
  if(btn)btn.disabled=true;
  try{
    const groupKos=Object.keys(GROUPS);
    let grandMatched=0,grandChecked=0;
    let completed=0;
    const CONC=6; // 동시 처리 그룹 수 — 순차 268회 왕복을 병렬화해 시간 단축(결과 동일, egress 총량 불변, 2026-08-23)
    const processGroup=async(gko)=>{
      // a.group.ko(주 소속)만 보면 유연정(주 소속 아이오아이, 겸임 우주소녀)처럼 이중소속 멤버가 겸임 그룹
      // 채널에서는 영원히 로스터에 안 잡혀 자동 태깅 대상에서 빠짐 — 겸임 소속까지 보는 _artistGroups로 판정
      // (2026-07-31, 우주소녀 채널의 유연정 단독 영상이 계속 미태깅으로 남던 문제의 원인).
      const members=_atmRosterFor(gko);
      if(!members.length){completed++;return;}
      // 같은 그룹 멤버(members)가 비어있거나, 콜라보(with_members/with_groups)가 아직 하나도 안 잡힌
      // 행을 대상으로 삼는다 — 자체 채널 챌린지 영상처럼 제목에 "챌린지" 같은 표시 없이 바로 다른 그룹
      // 멤버 이름만 나오는 경우도 있고, 로스터가 그때그때 늘어나서 예전엔 매칭 안 되던 이름이 이제는
      // 잡힐 수 있으므로, 이미 콜라보가 채워진 행이 아니면 계속 재검사 대상이 된다.
      // 4개 조건을 .or() 한 번에 다 넣어야 OR로 묶임 — .or()를 여러 번 체이닝하면 AND로 묶여서
      // "members도 비고 AND with_members도 빈" 행만 걸리는 버그가 났던 적이 있었음(같은 실수 재발 방지).
      const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,members,with_members,with_groups,published_at')
        .eq('group_ko',gko)
        .eq('tags_manual',false) // 관리자가 태그 모달에서 직접 저장한 행은 자동 태깅이 절대 건드리지 않음
        .or('members.eq.{},members.is.null,with_members.eq.{},with_members.is.null')
        .order('id'));
      if(error){console.error(`[자동 태깅] ${gko} 조회 실패:`,error.message);completed++;return;}
      if(!rows?.length){completed++;return;}
      // description(설명란)은 members가 아직 빈 행에만 필요(콜라보 감지는 아래 _m2ParseTitle이 제목만
      // 씀) — 위 select에서 아예 안 받아오고, 실제로 필요한 행 id만 추려서 별도로 가볍게 다시 받는다.
      // 이 버튼은 "매일" 루틴이라 매번 그룹 전체를 훑는데, with_members만 비어있고 members는 이미 채워진
      // 행까지 description을 통째로 받아오면 그 텍스트가 그냥 버려져서 egress 낭비였음(2026-08-06, 사용자
      // 제보 — Supabase 무료 티어 egress 한도 초과, 관리자 스윕 쿼리들이 유력 원인으로 지목됨).
      const needDescIds=rows.filter(v=>!v.members?.length).map(v=>v.id);
      const descByIdText=new Map();
      for(let i=0;i<needDescIds.length;i+=500){
        const{data:descRows,error:descErr}=await sb.from(_YT_TABLE).select('id,description').in('id',needDescIds.slice(i,i+500));
        if(descErr){console.error(`[자동 태깅] ${gko} description 조회 실패:`,descErr.message);continue;}
        (descRows||[]).forEach(r=>descByIdText.set(r.id,r.description));
      }
      const updates=[];
      rows.forEach(v=>{
        const title=v.title||'';
        const patch={};
        if(!v.members?.length){
          // 자체 채널 멤버 매칭은 제목뿐 아니라 설명란(description)도 같이 훑는다 — 제목엔 이름이 없어도
          // 설명란 끝의 해시태그 나열(#세림 #앨런 ...)로 출연자를 밝히는 경우가 많음(2026-07-31 추가).
          // 콜라보(다른 그룹) 추론은 설명란까지 넓히면 소개문구/SNS 링크 등 관련 없는 텍스트가 섞여
          // 오탐 위험이 커서 의도적으로 제목만 그대로 쓴다 — 아래 _m2ParseTitle(title,gko) 참고.
          // 단, 설명란까지 포함했을 때 로스터 전원이 매칭되는데 제목만으로는 전원이 안 잡히면 채널
          // 시그니처 블록일 가능성이 높다고 보고 제목 매칭만 신뢰함 — _atmResolveMembers 참고.
          const hit=_atmResolveMembers(title,descByIdText.get(v.id),members,gko,v.published_at);
          if(hit.length)patch.members=[...new Set(hit)];
        }
        // 콜라보(다른 그룹 멤버 언급) 감지 — 외부채널 태깅에 이미 쓰던 _m2ParseTitle을 그대로 재사용.
        // group_ko는 절대 안 건드림(자체 채널 영상의 소속은 항상 그 채널 그룹으로 고정) — 매칭된 그룹 중
        // 지금 채널(gko) 자신은 제외하고 "다른" 그룹만 with_groups/with_members로 채운다.
        if(!v.with_members?.length&&!v.with_groups?.length){
          const match=_m2ParseTitle(title,gko,undefined,v.published_at);
          if(match){
            const otherGkos=[match.primaryGroup,...match.withGroups].filter(og=>og&&og!==gko);
            let withGroups=[],withMembers=[];
            otherGkos.forEach(og=>{
              const sec=match.membersByGroup[og]||[];
              const{asGroup,extraMembers}=_classifyGuestGroup(sec,og);
              if(asGroup)withGroups.push(og);
              extraMembers.forEach(mko=>withMembers.push(`${mko}(${og})`));
            });
            ({withGroups,withMembers}=_normalizeMemberTags({title,groupKo:gko,members:patch.members||v.members,withGroups,withMembers})); // 겸임 중복 제거
            if(withMembers.length)patch.with_members=withMembers;
            if(withGroups.length)patch.with_groups=withGroups;
          }
        }
        if(Object.keys(patch).length)updates.push({id:v.id,patch});
      });
      grandChecked+=rows.length;
      if(updates.length){
        // update()는 지정한 컬럼만 바꾸므로 upsert와 달리 다른 NOT NULL 컬럼 값을 건드릴 위험이 없음 —
        // 청크 안에서 순차 await 대신 병렬로 날려 왕복 대기 시간만 줄인다.
        const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),{conc:20,retries:2});
        if(_ub.failed)console.error(`[자동 태깅] ${gko} 재시도 후에도 실패 ${_ub.failed}건 — ${_ub.firstErr}`);
        grandMatched+=updates.length;
      }
      completed++;
      _ytSetProg(`[${completed}/${groupKos.length}] ${gko}: ${updates.length}/${rows.length}개 매칭 (누적 ${grandMatched}개)`);
    };
    let _qi=0;
    const _worker=async()=>{while(_qi<groupKos.length){await processGroup(groupKos[_qi++]);}};
    await Promise.all(Array.from({length:Math.min(CONC,groupKos.length)},()=>_worker()));
    _ytSetProg(`완료! 미태깅 ${grandChecked}개 중 ${grandMatched}개 새로 태깅됨 (동시 ${CONC})`);
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}
// 위 _ytAutoTagMembers는 members/with_members/with_groups가 "전부 비어있는" 행만 대상으로 삼아서,
// 이미 뭔가 하나라도 태깅된 행은 그 뒤로 로스터가 늘거나 매칭 로직이 개선돼도(하시태그 화이트리스트
// 추가, group_ko 버그 수정 등) 다시는 재검사되지 않는다. 이 버튼은 그룹당 전체 행(태깅 여부 무관)을
// 다시 훑어서 "지금 매칭 로직이 새로 찾아내는 것"을 기존 값에 합쳐(추가만 함, 기존 값은 절대 안 지움)
// 반영한다. tags_manual=true(관리자가 직접 저장한 행)는 쿼리 단계에서부터 제외돼서 절대 건드리지 않음
// (2026-08-04, 사용자가 가장 중요하게 강조한 조건). "일회용"이 아니라 콜라보/자체 멤버 재검증 버튼과
// 같은 계열의 범용 도구 — _m2ParseTitle 매칭 로직을 고칠 때마다(화이트리스트 추가, 버그 수정 등) 다시
// 눌러야 그 개선이 기존 태깅분에도 소급 반영됨(2026-08-06, 라벨이 "일회용"으로 잘못 붙어있던 걸 사용자
// 제보로 바로잡음 — 버튼 표기도 다른 재검증 버튼들과 동일한 "(전체)" 톤으로 통일).
async function _ytRetagAllIncludingTagged(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  // (전체) 버튼 규칙(설정패널 개선 4): 확인 + 스냅샷 되돌리기. additive union이라 파괴적이진 않지만
  // 전 그룹을 훑어 대량 기록하므로 다른 (전체) 버튼과 같은 안전장치를 건다.
  let _ok=true;
  if(typeof _confirmDialog==='function')_ok=await _confirmDialog({title:'멤버+콜라보 재태깅 (전체)',msg:'기존 태깅분까지 전 그룹을 다시 훑어 멤버/콜라보 태그를 보강해요.<br>그룹은 안 건드리고 수동 편집분은 제외하며, 되돌리기 스냅샷을 떠둬요. 수십 분 걸릴 수 있어요.',okLabel:'재태깅 실행',wide:true});
  if(!_ok)return;
  const btn=document.getElementById('sp-yt-retag-all');
  if(btn)btn.disabled=true;
  const _snapBatch=(self.crypto&&self.crypto.randomUUID)?self.crypto.randomUUID():('b'+Date.now());
  try{
    const groupKos=Object.keys(GROUPS);
    let grandMatched=0,grandChecked=0;
    for(let gi=0;gi<groupKos.length;gi++){
      if(_admAbort){_ytSetProg(`중단됨 — ${gi}/${groupKos.length}그룹까지 처리(누적 ${grandMatched}개, 되돌리기 가능)`);break;}
      const gko=groupKos[gi];
      const members=_atmRosterFor(gko);
      if(!members.length)continue;
      _ytSetProg(`[${gi+1}/${groupKos.length}] ${gko}: 전체 영상 조회 중…`);
      // 미태깅분 버튼과 달리 members/with_members 상태로 거르지 않고 이 그룹 전체를 다 훑는다 —
      // tags_manual=false만 지켜지면 됨(관리자가 손댄 행은 여기서부터 절대 후보에 안 들어감).
      const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,description,members,with_members,with_groups,published_at')
        .eq('group_ko',gko)
        .eq('tags_manual',false)
        .order('id'));
      if(error){console.error(`[재태깅] ${gko} 조회 실패:`,error.message);continue;}
      if(!rows?.length)continue;
      const updates=[];
      rows.forEach(v=>{
        const title=v.title||'';
        const patch={};
        // 자체 멤버: 새로 잡힌 이름을 기존 members에 합집합으로 더함(빼는 건 절대 안 함 — 삭제는
        // 별도 재검증 버튼의 몫).
        const curMembers=v.members||[];
        const hit=_atmResolveMembers(title,v.description,members,gko,v.published_at);
        const unionMembers=[...new Set([...curMembers,...hit])];
        if(unionMembers.length!==curMembers.length)patch.members=unionMembers;
        // 콜라보: 새로 특정 멤버까지 잡히면 "그룹 전체" 표시(with_groups)를 그 멤버 표기(with_members)로
        // 승격시키고, 여전히 그룹 단위로만 잡히면(그리고 이미 그 그룹 특정 멤버가 있는 게 아니면) 추가.
        const match=_m2ParseTitle(title,gko,undefined,v.published_at);
        if(match){
          const otherGkos=[match.primaryGroup,...match.withGroups].filter(og=>og&&og!==gko);
          let curWithMembers=[...(v.with_members||[])];
          let curWithGroups=[...(v.with_groups||[])];
          let changed=false;
          otherGkos.forEach(og=>{
            const sec=match.membersByGroup[og]||[];
            if(sec.length){
              sec.forEach(mko=>{
                const tag=`${mko}(${og})`;
                if(!curWithMembers.includes(tag)){curWithMembers.push(tag);changed=true;}
              });
              if(curWithGroups.includes(og)){curWithGroups=curWithGroups.filter(g=>g!==og);changed=true;}
            }else if(!curWithGroups.includes(og)&&!curWithMembers.some(s=>s.endsWith(`(${og})`))){
              curWithGroups.push(og);changed=true;
            }
          });
          if(changed){patch.with_members=curWithMembers;patch.with_groups=curWithGroups;}
        }
        if(Object.keys(patch).length)updates.push({id:v.id,patch});
      });
      grandChecked+=rows.length;
      if(updates.length){
        await _snapshotBeforeBulk('멤버+콜라보 재태깅(전체)',updates.map(u=>u.id),_snapBatch); // 되돌리기용(전 그룹 한 배치)
        const _ub=await _sbUpdateBatch(updates,u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id),{conc:20,retries:2});
        if(_ub.failed)console.error(`[재태깅] ${gko} 재시도 후에도 실패 ${_ub.failed}건 — ${_ub.firstErr}`);
        grandMatched+=updates.length;
      }
      _ytSetProg(`[${gi+1}/${groupKos.length}] ${gko}: ${updates.length}/${rows.length}개 보강 (누적 ${grandMatched}개)`);
    }
    _ytSetProg(`완료! 전체 ${grandChecked}개 중 ${grandMatched}개에 새 태그 추가됨(수동 편집분은 전부 제외)`);
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// ── 외부 채널 동기화 (M2·음방·직캠) ──
// tier: 'music'(공식/음악방송·직캠 — 무대·라이브 콘텐츠라 그룹명이 제목에 없어도 멤버 이름만으로
// 그룹을 역추론해도 안전) vs 'variety'/'magazine'(예능·잡지 — 매 영상이 그때그때 다른 셀럽을 다루는
// 채널이라 멤버 이름이 흔한 단어와 우연히 겹치면 위험. 그룹명/팬덤명이 제목에 literal로 없으면 멤버
// 이름 평문 매칭만으론 그룹을 확정하지 않고, 해시태그 매칭만 인정 — 드림노트 "보니"/"미소"가 "알고
// 보니"/변인 미소 같은 무관한 예능·뉴스 클립에 대량으로 얹히던 사고의 재발 방지, 2026-08-06 사용자 요청)
// vs 'idol'(채널 자체가 특정 아이돌 1인 MC/주체 전용 — 이영지 "지금 차린 건 쥐뿔도 없지만"처럼. owner
// 필드로 그 인물을 고정해두면, 제목 매칭과 무관하게 채널의 모든 영상을 그 인물 소유로 수집한다. 게스트
// 언급은 여전히 제목에서 찾되(strict 적용), 워크맨·디글처럼 특정 1인 소유가 아닌 로테이션/종합 예능
// 채널은 owner를 안 주고 그냥 variety로 둔다, 2026-08-11 사용자 요청).
// 아래 "신규 추가" 구간 중 성격이 불확실한 채널(재친구/findyourKODE/thekstarnextdoor/들어봐! 유리의 숲)은
// 안전하게 variety로 기본 처리함 — 실제로 공식/음악 성격이면 music으로 바꿔도 됨.
// 예전엔 이 배열이 하드코딩이라 채널 추가/삭제/유형 변경마다 코드 수정+재배포가 필요했음 — DB 테이블
// (ext_channels)로 옮겨서 어드민 패널(영상 관리 > 동기화 채널 > 그외)에서 직접 추가/삭제/유형 수정
// 가능하게 함(2026-08-12, 사용자 요청). SQL: ext_channels_migration.sql(기존 33개 채널 시드 포함).
let _EXT_CHANNELS=[];
let _extChannelsLoaded=false;
async function _loadExtChannels(){
  if(!sb)return;
  try{
    // ⚠️ select('*') 인 이유: 컬럼을 명시하면 마이그레이션이 아직 안 돌아간 환경에서 PostgREST가
    // 400(column does not exist)을 뱉고, 이 함수는 error면 그냥 return이라 _EXT_CHANNELS가 통째로 비어
    // **외부채널 동기화가 전면 중단**된다(2026-08-25 스모크에서 실제로 잡힘). 작은 테이블이라 * 로 받아도
    // 부담이 없고, 새 컬럼이 없으면 아래 매핑에서 undefined→기본값으로 자연히 폴백된다.
    // ⚠️ 전량 조회 — _sbSelectAll 필수(PostgREST 1,000행 제한). 잘리면 그만큼의 채널이 동기화에서 빠진다.
    const{data,error}=await _sbSelectAll(()=>sb.from('ext_channels').select('*').order('name').order('handle'));
    if(error){console.error('ext_channels 로드 실패',error.message);return;}
    // 팬(fans) 채널은 owner_mko 없이 owner_gko만 있음(그룹 전체가 대상, 특정 멤버 아님) — owner_mko
    // 유무가 아니라 둘 중 하나라도 있으면 owner 객체를 만든다(2026-08-21).
    _EXT_CHANNELS=(data||[]).map(r=>({handle:r.handle,url:r.url,name:r.name,tier:r.tier,defaultCategory:r.default_category||'',isPrimary:!!r.is_primary,...((r.owner_mko||r.owner_gko)?{owner:{mko:r.owner_mko||null,gko:r.owner_gko||null}}:{})}));
    _extChannelsLoaded=true;
    const backfillSel=document.getElementById('sp-yt-backfill-ch');
    if(backfillSel)backfillSel.innerHTML=_EXT_CHANNELS.map(c=>`<option value="${c.handle}">${c.name}</option>`).join('');
  }catch(e){console.error('ext_channels 로드 실패',e);}
}
_loadExtChannels();
const _EXT_STRICT_TIERS=new Set(['variety','magazine','idol','show','fans']); // idol/show/fans tier도 게스트 감지는 strict(해시태그만 인정)

// _PROJECT_UNITS는 kpop_universe.html(main)로 이동함(2026-08-12) — 그쪽의 _unitTagsFor/_onUnitTagClick도
// 이 상수를 쓰는데 admin.js에만 남아있어서 일반 유저 검색(doSearch)이 통째로 죽는 사고가 있었음. admin.js는
// main 실행 이후 로드되는 일반 스크립트라 같은 전역 스코프의 const를 그대로 볼 수 있어 여기서 지워도 안전함.
// 유닛 태그 클릭 핸들러 — 그룹 카드/행성을 새로 만들지 않는 대신, 멤버 카드 안의 영상 그리드를
// "같은 유닛의 다른 멤버가 같이 나온 영상만"으로 필터링해서 유닛 관련 콘텐츠를 모아 보여준다.
// 같은 유닛 태그를 다시 누르면 해제(토글), 태연처럼 유닛이 2개(갓더비트/태티서)면 서로 배타적으로 전환.
// 멤버 카드 그룹 태그(#tg) 옆에 소속 프로젝트 유닛명을 텍스트로만 병기하기 위한 조회 — 유닛을 별도
// 행성/그룹으로 승격하지 않고 표기만 하기로 확정한 방향(V8 요청 때 사용자가 결정, 나머지 유닛도 동일 적용).
// 유닛 태그 클릭 시 영상 그리드 필터링에 쓸 "나머지 유닛 멤버" 목록 — 같은 채널(그룹) 소속인지 여부에 따라
// members(same)/with_members(cross, "이름(그룹)" 포맷) 중 어느 컬럼에서 찾아야 하는지가 갈리므로 나눠서 반환.
// 제목에 프로젝트 유닛명(한글/영문 표기 아무거나)이 있으면 그중 지금 채널(ko)에 속하는 멤버만 추려서
// 반환 — 태그 모달에서 체크박스 기본값을 정할 때(_openVidTagModal), _m2ParseTitle과 별개로 자체 채널
// 영상에도 같은 유닛 인식을 적용하기 위한 경량 버전(그룹/멤버 역추론 등 나머지 로직은 필요 없음).
// 로테이션 유닛(NCT U)에서 "이 멤버가 제목에 따로 언급됐는가" 판정.
// ⚠️ 한글 활동명만 보면 안 된다 — NCT 계열은 영문 표기/해시태그(#JISUNG, TAEYONG)가 압도적이라
// 한글만 보면 영문 제목 영상에서 아무도 못 잡는다(2026-08-25 단위테스트에서 발견).
// 짧은 영문명(TEN·KUN 등)은 흔한 단어·숫자와 겹치므로 해시태그로만 인정 — _atmNameNeedsCtx와 같은
// 원칙이지만 그 함수는 _m2ParseTitle 스코프 안이라 여기선 길이 기준으로 대체한다.
function _unitMemberNamedInTitle(mko,gko,hit,hitHashtag){
  if(hit(mko)||hitHashtag(mko))return true;
  const a=ARTISTS.find(x=>x.name.ko===mko&&_artistGroups(x).some(g=>g.ko===gko));
  const en=a&&a.name&&a.name.en;
  if(!en)return false;
  if(hitHashtag(en))return true;
  return en.replace(/[^A-Za-z0-9]/g,'').length>=5&&hit(en);
}
function _unitMembersFromTitle(title,ko){
  const norm=' '+(title||'').toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';
  // name도 title과 같은 규칙으로 정규화해야 함 — 안 그러면 "K.R.Y."/"D&E"처럼 특수문자가 낀 유닛명은
  // norm에서 이미 공백으로 치환된 자리를 찾지 못해 절대 안 걸림(_m2ParseTitle의 hit()과 동일하게 맞춤).
  // trim 필수 — "K.R.Y."처럼 끝이 특수문자인 이름은 정규화 후 끝에 공백이 남아서(마침표→공백) trim 없이
  // 앞뒤에 공백을 덧붙이면 이중 공백이 되어 norm과 절대 안 맞음(실측으로 발견, 2026-08-05).
  const hit=name=>{
    const n=name.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
    return norm.includes(' '+n+' ');
  };
  // _UNIT_HASHTAG_ONLY_TOKENS(index.html, "AAA"/"EVOLution" 등 흔한단어 유닛 트리거)는 여기서도 똑같이
  // 해시태그로만 인정해야 함 — 안 그러면 이 함수(자체 채널 경로)로는 여전히 평문 매칭으로 새서 반쪽만
  // 고쳐짐(2026-08-21).
  const hitHashtag=name=>new RegExp(`#${_atmEscRe(name)}(?![가-힣a-zA-Z0-9])`,'i').test(title||'');
  const result=new Set();
  Object.values(_PROJECT_UNITS).forEach(unit=>{
    if(!unit.names.some(t=>_UNIT_HASHTAG_ONLY_TOKENS.has(t)?hitHashtag(t):hit(t)))return;
    // 로테이션 유닛(NCT U 등, shared.js 주석 참고)은 members가 "참여한 적 있는 사람 명단"이라
    // 전원 확장하면 안 됨 — 제목에 이름이 따로 언급된 멤버만 인정한다.
    if(unit.rotating){
      unit.members.forEach(({mko,gko})=>{if(gko===ko&&_unitMemberNamedInTitle(mko,gko,hit,hitHashtag))result.add(mko);});
      return;
    }
    unit.members.forEach(({mko,gko})=>{if(gko===ko)result.add(mko);});
  });
  return result;
}
// 이름 매칭에 쓸 후보 목록(한글/영문 + 성 뗀 버전) — 김소혜처럼 등록명이 "성+이름"인데 직캠 제목엔
// 성 없이 "소혜"로만 나오는 경우가 매우 흔함(특히 자체 채널이 없어 전량 외부채널 파싱에만 의존하는
// 아이오아이 같은 해체/프로젝트 그룹). _ytAutoTagMembers(자체 채널용)의 _atmStripSurname은 이미
// 이 처리를 하고 있었는데, 외부채널 파싱(_m2ParseTitle)엔 빠져있어서 "성 없이 쓰인 이름"이 전부
// 그룹 매칭 실패로 이어져 영상 자체가 skip(저장 안 됨)되는 문제가 있었음 — 여기도 동일하게 적용.
// 크래비티 "형준"(실제 활동명)과 SS501 "김형준"(성 뗀 변형이 "형준")이 겹쳐서, 크래비티 자체 채널의
// "형준" 언급 영상마다 SS501 김형준이 함께 출연한 것처럼 잘못 태깅되는 사고가 있었음(2026-07-30, 50개
// 행 오염). 성을 뗀 변형이 다른 아티스트의 실제 활동명과 완전히 겹치면, 그 모호한 변형은 매칭에 쓰지
// 않는다 — "형준"이라는 단어는 실제로 그 이름을 쓰는 크래비티 멤버로만 해석되어야 하고, 성이 있는
// 이름(김형준)을 줄인 변형이 그 자리를 가로채면 안 됨. ARTISTS는 로드 후 안 바뀌므로 아티스트당 한
// 번만 계산해 캐시.
const _m2VariantsCache=new WeakMap();
function _m2NameVariants(a){
  if(_m2VariantsCache.has(a))return _m2VariantsCache.get(a);
  const variants=[a.name.ko,a.name.en].filter(Boolean);
  const stripped=_atmStripSurname([...a.name.ko]);
  if(stripped&&stripped.length>=2&&!ARTISTS.some(o=>o!==a&&o.name.ko===stripped))variants.push(stripped);
  _m2VariantsCache.set(a,variants);
  return variants;
}
// 제목에서 그룹/멤버 매칭. 토큰 경계 기준으로 GROUPS/ARTISTS 데이터와 대조.
// 그룹명이 실제로는 다른 유명한 곡/개념과 완전히 겹쳐서 오매칭 위험이 큰 경우 — 발견될 때마다 여기 추가.
// 슈퍼노바(초신성, 2007년 데뷔 1세대 보이그룹)의 영문명 "Supernova"가 아이브×David Guetta의 2024년 곡
// "Supernova Love"와 글자 그대로 겹쳐서, 그 곡을 커버·챌린지한 다른 그룹들(아이브·베리베리·빌리·에스파·
// 세븐틴·리센느 등) 영상이 실제로 대량 오매칭되는 걸 실측으로 확인(2026-07-31, IVE 자체 채널·타 채널
// 챌린지 영상 다수). 처음엔 에스파 곡으로 오해해 aespa/에스파만 걸러뒀었는데 진짜 원곡은 아이브 쪽이었음.
// 그룹 키가 2026-08-10에 "슈퍼노바(초신성)"→"슈퍼노바"로 바뀜(괄호 있는 그룹명이 "이름(그룹)" 태그
// 문자열 파싱을 깨는 별도 문제 때문 — 초신성은 altNames로 이동, 검색은 그쪽에서 여전히 걸림).
const _GROUP_TITLE_CONFLICT_EXCLUDE={
  '슈퍼노바':[/aespa/i,/에스파/,/david\s*guetta/i,/데이비드\s*게타/,/supernova\s*love/i,/아이브|\bIVE\b/i],
  // 2PM·2AM: 라디오/방송 시간표기(2PM-4PM, 2AM~4AM 등)가 그룹명으로 오매칭됨(2026-08-23 Fable/사용자
  // 제보 — "⏰ RYO : 2PM-4PM"이 그룹 2PM으로, "원곡: 2PM" 오태깅까지). 숫자+AM/PM이 "다른 시각과 대시/
  // 물결로 이어진 범위"일 때만 제외 → 진짜 곡 "2PM - My House"(대시 뒤 두 번째 시각 없음)는 안전.
  '2PM':[/\d\s*[AP]M\s*[-~–]\s*\d\s*[AP]M/i],
  '2AM':[/\d\s*[AP]M\s*[-~–]\s*\d\s*[AP]M/i],
  // 스텔라(Stellar) ↔ 하츠투하츠 멤버 '스텔라': 제목에 하츠투하츠가 있으면 '스텔라'는 그룹 스텔라가
  // 아니라 그 멤버다 → 그룹 스텔라 매칭 제외(멤버는 하츠투하츠 로스터에서 정상 추출). strictSync 해제와 세트.
  '스텔라':[/하츠투하츠|hearts\s*2\s*hearts|\bH2H\b/i],
};
// 위 정규식 목록으로도 다 못 거르는 경우(제목이 그냥 "Supernova"+다른 그룹 해시태그만 있고 곡명/원곡
// 아티스트 언급이 없는 챌린지 영상들)를 위한 2차 방어선 — 이 그룹이 "다른 실존 그룹과 같이" 매칭됐으면
// (니치한 2007년 데뷔 그룹이 최근 데뷔한 그룹과 실제로 콜라보할 가능성은 사실상 없으므로) 무조건 버린다.
// 제목에 이 그룹 하나만 단독으로 매칭됐을 때는(자기 채널 영상 등) 그대로 인정한다.
const _GROUP_AMBIGUOUS_IF_COMATCHED=new Set(['슈퍼노바']);
// strict=true(예능/잡지 채널 백필·동기화에서 씀): 제목에 그룹명/영문명 literal 매칭이 하나도 없는데
// 멤버 이름 평문 매칭만으로 그룹을 역추론하는 아래 폴백은 완전히 꺼버리고, 해시태그 매칭만 그 근거로
// 인정한다. 음악방송/공식 채널(strict 기본값 false)은 무대·직캠 콘텐츠라 그룹명 없이 멤버명만 있어도
// 실제로 그 멤버 얘기일 확률이 높지만, 예능/잡지는 매 영상이 그때그때 다른 셀럽을 다뤄서 멤버 이름이
// 흔한 단어·동명이인과 우연히 겹치면 곧바로 오매칭됨(드림노트 "보니"가 "알고 보니"에 걸리던 사고,
// 2026-08-06). _ATM_HASHTAG_ONLY_NAMES는 "이미 발견된" 흔한 이름만 보호하는데, strict는 아직 발견되지
// 않은 새 흔한 이름/동명이인까지 채널 성격만으로 선제 차단한다.
// 탈퇴 게이트(2026-08-25, 사용자 요청 — "탈퇴 멤버 영상이 그룹 카드에 계속 뜬다").
// 어떤 멤버가 그룹 G를 떠난 뒤에 올라온 영상은, 제목에 그 사람 이름이 있어도 G의 콘텐츠가 아니다.
// 실제 사례: 라이즈 승한(2024.10.13 탈퇴)의 솔로 프로젝트 "승한앤소울" 직캠이 라이즈로 잡힘.
//   ⚠️ 이건 "제목만으론 절대 구분할 수 없는" 종류의 오류다 — 2023년 [MPD직캠] 라이즈 승한 'Talk Saxy'는
//      정당하고 2026년 "승한 댄스 실력"은 오태깅인데, 둘 다 제목엔 승한만 있다. 날짜가 유일한 단서.
//   ⚠️ 그래서 탈퇴 이력은 로스터에서 지우지 말고 반드시 {active:false, left:"YYYY.MM.DD"}로 남길 것.
//      승한은 통째로 삭제돼 있었고, 그 상태에선 이 게이트가 작동할 근거 자체가 없었다.
// publishedAt이 없으면(구버전 호출부) 게이트를 걸지 않는다 — 하위호환 + 근거 없이 지우지 않기.
function _atmLeftBefore(a,gko,publishedAt){
  if(!publishedAt)return false;
  const g=_artistGroups(a).find(x=>x.ko===gko);
  if(!g)return false;
  const activeHere=g.active!==undefined?g.active:a.active;
  if(activeHere!==false)return false;
  const left=(g.left!==undefined?g.left:a.left);
  if(!left)return false; // 탈퇴일을 모르면 판단 보류(기존 동작 유지)
  return String(publishedAt).slice(0,10)>String(left).replace(/\./g,'-').slice(0,10);
}
// ── 음악방송 직캠 제목 구조 파서(2026-08-29, 사용자 요청 — "적어도 음악방송 직캠은 오태깅이 없어야") ──
// 뮤직뱅크·쇼!음악중심·엠카운트다운(MPD직캠)·인기가요(안방1열)·쇼챔피언·더쇼·잇츠라이브·딩고 킬링보이스처럼
// 방송사/제작사 공식 채널이 쓰는 직캠 제목은 구조가 고정돼 있다:
//   [태그] 그룹명 멤버명 (직캠|세로캠|풀캠…) '곡명' (그룹EN 멤버EN FanCam) | @방송 날짜
//   [쇼챔직캠 4K] 그룹명 멤버명 - 곡명 (그룹EN 멤버EN) l Show Champion l EP.n l 날짜
//   [it's Live] 그룹명(EN) - 곡명       /       그룹명(EN)의 킬링보이스를 라이브로! – 곡1, 곡2 | 딩고뮤직
// 이 구조를 알면 느슨한 전역 매칭이 내던 오태깅의 대부분이 원천 차단된다(tools/fancam_pattern_probe.js로
// 전 로스터×실제 곡명 15만 제목을 시뮬해 확인한 실제 사고 유형):
//   ① 따옴표 안 **곡명**이 그룹/유닛명과 겹쳐 엉뚱한 그룹이 primary/with로 붙음 — 'Treasure'(에이티즈·샤이니→트레저),
//      'After School'(위클리→애프터스쿨), 'Boyfriend'(파우→보이프렌드), 'Alice'(원위→앨리스), 'BOOM POW'(티오원→파우)…
//      primaryGroup이 "제목 위치"가 아니라 "토큰 길이순"으로 정해져서 곡명 쪽 그룹이 이기는 게 원인.
//   ② 곡명 안의 멤버명이 출연자로 붙음 — 'Key of Secret'(샤이니 키), 'XXL'(영파씨 XXL) 등.
//   ③ 그룹명 바로 뒤 **멤버명이 다른 그룹의 이름과 같음** — "다이아 유니스" → group_ko=유니스(2024 데뷔 그룹).
//   ④ 단일음절 멤버(방탄소년단 뷔·더보이즈 큐·인피니트 엘·빅스 엔·골든차일드 Y)는 그룹명이 바로 옆에 있어도
//      hit()의 length<2 컷 때문에 members가 영영 비어 있었음(→ 그룹 단체 영상으로 저장).
//   ⑤ strictSync 그룹(레인보우·시크릿·god·스피드·배틀·슈가)은 "[뮤뱅] 시크릿 효성 'Madonna'"처럼 공식 직캠이어도
//      전부 skip되거나 멤버 역추론으로 새어나감("god 손호영" → 베리베리 호영).
// 파서는 태그 뒤 **출연자 구간(artistSeg)**·**곡명 구간(songSeg)**·**영문 괄호 구간(enSeg)**을 잘라 돌려주고,
// _m2ParseTitle이 이 구조가 잡힌 제목에 한해 (a) 곡명 구간을 매칭 전에 제거, (b) primary를 출연자 구간의
// 등장 순서로 정렬(구간 밖 그룹은 유닛 확장분만 유지), (c) 출연자 구간에서 "그룹명 바로 뒤 토큰"이 primary
// 로스터의 이름이면 그 이름과 같은 그룹은 버림, (d) 그룹명 바로 뒤 토큰을 로스터와 **정확히** 대조해 단일음절
// 이름까지 멤버로 인정, (e) strictSync/해시태그전용 그룹도 출연자 구간 **선두**에 있으면 인정 — 을 적용한다.
// 구조가 안 잡히는 제목(팬캠 채널의 자유 형식 등)은 기존 경로 그대로라 회귀 위험이 없다.
// 배열을 함수로 감싼 이유: tests/matching.test.js·tools/m2_harness.js의 "이름으로 잘라오기"가 const 문은 괄호
// 균형으로 끝을 찾는데, 아래 정규식의 문자 클래스([\[［]·[^\]］])가 그 계산을 깨뜨림 — 함수는 중괄호만 세서 안전.
function _fancamShowPatterns(){return[
  {show:'뮤직뱅크',    re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*#?\s*(?:뮤뱅|뮤직뱅크|MUSIC\s*BANK|K-?CHOREO)[^\]］]*[\]］]/iu},
  {show:'쇼음악중심',  re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*#?\s*(?:음중|예능연구소|쇼!?\s*음악중심|MUSIC\s*CORE)[^\]］]*[\]］]/iu},
  {show:'엠카운트다운',re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*#?\s*(?:MPD|엠카|M\s*COUNTDOWN)[^\]］]*[\]］]/iu},
  {show:'인기가요',    re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*#?\s*(?:안방\s*1열|인기가요|INKIGAYO)[^\]］]*[\]］]/iu},
  {show:'쇼챔피언',    re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*#?\s*(?:쇼챔|SHOW\s*CHAMPION)[^\]］]*[\]］]/iu},
  {show:'더쇼',        re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*#?\s*(?:THE\s*SHOW|더쇼)[^\]］]*[\]］]/iu},
  {show:'잇츠라이브',  re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［]\s*it['’]?s\s*(?:K-?POP\s*)?LIVE[^\]］]*[\]］]/iu},
  // 채널 불문 "[…직캠…]"류 태그(팬캠 채널·페스티벌 직캠 등) — 태그 자체가 "출연자가 바로 뒤에 온다"는 구조 신호.
  // ⚠️ 이 목록에 표기를 빠뜨리면 그 포맷 전체가 구조 인식에서 탈락하고, 곡명 배제(songSpan)도 같이 안 걸린다.
  // 실측 사고(2026-09-03): `페이스캠`·`원픽캠`이 아래 _FANCAM_FILLER_RE엔 있는데 **여기엔 없어서**
  // "[페이스캠4K] 위클리 지한 'After School' (Weeekly JI HAN FaceCam)"이 구조 미인식 → 곡명 'After School'이
  // 그룹 애프터스쿨로 읽혀 group_ko가 애프터스쿨로 오배정됐다(영문 FACECAM만 있고 한글 표기가 없던 게 원인).
  // 두 목록은 짝이다 — FILLER에 촬영 포맷을 추가할 땐 반드시 여기도 같이 볼 것.
  {show:'직캠(기타)',  re:/^[\s\p{Extended_Pictographic}\uFE0F]*[\[［][^\]］]*(?:직캠|팬캠|FANCAM|FAN\s*CAM|FACECAM|FACE\s*CAM|페이스캠|원픽캠|UNFILTERED\s*CAM|풀캠|세로캠|보이스캠|VOICE\s*CAM)[^\]］]*[\]］]/iu},
  {show:'킬링보이스',  re:/^[\s\p{Extended_Pictographic}\uFE0F]*(.{1,60}?)의\s*킬링\s*보이스/u,style:'dingo'},
];}
const _FANCAM_SHOW_PATTERNS=_fancamShowPatterns();
// 출연자 구간에서 걷어낼 촬영/포맷 수식어(정규화된 대문자 토큰 기준). 'LIVE'는 넣지 않는다(잇츠라이브 그룹EN 등).
const _FANCAM_FILLER_RE=/ (?:직캠|세로캠|세로|풀캠|페이스캠|원픽캠|교차편집|무대|풀버전|4K|8K|HD|FANCAM|FAN CAM|FACECAM|FACE CAM|FULL CAM|CHOREOGRAPHY|VERTICAL|ONE PICK|FOCUS) /g;
function _fancamNormTok(s){return (s||'').toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();}
function _fancamParseTitle(rawTitle){
  const t=rawTitle||'';
  let pat=null,m=null;
  for(const p of _FANCAM_SHOW_PATTERNS){m=p.re.exec(t);if(m){pat=p;break;}}
  if(!pat)return null;
  let artistSeg='',songSeg=null,songSpan=null,enSeg='';
  if(pat.style==='dingo'){
    artistSeg=m[1];
    // "…의 킬링보이스를 라이브로! – 곡1, 곡2 | 딩고뮤직" — 대시 뒤부터 첫 '|'까지가 곡 목록
    const after=t.slice(m.index+m[0].length);
    const sm=/[–—-]\s*(.+?)\s*(?:\||$)/.exec(after);
    if(sm&&sm[1]){songSeg=sm[1];const s=m.index+m[0].length+sm.index+sm[0].indexOf(sm[1]);songSpan=[s,s+sm[1].length];}
  }else{
    const base=m.index+m[0].length;
    const rest=t.slice(base);
    // 따옴표 곡명 — 여는 따옴표는 공백/시작 직후, 닫는 따옴표는 공백·괄호·구분자·끝 직전이어야 함
    // ("Don't Call Me"처럼 곡명 안의 아포스트로피에서 끊기지 않게, 가장 짧은 유효 스팬을 잡는다).
    const q1=/(?:^|\s)(['‘])(.+?)(['’])(?=[\s(|,)\]]|$)/.exec(rest);
    const q2=/(?:^|\s)(["“])(.+?)(["”])(?=[\s(|,)\]]|$)/.exec(rest);
    let q=q1&&q2?(q1.index<=q2.index?q1:q2):(q1||q2);
    if(q){
      const s=base+q.index+q[0].indexOf(q[2],1);
      songSeg=q[2];songSpan=[s,s+q[2].length];
      artistSeg=rest.slice(0,q.index);
      const tail=rest.slice(q.index+q[0].length);
      const em=/\(([^()]*)\)/.exec(tail);
      if(em)enSeg=em[1];
    }else{
      // "그룹 멤버 - 곡명 (EN) l Show Champion …" / "[it's Live] 그룹(EN) - 곡명"
      const dm=/^(.*?\S)\s+[-–—]\s+(.+?)(?=\s*(?:\(|\sl\s|\||$))/.exec(rest);
      if(dm){
        artistSeg=dm[1];songSeg=dm[2];
        const s=base+dm.index+dm[0].lastIndexOf(dm[2]);songSpan=[s,s+dm[2].length];
        const em=/\(([^()]*)\)/.exec(rest.slice(dm.index+dm[0].length));
        if(em)enSeg=em[1];
      }else{
        artistSeg=rest.split(/[(|@#]/)[0];
      }
    }
  }
  // 잇츠라이브식 "아이브(IVE)" — 괄호 안 EN 표기를 enSeg로 분리(출연자 구간엔 한글만 남김)
  if(!enSeg){const pm=/\(([^()]*)\)/.exec(artistSeg);if(pm){enSeg=pm[1];artistSeg=artistSeg.replace(pm[0],' ');}}
  const strip=s=>{let n=' '+_fancamNormTok(s)+' ';let prev;do{prev=n;n=n.replace(_FANCAM_FILLER_RE,' ');}while(n!==prev);return n.replace(/\s+/g,' ');};
  const artistNorm=strip(artistSeg);
  const enNorm=strip(enSeg);
  if(artistNorm.trim().length===0)return null; // 출연자 구간이 비면 구조로 볼 수 없음 → 기존 경로
  // 뒤 괄호가 바깥 구조를 그대로 미러링한 "아티스트 - 곡명" 표기면(2020년대 직캠의 지배적 포맷:
  // `[브랜드] 아티스트 - 곡 (ARTIST - SONG)`), 그 대시 뒤도 **곡명**이다 — 바깥 곡명(songSpan)만
  // 비우고 여기를 남겨두면 괄호 안 곡명 토큰이 그대로 매칭에 들어간다.
  // 실측 사고(2026-09-03): `[원픽캠 4K] WONHO - Eye On You (원호 - 아이 온 유)`에서 괄호 안 "아이 온"이
  // 유아이(드림노트, 성 뗀 변형)로 잡혀 with_groups에 드림노트가 붙었다.
  // ⚠️ 반드시 **직캠 구조가 인식된 제목에만** 적용할 것 — 괄호는 곡명 전용 구간이 아니다.
  // `(Feat - iKON 윤형 & LIMELIGHT 수혜, 가은)`처럼 진짜 출연진이 오는 괄호가 있는데, 그런 제목은
  // 애초에 이 파서가 null을 돌려주므로 여기 오지 않는다(제목 전체에 무차별 적용하면 그걸 죽인다 —
  // 실제로 그렇게 재보고 "고치면 손해"라고 잘못 판단했던 적이 있다).
  let koSongSpan=null;
  if(enSeg){
    const dm=/\s[-–—]\s/.exec(enSeg);
    const base=dm?t.indexOf(enSeg):-1;
    if(dm&&base>=0)koSongSpan=[base+dm.index+dm[0].length,base+enSeg.length];
  }
  return{show:pat.show,artistSeg:artistSeg.trim(),artistNorm,songSeg,songSpan,koSongSpan,enSeg:enSeg.trim(),enNorm};
}
// ── 데뷔 이전 게이트(2026-08-31) ───────────────────────────────────────────────
// "영상이 그룹 데뷔보다 한참 전에 올라왔으면 그 그룹일 수 없다." 탈퇴 이후(_atmLeftBefore)·해체 이후
// 컷오프는 이미 있었는데 반대쪽 끝이 비어 있었다.
//
// 여유 3년인 이유: 데뷔 직전 오디션·연습생 영상이 정상적으로 데뷔보다 먼저 올라온다(대부분 2년 이내,
// 최장 3년 SM루키즈→NCT). 실측(2016년 이전 12,536건 대상)으로 임계값을 골랐다 —
//   −0년 783건 / −1년 682건 / −2년 581건 / **−3년 508건** / −5년 374건 / −10년 126건
// −10년은 너무 느슨해서 126건밖에 못 잡고, −3년이면 오디션 예외를 다 덮으면서 508건을 잡는다.
//
// ⚠️ 이 게이트의 진짜 값어치는 "옛날 영상 거르기"가 아니라 **부분문자열 오배정 탐지**다. −3년에 걸리는
//    미처리분 357건 중 최대가 `아이들`(2018 데뷔)에 붙은 **제국의 아이들(ZE:A) 영상 97건**이고,
//    이건 `B.I` ⊂ `B.I.G`와 똑같은 병이다(2026-08-31 실측). 이즈나←M4, 엔하이픈←박재범도 같은 계열.
// ⚠️ 걸린 그룹은 후보에서 빼기만 한다 — 남는 그룹이 없으면 null(무매칭)이 되어 기존 경로대로 **보류**로
//    간다. '무관'이 아니다: 그 영상의 진짜 그룹이 나중에 등록되면 재판정 대상이 되어야 하므로.
// ⚠️ 재데뷔 멤버의 이전 그룹 영상은 "예외"가 아니라 오태깅이다 — 이전 그룹이 등록돼 있으면 거기로,
//    없으면 보류가 맞다. 이걸 살리려고 여유를 늘리면 게이트가 목적을 잃는다.
// ── 무거운 스윕의 확인 + 결과 보관(2026-08-31) ────────────────────────────────
// 사용자 제보: "오태깅 그룹 재배정을 눌러두고 1시간 넘게 기다렸는데 그냥 '취소됨 미리보기만' 떴다."
// 원인이 두 개다.
//  ① 네이티브 `confirm()`은 **오래 걸린 작업 뒤에 자주 무력화된다** — 탭을 벗어났거나 브라우저가
//     "추가 대화상자 생성 방지"를 걸면 창을 안 띄우고 즉시 false를 돌려준다. 사용자는 누른 적도 없는데
//     취소로 처리된다. 앱 자체 다이얼로그(_confirmDialog)는 그 차단에 안 걸린다.
//  ② 더 나쁜 건 **취소되면 계산을 통째로 버리는 구조**였다. 38만 행을 훑은 1시간이 그대로 사라지고
//     다시 누르면 처음부터 또 훑는다. 그래서 결과를 보관해두고, 다시 누르면 **재분석 없이 바로 적용**한다.
// 보관은 30분만 유지한다 — 그 사이 동기화로 DB가 바뀌면 옛 판단을 적용하는 게 위험하다.
const _SWEEP_KEEP_MS=30*60*1000;
const _sweepPending=new Map(); // btnId → {ts,count,label,apply}
function _sweepPeek(btnId){
  const p=_sweepPending.get(btnId);
  if(!p)return null;
  if(Date.now()-p.ts>_SWEEP_KEEP_MS){_sweepPending.delete(btnId);return null;}
  return p;
}
// 확인창 + 보관. ok면 true, 아니면 false를 주고 결과를 보관해둔다(다시 누르면 바로 적용).
async function _sweepConfirm(btnId,title,msg,okLabel,count,apply){
  let ok;
  if(typeof _confirmDialog==='function')ok=await _confirmDialog({title,msg,okLabel:okLabel||'실행',wide:true});
  else ok=confirm(msg);
  if(ok){_sweepPending.delete(btnId);return true;}
  _sweepPending.set(btnId,{ts:Date.now(),count,label:title,apply});
  _ytSetProg(`취소됨 — 적용 안 함. 분석 결과(${count}건)는 30분간 보관했어요. **다시 누르면 재분석 없이 바로 적용**합니다.`);
  return false;
}
// 결과 보관 없이 **확인창만** 앱 다이얼로그로 바꾸는 가벼운 버전 — 나머지 무거운 스윕들이 쓴다.
// (오태깅 재배정처럼 분석이 아주 오래 걸리는 건 위 `_sweepConfirm`으로 결과까지 보관한다.)
async function _sweepConfirmSimple(title,okLabel,msg){
  if(typeof _confirmDialog==='function')return await _confirmDialog({title,msg,okLabel:okLabel||'실행',wide:true});
  return confirm(msg);
}
const _M2_DEBUT_GRACE_YEARS=3;
function _m2DebutBlocks(gko,publishedAt){
  if(!publishedAt)return false;
  const g=GROUPS[gko];
  if(!g||!g.debut)return false; // 솔로 자기키(GROUPS에 없음)는 대상 아님
  const dy=parseInt(String(g.debut).slice(0,4),10);
  const py=parseInt(String(publishedAt).slice(0,4),10);
  if(!Number.isFinite(dy)||!Number.isFinite(py))return false;
  return py<dy-_M2_DEBUT_GRACE_YEARS;
}
function _m2ParseTitle(rawTitle,selfGko,strict,publishedAt){
  // "(원곡: X)"/"[Dance Cover]"/"(BTS 커버)"류 절은 매칭 전에 먼저 제거한다 — 이 절 안의 이름은 실제
  // 출연자가 아니라 커버 대상(원곡자)이라, 그대로 두면 group_ko/with_members가 원곡자 쪽으로 잘못
  // 붙는다(예: "마마무 - 아주 NICE(원곡: 세븐틴)"에 세븐틴이 콜라보로 붙음). 이 헬퍼는 원래 관리자
  // 검수 도구(_wonkokScan, "원곡: X 오태깅 의심 목록")에서만 쓰이고 있었는데, 검수는 이미 잘못 들어간
  // 기존 데이터만 찾아줄 뿐 새로 들어오는 영상은 여전히 오염됐음 — 매칭 엔진 진입점에서 바로 걸러
  // 원천 차단한다(2026-08-21, Fable 감사 5번 유형 — "원곡커버 오인").
  // 음악방송 직캠 구조(_fancamParseTitle) — 잡히면 따옴표/대시 뒤 곡명 구간을 매칭 전에 통째로 비운다
  // (곡명이 그룹·유닛·멤버명과 겹쳐 생기던 오태깅 원천 차단, 위 파서 주석 ①②). 안 잡히면 null → 기존 경로.
  const _fc=(typeof _fancamParseTitle==='function')?_fancamParseTitle(rawTitle):null;
  // 곡명 구간은 둘일 수 있다 — 바깥(songSpan)과 미러 괄호 안 한글 곡명(koSongSpan, 2026-09-03).
  // 같은 길이의 공백으로 치환하므로 인덱스가 안 밀린다(적용 순서 무관).
  const _fcSrc=(()=>{
    if(!_fc)return rawTitle;
    let s=rawTitle;
    [_fc.songSpan,_fc.koSongSpan].forEach(sp=>{if(sp)s=s.slice(0,sp[0])+' '.repeat(sp[1]-sp[0])+s.slice(sp[1]);});
    return s;
  })();
  const strippedTitle=_wonkokStripClause(_fcSrc);
  // 출연자 구간(정규화) 안에서 그룹/멤버 토큰의 위치. -1이면 구간에 없음. 선두(head)면 0.
  const _fcPos=(tok)=>{if(!_fc)return -1;const n=_fancamNormTok(tok);if(!n)return -1;return _fc.artistNorm.indexOf(' '+n+' ');};
  const _fcHead=(tok)=>_fcPos(tok)===0;
  const _fcMemberNameSet=_fc?new Set(ARTISTS.map(a=>_fancamNormTok(a.name.ko)).concat(ARTISTS.map(a=>_fancamNormTok(a.name.en))).filter(Boolean)):null;
  const _fcHeadIsMemberName=(tok)=>!!_fcMemberNameSet&&_fcMemberNameSet.has(_fancamNormTok(tok));
  // "하이라이트"는 그룹명이 아니라 "요약본" 의미로도 흔히 쓰여 그룹 하이라이트로 오매칭되기 쉬움 — 실측으로
  // "OO '노래' 릴댄 하이라이트 | 릴레이댄스"(릴레이댄스 코너 고정 문구), "OO 무대 하이라이트 모음"류가
  // 대량으로 하이라이트 그룹에 잘못 태깅되는 걸 확인함(2026-07-30). 대괄호로 감싼 경우([하이라이트])뿐
  // 아니라 이런 평문 관용구도 매칭 전에 제거한다 — 한 제목에 여러 번 나올 수 있어 전부(g) 제거.
  const title=_atmStripCommonNounCtx(strippedTitle
    .replace(/[\[(<【]\s*하이라이트\s*[\])>】]/g,' ')
    .replace(/(릴댄|무대|커버|비하인드|메이킹|리허설|티저|예능)\s*하이라이트/g,' ')
    .replace(/하이라이트\s*모음/g,' '));
  // 특수문자를 공백으로 치환해 토큰 경계 확보, 앞뒤 공백 추가
  const norm=' '+title.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';
  // ── feat./ft. 구간 ─────────────────────────────────────────────────────────────
  // "[MPD직캠] 마시로 직캠 'HOTLINE (feat. BOBBY)'"처럼 곡에 피처링이 걸린 제목에서, feat 뒤 아티스트
  // (아이콘 바비)가 영상의 **주인공**으로 잡히고 정작 무대 주인인 마시로가 with_members·cover_of로
  // 밀려나는 주객전도가 실측으로 확인됨(2026-09-02 사용자 제보 — group_ko='아이콘' 4건). feat 뒤 이름은
  // 정의상 그 곡의 게스트지 이 영상의 대표 아티스트가 아니다. 그래서 "매칭 근거가 feat 구간 **안에만**
  // 있는" 그룹은 primaryGroup 후보에서 **뒤로 민다**(제거가 아니라 순서만) → with_ 쪽으로 간다.
  // ⚠️ 주인공이 우리 DB에 없는 아티스트라 feat 대상밖에 안 잡히는 경우엔 후보가 그것뿐이라 자연히 그대로
  // 메인이 된다 — 사용자 요구("메인 출연자가 유니버스에 없으면 feat이어도 기본 그룹-멤버로")와 일치.
  const _featSpans=[];
  {
    // feat 표기 뒤부터 그 절을 닫는 문자(괄호·대괄호·파이프)나 문자열 끝까지를 한 구간으로 본다.
    const re=/(?:^|[\s([{\-–—,])(?:feat|ft|featuring|피처링|피쳐링)\s*\.?\s*/gi;
    let m;
    while((m=re.exec(title))){
      const s=m.index+m[0].length;
      let e=s;
      while(e<title.length&&!/[)\]}|｜]/.test(title[e]))e++;
      if(e>s)_featSpans.push([s,e]);
      re.lastIndex=e;
    }
  }
  const _mkNorm=t=>' '+t.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';
  // feat 구간만 남긴 문자열 / feat 구간만 지운 문자열(같은 길이 공백으로 치환해 인덱스 유지)
  const normFeat=_featSpans.length?_mkNorm(_featSpans.map(([s,e])=>title.slice(s,e)).join(' ')):'  ';
  const normNoFeat=_featSpans.length
    ?_mkNorm(_featSpans.reduce((acc,[s,e])=>acc.slice(0,s)+' '.repeat(e-s)+acc.slice(e),title))
    :norm;
  // n을 넘기면 그 문자열을 대신 검사 — "문빈&산하"처럼 & 로 묶인 유닛명이 정규화되면 "문빈 산하"처럼
  // 멤버 이름이 개별 단어로 쪼개져 보여서, 유닛명 자체가 만든 가짜 개별 언급을 걸러내려면 유닛명 구간을
  // 지운 문자열(normMinusUnits, 아래)로 다시 검사해야 함(TODO(unit-name-false-with) 해결, 2026-08-14).
  function hit(name,n2){
    if(!name||name.length<2)return false;
    // trim 필수 — "K.R.Y."처럼 끝이 특수문자인 이름은 정규화 후 끝에 공백이 남아서 trim 없이 앞뒤
    // 공백을 덧붙이면 이중 공백이 되어 norm과 절대 안 맞음(2026-08-05, 슈퍼주니어 유닛 추가 중 발견).
    const n=name.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
    return (n2||norm).includes(' '+n+' ');
  }
  // "New"(뉴/더보이즈), "On"(온/올아워즈), "Key"(키/샤이니), "Q"(큐/더보이즈)처럼 등록명이 한 글자(단일음절)인
  // 멤버는 영문 로마자 표기가 흔한 영단어와 겹쳐서, 제목에 그 단어가 평범하게 쓰였을 뿐인데도 멤버 언급으로
  // 오매칭되는 사고가 반복됨(예: "On a street in Spain" 제목이 크래비티 영상인데 올아워즈 "온"으로 잘못
  // 콜라보 태깅됨, 2026-07-31 실측). 단일음절 멤버는 해시태그로 명시된 경우만 매칭을 인정한다.
  // _ATM_HASHTAG_ONLY_NAMES(여름/아이엠 등)는 단일음절은 아니지만 마찬가지로 흔한 단어/영어 축약형과
  // 겹치는 이름이라 같은 방식(해시태그만 인정)으로 보호한다 — 영문 쪽은 점/공백 뗀 압축형(#IM)까지 인정.
  function hitHashtag(name){
    if(!name)return false;
    return new RegExp(`#${_atmEscRe(name)}(?![가-힣a-zA-Z0-9])`,'i').test(title)
      ||new RegExp(`#${_atmEscRe(name.replace(/[^가-힣a-zA-Z0-9]/g,''))}(?![가-힣a-zA-Z0-9])`,'i').test(title);
  }
  // 이 이름 변형들이 "feat 구간 안에서만" 등장하는가 — 위 feat 강등 판정용(true면 게스트로 본다).
  // 해시태그로 명시된 이름은 업로더가 직접 특정해준 근거라 강등하지 않는다(#BOBBY로 박아둔 콜라보 등).
  function _featOnlyNames(names){
    if(!_featSpans.length)return false;
    const list=(names||[]).filter(Boolean);
    if(!list.length)return false;
    if(list.some(t=>hitHashtag(t)))return false;
    if(!list.some(t=>hit(t,normFeat)))return false;  // feat 구간에 아예 없으면 무관
    return !list.some(t=>hit(t,normNoFeat));         // 구간 밖에도 있으면 게스트로 못 본다
  }
  // Fable 일반화(2026-08-23): "짧은 영문명(≤4자) 또는 흔한 영단어"인 이름 변형은 그룹명/해시태그 등 맥락
  // 없이는 매칭하지 않는다. 러블리즈 JIN·지디→GD·태양→SUN·리세→Rise·천둥→Thunder처럼 짧은 영문 로마자가
  // 타 그룹 채널의 곡 제목·가사 영단어에 우연히 걸려 그 멤버로 그룹을 역추론하던 오태깅 계열(감사에서 상위
  // 다수 확인)을, 이름 목록을 일일이 늘리는 대신 길이·사전 기준으로 일괄 차단. ⚠️ 이 게이트는 memberHit이
  // 쓰이는 "이름으로 그룹 역추론"(아래 루프)에만 작용하고, 이미 제목에 그룹명이 확정된 그룹의 멤버 추출
  // (다른 경로)은 평문 매칭 그대로라, 진짜 콜라보(그룹명 함께 표기)나 자체 채널 태깅 손실은 작다. 한글 이름
  // 변형은 대상 아님 — name.en만 짧고 name.ko가 멀쩡하면 한글 변형은 평문 매칭 유지되고 영문 변형만 게이트됨.
  const _ATM_COMMON_EN_WORDS=new Set(['love','rise','sun','star','baby','angel','king','queen','prince','princess','fire','rain','moon','light','dream','gold','golden','hero','lucky','summer','winter','spring','jay','leo','max','ace','boy','girl','only','wave','luna','soul','good','high','sky','blue','cherry','honey','crown','magic','forever','tonight','crazy','kevin','thunder','shine','glow']);
  function _atmNameNeedsCtx(t){
    if(!t)return false;
    if(!/^[A-Za-z0-9][A-Za-z0-9.\-'’ ]*$/.test(t))return false; // 라틴(영문) 계열 변형만 — 한글 이름은 단일음절/보호목록 규칙이 커버
    const c=t.replace(/[^A-Za-z0-9]/g,'');
    if(!/[A-Za-z]/.test(c))return false; // 순수 숫자 제외(그룹 토큰 규칙 별도)
    if(c.length<=4)return true;          // 짧은 영문명(JIN·GD·CL·Rise·Jae…)
    return _ATM_COMMON_EN_WORDS.has(c.toLowerCase()); // 흔한 영단어(Prince·Kevin·Love…)
  }
  // 이종 게이트(Fable #2): 두 그룹이 소속사도 다르고 데뷔 세대차(6년 이상)도 크면 "먼 그룹"으로 본다.
  // 이름만으로의 역추론에서 selfGko와 이 관계인 그룹은 해시태그 없이 인정하지 않는다(위 인퍼런스 루프).
  // 그룹 정보가 없으면(솔로 등) 보수적으로 게이트하지 않음(false).
  function _isCrossGate(gko,selfGko){
    const g1=GROUPS[gko],g2=GROUPS[selfGko];
    if(!g1||!g2)return false;
    const co1=(g1.co||'').trim(),co2=(g2.co||'').trim();
    const sameCo=!!(co1&&co2)&&co1===co2;
    const y1=parseInt(g1.debut)||0,y2=parseInt(g2.debut)||0;
    const genGap=(y1&&y2)?Math.abs(y1-y2):0;
    return !sameCo&&genGap>=6;
  }
  // 한글 흔한단어 이름(베이비·하루·하늘…): _atmNameNeedsCtx는 라틴 전용이라 한글 흔한단어는 게이트 못 함.
  // 이름만으로의 역추론(memberHit)에서 이런 이름은 노래제목·가사(#없는 평문 "베이비")나 다른 그룹명
  // 부분문자열(베이비돈크라이·베이비몬스터·베이비복스)에 걸려 엉뚱한 그룹으로 끌려감(2026-08-23 사용자
  // 제보 — 베이비돈크라이 영상이 아워벌스데이 '베이비'로 오추론). 단일음절 이름과 동일하게 인퍼런스에선
  // 해시태그만 인정한다(자체 채널 태깅 _atmMatchesMember는 그룹 확정 문맥이라 평문 매칭 그대로 유지 — 영향 없음).
  // 2026-08-25 전수 감사(tools/name_collision_audit.mjs)로 추가된 6개: 가을(아이브)·노을(레인보우)·
  // 소원(여자친구)·하나(피프티피프티)·루비(프림로즈)·미소(드림노트). 전부 노래 제목·자막에 평문으로
  // 흔히 나오는 단어라 역추론에서 오매칭 위험이 큼(실측: "가을"은 38건 중 5건이 이미 근거 없는 태그).
  const _ATM_COMMON_KO_WORDS=new Set(['베이비','하루','하늘','바다','봄','여름','겨울','별','사랑','달','천사','하트','메이','가을','노을','소원','하나','루비','미소','마이']); // 메이: en=May(달)+동명이인 3명(리센느/세이마이네임/체리블렛)+A2O MAY 그룹명 — 인퍼런스에선 해시태그/그룹문맥만(2026-08-24). 마이(이즈나 Mai): "마이 코드"·"I Love My Body 마이 바디"의 "마이"(=My)에 대량 오매칭(2026-08-25 실측 146건) — 해시태그(#마이)만 인정
  // 멤버 이름이 "실존하는 그룹 이름"과 같은 경우(예: 다이아 멤버 "유니스" ↔ 그룹 유니스(UNIS), A2O MAY의
  // "메이" 등): 제목에 평문으로 나온 "유니스"는 거의 항상 그 그룹을 가리키는데, memberHit이 이걸 그 이름의
  // 멤버(다이아 유니스)로 역추론해 엉뚱한 그룹 콜라보(with_members "유니스(다이아)")로 오태깅함 —
  // 동명이인이 아니라 그룹명↔멤버명 충돌이라 아래 nameToGroups 동명이인 dedup(매칭 1명이라)에도 안 걸림
  // (2026-08-24 사용자 제보 — 그룹 유니스 영상이 다이아 유니스 카드에 뜸). _ATM_COMMON_KO_WORDS와 동일 원칙으로
  // 인퍼런스에선 해시태그로 명시된 경우만 인정한다(그룹 자체 매칭 경로는 별개라 그룹 태깅은 정상 유지).
  // ⚠️ strictSync 그룹도 포함한다(2026-08-25 정정). 예전엔 "strictSync 그룹은 제목 키워드 매칭에서
  // 빠지니 모호함이 없다"고 보고 제외했는데, 이게 틀렸음 — strictSync 그룹(예: 스텔라/Stellar)도 제 이름이
  // 평문으로 든 영상(자체 영상·"Stella Jang"·페스티벌 직캠 등)이 엄연히 존재하고, 그 제목을 동명 멤버
  // (하츠투하츠 스텔라)가 역추론으로 통째로 훔쳐감(실측: group_ko=스텔라 0건, 전부 하츠투하츠 스텔라로
  // 새어나감). 역추론은 원래 위험한 경로라 여기서 게이트해도 손실이 거의 없다 — 방탄 슈가·하츠투하츠
  // 스텔라의 정당한 태깅은 제목에 그룹명이 있어 '멤버 추출' 경로로 잡히지, 이 이름만의 역추론엔 안 의존함.
  const _atmNameIsGroup=a=>!!GROUPS[a.name.ko]&&a.name.ko!==a.group.ko;
  // 영단어/흔한말과 통째로 겹치는 등록명(온리원오프 'Love'·'나인'/'Nine' 등)은 역추론(이름→그룹 추정)에서
  // **아예 제외**한다 — 해시태그(#Love)조차 오탐이 흔해서(인스타 크로스포스트 #love 등), 위 _atmNameNeedsCtx의
  // "해시태그 전용"보다 한 단계 더 엄격하게 "그룹명이 제목에 확정됐을 때의 멤버 추출 경로에서만" 인정한다
  // (사용자 결정 2026-08-30 — 실측: members=['Love'] 1059건 중 95%가 온리원오프 무관, 'love'는 최다 오탐 단어).
  // name.ko/en 둘 다로 막는다. 그룹 자체 매칭·자체 채널 태깅은 별개 경로라 온리원오프 정상 영상은 안 끊긴다.
  const _ATM_INFER_EXCLUDE_NAMES=new Set(['Love','나인','Nine']);
  const _atmInferExcluded=a=>_ATM_INFER_EXCLUDE_NAMES.has(a.name.ko)||_ATM_INFER_EXCLUDE_NAMES.has(a.name.en);
  // 데뷔보다 1년 이상 전에 나온 영상을 순전히 멤버 이름만으로 이 그룹으로 역추론하는 건 근거가 없다 — 그
  // 그룹이 존재하기도 전이라 대개 동명이인(옛 가수·배우가 이름만 겹침)이다(2026-09-01 실측: 올아워즈←현빈
  // 배우, 트리플에스←옛 가수 채연, 유니스←윤하). _atmLeftBefore(탈퇴 후 상한)의 데뷔 하한 대칭 짝.
  // 데뷔 1년 전까지는 유예해 서바이벌·데뷔직전 프로모는 살리고, 자체 채널(selfGko) 데뷔전 티저도 예외.
  function _beforeGroupDebut(gko){
    if(!publishedAt||gko===selfGko)return false;
    const deb=GROUPS[gko]&&GROUPS[gko].debut;
    const m=deb&&(String(deb).match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/)||String(deb).match(/^(\d{4})/));
    if(!m)return false;
    const gate=`${(+m[1])-1}-${(m[2]||'01').padStart(2,'0')}-${(m[3]||'01').padStart(2,'0')}`;
    return String(publishedAt).slice(0,10)<gate;
  }
  function memberHit(a,names){
    if(_atmInferExcluded(a))return false; // 역추론 금지 — 그룹명 동반 시에만(멤버 추출 경로)
    if([...a.name.ko].length===1||_isHashtagOnlyName(a.name.ko)||_ATM_COMMON_KO_WORDS.has(a.name.ko)||_atmNameIsGroup(a))return names.some(t=>hitHashtag(t));
    // 흔한단어 게이트는 변형(_m2NameVariants)마다 개별 적용해야 함 — 풀네임만 검사하면 성을 뗀 given-name
    // 변형(유사랑→"사랑")이 게이트를 통과해 평문 "사랑"(=love)에 대량 오매칭됨(이즈나 group_ko 385건 오염,
    // 2026-08-25 실측). 변형 t 자체가 흔한 한글단어면 그 변형은 해시태그(#유사랑)로 명시됐을 때만 인정한다.
    return names.some(t=>(_atmNameNeedsCtx(t)||_ATM_COMMON_KO_WORDS.has(t))?hitHashtag(t):hit(t));
  }
  // memberHit과 동일한 게이트를 적용하되 "매칭된 토큰들"을 돌려준다 — 교차-ko 영문 동명이인 감지용
  // (2026-08-26 옵션 A). 예: "JIHOON"이 투어스 지훈·트레저 지훈·워너원 박지훈 3명의 en 변형과 겹침을
  // ko 기반 dedup(name.ko='지훈' vs '박지훈')만으론 못 잡던 걸, 토큰 단위로 잡아 검수로 보낸다.
  // some→filter만 다르고 판정 로직은 memberHit과 글자 그대로 동일(둘이 갈라지면 감지가 틀어짐).
  function memberHitTokens(a,names){
    if(_atmInferExcluded(a))return []; // memberHit과 동일 게이트(역추론 제외) — 갈라지면 감지가 틀어짐
    if([...a.name.ko].length===1||_isHashtagOnlyName(a.name.ko)||_ATM_COMMON_KO_WORDS.has(a.name.ko)||_atmNameIsGroup(a))return names.filter(t=>hitHashtag(t));
    return names.filter(t=>(_atmNameNeedsCtx(t)||_ATM_COMMON_KO_WORDS.has(t))?hitHashtag(t):hit(t));
  }
  // 해시태그가 "성+이름"을 띄어쓰기 없이 그대로 붙여 쓰는 경우(예: "#HUHYUNJIN" = 허Huh+윤진Yunjin)가
  // 흔한데, 등록명(name.en)은 보통 성 없이 이름만("Yunjin") 등록돼있어서 위 hit()의 단어 경계 매칭으론
  // "HUHYUNJIN" 안에 파묻힌 "YUNJIN"을 못 찾았음 — 이미 그룹이 확정된 로스터 안에서만 쓰여서(아래
  // "각 매칭 그룹에서 멤버 추출") 무관한 해시태그에 우연히 이름이 섞여 들어갈 위험이 상대적으로 낮고,
  // 4자 미만 짧은 이름은 흔한 부분 문자열(예: "MIN")과 우연히 겹칠 위험이 커서 아예 제외한다
  // (2026-08-05, 사용자 제보 — 르세라핌 허윤진 사례. #HUHYUNJIN이 버젓이 있는데도 특정이 안 돼서
  // "르세라핌" 그룹 전체로만 태깅되던 문제).
  function hitHashtagSubstring(name){
    if(!name||name.length<4)return false;
    const n=name.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,'');
    if(n.length<4)return false;
    const tags=title.match(/#[^\s#]+/g)||[];
    return tags.some(tag=>tag.slice(1).toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,'').includes(n));
  }
  // hit()은 특수문자를 공백으로 치환하고 비교하는데, 그룹 영문명이 "15&"(피프틴앤드)처럼 특수문자로
  // 흔한 단어/숫자를 보강한 이름이면 그 특수문자가 지워지면서 그냥 "15" 하나만 남아버려 날짜·순위·회차
  // 등 무관한 숫자에 대량으로 오매칭된다(2026-08-05, 사용자 제보로 발견). 이런 토큰은 정규화하지 않은
  // 원문 그대로 리터럴 부분 문자열로만 인정한다 — "15&"는 살아있어야 매칭되고 "15"만으로는 안 됨.
  // '&TEAM'(앤팀) 추가(2026-08-25) — '15&'와 완전히 같은 계열. hit()이 특수문자를 공백으로 바꾸는 탓에
  // '&TEAM'이 그냥 'TEAM'이 돼서, "Team 5JANGNAM"·"Team A vs B"·"[#음중직캠] ... Team 1" 같은 무관한
  // 제목이 전부 앤팀으로 매칭됐음(실측: 앤팀 태깅 3,438건 중 328건이 앤팀 표기 없이 'TEAM'만으로 걸림).
  // 리터럴 전용으로 두면 '&'가 살아있는 공식 표기 '&TEAM'만 인정된다.
  // ⚠️ 실제 유튜브 제목은 '&TEAM'보다 해시태그 '#andTEAM'을 훨씬 많이 쓰므로(3,110건 중 대부분),
  //    groups.json 앤팀에 altNames:["andTEAM"]을 같이 넣어야 정상 영상이 안 끊긴다. 둘은 세트.
  const _GROUP_TOKEN_LITERAL_ONLY=new Set(['15&','&TEAM']);
  function hitLiteral(t){return title.toUpperCase().includes(t.toUpperCase());}
  // 영문명이 흔한 가사/구절인 그룹의 EN 토큰은 해시태그(#SAYMYNAME)로 명시됐을 때만 인정한다.
  // 세이마이네임(Say My Name): "When You Say My Name : YEWON"·"MIYEON – Say My Name" 등 곡명·가사에
  // 걸려 남의 영상을 대량으로 훔침(2026-08-25 실측). 한글 '세이마이네임' 토큰은 여기 없어 그대로 평문
  // 매칭되므로 정당한 세이마이네임 영상(한글 표기/멤버)은 안 끊긴다. 스텔라·M&N과 같은 계열의 그룹판 게이트.
  // 'NATURE'(네이처): "NATURE REPUBLIC"(화장품 브랜드)·"nature's..." 등 흔한 영단어에 걸려 남의 영상을
  // 훔침(실측 — NCT127 광고영상이 네이처로). 한글 '네이처'는 게이트 밖이라 정당한 영상은 유지.
  // 'STELLAR'(스텔라): 영어 형용사 stellar(=최고의)에 오염. strictSync를 풀어 한글 '스텔라'는 그룹으로
  // 매칭되게 하되(2011~2018 스텔라 영상 복구), 영문 토큰은 해시태그(#STELLAR)일 때만. 멤버 충돌(하츠투하츠
  // 스텔라)은 아래 _GROUP_TITLE_CONFLICT_EXCLUDE['스텔라']로 처리(제목에 하츠투하츠 있으면 그룹 스텔라 제외).
  // '에이스'(A.C.E): strictSync 22팀 전수 실측(2026-08-27)에서 유일하게 "한글 토큰만 위험"으로 갈린
  // 케이스. strictSync를 유지하면 진짜 A.C.E 무대(THE SHOW 다수)를 영영 못 잡고, 통째로 풀면 "에이스
  // 형사"·"1 vs 1 에이스 랩 배틀"·"갓기 에이스 응원"까지 훔친다 — 그래서 strictSync는 풀되 한글
  // 토큰만 해시태그 전용으로 내렸다. 영문 'A.C.E'는 마침표 덕에 정규화 후 ' A C E '라는 고유 시퀀스가
  // 돼서 hit()으로 안전하게 잡히므로 게이트 밖에 둔다(그래서 위 THE SHOW 제목들은 그대로 회수됨).
  // '하이라이트'/'Highlight'/'BEAST'(비스트): 셋 다 일반 명사라 통째로 풀면 "하이라이트 영상"·"경기
  // 하이라이트"·"BEAST MODE"까지 훔친다 — 시뮬 실측(2026-08-27) 631건 회수에 **오탈취 344건**. 그래서
  // strictSync는 풀되 이 세 토큰만 해시태그 전용으로 내렸다(회수 45건 / 의심 10건, 실질 오탐 ~3건).
  // 게이트 밖에 남는 '비스트'·'B2ST'는 일반어 충돌이 없어 hit()으로 안전하게 잡힌다 — 개명 전
  // 비스트 시절 영상이 이 두 토큰으로 회수되는 게 strictSync를 푼 주된 이유다.
  const _GROUP_TOKEN_HASHTAG_ONLY=new Set(['SAY MY NAME','NATURE','STELLAR','에이스','하이라이트','Highlight','BEAST']);
  // 해체 후 같은 이름이 재사용된 그룹 — 재사용 시점 이후 영상엔 옛 그룹을 매칭하지 않는다(날짜가 유일한
  // 구분 단서, 제목만으론 동일). 스텔라: 그룹 Stellar(2011~2018 해체) ↔ 하츠투하츠 멤버 스텔라(2025 데뷔).
  // 실측 — 재배정 버튼이 2025년 '유하 스텔라 이안'(하츠투하츠) 영상을 그룹 스텔라로 대량 편입시킨 원인.
  // 컷오프(하츠투하츠 프리데뷔 시점) 이후 영상은 그룹 스텔라 제외 → 멤버 인식 경로로 하츠투하츠 멤버가 잡힘.
  const _GROUP_DISBAND_REUSE_CUTOFF={'스텔라':'2024-06-01'};
  // 긴 이름 우선 정렬 (부분 매칭 방지). strictSync 그룹은 제목 키워드 매칭에서 제외 — 자체 채널
  // 동기화(_ytSyncGroup)로만 영상이 들어와야 하는 공통명사 이름 그룹이 외부 채널 영상 제목에서 오인식되는 걸 막음.
  // altNames(예: 브브걸의 "브레이브걸스", 슈퍼노바의 "초신성", JX의 "JYJ")도 토큰에 포함시켜야 함 —
  // 그룹 키를 공식명으로 정리하면서(2026-08-10, "이름(그룹)" 태그 파싱 버그 수정 겸) 옛 이름을 altNames로
  // 옮겼는데, 여기서 안 챙기면 제목에 옛 이름만 적힌 영상(예: "JYJ 콘서트")을 더는 못 알아보는 회귀가
  // 생김(사용자 제보로 발견 — 검색 쪽만 altNames를 보게 고쳤지 태깅 매칭 쪽은 놓쳤었음).
  // 예전엔 해체 그룹 39팀 전체를 여기서 통째로 제외했음(일반명사 그룹명 오염 방지 목적) — 근데 그중
  // 실제 충돌 위험이 있는 건 일부(배틀 등 흔한 단어형)뿐이고, 나머지 대다수(아이즈원·스피카·티오원 등
  // 고유명사형)는 외부/모음 채널 영상 제목에 그룹명이 버젓이 있어도 영원히 매칭 안 되는 과잉 차단이었음.
  // 위험군만 strictSync로 개별 지정하는 걸로 대체(2026-08-20, 39팀 전수 검토 후).
  //
  // 2026-08-27 2차 정리 — 22팀 → **6팀**. 실제 매처로 A/B 시뮬(strictSync 켠 결과 vs 그 그룹만 뺀 결과를
  // 같은 실제 제목 표본에 돌려 비교)해보니, 판별선이 "해체/규모"가 아니라 **"그룹명이 한국어 일반명사·
  // 프로그램명·곡명과 겹치는가"**였다. 남긴 6팀은 겹침이 실측으로 확인된 것들:
  //   레인보우("더 시즌즈-이영지의 레인보우" 프로그램명, 해제 시 826건 오탈취) · 배틀("랩배틀/댄스 배틀",
  //   427) · 시크릿("SECRET BOX"·"IVE SECRET" 앨범명, 261) · 슈가(방탄 슈가 + "Sugar Rush Ride" 곡명,
  //   182) · 스피드(87) · god(77).
  // 하이라이트는 같은 날 7팀에서 추가로 풀었다 — 겹침 자체는 실측됐지만(해제 시 331건 오탈취), 그건
  // '하이라이트'/'Highlight'/'BEAST' 세 토큰 때문이고 개명 전 이름인 '비스트'/'B2ST'는 충돌이 없었다.
  // strictSync는 그룹 전체를 끄는 스위치라 이 구분이 불가능해서, 세 토큰만 _GROUP_TOKEN_HASHTAG_ONLY로
  // 내리고 strictSync를 푸는 쪽으로 바꿨다(에이스와 같은 처리).
  // 푼 14팀(여자친구·로켓펀치·씨아이엑스·위클리·미래소년·에이프릴·비디씨·구구단·티에이엔·피에스타·
  // 씨엘씨·엑스원·남녀공학·프리스틴)은 오탈취가 거의 없고, 오히려 제 그룹명이 제목에 뻔히 있는데도
  // 멤버 이름 역추론에 밀려 남의 그룹으로 가 있었다 — 예: "Rocket Punch(로켓펀치) - CHIQUITA"가
  // 베이비몬스터(치키타=멤버명)로, "씨아이엑스 배진영 직캠"이 워너원(전 소속)으로, "에이프릴 양예나
  // 직캠"이 아이즈원(예나 동명이인)으로. 자세한 수치는 CHANGELOG 2026-08-27 항목.
  const groupsSorted=Object.entries(GROUPS)
    // 음악방송 직캠 구조가 잡힌 제목에선 strictSync 그룹도 후보에 넣되, 아래 루프에서 "출연자 구간 선두"일
    // 때만 인정한다(파서 주석 ⑤ — "[뮤뱅] 시크릿 효성 'Madonna'"는 정당한 공식 직캠). 프로그램명·곡명 충돌
    // ("이영지의 레인보우", 'SECRET' 앨범명)은 선두가 아니거나 곡명 구간이라 이미 비워져 있어 안 걸린다.
    .filter(([ko,v])=>!_STRICT_SYNC_GROUPS.has(ko)||_fc)
    .map(([ko,v])=>({ko,tokens:[ko,v.en,...(v.altNames||[])].filter(Boolean)}))
    .sort((a,b)=>Math.max(...b.tokens.map(t=>t.length))-Math.max(...a.tokens.map(t=>t.length)));
  const matchedGroupKos=[];
  const seen=new Set();
  for(const{ko,tokens}of groupsSorted){
    if(seen.has(ko))continue;
    const conflicts=_GROUP_TITLE_CONFLICT_EXCLUDE[ko];
    if(conflicts&&conflicts.some(re=>re.test(title)))continue;
    const _reuseCut=_GROUP_DISBAND_REUSE_CUTOFF[ko]; // 이름 재사용 컷오프 이후 영상엔 옛 그룹 매칭 안 함
    if(_reuseCut&&publishedAt&&publishedAt>=_reuseCut)continue;
    // 직캠 구조의 출연자 구간 **선두** 토큰은 strictSync/해시태그전용/리터럴전용 게이트 없이 인정(구조 자체가
    // 근거). 단, 그 토큰이 어떤 아티스트의 등록명과도 같으면(그룹 슈가 ↔ 방탄소년단 슈가, "[직캠] 슈가 'Daechwita'")
    // 선두여도 우회하지 않는다 — 그 경우는 멤버 쪽이 맞을 가능성이 커서 기존 게이트/역추론에 맡긴다.
    const _fcHeadOk=t=>_fc&&_fcHead(t)&&!_fcHeadIsMemberName(t);
    if(_STRICT_SYNC_GROUPS.has(ko)){ if(tokens.some(_fcHeadOk)){matchedGroupKos.push(ko);seen.add(ko);} continue; }
    if(tokens.some(t=>_fcHeadOk(t)||(_GROUP_TOKEN_HASHTAG_ONLY.has(t)?hitHashtag(t):(_GROUP_TOKEN_LITERAL_ONLY.has(t)||_ATM_DYNAMIC_LITERAL_ONLY.has(t))?hitLiteral(t):hit(t)))){matchedGroupKos.push(ko);seen.add(ko);}
  }
  // 유닛명(V8, GOT the beat 등) 매칭 — 유닛 자체는 그룹이 아니라, 실제 소속 그룹/멤버로 나눠 합류시킴.
  // 제목에 유닛명만 있고 개별 멤버 이름은 없는 경우까지 커버하기 위해, 유닛 멤버를 "그 멤버 이름이
  // 제목에 직접 있었던 것"처럼 membersByGroup에 강제로 합쳐 넣는다(아래 멤버 추출 루프에서 union).
  //
  // (unit-name-false-with 해결, 2026-08-14) 제노재민/문빈산하처럼 멤버 이름이 그대로 유닛명에 포함된
  // 경우 — "&"/공백으로 묶인 유닛명은 정규화되면 "문빈 산하"처럼 멤버 이름이 개별 단어로 쪼개져서,
  // 유닛명만 제목에 있어도 멤버 이름이 "따로" 언급된 것처럼 히트돼버림("제노재민 제노 직캠"에서 재민이
  // with로 잘못 잡히는 원인). normMinusUnits는 매칭된 유닛명 토큰의 리터럴 구간을 norm에서 지운
  // 문자열 — 이걸로 다시 검사하면 유닛명이 만든 가짜 개별 언급은 사라지고, 제목 다른 자리에 진짜로
  // 따로 쓰인 이름만 남는다. 아래 멤버 추출 루프에서 이 문자열을 기준으로 재검증한다.
  const _groupTokNormSet=new Set();
  Object.entries(GROUPS).forEach(([ko,v])=>[ko,v.en,...(v.altNames||[])].filter(Boolean).forEach(t=>{const n=t.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();if(n)_groupTokNormSet.add(n);}));
  const _unitTokIsGroup=t=>{const n=t.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();return n!==t.toUpperCase().trim()&&_groupTokNormSet.has(n);};
  const unitExtraMembers={}; // gko -> Set(mko)
  let normMinusUnits=norm;
  Object.values(_PROJECT_UNITS).forEach(unit=>{
    // _UNIT_HASHTAG_ONLY_TOKENS(index.html) — "AAA"/"EVOLution" 등 흔한단어 유닛 트리거는 해시태그로만
    // 인정(2026-08-21, Fable 감사로 트리플에스 유닛명이 아시아 아티스트 어워즈 약칭·다른 그룹 콘서트명과
    // 충돌해 대량 오매칭되는 게 발견됨).
    // 유닛명이 정규화 후 실존 그룹 토큰과 같아지는 경우("마마무+"→"마마무", 2026-08-29 시뮬로 발견 — 마마무
    // 단체 직캠마다 솔라·문별이 붙었음)는 특수문자가 살아있는 원문 리터럴(hitLiteral)로만 인정한다.
    if(!unit.names.some(t=>_UNIT_HASHTAG_ONLY_TOKENS.has(t)?hitHashtag(t):(_unitTokIsGroup(t)?hitLiteral(t):hit(t))))return;
    // 로테이션 유닛(NCT U — shared.js 주석 참고)은 members가 "곡마다 바뀌는 참여자 풀"이라 전원
    // 확장하면 참여도 안 한 멤버까지 붙는다(2026-08-25 실측 767건). 제목에 이름이 따로 언급된
    // 멤버만 인정하고, 그 멤버의 그룹만 matchedGroupKos에 넣는다 — 이름이 하나도 없으면 이 유닛으로
    // 인한 멤버·그룹 추가는 0건(자체 채널이면 group_ko는 채널 기준으로 따로 정해지므로 영상이
    // 유실되지는 않음).
    const named=unit.rotating
      ? unit.members.filter(({mko,gko})=>_unitMemberNamedInTitle(mko,gko,hit,hitHashtag))
      : unit.members;
    named.forEach(({mko,gko})=>{
      if(!seen.has(gko)){matchedGroupKos.push(gko);seen.add(gko);}
      if(!unitExtraMembers[gko])unitExtraMembers[gko]=new Set();
      unitExtraMembers[gko].add(mko);
    });
    unit.names.forEach(t=>{
      const n=t.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
      if(n)normMinusUnits=normMinusUnits.replace(new RegExp(' '+_atmEscRe(n)+' ','g'),' ');
    });
  });
  // 흔한 곡/유행어와 겹치는 그룹(_GROUP_AMBIGUOUS_IF_COMATCHED)이 다른 실존 그룹과 "같이" 매칭됐으면
  // 그 다른 그룹의 콜라보로 착각한 오매칭일 확률이 압도적으로 높으므로(단독 매칭일 때만 인정) 제거.
  // selfGko(지금 이 영상이 실제로 속한 채널)가 주어졌는데 그 그룹명 자체는 제목에 없고(멤버 이름만
  // 있거나 자체 채널 영상이라 아예 그룹명이 안 적힌 경우) 이 애매한 그룹만 덩그러니 매칭된 경우도
  // 마찬가지로 버린다 — "내 채널 영상인데 텍스트로만 보면 엉뚱한 그룹이 유일한 매칭"인 상황은 거의
  // 항상 이런 단어 충돌이지, 진짜 콜라보가 아님(2026-07-31, 에스파·비투비 채널에서 실측 확인).
  if(matchedGroupKos.length>1||(selfGko&&matchedGroupKos.length===1&&!matchedGroupKos.includes(selfGko))){
    for(const gko of[...matchedGroupKos]){
      if(_GROUP_AMBIGUOUS_IF_COMATCHED.has(gko)||_ATM_DYNAMIC_AMBIGUOUS_COMATCH.has(gko)){
        matchedGroupKos.splice(matchedGroupKos.indexOf(gko),1);
        seen.delete(gko);
      }
    }
  }
  // 음악방송 직캠 구조 후처리(파서 주석 ①③) — 여러 그룹이 걸렸을 때 primary는 토큰 길이가 아니라
  // **출연자 구간에서 먼저 나온 순서**로 정한다. 출연자 구간에도 영문 괄호 구간에도 없는 그룹은 곡명·방송
  // 보일러플레이트에서 온 것이라 버리되, 유닛 확장(유앤비→에이스/핫샷/유키스 등)으로 들어온 그룹은 유지.
  // 그리고 primary 바로 뒤 토큰(=멤버 자리)이 primary 로스터의 이름과 같으면, 그 이름과 같은 **그룹**
  // (다이아 "유니스" ↔ 그룹 유니스)은 멤버 표기를 그룹으로 오인한 것이므로 버린다.
  if(_fc&&matchedGroupKos.length>1){
    const _gtoks=ko=>[ko,GROUPS[ko]&&GROUPS[ko].en,...((GROUPS[ko]&&GROUPS[ko].altNames)||[])].filter(Boolean);
    const _gpos=ko=>{let best=-1;for(const t of _gtoks(ko)){const p=_fcPos(t);if(p>=0&&(best<0||p<best))best=p;}return best;};
    const _inEn=ko=>!!_fc.enNorm&&_gtoks(ko).some(t=>{const n=_fancamNormTok(t);return n&&_fc.enNorm.includes(' '+n+' ');});
    const kept=matchedGroupKos.filter(ko=>_gpos(ko)>=0||_inEn(ko)||unitExtraMembers[ko]);
    kept.sort((a,b)=>{const pa=_gpos(a),pb=_gpos(b);return (pa<0?1e9:pa)-(pb<0?1e9:pb);});
    if(kept.length){
      const head=kept[0];
      const headRoster=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===head));
      const rosterNames=new Set();headRoster.forEach(a=>{_m2NameVariants(a).forEach(t=>rosterNames.add(_fancamNormTok(t)));});
      const final=kept.filter((ko,i)=>i===0||!_gtoks(ko).some(t=>rosterNames.has(_fancamNormTok(t))&&_gpos(ko)>0));
      matchedGroupKos.splice(0,matchedGroupKos.length,...final);
      seen.clear();final.forEach(ko=>seen.add(ko));
    }
  }
  // ── 영문 약칭이 약한 그룹은 "게스트 근거"로 인정하지 않는다(2026-08-31) ──────────
  // BTS는 behind the scenes의 약자로도 널리 쓰여서, 영문 토큰만으로 콜라보를 판정하면 오탐이 쏟아진다.
  // 실측: `with_groups`에 방탄소년단이 든 **329건 중 174건(53%)이 제목에 `방탄소년단`도 `#BTS`도 없었고**,
  // 표본은 전부 `bts of ○○`(비하인드)·`@BTS`(멘션)·플레이리스트 나열이었다 — 콜라보가 하나도 없다.
  // ⚠️ 면제 기준은 "위치(primary냐)"가 아니라 **다른 그룹이 같이 잡혔는가**다. 위치로 하면
  //    `HITGS ver. Countdown! BTS #힛지스`에서 방탄이 primary·힛지스가 게스트로 뒤집혀 잡혀서 규칙이
  //    무력해진다(실측으로 확인). 방탄만 잡힌 영상(`BTS - Dynamite @ MAMA`)은 그대로 두고, **다른
  //    그룹이 함께 잡힌 경우에만** 영문 BTS를 근거로 인정하지 않는다 — 그러면 그 다른 그룹이 주인이 된다.
  //    자체 채널(selfGko=방탄소년단)도 당연히 면제. `group_ko` 단독 매칭분 2,329건은 손대지 않는다.
  // 위너(WINNER)도 같은 병 — 영어 단어 winner와 철자가 같다. 실측: `with_groups`에 위너가 든 59건 중
  // **55건(93%)이 제목에 한글 '위너'가 없었고**, 전부 `the Winner Is?`·`Remember the winner of that
  // night?`(시상식 클립)였다. 자체 채널 영상(group_ko=위너 1,085건)은 selfGko 면제라 영향 없다.
  const _GROUP_WEAK_EN_AS_GUEST={
    '방탄소년단':/방탄소년단|#\s*BTS/i,
    '위너':/위너|#\s*WINNER/i,
  };
  if(matchedGroupKos.length>1){
    const kept=matchedGroupKos.filter(ko=>{
      const re=_GROUP_WEAK_EN_AS_GUEST[ko];
      if(!re||ko===selfGko)return true;
      return re.test(title);
    });
    if(kept.length!==matchedGroupKos.length){
      matchedGroupKos.splice(0,matchedGroupKos.length,...kept);
      seen.clear();kept.forEach(ko=>seen.add(ko));
    }
  }
  // 데뷔 이전 게이트 — literal로 매칭된 그룹 중 영상보다 한참 뒤에 데뷔한 그룹을 후보에서 뺀다.
  // (selfGko = owner 채널은 group_ko가 채널로 고정이라 대상 아님)
  if(matchedGroupKos.length){
    const kept=matchedGroupKos.filter(ko=>ko===selfGko||!_m2DebutBlocks(ko,publishedAt));
    if(kept.length!==matchedGroupKos.length){
      matchedGroupKos.splice(0,matchedGroupKos.length,...kept);
      seen.clear();kept.forEach(ko=>seen.add(ko));
    }
  }
  // feat 강등(그룹명 매칭 경로) — 근거가 feat 구간 안에만 있는 그룹을 뒤로 민다. primaryGroup은
  // matchedGroupKos[0]에서 뽑히므로 순서만 바꿔도 메인/게스트가 갈린다. 전부 feat이면 손대지 않는다.
  if(matchedGroupKos.length>1&&_featSpans.length){
    const featOnly=new Set(matchedGroupKos.filter(ko=>
      _featOnlyNames([ko,GROUPS[ko]&&GROUPS[ko].en,...((GROUPS[ko]&&GROUPS[ko].altNames)||[])])));
    if(featOnly.size&&featOnly.size<matchedGroupKos.length){
      matchedGroupKos.splice(0,matchedGroupKos.length,
        ...matchedGroupKos.filter(ko=>!featOnly.has(ko)),
        ...matchedGroupKos.filter(ko=>featOnly.has(ko)));
    }
  }
  // "이름(그룹명)" 패턴에서 그룹명이 우리 시스템에 없는 경우 → 타 소속 동명이인 신호
  const knownGroupTokens=new Set();
  Object.entries(GROUPS).forEach(([ko,v])=>{
    knownGroupTokens.add(ko.toUpperCase());
    if(v.en)knownGroupTokens.add(v.en.toUpperCase());
  });
  function hasForeignGroupSuffix(name,selfNames){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const m=title.match(new RegExp(escaped+'\\s*\\(([^)]+)\\)','i'));
    if(!m)return false;
    const adj=m[1].trim().toUpperCase();
    // "마시로 (MASHIRO)"처럼 괄호 안이 **본인의 다른 표기**(영문명·별칭)면 타 소속 신호가 아니다.
    // 이걸 안 걸러서 이 패턴의 제목에선 본인이 역추론에서 통째로 탈락하고, 그 빈자리를 feat 아티스트가
    // 메인으로 차지하는 사고가 있었음(2026-09-02, 위 feat 강등과 같은 제보에서 발견).
    const _flat=s=>String(s).toUpperCase().replace(/[^가-힣A-Z0-9]/g,'');
    if(selfNames&&selfNames.some(n=>n&&_flat(n)===_flat(adj)))return false;
    for(const tok of knownGroupTokens){if(adj===tok||adj.includes(tok)||tok.includes(adj))return false;}
    return true;
  }
  // 그룹 미매칭이면 멤버 이름으로 그룹 역추론
  if(!matchedGroupKos.length){
    const inferred=new Map(); // groupKo -> [memberKo]
    const nameToGroups=new Map(); // 멤버명(한글) -> Map(아티스트객체 -> 그 사람 소속 groupKo[]) — 동명이인 충돌 감지용
    const tokenToArtists=new Map(),artistToTokens=new Map(),artistToGkos=new Map(); // 옵션 A: 토큰↔사람↔그룹 동명이인 감지용
    let _inferViaHashtag=false;   // 이 역추론에 해시태그 명시가 하나라도 쓰였는가(아래 confidence 판정용)
    const _featOnlyMembers=new Set(); // 이름이 feat 구간 안에만 있던 멤버(아래 feat 강등용)
    for(const a of ARTISTS){
      // 예전엔 GROUPS에 없는 그룹(아이유·보아처럼 group.ko="솔로"인 솔로 아티스트)을 통째로 건너뛰어서,
      // 제목에 진짜 그룹명 없이 솔로 아티스트 이름만 있는 콜라보(예: 자체 채널 영상에 "아이유"만 언급)가
      // 영원히 미태깅으로 남는 버그가 있었음(2026-08-05, 우즈×아이유 카드에서 실측 발견). a.group.ko를
      // 그대로 키로 써도 여러 솔로 아티스트가 "솔로"라는 같은 값을 공유해서 한 그룹처럼 묶이지만, 아래
      // membersByGroup은 그 버킷 안 이름 목록을 그대로 with_members에 "이름(솔로)" 형식으로 펼쳐 넣을
      // 뿐이라 문제 없음 — _findArtistByConnName/_apiVidToSong의 withKey가 기대하는 것과 정확히 같은 형식.
      const names=_m2NameVariants(a);
      // strict 채널(예능/잡지)에서는 그룹명 literal 매칭이 아예 없으므로, 멤버 이름도 해시태그로
      // 명시된 경우만 인정 — 평문 매칭(memberHit의 일반 분기)은 여기서 아예 시도하지 않는다.
      const _matchedToks=strict?names.filter(t=>hitHashtag(t)):memberHitTokens(a,names);
      const nameMatched=_matchedToks.length>0;
      if(nameMatched&&!names.some(t=>hasForeignGroupSuffix(t,names))){
        // 겸임 멤버(NCT 마크·해찬, 아이즈원 안유진 등)는 자기 소속 그룹 전부(_artistGroups)에 귀속시켜야
        // 함 — a.group.ko(주 소속)만 보면 부소속 채널/모음영상에서 역추론 자체가 원천 차단됨
        // (2026-08-20, 자체채널 태깅은 이미 _artistGroups 쓰는데 여기만 안 맞춰져 있던 비대칭 수정).
        // ⚠️ 이종 게이트(Fable #2, 2026-08-23): selfGko(이 영상이 실제 속한 채널 그룹)와 "소속사·세대 모두
        // 먼" 다른 그룹을, 제목에 그룹명·해시태그도 없이 순전히 이름만으로 역추론하는 건 근거가 약하다 —
        // 진짜 콜라보(같은 무대·페스티벌)면 대개 이름이 해시태그나 그룹명과 함께 명시되므로, far 그룹은
        // 해시태그 매칭일 때만 인정한다. #1(짧은영문/흔한단어 게이트)이 못 거르는, 이름은 멀쩡한데 세대·
        // 소속사가 동떨어진 역추론 오태깅(감사 상위 다수)을 잡는 2차 게이트.
        const viaHashtag=names.some(t=>hitHashtag(t));
        // 해시태그로 사람이 직접 명시한 건 "약한 근거"가 아니다(2026-08-25, 사용자 결정).
        // 실측: 검수 큐 3,051건 중 661건(22%)이 #KEY·#키처럼 해시태그로 멤버가 박혀 있는데도 weak로
        // 분류돼 검수 대기에 쌓이고 있었음 — 업로더가 태그로 특정해준 걸 "추측"으로 볼 이유가 없다.
        if(viaHashtag)_inferViaHashtag=true;
        // ⚠️ group.ko가 "솔로"인 아티스트(아이유·비·싸이·승한 등 무소속 솔로)는 그 값이 **여러 명이
        // 공유하는 placeholder**라 그대로 group_ko로 쓰면 안 된다 — `_isValidVidGroupKo`도 '솔로'를
        // 무효로 치고, 실제로 이 경로를 타고 group_ko='솔로'로 저장된 영상이 633건 쌓여 어느 카드에도
        // 안 걸리는 미아가 돼 있었음(2026-08-25 실측). 나머지 코드가 쓰는 관례(`_ytGroupKoFor`)와 똑같이
        // "실존 그룹이면 그룹명, 아니면 본인 이름"으로 바꿔서 넣는다.
        const artistGkos=_artistGroups(a).filter(g=>!_atmLeftBefore(a,g.ko,publishedAt)&&!_beforeGroupDebut(g.ko)) // 탈퇴 후·데뷔 이전 영상은 그 그룹 아님
          .map(g=>(GROUPS[g.ko]?g.ko:a.name.ko))
          .filter(gko=>viaHashtag||!selfGko||gko===selfGko||!_isCrossGate(gko,selfGko));
        if(artistGkos.length){
          if(_featOnlyNames(_matchedToks.length?_matchedToks:names))_featOnlyMembers.add(a.name.ko);
          artistGkos.forEach(gko=>{
            if(!inferred.has(gko))inferred.set(gko,[]);
            inferred.get(gko).push(a.name.ko);
          });
          // 겸임 멤버 본인의 다중 소속(가짜 충돌)과 진짜 동명이인(다른 사람, 아래 참고)을 구분하려면
          // 아티스트 객체 단위로 묶어야 함 — 그냥 groupKo Set으로 합치면 마크 혼자 매칭돼도
          // {엔시티127,엔시티드림} 2개가 쌓여 아래 동명이인 로직이 "충돌"로 오인해 본인을 두 그룹
          // 모두에서 지워버리는 자기파괴적 회귀가 생김(2026-08-20, 위 겸임 수정과 함께 발견).
          if(!nameToGroups.has(a.name.ko))nameToGroups.set(a.name.ko,new Map());
          nameToGroups.get(a.name.ko).set(a,artistGkos);
          // 이 사람↔매칭토큰↔소속그룹을 기록 — 같은 토큰이 서로 다른 그룹의 사람 여럿과 겹치는데 그 사람이
          // 최종 inferred에 살아남으면(아래 옵션 A) 그 그룹배정은 못 믿는다.
          artistToTokens.set(a,_matchedToks.map(t=>t.toUpperCase()));
          artistToGkos.set(a,artistGkos);
          _matchedToks.forEach(t=>{const k=t.toUpperCase();if(!tokenToArtists.has(k))tokenToArtists.set(k,new Set());tokenToArtists.get(k).add(a);});
        }
      }
    }
    if(!inferred.size)return null;
    // 동명이인 충돌 처리 — 같은 한글 이름(예: "지유")이 서로 다른 그룹 멤버로 동시에 매칭되면, 제목엔
    // 그 이름이 딱 한 번 나왔을 뿐인데 "누구인지" 그룹명 없이는 알 도리가 없다. selfGko가 그 충돌
    // 그룹 중 하나면 그쪽만 인정하고(자기 채널이니 당연히 자기 소속으로 해석) 나머지 그룹에서는 그
    // 이름을 빼고, selfGko로도 못 가르면(외부/모음 채널처럼 selfGko 자체가 이 두 그룹 중 하나가 아닌
    // 경우 포함) 어느 쪽인지 알 도리가 없으므로 "둘 다 맞다"고 우기지 않고 양쪽 다 뺀다 — 드림캐쳐
    // "지유"와 키키 "지유"가 외부 모음채널 영상에서 계속 서로에게 잘못 얹히던 원인이 이거였음(2026-08-05,
    // 사용자 제보). 기존 selfGko 안전장치는 "그 그룹 전체"가 selfGko와 같을 때만 작동해서, selfGko가
    // 아예 idol 그룹이 아닌 모음채널인 경우까지는 못 걸렀었음.
    nameToGroups.forEach((perPerson,name)=>{
      if(perPerson.size<2)return; // 매칭된 사람이 1명뿐이면(겸임이라 그룹이 여러 개여도) 진짜 동명이인 충돌 아님
      const allGkos=new Set();
      perPerson.forEach(gkos=>gkos.forEach(g=>allGkos.add(g)));
      const keepGko=(selfGko&&allGkos.has(selfGko))?selfGko:null;
      allGkos.forEach(gko=>{
        if(gko===keepGko)return;
        const list=inferred.get(gko);
        if(!list)return;
        const idx=list.indexOf(name);
        if(idx!==-1)list.splice(idx,1);
        if(!list.length)inferred.delete(gko);
      });
    });
    if(!inferred.size)return null;
    // 그룹명이 아예 없이 멤버 이름 하나만으로 그룹을 역추론한 상황 — 이 영상이 원래 어느 채널 소속인지
    // (selfGko) 이미 알고 있고 그 그룹도 같은 이름으로 걸렸다면, 동명이인(예: 크래비티 "성민" ↔
    // 슈퍼주니어 "성민")을 엉뚱하게 다른 그룹 콜라보로 엮는 걸 막기 위해 다른 그룹 추론은 버린다.
    if(selfGko&&inferred.has(selfGko)){
      for(const gko of[...inferred.keys()]){if(gko!==selfGko)inferred.delete(gko);}
    }
    // 옵션 A(2026-08-26 사용자 결정): 제목에 그룹 표시가 전혀 없어 이름만으로 역추론한 상황에서,
    // **살아남은 멤버가 "서로 다른 그룹 2곳 이상의 사람과 겹치는 토큰"으로 매칭됐으면** 그 그룹배정은
    // 못 믿는다 → confidence:'ambiguous'로 검수 큐로(_extBuildRows가 hidden+needs_review 저장, 유저
    // 노출 안 함=오배정 0). 예: #JIHOON(투어스/트레저/워너원)은 살아남은 박지훈이 애매토큰 매칭 → 애매.
    // 반대로 "쯔위 최애는 나연"은 쯔위(고유토큰)로 트와이스가 확정되고 나연(동명이인)은 이미 dropped라
    // 살아남은 멤버가 애매토큰이 아니므로 애매 아님(오탐 방지). selfGko 있으면(자체/오너 채널) 애매 아님.
    let _tokenAmbiguous=false;
    if(!selfGko){
      // ⚠️ "서로 다른 **사람** 2명 이상"이 먼저다(2026-08-28 수정). 예전엔 토큰에 걸린 사람들의
      //    **그룹 합집합** 크기만 봐서, 겸임 멤버는 본인 혼자로도 2를 넘겼다 — 엔시티 해찬(127+드림),
      //    세이마이네임 히토미(세이마이네임+아이즈원)처럼 동명이인이 전혀 아닌데 애매로 찍혀
      //    **동기화 즉시 content_flag:'hidden'** 이 박혔다(사용자 제보: "숨김할 영상들이 아닌걸").
      //    로스터 실측 결과 이 오판 대상이 81명 — 안유진·장원영·사쿠라·은하·김세정·박우진 등
      //    영상이 많은 대형 그룹 멤버가 대거 포함돼 있었다. 바로 위 주석이 원래 말하던 의도
      //    ("서로 다른 그룹 2곳 이상의 **사람**과 겹치는 토큰")대로 사람 수 게이트를 먼저 건다.
      const _tokAmbig=k=>{
        const people=tokenToArtists.get(k);
        if(!people||people.size<2)return false; // 한 사람이면 몇 개 그룹을 겸임하든 동명이인이 아니다
        const s=new Set();
        people.forEach(x=>(artistToGkos.get(x)||[]).forEach(g=>s.add(g)));
        return s.size>=2;                       // 그 여러 사람이 서로 다른 그룹에 걸쳐 있을 때만 애매
      };
      for(const a of artistToTokens.keys()){
        const survived=(artistToGkos.get(a)||[]).some(g=>(inferred.get(g)||[]).includes(a.name.ko));
        if(!survived)continue;
        if((artistToTokens.get(a)||[]).some(_tokAmbig)){_tokenAmbiguous=true;break;}
      }
    }
    const result=[];
    for(const[gko,members]of inferred){result.push({gko,members});}
    // 데뷔 이전 게이트 — 역추론 경로에도 똑같이 건다. 여기가 원래 가장 약한 경로(이름 하나로 그룹을
    // 통째로 추정)라 게이트가 더 중요하다. 다 걸리면 아래에서 null이 되어 무매칭(보류)으로 간다.
    if(result.length){
      const kept=result.filter(r=>r.gko===selfGko||!_m2DebutBlocks(r.gko,publishedAt));
      result.splice(0,result.length,...kept);
    }
    if(!result.length)return null;
    // feat 강등(역추론 경로) — 근거 멤버가 전부 feat 구간 안에서만 나온 그룹은 뒤로 민다. 그룹명 매칭
    // 경로와 같은 원칙이고, 전부 feat이면(주인공이 DB에 없음) 순서를 안 건드려 기존 동작 그대로다.
    if(result.length>1&&_featOnlyMembers.size){
      const isFeat=r=>r.members.length&&r.members.every(mko=>_featOnlyMembers.has(mko));
      const front=result.filter(r=>!isFeat(r)),back=result.filter(isFeat);
      if(front.length&&back.length)result.splice(0,result.length,...front,...back);
    }
    // confidence:'weak' — 제목에 그룹명/해시태그 리터럴이 전혀 없이 멤버 이름 하나만으로 그룹 자체를
    // 역추론한 경로. Love(온리원오프)/루나(에프엑스)/조이(레드벨벳) 오염 사례가 전부 이 경로에서
    // 나왔음(2026-08-20, 실측 확인) — 무관 채널(THE SHOW 등)의 무관 영상 제목에 흔한 단어 하나 있다고
    // 그룹 전체가 잘못 배정되는 사고가 여기서만 발생. 호출부(_extBuildRows)가 owner 없는 외부/모음채널
    // 매칭에서 이 값을 보고 즉시확정 대신 검수 대기로 돌린다.
    return{primaryGroup:result[0].gko,withGroups:result.slice(1).map(r=>r.gko),
           membersByGroup:Object.fromEntries(result.map(r=>[r.gko,r.members])),
           confidence:_tokenAmbiguous?'ambiguous':(_inferViaHashtag?'strong':'weak')};
  }
  // 각 매칭 그룹에서 멤버 추출 — normMinusUnits 기준으로 검사해 유닛명 토큰이 만든 가짜 개별 언급을
  // 제외한다(위 unit-name-false-with 해결 참고).
  const membersByGroup={};
  for(const gko of matchedGroupKos){
    // 겸임 멤버 대응 — a.group.ko===gko(주 소속만)면 NCT 마크/해찬처럼 부소속 그룹 이름이 제목에
    // 매칭돼도 정작 그 멤버 자신은 로스터에서 빠져 추출 누락됨(2026-08-20, 위 역추론부와 동일 수정).
    // matchAliases(2026-08-23): 정식 표기가 영문인 멤버(러블리즈 JIN·Kei 등)의 한글 로마자 별칭("진"·"케이").
    // ⚠️ 이 별칭은 "제목에 그룹명이 확정된" 이 블록에서만 단어경계로 매칭한다 — 역추론(memberHit) 블록엔
    // 절대 안 들어가서 흔한 문자열("케이"=케이팝 등)로 그룹을 잘못 끌어오는 오염이 없다. 저장은 name.ko
    // 그대로라(표시/쿼리 일관) 별칭으로 걸려도 members엔 'JIN'/'Kei'로 들어감. 단일음절 별칭("진")도 그룹이
    // 이미 확정된 맥락이라 hit()의 length<2 컷 없이 단어경계로 인정(진심·진짜는 단어경계라 안 걸림).
    const _aliasHit=al=>{const n=(al||'').toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ').trim();return !!n&&normMinusUnits.includes(' '+n+' ');};
    // 탈퇴 게이트(위 _atmLeftBefore 주석 참고) — 이 영상이 올라온 시점에 이미 그 그룹을 떠난 사람은 제외.
    const matched=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko)&&!_atmLeftBefore(a,gko,publishedAt)&&(_m2NameVariants(a).some(t=>hit(t,normMinusUnits)||hitHashtagSubstring(t))||(a.matchAliases||[]).some(_aliasHit))).map(a=>a.name.ko);
    const extra=unitExtraMembers[gko];
    if(extra){
      const extraArr=[...extra];
      const confirmed=extraArr.filter(mko=>{
        const a=ARTISTS.find(x=>x.name.ko===mko&&_artistGroups(x).some(g=>g.ko===gko));
        return a&&_m2NameVariants(a).some(t=>hit(t,normMinusUnits));
      });
      // 유닛 멤버 중 아무도 유닛명 밖에서 개별적으로 안 걸리면(유닛명만 제목에 있는 경우) 기존처럼
      // 전원 추가 — 개별 이름이 정말 따로 언급된 경우만 그 멤버만 추가.
      (confirmed.length?confirmed:extraArr).forEach(mko=>{if(!matched.includes(mko))matched.push(mko);});
    }
    // 음악방송 직캠 구조(파서 주석 ④) — 출연자 구간/영문 괄호 구간에서 "그룹 토큰 바로 뒤 나머지"를 로스터
    // 이름과 **정확히** 대조한다(성 뗀 변형·영문 압축형·별칭 포함). 단일음절 이름(뷔·큐·엘·엔·Y)도 여기서는
    // 인정 — 그룹명 바로 옆 고정 자리라 흔한 단어와 겹칠 여지가 없다. 느슨한 매칭 결과에 합집합.
    if(_fc){
      const segs=[_fc.artistNorm,_fc.enNorm].filter(x=>x&&x.trim());
      const gtoks=[gko,GROUPS[gko]&&GROUPS[gko].en,...((GROUPS[gko]&&GROUPS[gko].altNames)||[])].filter(Boolean);
      for(const seg of segs){
        let after=null;
        for(const t of gtoks){const n=_fancamNormTok(t);if(!n)continue;const i=seg.indexOf(' '+n+' ');if(i>=0){after=seg.slice(i+n.length+2).trim();break;}}
        if(!after)continue;
        const ac=after.replace(/\s/g,'');
        // 점수제: 등록명(ko/en/별칭) 정확 일치 3 > 성 뗀 한글 정확 일치 2 > 영문 성+이름 접미 일치 1
        // ("JANG WONYOUNG" ↔ 등록 "Wonyoung"). 최고 점수만 남긴다 — "SIYOON"이 시윤(정확)과 윤(접미 YOON)
        // 둘 다에 걸릴 때 시윤만, "혜리"가 혜리(등록명)와 장혜리(성 뗀 변형) 둘 다에 걸릴 때 혜리만 남기기 위함.
        // 접미 일치끼리 겹치면 더 긴 이름만(HYUNJIN vs JIN 같은 포함 관계).
        const scored=[];
        ARTISTS.forEach(a=>{
          if(!_artistGroups(a).some(g=>g.ko===gko)||_atmLeftBefore(a,gko,publishedAt))return;
          let best=0,bestLen=0;
          [a.name.ko,a.name.en,...(a.matchAliases||[])].filter(Boolean).forEach(c=>{const cc=_fancamNormTok(c).replace(/\s/g,'');if(!cc)return;
            if(ac===cc){if(best<3){best=3;bestLen=cc.length;}}
            else if(/^[A-Z0-9]+$/.test(cc)&&cc.length>=4&&ac.endsWith(cc)&&ac.length-cc.length<=6){if(best<1||(best===1&&cc.length>bestLen)){best=1;bestLen=cc.length;}}});
          const st=_atmStripSurname([...a.name.ko]);
          if(st&&best<2&&ac===_fancamNormTok(st).replace(/\s/g,'')){best=2;bestLen=st.length;}
          if(best)scored.push({mko:a.name.ko,best,bestLen});
        });
        if(scored.length){
          const top=Math.max(...scored.map(x=>x.best));
          let win=scored.filter(x=>x.best===top);
          if(top===1){const L=Math.max(...win.map(x=>x.bestLen));win=win.filter(x=>x.bestLen===L);}
          win.forEach(x=>{if(!matched.includes(x.mko))matched.push(x.mko);});
        }
      }
    }
    membersByGroup[gko]=matched;
  }
  // ── 일반명사형 그룹명 오매칭 게이트(2026-09-02, 반복 제보) ─────────────────────────────
  // 아이콘(=icon)·위너(=winner)는 그룹명이 흔한 로드워드/영단어라 제목에 그 단어만 있어도 그룹으로 오태깅됨
  // ("올해의 아이콘", "the Winner is?"). 그룹명 리터럴만으론 불충분 → 다음 중 하나가 있을 때만 인정:
  //   ① 자체 채널(selfGko)  ② 그 그룹 멤버가 제목에 확정됨(membersByGroup 비어있지 않음 — 위너 강승윤 팬캠 유지)
  //   ③ 해시태그(#위너/#WINNER·#아이콘/#iKON)  ④ 고유 표기(iKON 대소문자 그대로 / 올대문자 WINNER — 로드워드
  //   "Winner/winner/icon"과 구분). 멤버가 잡히면 살리므로 정상 매칭은 유지되고 근거 없는 리터럴만 걸린다.
  //   (역추론 경로 5964는 멤버→그룹이라 이 로드워드 케이스가 안 옴 — 여긴 그룹명 리터럴 경로.)
  // ⚠️ 아이콘과 위너를 **일부러 다르게** 판정한다(2026-09-03 정정). 근거는 아래 5797의 실측이다 —
  //   "with_groups에 위너가 든 59건 중 55건(93%)이 제목에 **한글 '위너'가 없었고** 전부 시상식 클립".
  // 즉 오탐의 정체는 영문 winner였고 **한글 '위너'는 신뢰할 만한 신호**였는데, 이 게이트가 같은 날
  // 나중에 추가되면서 한글까지 같이 막아 5797의 근거를 덮어썼다(과교정). 그 결과 "아이브 X 위너
  // 스페셜 무대" 같은 정상 콜라보가 통째로 버려졌다(desc-evidence 테스트가 이걸 잡고 있었는데 CI가
  // 빨간불인 채 방치돼 있었음).
  //   · 위너: 한글 '위너'를 인정한다(5797과 같은 기준).
  //   · 아이콘: 한글 '아이콘'은 그 자체가 흔한 일반명사다("올해의 아이콘", "패션 아이콘"). 위너와 달리
  //     한글 표기가 신호가 못 되므로 해시태그/고유표기(iKON)만 인정하는 기존 기준을 그대로 둔다.
  // ⚠️ 한글 '위너'에 단어 경계((?<![가-힣])…(?![가-힣]))를 걸지 말 것 — 한 번 걸었다가 뺐다(2026-09-03).
  //    이유: "Wanna One(위너원)" 오타 제목 5건이 위너로 샐까 봐 넣었는데, **12,025건 전수 비교에서 경계
  //    유무의 판정 차이가 0건**이었다. 그룹명 리터럴 매칭이 토큰 단위라 "위너원"은 애초에 위너 후보가
  //    되지 않아서(그리고 영문/해시태그 경로는 어차피 아래 두 분기가 받으므로) 경계가 결정하는 게 없다.
  //    참고로 '위너'는 '워너원'의 부분문자열도 아니다(위≠워) — 그 5건은 업로더 오타였을 뿐이다.
  const _COMMON_NOUN_GROUP_OK={
    '아이콘':t=>/#\s*아이콘/.test(t)||/#\s*iKON/i.test(t)||/iKON/.test(t),
    '위너':t=>/위너/.test(t)||/#\s*WINNER/i.test(t)||/\bWINNER\b/.test(t),
  };
  if(matchedGroupKos.length){
    const kept=matchedGroupKos.filter(gko=>{
      const chk=_COMMON_NOUN_GROUP_OK[gko];
      if(!chk||gko===selfGko)return true;
      if((membersByGroup[gko]||[]).length>0)return true; // 멤버 확정되면 인정(정상 매칭 유지)
      return chk(rawTitle); // 아니면 해시태그/고유표기 있을 때만
    });
    if(kept.length!==matchedGroupKos.length){
      matchedGroupKos.length=0;matchedGroupKos.push(...kept);
      for(const k in membersByGroup)if(!kept.includes(k))delete membersByGroup[k];
    }
  }
  // confidence:'strong' — 제목에 그룹명(공식명/영문명/altNames) 리터럴이나 해시태그가 실제로 있어서
  // 그룹을 특정한 경로. 위 역추론(약한 근거) 경로와 대비되는 값.
  return{primaryGroup:matchedGroupKos[0],withGroups:matchedGroupKos.slice(1),membersByGroup,confidence:'strong'};
}

// (기능 추가, 2026-08-14) with_members/with_groups를 정할 때 그 그룹의 활동중 멤버(탈퇴/비활동 제외)
// 전원이 매칭됐으면 개별 나열 대신 그룹 단위 태그로 뭉친다 — "멤버 전체 나오는 영상인데 이름이 죽
// 나열된다"는 사용자 제보로 추가. _m2ParseTitle을 호출하는 5곳(콜라보 재검증/자동 태깅/외부채널 동기화/
// 수동 영상 추가)이 전부 이 판정을 공유해야 일관되므로 여기 한 곳에 둔다.
function _activeRosterKos(gko){
  return ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko)&&a.active!==false).map(a=>a.name.ko);
}
// sec: _m2ParseTitle이 그 그룹에서 찾아낸 멤버(mko) 배열. 활동중 멤버 전원이 sec에 다 있으면 그룹
// 단위(asGroup=true)로 판정하고, 혹시 탈퇴/비활동 멤버가 추가로 같이 잡혔으면 그 사람만
// extraMembers로 남겨 개별 표기를 유지한다(그룹 태그만으론 그 사람이 나온다는 정보가 사라지므로).
// 활동중 로스터 자체가 비어있으면(그룹 데이터 없음 등) 안전하게 그룹 단위로 취급하지 않는다.
function _classifyGuestGroup(sec,gko){
  if(!sec||!sec.length)return{asGroup:true,extraMembers:[]};
  const active=_activeRosterKos(gko);
  if(active.length&&active.every(mko=>sec.includes(mko))){
    return{asGroup:true,extraMembers:sec.filter(mko=>!active.includes(mko))};
  }
  return{asGroup:false,extraMembers:sec};
}

// idol tier 채널의 owner({mko,gko})가 실제로 어느 group_ko로 저장돼야 하는지 계산 — GROUPS에 없는 솔로
// 아티스트(이영지 등)는 자기 이름 자체가 그룹 키 역할을 함(_ytGroupKoFor와 동일 규칙). owner.gko는 채널
// 등록 시점(_ecAddChannel)에 동명이인이면 그룹을 직접 골라 저장해둔 값 — 있으면 그걸 그대로 신뢰하고,
// 없으면(마이그레이션 전 옛 데이터) 예전처럼 이름만으로 첫 매치를 찾는다(동명이인이면 틀릴 수 있음,
// 2026-08-21 사용자 제보 — 등록 폼이 이름만 받고 그룹 구분이 없어 동명이인 처리가 안 되고 있었음).
function _extOwnerGko(owner){
  if(!owner)return null;
  if(owner.gko)return owner.gko;
  const first=(owner.mko||'').split(',')[0].trim(); // 공동소유자는 그룹 공유 — 첫 이름으로 그룹 해석
  const a=ARTISTS.find(x=>x.name.ko===first);
  return a?_ytGroupKoFor(a):first;
}
// 채널 1개 분량 파싱 → Supabase rows 배열 반환. strict는 호출부(_ytSyncExtChannels/_ytBackfillChannelCore)가
// 그 채널의 tier('variety'/'magazine'/'idol'/'show')를 보고 넘겨준다 — _EXT_STRICT_TIERS 참고.
// tier/owner: idol 채널(owner 있음)은 제목 매칭 결과와 무관하게 owner를 주 인물로 고정하고(스킵도 없음),
// 게스트 감지에만 제목 파싱을 계속 씀(2026-08-11). tier가 'music'이 아니면(variety/magazine/idol) 원래
// mv/live/short 키워드가 없어 'other'로 뭉뚱그려지던 영상을 'variety' 카테고리로 분류한다 — 단 tier가
// 'show'(드라마/영화, 2026-08-12 신설)면 예능과 구분해서 'show' 카테고리로 따로 분류한다.
// 영상 upsert 공용 래퍼 — source_handle/source_tier(출처 채널 컬럼)를 채우되, 마이그레이션 SQL을 아직
// 안 돌렸으면(컬럼 없음) 첫 시도에서 감지해 그 필드만 빼고 재시도한다. 동기화가 절대 안 깨지게(2026-08-25).
let _ytHasSourceCols=true;
let _ytHasPubTs=true; // published_ts(정확한 업로드 시각) 컬럼 존재 여부 — 없으면 첫 upsert에서 감지해 끈다
async function _ytUpsertVideos(rows,opts){
  // 세로(쇼츠) 판별 보정 — API 썸네일 비율론 쇼츠도 16:9(letterbox)라 못 잡고(위 _ytFetchNewVideos 주석),
  // 지금까진 관리자 '가로→쇼츠 승격' 스윕이 나중에 실측했음. 그래서 Trend(최근 7일)처럼 스윕 전 구간은
  // 세로 영상이 가로 틀에 갇혀 보였다(2026-08-29 사용자 제보). 삽입 직전 oardefault.jpg를 실측(_probeShortsBatch,
  // index.html)해 세로면 is_short 승격 — 배치가 5초 데드라인으로 스스로 시간을 제한하므로 동기화가 느려지거나
  // 멈추지 않고, 못 잡은 잔여분은 기존 스윕이 backstop. try/catch로 어떤 경우에도 upsert 자체는 막지 않는다.
  if(typeof _probeShortsBatch==='function'){
    try{const toProbe=rows.filter(r=>r&&r.id&&!r.is_short);if(toProbe.length)await _probeShortsBatch(toProbe);}catch(e){}
  }
  // 마이그레이션 전 환경(컬럼 없음)에서도 동기화가 절대 안 깨지게, 없는 컬럼만 빼고 재시도한다.
  // published_ts(정확한 업로드 시각, 2026-09-02 신설)도 같은 방식으로 감싼다.
  // 없는 컬럼만 빼고 보낸다 — 플래그가 꺼진 것만 지우므로 조건이 늘어도 이 함수는 그대로 쓴다.
  const strip=rs=>rs.map(r=>{
    const o={...r};
    if(!_ytHasSourceCols){delete o.source_handle;delete o.source_tier;}
    if(!_ytHasPubTs)delete o.published_ts;
    return o;
  });
  let{error}=await sb.from(_YT_TABLE).upsert(strip(rows),opts);
  if(error&&_ytHasPubTs&&/published_ts/.test(error.message||'')){
    _ytHasPubTs=false; // 컬럼 추가 SQL 전이면 시각 없이 진행(추가하면 새로고침 후 자동으로 다시 켜짐)
    ({error}=await sb.from(_YT_TABLE).upsert(strip(rows),opts));
  }
  if(error&&_ytHasSourceCols&&/source_handle|source_tier/.test(error.message||'')){
    _ytHasSourceCols=false; // 이후 동기화는 조용히 출처 없이 진행(마이그레이션 실행하면 자동으로 다시 켜짐 — 새로고침 후)
    ({error}=await sb.from(_YT_TABLE).upsert(strip(rows),opts));
  }
  return{error};
}
function _extBuildRows(vids,strict,tier,owner,defaultCat,handle){
  const rows=[];let skipped=0;
  const ownerGko=_extOwnerGko(owner);
  for(const v of vids){
    const match=_m2ParseTitle(v.title,ownerGko||undefined,strict,v.published_at);
    if(!owner&&!match){skipped++;continue;}
    // idol tier(owner.mko 있음)는 인물이 이미 확정이라 그대로 고정. fans tier(owner.gko만 있음, 그룹
    // 전체가 대상이라 특정 멤버가 없음)는 제목에서 그 그룹 멤버 언급을 찾아본다 — 없으면(그룹 전체
    // 다루는 영상) 빈 배열로 둔다(2026-08-21).
    // match가 null일 수 있음(strict 채널에서 제목에 그룹명/해시태그가 하나도 없어 파싱 결과 없음). owner가
    // 있는 채널(팬/아이돌개인)은 위 skip에 안 걸리고 여기로 오므로 반드시 match를 널가드해야 함 — 안 그러면
    // 그룹명 없는 팬캠 제목("성현 직캠" 등) 하나만 걸려도 그 채널 동기화가 통째로 크래시했음(2026-08-23 수정).
    const members=owner?.mko?owner.mko.split(',').map(s=>s.trim()).filter(Boolean):(match?(match.membersByGroup[ownerGko||match.primaryGroup]||[]):[]); // 공동운영이면 소유자 여러 명 다 붙임(2026-08-22)
    let withGroups=[],withMembers=[]; // v2 원곡 해석기가 아래에서 재배열할 수 있어 let(2026-08-30)
    // owner가 있으면 match.primaryGroup도 게스트 후보에 포함시켜야 함 — owner(솔로 아티스트 등)는
    // GROUPS에 없어 제목의 그룹명 리터럴 매칭 대상이 아니므로, 게스트 그룹이 유일하게 매칭되면 그게
    // withGroups가 아니라 primaryGroup 자리로 잡혀서 게스트가 통째로 누락됐었음(2026-08-11, "이영지랑
    // #에스파 카리나" 같은 제목에서 실측 확인).
    const guestCandidates=owner&&match?[match.primaryGroup,...match.withGroups].filter((g,i,arr)=>g&&arr.indexOf(g)===i):(match?match.withGroups:[]);
    // 게스트는 일단 전부 with_로 넣는다 — 원곡(커버) 판정은 아래 v2(_coverResolve)가 곡명 사전으로 정확히 하고
    // with_에서 원곡자를 cover_of로 옮긴다(2026-08-30). 기존 "커버키워드+6년선배" 휴리스틱은 곡명 근거 없이
    // 세대차만으로 커버 처리해 오판이 있어 v2로 대체(사용자 요청 — 원곡 태깅은 곡명 기반이 정확).
    let coverGroups=[],coverMembers=[]; // v2가 채운다
    guestCandidates.forEach(gko=>{
      if(owner&&gko===ownerGko)return; // 본인 그룹이 게스트로 중복 잡히는 것만 방지
      const sec=match.membersByGroup[gko]||[];
      const{asGroup,extraMembers}=_classifyGuestGroup(sec,gko);
      if(asGroup)withGroups.push(gko);
      extraMembers.forEach(mko=>withMembers.push(`${mko}(${gko})`));
    });
    // 겸임 멤버가 두 소속으로 두 번 붙거나, members에 이미 있는 사람이 with_에도 붙는 것을 여기서 정리한다.
    ({withGroups,withMembers}=_normalizeMemberTags({title:v.title,groupKo:owner?ownerGko:(match&&match.primaryGroup),members,withGroups,withMembers}));
    // fans tier는 원래 category(mv/live/short 등)가 뭐였든 무조건 'fan'으로 — "by Fans" 탭은 콘텐츠
    // 종류가 아니라 "팬이 만들었다"는 출처 자체가 기준이라, variety/show처럼 'other'만 덮어쓰는 방식으론
    // 안 됨(직캠류 팬캠도 팬 채널 콘텐츠면 다 여기로 가야 함, 2026-08-21).
    // 제목으로 분류한 결과(_ytClassify)가 우선이고, 'other'로 안 잡힌 것만 폴백을 쓴다. 예전엔 폴백이
    // tier에서 곧바로 나와서(show면 show, 나머지 전부 variety) 아이돌 개인 채널의 브이로그·일상까지
    // 몽땅 예능 탭에 쌓였음 — 채널마다 성격이 다른데 한 값으로 강제할 이유가 없어서 채널별 설정
    // (ext_channels.default_category)으로 바꿈(2026-08-25, 사용자 요청).
    //   빈 값  → 기존 동작(show=show, 나머지=variety)
    //   'none' → 폴백 안 함. 분류 안 된 건 'other'로 남아 전체(all) 탭에만 노출된다.
    const _fbRaw=defaultCat||(tier==='show'?'show':'variety');
    const _fallback=_fbRaw==='none'?(v.category||'other'):_fbRaw;
    const category=tier==='fans'?'fan':(tier&&tier!=='music'&&(!v.category||v.category==='other'))?_fallback:v.category;
    // 신뢰도 검수 — owner 없는 채널(THE SHOW·뮤직뱅크 등 특정 그룹 소유가 아닌 모음/방송사 채널)에서
    // group_ko가 오로지 멤버 이름 하나만으로 역추론(confidence:'weak')됐으면, 그 즉시 실제 그룹으로
    // 확정하지 않고 content_flag:'hidden'(기존에 이미 전면 신뢰되던 은닉 메커니즘 재사용)+needs_review:true로
    // 저장해 어드민 검수 큐에서만 보이게 한다. owner가 있는 채널(이 채널 자체가 특정 인물 소유)은
    // group_ko가 owner로 고정되지 confidence 영향을 안 받으므로 대상이 아님(2026-08-20, Love/루나/조이
    // 오염 실측 확인 후 도입).
    // 옵션 A(2026-08-26): 그룹표시 없는 동명이인(영문토큰 교차-ko)은 자신있게 배정하지 않고 검수+숨김으로.
    const ambiguous=!owner&&match.confidence==='ambiguous';
    const needsReview=!owner&&(match.confidence==='weak'||ambiguous);
    // 원곡 태깅 v2(2026-08-30) — 곡명 사전으로 커버를 확정해 위 "6년 선배" 라우팅을 덮어쓴다. _coverResolve는
    // sync(디스코 사전 지연빌드). 차트 A등급은 async라 동기화에선 생략(유명곡 대부분 디스코로 커버, 나머진
    // "원곡 태깅 v2" 스윕이 backfill). group_ko 재배정(reassign)은 owner 채널 group_ko 고정이라 동기화에선 안 함.
    let coverSong=null;
    try{
      const cr=_coverResolve({title:v.title,group_ko:owner?ownerGko:match.primaryGroup,members,with_groups:withGroups,with_members:withMembers,cover_of_groups:coverGroups,cover_of_members:coverMembers,published_at:v.published_at},{});
      // 동기화 자동적용은 **명시적 인간 표기만**: 크레딧(원곡:X)·아티스트표기. 실DB 감사(6천 표본)에서
      // 이 둘은 오탐 0(아일릿→보아, 킥플립→스키즈 등 전부 정확). 반면 따옴표/대시/챌린지태그/평문은
      // 동음이의 곡명(‘Winter Wonderland’→샤이니, ‘Smoke’·‘Wait’·‘SUMMER_FESTA’ 등)에 우연히 걸리는
      // 오탐이 섞여, 자동 전파하지 않고 "🎵 원곡 태깅 v2" 스윕(표본 확인+스냅샷)에서만 반영한다.
      if(cr&&!cr.ambiguous&&cr.patch&&(cr.reason==='credit'||cr.reason==='artist')){
        if(cr.patch.cover_of_groups)coverGroups=cr.patch.cover_of_groups;
        if(cr.patch.cover_of_members)coverMembers=cr.patch.cover_of_members;
        if('with_groups' in cr.patch){withGroups=cr.patch.with_groups;withMembers=cr.patch.with_members;}
        if(cr.patch.cover_of_song)coverSong=cr.patch.cover_of_song;
      }
    }catch(e){}
    rows.push({
      id:v.id,title:v.title,title_norm:_titleNorm(v.title),description:v.description||'',thumb:v.thumb,published_at:v.published_at,
      category,
      is_short:!!v.is_short, // 형식 플래그는 채널 tier 폴백(위 _fallback)의 영향을 안 받는다 — 장르와 직교(2026-08-27)
      source_handle:handle||null,source_tier:tier||null, // 출처 채널(오너/서바이벌 판단용, 2026-08-25)
      // 탈퇴 후 솔로 재귀속 — 옛 그룹으로 확정된 행을 본인 이름으로 돌린다(2026-09-03).
      // owner 채널(본인/그룹 소유)은 group_ko가 채널 주인으로 고정이라 대상이 아니다.
      // 대상이 아니면 null을 돌려주므로 기존 값 그대로.
      group_ko:owner?ownerGko:((!ambiguous&&_soloReattribGko(match.primaryGroup,members,v.published_at))||match.primaryGroup),
      members:ambiguous?[]:members,with_groups:withGroups,with_members:withMembers,
      // 항상 두 칸을 넣는다(빈 값이어도 []). 조건부로 넣으면 200개 배치 안에 커버 영상이 하나라도
      // 섞였을 때, 그 칼럼이 배치의 INSERT 컬럼 목록에 들어가면서 키가 없는 일반 영상 행들이 null로
      // 저장되려다 NOT NULL 위반으로 배치 전체가 튕겼음(M2·뮤직뱅크·쇼챔피언 백필 실패, 2026-08-25).
      cover_of_groups:coverGroups,
      cover_of_members:coverMembers,
      cover_of_song:coverSong, // v2가 뽑은 곡명(없으면 null) — 항상 넣어 배치 컬럼 일관성 유지(2026-08-30)
      // 약한 근거 매칭을 더는 hidden으로 감추지 않는다(2026-08-25, 사용자 결정). needs_review 플래그만
      // 남겨 어드민이 사후 감사할 수 있게 하고, 유저에겐 정상 노출한다.
      //   왜: "사람이 검수한다"는 전제가 실제로 안 지켜져서(사용자: "안 누르게 되더라") 큐가 3,051건
      //   쌓이는 동안 그 대가로 709건이 유저 화면에서 사라져 있었음. 게다가 실측해보니 큐의 93%가
      //   고유한 이름이고 표본은 전부 정확했음 — 위험한 이름은 이미 앞단 게이트(흔한단어·짧은영문·
      //   동명이인 dedup)가 걸러내기 때문. 이 정책이 도입된 2026-08-20엔 그 게이트들이 없었다.
      // ⚠️ ambiguous도 더는 hidden으로 감추지 않는다(2026-09-03, 사용자 확인). 위 weak 결정(8/25)과
      //    **같은 논리를 같은 이유로** ambiguous 경로에도 적용한 것 — weak를 풀 때 이 가지가 남아 있었다.
      //    실측(2026-09-03): hidden 2,377건 중 밴 인물 목록에 걸리는 건 31건뿐이고 **2,346건(98.7%)이
      //    이 자동 경로로 숨겨진 것**이었다. 그 분포가 곧 한 글자 이름 충돌 그대로다 —
      //    스트레이키즈 517(한/HAN)·더보이즈 491(뉴/NEW)·세븐틴 262(준/JUN)·스테이씨 202(윤/YOON).
      //    즉 그룹이 잘못 배정된 영상이 동시에 숨김까지 당해 "틀린 채로 안 보이는" 이중 피해였다.
      //    hidden의 의도된 용도는 **밴 인물 + 관리자 수동 판단**뿐이다(사용자 확인) — 자동으로 붙이지 말 것.
      //    ambiguous 행은 needs_review:true로 검수 큐에는 그대로 올라가고, members는 아래처럼 비워둔다.
      ...(_shouldJunkFlag(v.title,tier)?_flagPatch('무관','auto'):needsReview?{needs_review:true}:{}),
      ...((tier==='variety'||tier==='show')?{content_formats:[tier]}:{})
    });
  }
  return{rows,skipped};
}

let _extSyncing=false;
async function _ytSyncExtChannels(){
  if(_extSyncing)return;
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _extSyncing=true;
  const setProg=msg=>{_ytSetProg(msg);};
  let totalAdded=0,totalSkipped=0,errors=0;
  // 쿼터는 실행 한 번당 공유되는 자원이라, 목록 앞쪽(M2·Mnet처럼 영상이 아주 많은 채널)이 매번 쿼터를
  // 다 써버리면 뒤쪽 채널(뮤직뱅크 등)은 이 실행에서 아예 시작도 못 해보고 매번 밀림 — 그러면 그 채널은
  // "이어받기" 체크포인트가 있어도 영원히 이어받을 기회가 없음. 지난번에 중단된(이어받을 게 있는) 채널을
  // 목록 맨 앞으로 당겨서, 이번 실행의 쿼터를 걔가 먼저 쓰게 한다(공평하게 돌아가며 진행되도록).
  const _orderedChannels=[..._EXT_CHANNELS].sort((a,b)=>{
    const aResume=localStorage.getItem(`kpu_ext_resume_${a.handle}`)?1:0;
    const bResume=localStorage.getItem(`kpu_ext_resume_${b.handle}`)?1:0;
    return bResume-aResume;
  });
  for(let ci=0;ci<_orderedChannels.length;ci++){
    const ch=_orderedChannels[ci];
    const prefix=`[${ci+1}/${_EXT_CHANNELS.length}] ${ch.name}`;
    try{
      setProg(`${prefix} 채널 정보 가져오는 중…`);
      const uploadsId=await _ytGetUploadsId(ch.url,key);
      const lsKey=`kpu_ext_last_${ch.handle}`;
      const resumeKey=`kpu_ext_resume_${ch.handle}`;
      const sinceId=localStorage.getItem(lsKey)||null;
      // 과거로 파고들다가 지난번에 중단된 지점이 있으면(쿼터 초과 등) 처음(최신)부터가 아니라 거기서부터 이어받는다
      const resumeTok=localStorage.getItem(resumeKey)||'';
      setProg(`${prefix} 영상 목록 가져오는 중…`+(resumeTok?' (이전 중단 지점부터 이어받는 중)':sinceId?'':' (첫 동기화)'));
      const{vids,done,interrupted,resumeToken}=await _ytFetchNewVideos(uploadsId,key,sinceId,(fetched,tot)=>{
        setProg(`${prefix} ${fetched}${tot?'/'+tot:''}개 수집 중…`+(resumeTok?' (이어받는 중)':''));
      },resumeTok);
      if(vids.length){
        const{rows,skipped}=_extBuildRows(vids,_EXT_STRICT_TIERS.has(ch.tier),ch.tier,ch.owner,ch.defaultCategory,ch.handle);
        totalSkipped+=skipped;
        if(rows.length){
          setProg(`${prefix} ${rows.length}개 저장 중…`);
          for(let i=0;i<rows.length;i+=200){
            const{error}=await _ytUpsertVideos(rows.slice(i,i+200),{onConflict:'id',ignoreDuplicates:true});
            if(error)throw new Error(error.message);
          }
          // resumeTok 없이(=맨 최신부터) 이번 실행이 시작됐을 때만 vids[0]가 진짜 "채널의 현재 최신 영상"이므로
          // 그때만 증분 동기화 기준점(sinceId)을 갱신한다 — 과거를 이어받는 중엔 건드리지 않음
          if(!resumeTok&&vids[0]?.id)localStorage.setItem(lsKey,vids[0].id);
          totalAdded+=rows.length;
        }
      }
      if(done){
        localStorage.removeItem(resumeKey); // 채널 끝(가장 과거)까지 도달했거나 이미 아는 지점까지 따라잡음 — 이어받을 것 없음
        setProg(`${prefix} 완료 (+${vids.length}개)`);
      }else if(interrupted){
        // 중단된 지점(실패한 페이지의 토큰)을 저장해 다음 동기화 때 여기부터 이어서 더 과거로 계속 파고든다
        if(resumeToken)localStorage.setItem(resumeKey,resumeToken);
        setProg(`${prefix} 중단됨(다음 동기화 때 이어받음) — 지금까지 +${vids.length}개`);
      }
    }catch(e){
      errors++;
      console.error(`[ext sync] ${ch.name}`,e);
      setProg(`${prefix} 오류: ${e.message}`);
      await new Promise(r=>setTimeout(r,800));
    }
  }
  setProg(`전체 완료 — 공식·외부 채널 합산 추가 ${totalAdded}개 / 스킵 ${totalSkipped}개${errors?` / 오류 ${errors}건`:''}`);
  _extSyncing=false;
}

// ── 과거 영상 백필(search API) ── playlistItems(업로드 목록 순서대로 훑기)는 아주 큰 채널(수만 개)에서
// API 자체가 일정 깊이 이상 못 내려가는 한계가 있어(예: 실제 3.2만 개인 채널인데 API가 2만 개라고만 보고),
// 아무리 재시도해도 오래된 옛날 무대까지 절대 못 닿는 경우가 있었음. search API는 channelId+날짜 구간으로
// 바로 그 시기를 지정해 가져올 수 있어 이 한계를 우회하지만, 호출당 쿼터가 100배 비싸서(playlistItems 1
// 대비 100) 평소 "전체 동기화"엔 안 넣고 필요할 때 채널+연도 구간을 지정해 따로 돌리는 별도 기능으로 둔다.
let _backfilling=false;
// 채널 하나를 지정한 호출 예산(callBudget) 안에서만 백필하는 공용 코어 — 단일 채널용 버튼과
// "여러 채널 순서대로" 버튼이 둘 다 이걸 재사용한다(여러 채널 버튼은 예산을 채널끼리 나눠 씀).
// query(그룹명 등 검색어)가 있으면 순수 channelId+날짜 필터 대신 실제 텍스트 검색(q=)을 같이 건다.
// search.list는 q 없이 channelId+날짜만으로 필터링하면 완전한 열거를 보장하지 않는 것으로 보임
// (M2처럼 업로드가 극단적으로 많은 채널에서, 분명 존재하는 영상인데도 그 구간이 totalResults:0으로
// 통째로 안 잡히는 게 실측으로 확인됨 — 이 자체가 유튜브 쪽 한계라 채널+날짜만으론 못 고침).
// q를 같이 넣으면 실제 검색엔진 인덱스를 타서 훨씬 안정적으로 잡힌다는 게 흔히 보고되는 우회법이라
// 채널 전체 백필과 별개로, 그룹명으로 좁혀 찾는 옵션을 추가함 — query가 비면 기존 동작 그대로.
async function _ytBackfillChannelCore(ch,fromYear,toYear,callBudget,onProg,query){
  const key=_ytApiKey();
  const resumeKey=`kpu_backfill_${ch.handle}_${fromYear}_${toYear}`+(query?`_q_${query}`:'');
  const channelId=await _ytGetChannelId(ch.url,key);
  const publishedAfter=`${fromYear}-01-01T00:00:00Z`;
  const publishedBefore=`${toYear}-12-31T23:59:59Z`;
  // 지난번에 이 채널+연도 구간(+검색어)에서 중단된 지점이 있으면 처음이 아니라 거기서부터 이어받는다
  let pageToken=localStorage.getItem(resumeKey)||'';
  let added=0,skipped=0,calls=0,done=false;
  do{
    if(calls>=callBudget)break; // done=false 상태로 빠져나감 → 호출부가 중단 처리(체크포인트 저장)
    let d;
    try{
      const url=`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&publishedAfter=${publishedAfter}&publishedBefore=${publishedBefore}&maxResults=50&key=${key}`+(query?`&q=${encodeURIComponent(query)}`:'')+(pageToken?'&pageToken='+pageToken:'');
      // 한때 429(rateLimitExceeded)를 지수 백오프(2/4/8초)로 최대 3번 재시도했는데, 실측해보니 429가
      // 걸린 상황 자체가 그정도 대기로는 잘 안 풀려서 "+0개"는 그대로인 채 재시도 대기 시간만 누적돼
      // 백필이 전체적으로 느려지기만 했음(2026-08-06, 사용자 제보) — 그래서 재시도 없이 원래처럼 1번만
      // 시도하고 바로 다음으로 넘어가게 되돌림. 아래 진단 로그(상태/사유)는 시간 비용이 없으므로 유지 —
      // 쿼터초과(403)인지 진짜 빈 구간인지는 이걸로 여전히 구분 가능.
      const r=await fetch(url);
      // 예전엔 !r.ok면 응답 바디를 읽지도 않고 바로 던져서, quotaExceeded 같은 실제 에러 사유(d.error.errors[0].reason)가
      // 콘솔에 전혀 안 남았음 — 0개로 끝나는 백필이 "쿼터 초과라 그런 건지, 진짜 그 구간에 영상이 없는 건지"
      // 구분이 안 되던 원인(2026-08-06, 사용자 요청으로 진단 로그 추가). 상태 코드와 무관하게 항상 바디를 먼저
      // 읽고, 실제 API 응답 전체를 콘솔에 남긴 뒤에 에러 여부를 판단한다.
      d=await r.json().catch(()=>null);
      if(!r.ok||d?.error){
        const reason=d?.error?.errors?.[0]?.reason;
        console.error(`[백필] ${ch.name} API 오류 — status:${r.status}, reason:${reason||'(없음)'}, 응답:`,d);
        throw new Error(d?.error?.message||('YouTube API 오류 '+r.status));
      }
      // 정상 응답인데 결과가 비어있는 경우 — totalResults까지 같이 남겨서 "이 구간엔 진짜 없음"인지
      // "필터 조건이 뭔가 어긋나서 못 찾음"인지 나중에 구분할 수 있게 함.
      if(!d?.items?.length){
        console.log(`[백필] ${ch.name} 빈 응답 — pageInfo:`,d?.pageInfo,`| 요청 구간: ${fromYear}~${toYear}`+(query?`, q="${query}"`:''));
      }
    }catch(e){
      console.error(`[백필] ${ch.name} 검색 실패, 다음에 이어받음:`,e.message);
      break; // pageToken은 방금 실패한 페이지를 그대로 가리키므로 다음 호출에 그대로 넘기면 이어서 받음
    }
    calls++;
    const vids=[];
    for(const item of(d?.items||[])){
      const vid=item.id?.videoId;
      if(!vid)continue;
      const title=_decodeHtmlEntities(item.snippet.title||'');
      if(_isBannedVideoTitle(title))continue; // 성범죄로 퇴출된 인물 관련 영상은 백필 단계에서부터 저장하지 않음
      const th=item.snippet.thumbnails||{};
      // 쇼츠는 세로 비율을 유지하는 썸네일(medium/default는 항상 16:9로 잘려있어 세로 판별 불가)이
      // 필요해서 maxres/standard/high 중 하나를 봐야 하는데, 우선순위를 maxres부터 두면 저장되는
      // thumb URL 자체가 무겁고(용량 큼) 탐험 탭처럼 여러 개를 한 번에 보여주는 화면에서 로딩이
      // 느려지는 원인이 됨(2026-08-10, 사용자 제보). high(480x360)부터 우선하도록 뒤집음 — 세로
      // 판별에는 어차피 다 같은 비율이라 영향 없고, 용량만 가벼워짐.
      const hiTh=th.high||th.standard||th.maxres;
      const isShortThumb=!!(hiTh&&hiTh.height>hiTh.width);
      // 세로 여부는 category가 아니라 is_short 플래그로 나간다(2026-08-27 직교화). 동기화 시점
      // 썸네일 비율(isShortThumb)은 원리적으로 거의 항상 false지만, 제목의 #shorts 표기는 잡을 수 있어
      // 둘을 OR로 묶는다 — 진짜 판별은 관리자 '가로→쇼츠 일괄 승격' 스윕이 oardefault 실측으로 한다.
      const cat=_ytClassify(title);
      const isShort=isShortThumb||_ytIsShortTitle(title);
      if(cat==='skip')continue;
      vids.push({
        id:vid,title,description:_decodeHtmlEntities(item.snippet.description||''),
        thumb:isShortThumb?(hiTh.url||th.medium?.url||''):(th.medium?.url||th.high?.url||th.default?.url||''),
        published_at:(item.snippet.publishedAt||'').slice(0,10),category:cat,is_short:isShort
      });
    }
    if(vids.length){
      const{rows,skipped:sk}=_extBuildRows(vids,_EXT_STRICT_TIERS.has(ch.tier),ch.tier,ch.owner,ch.defaultCategory,ch.handle);
      skipped+=sk;
      if(rows.length){
        for(let i=0;i<rows.length;i+=200){
          const{error}=await _ytUpsertVideos(rows.slice(i,i+200),{onConflict:'id',ignoreDuplicates:true});
          if(error)throw new Error(error.message);
        }
        added+=rows.length;
      }
    }
    pageToken=d?.nextPageToken||'';
    if(!pageToken)done=true;
    if(onProg)onProg({added,skipped,calls});
    if(pageToken)await new Promise(res=>setTimeout(res,150));
  }while(pageToken);
  if(done)localStorage.removeItem(resumeKey); // 채널 끝까지 도달 — 이 구간은 이제 이어받을 것 없음
  else if(pageToken)localStorage.setItem(resumeKey,pageToken); // 중단 지점 저장 — 다음 실행 때 여기서 이어받음
  return{added,skipped,calls,done};
}
async function _ytBackfillByDateRange(handle,fromYear,toYear,query){
  if(_backfilling)return;
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const ch=_EXT_CHANNELS.find(c=>c.handle===handle);
  if(!ch){_ytSetProg('채널을 찾을 수 없음');return;}
  if(!fromYear||!toYear||fromYear>toYear){_ytSetProg('연도 범위를 올바르게 입력해주세요 (시작연도 ≤ 끝연도)');return;}
  _backfilling=true;
  const btn=document.getElementById('sp-yt-backfill-btn');
  if(btn)btn.disabled=true;
  const label=query?`${ch.name}(검색어:${query})`:ch.name;
  try{
    _ytSetProg(`[백필] ${label} 채널 정보 확인 중…`);
    const CALL_CAP=90; // 호출당 100유닛 — 하루 무료 쿼터(10,000) 중 이 기능에 쓸 안전선(나머지는 일반 동기화용으로 남김)
    const result=await _ytBackfillChannelCore(ch,fromYear,toYear,CALL_CAP,p=>{
      _ytSetProg(`[백필] ${label} ${fromYear}~${toYear} — 검색 ${p.calls}회째 (+${p.added}개, 스킵 ${p.skipped}개)`);
    },query);
    _ytSetProg(result.done
      ?`[백필] 완료! ${label} ${fromYear}~${toYear} — 총 +${result.added}개 (스킵 ${result.skipped}개)`
      :`[백필] 이번엔 여기까지(다음에 이어받음) — ${label} ${fromYear}~${toYear}, +${result.added}개 (스킵 ${result.skipped}개)`);
  }catch(e){
    _ytSetProg('[백필] 오류: '+e.message);
  }finally{
    _backfilling=false;
    if(btn)btn.disabled=false;
  }
}
// 뮤직뱅크·인기가요처럼 아주 큰(2만 개 이상) 음악방송 채널 6개를 우선순위로 지정 — 순서대로 예산을
// 나눠 쓰며 진행하고, 이미 이어받는 중인 채널을 맨 앞으로 당겨서 골고루 진행되게 한다.
const _BACKFILL_PRIORITY_HANDLES=['MnetM2','Mnet','KBSKpop','MBCkpop','SBSKPOP','ALLTHEKPOP'];
async function _ytBackfillPriorityChannels(fromYear,toYear,query){
  if(_backfilling)return;
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  if(!fromYear||!toYear||fromYear>toYear){_ytSetProg('연도 범위를 올바르게 입력해주세요 (시작연도 ≤ 끝연도)');return;}
  _backfilling=true;
  const btn=document.getElementById('sp-yt-backfill-priority-btn');
  if(btn)btn.disabled=true;
  try{
    const channels=_BACKFILL_PRIORITY_HANDLES.map(h=>_EXT_CHANNELS.find(c=>c.handle===h)).filter(Boolean);
    const qSuffix=query?`_q_${query}`:'';
    // 지난번에 중단된(이어받을 게 있는) 채널을 앞으로 당겨서, 아직 시작도 안 한 채널만 계속 밀리지 않게 함
    channels.sort((a,b)=>{
      const aR=localStorage.getItem(`kpu_backfill_${a.handle}_${fromYear}_${toYear}${qSuffix}`)?1:0;
      const bR=localStorage.getItem(`kpu_backfill_${b.handle}_${fromYear}_${toYear}${qSuffix}`)?1:0;
      return bR-aR;
    });
    const TOTAL_BUDGET=90; // 하루 무료 쿼터 안전선을 6개 채널이 나눠 씀 — 한 번에 다 안 끝나고 여러 번에 걸쳐 진행됨
    let remaining=TOTAL_BUDGET;
    const summary=[];
    for(const[idx,ch] of channels.entries()){
      if(remaining<=0)break;
      // 채널 사이에 짧게 쉬어줌 — 예전엔 채널이 끝나자마자 바로 다음 채널을 호출해서, 한 채널에서 429(요청
      // 과다)가 나면 남은 채널이 전부 도미노로 같이 429나는 문제가 있었음(2026-08-06, 사용자 제보로 발견
      // — 엠넷/뮤직뱅크/쇼음악중심 연쇄 429). 첫 채널은 바로 시작해도 되므로 idx>0일 때만 대기.
      if(idx>0)await new Promise(res=>setTimeout(res,1200));
      _ytSetProg(`[6채널 백필] ${ch.name} 시작… (남은 예산 ${remaining}회)`);
      // 채널 하나가 실패해도(채널ID 조회 실패 등) 나머지 채널은 계속 진행해야 하므로 채널별로 개별 처리 —
      // 예전엔 여기에 try/catch가 없어서 첫 채널이 실패하면 전체가 즉시 중단되고 나머지는 시도조차 안 됐음.
      try{
        const result=await _ytBackfillChannelCore(ch,fromYear,toYear,remaining,p=>{
          _ytSetProg(`[6채널 백필] ${ch.name} ${fromYear}~${toYear} — 검색 ${p.calls}회째 (+${p.added}개)`);
        },query);
        remaining-=result.calls;
        summary.push(`${ch.name} +${result.added}${result.done?'✓완료':'(이어받을 예정)'}`);
      }catch(e){
        console.error(`[6채널 백필] ${ch.name} 실패:`,e.message);
        summary.push(`${ch.name} 오류(${e.message})`);
      }
    }
    _ytSetProg(`[6채널 백필] ${summary.join(' / ')}`);
  }catch(e){
    _ytSetProg('[6채널 백필] 오류: '+e.message);
  }finally{
    _backfilling=false;
    if(btn)btn.disabled=false;
  }
}

// ── URL로 영상 직접 추가 ── 자동 동기화(채널 훑기)로 안 잡히는 특정 영상 하나를 수동으로 넣고 싶을 때 씀.
// 같은 yt_channel_videos 테이블에 저장되므로, 어느 채널에서 왔든 그룹/멤버 카드의 영상 그리드에서
// 자동 동기화된 다른 영상들과 자연스럽게 섞여서 노출된다(별도 취급 없음).
function _ytParseVideoId(input){
  const t=(input||'').trim();
  const m=t.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  if(m)return m[1];
  if(/^[a-zA-Z0-9_-]{11}$/.test(t))return t; // URL 없이 영상 ID만 붙여넣은 경우
  return null;
}
// videoId 하나를 조회해서 DB에 저장할 row를 만드는 공용 코어 — 단일 추가 버튼과 일괄(여러 개) 추가
// 버튼이 둘 다 이걸 재사용한다. manualGroup/manualMembers는 자동인식이 틀렸을 때 덮어쓸 값(둘 다 선택사항).
async function _ytBuildManualVideoRow(key,vid,manualGroup,manualMembers){
  const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${vid}&key=${key}`);
  if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
  const d=await r.json();
  if(d.error)throw new Error(d.error.message);
  const item=d.items?.[0];
  if(!item)throw new Error('영상을 찾을 수 없어요(비공개/삭제됐을 수 있음)');
  const title=_decodeHtmlEntities(item.snippet.title||'');
  if(_isBannedVideoTitle(title))throw new Error('제외 대상 인물이 언급된 영상이라 추가할 수 없어요');
  const th=item.snippet.thumbnails||{};
  const hiTh=th.high||th.standard||th.maxres; // 세로 판별용, 가벼운 순으로(2026-08-10, 위 동기화 루프와 동일 이유)
  const isShortThumb=!!(hiTh&&hiTh.height>hiTh.width);
  let category=_ytClassify(title);
  const isShort=isShortThumb||_ytIsShortTitle(title); // 세로는 category가 아닌 is_short 플래그로(2026-08-27 직교화)
  if(category==='skip')category='other'; // 수동으로 콕 집어 추가하는 거라 티저/음원이어도 그냥 기타로 저장(스킵하지 않음)
  const thumb=isShortThumb?(hiTh.url||th.medium?.url||''):(th.medium?.url||th.high?.url||th.default?.url||'');
  const publishedAt=(item.snippet.publishedAt||'').slice(0,10);
  let groupKo=null,members=[],withGroups=[],withMembers=[];
  if(manualGroup){
    if(!GROUPS[manualGroup])throw new Error(`"${manualGroup}"는 등록된 그룹명이 아니에요(정확한 한글 그룹명을 입력해주세요)`);
    groupKo=manualGroup;
    // 입력한 그룹 기준으로 제목에서 멤버만 추가로 추출(그룹 자체는 이미 확정이므로 매칭 결과 무관하게 그대로 씀)
    const match=_m2ParseTitle(title);
    if(match)members=match.membersByGroup[groupKo]||[];
  }else{
    const match=_m2ParseTitle(title);
    if(!match)throw new Error('제목에서 그룹을 자동으로 인식하지 못했어요 — "그룹명" 칸에 직접 입력하고 다시 시도해주세요');
    groupKo=match.primaryGroup;
    members=match.membersByGroup[groupKo]||[];
    for(const gko of match.withGroups){
      const sec=match.membersByGroup[gko]||[];
      const{asGroup,extraMembers}=_classifyGuestGroup(sec,gko);
      if(asGroup)withGroups.push(gko);
      extraMembers.forEach(mko=>withMembers.push(`${mko}(${gko})`));
    }
    ({withGroups,withMembers}=_normalizeMemberTags({title,groupKo,members,withGroups,withMembers})); // 겸임 중복 제거
  }
  // 제목에 멤버 이름이 안 그대로 실려있거나(별명·영문 표기 등) 자동 인식이 틀렸을 때, 직접 입력한
  // 멤버명으로 덮어씀 — 해당 그룹의 실제 멤버인지 검증해서 오타로 엉뚱한 이름이 들어가는 걸 막는다.
  if(manualMembers&&manualMembers.length){
    const groupMemberKos=new Set(ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===groupKo)).map(a=>a.name.ko));
    const invalid=manualMembers.filter(mko=>!groupMemberKos.has(mko));
    if(invalid.length)throw new Error(`"${invalid.join(', ')}"는 ${groupKo}의 등록된 멤버명이 아니에요(정확한 한글 이름을 입력해주세요)`);
    members=manualMembers;
  }
  const description=item.snippet.description||'';
  return{id:vid,title,title_norm:_titleNorm(title),description,thumb,published_at:publishedAt,category,is_short:isShort,group_ko:groupKo,members,with_groups:withGroups,with_members:withMembers};
}
// 이미 존재하는 행이 tags_manual=true(관리자가 태그 모달에서 직접 확정)면, 수동 추가가 upsert로
// 그 위를 덮어써버리는 사고를 막기 위한 사전 체크 — 재백필 등으로 같은 id가 다시 들어올 때 특히 위험.
async function _ytExistingTagsManual(vid){
  const{data}=await sb.from(_YT_TABLE).select('tags_manual').eq('id',vid).maybeSingle();
  return!!data?.tags_manual;
}
async function _ytAddVideoByUrl(){
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const urlEl=document.getElementById('sp-yt-manual-url');
  const groupEl=document.getElementById('sp-yt-manual-group');
  const membersEl=document.getElementById('sp-yt-manual-members');
  const btn=document.getElementById('sp-yt-manual-add-btn');
  const vid=_ytParseVideoId(urlEl?.value);
  if(!vid){_ytSetProg('유튜브 URL(또는 영상 ID)을 올바르게 입력해주세요');return;}
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[영상 추가] 정보 조회 중…');
    const manualGroup=(groupEl?.value||'').trim();
    const manualMembers=(membersEl?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    if(await _ytExistingTagsManual(vid)){
      _ytSetProg('[영상 추가] 건너뜀 — 이미 관리자가 직접 확정한 태그가 있는 영상이에요(고치려면 ✎ 편집 버튼 사용)');
      return;
    }
    const row=await _ytBuildManualVideoRow(key,vid,manualGroup,manualMembers);
    const{error}=await sb.from(_YT_TABLE).upsert(row,{onConflict:'id'});
    if(error)throw new Error(error.message);
    _ytSetProg(`[영상 추가] 완료! "${_cleanTitle(row.title)}" → ${row.group_ko}${row.members.length?' / '+row.members.join(', '):''}`);
    if(urlEl)urlEl.value='';
    if(groupEl)groupEl.value='';
    if(membersEl)membersEl.value='';
  }catch(e){
    _ytSetProg('[영상 추가] 오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}
let _manualBatchAdding=false;
async function _ytAddVideosBatch(){
  if(_manualBatchAdding)return;
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const batchEl=document.getElementById('sp-yt-manual-urls-batch');
  const groupEl=document.getElementById('sp-yt-manual-group');
  const membersEl=document.getElementById('sp-yt-manual-members');
  const btn=document.getElementById('sp-yt-manual-batch-add-btn');
  const lines=(batchEl?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!lines.length){_ytSetProg('붙여넣은 URL이 없어요');return;}
  const manualGroup=(groupEl?.value||'').trim();
  const manualMembers=(membersEl?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  _manualBatchAdding=true;
  if(btn)btn.disabled=true;
  let ok=0,fail=0,skipped=0;
  const failLines=[];
  try{
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      _ytSetProg(`[일괄 추가] ${i+1}/${lines.length}개째 처리 중… (성공 ${ok} / 건너뜀 ${skipped} / 실패 ${fail})`);
      const vid=_ytParseVideoId(line);
      if(!vid){fail++;failLines.push(`${line} (URL 인식 실패)`);continue;}
      try{
        if(await _ytExistingTagsManual(vid)){skipped++;continue;} // 이미 관리자가 직접 확정한 태그는 덮어쓰지 않음
        const row=await _ytBuildManualVideoRow(key,vid,manualGroup,manualMembers);
        const{error}=await sb.from(_YT_TABLE).upsert(row,{onConflict:'id'});
        if(error)throw new Error(error.message);
        ok++;
      }catch(e){
        fail++;failLines.push(`${line} (${e.message})`);
      }
      if(i<lines.length-1)await new Promise(res=>setTimeout(res,150)); // API 호출 간 살짝 텀
    }
    _ytSetProg(`[일괄 추가] 완료 — 성공 ${ok}개 / 이미 확정돼 건너뜀 ${skipped}개 / 실패 ${fail}개`+(failLines.length?` (실패: ${failLines.slice(0,5).join(' / ')}${failLines.length>5?' 외 '+(failLines.length-5)+'건':''})`:''));
    if(ok>0&&batchEl)batchEl.value=failLines.length?failLines.map(f=>f.split(' (')[0]).join('\n'):'';
  }finally{
    _manualBatchAdding=false;
    if(btn)btn.disabled=false;
  }
}

let _vidTagTarget=null;
let _vidTagBulkIds=null; // 일괄 편집 모드일 때만 채워지는 영상 id 배열(null이면 단일 영상 모드)
let _vidTagWithSelected=[]; // [{ko,groupKo}] — 타 그룹 멤버 검색/선택 결과
let _vidTagGroupsSelected=[]; // [groupKo,...] — "아이유의 팔레트, 뉴진스편"처럼 그룹 전체가 출연할 때(with_groups)
let _vidTagCoverSelected=[]; // [{ko,groupKo}] — 커버 영상의 원곡자(멤버) 지정
let _vidTagCoverGroupsSelected=[]; // [groupKo,...] — 원곡이 그룹 단위 곡일 때
let _vidTagOrigManual=false; // DB에서 불러온 기존 tags_manual 값 — 트리거 우회 two-step 저장에 사용
let _vidTagBefore=null; // 모달 열 때 DB에서 읽은 태그 원본 — 저장 시 편집 이력(tag_edit_log)의 before로 씀
let _vidTagLoadedFormats=[]; // 모달 열 때 DB에서 읽은 content_formats — 저장 시 장르 태그 재계산에 사용
// content_flag는 한 컬럼에 한 값만 들어가므로(null/기타/외부인/무관/hidden 중 하나) 체크박스 2개(기타/외부인)와
// 토글 버튼 2개(무관/숨김)를 하나의 배타적 선택으로 묶어서 관리한다 — 예전엔 "숨김"만 별도 버튼으로 즉시
// DB에 반영되고 나머지 셋은 저장 버튼을 눌러야 반영되는 등 취급이 달라서(2026-08-04, 사용자 피드백:
// 무관/숨김의 "정도"가 안 맞음) 넷 다 저장 버튼을 눌러야 반영되는 걸로 통일했다.
let _vidTagFlagChoice=null; // null | '기타' | '외부인' | '개별출연' | '무관' | '보류' | 'hidden'
// 일괄 편집에서 "아무 플래그도 안 건드림"과 "명시적으로 정상으로 되돌림"을 구분하기 위한 플래그 —
// 넷 중 하나라도 클릭하면 true가 돼서, 저장 시 선택 안 된 영상들의 기존 content_flag까지 건드리지 않던
// 기존 동작을 그대로 유지한다.
let _vidTagFlagTouched=false;
// 세로(쇼츠) 플래그도 같은 이유로 "안 건드림 / 켬 / 끔" 3상태가 필요하다 — 일괄 편집에서 체크박스를
// 한 번도 안 건드렸으면 선택한 영상들의 기존 is_short를 그대로 둬야 한다(2026-08-27).
let _vidTagShortTouched=false;
function _vidTagBindShortCheckbox(){
  const el=document.getElementById('vid-tag-isshort');
  if(!el||el._bound)return;
  el._bound=true;
  el.addEventListener('change',()=>{_vidTagShortTouched=true;});
}
function _vidTagApplyFlagUI(){
  const etcEl=document.getElementById('vid-tag-flag-etc');
  const extEl=document.getElementById('vid-tag-flag-ext');
  const indivEl=document.getElementById('vid-tag-flag-indiv');
  const nomemBtn=document.getElementById('vid-tag-flag-nomem-btn');
  const holdBtn=document.getElementById('vid-tag-flag-hold-btn');
  const hiddenBtn=document.getElementById('vid-tag-flag-hidden-btn');
  if(etcEl)etcEl.checked=_vidTagFlagChoice==='기타';
  if(extEl)extEl.checked=_vidTagFlagChoice==='외부인';
  if(indivEl)indivEl.checked=_vidTagFlagChoice==='개별출연';
  if(nomemBtn)nomemBtn.classList.toggle('active',_vidTagFlagChoice==='무관');
  if(holdBtn)holdBtn.classList.toggle('active',_vidTagFlagChoice==='보류');
  if(hiddenBtn)hiddenBtn.classList.toggle('active',_vidTagFlagChoice==='hidden');
}
function _vidTagSetFlagChoice(v){
  _vidTagFlagTouched=true;
  _vidTagFlagChoice=(_vidTagFlagChoice===v)?null:v;
  _vidTagApplyFlagUI();
}
function _renderVidTagChips(){
  const chipsEl=document.getElementById('vid-tag-with-chips');
  chipsEl.innerHTML='';
  _vidTagWithSelected.forEach((m,i)=>{
    const chip=document.createElement('span');
    chip.className='vid-tag-chip';
    chip.appendChild(document.createTextNode(`${m.ko}(${m.groupKo})`));
    const rm=document.createElement('button');
    rm.type='button';rm.textContent='✕';rm.setAttribute('aria-label','제거');
    rm.addEventListener('click',e=>{e.stopPropagation();_vidTagWithSelected.splice(i,1);_renderVidTagChips();});
    chip.appendChild(rm);
    chipsEl.appendChild(chip);
  });
  _vidTagGroupsSelected.forEach((gko,i)=>{
    const chip=document.createElement('span');
    chip.className='vid-tag-chip vid-tag-chip-group';
    chip.appendChild(document.createTextNode(`${gko} (그룹 전체)`));
    const rm=document.createElement('button');
    rm.type='button';rm.textContent='✕';rm.setAttribute('aria-label','제거');
    rm.addEventListener('click',e=>{e.stopPropagation();_vidTagGroupsSelected.splice(i,1);_renderVidTagChips();});
    chip.appendChild(rm);
    chipsEl.appendChild(chip);
  });
  const coverChipsEl=document.getElementById('vid-tag-cover-chips');
  coverChipsEl.innerHTML='';
  _vidTagCoverSelected.forEach((m,i)=>{
    const chip=document.createElement('span');
    chip.className='vid-tag-chip vid-tag-chip-cover';
    chip.appendChild(document.createTextNode(`원곡: ${m.ko}(${m.groupKo})`));
    const rm=document.createElement('button');
    rm.type='button';rm.textContent='✕';rm.setAttribute('aria-label','제거');
    rm.addEventListener('click',e=>{e.stopPropagation();_vidTagCoverSelected.splice(i,1);_renderVidTagChips();});
    chip.appendChild(rm);
    coverChipsEl.appendChild(chip);
  });
  _vidTagCoverGroupsSelected.forEach((gko,i)=>{
    const chip=document.createElement('span');
    chip.className='vid-tag-chip vid-tag-chip-cover';
    chip.appendChild(document.createTextNode(`원곡: ${gko} (그룹 전체)`));
    const rm=document.createElement('button');
    rm.type='button';rm.textContent='✕';rm.setAttribute('aria-label','제거');
    rm.addEventListener('click',e=>{e.stopPropagation();_vidTagCoverGroupsSelected.splice(i,1);_renderVidTagChips();});
    chip.appendChild(rm);
    coverChipsEl.appendChild(chip);
  });
}
// 소속 그룹 드롭다운(datalist) 채우기 — GROUPS는 런타임에 안 바뀌므로 모달을 처음 열 때 한 번만 채운다.
let _vidTagGroupListBuilt=false;
// 아이유처럼 소속 그룹이 없는(GROUPS에 없는) 솔로 아티스트, 또는 효연처럼 실제 그룹 소속이 있어도
// 개인 채널(artists.json channels[])을 따로 두는 멤버는 group_ko로 등록된 그룹명이 아니라 본인
// 이름을 그대로 씀(_ytGroupKoFor 참고, 채널 동기화 키와 동일한 규칙) — "솔로 태그"(artists.json의
// group.ko="솔로")는 여러 명이 공유하는 가짜 값이라 그대로 쓰면 안 됨.
function _isValidVidGroupKo(gko){return!!GROUPS[gko]||ARTISTS.some(a=>a.name.ko===gko&&(!GROUPS[a.group.ko]||a.channels?.length));}
function _ensureVidTagGroupList(){
  if(_vidTagGroupListBuilt)return;
  _vidTagGroupListBuilt=true;
  const dl=document.getElementById('vid-tag-group-list');
  const soloNames=[...new Set(ARTISTS.filter(a=>!GROUPS[a.group.ko]||a.channels?.length).map(a=>a.name.ko))];
  const options=[...Object.keys(GROUPS),...soloNames].sort((a,b)=>a.localeCompare(b,'ko'));
  dl.innerHTML=options.map(ko=>`<option value="${ko}"></option>`).join('');
}
// 체크박스 목록을 gko 기준으로 새로 그린다 — 단일/일괄 모달이 공용으로 쓰고, "소속 그룹" 필드를 완전히
// 다른 그룹으로 바꿨을 때도 이걸로 다시 그려서 새 그룹의 멤버 목록이 뜨게 한다(그동안 체크했던 건
// 어차피 잘못된 그룹 기준이었으므로 전부 미체크로 리셋).
let _vidTagRenderedGko=null;
function _renderVidTagMemberCheckboxes(gko,{soloAutoCheck=false,unitGuess=null,savedMembers=null}={}){
  _vidTagRenderedGko=gko;
  const membersEl=document.getElementById('vid-tag-members');
  membersEl.innerHTML='';
  const groupMembers=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko));
  groupMembers.forEach(a=>{
    const label=document.createElement('label');
    label.className='vid-tag-mem';
    const cb=document.createElement('input');
    cb.type='checkbox';cb.value=a.name.ko;
    if(soloAutoCheck||unitGuess?.has(a.name.ko)||savedMembers?.has(a.name.ko))cb.checked=true;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(a.name.ko));
    // ⚑ 오태깅 규칙 등록(2026-08-30) — 이 이름이 흔한 단어라 무관 영상에 붙는 경우, 체크 해제하고 여기서
    // 바로 "해시태그만 인정" 규칙 등록 + 그 이름 한정 재검증(발견→규칙→청소를 이 자리에서).
    const flag=document.createElement('span');
    flag.className='vid-tag-rule-flag';flag.textContent='⚑';
    flag.title='이 이름이 흔한 단어라 오태깅되면: 규칙 등록(해시태그만) + 재검증';
    flag.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();_atmMemberRuleFlow(a.name.ko);});
    label.appendChild(flag);
    membersEl.appendChild(label);
  });
}
document.getElementById('vid-tag-members-all')?.addEventListener('click',e=>{
  e.stopPropagation();
  document.querySelectorAll('#vid-tag-members input[type=checkbox]').forEach(cb=>{cb.checked=true;});
});
document.getElementById('vid-tag-group-ko')?.addEventListener('change',e=>{
  const gko=e.target.value.trim();
  if(!gko||!_isValidVidGroupKo(gko)||gko===_vidTagRenderedGko)return;
  // 완전히 다른 그룹으로 옮기는 경우라, 기존 members 체크는 잘못된 그룹 기준이므로 새 그룹 멤버로만 다시 그림
  // (솔로 아티스트로 옮기면 로스터가 본인 하나도 없으니 자연히 빈 목록으로 그려짐 — 솔로 채널은 애초에
  // "출연 멤버" 체크가 필요 없음, _hasRealGroup 관련 기존 처리와 동일한 맥락).
  _renderVidTagMemberCheckboxes(gko);
});
// 관리자가 그리드에서 여러 영상을 선택(#admin-bulk-bar "편집")했을 때 쓰는 일괄 편집 모드.
// 단일 편집과 같은 모달을 재사용하되, 특정 영상 하나의 기존 태깅값을 불러오지 않고(영상마다 다를 수
// 있으므로) 빈 상태에서 시작 — 저장 시 "멤버/콜라보 태그도 덮어쓰기" 체크 여부로 members/with_members/
// with_groups를 건드릴지 말지 결정한다(끄면 포맷·플래그만 선택한 영상 전체에 적용, 기존 태그는 보존).
function _openVidTagModalBulk(ids,ko){
  _vidTagOrigManual=false;
  _vidTagTarget={id:null,ko};
  _vidTagBulkIds=[...ids];
  _vidTagWithSelected=[];
  _vidTagGroupsSelected=[];
  _vidTagCoverSelected=[];
  _vidTagCoverGroupsSelected=[];
  document.getElementById('vid-tag-title-text').textContent=`${ids.length}개 영상 일괄 편집`;
  document.getElementById('vid-tag-vidtitle').textContent='';
  document.getElementById('vid-tag-single-hint').style.display='none';
  const overwriteRow=document.getElementById('vid-tag-bulk-overwrite-row');
  overwriteRow.style.display='flex';
  document.getElementById('vid-tag-bulk-overwrite').checked=false;
  _ensureVidTagGroupList();
  document.getElementById('vid-tag-group-ko').value=ko;
  _renderVidTagMemberCheckboxes(ko);
  document.getElementById('vid-tag-with-search').value='';
  document.getElementById('vid-tag-with-results').innerHTML='';
  document.getElementById('vid-tag-cover-search').value='';
  document.getElementById('vid-tag-cover-results').innerHTML='';
  _renderVidTagChips();
  const catEl=document.getElementById('vid-tag-cat');
  if(catEl)catEl.value='';
  // 일괄 편집은 영상마다 기존 플래그가 다를 수 있어 빈 상태(미선택)로 시작 — touched는 false로 둬서
  // 아무 것도 안 누르면 저장 시 content_flag를 아예 건드리지 않는다(기존 태그 보존).
  _vidTagFlagChoice=null;_vidTagFlagTouched=false;_vidTagApplyFlagUI();
  _vidTagBindShortCheckbox();
  const shortEl0=document.getElementById('vid-tag-isshort');
  if(shortEl0)shortEl0.checked=false;
  _vidTagShortTouched=false;
  document.getElementById('vid-tag-status').textContent='';
  document.getElementById('vid-tag-overlay').classList.add('open');if(typeof _bringToFront==='function')_bringToFront(document.getElementById('vid-tag-overlay')); // 재생 플레이어 위에서 열어도 편집모달이 맨 위(z-index 시스템 통일, 2026-09-02)
}
async function _openVidTagModal(v,ko,originKo){
  // ko: 폼에 보여줄/저장할 소속 그룹(영상의 실제 group_ko) — originKo: 저장 후 어느 카드를 그 자리에서
  // 바로 고칠지(patchItem/reload 대상) 결정하는 "지금 보고 있던 카드"의 그룹. 멤버 카드가 다른 채널
  // 게스트 출연 영상까지 보여주는 경우 이 둘이 다를 수 있어서(성현 카드에 뜬 투바투 영상처럼) 분리했다 —
  // 안 그러면 폼엔 정확한 그룹이 뜨는데(ko) 저장 후엔 지금 보던 카드가 안 갱신되는 문제가 생김
  // (2026-08-04, 사용자 제보로 발견).
  _vidTagTarget={id:v.id,ko,originKo:originKo||ko};
  _vidTagBulkIds=null;
  _vidTagWithSelected=[];
  _vidTagGroupsSelected=[];
  _vidTagCoverSelected=[];
  _vidTagCoverGroupsSelected=[];
  document.getElementById('vid-tag-title-text').textContent='출연 멤버 지정';
  document.getElementById('vid-tag-single-hint').style.display='';
  document.getElementById('vid-tag-bulk-overwrite-row').style.display='none';
  document.getElementById('vid-tag-vidtitle').textContent=_cleanTitle(v.title);
  _ensureVidTagGroupList();
  document.getElementById('vid-tag-group-ko').value=ko;
  const groupMembers=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===ko));
  // 솔로 아티스트(체크박스가 본인 하나뿐)는 안 눌러도 항상 본인 출연이 자명하므로 기본 체크 — 실수로 안 누르면
  // members가 비어서 연결 카드용 콜라보 쿼리(ownQ)가 이 영상 자체를 못 찾는 문제가 있었음.
  const _soloChannel=groupMembers.length===1;
  // 세븐틴 "브이에잇"처럼 제목에 프로젝트 유닛명만 있고 개별 멤버 이름은 없는 자체 채널 영상은,
  // _m2ParseTitle(외부 채널 자동 태깅)과 별개로 이 모달에서도 유닛 멤버를 미리 체크해준다.
  const unitGuess=_unitMembersFromTitle(v.title,ko);
  _renderVidTagMemberCheckboxes(ko,{soloAutoCheck:_soloChannel,unitGuess});
  document.getElementById('vid-tag-with-search').value='';
  document.getElementById('vid-tag-with-results').innerHTML='';
  document.getElementById('vid-tag-cover-search').value='';
  document.getElementById('vid-tag-cover-results').innerHTML='';
  _renderVidTagChips();
  document.getElementById('vid-tag-status').textContent='불러오는 중…';
  document.getElementById('vid-tag-overlay').classList.add('open');if(typeof _bringToFront==='function')_bringToFront(document.getElementById('vid-tag-overlay')); // 재생 플레이어 위에서 열어도 편집모달이 맨 위(z-index 시스템 통일, 2026-09-02)
  // 카드에 넘어온 v에는 members/with_members가 안 실려있는 경우가 많아서(그룹 카드 그리드는 해당 컬럼을
  // 아예 select하지 않음), 모달을 열 때 저장된 값을 DB에서 직접 불러와 체크박스/칩에 반영한다.
  if(sb){
    const{data,error}=await sb.from(_YT_TABLE).select('group_ko,members,with_members,with_groups,cover_of_members,cover_of_groups,category,is_short,content_flag,tags_manual,content_formats').eq('id',v.id).maybeSingle();
    if(!_vidTagTarget||_vidTagTarget.id!==v.id)return; // 응답 오는 사이 모달이 닫히거나 다른 영상으로 전환됨
    if(!error&&data){
      const savedMembers=new Set(data.members||[]);
      // ⚠️ 이 모달의 '소속 그룹' 칸과 멤버 체크박스는 예전엔 **지금 보던 카드의 그룹(ko)** 으로 그렸다.
      // 그런데 members[]는 '그 행의 group_ko 그룹 안에서 누가 나오는가'라는 뜻이라, 영상의 실제
      // group_ko가 다르면 여기서 체크한 멤버가 어느 카드에서도 조회되지 않는다(멤버 카드 조건이
      // and(group_ko.eq.그룹, members.cs.{이름})). 게다가 저장 시 groupKoInput===ko면 group_ko를
      // 아예 안 써서, 화면엔 맞는 그룹이 떠 있는데 행은 옛 그룹 그대로 남았다 — 실측 고아 태그
      // 1,155개(수동 51개)가 이렇게 쌓였다(2026-08-27, 우즈/조승연 제보로 발견).
      // → 응답이 오면 **영상의 실제 소속**으로 폼을 맞추고, 카드 그룹과 다르면 눈에 띄게 알린다.
      const realGko=data.group_ko||ko;
      _vidTagTarget.realGko=realGko;
      const gkoField=document.getElementById('vid-tag-group-ko');
      const notice=document.getElementById('vid-tag-gko-notice');
      // 응답 오는 사이 관리자가 그룹 칸을 직접 만졌으면 그 선택을 존중하고 건드리지 않는다.
      const untouched=_vidTagRenderedGko===ko&&gkoField&&gkoField.value===ko;
      if(untouched&&realGko!==ko){
        gkoField.value=realGko;
        _renderVidTagMemberCheckboxes(realGko,{savedMembers});
        if(notice){
          notice.style.display='';
          notice.textContent='이 영상의 실제 소속은 "'+realGko+'"예요 (지금 보던 카드는 "'+ko+'"). '
            +'아래 멤버 체크는 '+realGko+' 기준으로 저장돼요 — '+ko+' 영상이 맞다면 이 칸을 "'+ko+'"으로 바꾸고 저장하세요.';
        }
      }else if(notice){notice.style.display='none';notice.textContent='';}
      // 아직 아무도 태깅 안 된(=관리자가 손댄 적 없는) 영상일 때만 유닛 추정치를 기본값으로 유지 —
      // 이미 저장된 태깅이 있으면(유닛 멤버를 일부러 뺐을 수도 있으니) DB 값을 그대로 따른다.
      const useGuess=savedMembers.size===0&&!_soloChannel;
      // 응답 오는 사이 관리자가 "소속 그룹"을 다른 그룹으로 이미 바꿨으면(체크박스가 새 그룹 기준으로
      // 다시 그려진 상태), 이 예전 그룹 기준 저장값을 덮어쓰지 않는다.
      if(_vidTagRenderedGko===ko)document.querySelectorAll('#vid-tag-members input[type=checkbox]').forEach(cb=>{
        cb.checked=_soloChannel||savedMembers.has(cb.value)||(useGuess&&unitGuess.has(cb.value));
      });
      _vidTagWithSelected=(data.with_members||[]).map(str=>{
        const m=str.match(/^(.*)\((.*)\)$/);
        return m?{ko:m[1],groupKo:m[2]}:null;
      }).filter(Boolean);
      _vidTagGroupsSelected=data.with_groups||[];
      _vidTagCoverSelected=(data.cover_of_members||[]).map(str=>{
        const m=str.match(/^(.*)\((.*)\)$/);
        return m?{ko:m[1],groupKo:m[2]}:null;
      }).filter(Boolean);
      _vidTagCoverGroupsSelected=data.cover_of_groups||[];
      _vidTagOrigManual=!!data.tags_manual;
      _vidTagLoadedFormats=data.content_formats||[];
      // 편집 이력용 원본 — 여기서 떠두지 않으면 저장 시점엔 이미 화면 값밖에 없어서 "뭘 고쳤는지"를 못 남긴다.
      _vidTagBefore={group_ko:data.group_ko,members:data.members||[],with_members:data.with_members||[],with_groups:data.with_groups||[],cover_of_members:data.cover_of_members||[],cover_of_groups:data.cover_of_groups||[],content_flag:data.content_flag||null,category:data.category||null,is_short:_isShortV(data)};
      _renderVidTagChips();
      const catEl=document.getElementById('vid-tag-cat');
      // category='short'는 직교화 전 레거시 — 장르 select엔 더 이상 short 옵션이 없으므로 빈 값으로
      // 보이게 두고(재추론 버튼이 따로 정리한다), 세로 여부는 아래 체크박스가 담당한다.
      if(catEl)catEl.value=(data.category==='short'?'':(data.category||''));
      _vidTagFlagChoice=data.content_flag||null;_vidTagFlagTouched=false;_vidTagApplyFlagUI();
      _vidTagBindShortCheckbox();
      const shortEl=document.getElementById('vid-tag-isshort');
      if(shortEl)shortEl.checked=_isShortV(data);
      _vidTagShortTouched=false;
    }
  }
  document.getElementById('vid-tag-status').textContent='';
}
// 편집 모달을 열기 전에 어떤 행이었는지 기억해뒀다가, 닫을 때 그 행만 다시 읽는다(2026-08-25).
// 예전엔 닫을 때마다 _vmLoad()로 탭 전체를 재조회했는데, 그룹배정 검수(3천 건)처럼 큰 탭에선 편집
// 한 번에 몇 초씩 처음부터 다시 긁어서 사실상 검수를 못 하는 상태였음(사용자 제보).
async function _vmRefreshRows(ids){
  if(!sb||!ids?.length)return false;
  const{data,error}=await sb.from(_YT_TABLE)
    .select('id,title,group_ko,thumb,content_flag,needs_review,category,is_short,members,with_members,with_groups,cover_of_members,cover_of_groups,tags_manual')
    .in('id',ids);
  if(error||!data)return false;
  const byId=new Map(data.map(r=>[r.id,r]));
  // 이 탭의 조건에서 벗어난 행(예: 검수 탭에서 승인돼 needs_review가 내려간 행)은 목록에서 뺀다.
  // 무관 처리는 '이 그룹배정이 틀렸다'는 판정이라 검수를 마친 것과 같다 — 편집 모달에서 무관으로
  // 바꾼 행이 목록에 그대로 남아 있던 문제(2026-08-27 제보). 조회 필터(_vmReviewQueueFilter)와 같은 기준.
  // _vmReviewQueueFilter(조회 조건)와 **같은 기준**이어야 한다 — 한쪽만 고치면 "편집하면 사라지는데
  // 탭을 다시 열면 되살아난다"(또는 그 반대)가 된다. tags_manual 조건도 같이 반영(2026-08-31).
  const stillFits=r=>_vmTab!=='review'||(r.needs_review===true&&r.content_flag!=='무관'&&!r.tags_manual);
  _vmRows=_vmRows.map(r=>byId.has(r.id)?{...r,...byId.get(r.id)}:r).filter(r=>!byId.has(r.id)||stillFits(r));
  _vmCacheSync();_vmCacheDropOthers(); // 방금 쓰기가 있었으므로 다른 탭 캐시는 못 믿는다
  _vmRenderVideoList();
  return true;
}
function _closeVidTagModal(){
  document.getElementById('vid-tag-overlay').classList.remove('open');
  const _editedIds=_vidTagBulkIds?[..._vidTagBulkIds]:(_vidTagTarget?.id?[_vidTagTarget.id]:[]);
  _vidTagTarget=null;
  _vidTagBulkIds=null;
  _vidTagOrigManual=false;
  _vidTagLoadedFormats=[];
  _vidTagBefore=null;
  _vidTagFlagChoice=null;_vidTagFlagTouched=false;_vidTagApplyFlagUI();
  // 영상 관리 패널이 열려있으면 방금 편집한 행만 갱신한다 — 탭 전체 재조회는 큰 탭(검수 3천 건)에서
  // 편집 한 번마다 몇 초씩 걸려 작업을 사실상 불가능하게 만들었음. 편집한 행을 못 찾은 경우에만
  // 예전처럼 전체 재조회로 폴백(1차 검색어는 그대로, 2차 검색어도 유지).
  if(document.getElementById('vm-overlay')?.classList.contains('open')){
    _vmRefreshRows(_editedIds).then(ok=>{if(!ok)_vmLoad(undefined,true);});
  }
}
document.getElementById('vid-tag-cancel').addEventListener('click',e=>{e.stopPropagation();_closeVidTagModal();});
document.getElementById('vid-tag-overlay').addEventListener('click',e=>{e.stopPropagation();if(e.target===e.currentTarget)_closeVidTagModal();});
document.getElementById('vid-tag-overlay').addEventListener('pointerdown',e=>e.stopPropagation());
// 완전히 일치하는 이름(특히 "혁"처럼 한 글자짜리 등록명)을 검색 결과 맨 앞으로 — 안 그러면 "도혁"/
// "준혁"처럼 부분 일치하는 다른 이름들이 8개 상한을 먼저 채워버려서 정작 정확히 찾던 사람이 목록에서
// 밀려나 안 보이는 문제가 있었음(2026-08-05, 사용자 제보 — "혁" 검색했는데 "혁(템페스트)"가 안 보임).
function _vidTagExactMatch(a,q,qLower){return a.name.ko===q||(a.name.en||'').toLowerCase()===qLower;}
document.getElementById('vid-tag-with-search').addEventListener('input',e=>{
  const q=e.target.value.trim();
  const resultsEl=document.getElementById('vid-tag-with-results');
  resultsEl.innerHTML='';
  if(!q||!_vidTagTarget)return;
  const already=new Set(_vidTagWithSelected.map(m=>m.ko+'|'+m.groupKo));
  const qLower=q.toLowerCase();
  // 아이유의 팔레트, 뉴진스편처럼 멤버 개개인이 아니라 그룹 전체가 출연하는 경우 — 그룹 이름째로 검색/선택
  // (한글 이름뿐 아니라 영문 이름으로도 검색 가능해야 함 — 관리자가 영문으로 검색해도 매칭 안 되던 버그 수정)
  const groupMatches=Object.keys(GROUPS).filter(gko=>
    (gko.includes(q)||(GROUPS[gko].en||'').toLowerCase().includes(qLower))&&gko!==_vidTagTarget.ko&&!_vidTagGroupsSelected.includes(gko)
  ).slice(0,4);
  groupMatches.forEach(gko=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt vid-tag-with-opt-group';
    opt.textContent=`${gko} (그룹 전체)`;
    opt.addEventListener('click',ev=>{
      ev.stopPropagation();
      _vidTagGroupsSelected.push(gko);
      _renderVidTagChips();
      e.target.value='';
      resultsEl.innerHTML='';
    });
    resultsEl.appendChild(opt);
  });
  // 완전히 일치하는 이름(특히 "혁"처럼 한 글자짜리 등록명)을 맨 앞으로 — 안 그러면 "도혁"/"준혁"처럼
  // 부분 일치하는 다른 이름들이 8개 상한을 먼저 채워버려서 정작 정확히 찾던 사람이 목록에서 밀려나
  // 안 보이는 문제가 있었음(2026-08-05, 사용자 제보 — "혁" 검색했는데 "혁(템페스트)"가 안 보임).
  const matches=ARTISTS.filter(a=>
    (a.name.ko.includes(q)||(a.name.en||'').toLowerCase().includes(qLower))&&
    !_artistGroups(a).some(g=>g.ko===_vidTagTarget.ko)&&
    !already.has(a.name.ko+'|'+a.group.ko)
  ).sort((a,b)=>(_vidTagExactMatch(b,q,qLower)?1:0)-(_vidTagExactMatch(a,q,qLower)?1:0)).slice(0,8);
  matches.forEach(a=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt';
    opt.textContent=`${a.name.ko} (${a.group.ko})`;
    opt.addEventListener('click',ev=>{
      ev.stopPropagation();
      _vidTagWithSelected.push({ko:a.name.ko,groupKo:a.group.ko});
      _renderVidTagChips();
      e.target.value='';
      resultsEl.innerHTML='';
    });
    resultsEl.appendChild(opt);
  });
});
_wireListKeyboardNav(document.getElementById('vid-tag-with-search'),document.getElementById('vid-tag-with-results'),'.vid-tag-with-opt');
// 원곡자 검색 — "함께한" 검색과 달리 이 영상 소속 그룹/멤버도 검색 대상에서 제외하지 않음(자기 채널에
// 자기 멤버 곡을 다른 그룹이 커버한 영상이면 원곡자가 바로 이 채널 소속 멤버인 경우가 흔함).
document.getElementById('vid-tag-cover-search').addEventListener('input',e=>{
  const q=e.target.value.trim();
  const resultsEl=document.getElementById('vid-tag-cover-results');
  resultsEl.innerHTML='';
  if(!q||!_vidTagTarget)return;
  const already=new Set(_vidTagCoverSelected.map(m=>m.ko+'|'+m.groupKo));
  const qLower=q.toLowerCase();
  const groupMatches=Object.keys(GROUPS).filter(gko=>
    (gko.includes(q)||(GROUPS[gko].en||'').toLowerCase().includes(qLower))&&!_vidTagCoverGroupsSelected.includes(gko)
  ).slice(0,4);
  // 프로젝트 유닛도 원곡자로 지정할 수 있게(2026-08-25, 사용자 요청 — "원곡자에 NCT U 추가"). 유닛은
  // groups.json에 없어서(행성 승격 안 함 원칙) 위 GROUPS 검색엔 절대 안 걸렸음. cover_of_groups에는
  // 유닛명을 그대로 넣고, 멤버 카드 커버 탭 하단(_loadCoverOfSection)이 그 멤버의 유닛명으로도 조회한다.
  const unitMatches=Object.keys(_PROJECT_UNITS).filter(uname=>
    (uname.toLowerCase().includes(qLower)||_PROJECT_UNITS[uname].names.some(n=>n.toLowerCase().includes(qLower)))
    &&!_vidTagCoverGroupsSelected.includes(uname)
  ).slice(0,3);
  unitMatches.forEach(uname=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt vid-tag-with-opt-group';
    opt.textContent=`${uname} (유닛 전체)`;
    opt.addEventListener('click',ev=>{
      ev.stopPropagation();
      _vidTagCoverGroupsSelected.push(uname);
      _renderVidTagChips();
      e.target.value='';
      resultsEl.innerHTML='';
    });
    resultsEl.appendChild(opt);
  });
  groupMatches.forEach(gko=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt vid-tag-with-opt-group';
    opt.textContent=`${gko} (그룹 전체)`;
    opt.addEventListener('click',ev=>{
      ev.stopPropagation();
      _vidTagCoverGroupsSelected.push(gko);
      _renderVidTagChips();
      e.target.value='';
      resultsEl.innerHTML='';
    });
    resultsEl.appendChild(opt);
  });
  const matches=ARTISTS.filter(a=>
    (a.name.ko.includes(q)||(a.name.en||'').toLowerCase().includes(qLower))&&
    !already.has(a.name.ko+'|'+a.group.ko)
  ).sort((a,b)=>(_vidTagExactMatch(b,q,qLower)?1:0)-(_vidTagExactMatch(a,q,qLower)?1:0)).slice(0,8);
  matches.forEach(a=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt';
    opt.textContent=`${a.name.ko} (${a.group.ko})`;
    opt.addEventListener('click',ev=>{
      ev.stopPropagation();
      _vidTagCoverSelected.push({ko:a.name.ko,groupKo:a.group.ko});
      _renderVidTagChips();
      e.target.value='';
      resultsEl.innerHTML='';
    });
    resultsEl.appendChild(opt);
  });
});
_wireListKeyboardNav(document.getElementById('vid-tag-cover-search'),document.getElementById('vid-tag-cover-results'),'.vid-tag-with-opt');

// ── 선택 영상 원곡 일괄 지정(교체) ─────────────────────────────────────────
// "선택-원곡제외"(cover_of를 []로 비움)의 반대 동작 — 선택한 여러 영상의 cover_of를 고른 원곡으로 SET
// 한다(2026-08-19, 사용자 요청). 영상마다 출연 멤버가 달라 벌크 편집 모달로는 멤버를 안 건드리고 원곡만
// 넣을 수 없었던 문제 해결. cover_of 컬럼은 tags_manual 보호 트리거 대상이 아니라서(원곡제외 버튼이
// 이미 plain update로 동작) 여기서도 plain update로 충분하고, tags_manual은 안 건드려 멤버 자동 태깅을
// 막지 않는다. 검색 UI는 vid-tag-cover-search 로직을 그대로(그룹/멤버 둘 다), 상태만 _vmCs*로 복제.
let _vmCsIds=[];      // 팝업 열 때 스냅샷한 대상 영상 id
let _vmCsGroups=[];   // [groupKo,...] 그룹 단위 원곡
let _vmCsMembers=[];  // [{ko,groupKo},...] 멤버 단위 원곡
function _vmCsRenderChips(){
  const el=document.getElementById('vm-cs-chips');if(!el)return;
  el.innerHTML='';
  const addChip=(label,onRemove)=>{
    const chip=document.createElement('span');
    chip.className='vid-tag-chip vid-tag-chip-cover';
    chip.appendChild(document.createTextNode(label));
    const rm=document.createElement('button');
    rm.type='button';rm.textContent='✕';rm.setAttribute('aria-label','제거');
    rm.addEventListener('click',e=>{e.stopPropagation();onRemove();_vmCsRenderChips();});
    chip.appendChild(rm);el.appendChild(chip);
  };
  _vmCsMembers.forEach((m,i)=>addChip(`원곡: ${m.ko}(${m.groupKo})`,()=>_vmCsMembers.splice(i,1)));
  _vmCsGroups.forEach((gko,i)=>addChip(`원곡: ${gko} (그룹 전체)`,()=>_vmCsGroups.splice(i,1)));
}
function _openVmCoverSet(){
  if(!sb||!_isAdmin())return;
  const ids=[...document.querySelectorAll('#vm-list .vm-item')]
    .filter(el=>el.querySelector('input[type=checkbox]')?.checked)
    .map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length){document.getElementById('vm-status').textContent='먼저 영상을 선택해주세요';return;}
  _vmCsIds=ids;_vmCsGroups=[];_vmCsMembers=[];
  document.getElementById('vm-cs-count').textContent=`${ids.length}개 영상에 원곡 지정(기존 원곡은 교체됨)`;
  document.getElementById('vm-cs-search').value='';
  document.getElementById('vm-cs-results').innerHTML='';
  document.getElementById('vm-cs-status').textContent='';
  _vmCsRenderChips();
  document.getElementById('vm-coverset-overlay').style.display='flex';
  setTimeout(()=>document.getElementById('vm-cs-search').focus(),50);
}
function _closeVmCoverSet(){document.getElementById('vm-coverset-overlay').style.display='none';}
document.getElementById('vm-cs-search')?.addEventListener('input',e=>{
  const q=e.target.value.trim();
  const resultsEl=document.getElementById('vm-cs-results');
  resultsEl.innerHTML='';
  if(!q)return;
  const qLower=q.toLowerCase();
  Object.keys(GROUPS).filter(gko=>
    (gko.includes(q)||(GROUPS[gko].en||'').toLowerCase().includes(qLower))&&!_vmCsGroups.includes(gko)
  ).slice(0,4).forEach(gko=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt vid-tag-with-opt-group';
    opt.textContent=`${gko} (그룹 전체)`;
    opt.addEventListener('click',ev=>{ev.stopPropagation();_vmCsGroups.push(gko);_vmCsRenderChips();e.target.value='';resultsEl.innerHTML='';});
    resultsEl.appendChild(opt);
  });
  const already=new Set(_vmCsMembers.map(m=>m.ko+'|'+m.groupKo));
  ARTISTS.filter(a=>
    (a.name.ko.includes(q)||(a.name.en||'').toLowerCase().includes(qLower))&&!already.has(a.name.ko+'|'+a.group.ko)
  ).sort((a,b)=>(_vidTagExactMatch(b,q,qLower)?1:0)-(_vidTagExactMatch(a,q,qLower)?1:0)).slice(0,8).forEach(a=>{
    const opt=document.createElement('div');
    opt.className='vid-tag-with-opt';
    opt.textContent=`${a.name.ko} (${a.group.ko})`;
    opt.addEventListener('click',ev=>{ev.stopPropagation();_vmCsMembers.push({ko:a.name.ko,groupKo:a.group.ko});_vmCsRenderChips();e.target.value='';resultsEl.innerHTML='';});
    resultsEl.appendChild(opt);
  });
});
_wireListKeyboardNav(document.getElementById('vm-cs-search'),document.getElementById('vm-cs-results'),'.vid-tag-with-opt',()=>_closeVmCoverSet());
document.getElementById('vm-coverset-btn')?.addEventListener('click',_openVmCoverSet);
document.getElementById('vm-cs-cancel')?.addEventListener('click',_closeVmCoverSet);
// 배경(패널 바깥) 클릭 시 닫기
document.getElementById('vm-coverset-overlay')?.addEventListener('click',e=>{if(e.target.id==='vm-coverset-overlay')_closeVmCoverSet();});
document.getElementById('vm-cs-apply')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const statusEl=document.getElementById('vm-cs-status');
  if(!_vmCsGroups.length&&!_vmCsMembers.length){statusEl.textContent='원곡을 하나 이상 지정해주세요';return;}
  if(!_vmCsIds.length){statusEl.textContent='대상 영상이 없어요';return;}
  const coverMembers=_vmCsMembers.map(m=>`${m.ko}(${m.groupKo})`);
  const coverGroups=[..._vmCsGroups];
  const ids=_vmCsIds;
  const btn=document.getElementById('vm-cs-apply');
  btn.disabled=true;statusEl.textContent='저장 중…';
  const{error}=await sb.from(_YT_TABLE).update({cover_of_members:coverMembers,cover_of_groups:coverGroups}).in('id',ids);
  btn.disabled=false;
  if(error){statusEl.textContent='저장 실패: '+error.message;return;}
  const idSet=new Set(ids);
  _vmRows.forEach(v=>{if(idSet.has(v.id)){v.cover_of_members=coverMembers.slice();v.cover_of_groups=coverGroups.slice();}});
  [...document.querySelectorAll('#vm-list .vm-item')].forEach(el=>{
    const cb=el.querySelector('input[type=checkbox]');
    if(cb&&idSet.has(el.dataset.vidId))cb.checked=false;
  });
  _closeVmCoverSet();
  document.getElementById('vm-status').textContent=`${ids.length}개 원곡 지정 완료`;
  _vmUpdateCount();
  _refreshOpenCoverOfSection?.();
});

document.getElementById('vid-tag-save').addEventListener('click',async e=>{
  e.stopPropagation();
  if(!_vidTagTarget||!sb)return;
  const statusEl=document.getElementById('vid-tag-status');
  const members=[...document.querySelectorAll('#vid-tag-members input:checked')].map(cb=>cb.value);
  const withMembers=_vidTagWithSelected.map(m=>`${m.ko}(${m.groupKo})`);
  const withGroups=[..._vidTagGroupsSelected];
  const coverMembers=_vidTagCoverSelected.map(m=>`${m.ko}(${m.groupKo})`);
  const coverGroups=[..._vidTagCoverGroupsSelected];
  const catEl=document.getElementById('vid-tag-cat');
  const category=catEl?catEl.value:undefined;
  const shortEl=document.getElementById('vid-tag-isshort');
  const isShort=shortEl?shortEl.checked:undefined;
  const contentFlag=_vidTagFlagChoice;
  const{ko,originKo}=_vidTagTarget;
  // 비교 대상은 카드 그룹(ko)이 아니라 **이 영상의 실제 소속**이어야 한다 — ko와 비교하면 관리자가
  // 칸을 실제 소속으로 두든 카드 그룹으로 바꾸든 판정이 뒤집혀서 group_ko가 안 써진다(위 ② 주석).
  const _curGko=_vidTagTarget.realGko||ko;
  // 소속 그룹(group_ko) 자체를 완전히 다른 그룹으로 옮기는 경우 — 자동 태깅이 아예 엉뚱한 그룹으로
  // 잘못 물었을 때(예: "원곡: X그룹" 오태깅) "그룹멤버안나옴+타그룹멤버 크로스태그"로 우회하지 않고
  // 여기서 바로 소속을 바로잡을 수 있게 함.
  const groupKoInput=(document.getElementById('vid-tag-group-ko')?.value||'').trim();
  let newGko=null;
  if(groupKoInput&&groupKoInput!==_curGko){
    if(!_isValidVidGroupKo(groupKoInput)){statusEl.textContent=`"${groupKoInput}"는 등록된 그룹명/솔로 아티스트명이 아니에요(정확히 입력해주세요)`;return;}
    newGko=groupKoInput;
  }
  statusEl.textContent='저장 중…';
  if(_vidTagBulkIds){
    // 일괄 편집: 손댄 항목만 반영 — "덮어쓰기" 체크 안 하면 members/with_members/with_groups는 그대로 두고,
    // 플래그 체크박스를 하나도 안 눌렀으면 content_flag도 건드리지 않는다(영상마다 기존 상태가 달라서
    // 단일 편집처럼 "빈 값 = 명시적으로 지움"으로 해석하면 선택한 영상 전체의 기존 태그/플래그가 조용히
    // 날아가는 사고가 날 수 있음).
    const overwriteTags=document.getElementById('vid-tag-bulk-overwrite').checked;
    const updatePayload={};
    // 태그를 덮어쓴다 = 사람이 최종 확정한 것이므로 단일 편집과 같이 검수도 끝난 것으로 본다(needs_review:false).
    if(overwriteTags){updatePayload.members=members;updatePayload.with_members=withMembers;updatePayload.with_groups=withGroups;updatePayload.cover_of_members=coverMembers;updatePayload.cover_of_groups=coverGroups;updatePayload.tags_manual=true;updatePayload.needs_review=false;}
    if(category)updatePayload.category=category;
    if(_vidTagShortTouched&&isShort!==undefined)updatePayload.is_short=isShort;
    if(_vidTagFlagTouched)Object.assign(updatePayload,_flagPatch(contentFlag,'manual'));
    if(newGko)updatePayload.group_ko=newGko;
    if(!Object.keys(updatePayload).length){statusEl.textContent='변경할 항목을 선택해주세요';return;}
    const ids=_vidTagBulkIds;
    // 편집 이력용 원본 — 일괄 편집은 모달이 행별 값을 안 들고 있어서 쓰기 직전에 따로 읽어야 한다.
    // 실패해도(권한·네트워크) 원 작업은 그대로 진행한다 — 로그는 부수효과일 뿐이라 편집을 막으면 안 된다.
    let _bulkBefore=[];
    try{
      for(let i=0;i<ids.length;i+=300){
        const{data:bRows}=await sb.from(_YT_TABLE).select('id,title,group_ko,members,with_members,with_groups,cover_of_members,cover_of_groups,content_flag,category,is_short').in('id',ids.slice(i,i+300));
        if(bRows)_bulkBefore=_bulkBefore.concat(bRows);
      }
    }catch(e){_bulkBefore=[];}
    if(overwriteTags){
      // tags_manual=true인 행도 있을 수 있어서 트리거를 우회하는 two-step 저장:
      // 1) tags_manual=false로 잠금 해제 → 트리거 조건 불만족으로 모든 컬럼 변경 허용
      // 2) tags_manual=true로 재잠금
      const{error:e1}=await sb.from(_YT_TABLE).update({...updatePayload,tags_manual:false}).in('id',ids);
      if(e1){statusEl.textContent='저장 실패: '+e1.message;return;}
      const{error:e2}=await sb.from(_YT_TABLE).update({tags_manual:true}).in('id',ids);
      if(e2){statusEl.textContent='저장 실패: '+e2.message;return;}
    }else{
      const{error}=await sb.from(_YT_TABLE).update(updatePayload).in('id',ids);
      if(error){statusEl.textContent='저장 실패: '+error.message;return;}
    }
    // 일괄 편집 이력 — after는 updatePayload로 실제 바꾼 필드만 넘긴다(안 건드린 필드는 diff 대상이 아님).
    _tagEditLog(_bulkBefore.map(r=>{
      const after={};
      _TAG_LOG_FIELDS.forEach(f=>{if(f in updatePayload)after[f]=updatePayload[f];});
      return {videoId:r.id,title:r.title,before:{...r,is_short:_isShortV(r)},after,source:'modal_bulk'};
    }));
    statusEl.textContent=`${ids.length}개 저장됨`;
    setTimeout(()=>{
      _closeVidTagModal();
      window._adminBulkExitFn?.();
      _gcChVidCtl.reloadIfShowing(ko);
      _ttChVidCtl.reloadIfShowing(ko);
      withGroups.forEach(gko=>_gcChVidCtl.reloadIfShowing(gko));
      if(newGko){_gcChVidCtl.reloadIfShowing(newGko);_ttChVidCtl.reloadIfShowing(newGko);}
      _refreshOpenCardCollab();
      _refreshOpenCoverOfSection();
    },100);
    return;
  }
  const{id}=_vidTagTarget;
  // tags_manual:true — 이 모달에서 직접 저장한 행은 "관리자가 확인한 최종 태그"로 표시해서, 자동
  // 태깅/재검증 스윕(멤버+콜라보 자동 태깅, 콜라보 오태깅 재검증 등)이 알고리즘 판단과 다르더라도
  // 이 값을 절대 덮어쓰지 않게 함(2026-07-31, 자동 재검증이 수동 태그를 지워버린 사고 이후 추가).
  // needs_review:false — 이 모달에서 사람이 직접 보고 저장한 순간 검수는 끝난 것이다. 예전엔 이게
  // 없어서 그룹배정 검수 큐에서 영상을 열어 고쳐 저장해도 needs_review가 true로 남아 **큐에 그대로
  // 남았다**(2026-08-31 사용자 제보 — "수동편집한 건 아예 안 떠야지"). 승인/거부 버튼은 이미 내리고
  // 있었는데 편집 경로만 빠져 있었음.
  const updatePayload={members,with_members:withMembers,with_groups:withGroups,cover_of_members:coverMembers,cover_of_groups:coverGroups,..._flagPatch(contentFlag,'manual',{needs_review:false}),tags_manual:true};
  if(category!==undefined)updatePayload.category=category||null;
  // 단일 편집은 체크박스가 DB 현재값으로 채워져 열리므로 항상 그대로 반영해도 안전하다(일괄 편집만
  // "안 건드림"을 구분해야 함).
  if(isShort!==undefined)updatePayload.is_short=isShort;
  if(newGko)updatePayload.group_ko=newGko;
  // content_formats: 기존 배열에서 장르 태그(variety/show)만 교체, 코너명 태그는 보존
  const _GENRE_TAGS=['variety','show'];
  const newFormats=_vidTagLoadedFormats.filter(f=>!_GENRE_TAGS.includes(f));
  if(category==='variety'||category==='show')newFormats.push(category);
  updatePayload.content_formats=newFormats;
  if(_vidTagOrigManual){
    // 기존 행이 tags_manual=true였으므로 DB 트리거를 우회하는 two-step 저장:
    // 1) tags_manual=false → 트리거 조건(OLD.tags_manual=true) 해제 → 모든 컬럼 변경 허용
    // 2) tags_manual=true → 다시 잠금
    const{error:e1}=await sb.from(_YT_TABLE).update({...updatePayload,tags_manual:false}).eq('id',id);
    if(e1){statusEl.textContent='저장 실패: '+e1.message;return;}
    const{error:e2}=await sb.from(_YT_TABLE).update({tags_manual:true}).eq('id',id);
    if(e2){statusEl.textContent='저장 실패: '+e2.message;return;}
  }else{
    const{error}=await sb.from(_YT_TABLE).update(updatePayload).eq('id',id);
    if(error){statusEl.textContent='저장 실패: '+error.message;return;}
  }
  // 편집 이력 — 자동 태깅이 뭘 틀렸는지에 대한 유일한 정답 신호라 저장에 성공한 뒤 남긴다.
  // (_vidTagBefore가 없으면 = 모달 열 때 DB 조회가 실패한 경우라, 허위 diff를 만들지 않게 건너뛴다.)
  if(_vidTagBefore)_tagEditLog({videoId:id,title:document.getElementById('vid-tag-vidtitle').textContent,before:_vidTagBefore,
    after:{group_ko:newGko||_vidTagBefore.group_ko,members,with_members:withMembers,with_groups:withGroups,cover_of_members:coverMembers,cover_of_groups:coverGroups,content_flag:contentFlag||null,category:category||null,is_short:isShort===undefined?_vidTagBefore.is_short:isShort},
    source:'modal_single'});
  statusEl.textContent='저장됨';
  // group_ko도 같이 실어보내야 함 — patchItem 내부의 _buildGridWithList가 "이 영상이 실제로 속한
  // 그룹"과 "지금 보는 카드의 그룹"이 다른지 판단할 때 필요(없으면 게스트 출연 영상의 함께한 멤버 줄이
  // "이름(undefined)"처럼 잘못 그려짐, 2026-08-04).
  const patchedRow={title:document.getElementById('vid-tag-vidtitle').textContent,group_ko:newGko||ko,members,with_members:withMembers,with_groups:withGroups,cover_of_members:coverMembers,cover_of_groups:coverGroups,content_flag:contentFlag,category:category||null,is_short:isShort===undefined?false:isShort};
  setTimeout(()=>{
    _closeVidTagModal();
    // 지금 보고 있던 카드(originKo) 그리드는 재조회 없이 이 카드 하나만 직접 고침(제목/함께한 멤버 갱신
    // 또는 조건 안 맞으면 카드만 제거) — 매번 그리드를 통째로 다시 불러오던 걸 없애서 저장 후 로딩
    // 지연/화면 깜빡임을 없앰. ko(영상의 실제 소속)가 아니라 originKo를 써야 함 — 멤버 카드에 뜬 다른
    // 그룹 게스트 출연 영상을 편집한 경우 ko !== originKo라서, ko로 patchItem을 부르면 지금 보고 있는
    // 카드(originKo)는 하나도 안 고쳐지고 조용히 방치됨(2026-08-04, 사용자 제보로 발견).
    _gcChVidCtl.patchItem(originKo,id,patchedRow);
    _ttChVidCtl.patchItem(originKo,id,patchedRow);
    // with_groups로 새로 태깅된 그룹, 소속을 통째로 옮긴 새 그룹(newGko), 그리고 원래 실제 소속(ko, 지금
    // 보던 카드와 다를 수 있음)은 그 카드에 이 영상이 "처음 나타나거나" originKo patchItem으로 못 덮는
    // 케이스라 예외적으로 재조회.
    withGroups.forEach(gko=>_gcChVidCtl.reloadIfShowing(gko));
    if(ko!==originKo){_gcChVidCtl.reloadIfShowing(ko);_ttChVidCtl.reloadIfShowing(ko);}
    if(newGko){_gcChVidCtl.reloadIfShowing(newGko);_ttChVidCtl.reloadIfShowing(newGko);}
    _refreshOpenCardCollab(); // with 태그 추가/변경으로 "연결" 버튼 노출 여부가 바뀌었을 수 있으니 갱신
    _refreshOpenCoverOfSection(); // 원곡자 지정 추가/변경으로 "다른 아티스트의 커버" 섹션이 바뀌었을 수 있으니 갱신
  },100);
});
// 기타/외부인 포함/개별출연(체크박스) + 무관/숨김(토글 버튼) — content_flag 컬럼 하나를 놓고 배타적으로
// 선택하는 하나의 그룹이라, 전부 여기서 _vidTagFlagChoice 하나로 수렴시키고 저장 버튼을 눌러야 반영된다
// (예전엔 숨김만 클릭 즉시 별도로 DB에 반영돼서 무관과 취급 "정도"가 달랐음 — 통일).
document.getElementById('vid-tag-flag-etc').addEventListener('change',e=>{
  _vidTagFlagTouched=true;_vidTagFlagChoice=e.target.checked?'기타':null;_vidTagApplyFlagUI();
});
document.getElementById('vid-tag-flag-ext').addEventListener('change',e=>{
  _vidTagFlagTouched=true;_vidTagFlagChoice=e.target.checked?'외부인':null;_vidTagApplyFlagUI();
});
// '개별출연' — 연말 가요제 무대를 순서대로 이어붙였거나 엠카 비하인드처럼 여러 그룹/멤버가 한 영상에
// 각자 따로 나오는 컴필레이션. 영상 자체는 각자의 피드에 그대로 노출되지만 "함께한 멤버"/연결 카드용
// 콜라보로는 집계되지 않는다(_apiVidToSong/_buildGridWithList/_fetchApiCollabData 참고, 2026-08-04).
document.getElementById('vid-tag-flag-indiv').addEventListener('change',e=>{
  _vidTagFlagTouched=true;_vidTagFlagChoice=e.target.checked?'개별출연':null;_vidTagApplyFlagUI();
});
document.getElementById('vid-tag-flag-nomem-btn').addEventListener('click',e=>{e.stopPropagation();_vidTagSetFlagChoice('무관');});
// 보류(2026-08-27) — 무관/숨김과 같은 3택 토글이라 하나를 고르면 나머지는 자동으로 풀린다
// (_vidTagSetFlagChoice가 단일 선택). 같은 걸 다시 누르면 해제.
document.getElementById('vid-tag-flag-hold-btn')?.addEventListener('click',e=>{e.stopPropagation();_vidTagSetFlagChoice('보류');});
document.getElementById('vid-tag-flag-hidden-btn').addEventListener('click',e=>{e.stopPropagation();_vidTagSetFlagChoice('hidden');});
// 썸네일이 아예 안 뜨는 개별 영상 하나만 유튜브에서 다시 조회해서 고치는 용도 —
// "쇼츠 자동 감지"처럼 전체 영상을 다 훑지 않고 지금 열려있는 이 영상 하나만 갱신한다.
document.getElementById('vid-tag-thumb-refresh').addEventListener('click',async e=>{
  e.stopPropagation();
  if(!_vidTagTarget||!sb)return;
  const key=_ytApiKey();
  const statusEl=document.getElementById('vid-tag-status');
  if(!key){statusEl.textContent='설정에서 유튜브 API 키를 먼저 입력해주세요';return;}
  const{ko,id}=_vidTagTarget;
  statusEl.textContent='썸네일 조회 중…';
  try{
    const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${key}`);
    if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
    const d=await r.json();
    if(d.error)throw new Error(d.error.message);
    const item=d.items?.[0];
    if(!item)throw new Error('유튜브에서 영상을 찾을 수 없음(삭제/비공개 가능성)');
    const th=item.snippet?.thumbnails||{};
    const hiTh=th.high||th.standard||th.maxres; // 세로 판별용, 가벼운 순으로(2026-08-10, 위 동기화 루프와 동일 이유)
    const isShortThumb=!!(hiTh&&hiTh.height>hiTh.width);
    const thumb=isShortThumb?(hiTh.url||th.medium?.url||''):(th.medium?.url||th.high?.url||th.default?.url||'');
    if(!thumb)throw new Error('유튜브 응답에 썸네일이 없음');
    const{error}=await sb.from(_YT_TABLE).update({thumb}).eq('id',id);
    if(error)throw new Error(error.message);
    statusEl.textContent='썸네일 갱신됨';
    _gcChVidCtl.reloadIfShowing(ko);
    _ttChVidCtl.reloadIfShowing(ko);
  }catch(err){
    statusEl.textContent='오류: '+err.message;
  }
});


// 카드 넓게 보기 토글
(()=>{
  const btn=document.getElementById('sp-wide-btn');
  if(!btn)return;
  const apply=wide=>{
    document.body.classList.toggle('card-wide',wide);
    btn.textContent=wide?'⇥':'⇤';
    btn.title=wide?'카드 원래 크기로':'카드 넓게 보기';
  };
  apply(localStorage.getItem('kpu_card_wide')==='1');
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    const next=!document.body.classList.contains('card-wide');
    apply(next);
    localStorage.setItem('kpu_card_wide',next?'1':'0');
    // 이미 그려진 영상 그리드는 넓이 전환만으로 재배치되지 않으므로, 지금 열린 카드의 영상 그리드를 새로고침
    if(_openGCko)_gcChVidCtl.reloadIfShowing(_openGCko);
    if(_openTArtist)_ttChVidCtl.reloadIfShowing(_openTArtist.group.ko);
  });
})();

// Settings 배선
(()=>{
  const keyEl=document.getElementById('sp-yt-key');
  const saved=localStorage.getItem('kpu_yt_key')||'';
  if(keyEl&&saved)keyEl.value=saved;
  keyEl?.addEventListener('change',e=>localStorage.setItem('kpu_yt_key',e.target.value.trim()));
  keyEl?.addEventListener('blur',e=>localStorage.setItem('kpu_yt_key',e.target.value.trim()));
  _admExecBind('sp-yt-sync',async()=>{
    await _ytSyncAll();
    await _ytSyncExtChannels();
    await _ytRefreshViewCounts();
  },'전체 동기화');
  _admExecBind('sp-yt-viewcount-btn',async()=>{
    await _ytRefreshViewCounts();
  },'조회수 갱신(직캠)');
  _admExecBind('sp-yt-allviewcount-btn',async()=>{
    await _ytRefreshAllViewCounts();
  },'전체 조회수 갱신');
  _admExecBind('sp-yt-rotateviewcount-btn',async()=>{
    await _ytRotateViewCountRefresh();
  },'조회수 순환 갱신');
  _admExecBind('sp-yt-sweep-banned',_ytSweepBannedVideos,'밴 인물 숨김');
  _admExecBind('sp-yt-sweep-junk',_ytSweepJunkKeywordVideos,'제외 키워드 정리');
  // "무조건 제외 키워드" 목록이 코드에만 있어서 관리자가 지금 뭐가 걸려있는지 확인할 방법이 없었음
  // (2026-08-10, 사용자 요청) — 버튼 밑에 현재 목록을 그대로 보여줌. _JUNK_TITLE_KEYWORDS_GLOBAL을
  // 그대로 참조하므로 코드에서 키워드를 추가/삭제하면 이 표시도 자동으로 같이 바뀜(따로 관리 안 해도 됨).
  const junkKwLbl=document.getElementById('sp-junk-keywords-lbl');
  if(junkKwLbl)junkKwLbl.textContent='현재 목록: '+_JUNK_TITLE_KEYWORDS_GLOBAL.join(', ');
  _admExecBind('sp-detect-btn',_ytSweepDetectPreview,'오태깅 미리보기');
_admExecBind('sp-lockfill-btn',_ytSweepFillLockedEmpty,'잠금-빈값 채우기');
_admExecBind('sp-canon-btn',_ytSweepCanonicalizeMembers,'고아태그 정정');
_admExecBind('sp-collabfix-btn',_ytSweepAmbiguousCollabMistag,'콜라보 재검증');
  _admExecBind('sp-scan-namecollide-btn',_ytScanAmbiguousNameGroupMisassignment,'동명이인 재배정');
  _admExecBind('sp-membersfix-btn',_ytSweepMembersMistag,'자체 멤버 재검증');
  _admExecBind('sp-yt-undo-bulk-btn',_ytUndoLastBulk,'되돌리기');
  _admExecBind('sp-catfix-btn',_ytSweepCategoryMistag,'카테고리 재분류');
  _admExecBind('sp-shortspromote-btn',_ytSweepPromoteShorts,'쇼츠 승격',{selfRestop:true});
  {const _spb=document.getElementById('sp-shortspromote-btn');if(_spb&&localStorage.getItem('_kpu_shortsPromoteCursor'))_spb.textContent='⬆️ 가로→쇼츠 일괄 승격 (재개)';}
  _admExecBind('sp-yt-autotag',_ytAutoTagMembers,'자동 태깅');
  _admExecBind('sp-yt-retag-all',_ytRetagAllIncludingTagged,'멤버+콜라보 재태깅',{abortable:true});
  document.getElementById('sp-vm-btn')?.addEventListener('click',()=>_vmOpen());
  const backfillSel=document.getElementById('sp-yt-backfill-ch');
  if(backfillSel){
    backfillSel.innerHTML=_EXT_CHANNELS.map(c=>`<option value="${c.handle}">${c.name}</option>`).join('');
  }
  _admExecBind('sp-yt-backfill-btn',()=>{
    const handle=backfillSel?.value;
    const fromYear=+document.getElementById('sp-yt-backfill-from').value;
    const toYear=+document.getElementById('sp-yt-backfill-to').value;
    const query=(document.getElementById('sp-yt-backfill-query')?.value||'').trim();
    if(handle)return _ytBackfillByDateRange(handle,fromYear,toYear,query||undefined);
  },'채널 백필');
  _admExecBind('sp-yt-backfill-priority-btn',()=>{
    const fromYear=+document.getElementById('sp-yt-backfill-from').value;
    const toYear=+document.getElementById('sp-yt-backfill-to').value;
    const query=(document.getElementById('sp-yt-backfill-query')?.value||'').trim();
    return _ytBackfillPriorityChannels(fromYear,toYear,query||undefined);
  },'음악방송 백필');
  _admExecBind('sp-yt-manual-add-btn',_ytAddVideoByUrl,'영상 추가');
  _admExecBind('sp-yt-manual-batch-add-btn',_ytAddVideosBatch,'영상 일괄 추가');
  _admRenderLastRun();_admRenderExecLog();_admWireHints();
  // 버튼마다 한 줄 설명 토글(2026-08-19, 사용자 요청) — 켜둔 상태를 기억해서 매번 다시 켤 필요 없게 함.
  const hintToggle=document.getElementById('sp-hint-toggle');
  const hintSec=document.getElementById('sp-yt-sec');
  if(hintToggle&&hintSec){
    const hintKey='kpu_admin_show_hints';
    hintToggle.checked=localStorage.getItem(hintKey)==='1';
    hintSec.classList.toggle('show-hints',hintToggle.checked);
    hintToggle.addEventListener('change',()=>{
      hintSec.classList.toggle('show-hints',hintToggle.checked);
      localStorage.setItem(hintKey,hintToggle.checked?'1':'0');
    });
  }
})();

// ── 동기화 채널 목록 (그룹/멤버 공식 + 그외 외부 채널 두 탭 — 전부 로컬 데이터, DB 조회 없음) ──
// 공식 채널은 _ytSyncAll()과 동일한 방식으로 GROUPS/ARTISTS에서 그때그때 추출(별도 목록 유지 불필요)
function _officialChannels(){
  const groups=Object.entries(GROUPS||{}).filter(([,v])=>v?.links?.youtube).map(([ko,v])=>({name:ko,url:v.links.youtube}));
  const seenSolo=new Set();
  const solos=[];
  (ARTISTS||[]).forEach(a=>{
    if(GROUPS[a.group.ko]||!a.links?.youtube||seenSolo.has(a.name.ko))return;
    seenSolo.add(a.name.ko);
    solos.push({name:a.name.ko,url:a.links.youtube});
  });
  // 아이돌 개인 채널(효연·슬기·설아)은 여기 있다가 ext_channels(tier='idol')로 이관됨(2026-08-25).
  // 이 탭은 "파일(groups.json/artists.json)이 정본인 채널"만 보여주는 읽기 전용 목록이고, 사람 채널은
  // 전부 "그외" 탭에서 어드민이 직접 관리한다 — 같은 성격의 채널이 편집 가능/불가능으로 갈려 있던 걸
  // 정리한 것. artists.json의 channels[] 필드도 같이 제거했다.
  return[...groups,...solos];
}

// ── 어드민 일괄 선택 플로팅 바 ──
document.getElementById('admin-bulk-cancel-btn')?.addEventListener('click',()=>{
  window._adminBulkExitFn?.();
});
document.getElementById('admin-bulk-edit-btn')?.addEventListener('click',()=>{
  if(!sb||!_isAdmin())return;
  const ids=[...document.querySelectorAll('.gc-ch-item.admin-selected,.tv-conn-selectable.admin-selected')].map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length||!window._adminBulkKo)return;
  _openVidTagModalBulk(ids,window._adminBulkKo);
  // 멤버 카드는 게스트로 출연한 다른 채널 영상도 같이 보여주므로, 선택한 영상들이 실제로는 여러 그룹에
  // 걸쳐 있을 수 있음 — 멤버 체크박스는 그 중 한 그룹 기준으로만 그려지므로 미리 경고해둔다(vm 패널의
  // 같은 경고와 동일한 이유, 2026-08-04).
  if(window._adminBulkMixedGko){
    const statusEl=document.getElementById('vid-tag-status');
    if(statusEl)statusEl.textContent='선택한 영상이 여러 그룹에 걸쳐 있어요 — "멤버/콜라보 태그도 덮어쓰기"는 끄고 사용하세요';
  }
});
// "보류" — content_flag='보류'. 카드 그리드 쿼리(buildBaseQuery)가 무관·hidden과 함께 서버에서 빼주므로
// **무관/숨김과 똑같이 카드에서 사라진다.** 차이는 의미뿐이다: 무관은 "이 그룹/멤버와 관계없음"이라는
// 판정이고 보류는 "판단을 미뤄둠"이라, 나중에 영상 관리 패널의 '보류' 탭에서 다시 꺼내 보게 된다.
// (영상 관리 패널의 '선택-보류'(vm-hold-btn)와 같은 플래그, 2026-08-27 사용자 요청으로 카드에도 추가.)
document.getElementById('admin-bulk-hold-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-hold-btn');
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected,.tv-conn-selectable.admin-selected')];
  if(!selectedItems.length)return;
  const ids=selectedItems.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch('보류','manual')).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='보류';_showShareToast('오류: '+error.message);return;}
  // 카드 그리드는 플래그 붙은 행을 서버에서 이미 빼고 오므로 여기 보이는 건 전부 content_flag=null이다.
  _tagEditLog(ids.map(id=>({videoId:id,before:{content_flag:null},after:{content_flag:'보류'},source:'card_flag'})));
  selectedItems.forEach(el=>el.remove());
  window._adminBulkExitFn?.();
  btn.disabled=false;btn.textContent='보류';
});
document.getElementById('admin-bulk-hide-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-hide-btn');
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected,.tv-conn-selectable.admin-selected')];
  if(!selectedItems.length)return;
  const ids=selectedItems.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch('hidden','manual')).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='숨김';_showShareToast('오류: '+error.message);return;}
  _tagEditLog(ids.map(id=>({videoId:id,before:{content_flag:null},after:{content_flag:'hidden'},source:'card_flag'})));
  selectedItems.forEach(el=>el.remove());
  window._adminBulkExitFn?.();
  btn.disabled=false;btn.textContent='숨김';
});
// "무관" — content_flag='무관'(자동 태깅이 이 그룹/멤버로 잘못 물었다는 정정 표시). "숨김"(hidden, 밴 인물
// 언급 등 어디서도 안 보여야 하는 콘텐츠)과 달리 행은 그대로 남기고 이 그룹/멤버 그리드·콜라보 풀에서만
// 빠진다 — "데이터 퀄리티" 패널의 그룹별 무맥락 정리가 쓰는 것과 같은 플래그를 카드 선택 화면에서 바로
// 붙일 수 있게 함(2026-08-06, 사용자 요청 — 숨김만 있고 무관이 없다는 지적).
document.getElementById('admin-bulk-irrelevant-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-irrelevant-btn');
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected,.tv-conn-selectable.admin-selected')];
  if(!selectedItems.length)return;
  const ids=selectedItems.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const{error}=await sb.from(_YT_TABLE).update(_flagPatch('무관','manual')).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='무관';_showShareToast('오류: '+error.message);return;}
  // '무관'은 "자동 태깅이 이 그룹/멤버로 잘못 물었다"는 가장 직접적인 오답 라벨이라 학습 가치가 특히 높다.
  _tagEditLog(ids.map(id=>({videoId:id,before:{content_flag:null},after:{content_flag:'무관'},source:'card_flag'})));
  selectedItems.forEach(el=>el.remove());
  window._adminBulkExitFn?.();
  btn.disabled=false;btn.textContent='무관';
});
// 멤버 카드에서 여러 영상을 골라 "이 멤버가 실제로는 안 나오는 영상"이라고 한 번에 표시하는 빠른 액션 —
// 매번 태그 편집 모달을 열어 멤버 이름을 하나씩 찾아 체크 해제할 필요 없이, members에서 이 멤버 이름만
// 빼고(자체 채널 태깅) with_members에서 "이멤버(그룹)" 항목만 뺀다(다른 채널 게스트 태깅). 다른 멤버/그룹
// 태그는 그대로 둔다 — "숨김"과 달리 이 영상 자체를 지우거나 다른 곳에서도 감추는 게 아니라, 딱 이 멤버
// 연결만 끊는 것(2026-08-06, 사용자 요청 — 매번 정리를 따로 요청하기 번거롭다는 피드백).
document.getElementById('admin-bulk-exclude-member-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-exclude-member-btn');
  const mko=window._adminBulkMemberKo;
  if(!mko)return;
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected')];
  if(!selectedItems.length)return;
  const idSet=new Set(selectedItems.map(el=>el.dataset.vidId).filter(Boolean));
  if(!idSet.size)return;
  const vids=(window._adminBulkSelectedVids||[]).filter(v=>idSet.has(v.id));
  const patches=vids.map(v=>{
    const members=v.members||[],withMembers=v.with_members||[];
    const newMembers=members.filter(m=>m!==mko);
    const newWithMembers=withMembers.filter(wm=>!wm.startsWith(mko+'('));
    return{id:v.id,members:newMembers,with_members:newWithMembers,group_ko:v.group_ko,
      changed:newMembers.length!==members.length||newWithMembers.length!==withMembers.length};
  }).filter(p=>p.changed);
  if(!patches.length){_showShareToast('선택한 영상엔 이 멤버 태그가 없어요');return;}
  btn.disabled=true;btn.textContent='처리 중…';
  const allIds=patches.map(p=>p.id);
  // tags_manual=true인 행은 DB 트리거가 태그 변경을 막으므로, 편집 모달과 동일하게 잠금 해제→변경→재잠금
  const{error:unlockErr}=await sb.from(_YT_TABLE).update({tags_manual:false}).in('id',allIds);
  if(unlockErr){btn.disabled=false;btn.textContent='이 멤버 제외';_showShareToast('오류: '+unlockErr.message);return;}
  for(let i=0;i<patches.length;i+=25){
    const chunk=patches.slice(i,i+25);
    const results=await Promise.all(chunk.map(p=>sb.from(_YT_TABLE).update({members:p.members,with_members:p.with_members}).eq('id',p.id)));
    const failed=results.find(r=>r.error);
    if(failed){btn.disabled=false;btn.textContent='이 멤버 제외';_showShareToast('오류: '+failed.error.message);return;}
  }
  const{error:lockErr}=await sb.from(_YT_TABLE).update({tags_manual:true}).in('id',allIds);
  if(lockErr){btn.disabled=false;btn.textContent='이 멤버 제외';_showShareToast('오류: '+lockErr.message);return;}
  const affectedGkos=new Set(patches.map(p=>p.group_ko).filter(Boolean));
  window._adminBulkExitFn?.();
  affectedGkos.forEach(gko=>{_gcChVidCtl.reloadIfShowing(gko);_ttChVidCtl.reloadIfShowing(gko);});
  btn.disabled=false;btn.textContent='이 멤버 제외';
  _showShareToast(`${patches.length}개 영상에서 제외함`);
});
// "이 멤버 제외"와 같은 맥락을 그룹 카드에 적용 — 여러 영상을 골라 "이 그룹이 실제로는 함께 나온 게
// 아닌 영상"이라고 한 번에 표시. with_groups에서 이 그룹 이름만 뺀다(동명이인 콜라보 오태깅 정리용,
// 2026-08-10, 사용자 요청 — "여전히 동명이인 등 제대로 정리 안 된 게 많다"는 피드백).
// group_ko 자체가 이 그룹인 영상(자체 채널 소속 오배정 — 채널 동기화 단계에서부터 엉뚱한 그룹에
// 매핑된 경우)은 with_groups만 지워선 카드에서 안 사라짐. 이 경우 members가 비어있고(=이 그룹 로스터
// 매칭이 하나도 안 됐다는 뜻 — 애초에 이 그룹 영상이 아니었다는 신호) with_members가 정확히 한 그룹
// 사람들로만 채워져 있으면(=진짜 소속을 알려주는 단서), 그 그룹으로 group_ko를 재배정하고 그 사람들을
// with_members→members로 옮긴다(2026-08-10, 사용자 제안). 여러 그룹이 섞여 있거나 members가 이미
// 차있으면 자동 판단이 위험하므로 건드리지 않고 몇 건인지만 알려준다.
document.getElementById('admin-bulk-exclude-group-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-exclude-group-btn');
  const gko=window._adminBulkCardKo;
  if(!gko)return;
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected')];
  if(!selectedItems.length)return;
  const idSet=new Set(selectedItems.map(el=>el.dataset.vidId).filter(Boolean));
  if(!idSet.size)return;
  const vids=(window._adminBulkSelectedVids||[]).filter(v=>idSet.has(v.id));
  const ownChannelVids=vids.filter(v=>v.group_ko===gko);
  const stripPatches=vids.filter(v=>v.group_ko!==gko).map(v=>{
    const withGroups=v.with_groups||[];
    const newWithGroups=withGroups.filter(g=>g!==gko);
    return{id:v.id,type:'strip',with_groups:newWithGroups,group_ko:v.group_ko,changed:newWithGroups.length!==withGroups.length};
  }).filter(p=>p.changed);
  // 자체 채널 오배정 재배정 후보 판별
  const reassignPatches=[];
  let unresolvedCount=0;
  ownChannelVids.forEach(v=>{
    const members=v.members||[];
    const withMembers=v.with_members||[];
    if(members.length||!withMembers.length){unresolvedCount++;return;}
    const targets=new Set();
    const parsed=withMembers.map(wm=>{
      const m=wm.match(/^(.+)\((.+)\)$/);
      if(m)targets.add(m[2]);
      return m;
    });
    if(targets.size!==1||parsed.some(p=>!p)){unresolvedCount++;return;} // 그룹이 안 섞여있고(정확히 1개) 파싱 실패도 없어야 함
    const targetGko=[...targets][0];
    if(!GROUPS[targetGko]||targetGko===gko){unresolvedCount++;return;}
    reassignPatches.push({
      id:v.id,type:'reassign',
      group_ko:targetGko,
      members:parsed.map(p=>p[1]),
      with_members:[]
    });
  });
  const patches=[...stripPatches,...reassignPatches];
  if(!patches.length){
    _showShareToast(unresolvedCount?`선택한 영상 ${unresolvedCount}개는 자동 재배정 불가(태그 편집에서 직접 확인)`:'선택한 영상엔 이 그룹 태그가 없어요');
    return;
  }
  btn.disabled=true;btn.textContent='처리 중…';
  const allIds=patches.map(p=>p.id);
  // tags_manual=true인 행은 DB 트리거가 태그 변경을 막으므로, 편집 모달과 동일하게 잠금 해제→변경→재잠금
  const{error:unlockErr}=await sb.from(_YT_TABLE).update({tags_manual:false}).in('id',allIds);
  if(unlockErr){btn.disabled=false;btn.textContent='이 그룹 제외';_showShareToast('오류: '+unlockErr.message);return;}
  for(let i=0;i<patches.length;i+=25){
    const chunk=patches.slice(i,i+25);
    const results=await Promise.all(chunk.map(p=>
      p.type==='strip'
        ?sb.from(_YT_TABLE).update({with_groups:p.with_groups}).eq('id',p.id)
        :sb.from(_YT_TABLE).update({group_ko:p.group_ko,members:p.members,with_members:p.with_members}).eq('id',p.id)
    ));
    const failed=results.find(r=>r.error);
    if(failed){btn.disabled=false;btn.textContent='이 그룹 제외';_showShareToast('오류: '+failed.error.message);return;}
  }
  const{error:lockErr}=await sb.from(_YT_TABLE).update({tags_manual:true}).in('id',allIds);
  if(lockErr){btn.disabled=false;btn.textContent='이 그룹 제외';_showShareToast('오류: '+lockErr.message);return;}
  const affectedGkos=new Set([gko,...patches.map(p=>p.group_ko).filter(Boolean)]);
  window._adminBulkExitFn?.();
  affectedGkos.forEach(g=>{_gcChVidCtl.reloadIfShowing(g);_ttChVidCtl.reloadIfShowing(g);});
  btn.disabled=false;btn.textContent='이 그룹 제외';
  const parts=[`제외 ${stripPatches.length}개`];
  if(reassignPatches.length)parts.push(`재배정 ${reassignPatches.length}개`);
  if(unresolvedCount)parts.push(`판단 보류 ${unresolvedCount}개`);
  _showShareToast(parts.join(' · '));
});
// "이 멤버 제외"의 반대 방향 — 자체 채널 태깅(members)은 그대로 두고 "함께한 멤버"(with_members/with_groups,
// 다른 그룹과의 콜라보 태그)만 통째로 지운다. 특정 멤버 하나로 좁힐 필요가 없는 액션이라 그룹/멤버/연결
// 카드 어디서나 항상 노출됨(2026-08-06, 사용자 요청 — "이 멤버 제외"의 반대 케이스도 필요하다는 피드백).
// window._adminBulkSelectedVids는 멤버 카드 컨트롤러에서만 채워지므로(연결 카드는 안 채움) 여기선 의존하지
// 않고 선택된 id로 최신 with_members/with_groups를 직접 조회해서 어느 컨텍스트에서든 동일하게 동작하게 함.
document.getElementById('admin-bulk-clear-collab-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-clear-collab-btn');
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected,.tv-conn-selectable.admin-selected')];
  if(!selectedItems.length)return;
  const ids=[...new Set(selectedItems.map(el=>el.dataset.vidId).filter(Boolean))];
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const{data:rows,error:fetchErr}=await sb.from(_YT_TABLE).select('id,with_members,with_groups,group_ko').in('id',ids);
  if(fetchErr){btn.disabled=false;btn.textContent='함께한 태그 제거';_showShareToast('오류: '+fetchErr.message);return;}
  const targets=(rows||[]).filter(v=>(v.with_members&&v.with_members.length)||(v.with_groups&&v.with_groups.length));
  if(!targets.length){btn.disabled=false;btn.textContent='함께한 태그 제거';_showShareToast('선택한 영상엔 함께한 멤버 태그가 없어요');return;}
  const targetIds=targets.map(v=>v.id);
  // tags_manual=true인 행은 DB 트리거가 태그 변경을 막으므로, 편집 모달과 동일하게 잠금 해제→변경→재잠금
  const{error:unlockErr}=await sb.from(_YT_TABLE).update({tags_manual:false}).in('id',targetIds);
  if(unlockErr){btn.disabled=false;btn.textContent='함께한 태그 제거';_showShareToast('오류: '+unlockErr.message);return;}
  const{error}=await sb.from(_YT_TABLE).update({with_members:[],with_groups:[]}).in('id',targetIds);
  if(error){btn.disabled=false;btn.textContent='함께한 태그 제거';_showShareToast('오류: '+error.message);return;}
  const{error:lockErr}=await sb.from(_YT_TABLE).update({tags_manual:true}).in('id',targetIds);
  if(lockErr){btn.disabled=false;btn.textContent='함께한 태그 제거';_showShareToast('오류: '+lockErr.message);return;}
  const affectedGkos=new Set(targets.map(v=>v.group_ko).filter(Boolean));
  window._adminBulkExitFn?.();
  affectedGkos.forEach(gko=>{_gcChVidCtl.reloadIfShowing(gko);_ttChVidCtl.reloadIfShowing(gko);});
  btn.disabled=false;btn.textContent='함께한 태그 제거';
  _showShareToast(`${targets.length}개 영상에서 함께한 멤버 태그 제거함`);
});

// ══════════════════════════════════════════════════════════════════════════════
// 관리자 홈 — "오늘 할 일" 대시보드 (2026-08-25 신설)
//
// 왜: 검수 큐가 3,051건 쌓이는 동안 아무도 안 봤고, 사용자 본인이 "이걸 해야 하는지 까먹고 있었다"고
// 했음. 원인은 의지가 아니라 **할 일이 있다는 걸 알 방법이 없던 것** — 버튼이 설정 패널에 20개 넘게
// 흩어져 있어서 매번 뭘 눌러야 하는지 기억해내야 했다. 숫자를 먼저 보여줘서 진입 이유를 만든다.
// 기존 버튼은 하나도 안 없앤다. 이 화면은 그 위에 얹는 진입점일 뿐이라 회귀 위험이 없다.
//
// ⚠️ 카드 카운트는 "빨라야" 의미가 있다(느리면 또 안 열게 됨). 무거운 집계(미태깅 155,070건은 5.6초)는
//    일부러 안 넣었다 — 숫자가 커도 행동으로 안 이어지는 지표라 넣을 이유도 없음.
const _ADM_LS={fbSeen:'kpu_adm_fb_seen',lastRun:'kpu_adm_last_routine'};
// yt_channel_videos.created_at은 2026-08-25에 추가했다. `add column ... default now()`라 **기존
// 371,448행이 전부 ALTER 시각(아래 값) 하나로 채워졌다** — 그래서 "최근 24시간" 같은 조건은 오늘
// 전체 테이블을 다 잡아버린다. 이 기준선보다 **큰** 것만이 진짜 신규 유입이다(실측으로 경계 확인).
// ⚠️ 이 상수는 지우지 말 것. 지우면 "신규" 숫자가 37만으로 튀어서 대시보드가 무의미해진다.
const _ADM_CREATED_BASELINE='2026-08-25T05:30:25Z';
function _admSetLog(text,cls){
  const el=document.getElementById('adm-routine-log');
  if(!el)return null;
  const d=document.createElement('div');
  d.className='adm-log-step'+(cls?' '+cls:'');
  d.textContent=text;
  el.appendChild(d);
  return d;
}
function _admCard(opt){
  const c=document.createElement('div');
  c.className='adm-card'+(opt.onClick?'':' adm-card-static');
  const l=document.createElement('div');l.className='adm-card-lbl';l.textContent=opt.lbl;
  const n=document.createElement('div');n.className='adm-card-num'+(opt.tone?' '+opt.tone:'');n.textContent=opt.num;
  c.appendChild(l);c.appendChild(n);
  const s=document.createElement('div');s.className='adm-card-sub';s.textContent=opt.sub||'';
  c.appendChild(s);
  if(opt.onClick)c.addEventListener('click',opt.onClick);
  return c;
}
// 마지막 루틴 실행 시각 — 기존 체크포인트(kpu_yt_last_*)는 "마지막 영상 id"라 시각 정보가 없어서
// 별도 타임스탬프를 남긴다(루틴 완료 시 기록).
// ⚠️ localStorage만 쓰면 기기별로 따로 논다 — 회사 PC에서 돌린 기록이 집 PC엔 안 보였음(2026-08-25).
//    그래서 공용 DB(atm_exception_rules를 범용 키-값으로 재사용, type='admin_meta')에도 남겨
//    어느 기기서든 같은 값이 보이게 한다. localStorage는 즉시표시/오프라인 폴백으로 유지.
function _admLastRunFmt(t){
  if(!t)return{num:'기록 없음',sub:'루틴을 한 번 돌리면 기록돼요',tone:'adm-zero'};
  const h=Math.floor((Date.now()-t)/3600000);
  const when=new Date(t).toLocaleString('ko-KR');
  if(h<1)return{num:'방금',sub:when,tone:''};
  if(h<24)return{num:h+'시간 전',sub:when,tone:''};
  const d=Math.floor(h/24);
  return{num:d+'일 전',sub:when,tone:d>=3?'adm-warn':''};
}
function _admLastRunLocal(){return Number(localStorage.getItem(_ADM_LS.lastRun)||0);}
async function _admReadLastRunDB(){
  try{
    const{data,error}=await sb.from('atm_exception_rules').select('value').eq('type','admin_meta').eq('key','last_routine').maybeSingle();
    if(error||!data)return 0;
    return Number(data.value)||0;
  }catch(e){return 0;}
}
async function _admWriteLastRunDB(ts){
  try{await sb.from('atm_exception_rules').upsert({type:'admin_meta',key:'last_routine',value:ts},{onConflict:'type,key'});}catch(e){}
}
// ⚠️ supabase-js는 `.select()`를 **먼저** 부른 뒤에야 필터(.eq/.in/.gt)를 걸 수 있다.
// 처음엔 `sb.from(X).eq(...)` 순서로 짰다가 카드가 전부 "?"(=조회 실패)로 떴음 — 호출부가
// "이미 select까지 끝난 쿼리"를 넘기도록 바꿔서 순서를 잘못 쓸 여지를 없앤다.
async function _admCount(q){
  try{
    const{count,error}=await q;
    if(error)return null;
    return count==null?0:count;
  }catch(e){return null;}
}
const _admHead=()=>({count:'exact',head:true});
async function _admLoadCards(){
  const wrap=document.getElementById('adm-cards');
  if(!wrap)return;
  wrap.innerHTML='';
  const lrLocal=_admLastRunFmt(_admLastRunLocal());
  const lrCard=_admCard({lbl:'마지막 루틴 실행',num:lrLocal.num,sub:lrLocal.sub,tone:lrLocal.tone});
  wrap.appendChild(lrCard);
  // 숫자가 늦게 와도 레이아웃이 안 튀도록 카드를 먼저 만들어 두고 나중에 채운다
  const mk=(lbl,sub,onClick)=>{const c=_admCard({lbl:lbl,num:'…',sub:'불러오는 중',onClick:onClick,tone:'adm-zero'});c.dataset.sub=sub;wrap.appendChild(c);return c;};
  const openVmTab=tab=>()=>{
    _admHomeClose();
    document.getElementById('sp-vm-btn')?.click();
    setTimeout(()=>document.querySelector('.vm-tab[data-tab="'+tab+'"]')?.click(),260);
  };
  const cReview=mk('그룹배정 검수 대기','눌러서 검수 탭 열기',openVmTab('review'));
  const cSs=mk('strictSync 오염 검수','흔한 이름 그룹 영상 점검',openVmTab('ss'));
  const cFb=mk('새 피드백','마지막으로 본 뒤 들어온 것',()=>{_admHomeClose();document.getElementById('sp-fb-btn')?.click();});
  const cNew=mk('새로 들어온 영상','눌러서 새 영상 검토·편집',openVmTab('new'));
  const cTagq=mk('검수 대기','애매한 태깅 — 눌러서 목록',()=>{_admHomeClose();_openTagReviewQueue();}); // 검수 대기열(2026-08-30)
  const set=(card,n,zeroSub)=>{
    const el=card.querySelector('.adm-card-num');
    const sub=card.querySelector('.adm-card-sub');
    if(n===null){el.textContent='?';el.className='adm-card-num adm-zero';if(sub)sub.textContent='조회 실패';return;}
    el.textContent=String(n);
    el.className='adm-card-num'+(n===0?' adm-zero':(n>=100?' adm-warn':''));
    if(sub)sub.textContent=(n===0&&zeroSub)?zeroSub:(card.dataset.sub||'');
  };
  // ⚠️ 여기서 그냥 return하면 카드가 "…" 상태로 영원히 굳는다(실제로 데스크톱에서 재현됨 — 홈을
  // 여는 시점에 Supabase 클라이언트가 아직 준비 전이면 숫자가 안 채워진 채로 끝났음).
  // 잠깐 기다렸다 다시 보고, 그래도 없으면 이유를 카드에 적는다.
  for(let i=0;i<20&&!sb;i++)await new Promise(r=>setTimeout(r,250));
  if(!sb){
    [cReview,cSs,cFb,cNew,cTagq].forEach(c=>{
      c.querySelector('.adm-card-num').textContent='—';
      c.querySelector('.adm-card-sub').textContent='DB 연결 대기 중';
    });
    return;
  }
  _tagReviewCount().then(n=>set(cTagq,n,'없어요 🎉')); // 검수 대기열 건수(테이블 없으면 null→"?")
  // 공용 DB의 마지막 실행 시각으로 카드 갱신(기기 간 공유). 로컬보다 최신이면 로컬도 맞춰둔다.
  _admReadLastRunDB().then(dbTs=>{
    const t=Math.max(dbTs,_admLastRunLocal());
    if(!t)return;
    const f=_admLastRunFmt(t);
    const n=lrCard.querySelector('.adm-card-num'),s=lrCard.querySelector('.adm-card-sub');
    if(n){n.textContent=f.num;n.className='adm-card-num'+(f.tone?' '+f.tone:'');}
    if(s)s.textContent=f.sub;
    if(dbTs>_admLastRunLocal()){try{localStorage.setItem(_ADM_LS.lastRun,String(dbTs));}catch(e){}}
  });
  const ssGkos=[..._STRICT_SYNC_GROUPS];
  // ⚠️ Promise.all로 묶어 한꺼번에 반영하면 **제일 느린 쿼리에 전부 발이 묶인다** — 콜드 커넥션에선
  // 첫 쿼리가 11초까지 걸리는 걸 실측했고(2026-08-25), 그동안 카드 셋이 다 "…"로 멈춰 있어서 화면이
  // 고장난 것처럼 보였음. 각자 도착하는 대로 채운다(피드백처럼 빠른 건 즉시 뜸).
  _admCount(_vmReviewQueueFilter(sb.from(_YT_TABLE).select('id',_admHead())))
    .then(n=>set(cReview,n,'다 봤어요'));
  (ssGkos.length?_admCount(sb.from(_YT_TABLE).select('id',_admHead()).in('group_ko',ssGkos).eq('tags_manual',false)):Promise.resolve(0))
    .then(n=>set(cSs,n,'깨끗해요'));
  (function(){
    const since=localStorage.getItem(_ADM_LS.fbSeen);
    const q=sb.from('feedback').select('id',_admHead());
    return _admCount(since?q.gt('created_at',since):q);
  })().then(n=>set(cFb,n,'새 피드백 없음'));
  _admCount(sb.from(_YT_TABLE).select('id',_admHead()).gt('created_at',_ADM_CREATED_BASELINE))
    .then(n=>set(cNew,n,'아직 없음 (기준: 08/25 컬럼 추가 시점)'));
}
function _admHomeClose(){document.getElementById('adm-home-overlay')?.classList.remove('open');}
function _admHomeOpen(){
  const ov=document.getElementById('adm-home-overlay');
  if(!ov)return;
  _admDockShow('adm-home-overlay');
  const log=document.getElementById('adm-routine-log');if(log)log.innerHTML='';
  _admLoadCards();
}
document.getElementById('sp-adm-home-btn')?.addEventListener('click',_admHomeOpen);
document.getElementById('adm-home-close')?.addEventListener('click',_admHomeClose);
document.getElementById('adm-home-overlay')?.addEventListener('click',function(e){if(e.target===e.currentTarget)_admHomeClose();});
// 데스크톱 도킹 모드(2026-08-28)에선 관리자 홈과 검수/영상/우선순위 패널이 좌측 슬롯 하나를 공유한다.
// 홈의 카드를 눌러 들어가면 홈이 닫히므로, 돌아올 경로가 없으면 "설정 패널 → 🏠" 왕복이 그대로 남는다.
// 각 도킹 패널 헤더의 🏠 버튼이 그 복귀 경로 — 현재 패널을 닫고 홈을 다시 연다(같은 슬롯이라 자연스럽게 교체됨).
document.querySelectorAll('.adm-back-home').forEach(function(btn){
  btn.addEventListener('click',function(e){
    e.stopPropagation();
    btn.closest('[data-modal]')?.classList.remove('open');
    _admHomeOpen();
  });
});
// 피드백 뷰어를 열면 "마지막으로 본 시각"을 기록 — 다음에 홈에서 "새 피드백 N건"의 기준이 된다.
document.getElementById('sp-fb-btn')?.addEventListener('click',function(){
  try{localStorage.setItem(_ADM_LS.fbSeen,new Date().toISOString());}catch(e){}
});

// ── 매일 루틴 실행기 ──────────────────────────────────────────────────────────
// 기존 1~4번 버튼을 순서대로 돌린다. 각 단계는 원래 함수를 그대로 호출하므로 동작이 갈릴 일이 없고,
// 진행 상황은 그 함수들이 쓰는 #sp-yt-prog 텍스트를 그대로 읽어서 보여준다.
// ⚠️ 요약이 핵심이다 — 실제로 "재태깅 눌렀는데 group_ko가 안 바뀌어서 다 된 건지 모르겠다"는 일이
//    있었음(2026-08-25). 단계마다 끝난 시점의 진행 문구를 남겨야 뭘 했는지 나중에 확인할 수 있다.
// ⚠️ 동기화(1번)는 YouTube API 쿼터에 걸려 수십 분씩 걸리거나 중간에 끊긴다 — 그래서 "동기화 빼고
//    실행"을 따로 뒀다. 쿼터를 아껴야 하거나 시간이 없을 때 2~4번만 돌리는 용도.
let _admRoutineRunning=false,_admRoutineStop=false;
async function _admRunRoutine(withSync){
  if(_admRoutineRunning)return;
  if(_admBusy){alert('다른 작업이 실행 중이에요: '+_admBusyLabel+'\n끝난 뒤에 다시 눌러주세요.');return;}
  _admRoutineRunning=true;_admRoutineStop=false;
  const runBtn=document.getElementById('adm-run-routine');
  const noSyncBtn=document.getElementById('adm-run-routine-nosync');
  const stopBtn=document.getElementById('adm-stop-routine');
  const log=document.getElementById('adm-routine-log');
  if(log)log.innerHTML='';
  if(runBtn)runBtn.disabled=true;
  if(noSyncBtn)noSyncBtn.disabled=true;
  if(stopBtn)stopBtn.style.display='';
  const steps=[];
  // ⚠️ 1번은 **설정 패널의 "1. 전체 동기화 (공식 + 외부 채널)" 버튼과 똑같은 3단계**여야 한다.
  //    2026-08-27까지 여기서 _ytSyncAll 하나만 불렀는데, 그 버튼의 핸들러는
  //    _ytSyncAll → _ytSyncExtChannels → _ytRefreshViewCounts 셋을 순서대로 부른다.
  //    그래서 루틴만 돌린 날은 **외부 채널(음방·예능·아이돌주도) 유입과 조회수 갱신이 통째로 빠졌다** —
  //    라벨엔 "전체 동기화"라고 떠 있는데 실제로는 공식 채널만 돈 것. 루틴 주석이 "원래 함수를 그대로
  //    호출하므로 동작이 갈릴 일이 없다"고 했지만, 버튼이 하는 일이 아니라 안쪽 함수 하나만 집어와서
  //    정확히 그 드리프트가 났다. tests/routine-parity.test.js가 이제 이 대응을 고정한다.
  //    비용: 둘 다 저렴하다 — 외부 채널은 playlistItems.list(쿼터 1/콜, sinceId 체크포인트로 증분),
  //    조회수는 videos.list(쿼터 1/콜, 최근 14일분만이라 ~70콜). 비싼 search.list는 과거 백필 전용.
  if(withSync){
    steps.push({name:'1. 전체 동기화 (공식 채널)',fn:_ytSyncAll});
    steps.push({name:'1-2. 외부 채널 동기화 (음방·예능·아이돌주도)',fn:_ytSyncExtChannels});
    steps.push({name:'1-3. 조회수 갱신 (최근 14일 · 이번주 직캠 TOP용)',fn:_ytRefreshViewCounts});
  }
  steps.push({name:'2. 멤버+콜라보 자동 태깅',fn:_ytAutoTagMembers});
  steps.push({name:'3. 콜라보 오태깅 재검증',fn:_ytSweepAmbiguousCollabMistag});
  steps.push({name:'4. 동명이인 그룹 오배정 스캔',fn:_ytScanAmbiguousNameGroupMisassignment});
  const t0=Date.now();
  for(let i=0;i<steps.length;i++){
    if(_admRoutineStop){_admSetLog('■ 사용자가 중단함','adm-log-fail');break;}
    const s=steps[i];
    const line=_admSetLog(s.name+' … 진행 중');
    try{
      await s.fn();
      // 각 함수가 마지막으로 남긴 진행/결과 문구를 그대로 요약으로 채택(문구 중복 정의를 피함)
      const prog=(document.getElementById('sp-yt-prog')?.textContent||'').trim();
      if(line){line.textContent='✅ '+s.name+'\n   '+(prog||'완료');line.className='adm-log-step adm-log-done';}
    }catch(e){
      if(line){line.textContent='❌ '+s.name+'\n   '+(e&&e.message?e.message:e);line.className='adm-log-step adm-log-fail';}
    }
  }
  const mins=Math.round((Date.now()-t0)/60000);
  _admSetLog('총 '+(mins<1?'1분 미만':mins+'분')+' 소요 — 카드 숫자를 다시 불러왔어요.','adm-log-done');
  const _now=Date.now();
  try{localStorage.setItem(_ADM_LS.lastRun,String(_now));}catch(e){}
  await _admWriteLastRunDB(_now);
  _admRoutineRunning=false;
  if(runBtn)runBtn.disabled=false;
  if(noSyncBtn)noSyncBtn.disabled=false;
  if(stopBtn)stopBtn.style.display='none';
  _admLoadCards();
}
document.getElementById('adm-run-routine')?.addEventListener('click',function(){_admRunRoutine(true);});
document.getElementById('adm-run-routine-nosync')?.addEventListener('click',function(){_admRunRoutine(false);});
document.getElementById('adm-stop-routine')?.addEventListener('click',function(){
  _admRoutineStop=true;
  _admSetLog('중단 요청됨 — 지금 단계가 끝나면 멈춰요(진행 중인 단계는 안전하게 마무리).');
});

// ══════════════════════════════════════════════════════════════════════════
// 공연(콘서트/팬미팅) 직접 추가 — #ev-overlay
//
// KOPIS는 국내 등록 공연만 다룬다. 해외 투어·소규모 팬미팅·자체 명칭 공연은 수집으로 안 잡혀서
// 그 구멍은 사람이 메울 수밖에 없다(2026-08-28 사용자 요청).
//
// 공연장은 **DB에 이미 쓰인 이름 중에서 고르는 게 기본**이다. 같은 장소가 '올림픽공원' /
// '올림픽공원 체조경기장' / 'KSPO돔' 으로 갈라지면 장소별 모아보기(_openVenueSheet)가 쪼개지고,
// 그때부터는 되돌리기가 훨씬 비싸진다. 목록에 없을 때만 직접 입력을 연다.
// ══════════════════════════════════════════════════════════════════════════
const _EV_TYPES=['콘서트','팬미팅','팬콘','페스티벌']; // DB의 type CHECK 제약과 같은 값이어야 한다
let _evVenues=null;   // [{name,city,count}] — 패널 열 때 DB에서 1회 로드
let _evCountries=[];
let _evWho=[];        // 선택한 그룹/멤버 이름 배열 → groups 컬럼
let _evAdded=[];      // 이번 세션에 넣은 것 [{id,title,date_start}]

function _evEl(id){return document.getElementById(id);}
// 이 프로젝트엔 공용 이스케이프 헬퍼가 없다. option value로 공연장·지역 이름이 들어가니 여기서만 쓰는 걸 둔다.
function _evEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _evStatus(msg,tone){
  const el=_evEl('ev-status');if(!el)return;
  el.textContent=msg||'';
  el.className=tone||'';
}

// DB에 쓰인 공연장/지역/국가를 모아 온다. 새로 적은 이름은 다음에 열 때 목록에 올라온다.
async function _evLoadVenues(force){
  if(_evVenues&&_evVenues.length&&!force)return _evVenues;
  let data=null,error=null;
  try{
    // 응답이 안 오면 select가 '불러오는 중…'에 갇혀 공연장을 아예 못 고르게 된다. 실제로 그렇게
    // 굳는 걸 보고 타임아웃을 넣었다 — 목록을 못 받아도 직접 입력으로는 넣을 수 있어야 한다.
    const res=await Promise.race([
      sb.from('kpop_events').select('venue,city,country').range(0,4999),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('시간 초과')),8000))
    ]);
    data=res&&res.data;error=res&&res.error;
  }catch(e){error=e;}
  if(error||!data){
    _evVenues=[];
    _evStatus('공연장 목록을 못 불러왔어요 — 직접 입력으로 넣을 수 있어요.','ev-err');
    return _evVenues;
  }
  const byName=new Map(),cities=new Set(),countries=new Set();
  data.forEach(r=>{
    const v=(r.venue||'').trim();
    if(r.city)cities.add(r.city.trim());
    if(r.country)countries.add(r.country.trim());
    if(!v)return;
    const cur=byName.get(v)||{name:v,city:(r.city||'').trim(),count:0};
    cur.count++;
    if(!cur.city&&r.city)cur.city=r.city.trim();
    byName.set(v,cur);
  });
  _evVenues=[...byName.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ko'));
  _evCountries=[...countries].sort();
  const cityDl=_evEl('ev-city-list');
  if(cityDl)cityDl.innerHTML=[...cities].sort().map(c=>'<option value="'+_evEsc(c)+'">').join('');
  const cDl=_evEl('ev-country-list');
  if(cDl)cDl.innerHTML=_evCountries.map(c=>'<option value="'+_evEsc(c)+'">').join('');
  return _evVenues;
}

function _evFillVenueSelect(keep){
  const sel=_evEl('ev-venue');if(!sel)return;
  const prev=keep||sel.value;
  const list=_evVenues||[];
  sel.innerHTML='<option value="">— 공연장 선택 —</option>'
    +list.map(v=>'<option value="'+_evEsc(v.name)+'">'+_evEsc(v.name)+(v.city?' · '+_evEsc(_shortCity(v.city)):'')+'</option>').join('')
    +'<option value="__custom__">＋ 목록에 없음 · 직접 입력</option>';
  if(prev)sel.value=prev;
  if(sel.value!==prev)sel.value='';
  // 목록을 못 받았으면 고를 게 없으니 직접 입력을 미리 펼쳐둔다(빈 select 앞에서 막히지 않게).
  if(!list.length&&!prev){
    sel.value='__custom__';
    const box=_evEl('ev-venue-custom');
    if(box)box.style.display='block';
  }
}

// 직접 입력한 이름이 기존 공연장의 표기 흔들림일 가능성을 알려준다. 막지는 않고 경고만 — 진짜 새
// 공연장일 수도 있으니 판단은 사람이 한다.
function _evNearestVenues(name){
  const q=(name||'').replace(/[\s()·・.,]/g,'').toLowerCase();
  if(q.length<2)return [];
  return (_evVenues||[]).filter(v=>{
    const t=v.name.replace(/[\s()·・.,]/g,'').toLowerCase();
    return t.includes(q)||q.includes(t);
  }).slice(0,4).map(v=>v.name);
}

function _evRenderWhoChips(){
  const box=_evEl('ev-who-chips');if(!box)return;
  box.innerHTML='';
  _evWho.forEach(name=>{
    const chip=document.createElement('span');chip.className='ev-chip';
    chip.textContent=name;
    const x=document.createElement('button');x.type='button';x.textContent='×';
    x.addEventListener('click',()=>{_evWho=_evWho.filter(n=>n!==name);_evRenderWhoChips();});
    chip.appendChild(x);box.appendChild(chip);
  });
}

// 그룹명과 멤버명을 같은 목록에서 찾는다 — 솔로 공연은 groups 컬럼에 멤버 이름이 들어가고,
// 카드 쪽(_loadMemberConcertRow)이 그 이름으로 바로 조회하기 때문에 별도 구분이 필요 없다.
function _evRenderWhoResults(q){
  const box=_evEl('ev-who-results');if(!box)return;
  box.innerHTML='';
  const s=(q||'').trim().toLowerCase();
  if(s.length<1)return;
  const hits=[];
  Object.keys(GROUPS).forEach(gko=>{
    const g=GROUPS[gko];
    const en=String((g&&g.name&&g.name.en)||(g&&g.en)||'').toLowerCase();
    if(gko.toLowerCase().includes(s)||(en&&en.includes(s)))hits.push({name:gko,sub:'그룹'});
  });
  (typeof ARTISTS!=='undefined'?ARTISTS:[]).forEach(a=>{
    const ko=(a&&a.name&&a.name.ko)||'';if(!ko)return;
    const en=String((a&&a.name&&a.name.en)||'').toLowerCase();
    if(ko.toLowerCase().includes(s)||(en&&en.includes(s))){
      const gs=(_artistGroups(a)||[]).map(g=>g.ko).join(', ');
      hits.push({name:ko,sub:gs||'솔로'});
    }
  });
  const seen=new Set();
  hits.filter(h=>{const k=h.name+'|'+h.sub;if(seen.has(k))return false;seen.add(k);return true;})
    .slice(0,12).forEach(h=>{
      const row=document.createElement('button');row.type='button';row.className='ev-res';
      row.innerHTML='<b>'+_evEsc(h.name)+'</b><span>'+_evEsc(h.sub)+'</span>';
      row.addEventListener('click',()=>{
        if(!_evWho.includes(h.name))_evWho.push(h.name);
        _evRenderWhoChips();
        const inp=_evEl('ev-who-search');if(inp)inp.value='';
        box.innerHTML='';
      });
      box.appendChild(row);
    });
}

// 같은 공연을 두 번 넣는 게 제일 흔한 실수라 저장 전이 아니라 **입력 중에** 알려준다.
let _evDupTimer=null;
function _evCheckDup(){
  clearTimeout(_evDupTimer);
  _evDupTimer=setTimeout(async()=>{
    const el=_evEl('ev-dup');if(!el)return;
    const title=(_evEl('ev-name')?.value||'').trim();
    const start=_evEl('ev-start')?.value||'';
    if(!title||!start){el.textContent='';return;}
    const{data}=await sb.from('kpop_events').select('id,title,date_start,venue').eq('date_start',start).limit(50);
    const norm=s=>String(s||'').replace(/\s+/g,'').toLowerCase();
    const hit=(data||[]).find(r=>norm(r.title)===norm(title));
    el.textContent=hit?('⚠ 같은 날짜에 같은 이름의 공연이 이미 있어요 — '+(hit.venue||'장소 미상')):'';
  },350);
}

function _evRenderAdded(){
  const box=_evEl('ev-recent');if(!box)return;
  box.innerHTML='';
  if(!_evAdded.length)return;
  const head=document.createElement('div');head.className='ev-recent-head';
  head.textContent='이번에 추가한 공연 '+_evAdded.length+'건';
  box.appendChild(head);
  _evAdded.forEach(r=>{
    const row=document.createElement('div');row.className='ev-recent-row';
    const t=document.createElement('span');t.textContent=r.date_start+' · '+r.title;
    const del=document.createElement('button');del.type='button';del.textContent='되돌리기';
    del.addEventListener('click',async()=>{
      const{error}=await sb.from('kpop_events').delete().eq('id',r.id);
      if(error){_evStatus('되돌리기 실패: '+error.message,'ev-err');return;}
      _evAdded=_evAdded.filter(x=>x.id!==r.id);
      _evRenderAdded();
      _evStatus('되돌렸어요.','ev-ok');
    });
    row.appendChild(t);row.appendChild(del);box.appendChild(row);
  });
}

async function _evSave(){
  const title=(_evEl('ev-name')?.value||'').trim();
  const type=_evEl('ev-type')?.value||'';
  const start=_evEl('ev-start')?.value||'';
  let end=_evEl('ev-end')?.value||'';
  const sel=_evEl('ev-venue')?.value||'';
  const venue=(sel==='__custom__'?(_evEl('ev-venue-custom')?.value||''):sel).trim();
  const city=(_evEl('ev-city')?.value||'').trim();
  const country=(_evEl('ev-country')?.value||'').trim()||'대한민국';
  const poster=(_evEl('ev-poster')?.value||'').trim();
  const official=(_evEl('ev-official')?.value||'').trim();

  if(!title){_evStatus('공연명을 적어줘.','ev-err');return;}
  if(!_EV_TYPES.includes(type)){_evStatus('종류가 이상해.','ev-err');return;}
  if(!start){_evStatus('시작일을 골라줘.','ev-err');return;}
  if(!venue){_evStatus('공연장을 고르거나 직접 적어줘.','ev-err');return;}
  if(!_evWho.length){_evStatus('출연 그룹/멤버를 하나 이상 골라줘.','ev-err');return;}
  if(!end)end=start;
  if(end<start){_evStatus('종료일이 시작일보다 빨라.','ev-err');return;}

  _evStatus('저장 중…','');
  const row={title:title,type:type,date_start:start,date_end:end,venue:venue,city:city,country:country,groups:_evWho.slice()};
  if(poster)row.poster_url=poster;
  if(official)row.official_url=official;
  const{data,error}=await sb.from('kpop_events').insert(row).select('id').single();
  if(error){_evStatus('저장 실패: '+error.message,'ev-err');return;}

  _evAdded.unshift({id:data.id,title:title,date_start:start});
  _evRenderAdded();
  // 한 팀의 투어 날짜를 연달아 넣는 일이 많아서 출연·공연장·지역은 남기고 공연명·날짜만 비운다.
  _evEl('ev-name').value='';
  _evEl('ev-start').value='';
  _evEl('ev-end').value='';
  _evEl('ev-poster').value='';
  _evEl('ev-official').value='';
  _evEl('ev-dup').textContent='';
  _evStatus('저장했어요. 같은 팀 다음 공연을 이어서 넣을 수 있어요.','ev-ok');
  // 새로 적은 공연장을 목록에 바로 반영해서, 두 번째 공연부터는 고르기만 하면 되게 한다.
  if(sel==='__custom__'){
    _evVenues=null;
    await _evLoadVenues(true);
    _evFillVenueSelect(venue);
    _evEl('ev-venue-custom').style.display='none';
    _evEl('ev-venue-near').textContent='';
  }
  _evEl('ev-name').focus();
}

async function _evOpen(){
  const ov=_evEl('ev-overlay');if(!ov)return;
  ov.classList.add('open');
  if(typeof _bringToFront==='function')_bringToFront(ov);
  // 지난번에 목록을 못 받았으면 다시 연다 = 다시 시도할 기회다. options 유무가 아니라
  // 목록을 실제로 갖고 있는지로 판단한다(실패 시 '직접 입력' 옵션만 남아 옵션 수는 0이 아니다).
  const sel=_evEl('ev-venue');
  if(sel&&!(_evVenues&&_evVenues.length)){
    sel.innerHTML='<option value="">불러오는 중…</option>';
    await _evLoadVenues();
    _evFillVenueSelect();
  }
  _evEl('ev-name')?.focus();
}

_evEl('sp-ev-btn')?.addEventListener('click',_evOpen);
_evEl('ev-close')?.addEventListener('click',()=>_evEl('ev-overlay').classList.remove('open'));
_evEl('ev-cancel')?.addEventListener('click',()=>_evEl('ev-overlay').classList.remove('open'));
_evEl('ev-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');});
_evEl('ev-save')?.addEventListener('click',_evSave);
_evEl('ev-name')?.addEventListener('input',_evCheckDup);
_evEl('ev-start')?.addEventListener('change',_evCheckDup);
_evEl('ev-who-search')?.addEventListener('input',e=>_evRenderWhoResults(e.target.value));
_evEl('ev-venue')?.addEventListener('change',e=>{
  const custom=e.target.value==='__custom__';
  const box=_evEl('ev-venue-custom');
  if(box){box.style.display=custom?'block':'none';if(custom)box.focus();}
  _evEl('ev-venue-near').textContent='';
  if(!custom){
    // 저장은 DB에 이미 쓰인 표기 그대로(=수집분과 같은 '인천광역시'). 화면에서 '인천'으로 줄이는 건
    // _shortCity가 표시할 때 하는 일이고, DB에 축약형을 섞어 넣으면 같은 도시가 두 값으로 갈린다.
    const v=(_evVenues||[]).find(x=>x.name===e.target.value);
    const cityEl=_evEl('ev-city');
    if(v&&v.city&&cityEl)cityEl.value=v.city;
  }
});
_evEl('ev-venue-custom')?.addEventListener('input',e=>{
  const near=_evNearestVenues(e.target.value);
  const el=_evEl('ev-venue-near');
  if(el)el.textContent=near.length?('혹시 이거? — '+near.join(' / ')):'';
});
