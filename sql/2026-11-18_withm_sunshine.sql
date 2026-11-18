-- [실행됨 2026-11-18 Opus, 제목 전수 검토 후] 2026-11-18 Claude 검수 — 콜라보 태그(with_members) 근거 없음 점검(그룹별 쿼리 280개, 2,982행 → 영문명·별칭 비교 후 363 → 사람이 읽음) 결과 12건
-- with_members '선샤인(선샤인)'(네이처 전 멤버)이 영어 낱말 'Sunshine'(가사·곡명)만 보고 붙음: 이펙스 'You're my Sunshine' #soniceflow 챌린지 9 / 레인보우 'Sunshine' 곡 / 드리핀 'SUNSHINE LOVE' / 시크릿 'Secret Sunshine'(영화 제목)
create table if not exists public.bak_20261118_withm1 as select id, group_ko, members, with_members, with_groups from yt_channel_videos where id in ('litaFwTo1aE','pwzneGyZEi0','2JXhBEOWti4','fKyNeSQ4Jao','NTlSSLNMQBQ','KthrMXDBTHE','4077DQaJpnI','yzDxJKpeOmA','H_YG2Cs7E54','YvbX6buMhhU','2Z7rDO_mR78','0-DZHoxW3UY');
alter table public.bak_20261118_withm1 enable row level security;
revoke all on public.bak_20261118_withm1 from anon, authenticated;
update yt_channel_videos set with_members=array_remove(with_members, '선샤인(선샤인)') where id in ('litaFwTo1aE','pwzneGyZEi0','2JXhBEOWti4','fKyNeSQ4Jao','NTlSSLNMQBQ','KthrMXDBTHE','4077DQaJpnI','yzDxJKpeOmA','H_YG2Cs7E54','YvbX6buMhhU','2Z7rDO_mR78','0-DZHoxW3UY') and '선샤인(선샤인)'=any(with_members) and tags_manual=false;
select id, with_members, with_groups from yt_channel_videos where id in ('litaFwTo1aE','pwzneGyZEi0','2JXhBEOWti4','fKyNeSQ4Jao','NTlSSLNMQBQ','KthrMXDBTHE','4077DQaJpnI','yzDxJKpeOmA','H_YG2Cs7E54','YvbX6buMhhU','2Z7rDO_mR78','0-DZHoxW3UY');
-- 되돌리기: update yt_channel_videos v set with_members=b.with_members, with_groups=b.with_groups from public.bak_20261118_withm1 b where v.id=b.id;
-- ⚠️ with_groups에 네이처가 같이 붙은 행이 있으면 함께 제거할지 실행 전 확인(위 select 결과로 판단).
