// 브라우저 매트릭스와 경로 필터/Node 제외 목록이 어긋나 검증을 누락하거나 중복 실행하지 않는지 확인.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),wf=fs.readFileSync(path.join(root,'.github/workflows/browser-smoke.yml'),'utf8'),ci=fs.readFileSync(path.join(root,'.github/workflows/data-and-tests.yml'),'utf8');
const suites=[...new Set([...wf.matchAll(/^\s+- suite:\s+([a-z0-9-]+)$/gm)].map(m=>m[1]))];
const browserFiles=['smoke',...suites].map(s=>'tests/'+s+'.test.js');
const paths=[...wf.matchAll(/^    paths:\n((?:      - '[^']+'\n)+)/gm)].map(m=>[...m[1].matchAll(/- '([^']+)'/g)].map(x=>x[1]));
let total=0,failed=0;function check(name,fn){total++;try{fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
check('PR/push 경로 필터 둘 다 존재',()=>assert.equal(paths.length,2));
for(let i=0;i<paths.length;i++)check('매트릭스 모든 브라우저 파일 경로 등록 '+i,()=>{const missing=browserFiles.filter(f=>!paths[i].includes(f));assert.equal(missing.length,0,missing.join(', '));});
check('두 이벤트의 검사 범위 동일',()=>assert.deepEqual([...paths[0]].sort(),[...paths[1]].sort()));
check('Node 전용 테스트 전체를 브라우저 경로로 잡지 않음',()=>{for(const ps of paths){assert(!ps.includes('tests/**'));assert(!ps.includes('tests/*.test.js'));}});
check('앱·데이터·공용 시작 도구 변경은 계속 검사',()=>{for(const ps of paths)for(const p of ['*.html','*.js','*.css','*.json','disco/**','vendor/**','tools/browser_test_runtime.cjs','.github/workflows/browser-smoke.yml'])assert(ps.includes(p),p);});
check('모든 브라우저 파일 존재·Node CI에서 제외',()=>{const skips=ci.slice(ci.indexOf('case "$b" in'),ci.indexOf('# ── 네트워크')).replace(/^\s*#.*$/gm,'');for(const f of browserFiles){assert(fs.existsSync(path.join(root,f)),f);assert(skips.includes(path.basename(f)),f);}});
console.log(total+'검증 / '+failed+'실패');if(failed)process.exitCode=1;
