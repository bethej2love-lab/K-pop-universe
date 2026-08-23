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
function _ytClassify(title){
  const t=(title||'').toUpperCase();
  if(/OFFICIAL\s+AUDIO|공식\s*음원/.test(t))return'skip';
  if(/\bTEASER\b|티저/.test(t))return'skip';
  if(/\bSHORTS?\b/.test(t)||/#SHORTS?/.test(t))return'short';
  // "M/V"(슬래시 표기)를 놓치고 있었음 — M.V./MV/M V는 잡혔는데 슬래시형만 빠져서, 이렇게 쓴 진짜
  // 뮤직비디오가 mv로 안 걸러지고 live 등 다른 카테고리로 새서 무대/직캠 모음에 섞여 들어감
  // (2026-08-20, 사용자 제보 — 전소미 영상이 남돌 무대 모음에 낀 사고).
  if(/\bM[.\/]?V\.?\b|\bMUSIC\s+VIDEO\b|뮤직?\s*비디오|뮤비/.test(t))return'mv';
  if(_YT_BROADCAST_RE.test(t))return'other';
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
function _disbandCutoffDate(ko){
  const d=GROUPS[ko]?.disbanded;
  if(!d||d===true)return null;
  const m=String(d).match(/^(\d{4})(?:\.(\d{2})\.(\d{2}))?/);
  if(!m)return null;
  const[,y,mo,day]=m;
  return mo&&day?`${y}-${mo}-${day}`:`${y}-12-31`;
}
// 그룹은 그대로 활동 중인데 개별 멤버만 탈퇴한 경우(artists.json의 left 필드, "YYYY.MM.DD")의 자동 태깅
// 컷오프 — 위 _disbandCutoffDate와 같은 이유, 대상만 그룹 전체 대신 멤버 한 명. 탈퇴일 이후 올라온
// 영상까지 그 멤버로 계속 태깅되면(특히 흔한 단어/영단어 이름은 오탐까지 겹쳐 악화됨) 탈퇴한 멤버가
// 여전히 활동 중인 것처럼 보이는 문제가 있음(2026-08-19, 사용자 제보 — 온리원오프 Love, 2021.08.02 탈퇴
// 이후에도 계속 신규 영상에 태깅되던 사례로 발견). left 필드가 없으면(탈퇴일 미상) 컷오프 없이 기존대로.
function _memberLeftCutoffDate(a){
  const l=a&&a.left;
  if(!l)return null;
  const m=String(l).match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return m?`${m[1]}-${m[2]}-${m[3]}`:null;
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
      const publishedAt=(item.snippet.publishedAt||'').slice(0,10);
      if(cutoffDate&&publishedAt>cutoffDate)continue; // 해체 이후 올라온 영상은 수집 대상에서 제외
      const th=item.snippet.thumbnails||{};
      // 쇼츠는 세로 비율을 유지하는 썸네일(medium/default는 항상 16:9로 잘려있어 세로 판별 불가)이
      // 필요해서 maxres/standard/high 중 하나를 봐야 하는데, 우선순위를 maxres부터 두면 저장되는
      // thumb URL 자체가 무겁고(용량 큼) 탐험 탭처럼 여러 개를 한 번에 보여주는 화면에서 로딩이
      // 느려지는 원인이 됨(2026-08-10, 사용자 제보). high(480x360)부터 우선하도록 뒤집음 — 세로
      // 판별에는 어차피 다 같은 비율이라 영향 없고, 용량만 가벼워짐.
      const hiTh=th.high||th.standard||th.maxres;
      const isShortThumb=!!(hiTh&&hiTh.height>hiTh.width);
      let cat=isShortThumb?'short':_ytClassify(title);
      if(cat==='skip')continue;
      vids.push({
        id:vid,
        title,
        description:_decodeHtmlEntities(item.snippet.description||''), // part=snippet 응답에 이미 포함돼있던 걸 그냥 버렸었음 — 쿼터 추가 비용 없이 태깅 보조 텍스트로 재사용
        thumb:isShortThumb?(hiTh.url||th.medium?.url||''):(th.medium?.url||th.high?.url||th.default?.url||''),
        published_at:publishedAt,
        category:cat
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
    const rows=vids.map(v=>({...v,group_ko:ko,title_norm:_titleNorm(v.title),...(_isJunkVideoTitle(v.title)?{content_flag:'무관'}:{})}));
    for(let i=0;i<rows.length;i+=200){
      const{error}=await sb.from(_YT_TABLE).upsert(rows.slice(i,i+200));
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
  // 효연·설아·슬기처럼 실제 그룹 소속이 있어도 본인 개인 채널이 따로 있는 멤버 — artists.json의
  // channels[]. 한 사람이 채널을 여러 개 가질 수 있어서(효연: 공식+개인 콘텐츠) syncKey를 채널별로
  // 다르게 줘서 체크포인트가 서로 안 꼬이게 한다(위 _ytSyncGroup 주석 참고). 저장되는 group_ko는
  // 채널이 몇 개든 항상 본인 이름 하나로 통일 — 같은 사람 콘텐츠로 묶여야 카드에서 다 보임.
  const personal=[];
  ARTISTS.forEach(a=>{
    (a.channels||[]).forEach((ch,i)=>{
      if(!ch?.url)return;
      personal.push({ko:a.name.ko,url:ch.url,syncKey:`${a.name.ko}__${i}`});
    });
  });
  const targets=[...groups,...solos,...personal];
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
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    _ytSetProg(`조회수 조회 중… ${Math.min(i+50,ids.length)}/${ids.length}`);
    try{
      const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${key}`);
      if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
      const d=await r.json();
      if(d.error)throw new Error(d.error.message);
      (d.items||[]).forEach(it=>{
        const vc=parseInt(it.statistics?.viewCount,10);
        if(!isNaN(vc))statsUpdates.push({id:it.id,view_count:vc});
      });
    }catch(e){console.error('[조회수 갱신] 실패:',e.message);}
  }
  if(!statsUpdates.length){_ytSetProg('조회수 갱신: 반영할 값 없음');return;}
  let saved=0,failed=0;
  for(let i=0;i<statsUpdates.length;i+=50){
    _ytSetProg(`조회수 저장 중… ${i}/${statsUpdates.length}`);
    const results=await Promise.all(
      statsUpdates.slice(i,i+50).map(({id,view_count})=>
        sb.from(_YT_TABLE).update({view_count}).eq('id',id)
      )
    );
    results.forEach(({error:ue})=>{if(ue){failed++;console.error('[조회수 갱신] 저장 실패:',ue.message);}else saved++;});
    if(failed){_ytSetProg(`저장 실패 (${failed}건): 콘솔 확인`);return;}
  }
  _ytSetProg(`조회수 갱신 완료 — ${saved}개`);
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
  for(let i=0;i<statsUpdates.length;i+=50){
    _ytSetProg(`저장 중… ${i}/${statsUpdates.length}`);
    const results=await Promise.all(
      statsUpdates.slice(i,i+50).map(({id,view_count})=>
        sb.from(_YT_TABLE).update({view_count}).eq('id',id)
      )
    );
    results.forEach(({error:ue})=>{if(ue){failed++;console.error('[전체 조회수 갱신] 저장 실패:',ue.message);}else saved++;});
    if(failed){_ytSetProg(`저장 실패 (${failed}건): 콘솔 확인`);return;}
  }
  _ytSetProg(`전체 조회수 갱신 완료 — ${saved}개 (live 카테고리 · API ${totalCalls}회 사용)`);
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
const VIEW_COUNT_ROTATE_BATCH=5000;
async function _ytRotateViewCountRefresh(){
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _ytSetProg('순환 갱신 대상 조회 중 (가장 오래전에 갱신된 것부터, 전체 카테고리)…');
  const{data:rows,error}=await sb.from(_YT_TABLE)
    .select('id')
    .order('view_count_synced_at',{ascending:true,nullsFirst:true})
    .limit(VIEW_COUNT_ROTATE_BATCH);
  if(error){_ytSetProg('대상 조회 실패: '+error.message);return;}
  if(!rows?.length){_ytSetProg('순환 갱신 대상 없음');return;}
  const ids=rows.map(r=>r.id);
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
    const results=await Promise.all(statsUpdates.map(({id,view_count,touchOnly})=>
      sb.from(_YT_TABLE).update(touchOnly?{view_count_synced_at:nowIso}:{view_count,view_count_synced_at:nowIso}).eq('id',id)
    ));
    results.forEach(({error:ue})=>{if(ue){failedTotal++;console.error('[조회수 순환 갱신] 저장 실패:',ue.message);}else savedTotal++;});
    if(failedTotal){_ytSetProg(`저장 실패 (${failedTotal}건): 콘솔 확인`);return;}
  }
  _ytSetProg(`조회수 순환 갱신 완료 — ${savedTotal}개 (전체 카테고리 · API ${totalCalls}회 사용, 다음 실행 땐 이어서 오래된 것부터)`);
  _feedDiscoveryBuiltAt=0;
}

// 연도별 TOP 100 최초 백필(일회용) — 위 "전체 조회수 갱신"은 이미 조회수가 있는 영상만 다시 갱신하는
// 거라, 오래된 연도 라이브 영상은 조회수를 한 번도 못 받아본 채로 계속 비어있었음(2026-08-12, 사용자
// 제보 — "왜 2026년만 뽑히고 다른 연도 TOP은 안 뜨지" → 실측해보니 live 95,461건 중 조회수 있는 건
// 756건뿐이고 전부 2026년 발행분). "조회수만 갱신"(최근 14일)과 "전체 갱신"(이미 있는 것만) 사이에
// 뚫려있던 구멍을 메우는 용도 — is('view_count',null)인 것만 대상으로 하므로, 중간에 탭을 닫아도
// 다시 누르면 이미 채운 것은 건너뛰고 이어서 진행됨(자연히 재개 가능). 규모가 커서(live 전체, API
// 약 1900회) 한 번 돌리면 오래 걸리니 완료 후엔 다시 쓸 일 없음 — 이후엔 "전체 조회수 갱신"으로 월 1회
// 최신화만 하면 충분.
async function _ytBackfillAllViewCounts(){
  const key=_ytApiKey();
  if(!key){_ytSetProg('API 키를 먼저 입력해주세요');return;}
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  _ytSetProg('백필 대상 조회 중 (조회수 없는 live 전체)…');
  const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
    .select('id')
    .eq('category','live')
    .is('view_count',null)
    .order('id'));
  if(error){_ytSetProg('대상 조회 실패: '+error.message);return;}
  if(!rows?.length){_ytSetProg('백필 대상 없음(전부 조회수 있음)');return;}
  const ids=rows.map(r=>r.id);
  const totalCalls=Math.ceil(ids.length/50);
  _ytSetProg(`YouTube API 호출 예정: ${totalCalls}회 (${ids.length}개 영상) — 시간이 꽤 걸릴 수 있어요, 탭을 계속 열어두세요`);
  let savedTotal=0,failedTotal=0;
  for(let i=0;i<ids.length;i+=50){
    const chunk=ids.slice(i,i+50);
    _ytSetProg(`백필 중… ${Math.min(i+50,ids.length)}/${ids.length} (API ${Math.floor(i/50)+1}/${totalCalls}회, 저장 ${savedTotal}개)`);
    const statsUpdates=[];
    try{
      const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${key}`);
      if(!r.ok)throw new Error('YouTube API 오류 '+r.status);
      const d=await r.json();
      if(d.error)throw new Error(d.error.message);
      (d.items||[]).forEach(it=>{
        const vc=parseInt(it.statistics?.viewCount,10);
        if(!isNaN(vc))statsUpdates.push({id:it.id,view_count:vc});
      });
    }catch(e){
      _ytSetProg(`YouTube API 오류(${savedTotal}개까지 저장된 채로 중단, 다시 누르면 이어서 진행됨): `+e.message);
      console.error('[연도별TOP 백필]',e.message);
      return;
    }
    if(statsUpdates.length){
      const results=await Promise.all(statsUpdates.map(({id,view_count})=>sb.from(_YT_TABLE).update({view_count}).eq('id',id)));
      results.forEach(({error:ue})=>{if(ue){failedTotal++;console.error('[연도별TOP 백필] 저장 실패:',ue.message);}else savedTotal++;});
    }
  }
  _ytSetProg(`연도별 TOP 백필 완료 — ${savedTotal}개 저장${failedTotal?`, 실패 ${failedTotal}건`:''} (API ${totalCalls}회 사용)`);
  _feedDiscoveryBuiltAt=0;
}

function _ytSetProg(msg){const el=document.getElementById('sp-yt-prog');if(el)el.textContent=msg;}

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
async function _sbFetchAll(buildQuery,pageSize=1000){
  const rows=[];let cursor=null;
  while(true){
    let q=buildQuery().limit(pageSize);
    if(cursor!==null)q=q.gt('id',cursor);
    const{data,error}=await q;
    if(error)return{data:null,error};
    if(!data?.length)break;
    rows.push(...data);
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
      const{error:ue}=await sb.from(_YT_TABLE).update({content_flag:'hidden'}).in('id',toHide.slice(i,i+200));
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
      .select('id,title')
      .eq('tags_manual',false) // 관리자가 직접 저장한 행은 절대 안 건드림
      .or('content_flag.is.null,content_flag.neq.무관')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');localStorage.setItem('kpu_junk_sweep_version',version);return;}
    const toFlag=rows.filter(v=>_isJunkVideoTitle(v.title)).map(v=>v.id);
    if(!toFlag.length){_ytSetProg(`검사 완료 — ${rows.length}개 중 해당 없음`);localStorage.setItem('kpu_junk_sweep_version',version);return;}
    await _snapshotBeforeBulk('제외 키워드 영상 무관 정리',toFlag);
    for(let i=0;i<toFlag.length;i+=200){
      const{error:ue}=await sb.from(_YT_TABLE).update({content_flag:'무관'}).in('id',toFlag.slice(i,i+200));
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
      .select('id,title,group_ko,with_members,with_groups,tags_manual')
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
      const match=_m2ParseTitle(v.title||'',v.group_ko);
      const curWG=v.with_groups||[],curWM=v.with_members||[];
      // validGroups: 다시 봐도 "그룹 단위로만" 근거 있는 것(특정 멤버까진 아직 특정 안 됨) — 그대로 유지.
      // promote: 예전엔 그룹 단위로만 태깅됐지만(curWG에 있음) 지금 다시 매칭해보니 특정 멤버까지 잡히는 것
      // — 이대휘(AB6IX) 사례(2026-08-10, 사용자 제보)처럼 매칭 로직이 나중에 개선되면서(해시태그 부분
      // 문자열 인식 등) 예전엔 그룹으로만 뭉뚱그려졌던 태그를 지금은 더 정확히 특정할 수 있는 경우.
      // 예전 버전은 "여전히 유효한지"만 보고 교집합만 남겨서, 이런 케이스는 group 쪽에서 근거를 잃어도
      // (validGroups에 안 들어가서 제거는 되지만) with_members로 승격은 전혀 안 돼 그냥 통째로 날아갔었음
      // — 그룹 태그가 사라지긴 해도 더 정확한 멤버 태그로 안 바뀌니 사실상 퇴화였음. 이번에 승격 로직 추가.
      // consolidate: 그 반대 방향 — 멤버 개별로 나열돼있었는데(curWM) 다시 보니 활동중 멤버 전원이 매칭돼
      // _classifyGuestGroup이 asGroup으로 판정하는 경우, 그룹 단위 태그로 뭉친다("멤버 전체 나오는 영상인데
      // 이름이 죽 나열된다"는 사용자 제보, 2026-08-14). 이 영상에 그 그룹의 with_members 흔적이 이미 있던
      // 경우에만 발동(curWM.some(...)) — 원래 이 함수는 "기존 태그 정리"만 하는 도구라, 아예 처음부터
      // 안 걸려있던 콜라보를 새로 발견해서 추가하는 건 범위 밖(그건 자동 태깅/재태깅 버튼의 몫).
      const validGroups=new Set(),validMembers=new Set(),promote=new Map(),consolidate=new Set();
      if(match){
        const otherGkos=[match.primaryGroup,...match.withGroups].filter(og=>og&&og!==v.group_ko);
        otherGkos.forEach(og=>{
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
      const newWG=[...new Set([...curWG.filter(g=>validGroups.has(g)),...consolidate])];
      const promotedTags=[...promote.values()].flat();
      const newWM=[...new Set([...curWM.filter(m=>validMembers.has(m)),...promotedTags])];
      const patch={};
      if(newWG.length!==curWG.length||newWG.some((g,i)=>g!==curWG[i]))patch.with_groups=newWG;
      if(newWM.length!==curWM.length||newWM.some(m=>!curWM.includes(m)))patch.with_members=newWM;
      if(!Object.keys(patch).length)return;
      if(v.tags_manual){manualSkipped++;return;} // 수동 편집 행은 절대 안 고침 — 대신 개수만 집계
      updates.push({id:v.id,patch});
      if(!newWG.length&&!newWM.length)wipedOut.push({id:v.id,title:v.title,removedGroups:curWG,removedMembers:curWM});
    });
    if(!updates.length){
      _ytSetProg(`검사 완료 — ${rows.length}개 중 오염 없음`+(manualSkipped?` (단, 수동 편집이라 건드리지 않고 넘어간 것 ${manualSkipped}개 있음 — 직접 확인 필요)`:''));
      return;
    }
    if(wipedOut.length){
      console.log(`[콜라보 오태깅 재검증] 콜라보 태그가 전부 빠진 행 ${wipedOut.length}개 — 무관 콘텐츠인지 직접 확인 필요:`,wipedOut);
    }
    await _snapshotBeforeBulk('콜라보 오태깅 재검증(전체)',updates.map(u=>u.id));
    for(let i=0;i<updates.length;i+=200){
      const chunk=updates.slice(i,i+200);
      const results=await Promise.all(chunk.map(u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id)));
      const failed=results.find(r=>r.error);
      if(failed)throw new Error(failed.error.message);
      _ytSetProg(`[콜라보 오태깅 재검증] ${Math.min(i+200,updates.length)}/${updates.length}개 처리 중…`);
    }
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
      const roster=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===v.group_ko)).map(a=>({ko:a.name.ko,en:a.name.en,left:a.left}));
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
    }
    await _snapshotBeforeBulk('자체 멤버 태깅 재검증(전체)',updates.map(u=>u.id));
    for(let i=0;i<updates.length;i+=200){
      const chunk=updates.slice(i,i+200);
      const results=await Promise.all(chunk.map(u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id)));
      const failed=results.find(r=>r.error);
      if(failed)throw new Error(failed.error.message);
      _ytSetProg(`[자체 멤버 태깅 재검증] ${Math.min(i+200,updates.length)}/${updates.length}개 처리 중…`);
    }
    _ytSetProg(`완료! ${rows.length}개 중 ${updates.length}개에서 근거 없는 멤버 태그 제거함`+(wipedOut.length?` (그중 ${wipedOut.length}개는 태그가 전부 빠짐 — 콘솔 확인 후 무관 처리 여부 직접 판단 필요)`:''));
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
async function _ytExtractCoverSongTitles(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-covertitle-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[커버곡 제목 추출] 대상 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,cover_of_members,cover_of_groups,tags_manual')
      .or('cover_of_members.neq.{},cover_of_groups.neq.{}')
      .or('title_norm.ilike.*cover*,title_norm.ilike.*커버*,title_norm.ilike.*원곡*,title_norm.ilike.*original*,content_formats.cs.{cover}')
      .is('cover_of_song',null)
      .order('id'));
    if(error){_ytSetProg('[커버곡 제목 추출] 조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('[커버곡 제목 추출] 대상 없음(이미 다 처리됐거나 새 커버 영상 없음)');return;}
    const updates=[];
    let manualSkipped=0,noMatch=0;
    rows.forEach(v=>{
      if(v.tags_manual){manualSkipped++;return;}
      const cand=_ytCoverSongCandidate(v.title);
      if(!cand){noMatch++;return;}
      const origNames=[...(v.cover_of_members||[]),...(v.cover_of_groups||[])];
      const song=_ytMatchCoverSong(cand,origNames);
      if(song)updates.push({id:v.id,cover_of_song:song});
      else noMatch++;
    });
    await _snapshotBeforeBulk('커버곡 원곡 제목 자동 추출',updates.map(u=>u.id));
    for(let i=0;i<updates.length;i+=50){
      _ytSetProg(`[커버곡 제목 추출] 저장 중… ${i}/${updates.length}`);
      await Promise.all(updates.slice(i,i+50).map(({id,cover_of_song})=>
        sb.from(_YT_TABLE).update({cover_of_song}).eq('id',id)
      ));
    }
    _ytSetProg(`[커버곡 제목 추출] 완료 — ${rows.length}개 중 ${updates.length}개 확인됨, ${noMatch}개는 확인 불가`+(manualSkipped?`, 수동태그 ${manualSkipped}개 건너뜀`:'')+' (재실행하면 이어서 시도됨)');
  }finally{
    if(btn)btn.disabled=false;
  }
}

// ── 일괄 작업 실행 취소(undo) 스냅샷 ─────────────────────────────────────────────
// 대량 스윕/재검증/재스캔 버튼이 수백~수만 행을 자동으로 바꾸기 "직전"에, 바뀔 행들의 현재값을
// admin_bulk_snapshots 테이블에 1회분(batch)으로 떠둔다. 오조작 시 "↩︎ 마지막 일괄 작업 되돌리기"
// 버튼이 그 batch를 통째로 복원 — undo가 곧 백업이 되는 구조(2026-08-22, 자문 백업전략 #1, 3.5만
// 재스캔 사고 재발 방지책). 어느 버튼이 어느 컬럼을 바꾸든 하나의 헬퍼로 커버하려고, 이 관리도구들이
// 바꿀 수 있는 컬럼 전부를 고정 목록으로 떠둔다(안 바뀐 컬럼까지 복원해도 값이 같아 무해).
const _BULK_SNAP_TABLE='admin_bulk_snapshots';
const _BULK_SNAP_COLS=['group_ko','members','with_members','with_groups','content_flag','needs_review','cover_of_members','cover_of_groups','cover_of_song','tags_manual'];
// 영향받는 id들의 "바꾸기 전" 값을 떠서 batch로 저장한다. 실패해도(테이블 없음/권한 등) 원래 작업은
// 막지 않고 안내만 남긴다 — 스냅샷이 안 됐다고 관리도구 자체가 멈추면 안 됨(그만큼 되돌리기만 불가).
async function _snapshotBeforeBulk(opLabel,ids){
  if(!sb||!ids||!ids.length)return null;
  const uniq=[...new Set(ids)];
  const batchId=(self.crypto&&self.crypto.randomUUID)?self.crypto.randomUUID():('b'+Date.now()+Math.random().toString(36).slice(2));
  try{
    let saved=0;
    for(let i=0;i<uniq.length;i+=200){
      const chunk=uniq.slice(i,i+200);
      const{data:rows,error}=await sb.from(_YT_TABLE).select(['id',..._BULK_SNAP_COLS].join(',')).in('id',chunk);
      if(error)throw new Error(error.message);
      if(!rows||!rows.length)continue;
      const snapRows=rows.map(r=>{
        const before={};
        _BULK_SNAP_COLS.forEach(c=>{before[c]=r[c];});
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
async function _ytUndoLastBulk(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-yt-undo-bulk-btn');
  try{
    _ytSetProg('[되돌리기] 마지막 일괄 작업 조회 중…');
    const{data:last,error:lErr}=await sb.from(_BULK_SNAP_TABLE).select('batch_id,op_label,created_at').order('created_at',{ascending:false}).limit(1);
    if(lErr){_ytSetProg('되돌리기 조회 실패: '+lErr.message+' (admin_bulk_snapshots 테이블 SQL을 실행했는지 확인)');return;}
    if(!last||!last.length){_ytSetProg('되돌릴 일괄 작업이 없어요 (스윕/재검증/재스캔을 실행한 적이 있어야 해요)');return;}
    const{batch_id,op_label,created_at}=last[0];
    const when=new Date(created_at).toLocaleString('ko-KR');
    if(!confirm(`마지막 일괄 작업을 되돌릴까요?\n\n작업: ${op_label}\n시각: ${when}\n\n이 작업으로 바뀐 행들을 그 직전 상태로 복원합니다.`)){_ytSetProg('되돌리기 취소됨');return;}
    if(btn)btn.disabled=true;
    const{data:snaps,error:sErr}=await _sbFetchAll(()=>sb.from(_BULK_SNAP_TABLE).select('row_id,before_data').eq('batch_id',batch_id).order('snap_id'));
    if(sErr){_ytSetProg('되돌리기 데이터 로드 실패: '+sErr.message);return;}
    if(!snaps||!snaps.length){_ytSetProg('되돌릴 스냅샷 데이터가 없어요');return;}
    let restored=0;
    for(let i=0;i<snaps.length;i+=100){
      const chunk=snaps.slice(i,i+100);
      const results=await Promise.all(chunk.map(s=>sb.from(_YT_TABLE).update(s.before_data).eq('id',s.row_id)));
      const failed=results.find(r=>r.error);
      if(failed)throw new Error(failed.error.message);
      restored+=chunk.length;
      _ytSetProg(`[되돌리기] ${Math.min(i+100,snaps.length)}/${snaps.length}개 복원 중…`);
    }
    await sb.from(_BULK_SNAP_TABLE).delete().eq('batch_id',batch_id);
    _ytSetProg(`되돌리기 완료! "${op_label}"으로 바뀐 ${restored}개 행을 이전 상태로 복원했어요.`);
  }catch(e){
    _ytSetProg('되돌리기 오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// 라이브(직캠/무대) 판정용 정규식(_ytClassify)이 채널 동기화 시점에 딱 한 번만 돌고 이후 재검증이
// 전혀 없어서(쇼츠는 _probeShortsBatch로 썸네일 실측 보정이 있는 것과 대조적), "Performance Video"류
// 사전제작 콘텐츠가 라이브로 오분류되거나, 반대로 음악방송 이름(엠카운트다운 등)만 있고 "직캠"/"라이브"
// 단어가 없는 진짜 방송 무대 영상이 other로 방치되는 문제가 대량으로 쌓여있었음(2026-08-06, 사용자 제보
// + 실측 확인: 'other'인데 방송명이 있는 영상 최소 1만7천여 건, 'live'인데 "Performance Video"인 영상
// 761건). _ytClassify 자체를 고친 뒤(위 참고) 이미 저장된 기존 행에도 소급 적용하는 재분류 스윕.
// 쇼츠(category='short')는 제목이 아니라 썸네일 실측으로 판정하는 게 더 정확해서 이 스윕 대상에서 제외
// (제목만으로 재분류하면 "OOO Live"라는 제목의 쇼츠가 다시 live로 되돌아가는 식의 역행이 생길 수 있음).
// tags_manual=true(관리자가 태그 모달에서 직접 category를 저장한 행)는 다른 재검증 버튼들과 동일하게
// 절대 건드리지 않음.
async function _ytSweepCategoryMistag(){
  if(!sb){_ytSetProg('Supabase 연결 없음');return;}
  const btn=document.getElementById('sp-catfix-btn');
  if(btn)btn.disabled=true;
  try{
    _ytSetProg('[영상 카테고리 재분류] 조회 중…');
    const{data:rows,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
      .select('id,title,category')
      .eq('tags_manual',false)
      .neq('category','short')
      .order('id'));
    if(error){_ytSetProg('조회 실패: '+error.message);return;}
    if(!rows?.length){_ytSetProg('검사할 영상이 없어요');return;}
    const updates=[];
    rows.forEach(v=>{
      const newCat=_ytClassify(v.title||'');
      // skip은 동기화 시점에 "아예 저장하지 않는다"는 의미라 이미 저장된 행엔 적용 대상이 아니고,
      // short는 위에서부터 조회 대상 자체를 제외했으므로(썸네일 실측 전용) 여기서도 만들지 않는다.
      if(!newCat||newCat==='skip'||newCat==='short')return;
      if(newCat===v.category)return;
      updates.push({id:v.id,patch:{category:newCat}});
    });
    if(!updates.length){_ytSetProg(`검사 완료 — ${rows.length}개 중 바뀔 항목 없음`);return;}
    for(let i=0;i<updates.length;i+=200){
      const chunk=updates.slice(i,i+200);
      const results=await Promise.all(chunk.map(u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id)));
      const failed=results.find(r=>r.error);
      if(failed)throw new Error(failed.error.message);
      _ytSetProg(`[영상 카테고리 재분류] ${Math.min(i+200,updates.length)}/${updates.length}개 처리 중…`);
    }
    _ytSetProg(`완료! ${rows.length}개 중 ${updates.length}개 카테고리 갱신함`);
  }catch(e){
    _ytSetProg('오류: '+e.message);
  }finally{
    if(btn)btn.disabled=false;
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
document.getElementById('sp-hnn-btn')?.addEventListener('click',()=>{document.getElementById('hnn-overlay').classList.add('open');_renderHnnWhitelist();_renderHnnDuplicateNames();_renderHnnAtmRules();_hnnSwitchTab('quality');});
document.getElementById('hnn-close')?.addEventListener('click',()=>{
  document.getElementById('hnn-overlay').classList.remove('open');
  _wonkokScanned=false;
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
    statusEl.textContent='제목 목록 조회 중… (시간이 좀 걸릴 수 있음)';
    const idTitleRows=[];
    let _wkLastId=null;
    while(true){
      // group_ko/with_members/with_groups도 같이 가볍게 받아온다 — "여러 그룹 커버 메들리" 감지(아래
      // multiGroupIds)에 필요. 배열 컬럼이라 있어도 payload가 크게 안 무거워짐.
      let q=sb.from(_YT_TABLE).select('id,title,group_ko,with_members,with_groups').order('id').limit(1000);
      if(_wkLastId!==null)q=q.gt('id',_wkLastId);
      const{data,error:idErr}=await q;
      if(idErr){statusEl.textContent=`조회 실패(${idTitleRows.length}개까지 받음): `+idErr.message;return;}
      if(!data?.length)break;
      idTitleRows.push(...data);
      statusEl.textContent=`제목 목록 조회 중… (${idTitleRows.length}개)`;
      if(data.length<1000)break;
      _wkLastId=data[data.length-1].id;
    }
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
document.getElementById('sp-wonkok-btn')?.addEventListener('click',()=>{document.getElementById('hnn-overlay').classList.add('open');_renderHnnWhitelist();_renderHnnDuplicateNames();_renderHnnAtmRules();_hnnSwitchTab('wonkok');});

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
    let q=sb.from(_YT_TABLE).select('id,title,group_ko,thumb,category,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups').order('id').limit(1000);
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

function _vmOpen(tab){
  _vmTab=tab||'all';
  document.querySelectorAll('.vm-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===_vmTab));
  document.getElementById('vm-search').value='';
  document.getElementById('vm-search-2').value='';
  _vmSearch2='';
  document.getElementById('vm-overlay').classList.add('open');
  _vmApplyTab();
}
function _vmApplyTab(){
  const isCh=_vmTab==='channels';
  document.getElementById('vm-list').style.display=isCh?'none':'';
  document.getElementById('vm-ch-inner').style.display=isCh?'flex':'none';
  // 검수 탭들은 검색 불필요(고정 대상 목록). 채널 탭은 재검색(vm-search-2, 결과 내 좁히기)까진 필요
  // 없지만 1차 검색창은 채널명/핸들 검색용으로 그대로 쓴다(2026-08-21 — 예전엔 여기도 숨겨져 있었음).
  const isReviewLike=_vmTab==='ss'||_vmTab==='review'||_vmTab==='catlock';
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
      _vmRenderVideoList();
      return;
    }
    if(tab==='ss'){
      // strictSync 그룹 오염 검수 — tags_manual=false 행만 (관리자가 이미 확인한 건 제외)
      const ssGkos=[..._STRICT_SYNC_GROUPS];
      if(!ssGkos.length){statusEl.textContent='strictSync 그룹이 없어요';_vmRows=[];_vmRenderVideoList();return;}
      // PostgREST에서 IN 필터는 .in() 메서드로 처리
      const{data,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups')
        .in('group_ko',ssGkos)
        .eq('tags_manual',false)
        .order('id'));
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      const all=(data||[]).sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
      _vmRows=all;
      statusEl.textContent=`검수 대상 ${all.length}개 (strictSync 그룹: ${ssGkos.join(', ')})`;
      _vmRenderVideoList();
      return;
    }
    if(tab==='review'){
      // 그룹배정 검수 큐 — _extBuildRows가 owner 없는 외부/모음채널에서 멤버 이름 하나만으로(강한 근거
      // 없이) group_ko를 역추론했을 때 needs_review:true+content_flag:'hidden'으로 저장해둔 것들
      // (2026-08-20 도입). 여기서 승인하면 그 즉시 실제 그룹으로 확정(content_flag 해제), 거부하면
      // 무관 처리 — 둘 다 needs_review는 false로 내려 큐에서 빠짐.
      const{data,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups')
        .eq('needs_review',true)
        .order('id'));
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      const all=(data||[]).sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
      _vmRows=all;
      statusEl.textContent=`그룹배정 검수 대상 ${all.length}개 — 멤버 이름 하나만으로 그룹을 추측한 영상들이에요`;
      _vmRenderVideoList();
      return;
    }
    if(tab==='catlock'){
      // "OO 최애직캠"처럼 채널마다 반복되는 브랜드명이 붙어도 제목에 "직캠"류 단어가 있으면 _ytClassify가
      // 이미 category='live'로 잡아준다 — 안 잡히는 진짜 문제는 tags_manual=true(사람이 직접 수정)라
      // "영상 카테고리 재분류(전체)"(_ytSweepCategoryMistag)가 애초에 건드리지 않고 조용히 건너뛰는
      // 경우들이었음. 그 목록이 지금까지 안 보여서 실수로 잘못 저장된 건지 의도적으로 다르게 둔 건지
      // 확인할 방법이 없었음(2026-08-21, 사용자 요청) — tags_manual=true 안 건드리는 원칙은 그대로 두고,
      // 후보만 여기서 보여줘서 사람이 하나씩 직접(✎) 확인·수정하게 한다.
      const{data,error}=await _sbFetchAll(()=>sb.from(_YT_TABLE)
        .select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups,category')
        .eq('tags_manual',true)
        .neq('category','live')
        .neq('category','short')
        .order('id'));
      if(myGen!==_vmSearchGen)return;
      if(error){statusEl.textContent='조회 실패: '+error.message;return;}
      const candidates=(data||[]).filter(v=>_ytClassify(v.title||'')==='live');
      const all=candidates.sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
      _vmRows=all;
      statusEl.textContent=`라이브로 보이는데 수동 편집으로 다른 카테고리로 저장된 영상 ${all.length}개 — ✎로 하나씩 확인해주세요`;
      _vmRenderVideoList();
      return;
    }
    // nomem / hold / hidden 탭
    const flag=tab==='nomem'?'무관':tab==='hold'?'보류':'hidden';
    let q=sb.from(_YT_TABLE).select('id,title,group_ko,thumb,content_flag,members,with_members,with_groups,cover_of_members,cover_of_groups');
    q=q.eq('content_flag',flag);
    if(term)q=q.or(`title.ilike.${_pgFilterVal('%'+term+'%')},group_ko.ilike.${_pgFilterVal('%'+term+'%')}`);
    const{data,error}=await _sbFetchAll(()=>q.order('id'));
    if(myGen!==_vmSearchGen)return;
    if(error){statusEl.textContent='조회 실패: '+error.message;return;}
    const all=(data||[]).sort((a,b)=>(a.group_ko||'').localeCompare(b.group_ko||'','ko')||(a.title||'').localeCompare(b.title||'','ko'));
    _vmRows=all;
    statusEl.textContent=term?`검색 결과 ${all.length}개`:`총 ${all.length}개`;
    _vmRenderVideoList();
  }catch(e){
    if(myGen!==_vmSearchGen)return;
    statusEl.textContent='오류: '+e.message;
  }
}
// 그룹 태그 하나만으로는 실제 무슨 콘텐츠인지(개인 태깅/콜라보/커버) 알 수 없어서, 편집 모달을 열지
// 않고도 목록에서 바로 파악할 수 있게 멤버·함께한(콜라보)·원곡 정보를 한 줄로 요약(2026-08-18, 사용자 요청).
function _vmTagsLine(v){
  const parts=[];
  if((v.members||[]).length)parts.push(`멤버: ${v.members.join(', ')}`);
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
    const emptyMsg=tab==='all'?'검색 결과가 없어요':tab==='nomem'?'무관 처리된 영상이 없어요':tab==='hold'?'보류된 영상이 없어요':tab==='review'?'검수 대기 중인 영상이 없어요':tab==='catlock'?'라이브 후보 중 수동 편집으로 막힌 영상이 없어요':'숨김 처리된 영상이 없어요';
    listEl.innerHTML=`<div style="padding:24px;text-align:center;color:rgba(155,178,228,0.45);font-size:12px;">${emptyMsg}</div>`;
    toolbarEl.style.display='none';
    return;
  }
  if(!rows.length){
    listEl.innerHTML=`<div style="padding:24px;text-align:center;color:rgba(155,178,228,0.45);font-size:12px;">재검색 결과가 없어요</div>`;
    toolbarEl.style.display='none';
    return;
  }
  const showCheckbox=tab==='nomem'||tab==='hold'||tab==='hidden'||tab==='ss'||tab==='all';
  if(showCheckbox){
    toolbarEl.style.display='flex';
    document.getElementById('vm-select-all-row').style.display='';
    document.getElementById('vm-select-all').checked=false;
    const applyLabel=tab==='nomem'?'선택-무관 해제':tab==='hold'?'선택-보류 해제':tab==='ss'?'선택-숨김':tab==='hidden'?'선택-숨김 해제':'선택-무관';
    document.getElementById('vm-apply-btn').textContent=applyLabel;
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
      const approveBtn=document.createElement('button');approveBtn.className='vm-flag-btn vm-flag-normal';approveBtn.type='button';approveBtn.textContent='승인';
      approveBtn.addEventListener('click',e=>{e.stopPropagation();_vmReviewDecide(v,item,true,approveBtn,rejectBtn);});
      const rejectBtn=document.createElement('button');rejectBtn.className='vm-flag-btn vm-flag-nomem';rejectBtn.type='button';rejectBtn.textContent='거부';
      rejectBtn.addEventListener('click',e=>{e.stopPropagation();_vmReviewDecide(v,item,false,approveBtn,rejectBtn);});
      actions.appendChild(approveBtn);actions.appendChild(rejectBtn);
    }else{
      // flag badge button (클릭하면 무관→숨김→정상 순으로 순환 — 기타/외부인/개별출연은 순환 대상이
      // 아니라 그대로 표시만 하고, 클릭 한 번에 그 값이 지워지지 않게 함)
      const flag=v.content_flag||null;
      const flagBtn=document.createElement('button');flagBtn.className='vm-flag-btn';flagBtn.type='button';
      _vmSetFlagLabel(flagBtn,flag);
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
  const{error}=await sb.from(_YT_TABLE).update({content_flag:newFlag}).eq('id',v.id);
  if(error){btn.disabled=false;_showShareToast('오류: '+error.message);return;}
  v.content_flag=newFlag;
  _vmSetFlagLabel(btn,newFlag);
  btn.disabled=false;
  // 탭 필터와 안 맞는 항목은 페이드 아웃 후 제거
  const tab=_vmTab;
  const mismatch=(tab==='nomem'&&newFlag!=='무관')||(tab==='hold'&&newFlag!=='보류')||(tab==='hidden'&&newFlag!=='hidden');
  if(mismatch){
    item.style.opacity='0.3';
    setTimeout(()=>{
      _vmRows=_vmRows.filter(r=>r.id!==v.id);
      item.remove();
      _vmUpdateCount();
      document.getElementById('vm-status').textContent=`총 ${_vmRows.length}개`;
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
  const{error}=await sb.from(_YT_TABLE).update({content_flag:newFlag,needs_review:false}).eq('id',v.id);
  if(error){approveBtn.disabled=false;rejectBtn.disabled=false;_showShareToast('오류: '+error.message);return;}
  item.style.opacity='0.3';
  setTimeout(()=>{
    _vmRows=_vmRows.filter(r=>r.id!==v.id);
    item.remove();
    document.getElementById('vm-status').textContent=`그룹배정 검수 대상 ${_vmRows.length}개 남음`;
    if(!_vmRows.length)_vmRenderVideoList();
  },400);
}
function _vmUpdateCount(){
  const total=document.querySelectorAll('#vm-list .vm-item').length;
  const checked=document.querySelectorAll('#vm-list .vm-item input[type=checkbox]:checked').length;
  document.getElementById('vm-count').textContent=`${checked}/${total}개 선택됨`;
  const applyBtn=document.getElementById('vm-apply-btn');
  if(applyBtn)applyBtn.disabled=checked===0;
  const indivBtn=document.getElementById('vm-indiv-btn');
  if(indivBtn)indivBtn.disabled=checked===0;
  const normalBtn=document.getElementById('vm-normal-btn');
  if(normalBtn)normalBtn.disabled=checked===0;
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
      const delBtn=document.createElement('button');delBtn.className='ec-del-btn';delBtn.type='button';delBtn.textContent='삭제';
      delBtn.addEventListener('click',e=>{e.stopPropagation();_ecDeleteChannel(ch.handle,ch.name);});
      item.appendChild(delBtn);
    }
    const link=document.createElement('a');link.className='ec-link';link.href=ch.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='열기';
    item.appendChild(link);
    listEl.appendChild(item);
  });
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
  const row={handle,url:`https://www.youtube.com/@${handle}`,name,tier,owner_mko:memberOwned?ownerMko:null,owner_gko:(memberOwned||tier==='fans')?ownerGko:null};
  const{error}=await sb.from('ext_channels').insert(row);
  if(error){_showShareToast('오류: '+error.message);return;}
  _EXT_CHANNELS.push({handle:row.handle,url:row.url,name:row.name,tier:row.tier,...((row.owner_mko||row.owner_gko)?{owner:{mko:row.owner_mko||null,gko:row.owner_gko||null}}:{})});
  if(handleEl)handleEl.value='';if(nameEl)nameEl.value='';if(ownerEl)ownerEl.value='';if(tierEl)tierEl.value='variety';
  if(ownerGkoEl){ownerGkoEl.value='';ownerGkoEl.style.display='none';ownerGkoEl.innerHTML='';}
  if(targetGkoEl){targetGkoEl.value='';targetGkoEl.style.display='none';}
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
});

// 그룹 우선순위(A>B>C) — 어드민 전용 데이터 관리 우선순위 표시, 유저에게는 절대 노출 안 됨(2026-08-12).
// 레벨 없는 그룹은 group_priority 테이블에 행 자체가 없음(= 미지정).
let _groupPriority=new Map(); // ko -> 'A'|'B'|'C'
let _gpTab='all',_gpSearchTimer=null;
async function _loadGroupPriority(){
  if(!sb)return;
  try{
    const{data,error}=await sb.from('group_priority').select('ko,level');
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
  document.getElementById('gp-overlay').classList.add('open');
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
    const{data,error}=await sb.from('feedback').select('*').order('created_at',{ascending:false});
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
  });
});
document.getElementById('vm-search')?.addEventListener('input',()=>{
  const val=document.getElementById('vm-search').value;
  if(_vmTab==='channels'){_vmRenderChannels(val);return;} // 채널 목록은 이미 메모리에 있는 배열 필터라 디바운스 불필요
  clearTimeout(_vmSearchTimer);
  _vmSearchTimer=setTimeout(()=>_vmLoad(val),300);
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
document.getElementById('vm-apply-btn')?.addEventListener('click',async()=>{
  if(!sb)return;
  const btn=document.getElementById('vm-apply-btn');
  const items=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const newFlag=_vmTab==='ss'?'hidden':(_vmTab==='all'?'무관':null);
  const{error}=await sb.from(_YT_TABLE).update({content_flag:newFlag}).in('id',ids);
  const applyLabel=_vmTab==='nomem'?'선택-무관 해제':_vmTab==='hold'?'선택-보류 해제':_vmTab==='ss'?'선택-숨김':_vmTab==='hidden'?'선택-숨김 해제':'선택-무관';
  if(error){btn.disabled=false;btn.textContent=applyLabel;document.getElementById('vm-status').textContent='오류: '+error.message;return;}
  const idSet=new Set(ids);
  if(_vmTab==='all'){
    // 전체 탭은 검색 결과 목록이라 플래그를 바꿔도 그대로 남아있어야 함(nomem/hidden 탭처럼 그 자체가
    // "무관/숨김 목록"이 아니므로) — 행을 지우지 않고 배지와 체크박스만 갱신한다.
    _vmRows.forEach(v=>{if(idSet.has(v.id))v.content_flag=newFlag;});
    items.forEach(el=>{
      const cb=el.querySelector('input[type=checkbox]');if(cb)cb.checked=false;
      const flagBtn=el.querySelector('.vm-flag-btn');
      if(flagBtn){flagBtn.className='vm-flag-btn vm-flag-nomem';flagBtn.textContent='무관';}
    });
    document.getElementById('vm-status').textContent=`${ids.length}개 무관 처리 완료`;
  }else{
    _vmRows=_vmRows.filter(v=>!idSet.has(v.id));
    items.forEach(el=>el.remove());
    document.getElementById('vm-status').textContent=`${ids.length}개 처리 완료 — 남은 ${_vmRows.length}개`;
    if(!_vmRows.length)_vmRenderVideoList();
  }
  btn.textContent=applyLabel;
  _vmUpdateCount();
});
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
  const{error}=await sb.from(_YT_TABLE).update({content_flag:newFlag}).in('id',ids);
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
    items.forEach(el=>el.remove());
    document.getElementById('vm-status').textContent=`${ids.length}개 처리 완료 — 남은 ${_vmRows.length}개`;
    if(!_vmRows.length)_vmRenderVideoList();
  }
  btn.textContent='선택-개별';
  _vmUpdateCount();
});
// 여러 개 선택 후 한 번에 정상(null)으로 되돌리는 버튼 — vm-apply-btn은 탭마다 목적이 고정(전체 탭은
// 무관 처리만, nomem/hidden 탭은 각자 원래 상태 해제만)이라, 예를 들어 '전체' 탭 검색 결과에 무관/기타/
// 외부인/개별출연 등 이미 플래그가 섞여 있을 때 그것들만 골라 한 번에 정상으로 되돌릴 방법이 없었음
// (배지를 하나씩 클릭해서 순환시키는 것만 가능). 모든 탭에서 동일하게 동작(2026-08-18, 사용자 요청).
document.getElementById('vm-normal-btn')?.addEventListener('click',async()=>{
  if(!sb)return;
  const btn=document.getElementById('vm-normal-btn');
  const items=[...document.querySelectorAll('#vm-list .vm-item')].filter(el=>el.querySelector('input[type=checkbox]')?.checked);
  const ids=items.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const newFlag=null;
  const{error}=await sb.from(_YT_TABLE).update({content_flag:newFlag}).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='선택-정상';document.getElementById('vm-status').textContent='오류: '+error.message;return;}
  const idSet=new Set(ids);
  if(_vmTab==='all'){
    _vmRows.forEach(v=>{if(idSet.has(v.id))v.content_flag=newFlag;});
    items.forEach(el=>{
      const cb=el.querySelector('input[type=checkbox]');if(cb)cb.checked=false;
      const flagBtn=el.querySelector('.vm-flag-btn');
      if(flagBtn)_vmSetFlagLabel(flagBtn,newFlag);
    });
    document.getElementById('vm-status').textContent=`${ids.length}개 정상 처리 완료`;
  }else{
    _vmRows=_vmRows.filter(v=>!idSet.has(v.id));
    items.forEach(el=>el.remove());
    document.getElementById('vm-status').textContent=`${ids.length}개 처리 완료 — 남은 ${_vmRows.length}개`;
    if(!_vmRows.length)_vmRenderVideoList();
  }
  btn.textContent='선택-정상';
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
function _atmMatchesMember(m,title,tokens,groupKo){
  const name=m.ko;
  if(!name)return false;
  const hashtagOnly=_isHashtagOnlyName(name)&&!_atmContextRelaxesHashtagOnly(name,title,groupKo);
  const nameChars=[...name];
  const multiChar=nameChars.length>1&&!hashtagOnly;
  const particles=['이','가','은','는','을','를','과','와','도','만','의','에','께','님','씨','아','야','랑','한테','에게'].map(_atmEscRe).join('|');
  if(multiChar){
    if(new RegExp(`(?<![가-힣])${_atmEscRe(name)}(?![가-힣])`).test(title))return true; // 이름 단독
    if(new RegExp(`(?<![가-힣])${_atmEscRe(name)}(?:${particles}){0,2}(?![가-힣])`).test(title))return true; // 이름+조사
    const surRe=new RegExp(`([가-힣])${_atmEscRe(name)}(?:${particles}){0,2}(?![가-힣])`,'g');
    const surExclude=_ATM_SURNAME_EXCLUDE[name];
    const surExcludeDyn=_ATM_DYNAMIC_SURNAME_EXCLUDE.get(name); // DB 이전분(2026-08-20)
    let sm;while((sm=surRe.exec(title))){if(_ATM_KOREAN_SURNAMES.has(sm[1])&&!(surExclude&&surExclude.has(sm[1]))&&!(surExcludeDyn&&surExcludeDyn.has(sm[1])))return true;} // 성+이름(+조사)
    const givenOnly=_atmStripSurname(nameChars);
    if(givenOnly&&givenOnly.length>=2){
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
      for(let i=0;i<=tokens.length-parts.length;i++){if(parts.every((p,j)=>tokens[i+j]===p))return true;}
      // 영문명도 한글과 같은 이유로 "성" 파트(보통 첫 단어)를 뺀 나머지만 제목에 있어도 잡히게 함
      const rest=parts.slice(1);
      if(rest.length===1){
        if(tokens.includes(rest[0]))return true;
      }else if(rest.length>1){
        for(let i=0;i<=tokens.length-rest.length;i++){if(rest.every((p,j)=>tokens[i+j]===p))return true;}
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
function _atmResolveMembers(title,description,roster,groupKo,publishedAt){
  // publishedAt(영상 발행일, "YYYY-MM-DD")이 주어지면 그 시점에 이미 탈퇴한 멤버는 매칭 후보에서 제외
  // (_memberLeftCutoffDate 참고) — 그룹은 활동 중이어도 탈퇴 멤버는 그 이후 영상에 안 나오는 게 정상.
  const roster2=publishedAt?roster.filter(m=>{const c=_memberLeftCutoffDate(m);return !c||publishedAt<=c;}):roster;
  const t=title||'';
  const hitTitle=roster2.filter(m=>_atmMatchesMember(m,t,_atmTokenize(t),groupKo)).map(m=>m.ko);
  const searchText=description?`${t}\n${description}`:t;
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
    for(let gi=0;gi<groupKos.length;gi++){
      const gko=groupKos[gi];
      // a.group.ko(주 소속)만 보면 유연정(주 소속 아이오아이, 겸임 우주소녀)처럼 이중소속 멤버가 겸임 그룹
      // 채널에서는 영원히 로스터에 안 잡혀 자동 태깅 대상에서 빠짐 — 겸임 소속까지 보는 _artistGroups로 판정
      // (2026-07-31, 우주소녀 채널의 유연정 단독 영상이 계속 미태깅으로 남아 다른 멤버 카드에도 "그룹 전체
      // 미태깅 영상"으로 잘못 노출되던 문제의 원인).
      const members=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko)).map(a=>({ko:a.name.ko,en:a.name.en,left:a.left}));
      if(!members.length)continue;
      _ytSetProg(`[${gi+1}/${groupKos.length}] ${gko}: 미태깅 영상 조회 중…`);
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
      if(error){console.error(`[자동 태깅] ${gko} 조회 실패:`,error.message);continue;}
      if(!rows?.length)continue;
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
          const match=_m2ParseTitle(title,gko);
          if(match){
            const otherGkos=[match.primaryGroup,...match.withGroups].filter(og=>og&&og!==gko);
            const withGroups=[],withMembers=[];
            otherGkos.forEach(og=>{
              const sec=match.membersByGroup[og]||[];
              const{asGroup,extraMembers}=_classifyGuestGroup(sec,og);
              if(asGroup)withGroups.push(og);
              extraMembers.forEach(mko=>withMembers.push(`${mko}(${og})`));
            });
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
        for(let i=0;i<updates.length;i+=200){
          const chunk=updates.slice(i,i+200);
          const results=await Promise.all(chunk.map(u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id)));
          results.forEach((r,idx)=>{if(r.error)console.error(`[자동 태깅] ${gko} id=${chunk[idx].id} 업데이트 실패:`,r.error.message);});
        }
        grandMatched+=updates.length;
      }
      _ytSetProg(`[${gi+1}/${groupKos.length}] ${gko}: ${updates.length}/${rows.length}개 매칭 (누적 ${grandMatched}개)`);
    }
    _ytSetProg(`완료! 미태깅 ${grandChecked}개 중 ${grandMatched}개 새로 태깅됨`);
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
  const btn=document.getElementById('sp-yt-retag-all');
  if(btn)btn.disabled=true;
  try{
    const groupKos=Object.keys(GROUPS);
    let grandMatched=0,grandChecked=0;
    for(let gi=0;gi<groupKos.length;gi++){
      const gko=groupKos[gi];
      const members=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko)).map(a=>({ko:a.name.ko,en:a.name.en,left:a.left}));
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
        const match=_m2ParseTitle(title,gko);
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
        for(let i=0;i<updates.length;i+=200){
          const chunk=updates.slice(i,i+200);
          const results=await Promise.all(chunk.map(u=>sb.from(_YT_TABLE).update(u.patch).eq('id',u.id)));
          results.forEach((r,idx)=>{if(r.error)console.error(`[재태깅] ${gko} id=${chunk[idx].id} 업데이트 실패:`,r.error.message);});
        }
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
    const{data,error}=await sb.from('ext_channels').select('handle,url,name,tier,owner_mko,owner_gko').order('name');
    if(error){console.error('ext_channels 로드 실패',error.message);return;}
    // 팬(fans) 채널은 owner_mko 없이 owner_gko만 있음(그룹 전체가 대상, 특정 멤버 아님) — owner_mko
    // 유무가 아니라 둘 중 하나라도 있으면 owner 객체를 만든다(2026-08-21).
    _EXT_CHANNELS=(data||[]).map(r=>({handle:r.handle,url:r.url,name:r.name,tier:r.tier,...((r.owner_mko||r.owner_gko)?{owner:{mko:r.owner_mko||null,gko:r.owner_gko||null}}:{})}));
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
function _m2ParseTitle(rawTitle,selfGko,strict){
  // "(원곡: X)"/"[Dance Cover]"/"(BTS 커버)"류 절은 매칭 전에 먼저 제거한다 — 이 절 안의 이름은 실제
  // 출연자가 아니라 커버 대상(원곡자)이라, 그대로 두면 group_ko/with_members가 원곡자 쪽으로 잘못
  // 붙는다(예: "마마무 - 아주 NICE(원곡: 세븐틴)"에 세븐틴이 콜라보로 붙음). 이 헬퍼는 원래 관리자
  // 검수 도구(_wonkokScan, "원곡: X 오태깅 의심 목록")에서만 쓰이고 있었는데, 검수는 이미 잘못 들어간
  // 기존 데이터만 찾아줄 뿐 새로 들어오는 영상은 여전히 오염됐음 — 매칭 엔진 진입점에서 바로 걸러
  // 원천 차단한다(2026-08-21, Fable 감사 5번 유형 — "원곡커버 오인").
  const strippedTitle=_wonkokStripClause(rawTitle);
  // "하이라이트"는 그룹명이 아니라 "요약본" 의미로도 흔히 쓰여 그룹 하이라이트로 오매칭되기 쉬움 — 실측으로
  // "OO '노래' 릴댄 하이라이트 | 릴레이댄스"(릴레이댄스 코너 고정 문구), "OO 무대 하이라이트 모음"류가
  // 대량으로 하이라이트 그룹에 잘못 태깅되는 걸 확인함(2026-07-30). 대괄호로 감싼 경우([하이라이트])뿐
  // 아니라 이런 평문 관용구도 매칭 전에 제거한다 — 한 제목에 여러 번 나올 수 있어 전부(g) 제거.
  const title=strippedTitle
    .replace(/[\[(<【]\s*하이라이트\s*[\])>】]/g,' ')
    .replace(/(릴댄|무대|커버|비하인드|메이킹|리허설|티저|예능)\s*하이라이트/g,' ')
    .replace(/하이라이트\s*모음/g,' ');
  // 특수문자를 공백으로 치환해 토큰 경계 확보, 앞뒤 공백 추가
  const norm=' '+title.toUpperCase().replace(/[^가-힣a-zA-Z0-9]/g,' ').replace(/\s+/g,' ')+' ';
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
  function memberHit(a,names){
    if([...a.name.ko].length===1||_isHashtagOnlyName(a.name.ko))return names.some(t=>hitHashtag(t));
    return names.some(t=>hit(t));
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
  const _GROUP_TOKEN_LITERAL_ONLY=new Set(['15&']);
  function hitLiteral(t){return title.toUpperCase().includes(t.toUpperCase());}
  // 긴 이름 우선 정렬 (부분 매칭 방지). strictSync 그룹은 제목 키워드 매칭에서 제외 — 자체 채널
  // 동기화(_ytSyncGroup)로만 영상이 들어와야 하는 공통명사 이름 그룹이 외부 채널 영상 제목에서 오인식되는 걸 막음.
  // altNames(예: 브브걸의 "브레이브걸스", 슈퍼노바의 "초신성", JX의 "JYJ")도 토큰에 포함시켜야 함 —
  // 그룹 키를 공식명으로 정리하면서(2026-08-10, "이름(그룹)" 태그 파싱 버그 수정 겸) 옛 이름을 altNames로
  // 옮겼는데, 여기서 안 챙기면 제목에 옛 이름만 적힌 영상(예: "JYJ 콘서트")을 더는 못 알아보는 회귀가
  // 생김(사용자 제보로 발견 — 검색 쪽만 altNames를 보게 고쳤지 태깅 매칭 쪽은 놓쳤었음).
  // 예전엔 해체 그룹 39팀 전체를 여기서 통째로 제외했음(일반명사 그룹명 오염 방지 목적) — 근데 그중
  // 실제 충돌 위험이 있는 건 일부(배틀·여자친구·에이프릴 등 흔한 단어형)뿐이고, 나머지 대다수(아이즈원·
  // 스피카·티오원 등 고유명사형)는 외부/모음 채널 영상 제목에 그룹명이 버젓이 있어도 영원히 매칭 안
  // 되는 과잉 차단이었음. 위험군만 strictSync로 개별 지정하는 걸로 대체(2026-08-20, 39팀 전수 검토 후).
  const groupsSorted=Object.entries(GROUPS)
    .filter(([ko,v])=>!_STRICT_SYNC_GROUPS.has(ko))
    .map(([ko,v])=>({ko,tokens:[ko,v.en,...(v.altNames||[])].filter(Boolean)}))
    .sort((a,b)=>Math.max(...b.tokens.map(t=>t.length))-Math.max(...a.tokens.map(t=>t.length)));
  const matchedGroupKos=[];
  const seen=new Set();
  for(const{ko,tokens}of groupsSorted){
    if(seen.has(ko))continue;
    const conflicts=_GROUP_TITLE_CONFLICT_EXCLUDE[ko];
    if(conflicts&&conflicts.some(re=>re.test(title)))continue;
    if(tokens.some(t=>(_GROUP_TOKEN_LITERAL_ONLY.has(t)||_ATM_DYNAMIC_LITERAL_ONLY.has(t))?hitLiteral(t):hit(t))){matchedGroupKos.push(ko);seen.add(ko);}
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
  const unitExtraMembers={}; // gko -> Set(mko)
  let normMinusUnits=norm;
  Object.values(_PROJECT_UNITS).forEach(unit=>{
    // _UNIT_HASHTAG_ONLY_TOKENS(index.html) — "AAA"/"EVOLution" 등 흔한단어 유닛 트리거는 해시태그로만
    // 인정(2026-08-21, Fable 감사로 트리플에스 유닛명이 아시아 아티스트 어워즈 약칭·다른 그룹 콘서트명과
    // 충돌해 대량 오매칭되는 게 발견됨).
    if(!unit.names.some(t=>_UNIT_HASHTAG_ONLY_TOKENS.has(t)?hitHashtag(t):hit(t)))return;
    unit.members.forEach(({mko,gko})=>{
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
  // "이름(그룹명)" 패턴에서 그룹명이 우리 시스템에 없는 경우 → 타 소속 동명이인 신호
  const knownGroupTokens=new Set();
  Object.entries(GROUPS).forEach(([ko,v])=>{
    knownGroupTokens.add(ko.toUpperCase());
    if(v.en)knownGroupTokens.add(v.en.toUpperCase());
  });
  function hasForeignGroupSuffix(name){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const m=title.match(new RegExp(escaped+'\\s*\\(([^)]+)\\)','i'));
    if(!m)return false;
    const adj=m[1].trim().toUpperCase();
    for(const tok of knownGroupTokens){if(adj===tok||adj.includes(tok)||tok.includes(adj))return false;}
    return true;
  }
  // 그룹 미매칭이면 멤버 이름으로 그룹 역추론
  if(!matchedGroupKos.length){
    const inferred=new Map(); // groupKo -> [memberKo]
    const nameToGroups=new Map(); // 멤버명(한글) -> Map(아티스트객체 -> 그 사람 소속 groupKo[]) — 동명이인 충돌 감지용
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
      const nameMatched=strict?names.some(t=>hitHashtag(t)):memberHit(a,names);
      if(nameMatched&&!names.some(t=>hasForeignGroupSuffix(t))){
        // 겸임 멤버(NCT 마크·해찬, 아이즈원 안유진 등)는 자기 소속 그룹 전부(_artistGroups)에 귀속시켜야
        // 함 — a.group.ko(주 소속)만 보면 부소속 채널/모음영상에서 역추론 자체가 원천 차단됨
        // (2026-08-20, 자체채널 태깅은 이미 _artistGroups 쓰는데 여기만 안 맞춰져 있던 비대칭 수정).
        const artistGkos=_artistGroups(a).map(g=>g.ko);
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
    const result=[];
    for(const[gko,members]of inferred){result.push({gko,members});}
    // confidence:'weak' — 제목에 그룹명/해시태그 리터럴이 전혀 없이 멤버 이름 하나만으로 그룹 자체를
    // 역추론한 경로. Love(온리원오프)/루나(에프엑스)/조이(레드벨벳) 오염 사례가 전부 이 경로에서
    // 나왔음(2026-08-20, 실측 확인) — 무관 채널(THE SHOW 등)의 무관 영상 제목에 흔한 단어 하나 있다고
    // 그룹 전체가 잘못 배정되는 사고가 여기서만 발생. 호출부(_extBuildRows)가 owner 없는 외부/모음채널
    // 매칭에서 이 값을 보고 즉시확정 대신 검수 대기로 돌린다.
    return{primaryGroup:result[0].gko,withGroups:result.slice(1).map(r=>r.gko),
           membersByGroup:Object.fromEntries(result.map(r=>[r.gko,r.members])),confidence:'weak'};
  }
  // 각 매칭 그룹에서 멤버 추출 — normMinusUnits 기준으로 검사해 유닛명 토큰이 만든 가짜 개별 언급을
  // 제외한다(위 unit-name-false-with 해결 참고).
  const membersByGroup={};
  for(const gko of matchedGroupKos){
    // 겸임 멤버 대응 — a.group.ko===gko(주 소속만)면 NCT 마크/해찬처럼 부소속 그룹 이름이 제목에
    // 매칭돼도 정작 그 멤버 자신은 로스터에서 빠져 추출 누락됨(2026-08-20, 위 역추론부와 동일 수정).
    const matched=ARTISTS.filter(a=>_artistGroups(a).some(g=>g.ko===gko)&&_m2NameVariants(a).some(t=>hit(t,normMinusUnits)||hitHashtagSubstring(t))).map(a=>a.name.ko);
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
    membersByGroup[gko]=matched;
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
function _extBuildRows(vids,strict,tier,owner){
  const rows=[];let skipped=0;
  const ownerGko=_extOwnerGko(owner);
  for(const v of vids){
    const match=_m2ParseTitle(v.title,ownerGko||undefined,strict);
    if(!owner&&!match){skipped++;continue;}
    // idol tier(owner.mko 있음)는 인물이 이미 확정이라 그대로 고정. fans tier(owner.gko만 있음, 그룹
    // 전체가 대상이라 특정 멤버가 없음)는 제목에서 그 그룹 멤버 언급을 찾아본다 — 없으면(그룹 전체
    // 다루는 영상) 빈 배열로 둔다(2026-08-21).
    // match가 null일 수 있음(strict 채널에서 제목에 그룹명/해시태그가 하나도 없어 파싱 결과 없음). owner가
    // 있는 채널(팬/아이돌개인)은 위 skip에 안 걸리고 여기로 오므로 반드시 match를 널가드해야 함 — 안 그러면
    // 그룹명 없는 팬캠 제목("성현 직캠" 등) 하나만 걸려도 그 채널 동기화가 통째로 크래시했음(2026-08-23 수정).
    const members=owner?.mko?owner.mko.split(',').map(s=>s.trim()).filter(Boolean):(match?(match.membersByGroup[ownerGko||match.primaryGroup]||[]):[]); // 공동운영이면 소유자 여러 명 다 붙임(2026-08-22)
    const withGroups=[],withMembers=[];
    // owner가 있으면 match.primaryGroup도 게스트 후보에 포함시켜야 함 — owner(솔로 아티스트 등)는
    // GROUPS에 없어 제목의 그룹명 리터럴 매칭 대상이 아니므로, 게스트 그룹이 유일하게 매칭되면 그게
    // withGroups가 아니라 primaryGroup 자리로 잡혀서 게스트가 통째로 누락됐었음(2026-08-11, "이영지랑
    // #에스파 카리나" 같은 제목에서 실측 확인).
    const guestCandidates=owner&&match?[match.primaryGroup,...match.withGroups].filter((g,i,arr)=>g&&arr.indexOf(g)===i):(match?match.withGroups:[]);
    guestCandidates.forEach(gko=>{
      if(owner&&gko===ownerGko)return; // 본인 그룹이 게스트로 중복 잡히는 것만 방지
      const sec=match.membersByGroup[gko]||[];
      const{asGroup,extraMembers}=_classifyGuestGroup(sec,gko);
      if(asGroup)withGroups.push(gko);
      extraMembers.forEach(mko=>withMembers.push(`${mko}(${gko})`));
    });
    // fans tier는 원래 category(mv/live/short 등)가 뭐였든 무조건 'fan'으로 — "by Fans" 탭은 콘텐츠
    // 종류가 아니라 "팬이 만들었다"는 출처 자체가 기준이라, variety/show처럼 'other'만 덮어쓰는 방식으론
    // 안 됨(직캠류 팬캠도 팬 채널 콘텐츠면 다 여기로 가야 함, 2026-08-21).
    const category=tier==='fans'?'fan':(tier&&tier!=='music'&&(!v.category||v.category==='other'))?(tier==='show'?'show':'variety'):v.category;
    // 신뢰도 검수 — owner 없는 채널(THE SHOW·뮤직뱅크 등 특정 그룹 소유가 아닌 모음/방송사 채널)에서
    // group_ko가 오로지 멤버 이름 하나만으로 역추론(confidence:'weak')됐으면, 그 즉시 실제 그룹으로
    // 확정하지 않고 content_flag:'hidden'(기존에 이미 전면 신뢰되던 은닉 메커니즘 재사용)+needs_review:true로
    // 저장해 어드민 검수 큐에서만 보이게 한다. owner가 있는 채널(이 채널 자체가 특정 인물 소유)은
    // group_ko가 owner로 고정되지 confidence 영향을 안 받으므로 대상이 아님(2026-08-20, Love/루나/조이
    // 오염 실측 확인 후 도입).
    const needsReview=!owner&&match.confidence==='weak';
    rows.push({
      id:v.id,title:v.title,title_norm:_titleNorm(v.title),description:v.description||'',thumb:v.thumb,published_at:v.published_at,
      category,
      group_ko:owner?ownerGko:match.primaryGroup,members,with_groups:withGroups,with_members:withMembers,
      ...(_isJunkVideoTitle(v.title)?{content_flag:'무관'}:needsReview?{content_flag:'hidden',needs_review:true}:{}),
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
        const{rows,skipped}=_extBuildRows(vids,_EXT_STRICT_TIERS.has(ch.tier),ch.tier,ch.owner);
        totalSkipped+=skipped;
        if(rows.length){
          setProg(`${prefix} ${rows.length}개 저장 중…`);
          for(let i=0;i<rows.length;i+=200){
            const{error}=await sb.from(_YT_TABLE).upsert(rows.slice(i,i+200),{onConflict:'id',ignoreDuplicates:true});
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
      let cat=isShortThumb?'short':_ytClassify(title);
      if(cat==='skip')continue;
      vids.push({
        id:vid,title,description:_decodeHtmlEntities(item.snippet.description||''),
        thumb:isShortThumb?(hiTh.url||th.medium?.url||''):(th.medium?.url||th.high?.url||th.default?.url||''),
        published_at:(item.snippet.publishedAt||'').slice(0,10),category:cat
      });
    }
    if(vids.length){
      const{rows,skipped:sk}=_extBuildRows(vids,_EXT_STRICT_TIERS.has(ch.tier),ch.tier,ch.owner);
      skipped+=sk;
      if(rows.length){
        for(let i=0;i<rows.length;i+=200){
          const{error}=await sb.from(_YT_TABLE).upsert(rows.slice(i,i+200),{onConflict:'id',ignoreDuplicates:true});
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
  let category=isShortThumb?'short':_ytClassify(title);
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
  return{id:vid,title,title_norm:_titleNorm(title),description,thumb,published_at:publishedAt,category,group_ko:groupKo,members,with_groups:withGroups,with_members:withMembers};
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
let _vidTagLoadedFormats=[]; // 모달 열 때 DB에서 읽은 content_formats — 저장 시 장르 태그 재계산에 사용
// content_flag는 한 컬럼에 한 값만 들어가므로(null/기타/외부인/무관/hidden 중 하나) 체크박스 2개(기타/외부인)와
// 토글 버튼 2개(무관/숨김)를 하나의 배타적 선택으로 묶어서 관리한다 — 예전엔 "숨김"만 별도 버튼으로 즉시
// DB에 반영되고 나머지 셋은 저장 버튼을 눌러야 반영되는 등 취급이 달라서(2026-08-04, 사용자 피드백:
// 무관/숨김의 "정도"가 안 맞음) 넷 다 저장 버튼을 눌러야 반영되는 걸로 통일했다.
let _vidTagFlagChoice=null; // null | '기타' | '외부인' | '무관' | 'hidden'
// 일괄 편집에서 "아무 플래그도 안 건드림"과 "명시적으로 정상으로 되돌림"을 구분하기 위한 플래그 —
// 넷 중 하나라도 클릭하면 true가 돼서, 저장 시 선택 안 된 영상들의 기존 content_flag까지 건드리지 않던
// 기존 동작을 그대로 유지한다.
let _vidTagFlagTouched=false;
function _vidTagApplyFlagUI(){
  const etcEl=document.getElementById('vid-tag-flag-etc');
  const extEl=document.getElementById('vid-tag-flag-ext');
  const indivEl=document.getElementById('vid-tag-flag-indiv');
  const nomemBtn=document.getElementById('vid-tag-flag-nomem-btn');
  const hiddenBtn=document.getElementById('vid-tag-flag-hidden-btn');
  if(etcEl)etcEl.checked=_vidTagFlagChoice==='기타';
  if(extEl)extEl.checked=_vidTagFlagChoice==='외부인';
  if(indivEl)indivEl.checked=_vidTagFlagChoice==='개별출연';
  if(nomemBtn)nomemBtn.classList.toggle('active',_vidTagFlagChoice==='무관');
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
  document.getElementById('vid-tag-status').textContent='';
  document.getElementById('vid-tag-overlay').classList.add('open');
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
  document.getElementById('vid-tag-overlay').classList.add('open');
  // 카드에 넘어온 v에는 members/with_members가 안 실려있는 경우가 많아서(그룹 카드 그리드는 해당 컬럼을
  // 아예 select하지 않음), 모달을 열 때 저장된 값을 DB에서 직접 불러와 체크박스/칩에 반영한다.
  if(sb){
    const{data,error}=await sb.from(_YT_TABLE).select('members,with_members,with_groups,cover_of_members,cover_of_groups,category,content_flag,tags_manual,content_formats').eq('id',v.id).maybeSingle();
    if(!_vidTagTarget||_vidTagTarget.id!==v.id)return; // 응답 오는 사이 모달이 닫히거나 다른 영상으로 전환됨
    if(!error&&data){
      const savedMembers=new Set(data.members||[]);
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
      _renderVidTagChips();
      const catEl=document.getElementById('vid-tag-cat');
      if(catEl)catEl.value=data.category||'';
      _vidTagFlagChoice=data.content_flag||null;_vidTagFlagTouched=false;_vidTagApplyFlagUI();
    }
  }
  document.getElementById('vid-tag-status').textContent='';
}
function _closeVidTagModal(){
  document.getElementById('vid-tag-overlay').classList.remove('open');
  _vidTagTarget=null;
  _vidTagBulkIds=null;
  _vidTagOrigManual=false;
  _vidTagLoadedFormats=[];
  _vidTagFlagChoice=null;_vidTagFlagTouched=false;_vidTagApplyFlagUI();
  // 영상 관리 패널에서 연필 버튼으로 열었을 수 있으니, 열려있으면 현재 탭 기준으로 다시 불러온다.
  // 1차 검색어는 안 바뀌었으므로 이중 검색(2차 검색어)까지 그대로 유지(preserveSearch2).
  if(document.getElementById('vm-overlay')?.classList.contains('open')){
    _vmLoad(undefined,true);
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
  const contentFlag=_vidTagFlagChoice;
  const{ko,originKo}=_vidTagTarget;
  // 소속 그룹(group_ko) 자체를 완전히 다른 그룹으로 옮기는 경우 — 자동 태깅이 아예 엉뚱한 그룹으로
  // 잘못 물었을 때(예: "원곡: X그룹" 오태깅) "그룹멤버안나옴+타그룹멤버 크로스태그"로 우회하지 않고
  // 여기서 바로 소속을 바로잡을 수 있게 함.
  const groupKoInput=(document.getElementById('vid-tag-group-ko')?.value||'').trim();
  let newGko=null;
  if(groupKoInput&&groupKoInput!==ko){
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
    if(overwriteTags){updatePayload.members=members;updatePayload.with_members=withMembers;updatePayload.with_groups=withGroups;updatePayload.cover_of_members=coverMembers;updatePayload.cover_of_groups=coverGroups;updatePayload.tags_manual=true;}
    if(category)updatePayload.category=category;
    if(_vidTagFlagTouched)updatePayload.content_flag=contentFlag;
    if(newGko)updatePayload.group_ko=newGko;
    if(!Object.keys(updatePayload).length){statusEl.textContent='변경할 항목을 선택해주세요';return;}
    const ids=_vidTagBulkIds;
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
  const updatePayload={members,with_members:withMembers,with_groups:withGroups,cover_of_members:coverMembers,cover_of_groups:coverGroups,content_flag:contentFlag,tags_manual:true};
  if(category!==undefined)updatePayload.category=category||null;
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
  statusEl.textContent='저장됨';
  // group_ko도 같이 실어보내야 함 — patchItem 내부의 _buildGridWithList가 "이 영상이 실제로 속한
  // 그룹"과 "지금 보는 카드의 그룹"이 다른지 판단할 때 필요(없으면 게스트 출연 영상의 함께한 멤버 줄이
  // "이름(undefined)"처럼 잘못 그려짐, 2026-08-04).
  const patchedRow={title:document.getElementById('vid-tag-vidtitle').textContent,group_ko:newGko||ko,members,with_members:withMembers,with_groups:withGroups,cover_of_members:coverMembers,cover_of_groups:coverGroups,content_flag:contentFlag,category:category||null};
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
  document.getElementById('sp-yt-sync')?.addEventListener('click',async()=>{
    const btn=document.getElementById('sp-yt-sync');
    if(btn)btn.disabled=true;
    await _ytSyncAll();
    await _ytSyncExtChannels();
    await _ytRefreshViewCounts();
    if(btn)btn.disabled=false;
  });
  document.getElementById('sp-yt-viewcount-btn')?.addEventListener('click',async()=>{
    const btn=document.getElementById('sp-yt-viewcount-btn');
    if(btn)btn.disabled=true;
    await _ytRefreshViewCounts();
    if(btn)btn.disabled=false;
  });
  document.getElementById('sp-yt-allviewcount-btn')?.addEventListener('click',async()=>{
    const btn=document.getElementById('sp-yt-allviewcount-btn');
    if(btn)btn.disabled=true;
    await _ytRefreshAllViewCounts();
    if(btn)btn.disabled=false;
  });
  document.getElementById('sp-yt-backfillviewcount-btn')?.addEventListener('click',async()=>{
    const btn=document.getElementById('sp-yt-backfillviewcount-btn');
    if(btn)btn.disabled=true;
    await _ytBackfillAllViewCounts();
    if(btn)btn.disabled=false;
  });
  document.getElementById('sp-yt-rotateviewcount-btn')?.addEventListener('click',async()=>{
    const btn=document.getElementById('sp-yt-rotateviewcount-btn');
    if(btn)btn.disabled=true;
    await _ytRotateViewCountRefresh();
    if(btn)btn.disabled=false;
  });
  document.getElementById('sp-yt-sweep-banned')?.addEventListener('click',_ytSweepBannedVideos);
  document.getElementById('sp-yt-sweep-junk')?.addEventListener('click',_ytSweepJunkKeywordVideos);
  // "무조건 제외 키워드" 목록이 코드에만 있어서 관리자가 지금 뭐가 걸려있는지 확인할 방법이 없었음
  // (2026-08-10, 사용자 요청) — 버튼 밑에 현재 목록을 그대로 보여줌. _JUNK_TITLE_KEYWORDS_GLOBAL을
  // 그대로 참조하므로 코드에서 키워드를 추가/삭제하면 이 표시도 자동으로 같이 바뀜(따로 관리 안 해도 됨).
  const junkKwLbl=document.getElementById('sp-junk-keywords-lbl');
  if(junkKwLbl)junkKwLbl.textContent='현재 목록: '+_JUNK_TITLE_KEYWORDS_GLOBAL.join(', ');
  document.getElementById('sp-collabfix-btn')?.addEventListener('click',_ytSweepAmbiguousCollabMistag);
  document.getElementById('sp-scan-namecollide-btn')?.addEventListener('click',_ytScanAmbiguousNameGroupMisassignment);
  document.getElementById('sp-membersfix-btn')?.addEventListener('click',_ytSweepMembersMistag);
  document.getElementById('sp-yt-undo-bulk-btn')?.addEventListener('click',_ytUndoLastBulk);
  document.getElementById('sp-catfix-btn')?.addEventListener('click',_ytSweepCategoryMistag);
  document.getElementById('sp-covertitle-btn')?.addEventListener('click',_ytExtractCoverSongTitles);
  document.getElementById('sp-yt-autotag')?.addEventListener('click',_ytAutoTagMembers);
  document.getElementById('sp-yt-retag-all')?.addEventListener('click',_ytRetagAllIncludingTagged);
  document.getElementById('sp-vm-btn')?.addEventListener('click',()=>_vmOpen());
  const backfillSel=document.getElementById('sp-yt-backfill-ch');
  if(backfillSel){
    backfillSel.innerHTML=_EXT_CHANNELS.map(c=>`<option value="${c.handle}">${c.name}</option>`).join('');
  }
  document.getElementById('sp-yt-backfill-btn')?.addEventListener('click',()=>{
    const handle=backfillSel?.value;
    const fromYear=+document.getElementById('sp-yt-backfill-from').value;
    const toYear=+document.getElementById('sp-yt-backfill-to').value;
    const query=(document.getElementById('sp-yt-backfill-query')?.value||'').trim();
    if(handle)_ytBackfillByDateRange(handle,fromYear,toYear,query||undefined);
  });
  document.getElementById('sp-yt-backfill-priority-btn')?.addEventListener('click',()=>{
    const fromYear=+document.getElementById('sp-yt-backfill-from').value;
    const toYear=+document.getElementById('sp-yt-backfill-to').value;
    const query=(document.getElementById('sp-yt-backfill-query')?.value||'').trim();
    _ytBackfillPriorityChannels(fromYear,toYear,query||undefined);
  });
  document.getElementById('sp-yt-manual-add-btn')?.addEventListener('click',_ytAddVideoByUrl);
  document.getElementById('sp-yt-manual-batch-add-btn')?.addEventListener('click',_ytAddVideosBatch);
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
  // 실제 그룹 소속이 있어도 개인 채널을 따로 두는 멤버(효연 등) — _ytSyncAll과 동일하게 표시만 해줌
  const personal=[];
  (ARTISTS||[]).forEach(a=>{
    (a.channels||[]).forEach(ch=>{if(ch?.url)personal.push({name:ch.label?`${a.name.ko} (${ch.label})`:a.name.ko,url:ch.url});});
  });
  return[...groups,...solos,...personal];
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
document.getElementById('admin-bulk-hide-btn')?.addEventListener('click',async()=>{
  if(!sb||!_isAdmin())return;
  const btn=document.getElementById('admin-bulk-hide-btn');
  const selectedItems=[...document.querySelectorAll('.gc-ch-item.admin-selected,.tv-conn-selectable.admin-selected')];
  if(!selectedItems.length)return;
  const ids=selectedItems.map(el=>el.dataset.vidId).filter(Boolean);
  if(!ids.length)return;
  btn.disabled=true;btn.textContent='처리 중…';
  const{error}=await sb.from(_YT_TABLE).update({content_flag:'hidden'}).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='숨김';_showShareToast('오류: '+error.message);return;}
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
  const{error}=await sb.from(_YT_TABLE).update({content_flag:'무관'}).in('id',ids);
  if(error){btn.disabled=false;btn.textContent='무관';_showShareToast('오류: '+error.message);return;}
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
