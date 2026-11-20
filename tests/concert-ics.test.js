// 공연 '캘린더에 추가' — .ics 글이 규격대로 나오는지(종일 일정의 끝 날짜 = 마지막 날 다음 날, 글자 이스케이프). 브라우저·네트워크 없음.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const a=s.indexOf('function _concertIcs(ev){'),b=s.indexOf('function _concertIcsDownload',a);assert(a>=0&&b>a);
const f=vm.runInNewContext('const _venueName=v=>v;'+s.slice(a,b)+';_concertIcs');
const ics=f({id:'kopis-PF123',title:'CORTIS, 1st TOUR; SEOUL',date_start:'2026-12-31',date_end:'2027-01-01',venue:'KSPO DOME',city:'서울',official_url:'https://example.com/t'});
assert(ics.startsWith('BEGIN:VCALENDAR\r\n')&&ics.endsWith('END:VCALENDAR\r\n'));
assert(ics.includes('DTSTART;VALUE=DATE:20261231\r\n'));
assert(ics.includes('DTEND;VALUE=DATE:20270102\r\n'),'끝 날짜는 마지막 날 다음 날(해 넘김 포함)');
assert(ics.includes('SUMMARY:CORTIS\\, 1st TOUR\\; SEOUL\r\n'),'쉼표·세미콜론 이스케이프');
assert(ics.includes('LOCATION:KSPO DOME\\, 서울\r\n'));
assert(ics.includes('UID:concert-kopis-PF123@kpop-universe.kr'));
assert(f({title:'x',date_start:'2026-12-05'}).includes('DTEND;VALUE=DATE:20261206'),'하루짜리');
assert.equal(f({title:'x'}),'','날짜 없으면 빈 글');
console.log('PASS concert ics: 날짜·해 넘김·이스케이프·날짜 없음');
