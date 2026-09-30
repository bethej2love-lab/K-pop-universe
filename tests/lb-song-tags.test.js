// 재생 화면 상단(멤버·그룹) — 목록이 곡에 태그를 싣는지 + 상단바가 영상마다 그 태그로 그리는지 (2026-10-01)
//
// 배경(사용자 제보 "탐험 Discover 차트에서 영상 눌러도 상단에 태깅 멤버·그룹 떠야지"):
//  ① 차트·선반 빌더 10여 곳이 song 객체를 제각각 손으로 만들며 groupKo/memberKos를 빼먹어 상단이 통째로 비었다.
//  ② 상단바가 세션 ctx(처음 연 영상의 주인)만 봐서, 목록에서 다음 영상으로 넘어가도 첫 영상 멤버가 남았다.
//  ③ 여러 명 태깅돼도 첫 한 명만 떴다.
// 지키는 선:
//  · DB 행으로 song을 만드는 곳은 _rowTags(v)를 펼쳐 넣는다(새 선반을 만들 때 빼먹으면 여기서 실패)
//  · _lbUpdateMemberInfo는 곡의 memberKos/groupKo를 먼저 보고, 없을 때만 ctx
//  · 여러 명이면 전원을 칩으로, 한 그룹 전원이면 그룹명만(_withIsFullGroup)
//
// 실행: node tests/lb-song-tags.test.js
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => (c ? ok(m) : bad(m));

need(/function _rowTags\(v\)\{return\{groupKo:v\.group_ko[^}]*memberKos:v\.members[^}]*withMembers:v\.with_members/.test(html), '_rowTags가 그룹·멤버·콜라보 태그를 싣는다');

// DB 행 → song 조립 패턴: "({t:X.title,u:vidUrl(X)" 로 시작하는데 앞에 _rowTags가 없으면 태그 누락
const re = /\(\{(\.\.\._rowTags\((\w+)\),)?t:(\w+)\.title,u:vidUrl\(\3\)/g;
let m, total = 0; const miss = [];
while ((m = re.exec(html))) { total++; if (!m[1]) miss.push(html.slice(0, m.index).split('\n').length); }
need(total >= 12, `DB 행 → song 조립 ${total}곳 확인`);
need(!miss.length, `전부 _rowTags 포함${miss.length ? ` — 빠진 줄: ${miss.join(', ')}` : ''}`);
// 카드 하나짜리 라이트박스(Discover 단일 영상 카드)도 태그를 싣는다
const single = [...html.matchAll(/openLightbox\((?:vidUrl|vUrl),_isShortV\((\w+)\),\[\{([^}]*)\}\]/g)];
need(single.length>=5&&single.every(x=>x[2].startsWith('..._rowTags(')),`단일 영상 카드 ${single.length}곳도 태그 포함`);
need(/const base=\{\.\.\._rowTags\(v\),t:v\.title/.test(html), '순위 목록(_withRankDelta)도 태그 포함');

// 상단바
const i = html.indexOf('function _lbUpdateMemberInfo(');
const body = html.slice(i, html.indexOf('\n}\n', i));
need(/s\.memberKos/.test(body) && /_lbCtx\?\.groupKo/.test(body), '상단바: 곡 태그 우선, 없으면 ctx');
need(/_withIsFullGroup\(groupKo,_multi\)/.test(body), '상단바: 여러 명이면 칩, 한 그룹 전원이면 그룹명만');
need(/s\?\.withMembers/.test(body), '상단바: 차트·선반 곡의 DB 콜라보(withMembers)도 칩으로');
need(/lb-has-chips/.test(body), '상단바: 칩 줄이 있으면 영상을 내리는 클래스 토글');

console.log(pass ? '\n✅ 재생 상단 태그 테스트 통과' : '\n❌ 실패 있음');
process.exit(pass ? 0 : 1);
