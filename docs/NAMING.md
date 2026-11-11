# 표기 규칙 — 아티스트·곡 이름 (2026-11-11 사용자 확정)

검색 결과 제목(정적 페이지 `<title>`·og:title·h1)에서 한글로 찾든 영문으로 찾든 이름이 보이게 한다.

## 사람·그룹 이름: `한글(영문)`
- 한국어 페이지: `영재(Youngjae)`, `투어스(TWS)` / 영어 페이지: `Youngjae(영재)`, `TWS(투어스)`
- 괄호 앞 띄어쓰기 없음. 두 표기가 같으면(대소문자 무시) 하나만.
- 코드: `build_group_pages.js` `bilingualLabel(주표기, 보조표기)`

## 곡 이름: `한글 제목 English Title` (괄호 없이)
- 예: `너의 모든 가능성이 되어 줄게 All the Possibilities`, `첫 만남은 계획대로 되지 않아 Plot Twist`
- **영문 제목을 괄호에 넣지 않는 이유**: 원래 공식 제목 자체에 괄호 영문이 붙은 곡이 많다(특히 SM — `다시 만난 세계 (Into the New World)`). 그것과 우리가 덧붙인 영문을 구분하기 위해.
- 원래 제목에 괄호 영문이 있으면 그대로 쓴다(`널 따라가 (You, You)`) — 별칭을 덧붙이지 않는다.
- 영문 제목 출처: `shared.js` `_SONG_ALIASES`(그룹 → 디스코 곡 제목 → 공식 영문 제목, 첫 번째가 대표). 앱 검색 별칭과 같은 표. 없으면 한글 제목만.
- 코드: `tools/seo_extra.js` buildSongs의 `bilingualTitle`

## 사람 + 곡: `그룹 이름(Group Name) - 곡`
- `투어스 영재(TWS Youngjae) - 너의 모든 가능성이 되어 줄게 All the Possibilities 직캠 모음` / 영어 페이지 `TWS Youngjae(투어스 영재) - … Fancams`
- 멤버는 **그룹 + 이름**을 한 덩어리로 영·한 같이 맨 앞에 — 동명이인이 많다(영재: 투어스·갓세븐·B.A.P). 음방 직캠 제목 관례('[MPD직캠] 투어스 영재 직캠 … (TWS YOUNGJAE FanCam)')와 같다.
- 그룹이 앞에 있으니 제목 끝에 그룹을 또 붙이지 않는다(곡 제목이 덜 잘리게). 솔로는 이름만.
- 멤버 직캠 전체 페이지: `투어스 영재(TWS Youngjae) 직캠 모음 — 곡별 N개`, 멤버 프로필: `투어스 영재(TWS Youngjae) 프로필·나이·직캠·생일`.

## 곡의 정답 이름 = 한국 활동 곡명(멜론 디스코 표기)
한영 표기에 정답은 없지만 **기준은 한국 활동 곡명**(2026-11-11 사용자). 영문 번역 제목·일본판·영어판은 정답이 아니라 '별칭'.
- 저장되는 곡 제목(예: 음방 1위 `music_show_wins.song_title`)은 디스코 표기로. 위키 영문('Red Flavor'·'Palette')·대소문자('Love Dive')·판본 꼬리('Seven (feat. Latto) - Clean Ver.')는 정리한다. 멜론의 휜 따옴표(’)·전각 기호(＆)는 일반 문자로.
  - 수집기 `tools/wiki_music_wins.mjs` `_canonWinTitle`이 새 기록을 들어올 때 정리(디스코 대조 → `_SONG_ALIASES`). 테스트 `tests/win-title-canon.test.js`.
  - 11-11 일괄 정정: sql/2026-11-11_win_titles_disco.sql(1,560행, 백업 `_bak_win_titles_20261111`). 남은 55종(94행)은 디스코에 없거나 한글 원제를 확신 못 한 것 — 확인되면 정정 + 별칭 추가.
- 영상 ↔ 곡 연결(shared.js `_songAddNicks`): `_SONG_ALIASES` 영문 별칭도 쓴다. 짧거나(7글자 이하) 한 낱말인 별칭('Super'·'Fighting')은 따옴표·'가수 - 곡'에서만. 판본 곡('plot twist (Japanese ver.)'·'FIRE (Japanese Ver.)')이 원곡의 별칭과 같으면 원곡 하나로 합친다(따로 있던 곡 페이지는 원곡 페이지로 넘김).

## 아직 안 맞춘 곳
- 앱 화면(카드·검색 결과 줄)은 기존 표기 그대로 — 바꿀 땐 이 규칙으로.
- 디스코 자체에 영어판이 별도 곡으로 들어간 경우(데이식스 'You Were Beautiful' ⇄ '예뻤어' 등, 판본 표시 없음)는 아직 둘로 갈려 있다 — 다른 곡과 구분이 안 돼 자동으로 안 합침.
