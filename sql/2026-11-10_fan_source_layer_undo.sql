-- 2026-11-10_fan_source_layer.sql 되돌리기 — 백업 표의 category로 복구(코드도 category='fan' 기준으로 되돌려야 By Fans가 예전처럼 동작)
update public.yt_channel_videos v set category=b.category from public._bak_fan_category_20261110 b where v.id=b.id and v.category is distinct from b.category;
select count(*) from public.yt_channel_videos where category='fan';
