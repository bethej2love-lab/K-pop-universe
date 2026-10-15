-- 2026-10-15 외부 채널 추가 37곳 — 공식 채널의 출연 재생목록(On Air 등)에 여러 팀이 반복해서 나온 K팝 중심 채널.
-- 근거: 공식 채널 235곳 재생목록 151개 스캔, 미등록 업로더 398곳 중 반복·K팝 중심만 추림.
-- 뺀 것: 한 번만 나온 채널(Vogue Singapore 등 200곳)·브랜드 광고·소속사·개인 크리에이터·키즈 예능, 아이돌 외 영상이 대부분인
--        방송사 본채널(MBC/JTBC/KBS 예능·뉴스) — 흔한 단어 그룹명 오태깅 위험.
-- magazine은 default_category='none'(예능 탭 오염 방지, admin.js _extBuildRows 주석). 이미 있는 핸들은 건너뜀. 통째로 실행.
INSERT INTO ext_channels (handle, url, name, tier, default_category)
SELECT v.handle, v.url, v.name, v.tier, v.default_category FROM (VALUES
  ('kbsworldtv', 'https://www.youtube.com/@kbsworldtv', 'KBS WORLD TV', 'music', NULL),
  ('MBC_WORLD', 'https://www.youtube.com/@MBC_WORLD', 'MBC WORLD', 'music', NULL),
  ('1theK', 'https://www.youtube.com/@1theK', '1theK (원더케이)', 'music', NULL),
  ('JTBCMusic', 'https://www.youtube.com/@JTBCMusic', 'JTBC Music', 'music', NULL),
  ('dddm.official', 'https://www.youtube.com/@dddm.official', 'dddm 두두두뮤직', 'music', NULL),
  ('officialstonemusic', 'https://www.youtube.com/@officialstonemusic', 'STONE MUSIC', 'music', NULL),
  ('_the_idol', 'https://www.youtube.com/@_the_idol', 'THE IDOL × Nikon', 'music', NULL),
  ('CHKCHK_Official', 'https://www.youtube.com/@CHKCHK_Official', 'CHK CHK (촉촉)', 'music', NULL),
  ('listenpage', 'https://www.youtube.com/@listenpage', '리슨페이지 Listenpage', 'music', NULL),
  ('ForRestLIVE', 'https://www.youtube.com/@ForRestLIVE', '숲세권 라이브', 'music', NULL),
  ('STAGEWEMAKE', 'https://www.youtube.com/@STAGEWEMAKE', 'STAGE_WEMAKE', 'music', NULL),
  ('genieoriginal', 'https://www.youtube.com/@genieoriginal', 'genie original', 'music', NULL),
  ('StudioAZeed', 'https://www.youtube.com/@StudioAZeed', 'Studio AZeed', 'music', NULL),
  ('KGMA_OFFICIAL', 'https://www.youtube.com/@KGMA_OFFICIAL', 'KGMA', 'music', NULL),
  ('AsiaArtistAwards_official', 'https://www.youtube.com/@AsiaArtistAwards_official', 'ASIA ARTIST AWARDS', 'music', NULL),
  ('MelonOfficial', 'https://www.youtube.com/@MelonOfficial', '멜론 Melon', 'music', NULL),
  ('FANVATAR', 'https://www.youtube.com/@FANVATAR', '팬바타 FANVATAR', 'variety', NULL),
  ('muniverse.io_official', 'https://www.youtube.com/@muniverse.io_official', '뮤니버스 Muniverse', 'variety', NULL),
  ('fan_ITTA', 'https://www.youtube.com/@fan_ITTA', '잇다 ITTA', 'variety', NULL),
  ('GOGOSING_SLL', 'https://www.youtube.com/@GOGOSING_SLL', '고고씽 GOGOSING', 'variety', NULL),
  ('Knowingbros', 'https://www.youtube.com/@Knowingbros', '아는형님', 'variety', NULL),
  ('PlayMnet', 'https://www.youtube.com/@PlayMnet', 'Mnet TV', 'variety', NULL),
  ('mnet_planet', 'https://www.youtube.com/@mnet_planet', 'Mnet PLANET', 'variety', NULL),
  ('DIVEpods', 'https://www.youtube.com/@DIVEpods', 'DIVE Studios', 'variety', NULL),
  ('giggle77', 'https://www.youtube.com/@giggle77', 'GIGGLE', 'variety', NULL),
  ('doniidols', 'https://www.youtube.com/@doniidols', '돈워니 아이돌', 'variety', NULL),
  ('Bae_ten', 'https://www.youtube.com/@Bae_ten', '배성재의 텐', 'variety', NULL),
  ('ggondaehee', 'https://www.youtube.com/@ggondaehee', '꼰대희', 'variety', NULL),
  ('AmazingSaturday', 'https://www.youtube.com/@AmazingSaturday', '놀라운 토요일', 'variety', NULL),
  ('hello82', 'https://www.youtube.com/@hello82', 'hello82', 'variety', NULL),
  ('SBS_HANBAM', 'https://www.youtube.com/@SBS_HANBAM', 'SBS 한밤', 'magazine', 'none'),
  ('BUZZ_ACCESS', 'https://www.youtube.com/@BUZZ_ACCESS', 'THE BUZZ', 'magazine', 'none'),
  ('magazinethestar', 'https://www.youtube.com/@magazinethestar', 'THE STAR MAGAZINE', 'magazine', 'none'),
  ('kstylenews', 'https://www.youtube.com/@kstylenews', 'Kstyle', 'magazine', 'none'),
  ('sohukorea', 'https://www.youtube.com/@sohukorea', 'SOHU KOREA', 'magazine', 'none'),
  ('stardailynews', 'https://www.youtube.com/@stardailynews', 'stardailynews', 'magazine', 'none'),
  ('케이스타뉴스', 'https://www.youtube.com/@케이스타뉴스', '케이스타뉴스', 'magazine', 'none')
) AS v(handle, url, name, tier, default_category)
WHERE NOT EXISTS (SELECT 1 FROM ext_channels e WHERE lower(e.handle) = lower(v.handle));
