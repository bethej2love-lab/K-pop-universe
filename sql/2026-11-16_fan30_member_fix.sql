-- 2026-11-16 코덱스 검수: 직캠 멤버 오태깅 29건 — 제목에 촬영 대상이 명시(예: 호시 Focus·연준 FanCam)인데 팬채널 '주인' 멤버로 저장됨
-- (_extBuildRows가 제목 파싱 뒤에도 채널 owner.mko를 무조건 멤버로 저장 — 근본 수정은 수집 파이프라인, 매처 절차 필요). 팬채널(source_tier=fans)·수동 태그 아님만.
-- 투어스 k5aBIURTJYA('훈재유 영재')는 모호해 제외. 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members from bak_20261116_fan30 b where v.id=b.id;
create table if not exists bak_20261116_fan30 as select id, group_ko, members, with_members, song_keys, tags_manual, source_tier, now() as backed_at from yt_channel_videos where id in ('CzjY66XFlho','AjirHScHt9I','Gz0uVzzgG40','OXkL6ws23kY','Y5BhNIbE1hg','rDrmL4S5I8A','TRXp6WxoiJk','CJfBLtKcKWQ','eIdDEDcAUZw','Bh5jgfOJDEM','kXNIueeej48','X9vzECIaKts','W1JoPYS0RkI','haVai1TuiEM','kmEq2htOvhQ','xF1QIuu5GIY','SeWO_Fx1-QI','HUznOA-DToM','YlXsYc_hwjw','RBs8O5J8Z7k','XWSjTFia3v0','fhuhbq8MMQs','PLdneDTslIE','JpXFYkuR63E','_Xpj5Zlsbe4','xknpPRoSDt4','zS1VT2FwBNY','eMWuqdLFvrQ','soB7e9DuGsw');
alter table bak_20261116_fan30 enable row level security;
update yt_channel_videos v set group_ko = t.g, members = t.m from (values
  ('CzjY66XFlho','엔시티 드림',array['제노']),
  ('AjirHScHt9I','엔시티 위시',array['리쿠']),
  ('Gz0uVzzgG40','있지',array['유나']),
  ('OXkL6ws23kY','엔믹스',array['릴리','해원']),
  ('Y5BhNIbE1hg','엔믹스',array['지우']),
  ('rDrmL4S5I8A','엔믹스',array['해원','배이']),
  ('TRXp6WxoiJk','세븐틴',array['민규']),
  ('CJfBLtKcKWQ','세븐틴',array['호시']),
  ('eIdDEDcAUZw','세븐틴',array['호시']),
  ('Bh5jgfOJDEM','세븐틴',array['호시']),
  ('kXNIueeej48','세븐틴',array['호시']),
  ('X9vzECIaKts','세븐틴',array['호시']),
  ('W1JoPYS0RkI','세븐틴',array['호시']),
  ('haVai1TuiEM','세븐틴',array['호시','디노']),
  ('kmEq2htOvhQ','에이티즈',array['산']),
  ('xF1QIuu5GIY','에이티즈',array['민기']),
  ('SeWO_Fx1-QI','에이티즈',array['성화','민기']),
  ('HUznOA-DToM','투모로우바이투게더',array['연준']),
  ('YlXsYc_hwjw','투모로우바이투게더',array['연준']),
  ('RBs8O5J8Z7k','투모로우바이투게더',array['범규']),
  ('XWSjTFia3v0','넥스지',array['휴이']),
  ('fhuhbq8MMQs','넥스지',array['유우','휴이']),
  ('PLdneDTslIE','엑소',array['첸']),
  ('JpXFYkuR63E','엑소',array['첸']),
  ('_Xpj5Zlsbe4','엑스디너리 히어로즈',array['정수']),
  ('xknpPRoSDt4','엑스디너리 히어로즈',array['주연']),
  ('zS1VT2FwBNY','엑스디너리 히어로즈',array['주연']),
  ('eMWuqdLFvrQ','엑스디너리 히어로즈',array['정수','O.de']),
  ('soB7e9DuGsw','보이넥스트도어',array['리우','태산','이한','운학'])
) as t(id, g, m) where v.id = t.id and v.tags_manual is not true and v.source_tier = 'fans';
select count(*) as updated from yt_channel_videos v join bak_20261116_fan30 b using (id) where v.members is distinct from b.members or v.group_ko is distinct from b.group_ko;
