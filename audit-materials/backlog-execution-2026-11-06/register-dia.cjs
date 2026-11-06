const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../..'),p=path.join(root,'artists.json'),text=fs.readFileSync(p,'utf8'),artists=JSON.parse(text);
assert(!artists.some(a=>a.id==='a1897'||a.name?.ko==='디아'&&a.group?.ko==='솔로'),'Artist already exists; re-review instead of replacing');
const artist={name:{ko:'디아',en:'DIA'},group:{ko:'솔로',en:'Solo'},active:true,color:[180,160,240],debut:'2009',nat:{ko:'한국',en:'KR'},songs:[],links:{bugs:'https://music.bugs.co.kr/artist/80053703'},id:'a1897'};
artists.push(artist);fs.writeFileSync(p,JSON.stringify(artists,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'dia-registration.json'),JSON.stringify({artist,videoKey:'디아#a1897',sources:[{url:artist.links.bugs,facts:'Female Korean solo debut 2009; Kiss & Cry affiliation; Neverland and The Isle of Oblivion belong to this singer.'},{url:'https://www.youtube.com/watch?v=MpF9ScmG5zo',facts:'MBCkpop official Music Core 2014-01-25 Kiss&Cry stage; group membership verified by Bugs artist catalog.'}],omitted:'Birth date, exact debut day, agency and unregistered group roster not inferred. PIXY Dia a1798 retained; plain 디아 video key had 0 rows.'},null,2)+'\n');
console.log('Registered solo DIA a1897 with unique video key; PIXY Dia preserved.');
