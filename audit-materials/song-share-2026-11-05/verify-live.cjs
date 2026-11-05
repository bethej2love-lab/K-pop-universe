// Read-only deployment evidence. Windows corporate TLS: node --use-system-ca <this file>
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const site='https://kpop-universe.kr';
const routes=['g/클로즈유어아이즈/s/snowysummer/','en/g/close-your-eyes/s/snowysummer/',
  'g/코르티스/성현/s/redred/','en/g/cortis/seonghyeon/s/redred/'];
const baseline=process.argv.includes('--baseline');
const meta=(html,key)=>(html.match(new RegExp('<meta (?:property|name)="'+key+'" content="([^"]*)"'))||[])[1];
(async()=>{
  const result={checkedAt:new Date().toISOString(),pages:[]};
  for(const route of routes){
    const response=await fetch(site+'/'+route,{cache:'no-cache'}),html=await response.text();
    const record={route,status:response.status,title:meta(html,'og:title'),image:meta(html,'og:image'),
      listForward:html.includes('(^#|&)vf='),heroVideo:(html.match(/class="hero" href="https:\/\/www.youtube.com\/watch\?v=([^"]+)/)||[])[1]};
    result.pages.push(record);
    if(!baseline){
      assert.equal(record.status,200,route);assert.ok(record.listForward,route+' list forwarding');
      assert.match(record.title,/모음|Fancams/i,route+' collection title');
      if(route.includes('snowysummer')){assert.match(record.title,/Snowy Summer/);assert.match(record.image,/\/qII5JRbotKs\//);assert.equal(record.heroVideo,'Li0zo4SZ5AY');}
      else assert.match(record.title,/REDRED/);
      const image=await fetch(record.image);assert.equal(image.status,200,route+' thumbnail');
    }
  }
  const r=await fetch(site+'/share_routes/'+encodeURIComponent('클로즈유어아이즈')+'.json',{cache:'no-cache'});
  result.manifestStatus=r.status;
  if(r.ok){const data=await r.json();result.snowyPublished=data.g.includes('snowysummer');if(!baseline)assert.ok(result.snowyPublished);}
  else if(!baseline)assert.fail('Published route manifest missing');
  if(!baseline){const source=await(await fetch(site+'/app.js',{cache:'no-cache'})).text();assert.ok(source.includes('function _seoUrlForSongList('),'new client deployed');}
  const output=path.join(__dirname,baseline?'before.json':'after.json');
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
