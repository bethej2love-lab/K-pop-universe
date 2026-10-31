// 브라우저 테스트 공용 시작 확인. 프로세스 실패와 앱 화면 실패를 구별하고 시작 대기를 제한한다.
async function waitForBrowserCdp(child,port,maxMs=45000){
  let stderr='',spawnError=null;
  child.stderr?.on('data',data=>{stderr=(stderr+data.toString()).slice(-4000);});
  child.on('error',error=>{spawnError=error;});
  const end=Date.now()+maxMs;
  while(Date.now()<end){
    if(spawnError||child.exitCode!==null||child.signalCode){
      throw new Error(`Chromium 시작 실패(exit=${child.exitCode},signal=${child.signalCode}): ${spawnError?.message||''} ${stderr}`);
    }
    try{const r=await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(1500)});if(r.ok){const v=await r.json();if(v.webSocketDebuggerUrl)return;}}catch(e){}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw new Error(`Chromium CDP가 ${maxMs}ms 안에 열리지 않음: ${stderr}`);
}
module.exports={waitForBrowserCdp};
