-- 비주류 그룹 오태깅 검수 (2026-11-21, 클라우드 세션 — **미실행**, 노트북 세션에서 확인 후 실행)
-- 방법: 비주류 26팀의 최근 영상 3,436건을 읽기 전용으로 받아 현재 매처 판정과 저장된 태그를 비교 → 어긋난 115건(자체 채널 제외)의 제목을 직접 읽고 판정.
-- 아래 30건은 **제목만으로 다른 사람이 확실한 것**(유니버스에 없는 가수·다른 그룹의 곡명)만 추렸다. 조건식 일괄 아님 — id를 하나씩 적었다.
-- 처리: 보류(content_flag='보류', flag_source='manual'). tags_manual=true 행은 건드리지 않는다. BEGIN 없음. 실행 뒤 건수 재조회.

create table if not exists public._bak_audit_minor_20261121 as
  select id, group_ko, members, with_members, with_groups, content_flag, flag_source from public.yt_channel_videos where id in ('IY7hfUo64w8','jH7KuCr13-Q','DWLsUaL_8u4','EQwSjzCs2lY','H7tGS3AlowA','L0602-m6Jmk','z-HaT5IIchY','o7Huya51XgE','6oUwBndHouA','6MHNGYSWtVY','nGtSGFsUSpg','RAaEPhiPkHY','WmSx0cpqEWQ','fa3JCeihEUo','1dgDFVCNiQA','swnwj7JSxUg','Ac_FOBvqlNA','C9PprYO-AM8','hVeCoeJJU38','Yu0E7jcUwJE','UF10G3DM0dg','VJ79PXnRmqw','iBFvAoIhAmk','vJ8hUejd2Mg','-26bZxqebI8','knuxPOLzP2s','oFKpx-xsfko','x6gKZ6oVSVw','a72lPtA8ZFA','s2C_5mB62SA');
alter table public._bak_audit_minor_20261121 enable row level security; revoke all on public._bak_audit_minor_20261121 from anon, authenticated;

-- [네이처] 김민석 - 영원을 약속해줘요 l [TEXTED] KimMinSeok - Eternal Sunshine l 가사 (Lyrics)  저장 멤버 ["선샤인"] — 멤버 선샤인 아님 — 곡명·가사 Sunshine
-- [네이처] [LIVE] 김민석(Kim Min Seok), 자이로(zai.ro) - 영원을 약속해줘요(Eternal Sunshine) | 권은비의 영스트리트  저장 멤버 ["선샤인"] — 멤버 선샤인 아님 — 곡명·가사 Sunshine
-- [네이처] [LIVE] 김민석(Kim Min Seok) - 영원을 약속해줘요(Eternal Sunshine) | 두시탈출 컬투쇼  저장 멤버 ["선샤인"] — 멤버 선샤인 아님 — 곡명·가사 Sunshine
-- [네이처] [FULL] You are my sunshine🌞 You make me shine😊👍 손태진(Son Tae Jin) | 긴급 초대석 | 두시탈출  저장 멤버 ["선샤인"] — 멤버 선샤인 아님 — 곡명·가사 Sunshine
-- [네이처] E터널 속 화려한 Sunshine✨이 나를 감싸네☀️ #shorts #THEKPOP #THESHOW  저장 멤버 ["선샤인"] — 멤버 선샤인 아님 — 곡명·가사 Sunshine
-- [네이처] [EN] [📁ATEEZ표 희망가.zip] WAVE, Answer, Eternal Sunshine, New World｜Stone Music+  저장 멤버 ["선샤인"] — 멤버 선샤인 아님 — 곡명·가사 Sunshine
-- [네이처] [아돌라 #shorts] 시그니처의 '오로라(AURORA)' 댄스 클래스  저장 멤버 ["오로라"] — 시그니처 곡 AURORA — 네이처 오로라 아님
-- [세븐어스] [LIVE] 김희재(Kim Hee Jae) - 누나야 | 유민상의 배고픈 라디오  저장 멤버 ["희재"] — 트로트 가수 김희재 — 세븐어스 희재 아님
-- [세븐어스] [LIVE] 김희재(Kim Hee Jae) - 나한테 넘어오시면 | 유민상의 배고픈 라디오  저장 멤버 ["희재"] — 트로트 가수 김희재 — 세븐어스 희재 아님
-- [세븐어스] [LIVE] 김희재(Kim Hee Jae) - 안녕은 정말 싫어 | 두시탈출 컬투쇼  저장 멤버 ["희재"] — 트로트 가수 김희재 — 세븐어스 희재 아님
-- [세븐어스] [LIVE] 김희재(Kim Hee Jae) - 돌리도(Turn) | 두시탈출 컬투쇼  저장 멤버 ["희재"] — 트로트 가수 김희재 — 세븐어스 희재 아님
-- [소나무] [Simply K-Pop] Preview With EUI JIN(의진)!! - Ep.372  저장 멤버 ["의진"] — 빅플로 의진(남) 솔로 — 소나무 의진 아님
-- [소나무] [Simply K-Pop] EUI JIN(의진) _ insomnia(불면증) _ Ep.372 _ 072619  저장 멤버 ["의진"] — 빅플로 의진(남) 솔로 — 소나무 의진 아님
-- [소나무] [Simply K-Pop] EUI JIN(의진) _ insomnia(불면증) _ Ep.371 _ 071819  저장 멤버 ["의진"] — 빅플로 의진(남) 솔로 — 소나무 의진 아님
-- [소나무] [Simply K-Pop] EUI JIN(의진) _ insomnia(불면증) _ Ep.370 _ 071219  저장 멤버 ["의진"] — 빅플로 의진(남) 솔로 — 소나무 의진 아님
-- [소나무] [Pops in Seoul] As a Solo Artist, Eui Jin(의진,Bigflo)'s Interview for 'Insomnia(불  저장 멤버 ["의진"] — 빅플로 의진(남) 솔로 — 소나무 의진 아님
-- [픽시] 감성과 가사에 자동 눈물 흐르는 이별곡｜💿 디아 - 날 위한 이별｜#응답하라1994 #Shorts  저장 멤버 ["디아"] — 솔로 가수 디아 — 픽시 디아 아님
-- [히스토리] [LIVE] 천록담(이정) - 순정 | 두시탈출 컬투쇼  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [히스토리] [FULL] 진구의 친구를 사랑했네🥰 천록담(이정), 나윤권, 스페셜DJ 진구 | 두시탈출 컬투쇼 | 260804  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [히스토리] [LIVE] 천록담(이정) - 님의 등불 | 두시탈출 컬투쇼  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [히스토리] 🎙️마이클잭슨 노래자랑🕺🪩 스페셜DJ 조정석, 심사위원 천록담 이정, 요요미, 상득, 박성호 | 두시탈출 컬투쇼 | 260602  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [히스토리] [FULL] 두시탈출 컬투쇼 전국투어🚘 부산 특집 〈왔심THE 부산〉🌊 보는 라디오 | 이정, 배기성, 이은형, 홍윤화 | 230116  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [히스토리] [SBS]두시탈출컬투쇼,이종혁, '김성령-이정-아이비'에게 쓰는 음성 편지  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [히스토리] [SBS]두시탈출컬투쇼, 2015 컬투쇼 어워즈, 연기상-이정…'당신만이' 라이브  저장 멤버 ["장이정"] — 가수 이정(천록담) — 히스토리 장이정 아님
-- [휘브] [MV] Wanted(원티드, 이정) _ I promise you  저장 멤버 ["이정"] — 가수 이정(천록담) — 휘브 이정 아님
-- [휘브] [FULL] 두시탈출 컬투쇼 전국투어🚘 전주 특집 〈왔당께, 전주~!〉🔥 보는 라디오 | HYNN(박혜원), 천록담(이정), 배기성, 스페셜 D  저장 멤버 ["이정"] — 가수 이정(천록담) — 휘브 이정 아님
-- [휘브] 거미&이정 히트곡 연속 라이브👏🏻 | 두시탈출 컬투쇼  저장 멤버 ["이정"] — 가수 이정(천록담) — 휘브 이정 아님
-- [휘브] [FULL] 두시탈출 컬투쇼 전국투어🚘 제주 특집 〈또 왔수다, 제주~!〉🍊 보는 라디오 | 스페셜 DJ 김민경, 이정, 린, 강산에 | 230  저장 멤버 ["이정"] — 가수 이정(천록담) — 휘브 이정 아님
-- [휘브] [FULL] 콘서트가 코앞인데, 이미 공연장에 와 있는듯... 거미(GUMMY)라이브🕷️🕸️ 스페셜DJ 이정 | 두시탈출 컬투쇼 | 261013  저장 멤버 ["이정"] — 가수 이정(천록담) — 휘브 이정 아님
-- [휘브] 이정 & 놀자 - 불티 (전영록) [불후의명곡 레전드/Immortal Songs Legend] | KBS 150808 방송  저장 멤버 ["이정"] — 가수 이정(천록담) — 휘브 이정 아님

update public.yt_channel_videos set content_flag='보류', flag_source='manual'
 where id in ('IY7hfUo64w8','jH7KuCr13-Q','DWLsUaL_8u4','EQwSjzCs2lY','H7tGS3AlowA','L0602-m6Jmk','z-HaT5IIchY','o7Huya51XgE','6oUwBndHouA','6MHNGYSWtVY','nGtSGFsUSpg','RAaEPhiPkHY','WmSx0cpqEWQ','fa3JCeihEUo','1dgDFVCNiQA','swnwj7JSxUg','Ac_FOBvqlNA','C9PprYO-AM8','hVeCoeJJU38','Yu0E7jcUwJE','UF10G3DM0dg','VJ79PXnRmqw','iBFvAoIhAmk','vJ8hUejd2Mg','-26bZxqebI8','knuxPOLzP2s','oFKpx-xsfko','x6gKZ6oVSVw','a72lPtA8ZFA','s2C_5mB62SA')
   and coalesce(tags_manual,false)=false and content_flag is null;
-- 확인: select count(*) from public.yt_channel_videos where id in (…위 목록…) and content_flag='보류';  -- 기대 30(이미 손댄 행이 있으면 그만큼 적음)

-- 되돌리기:
-- update public.yt_channel_videos v set content_flag=b.content_flag, flag_source=b.flag_source from public._bak_audit_minor_20261121 b where v.id=b.id;

-- 보류가 아니라 **정정**이 맞는 것(직접 고칠 것, 이 파일은 안 건드림):
--  · 픽시 Ac_FOBvqlNA '디아 - 날 위한 이별' → 솔로 가수 디아(유니버스에 '솔로|디아' 있음)로 옮기는 게 정답. 위 목록에서는 보류로만 처리.
--  · 스피드: '다비치(feat. 스피드 태운) - 녹는 중'(음악중심 2013-05-08)은 다비치가 주인공·태운은 함께한 멤버, 'THE SEEYA [내 맘은 죽어가요 (feat. SPEED 태운)]'(인기가요 2012-11-18)는 더 씨야(유니버스에 없음 — 씨야와 다른 그룹). 둘 다 지금은 group_ko=스피드.
--  · 저스트비 'JUST B, Try'·'JUST B, TICK TOCK'(THE SHOW UHD 재업로드 2건): 단체 무대인데 members=['배인']만 붙어 있음 — 영상 확인 후 멤버 비우기.
