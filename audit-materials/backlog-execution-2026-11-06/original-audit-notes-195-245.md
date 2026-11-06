# Historical audit evidence (before execution)

These are historical observations, not current status or execution instructions. Current outcomes are in CHANGELOG.md and execution-status.json.

## 2026-11-05 (Codex — 검수245차·알엠/태용/소연 공개 크레딧 곡수도 불일치)
- **[이슈·실제6페이지 HTTP200] [tools/seo_extra.js·build_group_pages.js]** 알엠 프로필 본문403/409 vs 링크·상세228/221, 태용110/44 vs75/38, 소연137/94 vs101/62(각 작사/작곡). 244차 은채까지 실제4명8페이지에서 같은 raw/기본곡 중복제거 혼용을 확인. 신규 크레딧 주인 오류나 상세 페이지가 수백 곡을 잘못 삭제한 사건으로 보지 말 것.
- **[완료] [credit-count-controls-live-6.json]** 각 실제 title/h1/본문/링크/h2 저장. 알려진 원본403/409 등을 무조건 상세 수치로 덮어쓰기보다 생성기의 문장 집계와 상세 집계를 공통화. 더 넓은 후보는 credit-count-consumer-census.json. 후속 수정 후 같은6페이지에서 기준 일치를 확인하고 정상 발매본 크레딧 원본은 유지. 운영 변경 없음.



## 2026-11-05 (Codex — 검수244차·작사/작곡 곡수 기준이 프로필과 상세에서 다름)
- **[확정·실제 공개 HTTP200]** /en/g/dia/eunchae/ 본문은 작사7/작곡2인데 같은 페이지 링크는5/1. 연결된 /credits/의 title/h2도 Lyrics5/Composition1이다. 원본 7행에 너만모르나봄/13월32일의 다른 발매본이 각각 중복되고, 작곡2행도 같은13월32일이다. 정상 참여곡이 갑자기 지워진 것이라고 해석하지 말 것.
- **[원인·오프라인 범위] [build_group_pages.js creditsFor·tools/seo_extra.js loadStatic]** 실제 creditsFor는 _songBase로 버전/발매본을 묶고, loadStatic은 raw 배열 길이를 쓴다. 최신 main efbbdbceac 원본을 실제 함수로 읽은 결과 상세 생성 대상585명 중 primary 원본 곡수와 dedup 곡수가 다른463명을 목록화. 이 숫자는 463명의 크레딧 주인이 틀렸다는 뜻이 아니며 463개 공개 페이지 전수 접속도 아님. 이번 실제 두 페이지 검증은 은채만.
- **⏳ 덜 된 일 [Claude]** 프로필 사실문장·크레딧 링크·상세 h2/title에서 같은 곡수 기준을 쓰거나 발매본별 참여/고유곡 수를 명확히 구분. artist_credits 원본에서 다른 발매본/Inst.를 삭제해서 숫자 맞추지 말 것. eunchae-credit-pages-live.json / credit-count-consumer-census.json 참조. 수정 후 node tests/credit-pages.test.js 및 은채 2페이지 동일 기준 확인. 코드/DB 변경 없음.


## 2026-11-05 (Codex — 검수243차·은채 영상 오류와 정상 다이아 작사 크레딧 분리)
- **[완료·정상 대조]** 다이아 은채의 artist_credits aid982350은 Melon 공식 프로필 소속 DIA/L.U.B과 일치. 공식30178736(13월32일)에는 은채 작사/작곡,8224333(기억할게요)에는 은채 작사이며 두 곡 모두982350 링크 확인. 홍은채 원본은 별도 aid3093339로 저장돼 있고 이번에 본 대표2곡은 르세라핌 오혼입이 아니다.
- **[범위]** 은채 전체7작사/2작곡 행 전수를 이번에 공식 확인한 것은 아니지만 240차 잘못 붙은 영상 때문에 이 정상 크레딧/유닛 앨범까지 일괄 제거하거나 홍은채로 옮길 근거는 없다. 가수 신원과 표시 곡수의 다른 문제(244차)를 구별.
- **[근거] [eunchae-credit-control.json]** 공식 artist982350/곡30178736/8224333 3회 HTTP200, 현재 두 은채의 크레딧 원본을 함께 저장. 외부 페이지 전체/가사 본문은 저장하지 않고 소속/크레딧 관련 부분만 보관. 운영 파일 변경 없음.



## 2026-11-05 (Codex — 검수242차·다이아 정상 보존 대조/최신 main 범위 재확인)
- **[완료·메모리 대조]** 실제 다이아 HugU/WooWoo/예빈·솜이 GoodNight 제목은 현재 M2 다이아 strong을 유지한다. 솔로 디아 제목에서 영문 DIA만 뺀 통제는 픽시/디아 weak로 바뀌어, 그룹 영문명 배제 하나만으로 올바른 신원에 도달하지 않는다. 정상 주은 개인채널 커버는 제목 M2 null이어도 채널 소유권 수집이 맞는 대조다. dia-normal-and-identity-controls.json에 실제/메모리 제목 구별.
- **[최신 main]** origin/main efbbdbceac 재확인. Claude의 모바일 카드 높이/인스타 계정 표시와 겹치는 수정 없음. admin/shared/artists/groups/build_group_pages/seo_extra 6파일과 검수한 app 7함수는 pinned e64f24f9cd와 원문 동일(final-main-source-comparison.json). 이번 데이터/생성기 지적이 최신 수정으로 이미 해결됐다고 간주하지 않음.
- **[인수인계 상태 갱신]** Claude의 음방1위 313건은 최신 main 기록상 사용자 승인 후 반영 완료다. 228차 시점의 보류 상태를 현재 미결로 다시 실행하지 말 것. 음방 수집기/DB 추가 실행은 하지 않았다.
- **[제한]** 이번 영상 추가 표본은 group_ko 인덱스와 명시 ID로 제한 SELECT. 정적 페이지에서 해당 영상ID를 못 찾은 것은 앱에도 절대 안 뜬다는 뜻이 아니며, public DB 상태·공개 HTML·실제 앱 클릭 확인을 각 항목에 분리해 적었다. 코드/DB/공유 폴더 변경 없음.



## 2026-11-05 (Codex — 검수241차·집대성 최근 공식 영상에 출연 게스트 태그 누락)
- **[확정·현재 DB/공식 제목]** TPXVXEiwhwM(10/16 본편),CQKbw3xr3Io(10/13 예고)는 빈집대성 ep.5 성한빈. DB는 빅뱅/대성만, with_groups/with_members 모두 빈 배열. 공식 설명에는 성한빈/제로베이스원과 수빈/TXT가 명시된다. 최소 제목의 주 게스트 성한빈(a0338)이 빠졌고, TXT 수빈(a0128)은 실제 해당 영상 범위 확인 후 별도 판단. 우주소녀/솔로 동명 수빈으로 붙이지 말 것.
- **[추가 후보·범위 구분]** qWASj0mhxFw(11/3) 빈집 제노재민에 드림 한 스푼, wMuTWha2wN0(11/1) 나 재민인데 안 외로운 거 맞다도 같은 빈 게스트 상태. 공식 설명의 NCT드림 제노(a0028)/재민(a0029) 문맥은 분명하지만 설명에 추가된 런쥔·해찬·천러·지성을 영상별 실출연 확인 없이 전부 붙이지 말 것. own채널 주인 빅뱅/대성 모델 자체를 외부 게스트 그룹으로 일괄 덮어쓰지 않음.
- **[현재 파서/통제]** M2 제목 단독은 성한빈 두 건을 제베원/성한빈 weak로 찾지만 제노재민 두 건은 null. 이 결과만으로 수집 전체 경로 원인을 확정하지 않음. wMu 제목은 NFD이나 메모리 NFC 변환 후에도 null이어서 유니코드 정규화만으로 해결된다고 제안하지 않는다. bigbang-nfc-title-controls.json.
- **⏳ 덜 된 일 [Claude]** 공식 4영상의 실제 게스트 확인→own채널 소유권 보존 + 출연 with 태그 한정 보강 검토. description 해시태그 전체를 무조건 출연자로 쓰거나 모든 weak/null을 무관으로 바꾸지 말 것. bigbang-guest-detail-db.json / dia-guests-oembed-12.json / dia-bigbang-title-replay.json. 운영 변경 없음.


## 2026-11-05 (Codex — 검수240차·냉터뷰 은채 4개가 다이아 은채로 공개 저장)
- **[확정 주인 불일치1·후속 같은 회차3]** _ETWA9wVykw(7/25) 공식117 선공개 냉터뷰 설명은 르세라핌 데뷔부터 도쿄돔 입성/사나·은채. DB는 다이아/은채(a0953)/게스트빈값이다. 대상은 르세라핌 홍은채(a0148)이며 버가부 은채(a1892)도 아니다. DKYY_279GTM/g_5n_8vkCG0/OM-m2O_jRjw 역시 같은117 냉터뷰 공식 은채 클립/사나 설명인데 현재 다이아/은채. 해당 3개의 실제 출연 범위는 정정 전 재생 확인 권장. 제목·업로더 4개 oEmbed200.
- **[기존 보고와 구별]** 기존 ytsf91XHNjs Smart 오태깅과 공항 mhIx2C6MUSk 후보는 이번 새 4개로 다시 세지 않음. 추가 M2/CHOOM l4EtsHLNLb4/w8KaRWSpC28/QytGEce4YoM 3개도 후보이나 이번 공식 재생/메타 검증을 하지 않아 확정 목록에서 제외.
- **[재발 구별]** 현재 M2는 냉터뷰 4개를 다이아/은채 ambiguous로 남긴다. 즉 지금 strong 자동승인까지 재현한 것은 아님. 과거 공개 저장이 그대로 남았는지와 신규 승인 여부를 분리. 기존 전체이름 그림자 방어는 제목 홍은채가 있을 때의 좁은 규칙이므로 은채 단독을 무조건 홍은채 별칭으로 바꾸면 실제 다이아/버가부 영상이 깨진다.
- **⏳ 덜 된 일 [Claude]** 최소 선공개1개 주인을 르세라핌/홍은채로 한정 재귀속 검토, 같은 회차3개는 실출연 대조 후 적용. 사나도 실제 영상 범위 확인 후 TWICE 게스트 태그. dia-selected-11-db.json / dia-guests-oembed-12.json / dia-guests-registered-roster.json. public DB와 공개 SEO는 구별: 검사한 다이아 그룹/은채 정적 페이지에서는 이 11ID 링크를 찾지 못했으며 앱 화면 실노출을 이번에 확인했다고 주장하지 않음.


## 2026-11-05 (Codex — 검수239차·솔로 디아 공식 최근 4영상이 걸그룹 다이아로 저장)
- **[확정·현재 공개 DB]** O-Fpg_FQv3A/h5E-qf13XCk/CPD5M9pt8YY는 9/17 ArirangRadio 디아 인터뷰/Neverland/안녕 라이브. UdDVIYATjtk는 2025.4.10 StoneMusic 망각의섬 MV. 모두 primary다이아/members=[]/public/auto. 공식 설명과 oEmbed200에서 가수 디아/디아컴퍼니를 확인했다. 예전 txeWvDLrs7E Knock 보고와 다른 신규4ID다.
- **[신원 근거/새 오태깅 방지]** Bugs https://music.bugs.co.kr/artist/80053703 은 여성 솔로/2009데뷔/키스&크라이 활동, Neverland(2026.7.3)와 망각의섬(2025.4.10)을 같은 아티스트로 싣는다. 걸그룹 DIA도, 현재 등록된 픽시 디아(a1798)도 아니다. 같은 영문 Dia라는 이유로 픽시로 옮기면 두번째 오류. 원문 정보는 요약만 사용하며 4영상의 전체 출연자를 재생 전수 확인한 것은 아님.
- **[재발]** 실제 pinned M2는 4제목 모두 다이아 strong/멤버[]로 다시 판정. 기존 보석 일반명사 문제와 달리 영문 DIA가 다른 가수의 정식 이름인 충돌이라 영문 태그를 무조건 강한 증거로 쓰는 경로를 회귀 검토해야 한다.
- **⏳ 덜 된 일 [Claude]** 해당 솔로/키스&크라이 등록 정책 확인 후 보류 또는 올바른 솔로 등록·한정 재귀속 검토. 무조건 영구 무관/다이아 전체 차단 금지, 정상 다이아 무대·주은 개인채널은 보존. dia-latest-25-db.json(최신 표본25, 오류율 아님)/dia-selected-11-db.json/공식 metadata12/제목 replay 저장. 코드·운영JSON·DB 변경 없음.



## 2026-11-05 (Codex — 검수238차·알파드라이브원 OST 타이틀 누락과 정상 2번 타이틀 대조)
- **[확정·공식 HTTP200]** 김부장 OST Part.1 /13761388은 공식 대표 아티스트 ALPHA DRIVE ONE, 2026.06.26, GO! GO!602362112(타이틀)/Inst.602362113 2곡. 현재 영문 Spotify 제목 Agent Kim Reactivated, Pt.1은 같은 발매본의 정상 번역/2곡 ID도 정상이며 다른 아티스트 앨범으로 오인 삭제하면 안 된다. 다만 titleTrack=null/전곡 isTitle=false로 타이틀 표시는 빠졌다. raw type싱글의 OST 표시 정책은 별도 검토.
- **[정상 대조·중요]** Talk to me /14815426은 공식 3곡 중 2번 Dance Break Ver.603454978만 타이틀이다. 현재 2번에 표시된 것이 맞다. 앨범명과 같은 첫 곡을 자동 타이틀 지정하거나 버전명을 제외하면 새 오류가 생김. 해당 최신 앨범에 songId가 아직 없는 것은 이 검수에서 오태깅/깨진 링크로 단정하지 않음.
- **⏳ 덜 된 일 [Claude]** OST의 원보컬 1행 타이틀만 한정 보강 검토. 영어 제목/반주곡/오디오ID는 보존. 237~238차 공식 3앨범은 recent-title-flags-official-3.json, 원본 전체는 -current-3.json. 수집기/DB/운영JSON 수정 없음.


## 2026-11-05 (Codex — 검수237차·아이들 We made 타이틀/공식 CD전용곡 누락)
- **[확정·공식 HTTP200] [groups.json]** We made /13728288 현재 5곡/titleTrack=null/전곡 isTitle=false. Melon 공식은 6곡이며 Gimme Dat Love602437176이 타이틀, 마지막 Mono(Feat.skaiwater)(Mono ver.)(CD Only)602437179가 추가로 있다. 현재 기존 5곡의 순서/제목/ID는 공식과 일치하므로 231~232차처럼 전체 목록 오염으로 처리할 사례가 아니다.
- **[판정 범위]** CD전용곡이 공식 목록에 있음과 실제 스트리밍 재생권은 다른 문제다. 원본 목록을 정리할 때 최소한 이 곡을 누락한 사실을 인식해야 하며, Spotify 수록 5곡과 국내 CD 6곡을 정책상 분리할지 확인. 기존 5곡을 재배치하거나 영문/한글 별도 판본으로 추정 복제할 근거 없음.
- **⏳ 덜 된 일 [Claude]** titleTrack/isTitle를 2번 공식 타이틀과 한정 대조, CD Only 노출 정책 확인 후 마지막 1행 추가 여부 결정. 한영 정적 앨범 페이지도 현재 5곡을 복제하는지 재생성 범위에 포함해 확인. recent-title-flags-official-3.json / -current-3.json 근거. 운영 수정 없음.



## 2026-11-05 (Codex — 검수236차·라이즈/엔믹스/아이들 공개 인원수 교차 확인)
- **[확정·실제 HTTP200]** /en/g/riize/는 title 현재 6명 + 목록 승한 former인데 본문 7-member. /en/g/nmixx/는 title 현재 6명 + 지니 former인데 본문 7-member. /en/g/g-i-dle/는 title 현재 5명 + 수진 former인데 본문 6-member. 특정 그룹 수기 소개가 아니라 234차 공통 생성 경로의 추가 재현이다.
- **[범위 확장·후보만]** pinned 원본에서 솔로/해체 그룹을 제외하고 전체 멤버 수와 현재 title 선택 수가 다른 그룹 86개를 추림. group-headcount-source-census.json에 제외 사유/소속별 엔트리를 저장. 이 숫자를 새 확정 오류 수나 현재 실제 인원으로 단정하지 않으며 활동중단·유닛·이전 소속·정책상 제외를 개별 판단해야 한다.
- **⏳ 덜 된 일 [Claude]** 세 공개 페이지의 한영 제목/소개/전멤버 목록을 공통 수정의 회귀 대조로 사용. 기존 멤버 페이지와 옛 직캠 링크는 유지. group-headcount-controls-live.json 실제 응답 + source-census.json 후보. 코드/DB 수정 없음.



## 2026-11-05 (Codex — 검수235차·활동 중단 건우가 탈퇴/전직 아이돌로 표시됨)
- **[확정·공개 HTTP200] [artists.json·build_group_pages.js·app.js]** 알파드라이브원 건우(a0350)는 active:false + pausedFrom:2026.04.08이고 left/groups 탈퇴 기록이 없다. 11/4에 사용자와 Claude가 활동 중단으로 정리한 데이터인데, 공개 그룹 페이지는 Gunwoo former, 개인 페이지는 former K-pop idol이라고 출력한다. 개인 Status Inactive 자체와 탈퇴/은퇴 단정은 구별해야 한다. 한국어 /g/알파드라이브원/건우/도 HTTP200, 본문 활동 종료/상태 활동종료로 재확인(status-dia-live-4.json).
- **[소스 재현·UI 구별]** 실제 _isFormerOf(건우,알파드라이브원)는 active:false만 보고 true. 공개 SEO의 former 문구는 실제 응답으로 확인했지만 앱 카드의 탈퇴 문구까지 이번에 눌러 확인한 것은 아니다. 그룹 title/description에서는 건우를 빼 7 members, 본문은 역대 전체를 세 8-member라 같은 페이지 안에서도 불일치한다.
- **⏳ 덜 된 일 [Claude]** 원본 pausedFrom/active 상태를 임의 해제하거나 left를 새로 넣지 말고, 탈퇴(left)·활동중단(pausedFrom)·그룹해체·비활동 상태를 구별하는 기존 소비 경로 검토. group-headcount-paused-live-seo.json 및 -source-replay.json 참조. 양옌/유토처럼 pausedFrom과 실제 left가 함께 있는 사람까지 동일 오류로 세지 않음. 코드/DB 변경 없음.


## 2026-11-05 (Codex — 검수234차·현재 그룹 소개가 역대 인원을 그대로 합산)
- **[확정·공개 HTTP200]** en/g/secret-number/ 제목은 현재 Navi·Dinda·Ebin·Min C 4명인데 본문은 11-member. 멤버 목록에는 전 멤버 7명+현재 4명이 명시돼 페이지 자체가 모순된다. 역대 멤버 아카이브 보존은 정상이며 그 전체를 현재 인원수로 쓰는 것이 문제다. 한국어 /g/시크릿넘버/도 HTTP200/11인조로 동일 확인(status-dia-live-4.json).
- **[원인/통제] [build_group_pages.js]** membersOf는 과거 소속까지 모두 수집하고 groupIntroHtml의 memCount는 그 배열 길이를 그대로 쓴다. 실제 함수의 한국어 생성도 시크릿넘버 11인조. 시크릿은 전체 5명을 세며, 메모리에서 disbanded만 false로 고쳐도 여전히 5인조라 208차 해체 플래그 정정만으로 현재 3명 소개까지 해결되지는 않는다. 운영 데이터 수정 아님.
- **⏳ 덜 된 일 [Claude]** 현재 인원/역대 멤버 목록을 별도로 정의해 한영 소개·제목·설명 일치 검토. active:true만 세면 활동중단 건우를 빼 7명으로 만드는 235차 문제가 남으므로 단순 필터 금지. 과거 탈퇴자 페이지/영상은 보존. 근거 group-headcount-paused-source-replay.json / group-headcount-paused-live-seo.json. 코드/DB 변경 없음.



## 2026-11-05 (Codex — 검수233차·잘못된앨범5개 트랙리스트가공개SEO에실노출)
- **[확정·실제 배포200]** en/g/btob/a/pressplay/(7곡),god/a/chapter3/(13곡),pentagon/a/pentagon/(6곡),pentagon/a/thumbsup/(5곡),wjsn/a/happymoment/(12곡)의공개소개/본문에231~232차잘못된목록이그대로나온다.각meta설명도해당곡수를명시.예측/로컬생성물이아니라실제HTTP응답을읽음.
- **[후속 범위]**원본카탈로그정정후한영앨범페이지/그룹앨범목록을재생성해야검색·LLM에남은오정보가바뀐다.새SEO생성기가곡명을새로만든것이라고단정하지않음.이번에는원본JSON의기존목록을정적페이지가그대로공개한경로다.본문에Credits:Melon이있어도전체트랙리스트정확성인증이아님.
- **⏳ 덜 된 일 [Claude]**해당앨범한정원본복원/정상메타보존→공개5페이지이전가짜/잘못된버전제목빠짐과공식목록확인.실제배포본문/메타는 duplicate-version-albums-live-5.json.원천데이터수정없이생성기표시만바꾸는방식으로숨기지말것.코드/운영수정없음.


## 2026-11-05 (Codex — 검수232차·곡수같은4앨범도실제곡명/타이틀/순서불일치)
- **[펜타곤 ThumbsUp!10202667·5대5]**공식5곡은청개구리31297123(타이틀)/저두요31297124/SKATEBOARD31297125/밤에비가내리면31297126/ThumbsUp!31297127.현재ThumbsUp!를첫타이틀로하고BTS(BehindTheScar)/Tornado/NaughtyBoyEnglishVer./ThumbsUpInst.를놓았다.전체5곡/기존ID몇개유효검사로는못잡음.일부제목만바꾸면중복/순서/타이틀이남아공식5행전체대조필요.
- **[god Chapter3/717·13대13]**현재예쁜여자10436은실제나와함께춤을춰.장미의전쟁10431이빠지고거짓말Inst.10435가원보컬과같은ID로추가됐다.공식13곡순서도일부달라짐.촛불하나Inst.105717은실제정상반주곡이므로Inst.문자포함전체삭제금지.기본Intro와파리(Intro)부제표기차이까지다른곡으로기계집계하지않음.
- **[쥬얼리 Again/16566·12대12]**현재1492살.../314600은실제Sad,AgainRemix/314603은Maybe,이별은모르게Inst.314605는원곡보컬ID중복이다.정상1492...는314602이며현재누락.단순곡수/원곡명정규화로정상판정금지.
- **[젝스키스 RoadFighter/5359·15대15]**기사도/79692는실제FakeG’s,사랑하는너에게/79693은CryingGame,친구/79694는FlyingLove,말괄량이길들이기/79695는약속된운명,예감/79697은7전8기,너를보내며/79698은RunAway.끝Inst.행79701/79702도실제Last/그날까지보컬곡이다.공식여우사냥79699등누락.앨범명2집번호는이번공식본문에번호미표시라별도검증없이바꾸지않음.
- **⏳ 덜 된 일 [Claude]**4앨범원본/곡크레딧백업→공식행별title/no/songId/isTitle로한정복원검토.다른판본/실물CD근거가있는행은별도판본으로구분한뒤판단.공식목록과현재전행을 duplicate-version-albums-official-12.json/-current-12.json에저장.전부수정완료한것아님.


## 2026-11-05 (Codex — 검수231차·Inst.중복은더넓은앨범목록오염의징후)
- **[공식 목록 대조]**베리베리ROUND3WHOLE10930438은13곡(틈/Moment부터ThankYouNEXT? CDOnly까지),현재10곡중UndercoverInst.가원보컬34949397중복이며기억하길/그런사람/RainOnMe/숨바꼭질등해당원문목록에없는제목이섞였다.
- **[우주소녀 HappyMoment10069220]**공식10곡HAPPY/Miracle/Mr.BADBOY/SUGAR/Babyface/퐁당퐁당/FollowMe/B.B.B.Boo/Geeminy/지금만나러가요.현재12곡은Cantare/CatchMe/KISSME/여러NewVer./HappyInst.등으로대부분다르다.HappyInst.30459036은원보컬HAPPYID.그곡들이다른앨범에도없다고주장하는것이아니라이발매본의목록/ID가틀린것.
- **[비투비 PressPlay2149892]**공식6곡PressPlay(Feat.G.NA)/WOW/사랑밖에난몰라/U&I/StandUp/MyGirl.현재7곡은WOW/Stay/하루가너무해/언제나/오늘이후로/꿈에/WOWInst.로첫제목만맞는다.WOWInst.3903413은보컬ID중복.
- **[펜타곤 PENTAGON10004706]**공식7곡WakeUpIntro/Pentagon/Gorilla/미지근해/Smile/OrganicSong/YouAre.현재6곡에Beautiful/Shine/CanYouFeelIt/GorillaInst.가섞임.GorillaInst.30029167은원보컬ID중복.정상Gorilla/Pentagon도순서가다름.
- **⏳ 덜 된 일 [Claude]**단순Inst.마지막한행삭제가아니라4발매본의전체공식목록과한정재대조.실물별도판본/CDOnly가확인되는곡까지일괄삭제금지.현재목록/원문13·10·6·7행은자체JSON에있어재수집없이검토가능.자동수집기전체재실행/원본JSON교체는하지않음.


## 2026-11-05 (Codex — 검수230차·언어판4앨범이같은오디오ID를공유)
- **[웨이션브이 VisionWings14431267]**공식7곡중중문鸢(VisionWings)은602739386,영문VisionWings602739392.현재첫곡/영문7번모두602739392라첫중문곡이영문판에연결.영문행은정상보존.
- **[웨이션브이 KickBack10575611]**공식중문秘境(KickBack)33340659/한국어6번33340664.현재첫곡도33340664라한국어판과중복.나머지4곡ID/한국어행은정상보존대상.
- **[브브걸 SummerQueen10631055]**공식한국어치맛바람33589260/영문5번33589264.현재한국어제목의첫곡에도33589264가붙음.정상영문행/PoolParty·SummerByMyself·FEVERID는그대로보존.
- **[트와이스 FormulaOfLove10774753]**공식15번TheFeelsKoreanCDOnly는34254837,16번영문34254838.현재둘다34254838.**CDOnly라곡자체를빼거나ID없음으로추정하지말것**—Melon공식목록에도15번34254837이존재한다.실제스트리밍권한/재생가능성까지확인한것은아님.
- **⏳ 덜 된 일 [Claude]**4앨범의언어행4개만공식ID와다시대조해한정교정검토.트랙리스트수/순서/이름을대규모바꿀이유없음.원곡·언어판을합치는_songBase를오디오ID검증에그대로쓰지않음.공식12앨범목록/현재12앨범전체행을저장,운영변경없음.


## 2026-11-05 (Codex — 검수229차·앨범내동일songId중복61참조/55앨범형태검사)
- **[완료·오프라인] [groups.json·artists.json·unitDiscography]**같은앨범내songId중복을별도로세어61앨범참조/55고유목록형태를찾음.유닛7명에게복제된SMTHEBALLAD도1형태로묶음.61개서로다른앨범오류라는뜻아님.186차의서로다른_songBase33ID검사와달리이번에는Inst./언어판처럼기본곡명이같아도검사한다.
- **[중복보고 제외]**55형태중31형태는앞선33ID후보에없었으나그중CNBLUE는227차기확인.나머지모두새확정오류라고일괄세지않음.리믹스/라이브멘트/판본등원문확인필요. within-album-duplicate-song-ids.json에모든후보저장.
- **[공식 확인 묶음]**12개명시앨범ID를각1번Melon공개목록조회,전부200/차단본문없음.4개언어판한정ID오류(230차),다른8개는Inst.중복뿐아니라곡목록/순서/타이틀도달라231~232차분리.코드/DB/운영JSON수정없음.




## 2026-11-05 (Codex — 검수228차·최신main1107f458a4와검수소스동일성확인)
- **[완료]**git fetch 후 origin/main1107f458a4(Claude음방1위수집/결방보완)확인.이작업과겹치는수집기/1위DB정정은건드리지않고콘텐츠귀속·앨범·프로필검수계속.신규1위313건보류는Claude/사용자진행사항이므로여기서재실행하지않음.
- **[대조]**이번검수의admin.js/shared.js/artists.json/groups.json/build_group_pages.js/tools/seo_extra.js는e64f24f9cd와Gitblob동일.수정된app.js에서도검수한_groupEndDate/_memberVideoCutoffCore/_memberVideoCutoff/_buildMemberTimeline/_mxAgeAt/_mxFigBuild6개함수원문이그대로임을확인.따라서이전pinned재현이클로드새수정으로이미해결됐다고간주하지않음. latest-main-audited-source-comparison.json근거.새코드수정/push없음.


## 2026-11-05 (Codex — 검수227차·CNBLUE TRIGGER는서로다른일본싱글정보혼합)
- **[확정·현재 JSON]**씨엔블루TRIGGER는미니/2022.10.19/5곡,cover11078855,melonAlbumId11081490이며TRIGGER와TRIGGERInst.에같은songId35741281을쓴다.5행TicTic/Different/Run/Inst.는공식해당두발매본목록에없다.지금같은ID로보컬곡과Inst.를동시에재생시키는오연결도포함.
- **[공식 구분1]**Melon11078855는2022.10.14 디지털TRIGGER1곡/songId35730576,현재cover는이발매본에맞다.11081490은2022.10.19 LETITSHINE싱글3곡 LETITSHINE35741280/TRIGGER35741281/MOON35741282다.레이블WMJapan공식 https://wmg.jp/cnblue/discography/26558 도13thSingle/10.19/CD3곡동일확인.이런혼합에서커버만ID에맞춰바꾸면틀린앨범제목/수록곡이남는다.
- **[정상 기존발매 보존]**현재별도LETITSHINE11052140/2022.09.09/1곡35621876은선공개디지털싱글이므로10.19 CD3곡발매본과무조건중복으로삭제/병합하지않음.같은곡도발매본별오디오ID가다를수있다.
- **[실제 UI 한계]**일본판표시를잠시켜TRIGGER가미니·2022·JP로보이는것은확인.이번조작에서는상세창이열리지않아5곡전부실제상세노출을확인했다고주장하지않음.사용한일본판보기필터는검수전off로복원.데이터/공식원문충돌은확정.
- **⏳ 덜 된 일 [Claude]**TRIGGER행이의도한발매본확인→①TRIGGER를유지한다면10.14디지털1곡/정확ID/싱글로복원검토②10.19 LETITSHINE3곡은원래빠진별도정식발매인지기존variant정책으로검토.원본백업/현재다른정상발매보존.3곡/1곡목록은 album-cover-conflict-official.json,현재행은 -current.json에보관.코드/운영JSON수정없음.


## 2026-11-05 (Codex — 검수226차·비투비 Born to Beat 미니와데뷔디지털싱글혼합)
- **[확정·실제 UI]**비투비카드에서BorntoBeat클릭→미니1집·6곡/2012.03.21,Insane/BTOB/IOnlyKnowLove/넌내것/LikeThat/InsaneInst.가보인다.원본JSON그대로다.커버는2104986,melonAlbumId는2096628로서로다른발매를가리킨다.
- **[공식 대조]**2096628은2012.03.21 비밀(Insane) 디지털2곡(비밀3742259/Imagine3742260).2104986은2012.04.03 BornTOBeat4곡(BornTOBeat3758033/비밀3758034/Imagine3758035/MondayToSunday3758036),비밀과Imagine에타이틀표시.현재커버는후자와맞고앨범명도의도는후자로보이므로커버만앞ID로바꾸면안됨.
- **⏳ 덜 된 일 [Claude]**현재미니행의의도확인→공식4.03미니/4곡/정확albumId·songId·타이틀에맞춘한정복원검토.필요하면3.21데뷔디지털발매는별도표현.**그룹자체데뷔2012.03.21은정상이라4.03으로바꾸지말것.**초판/아시아특별판등다른버전과곡수를섞지않음.앨범페이지/곡연결/History의붙은앨범까지한정재검증.실제현재JSON/공식두발매원문저장.코드/DB수정없음.


## 2026-11-05 (Codex — 검수225차·앨범12240참조커버ID/앨범ID정합성오프라인전수)
- **[완료·정적 대조] [groups.json·artists.json·unitDiscography]**e64f24f9cd앨범12240참조(유닛복제포함)를읽어Melon커버파일명에서albumId를추출할수있는10736참조를비교.명시melonAlbumId와다른것은비투비BorntoBeat/씨엔블루TRIGGER2참조뿐.12240을고유앨범수라고세지않고이미지접속성/제목가창자전체정확성인증으로해석하지않음.
- **[핵심 결과]**공식앨범4개를각1번조회해4개HTTP200/차단본문없음확인.두사례모두커버가가리키는발매와명시앨범ID가가리키는발매가다른문제이며226~227차에서제목/발매일/곡목록까지구분.기계충돌만보고커버2개를바꾸는패치는금지.
- **[근거] [album-cover-id-consistency.json·album-cover-conflict-official.json·album-cover-conflict-current.json]**각원본필드와공식목록저장.비교일치10734개가전부정확한사진/가창자라는뜻아니며Spotify/기타이미지의미파싱1504참조는이검사의대상밖.코드/DB/운영파일수정없음.




## 2026-11-05 (Codex — 검수224차·일반어 여자친구로저장된방송/출연자별후속분리)
- **[현재 DB/공식 설명]**VSN9EQ-j2yQ/XyZ5RjNG77w는JTBC연애전쟁의이효리출연클립인데primary여자친구/members=[]/public이다.제목여자친구는관계명사.공식설명도이효리/프로그램을명시하므로최소그룹여자친구주인귀속은오류다.등록된이효리a0844현재primary핑클모델을먼저확인해한정재귀속검토;프로그램상다른패널전체를게스트로추정추가하지않음.현재M2도두제목모두여자친구strong/멤버[]로유지.
- **[출연자 확인 후 재귀속 후보]**QCn56RcI1Ag 미미의과몰입여자친구연기는제목/공식설명상미미X이수근상황극,현재여자친구/빈태그.230114방송의미미는오마이걸(예고/방송보도 https://zdnet.co.kr/view/?no=20230114083032).**같은회차에비비지은하·신비도출연**하므로해당클립실제포함범위를보고주인오마이걸/미미와실제게스트를판단해야하며영상전체무관처리금지.회차전체출연자를클립에전부붙이지말것.
- **[다른 비비 주의]**0aDg4Amd85I는비비·크러쉬아는형님클립,관계명사여자친구가주인으로저장.가수BIBI를등록된이달소ViVi(a0557)나HITGS비비(a1308)로옮기면새오태깅이다.46PrVlOgifk도이선빈상황극인데여자친구귀속.이2개공식oEmbed200/설명확인했으나전체실제등장범위는아직미확인→등록아이돌주요출연이없으면무관여부검토.
- **[보류·드라마/예능]**ws4SG3uhGi0 최애의사원강하기/여자친구클립,za0DT6qNY1w 식스센스B사이드여자친구연기도현재그룹여자친구.최애의사원은기존검수상ITZY유나출연이있어프로그램전체무관금지,식스센스도시즌별아이돌출연자확인필요.낯선프로그램이름만으로아이돌없음단정안함.
- **[범위/근거]**gfriend2025-db.json20개표본은public17+이미무관3이고전수오류율아님.전체20개를새오류로계산하지않음. gfriend-7-detail-db.json/-replay.json/공식metadata26개중해당3개보관.다수는2026가을에도새로노출되는일반어동형문제.코드/DB수정없음.


## 2026-11-05 (Codex — 검수223차·뉴이스트출신JR의LIGHTS가샤이니로공개)
- **[확정·공식 제목]**aVa16O0HYYs는THEKPOP공식 #Kim_Jonghyeon #종현 #LIGHTS #앤유들_착한챌린지,2022.12.02.현재primary샤이니/members=[]/public/auto다.등록솔로JR(a0886,뉴이스트출신)의MERIDIEM수록Lights/팬덤앤유문맥이며샤이니종현과동명이인이다.현재등록이름JR/그룹솔로/뉴이스트2022.03.14탈퇴모델확인.
- **[재발/정정 분리]**현재M2제목판정은null이라이제도샤이니로새추론된다고주장하지않음.하지만이미저장된publicgroup_ko는남아있다.김종현이라는풀네임도두사람이같으므로풀네임별칭만전역추가하는해결은안전하지않다.
- **⏳ 덜 된 일 [Claude]**공식2022LIGHTS클립/실제출연재확인후기존솔로키JR+membersJR한정재귀속검토.샤이니종현의사후공식아카이브영상은업로드일이2017이후라는이유로차단하지말것. jonghyeon-lights-db.json/-oembed.json에원문보관.동시에본BTS김지민/동방신기지창민조건의공개bounded조회는각0개(해당조건만정상대조,전DB인증아님).


## 2026-11-05 (Codex — 검수222차·앱에서보정한늦은합류6명도SEO는데뷔연령불일치)
- **[배포HTTP200·5명 불일치]**영문소개허영지(en/g/kara/heo-youngji)는meta/본문12세데뷔,강지영(kara/kang-jiyoung)13세,윤은혜(baby-v-o-x/yoon-eunhye)12세,준(u-kiss/jun)11세,서아(triples/seoah)12세로노출.기존앱_MX_JOINED의확인된합류보정기준으로계산하면각19/14/14/17/13세다.개별생일이나그룹창립일을바꿀문제가아님.
- **[정상/제한 대조]**주빈(triples/joobin)은기존앱보정전후정수나이가둘다14라지금SEO의14세자체가새오류는아님.해당보정목록의날짜는프로젝트기존기준을비교한것이며이번에6명의정확한개별첫음방일/데뷔일정의를독립재조사한것은아니다.
- **[확정 원인] [build_group_pages.js·tools/seo_extra.js ages]**빌더는a.groups의소속별엔트리를groups[g.ko]로변환해joined문맥을지우고,ages는groupInfos최소그룹창립일로데뷔나이를계산한다.따라서기존앱6명예외/새4명joined어느쪽도그대로반영되지않는다.219차민씨14세와같은SEO소비경로문제다.
- **⏳ 덜 된 일 [Claude]**앱그래프/영상카드/개인History/정적소개가공유할수있는기존합류·최초활동기준검토.여러그룹활동이력에서무조건현재소속합류일만쓰면먼저데뷔한옛그룹이력이사라질수있어개인최초데뷔와그룹합류를구분. late-join-six-live-seo.json에6개실제메타/본문값보관.생성기실행/코드수정없음.




## 2026-11-05 (Codex — 검수221차·시크릿 넘버 띄어쓰기와영문그룹접두사 실제 비교)
- **[실제/통제 재현] [admin.js e64f24f9cd]**220차실제쇼챔제목 시크릿 넘버/SECRET NUMBER는primary시크릿+with시크릿넘버,strong.같은제목의한글띄어쓰기만메모리에서시크릿넘버로바꾸면primary시크릿넘버/with없음으로정상.영문만남긴통제는primary시크릿넘버가맞지만with에시크릿이잘못남는다.단순띄어쓰기일괄치환한후primary만검사하면영문게스트오염경로를놓칠수있음.
- **[정상 보호/제한]**통제제목은실제운영제목을수정한것아님.실제SecretOfficial의2026무보정라이브는현재M2null,예빈소개는시크릿/예빈weak다.자체채널은소유권근거로정상수집된콘텐츠라null/weak만보고무관처리하면안됨.기존코드주석도시크릿한글전체해시태그강제시정상MV누락을경고한다.
- **⏳ 덜 된 일 [Claude]**기존그룹명공동매칭/부분명충돌처리를활용해시크릿넘버의완전한이름에포함된시크릿을별도그룹으로세지않는방향검토.별개두그룹이실제로같이한제목은보존.쇼챔구조파서경로와일반영문경로둘다재현확인. secret-name-prefix-controls.json에실제제목/메모리통제구분저장.코드수정없음.


## 2026-11-05 (Codex — 검수220차·시크릿SEO/DB에다른아티스트5개와익명싱어1개)
- **[확정5개·공식제목/채널/현재DB]**공개Secret영문페이지에섞인 gw9O2ap-g64/jhrv9Jwb-V4/yWqiVm_hVmw는시크릿넘버2020WhoDis쇼챔/퇴근길라이브,zeAlM06s1OQ는SPICA-SecretTime,rzw_kTAuWQg는이은상-2월29일Dingo시크릿커버다.5개전부현재DB도primary시크릿/public/members=[]라정적캐시잔재만의문제아님.3개는맞는그룹을with로이미갖고있지만주인이틀려두그룹에걸친오염이다.
- **[구체 귀속]**앞3개→시크릿넘버,SPICA→스피카,이은상→현재등록솔로이은상a0615(2020.02는X1해체후·YOUNITE데뷔전,기존현재모델확인).주인으로옮긴그룹을with에중복유지하거나시크릿을함께한그룹으로남기지않도록실제공동출연여부검토.재귀속후기존파생정적페이지재생성필요.
- **[보류1개]**1rQmfYgy0OE는Dingo시크릿커버/나의사춘기에게익명싱어영상으로현재시크릿.공식설명도실명없어누구인지확정못함.제목의그를남자가수라고단정하거나같은시리즈첫회이은상에게자동귀속하지않음.실제영상확인전삭제/무관확정금지.
- **[근거] [secret-seo-6-db.json·secret-seo-6-oembed.json·secret-seo-video-links.json·secret-seo-6-replay.json]**6개모두공식oEmbed200.현재매처는SPICA/이은상은올바른주인을찾지만쇼챔2개는여전히시크릿strong,퇴근길/익명싱어는null.원인별로스윕대상구분해야하며전체덮어쓰기금지.코드·DB수정없음.


## 2026-11-05 (Codex — 검수219차·잘못된재활동/데뷔나이가배포SEO에도노출)
- **[확정·공개HTTP200]** https://kpop-universe.kr/en/g/secret/ 본문은Secret was a 5-member그룹소개/전효성·징거·예빈까지former로표시한다.현재공식3인재활동(208차)과다르고개별예빈페이지는StatusActive라소개끼리충돌.원년5명과현역3명·탈퇴2명을구분해야함.기본meta설명은해체문구가없으므로본문과meta전부같은오류라고뭉뚱그리지않음.
- **[확정·검색설명과본문]** https://kpop-universe.kr/en/g/secret-number/min-c/ 는meta description에debuted at14,본문Debutage14.2025.08합류대신그룹2020데뷔일을썼다.앱필터/그래프만수정하면검색엔진/LLM이읽는이정보는남으므로build_group_pages.js개인소개날짜소비도검토해야함.
- **[정상 보호]** https://kpop-universe.kr/en/g/secret/yebin/ 는생일2002.09.01/Active/정상개인2앨범으로보이며2009개인데뷔나이문구는없다.예빈페이지까지똑같이14세/해체오류라고세지않음.3주소canonical/영문경로도맞음.
- **⏳ 덜 된 일 [Claude]**그룹현역상태/개인합류일모델정정후생성기같은필드소비범위검토→해당한영정적소개재생성/배포확인. joined-disbanded-live-seo.json에실제HTTP응답메타/본문보관.코드/운영파일수정없음.




## 2026-11-05 (Codex — 검수218차·같은 해 먼저 탈퇴하면 해체로 잘못 계산하는History 경로)
- **[확정·현재 함수/데이터의 이벤트 출력] [app.js _buildMemberTimeline]**개인탈퇴와그룹해체의연도만비교해같은해이면_ended=true를유지한다.렌타a1082 left2023.09.22/TO1해체2023.12.31인데이벤트는2023.09 티오원해체로만들어진다.앞서joined와다르게이문제는날짜가이미있어도연도만비교해서생김.
- **[확장 후보2명]**양쪽날짜가모두YYYY.MM.DD이고같은해left<disbanded인등록groups[]는렌타와이한결a0612(BAE173 left2026.02.28/해체2026.06.30)2명.후자는이번에외부탈퇴원문까지재검증한것은아니며현재내부날짜가맞다면같은분기영향을받는후보로기록.
- **[원문/실제 UI 한계]**렌타는9/22본인SNS탈퇴편지전문보도 https://sports.khan.co.kr/article/202309221624003 및12/31전속종료공식입장전달 https://www.tenasia.co.kr/article/2023121713564 로날짜순서재확인.실제카드상단 티오원2022.06~2023.09는정상표시였고이번브라우저관찰에서렌타History행은보이지않았다.따라서현재화면에잘못된해체행이보였다고주장하지않고소스이벤트생성경로의확정문제로남김.
- **⏳ 덜 된 일 [Claude]**정밀도있는날짜끼리탈퇴/해체순서판단개선검토.연도만/월만알때보수적판정은유지하고해체까지함께한멤버를전원탈퇴로바꾸지말것. same-year-left-before-disband.json 및 member-timeline-joined-replay.json에현재입력/렌타이벤트출력저장.코드변경없음.




## 2026-11-05 (Codex — 검수217차·시크릿넘버 민씨 카드에2020영상12개 실노출/SQL삭제대상 아님)
- **[확정·실제 UI]**별도검수탭에서시크릿넘버민씨카드를열어#tv멤버영상목록에2020 WhoDis/GotThatBoom/넘버원/수트댄스/딩고영상이노출되는것확인.프로필은2006.04.21/민씨,경력은데뷔7년차로표시된다.새멤버합류일은데이터상2025.08.14인데2020영상까지자신의목록처럼끌려온다.
- **[실제 노출12ID·DB대조]**d_DiV_Rh3fE,Yfq39YKb4vE,cYBDbMDeIXE,9cJjJZq8xGU,X9JaQ7tA5hc,UQaFzXuq-7M,UTecy0CNuAc,QWe5hTS9FFY,XZJD2dBb4LU,ZJzintmZ3mM,jTL1tHzdio4,CaJxWDkHxvA.모두group시크릿넘버/members=[]/public,발행2020.민씨로DB오태깅된12개가아니라빈태그그룹전체영상이멤버카드fallback으로노출되는문제다.3개는수동잠금이지만태그를풀거나영상무관처리할이유가없다.
- **[확정 원인/통제] [shared.js _artistGroups·app.js _memberVideoCutoff]**새4인(a1893~a1896)은루트joined만있고groups없음._artistGroups는a.groups||[a.group]라루트joined를전달하지않는다.멤버컷오프는gEntry.joined만보므로4명전부{active:true}뿐.기존groups[].joined모양으로메모리에만준대조는4명전부joined:2025-08-14를반환.실제함수/실제원자료실행으로확인,운영파일변경안함.
- **⏳ 우선 후속 [Claude]**루트joined와기존groups[].joined의표현/읽기정책통일검토→민씨실제카드에서2020빈태그영상빠짐/2025.08이후정상영상보존→다른3인동일검증.영상12개삭제/무관/숨김이나원년멤버전원태그덮기로해결하지말것. root-joined-cutoff-replay.json/minc-before-join-12-db.json근거.216차그래프/215차타임라인은별도소비경로라컷오프만고쳐도끝아님.


## 2026-11-05 (Codex — 검수216차·데뷔나이 그래프는저장된합류일대신별도6명목록만사용)
- **[확정·실제 계산] [app.js _mxFigBuild·_MX_JOINED·_mxAgeAt]**시크릿넘버나비/딘다/에빈/민씨는joined=2025.08.14가이미루트에저장됐는데그래프는별도_MX_JOINED6명에없어그룹데뷔2020.05.19로계산한다.현재나이17.10/16.74/16.31/14.08,joined대조22.34/21.98/21.54/19.32.4명전부12~32세필터를통과하므로단순범위제외도안됨.실제그래프DOM4개를모두클릭해본결과가아니라실제함수/현재데이터의좌표입력재생이다.
- **[예빈 범위]**시크릿예빈은현재7.12세로계산돼12세하한에서빠짐.208차후속으로joined를추가해도현재그래프는그필드를읽지않으므로그것만으로누락이해결된다고말하면안됨.
- **⏳ 덜 된 일 [Claude]**또하드코딩목록에인물4~5명추가하기전기존groups[].joined/루트joined의공통읽기모델검토.기존6명정상보정/연도·중앙값/버추얼생일필터는보존. member-debut-age-consumer-replay.json에현재입력/대조입력/실제함수보관.코드변경없음.


## 2026-11-05 (Codex — 검수215차·208차보충: joined 데이터만고쳐서는History가안고쳐짐)
- **[추가 확정·실제 이벤트생성블록] [app.js _buildMemberTimeline]**realGroups를만들때joined를버리고모든그룹이벤트를info.debut로만만든다.기존joined가있는8명에그실제블록을재생하니시크릿넘버새4명은2020.05데뷔,티오원다이고/렌타/전여여정은2020.04데뷔로생성된다.장현승은joined와원그룹데뷔2009가같아날짜차이정상보호.8명모두오류가아님.
- **[중요 한계]**새4명처럼그룹데뷔이벤트1개뿐이면현재History는숨겨질수있다.실제로시크릿예빈에서2009데뷔UI를확인한208차와달리새4명의2020이벤트가모두현재화면에노출됐다고주장하지않음.데이터소비코드가joined를무시한다는것은실제블록재현으로확정.
- **⏳ 덜 된 일 [Claude]**208차의예빈합류데이터교정과함께History의가입/데뷔표시정책검토.그룹자체데뷔일은바꾸지말고개인에게그룹원년데뷔를물려주지않도록해야함. member-timeline-joined-replay.json에실제소스블록/8명현재출력보관.운영수정없음.




## 2026-11-05 (Codex — 검수214차·재결합 콘텐츠는 해체일 이후라고 일괄 무관 처리 금지)
- **[정상 보호] [yt_channel_videos]**워너원2026표본에 KCON무대 0f3YXQTufow/_EKkplDFDJ4/axdGouPEXTs 및 워너원고 inLA 여러개가공개로수집돼있다. CJ ENM공식프로그램 https://tvn.tving.com/ko/featured-contents/워너원고-백투베이스/ 와 MnetPlus https://www.mnetplus.world/media/ko/videos/6a43185b205f96595d923275 에2026재결합프로그램이확인됨. 박진영오태깅을고친다고워너원2019이후전부차단/무관처리하면안됨.
- **[정상 보호·피에스타]** i3RLLkX-yPw(MBC2025Vista라이브),zgElYtEZJlc(MBC2024완전체재결합라디오)는oEmbed200/MBC공식.213차세븐틴Fiesta2개와별개로실제FIESTAR의재활동영상은보존.해체표시2018만으로최근자료전체삭제금지.
- **[오프라인 확장] [missing-joined-young-group-debut.json]**정밀한생일/그룹데뷔일이있고joined없는등록에서데뷔당시10세미만후보는예빈+플레이브하민2명뿐.하민9999년은버추얼설정으로기존메모에도나오므로일반실존생일로고칠대상아님.2개전부오류라고세지않음.
- **⏳ 덜 된 일 [Claude]**재활동상태모델은기존해체일기록/솔로재배정정책을확인한후별도판단.이번표본만으로모든멤버의2026솔로활동을워너원그룹활동이라고인증한것은아니다.실제함수재현이수집전체/UI필터모든경로재현이라는뜻도아님.


## 2026-11-05 (Codex — 검수213차·세븐틴 CxM 곡 Fiesta가 그룹 피에스타로 공개)
- **[확정·원본 제목/채널]**EYL9BXBb9eo/ADN86AMoMTw의업로더는데이즈 DaysforScoups(@coupsdays),제목은251005 CxM유닛팬파티/에스쿱스·민규/곡Fiesta다.현재primary피에스타/members=[]/public/auto로저장.2개oEmbed200/제목일치.등록된에스쿱스·민규유닛앨범HYPEVIBES12140970에도Fiesta600206897가실제로존재한다.공식PLEDIS공연공지 https://weverse.io/seventeen/notice/30355 는CxM팬파티를확인.
- **[실제 재현]**M2는두제목모두피에스타strong/멤버[]로결정한다.한글피에스타가곡명자리에서그룹명으로승격되어,CXM/에스쿱스/민규동시근거도놓친다.영문FIESTA만막아서는한글제목경로가남는다.
- **⏳ 덜 된 일 [Claude]**대상2개원본공연확인후primary세븐틴/members에스쿱스·민규한정재귀속검토(멤버/그룹게스트로중복추가할대상아님).팬채널자체가잘못등록됐는지는이번2개만으로결론내리지않음.실제그룹FIESTAR재결합공식영상은214차정상보호.원자료fiestar2024-db.json/-replay.json및reunion-name-collision-oembed.json.코드/DB수정없음.


## 2026-11-05 (Codex — 검수212차·진영 추가8개를 갓세븐/JYP/경연으로 구분)
- **[확정·실제 카드]**배진영카드에서박진영잇츠라이브CottonCandy·Letter/ZPg9AocXa1g와리무진서비스217/kZ6et9sanKQ가실제로노출.잇츠라이브원본설명#갓세븐#GOT7,리무진의EVERLOVE는211차갓세븐신곡문맥이다.공식oEmbed도둘다200. DAZED인사v_315EXB1HI는설명에유미의세포들2 유바비역,JTBC -FrlTa2lsMA는제목/설명유바비본체라갓세븐박진영이다.이4개+211차11개=공개15개확정갓세븐재귀속우선검토.
- **[명확히 다른 JYP자료]**alHqoj-LM4g는KBS가요톱텐980128 Graduation,공식설명#jyp.워너원배진영은1999년생이라원무대는태어나기전이며GOT7진영으로도옮길대상아님. VnbPo4FDafY는싱크로유ParkJinyoungSpecial로JYP특집가능성이높고공식방송보도 https://enews.imbc.com/News/RetrieveNewsInfo/436624 에JYP패밀리/박준형·준호·시은·필릭스등출연이있음.특정클립실제포함범위확인전전부갓세븐/무관처리금지.
- **[추가 보류]**8dpHl5Cs9Ew는같은DAZED2022.08 ParkJinyoung화보로갓세븐유력하지만원문이실명/배우작품을직접추가명시하지않아독립확인남김.숨김WcmxmxF1pc8 슈퍼스타K3_3019 Don'tLeaveMe는경연참가자의JYP곡커버가능성,현M2는B1A4진영으로바뀌어도그게맞다는뜻아님.현재숨김을그대로풀어다른진영에붙이지말것.
- **[범위/근거]**19개조회=공개18+숨김1,모두oEmbed200.19개전체를갓세븐15개확정수에합치지않음.211차와중복ID는새오류로중복계산안함.추가4개도현M2의배진영weak/ambiguous가남는다.원자료wanna_parkjinyoung-db.json/동일-replay.json/metadata보관.
- **⏳ 덜 된 일 [Claude]**공개15우선한정교정→JYP가요톱텐/싱크로유와DAZED화보1개·경연1개는별도출연기준으로검토.틀린성씨박→배로소급치환하거나Jinyoung모든영상전체금지하지말것.진영(갓세븐)/진영(B1A4)/배진영모두정상별도인물로유지.




## 2026-11-05 (Codex — 검수211차·갓세븐 박진영11개 최신 KBS 무대가 배진영으로 수집)
- **[확정·DB/공식 원문]** 워너원/배진영으로저장된2026.10.29~31 KBS더시즌즈11개는박진영(ParkJinYoung)의EVERLOVE/영원히/서른즈음에다. KBS원클립 https://vod.kbs.co.kr/index.html?contents_id=K02_PS-2026167494-01-000_MFSC7 및 iMBC의10/30방송보도 https://enews.imbc.com/News/RetrieveNewsInfo/523021 에서당일출연자를갓세븐박진영으로명시. JYP박진영/워너원배진영과구별.
- **[대상11]**1CZLLtU78KE,jJeruNyoX8U,9JevQrGPosM,B9b-AtUNoxo,Ul5T41qRvkA,pUOBY40Zcpw,LA7k5qWZtyg,X5F4TIERIIY,zKBIspPTF3E,RK_wYRy-5TI,uvZAIZRWoQA. 모두공개/content_flag=null/members=[배진영]/tags_manual=false.10월29~31신규created_at로8월잔재만의문제아님.11개oEmbed200/KBSKpop제목동일확인.
- **[현재 재현] [admin.js e64f24f9cd]**실제_m2ParseTitle에동적보호28개/예외0및실제컷오프헬퍼를메모리주입해재생하면11개모두워너원/배진영/weak로남는다.단순스윕재실행으로는교정안됨.영문Jinyoung동명이인과한글풀네임의소유자를함께검토해야하며그룹명워너원자체를차단하면정상재결합영상까지잃는다.
- **⏳ 덜 된 일 [Claude]**현재값조건/백업/undo를갖춘대상11개한정갓세븐/진영(a0601)재귀속검토.동명JYP자료는212차와구별.원곡칸/방송명/영상형식등다른칸은현재별도검증없어무차별덮기금지.원자료 wanna_parkjinyoung-db.json/재현 -replay.json/공식metadata저장.코드·DB수정없음.


## 2026-11-05 (Codex — 검수210차·시크릿 챌린지의 함은정 동반 태그 누락 후보)
- **[제목 명시·공식 채널]**IXO77X-zlIk는SecretOfficial공식제목 양지원님,함은정님과아이스크림챌린지(oEmbed200).현재primary시크릿/members=[]/with_members=[양지원(양지원)]뿐.함은정은등록된티아라은정a0531을검토할대상이며쥬얼리김은정a0983과혼동금지.양지원은현재솔로키가양지원이어서그태그를틀렸다고바꾸지않음.
- **[현재 함수]**M2제목재생은primary양지원만반환하고함은정을놓친다.자체채널주인시크릿을지켜야하므로이결과로row전체를덮으면안됨.현제목/DB로누락가능성은명확하지만실제클립전편출연확인까지한것은아니므로최종함은정출연확인후with1칸만보완검토.
- **⏳ 덜 된 일 [Claude]**공식클립실제출연확인→확정시은정(티아라)게스트추가.시크릿members빈값만으로3명전체를출연했다고추정하지않음. secret-official-video-metadata.json 및 secret-matcher-replay.json근거.운영변경없음.




## 2026-11-05 (Codex — 검수209차·Secret Flavor 공식 미니/타이틀 표시 누락)
- **[확정·실제 카드] [groups.json 시크릿]** Secret Flavor13745048이 스페셜·2026으로 노출. 공식 벅스 앨범형식은 EP(미니), 공식Melon곡목록8곡 중 아이스크림(ICE CREAM)/602292853에 타이틀 마크가 있다. 현재 type=스페셜/titleTrack=null/8곡 isTitle=false다. 시크릿 공식 컴백라이브 제목 자체도 Special Mini Album이라 스페셜이라는 홍보 수식과 앨범형식을 구분해야 한다.
- **[정상 보호]**공식8곡의 songId와현재8행순서는일치한다. ICE CREAM/아이스크림(ICE CREAM),ShyBoy/샤이보이등은동일ID영문표기차이므로다른곡오연결로세지않음. Madonna2026Ver.와Remake2026Ver.도실제공식목록에별도ID로있으므로임의중복삭제금지.
- **⏳ 덜 된 일 [Claude]** groups.json 해당앨범만 type=미니(정확한번호는추정금지)/titleTrack 및602292853 isTitle검토.다른정상ID/순서보존.원문은 secret-yebin-primary-check.json, https://www.melon.com/album/detail.htm?albumId=13745048 및 https://music.bugs.co.kr/artist/80060294 . 운영수정없음.


## 2026-11-05 (Codex — 검수208차·예빈은 정상 신규 멤버/2009데뷔 이력은 잘못 파생)
- **[정상 확인] [artists.json a1011]** 예빈2002.09.01/시크릿/RBW/개인 ShapeOfMe·KillThePain은오등록아님. Melon3809244 공식프로필은 예빈/RBW/시크릿, 벅스80395454도시크릿소속·2024솔로데뷔와2앨범을확인.시크릿공식채널 새멤버 소개 okAzuOSRMmI는2026.06.08 업로드(DB공개/예빈태그). 어제206차의보류를해소하며옛생일의심메모만보고인물삭제금지.
- **[확정·실제 UI]**시크릿카드에서예빈을클릭하면개인 History에2009.10 시크릿데뷔[IWantYouBack]가표시된다. 2024.12 솔로데뷔도동시에표시. 예빈등록에 groups[].joined/최상위joined가없어원년멤버처럼그룹데뷔일을물려받는다.2026신규합류자료에맞게기존joined표현을활용해야하며새생일추정으로맞추면안됨.
- **[별도 확정·그룹 상태]**groups.json 시크릿 disbanded=true는예전무활동판단잔재(기존CHANGELOG4157부근).공식Bugs80060294현재멤버는전효성/징거/예빈,2026재활동소개·6/18 SecretFlavor 발매,DB2026공개30표본과예빈10개정상공개가확인된다. **단 _groupEndDate는true에서null을반환하므로현재이값이2026수집을날짜로차단한다고주장하지않음.** 실제신규영상은수집돼있다.
- **⏳ 덜 된 일 [Claude]**시크릿현역상태/예빈joined공식일자판단→기존joined모델로한정교정검토→개인History·멤버탐색데뷔나이·그룹필터검증.공개일6/08과실제활동합류일의차이는공식소속자료로최종판단;단체데뷔2009는정상보존.한선화/송지은탈퇴표시보존.원문/DB표본은자체2026-11-05 evidence에저장.코드/DB수정없음.




## 2026-11-05 (Codex — 검수207차·코드 수정 없는 콘텐츠 검수 재개)
- **[완료] [자체 작업 공간]** 검수207~245차를 자체 기록/근거로 저장. origin/main e64f24f9cd까지 fetch 및 최근 main 기록/원칙/미결 기준 확인. 코드·운영JSON·DB·공유 작업폴더 수정 없이 공식 출처/실제 노출을 대조한다. 어제195~206차 항목은 main의 신규 정정 기록이 없어 해결된 것으로 간주하지 않으며 중복 새 오류 수로 세지 않는다. 기록/근거는 이 작업 공간에만 저장하고 Claude가 main 반영 담당.



## 2026-11-04 (Codex — 검수206차·퇴근 전 종료/인수인계)
- **[완료·종료] [CHANGELOG.md·audit-materials]** 사용자 퇴근 요청으로 새 검수 중지. 이번 묶음195~205차는 내 작업 공간에만 기록. 마지막 읽은 origin/main=bdf762d69b. 공유 작업폴더/코드/운영JSON/DB 수정 및 커밋·push·배포 없음. Claude는 이 작업공간의 검수 기록을 읽고 main 반영 담당.
- **⏳ 우선 후속1 [Claude·197/199차]** FT이재진 credit1008→공식672431 한정 재수집/검증; 세븐554502→33513, 금조 옛 그룹키673733→830460, 빛새온 그룹1705067→개인1705072는 각 원문 재확인 후 범위 판단. 자동 전면 덮기 금지. 미미184차도 별도 기존 확정 과제. credit-map-profile-verification.json에 공식 프로필 근거.
- **⏳ 우선 후속2 [Claude·199차]** 유스피어 시안 카드의 버가부 시안 앨범11535511 및 파생 솔로 데뷔 이력 정정 검토. USPEER credit4343027 정상 보호. 브브걸 유정의 Beautiful Sunlight13310409만 검토하고 정상 남유정 앨범4개 보존. 제이창 복수프로필 정상/마유카 미확정은200차 기준으로 구별.
- **⏳ 우선 후속3 [Claude·204/205차]** 에프엑스 공개 제품영상 2pXp4HkxlSo/AJ1tRpKn9FM/8JzXYA1pLpQ 한정 무관처리 검토; 본인 레오/루나 누락 태그는 공식 출연 근거로 복구 검토. 크리스탈 언급 라디오 b-n6mzRER8E는 실제 출연 확인 전 제거 확정하지 않음. onf-public-created-dates.json에는195차 저장일 근거도 추가 보관.
- **⏳ 다음 검수 재개점 [미확정·새 오류로 세지 않음]** artists.json a1011 예빈/시크릿은 오래된 CHANGELOG에도 생일 미처리로 언급됨. 이번에 medium-map 후보에서 다시 보였으나 공식 프로필/소속/앨범을 아직 대조하지 않았으므로 새 확정 오류로 보고하지 않음. 재개 시 현재 등록값과 공식 Melon3809244/앨범11775003·11671049 및 기존 기록을 먼저 대조할 것.
- **[정상 보호/한계]**201차12인14앨범의 medium매핑은 정상 가창자 귀속. 메타200은 실제 영상 전체 출연 인증이 아니고 oEmbed401은 삭제 인증이 아님. 기록의 확정/검토/정상/보류 구분을 유지. 추가 검수 예약이나 API 녹화 재개는 하지 않음.




## 2026-11-04 (Codex — 검수205차·본인 태그 누락은 보호 규칙을 없애지 않고 한정 복원)
- **[확정·공식 채널 표기] [yt_channel_videos]** 빅스 RealVIXX의 레오 뮤지컬 비하인드 HAv2ureYCMM/AFmQYFsEi48, 레오가12년간별빛에게5L9Xx1YKMkk가 공개/members=[]다. oEmbed3개200으로 공식 채널·제목 확인. 가수 레오 실제 본인 콘텐츠이며 무관 삭제 대상 아님.
- **[루나 본인 누락 후보·공식 제목 확인]** y2w8dBSyDss(KBS 첫미니 자작곡 라디오),6vUuLdsuj0A(Dispatch 루나),fTOZU5QlMMM(MyMedicine),iYt7uF2zwTo(나항상그대를),3K4H_tnRdjY(DoYouLoveMe),qAFDgFE26eI(Still피처링),jaZSWTYfpL0/WzcOTxBduCU(주간아이돌 듀엣/팬싸)가 공개/members=[]이고 oEmbed200. 앰버+루나 합동무대 GuUpFWeIoBk/5xJPG952h-c는 현재앰버만, 공식제목/설명은루나동반을명시한다. 기존앰버/비투비이민혁with태그는보존. YXRJTwpLRRo 데뷔무대는oEmbed401이므로삭제로단정금지,별도재생확인대상.
- **[실제 함수/설명 포함 재현] [admin.js a213912575]** 동적28이름 보호 규칙을 그대로 주입하고 실제 _atmResolveMembers(title,DBdescription,roster,date) 실행. 위 레오3/루나 본인후보는 여전히 본인 누락, 앰버2는 앰버만 반환. _atmContextRelaxesHashtagOnly는 제목에 직캠+그룹명이 있을 때만 완화하므로 라디오/뮤지컬/공식콜라보까지 자동 복구하진 않는다. M2는 일부 그룹명이 명시된 루나 영상에서 루나를 잡지만 ownresolver는 누락하는 경로차이도 존재.
- **⏳ 덜 된 일 [Claude]**204차 제품 오수집을 막기 위해 루나/레오 보호 규칙을 전면 삭제하지 말 것. 공식 채널/명확한 그룹·본인 표기/본인 공연 여부 확인 후 한정 태그 복원 검토. 최근 사용자의 잠금 정책은 증거있는한정정정허용이나 자동스윕의무분별한확장승인은아님. full-desc-replay.json에 DB설명·실제명단·반환값 보관. 코드·DB수정없음.


## 2026-11-04 (Codex — 검수204차·가수 루나 대신 시계/화장품3개 공개 오수집)
- **[확정·실제 카드]** 에프엑스 카드 영상검색 와치타임에서2pXp4HkxlSo(아레나옴므플러스,파네라이 루나로사 시계), 스마트뷰티에서AJ1tRpKn9FM(MarieClaire,루나 파운데이션)이 실제 노출된다. YouTube 공식 watch 메타도200/playabilityOK, 설명은 각각 시계 모델 소개/화장품 제품 소개로 가수 루나 근거가 없다.
- **[추가 확정·DB/설명]**8JzXYA1pLpQ는 코스모 뷰티톡 루나 롱래스팅 팁 컨실러 제품 소개. 세 개 모두 현재 group_ko=에프엑스/content_flag=null/members=[]/tags_manual=false,8/25저장. 세 번째도 카드 루나검색 결과에서 해당 제목 노출을 봤지만 별도 외부 영상 재생까지 확인한 것은 아님.
- **[현재 재현과 구별]** 기존2개의 현 M2 제목판정은null/own멤버도[]다. 현재 제목파서가 새로FX로추론한다고단정할수없지만이미잘못저장된group_ko는그대로공개노출된다. 역사오염복구와재발방지를구분.
- **⏳ 덜 된 일 [Claude]**세ID의현재값백업/공식설명재확인→가수무관한제품영상만무관처리검토. 제품/뷰티라는단어전체로막으면실제아이돌브랜드광고까지막으므로정확한상품명·실제출연근거로한정. public-collision-60-watch-metadata.json에2원문설명보관. 운영수정없음.


## 2026-11-04 (Codex — 검수203차·루나가 크리스탈을 언급한 라디오 태그 주의)
- **[강한 검토 후보]**b-n6mzRER8E의 공식SBS 제목/설명은 루나가 크리스탈과 여행 가면 맛집을 잘 다닐 것 같다고 말한 라디오다. 현재members=[크리스탈],루나는없음. 공식메타HTTP200/재생OK이고 DB설명도동일. 실제공동출연이아닌인용언급이태그로승격됐을가능성이높다.
- **[한계/처리]**메타만으로크리스탈이영상전체에한번도안나온다고인증한것은아님. 클립실제출연확인후루나본인태그/크리스탈언급태그제거검토. 그룹에프엑스자체는맞으므로영상무관삭제와구별. 현재실제M2와설명포함ownresolver모두크리스탈만반환하여단순현재스윕재실행도같은결과다.
- **⏳ 덜 된 일 [Claude]**b-n6mzRER8E의실제화면/출연자확인→확정시대상1개수정. 원곡크레딧/인용문/가정형언급을모두실제동반출연으로보지않는기존규칙검토. evidence는full-desc-replay/watch-metadata에저장.


## 2026-11-04 (Codex — 검수202차·공개3그룹60개 표본/공식영상19개 메타 대조)
- **[완료] [yt_channel_videos]**빅스레오/에프엑스루나/레드벨벳조이 공개영상각20개를group인덱스+이름제목+created_at최신순으로조회.60개 원자료 보관. 최신순동률의표본이므로전수오류율로일반화하지않음. 레드벨벳20개는검토상주인무관확정없음. 슬기You’reMyJoyAndLuck의JOY는곡명이라현재슬기만태그된상태정상보호.
- **[외부 메타]**초점19개 oEmbed17개200/2개401.401은삭제/깨진영상인증이아니다.8st9M46Iw2U 아이유루나페스티벌은watch페이지200/playabilityOK/SBS공식제목확인. 아이유와루나가함께나온무대인지확인전무관처리금지. 현재M2아이유판정만으로실제출연을확정하지않음.
- **[근거] [public-collision-60-db.json·public-collision-60-replay.json·public-collision-60-focus-oembed.json·public-collision-60-watch-metadata.json·public-collision-focus-full-desc-replay.json]**읽기전용원자료/실제함수출력/공식메타저장.204차확정제품오류와203차언급후보/205차태그누락을구분. API키/YouTubeDataAPI할당량사용없음.




## 2026-11-04 (Codex — 검수201차·동명이인 의심12프로필14앨범 정상 대조)
- **[완료·정상 보호]** medium 매핑252개 중 이름만으로 헷갈리기 쉬운12명(김태헌/혜빈/제인/린지/DKZ민규/박소은/BAE173영서/걸스데이유라/TFN건우/빌리수현/로민/박서함)을 공식 artist/detail와 개인앨범14개 가창자 링크로 대조.12개 프로필 모두 소속그룹 또는 생일로 해당 인물과 맞고,14개 앨범도 각 공식 개인 aid를 가창자로 포함한다. 모두HTTP200. medium·overlap1이라고 자동 무관 처리할 근거 없음.
- **[정상 사례]** 걸스데이 유라의 환승연애4 OST Part7/12396907은 실제669851, 제인 영화 구라 베토벤 OST/10526880은 제인1229550+아인1229551, 로민 OST10619527은 로민2873708+이유카2018927 공동 가창. 낯선 OST나 공동가창자라는 이유로 삭제하지 않음. 이 대조는 가창자 귀속 검증이며 곡수/전 크레딧 인증은 아님.
- **[추가 범위]** 매핑의 그룹 멤버목록 evidence와 등록 groups를 오프라인 대조한 명시 불일치는199차 시안1개뿐. non-low/non-blocked 개인 map의 동일 aid가 서로 다른 등록 인물ID로 공유되는 후보는0개. aid가 유일하다고 본인 인증은 아니므로197차 같은 고유 잘못된 ID도 검증 필요.
- **[198차 보충]** groups/artists의 tracks[].cr를 재귀 대조한 혜미673733 참조0개. 현재 album 크레딧 클릭이 금조로 잘못 연결된 실사례까지 확인한 것은 아니다.
- **[근거] [medium-map-profile-12.json·medium-map-12-album-artists.json·map-evidence-group-differences.json·map-shared-artist-ids.json·hyemi-credit-track-refs.json]**자체 evidence만 저장. git fetch 후 origin/main=bdf762d69b 유지 확인. 코드/DB/운영JSON/공유 main 작업폴더 수정 없음.




## 2026-11-04 (Codex — 검수200차·복수 프로필 정상 대조와 마유카 보류)
- **[정상 보호] [artist_credits.json·melon_artist_map.json]** 제이 창(a1321, ONEPACT/B.D.U)은 credit3621439 공식 제이창(ONEPACT), map2903420 공식 제이창/B.D.U로 둘 다 같은 사람의 활동에 해당한다. ID가 다르다고 오태깅으로 지우거나 ONEPACT 크레딧을 B.D.U 프로필로 덮어쓰지 말 것. 현재 raw 작사3/작곡1, creditsFor 최소5 미달로 새 SEO 페이지는 없음.
- **[보류]** NiziU 마유카(a0580)의 credit2877496은 공식 MAYUKA/마유카·NiziU 소속으로 정상. map4362280은 마유카라는 별도 프로필(그룹 표시 없음), 개인 앨범 회유하는 아르파프레데리움11901366도4362280으로 연결된다. 이름/그룹 표시 차이만으로 다른 사람이라고 확정하지 않음. JYP/NiziU 공식 솔로 활동 자료로 확인 전 삭제/교체 금지. 정상 NiziU 크레딧은 보존.
- **⏳ 덜 된 일 [Claude]**196차9개 ID 차이를 일괄 패치로 쓰지 않고 정상 복수프로필/캐시 오류/매핑 오류/보류로 구분. 공식 공개 프로필16개 HTTP200 근거는 credit-map-profile-verification.json. 코드/DB/운영JSON 수정 없음.


## 2026-11-04 (Codex — 검수199차·유스피어 시안 실제 카드에 버가부 시안 앨범/솔로 데뷔 노출)
- **[확정·실제 UI] [artists.json a0707]** 검색 결과의 시안·유스피어 항목을 선택해 나무위키 시안(USPEER), 생일2007.08.18, 유스피어 소속을 확인. 해당 카드 Discography에 너와의 하루가 다시 주어진다면(싱글2024), History에 2024.07 솔로 데뷔가 실제 노출된다.
- **[공식 원문 대조]** 앨범11535511의 공식 가창자 artist2970911은 버가부 시안. 사이트의 별도 인물 a1891(시안/Cyan, 버가부,2001.04.04)은 개인 디스코 없음. a0707의 credit4343027은 공식 USPEER 시안으로 정상인데 map a:시안|유스피어=2970911/high의 evidence가 bugAboo 멤버목록이다. 정확한 캐시를 잘못된 map으로 덮지 말 것.
- **[추가·브브걸 유정 a0503]** credit946040은 공식 남유정/브레이브걸스로 정상. map784322는 공식 유정(김유정). 개인앨범5개 중 자기소개서14511137/초대14469160/바다의왕자14449607/니가참좋아14435780은 공식 가창자946040으로 정상이다. Beautiful Sunlight13310409만784322에 연결되므로5개 전체 삭제 금지. 이 유정 사례는 원본JSON+공식 원문 대조이며 아직 실제 카드 확인은 안 함.
- **[근거] [disco-mapped-identity-review.json·disco-mapped-identity-album-artists.json]** 실제 앨범 원자료와 공식7앨범 가창자 연결 저장. 시안은 개인곡만 아니라 자동 History의 잘못된 솔로 데뷔까지 파급한다.
- **⏳ 덜 된 일 [Claude]** 시안 a0707 map→공식4343027 재검증, 앨범11535511은 a1891 귀속/등록범위 판단 후 한정 이동 및 파생 History 재생성 검토. 유정은784322 앨범1개만 귀속 검토하고946040 정상4개/크레딧 보존. 자동 --from-map 전면 덮기 금지.


## 2026-11-04 (Codex — 검수198차·금조의 예전 크레딧은 혜미/빛새온은 그룹 ID)
- **[확정·공식 프로필]** 금조|나인뮤지스 credit673733은 표혜미(나인뮤지스/A,1991.04.03)다. 금조 본인은830460(이금조,1992.12.17). 예전 그룹 키의 작사1곡 I Need Your Love가 대상이며 현재 금조|솔로 키는 이미830460,0/0으로 정상. 새 creditsFor 페이지는 최소치 미달로 없음. 정상 솔로 키까지 덮거나 금조의 모든 앨범을 삭제할 근거 아님.
- **[확정·공식 프로필]** 빛새온 a1618의 credit1705067은 개인이 아닌 몬트(M.O.N.T) 그룹 프로필이다. map1705072는 빛새온 본인(몬트/B.D.U/훈민제빛). 현재 raw0/0으로 잘못 노출된 다수 크레딧을 확인한 것은 아님. 그룹앨범을 개인 카드에서 허용하는지는 별도 정책이므로 앨범 전체 무관 판정 금지.
- **⏳ 덜 된 일 [Claude]** 정확한 개인 ID로 읽기 전용 재수집하여 차이 확인 후 대상 키만 한정 교정 검토. album tracks[].cr의 혜미 ID 실제 참조/클릭 파급은 별도 조사 필요. 공식 근거 credit-map-profile-verification.json, 운영수정 없음.


## 2026-11-04 (Codex — 검수197차·FT아일랜드 이재진은 유승준/세븐은 미국 래퍼 크레딧)
- **[확정·공식 프로필] [artist_credits.json]** 이재진|에프티아일랜드(a0639) credit1008은 공식 유승준(Steve Seungjun Yoo) 프로필이다. 올바른 map672431은 이재진(FT아일랜드),1991.12.17,FTISLAND/FT트리플. raw 작사31/작곡8, 실제 creditsFor 기본곡23/6에 Another Day/People Don't Know/Rat-a-tat 등이 나온다.
- **[확정·배포 SEO]** https://kpop-universe.kr/g/에프티아일랜드/이재진/credits/ HTTP200에서 실제 FT이재진 작사23/작곡6 및 유승준 곡명 노출을 확인(jaejin-credits-live.json). 앱 글로벌 이재진 작사 검색의36개는 FT31+젝스키스5 합계이므로36개 전부 FT 오류라고 세지 않는다. 젝스키스 이재진의 별도1679 키는 보존.
- **[확정·추가]** 세븐|솔로(a1040) credit554502는 미국 래퍼 YG(Keenan Jackson)다. YG 회사명과 혼동 금지. map33513은 공식 SE7EN(2003 와줘 데뷔)으로 정상. raw 작사1곡100 Days(Feat.YG,P-Lo)/38075271,작곡0. 최소5 미달로 새 작사 SEO는 없어 잘못된 SEO 페이지가 있다고 주장하지 않음.
- **⏳ 덜 된 일 [Claude]** 읽기 전용 node tools/melon_credits.mjs 이재진=672431 로 결과/선택인물의 FT 소속 먼저 확인; 세븐=33513도 동일. 확인 후 해당 키 한정 저장 및 written_songs/파생 SEO 재생성 검토. --from-map/--fill-missing은 기존 aid 있는 키를 스킵하므로 단순 재실행으로 고쳐지지 않을 수 있음. 이 작업에서는 수집기 --save 실행/운영수정 안 함.


## 2026-11-04 (Codex — 검수196차·크레딧/매핑807명 대조9개 차이의 양방향 오류)
- **[완료·오프라인 대조] [artist_credits.json·melon_artist_map.json bdf762d69b]** 고유 인물807명에 대해 인물ID·동명이인 그룹을 구분해 non-low/non-blocked map과 credit aid를 대조.9개 키 차이: 미미(184차 기확인),FT이재진,세븐,금조의 옛 그룹 키,빛새온,유스피어 시안,브브걸 유정,NiziU 마유카,제이 창.9개가 모두 틀린 캐시라는 뜻이 아님.
- **[검수 원칙]** 공식 공개 artist/detail 프로필16개를 확인했다. 캐시가 틀리고 map이 맞는 경우/반대로 map이 틀리고 캐시가 맞는 경우/같은 사람의 활동별 프로필이 모두 섞였다. high 매핑이나 단일 앨범 겹침만으로 자동 덮기 금지. credit-map-id-disagreements.json 및 credit-map-profile-verification.json에 대상/원문 저장.
- **⏳ 덜 된 일 [Claude]**197~200차의 개별 기대값/보존 대상을 기준으로 한정 정정. 중복 aid 검사(184차)만으로는 유일하지만 잘못된 사람을 가리키는1008/554502 같은 오연결을 발견할 수 없으므로 공식 이름·그룹 검증 병행.


## 2026-11-04 (Codex — 검수195차·공개 온앤오프 오수집4개는10월 신규 저장)
- **[추가 사실·신규 오류 수 아님] [yt_channel_videos]**172차 공개 ONF 오수집9개의 created_at을 재확인했다. Aayt9m08Rxg=10/02, sDozPLuQYjQ=10/05, AKHg2tvbXEs/PyVwt9nIouE=10/18 신규 저장이며 네 개 모두 source_handle=Diggle. 다른5개는8/25 저장이다. 오래된 숨김 자료에만 남은 문제가 아니라10월 공개 저장도 포함한다.
- **[한계]** 현재 제목 parser의 ONF strong 판정(171차)과 실제 최근 저장은 확인했지만 전체 현재 수집 파이프라인을 끝까지 재실행한 것은 아니다. 온앤오프 전체 strictSync 설정으로 정상 아이돌 영상을 대량 차단하는 접근은 피할 것.
- **[정상 대조]** 공개 group_ko=아이들/title에 전국노래자랑 포함 조건의 bounded 조회는0건. 전국노래자랑 전DB나 다른 그룹까지 전수 정상이라는 의미는 아님. 사용자가 이미 수동 무관 처리한2개를 새 오류로 재보고하지 않음.
- **⏳ 덜 된 일 [Claude]**172차9개 실제 출연자 검증 후 한정 재귀속/무관 처리, tvN 방송명 온앤오프와 아이돌 온앤오프를 출처·설명·명시 멤버 근거로 분리하는 기존 경로 검토. 코드/DB 변경 없음.




## Supplement: historical ONF evidence referenced by audit195

## 2026-11-04 (Codex — 검수172차·공개 tvN 온앤오프9행/써니2개 실제 카드 오노출)
- **[확정·실제 UI2행] [AKHg2tvbXEs·Aayt9m08Rxg]** 온앤오프 그룹 카드→영상 검색 써니. 보아·이수만 싸움 얘기의 써니 클립과 한강 집의 써니 집순이 라이프 클립이 실제 결과에 나온다. DB primary 온앤오프/본인·with 빈값/public/auto. 실제 소녀시대 써니를 다루는 tvN 예능과 그룹 ONF 혼동. 앞 클립의 보아/이수만은 대화 속 언급일 수 있어 함께한 멤버로 자동 추가 금지.
- **[같은 공개 오배정7행]** sDozPLuQYjQ 이승윤 싱어게인, l64vrYbVhd4 청하·강미나·정채연 아이오아이 먹방, woV6dkJq0Ss 소진 싱글시절, N_C9CAOn41k 김완선 일상, FlvEwwoLDEY 하하 결혼 이야기, PyVwt9nIouE 성시경 요리, fUvesMJe5Z4 엄정화X성시경 식사. 전부 온앤오프/public/auto. 실제 인물 지원 여부/동명이인/화면 출연을 확인하고 정확 귀속 또는 무관·보류 판단. 아이오아이 먹방은 with_groups 아이오아이가 이미 있으므로 정상 근거를 보존하고 ONF와 역할만 구분.
- **[숨김과 차이]**167~170차75행은 hidden이었지만 이번9행은 content_flag=null. 같은 프로그램 오배정이 실제 공개 데이터에도 남아 있음을 확인. 이9개 제목/업로더 공개oEmbed 모두200, 예능을 그룹으로 보는 실제 제목 매처 strong도 재현. 숨김 정책 변경만으로 해결되지 않는 주인 분류 문제.
- **[검수 방법]** 사용자 Edge/기존 탭을 건드리지 않고 별도 비표시 내장브라우저 탭에서 읽기·검색만 했다. 좋아요/즐겨찾기/관리자 정정·로그아웃·촬영·이메일 전송 없음. 검색 입력 직후 기존 결과가 남은 과도 상태는 증거로 쓰지 않고 완료된 결과 제목을 확인.
- **⏳ 덜 된 일 [Claude]** 써니2행과 명시된 실제 출연자부터 현재값/백업 확인 후 정정 검토. ONF 정상 음악/공식 채널은 보존. 공개9행의 모든 개인별 실제 등장을 얼굴로 전편 확인한 것은 아님. 자체 public-name-collision-33-db/oembed/replay.json에 공개33표본과 UI/인물식별 근거 저장; 주인 정상16행(그중 멤버 누락1)과 주인 오류17행을 구분. 이33ID는 pinned main/기존 내 CHANGELOG에서 모두 새 ID였음. 코드/DB 변경 없음.


