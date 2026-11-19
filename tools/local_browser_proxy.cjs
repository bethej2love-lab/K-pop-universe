// 클라우드 세션(Claude Code 웹)에서 브라우저 테스트를 돌릴 때 쓰는 로컬 프록시(2026-11-19).
// 헤드리스 크롬은 주소에 든 프록시 비밀번호를 못 써서, 인증 없는 로컬 포트(8899)를 열고 세션 프록시(HTTPS_PROXY)로 인증 헤더를 붙여 넘긴다.
// 쓰는 법(환경 'kpop-universe'처럼 사이트·DB·CDN 주소가 열려 있어야 함):
//   node tools/local_browser_proxy.cjs &
//   printf '#!/bin/bash\nexec /opt/pw-browsers/chromium "$@" --proxy-server=http://127.0.0.1:8899 --proxy-bypass-list="127.0.0.1;localhost"\n' > /tmp/kpu-chrome.sh && chmod +x /tmp/kpu-chrome.sh
//   KPU_BROWSER_PATH=/tmp/kpu-chrome.sh node tests/desktop-close-layers.test.js
// 노트북·CI에서는 필요 없다(프록시가 없으면 HTTPS_PROXY가 비어 바로 끝난다).
if(!process.env.HTTPS_PROXY){console.log('HTTPS_PROXY 없음 — 이 도구는 클라우드 세션 전용');process.exit(0);}
const http=require('http'),net=require('net');const up=new URL(process.env.HTTPS_PROXY);
const auth='Basic '+Buffer.from(decodeURIComponent(up.username)+':'+decodeURIComponent(up.password)).toString('base64');
const srv=http.createServer((req,res)=>{const o=http.request({host:up.hostname,port:up.port,method:req.method,path:req.url,headers:{...req.headers,'Proxy-Authorization':auth}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});o.on('error',()=>{try{res.writeHead(502);res.end();}catch(e){}});req.pipe(o);});
srv.on('connect',(req,sock,head)=>{const u=net.connect(+up.port,up.hostname,()=>{u.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: ${auth}\r\n\r\n`);});
  let got=false,buf=Buffer.alloc(0);u.on('data',d=>{if(got)return sock.write(d);buf=Buffer.concat([buf,d]);const k=buf.indexOf('\r\n\r\n');if(k<0)return;got=true;const ok=/^HTTP\/1\.[01] 200/.test(buf.toString('latin1',0,20));sock.write(ok?'HTTP/1.1 200 Connection Established\r\n\r\n':'HTTP/1.1 403 Forbidden\r\n\r\n');if(!ok)return sock.end();const rest=buf.slice(k+4);if(rest.length)sock.write(rest);if(head&&head.length)u.write(head);sock.on('data',x=>u.write(x));});
  u.on('error',()=>sock.destroy());sock.on('error',()=>u.destroy());u.on('end',()=>sock.end());sock.on('end',()=>u.end());});
srv.listen(8899,'127.0.0.1',()=>console.log('authproxy 8899'));
