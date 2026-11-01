// Diagnostic only: real pinned SDK in a fresh browser, synthetic Auth/Data APIs.
// Exit 0 means the observation completed, NOT that a product defect was fixed.
// node tools/reproduce_auth_read_lock.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {spawn}=require('node:child_process');
const {waitForBrowserCdp}=require('./browser_test_runtime.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const sdk=html.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[\d.]+\/dist\/umd\/supabase\.js)"/)[1];
const browser=[process.env.KPU_BROWSER_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(p=>fs.existsSync(p));
if(!browser)throw Error('Browser required for this diagnostic');
const fixture=`<!doctype html><script src="${sdk}"></script><script>
window.observe=async function(){
  const calls=[];let release;
  const fakeFetch=(input)=>{
    const url=new URL(typeof input==='string'?input:input.url);
    if(url.origin!=='https://audit.invalid')throw Error('Unexpected API host');
    calls.push(url.pathname);
    if(url.pathname==='/auth/v1/signup')return new Promise(resolve=>release=()=>resolve(new Response(JSON.stringify({msg:'synthetic denied',code:'validation_failed'}),{status:400,headers:{'Content-Type':'application/json'}})));
    if(url.pathname==='/rest/v1/public_rows')return Promise.resolve(new Response(JSON.stringify([{id:'synthetic-public-row'}]),{status:200,headers:{'Content-Type':'application/json'}}));
    throw Error('Unexpected API path '+url.pathname);
  };
  const client=supabase.createClient('https://audit.invalid','sb_publishable_synthetic_audit',{
    auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:fakeFetch}
  });
  await client.auth.getSession();
  const signing=client.auth.signInAnonymously();
  for(let i=0;i<100&&!release;i++)await new Promise(r=>setTimeout(r,10));
  if(!release)throw Error('Synthetic signup did not start');
  let readDone=false;
  const reading=client.from('public_rows').select('id').then(r=>{if(r.error)throw r.error;readDone=true;return r;});
  await new Promise(r=>setTimeout(r,200));
  const during={publicRequests:calls.filter(x=>x.startsWith('/rest/')).length,readDone};
  release();
  const [auth,read]=await Promise.all([signing,reading]);
  return {duringBlockedSignup:during,afterSignupFailure:{publicRequests:calls.filter(x=>x.startsWith('/rest/')).length,readDone,rows:read.data.length,authError:!!auth.error},apiHost:'audit.invalid',productionApiCalls:0};
};
</script>`;
function conn(url){return new Promise((resolve,reject)=>{
 const ws=new WebSocket(url),pending=new Map();let seq=0;
 ws.addEventListener('open',()=>resolve({send:(method,params={})=>new Promise((a,b)=>{const id=++seq;pending.set(id,{a,b});ws.send(JSON.stringify({id,method,params}));}),close:()=>ws.close()}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const{a,b}=pending.get(m.id);pending.delete(m.id);m.error?b(Error(m.error.message)):a(m.result);}});ws.addEventListener('error',reject);
});}
async function evaluate(c,expression){const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
(async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(fixture);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,cdpPort=9406;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-auth-read-'));
 const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${cdpPort}`,`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:['ignore','ignore','pipe']});
 let c;try{
  await waitForBrowserCdp(proc,cdpPort);
  const target=await(await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`,{method:'PUT'})).json();c=await conn(target.webSocketDebuggerUrl);
  await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  let ready=false;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));if(await evaluate(c,"typeof supabase!=='undefined'&&typeof observe==='function'")){ready=true;break;}}
  if(!ready)throw Error('Pinned SDK failed to load from its configured CDN');
  const result=await evaluate(c,'Promise.race([observe(),new Promise((_,reject)=>setTimeout(()=>reject(new Error("Observation timed out")),10000))])');
  console.log(JSON.stringify({sdk,observation:result},null,2));
  console.log('Observation only; no product fix and no production API request.');
 }finally{
  c?.close();
  await new Promise(resolve=>{if(proc.exitCode!==null||proc.signalCode!==null)return resolve();const timer=setTimeout(resolve,3000);proc.once('exit',()=>{clearTimeout(timer);resolve();});proc.kill();});
  await new Promise(r=>server.close(r));
  fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
