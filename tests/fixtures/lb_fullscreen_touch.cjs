// Real app markup/CSS + a local cross-origin player. No production API/video.
const fs=require('fs'),path=require('path');
function serve(req,res,root,port){
 const route=req.url.split('?')[0];let body;
 if(route==='/__fs-child')body=`<!doctype html><style>body{margin:0;background:#050510}button{position:fixed;right:8px;bottom:8px;width:40px;height:40px}</style><button id="fullscreen">⛶</button><script>
 document.getElementById('fullscreen').onclick=async()=>{parent.postMessage({type:'fs-touch',active:navigator.userActivation.isActive},'*');try{await document.documentElement.requestFullscreen();parent.postMessage({type:'fs-enter'},'*');}catch(e){parent.postMessage({type:'fs-error',error:e.name},'*');}};
 parent.postMessage({type:'fs-ready'},'*');
 </script>`;
 else if(route==='/__fs-parent'){
  const src=fs.readFileSync(path.join(root,'app.js'),'utf8'),a=src.indexOf('function _lbRequestFs('),end=src.indexOf("document.getElementById('yt-lb-rotate')",a);
  const binding=src.slice(a,end);
  body=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/kpop_universe.css"><script>
  window.__fsReady=false;window.__fsTouches=0;window.__fsActive=false;window.__fsEntered=false;window.__fsError='';
  fetch('/index.html').then(r=>r.text()).then(raw=>{
   const lb=new DOMParser().parseFromString(raw,'text/html').getElementById('yt-lightbox');document.body.append(lb);lb.classList.add('open','lb-browse');
   document.getElementById('yt-lb-title-text').textContent='Fullscreen touch fixture';
   const frame=document.getElementById('yt-lb-iframe');
   addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!=='http://localhost:${port}')return;if(e.data.type==='fs-ready')window.__fsReady=true;if(e.data.type==='fs-touch'){window.__fsTouches++;window.__fsActive=e.data.active;}if(e.data.type==='fs-enter')window.__fsEntered=true;if(e.data.type==='fs-error')window.__fsError=e.data.error;});
   // Simulate phones where a parent iframe element has no fullscreen method.
   for(const name of ['requestFullscreen','webkitRequestFullscreen','mozRequestFullScreen','msRequestFullscreen'])Object.defineProperty(frame,name,{configurable:true,value:undefined});
   frame.src='http://localhost:${port}/__fs-child';
   ${binding}
  });</script>`;
 }else return false;
 res.writeHead(200,{'Content-Type':'text/html'});res.end(body);return true;
}
async function check(c,ev,port){
 const sleep=ms=>new Promise(r=>setTimeout(r,ms)),out=[];
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
 await c.send('Page.navigate',{url:`http://127.0.0.1:${port}/__fs-parent`});
 let ready=false;for(let i=0;i<100;i++){await sleep(50);if(await ev(c,'window.__fsReady===true')){ready=true;break;}}
 if(!ready)throw Error('Local cross-origin fullscreen fixture not ready');
 for(const [W,H] of [[390,844],[844,390],[390,844],[932,430],[667,375]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true,screenOrientation:W>H?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});await sleep(350);
  const target=await ev(c,`(()=>{__fsTouches=0;__fsEntered=false;__fsError='';const f=document.getElementById('yt-lb-iframe'),r=f.getBoundingClientRect(),x=r.right-28,y=r.bottom-28;return{x,y,hit:document.elementFromPoint(x,y)?.id,coarse:matchMedia('(pointer:coarse)').matches};})()`);
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x,y:target.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  for(let i=0;i<20;i++){await sleep(50);if(await ev(c,'__fsEntered||!!__fsError'))break;}
  const result=await ev(c,`({touches:__fsTouches,active:__fsActive,entered:__fsEntered,error:__fsError,fullscreen:document.fullscreenElement===document.getElementById('yt-lb-iframe')})`);
  out.push({name:`${W}×${H} 첫 터치→교차 출처 플레이어 전체화면`,ok:target.coarse&&target.hit==='yt-lb-iframe'&&result.touches===1&&result.active&&result.entered&&result.fullscreen,target,result});
  await ev(c,'document.fullscreenElement?document.exitFullscreen():true');await sleep(100);
 }
 // Keep the pre-existing desktop workaround intact; real parent fullscreen API.
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await sleep(350);
 const target=await ev(c,`(()=>{const f=document.getElementById('yt-lb-iframe');for(const n of ['requestFullscreen','webkitRequestFullscreen','mozRequestFullScreen','msRequestFullscreen'])delete f[n];const r=f.getBoundingClientRect(),x=r.right-28,y=r.bottom-28;return{x,y,hit:document.elementFromPoint(x,y)?.id};})()`);
 for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x:target.x,y:target.y,button:'left',clickCount:1});await sleep(200);
 const fullscreen=await ev(c,"document.fullscreenElement===document.getElementById('yt-lb-iframe')");
 out.push({name:'데스크톱 기존 전체화면 우회 유지',ok:target.hit==='yt-lb-fs-cap'&&fullscreen,target,fullscreen});
 await ev(c,'document.fullscreenElement?document.exitFullscreen():true');return out;
}
module.exports={serve,check};
