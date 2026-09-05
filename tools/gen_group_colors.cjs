const fs=require("fs");
const ROOT=process.env.HOME+"/Documents/GitHub/kpopuniverse";
const G=JSON.parse(fs.readFileSync(ROOT+"/groups.json","utf8"));
// ⚠️ 큐레이션(고신뢰만) — hex는 별색칠용 근사값, 유저 검수 필요.
// 공식 상징색이 문서화된 그룹 + 유명 응원봉만. 불확실한 그룹은 넣지 않음(기본 별색 유지).
const C={
  // SM 2세대 — 공식 펄 상징색 확립(문서화)
  "소녀시대":{color:{name:"파스텔 로즈",hex:"#F7B5C4"}},
  "슈퍼주니어":{color:{name:"펄 사파이어 블루",hex:"#1656C4"},lightstick:"슈퍼주니어 응원봉"},
  "동방신기":{color:{name:"펄 레드",hex:"#E4002B"},lightstick:"동방신기 응원봉"},
  "샤이니":{color:{name:"펄 아쿠아",hex:"#2CE6CE"}},
  "에프엑스":{color:{name:"펄 라이트 페리윙클",hex:"#BCA9E0"}},
  "엑소":{lightstick:"에리봉"},
  // 타 소속 2세대
  "인피니트":{color:{name:"펄 메탈 골드",hex:"#C7A94B"}},
  "빅뱅":{lightstick:"뱅봉"},
  "하이라이트":{color:{name:"미드나잇 버건디",hex:"#5E1A2E"}},
  // 3세대(공식/데뷔 상징색 문서화 + 유명 응원봉)
  "방탄소년단":{lightstick:"아미밤"},
  "트와이스":{color:{name:"애프리콧 & 네온 마젠타",hex:"#F7A192"},lightstick:"캔디봉"},
  "블랙핑크":{color:{name:"핑크 & 블랙",hex:"#FF7FB6"}},
  "세븐틴":{color:{name:"로즈쿼츠 & 세레니티",hex:"#F2B8C6"},lightstick:"캐럿봉"},
  "갓세븐":{color:{name:"그린",hex:"#009B48"}},
  "몬스타엑스":{lightstick:"몬베베봉"},
  "워너원":{lightstick:"워너원 응원봉"},
};
const out={};let miss=[];
for(const k of Object.keys(C)){ if(!G[k]){miss.push(k);continue;} out[k]=C[k]; }
fs.writeFileSync(ROOT+"/group_colors.json",JSON.stringify(out,null,1));
console.log("group_colors.json:",Object.keys(out).length,"그룹");
console.log("공식색:",Object.keys(out).filter(k=>out[k].color).length,"| 응원봉:",Object.keys(out).filter(k=>out[k].lightstick).length);
if(miss.length)console.log("⚠️ 키없음:",miss.join(" "));
Object.keys(out).forEach(k=>{const o=out[k];console.log("  "+k+":",o.color?o.color.name+" "+o.color.hex:"",o.lightstick?("· "+o.lightstick):"");});
