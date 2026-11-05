// Fail the actual app's WebGL creation, then allow a user-triggered retry.
// This is fault injection in Chrome, NOT an iPad/WebKit crash reproduction.
module.exports=async function(c,ev,port){
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const {identifier}=await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.__graphicsFaultInjected=true;
 const getContext=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args){return /^(webgl2?|experimental-webgl)$/.test(type)?null:getContext.call(this,type,...args);};`});
 const out=[];let installed=true;
 try{
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await c.send('Emulation.setDeviceMetricsOverride',{width:1024,height:1366,deviceScaleFactor:2,mobile:true});
  await c.send('Page.navigate',{url:`http://127.0.0.1:${port}/index.html`});
  let state;
  for(let i=0;i<100;i++){
   await sleep(100);state=await ev(c,`(()=>{const el=document.querySelector('#loading.loading-error'),b=el?.querySelector('button');if(!b)return null;const r=b.getBoundingClientRect();return{text:el.textContent,x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,opacity:getComputedStyle(el).opacity,visibility:getComputedStyle(el).visibility,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b,booting:document.documentElement.classList.contains('booting'),chromeWait:document.documentElement.classList.contains('chrome-wait')};})()`);
   if(state)break;
  }
  const visible=!!state&&/브라우저 앱|browser app/.test(state.text)&&state.w>0&&state.h>0&&state.opacity==='1'&&state.visibility==='visible'&&state.hit&&!state.booting&&!state.chromeWait;
  out.push({name:'iPad 크기·WebGL 생성 불가: 빈 화면 대신 보이는 복구 안내/재시도',ok:visible,state});
  await c.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
  installed=false;
  if(!visible)return out;
  // No auto reload. A real first touch explicitly reloads after the fault is removed.
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:state.x,y:state.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  let recovered=false;
  for(let i=0;i<80;i++){await sleep(250);try{recovered=await ev(c,`!window.__graphicsFaultInjected&&ARTISTS.length>0&&!renderer.getContext().isContextLost()&&!document.documentElement.classList.contains('booting')`);if(recovered)break;}catch(_){}}
  out.push({name:'그래픽 사용 가능 복귀 후 재시도 첫 터치→앱 재시작',ok:recovered});
  return out;
 }finally{if(installed)await c.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
};
