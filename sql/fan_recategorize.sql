-- 팬채널 영상 category='fan' 재분류 (2026-09-01)
-- 등록된 tier='fans' 채널들의 실제 업로드 영상(유튜브에서 수집) 중 아직 'fan'이 아닌 것만 category='fan'으로.
-- ⚠️ category 컬럼만 바꾼다(members·content_flag 등 태깅은 안 건드림). 대상 82건.
-- 재실행 안전(이미 'fan'이면 조건에서 빠짐).

UPDATE yt_channel_videos SET category='fan' WHERE category IS DISTINCT FROM 'fan' AND id IN ('BK7Zpkuj_nY','fFr1xkOSkjw','IKB5GeJbw2E','jk7uKF_AxGs','JURW6U8WKmI','KOGGion3iPY','LKTkuqkpRBw','sjBA1BB_X6k','T4_0Vgtalao','tEiPHpWgf8Y','Wg4OpNzbH-s','yycjGqkxi0A','_5H0eRwRYc4','_P5MoEldp1A','-puNQe8UpGU','1VRSmbXvzqc','4_kTlWwD37I','8mGVq8d9AE4','aQBz0RqAvag','bA1hyspB7os','BMSHK8DR9RU','bQFHB7KUdTg','C588uNoH1c4','ClCBeBz-5xw','ECMr4Av_wpY','Efjbqw6rR88','esRl0XHHEZs','G7kFH0HFB-I','go4pYugyEM8','H_6hP3MarfQ','iSNi9Hrv-c8','iT0sZAss4Uk','lM0fbV0jcKI','mlLMuKklKvQ','N3goaRYlAlo','rwxO_kK8X6M','T4RByAl75lo','u2gLv5O9Doc','uBOOBeXwKU8','wqgmoRnR81c','5jDWcMfpBHI','9aScG7Ufaj8','9HzaYb64E5k','d4i9VgCHRP4','ddL67EapNPQ','FdSQuz_-0UM','Fl-Hp59yCT4','fqZt0it4A1Q','GCuXTXyIScQ','ifAYnvBvchE','mRAiuATEwQA','UDbjqhNfty8','1-h1I05W7gw','4wa26qMFlZQ','5urQuj4ZRgw','9R2Q0bqxZHM','cqOyrPLyN_Y','cUfR_XcpY14','dX4GBvnMrtg','EEyBor5dX44','eHaeFUHfu5A','h1hMQZcx-jw','IKPThxC7Cyk','jhOXF2sDejg','Jn6VsXsxLFA','k51u3OgOQHM','ki3F88yIQlk','LT6XgPY8DQM','Lvrq-MVnqbU','mbFJTJ7DHNk','mD3FwfLyoxs','mr2WVb6D7jw','NmEuoYiRtZc','p78jkrHzwTg','QCrVpZ9g_38','R0JmKL7UF6c','svyuTFkxXr4','tK1_KzYksAQ','U5QNHCyKvXI','wHEmnkpK0Tw','X3ZbpyOKONw','YgSZnvenbQ0');

-- 확인: SELECT count(*) FROM yt_channel_videos WHERE category='fan';  -- 82 이상이어야 함
