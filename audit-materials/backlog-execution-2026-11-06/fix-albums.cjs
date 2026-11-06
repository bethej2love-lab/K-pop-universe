const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../..'),source=path.join(root,'groups.json');
const text=fs.readFileSync(source,'utf8'),data=JSON.parse(text),original=structuredClone(data);
const previous=JSON.parse(fs.readFileSync(path.join(__dirname,'album-before.json'),'utf8'));
const official=JSON.parse(fs.readFileSync(path.join(__dirname,'official-albums.json'),'utf8'));
const tracks=id=>official.find(x=>x.id===id).tracks.map((t,i)=>({no:i+1,title:t.title,isTitle:t.isTitle,songId:t.id}));
const edits=[];
for(const [g,title,id,date,type] of [['비투비','Born to Beat','2104986','2012.04.03','미니 1집'],['씨엔블루','TRIGGER','11078855','2022.10.14','싱글']]){
 const index=data[g].discography.findIndex(x=>x.title===title),before=data[g].discography[index];
 assert.deepEqual(before,previous.find(x=>x.group===g&&x.album.title===title).album,'original audited album has changed');
 const next={...before,releaseDate:date,type,melonAlbumId:id,tracks:tracks(id)};
 next.trackCount=next.tracks.length;next.titleTrack=next.tracks.filter(t=>t.isTitle).map(t=>t.title).join(' / ');
 data[g].discography[index]=next;edits.push({g,index,before,after:next});
}
assert(!data['씨엔블루'].discography.some(x=>x.melonAlbumId==='11081490'));
const release={title:'LET IT SHINE',type:'싱글',isMain:true,cover:'https://cdnimg.melon.co.kr/cm2/album/images/110/81/490/11081490_20221020105300_500.jpg',releaseDate:'2022.10.19',trackCount:3,titleTrack:'LET IT SHINE',tracks:tracks('11081490'),region:'jp',melonAlbumId:'11081490',src:'melon'};
const index=data['씨엔블루'].discography.findIndex(x=>x.title==='TRIGGER');data['씨엔블루'].discography.splice(index,0,release);edits.push({g:'씨엔블루',index,before:null,after:release});
const reverse=structuredClone(data);for(const edit of [...edits].reverse()){if(edit.before===null)reverse[edit.g].discography.splice(edit.index,1);else reverse[edit.g].discography[edit.index]=edit.before;}
assert.deepEqual(reverse,original,'unrelated fields changed');
assert.deepEqual(data['씨엔블루'].discography.find(x=>x.melonAlbumId==='11052140'),original['씨엔블루'].discography.find(x=>x.melonAlbumId==='11052140'),'September digital pre-release preserved');
fs.writeFileSync(path.join(__dirname,'album-edits.json'),JSON.stringify(edits,null,2)+'\n');
const indent=text.match(/\n( +)"/)[1].length;fs.writeFileSync(source,JSON.stringify(data,null,indent)+'\n');
console.log('Corrected Born to Beat and TRIGGER; restored October LET IT SHINE; unrelated data and September pre-release unchanged.');
