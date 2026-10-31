// 분할 사이트맵 조각 누락이 전체 검사에서 조용히 빠지지 않는지 임시 로컬 파일만으로 확인한다.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {sitemapLocs}=require('./_sitemap.cjs'),SITE='https://kpop-universe.kr';
const outer=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-sitemap-'));let total=0,failed=0;
const urlset=urls=>'<urlset>'+urls.map(u=>'<url><loc>'+u+'</loc></url>').join('')+'</urlset>';
const index=urls=>'<sitemapindex>'+urls.map(u=>'<sitemap><loc>'+u+'</loc></sitemap>').join('')+'</sitemapindex>';
function fixture(files){const root=path.join(outer,'case-'+total);fs.mkdirSync(root);for(const[f,text]of Object.entries(files)){const p=path.join(root,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}return root;}
function check(name,fn){total++;try{fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
try{
 check('단일 구형 사이트맵 보존',()=>{const urls=[SITE+'/',SITE+'/g/에스파/'];assert.deepEqual(sitemapLocs(fixture({'sitemap.xml':urlset(urls)})),urls);});
 check('분할 조각 모두 합침',()=>{const root=fixture({'sitemap.xml':index([SITE+'/sitemaps/a.xml',SITE+'/sitemaps/b.xml']),'sitemaps/a.xml':urlset([SITE+'/a/']),'sitemaps/b.xml':urlset([SITE+'/b/'])});assert.equal(sitemapLocs(root).length,2);});
 check('사라진 조각은 검사 실패',()=>assert.throws(()=>sitemapLocs(fixture({'sitemap.xml':index([SITE+'/sitemaps/missing.xml'])}))));
 check('일부 조각 누락도 부분 통과 금지',()=>assert.throws(()=>sitemapLocs(fixture({'sitemap.xml':index([SITE+'/sitemaps/a.xml',SITE+'/sitemaps/missing.xml']),'sitemaps/a.xml':urlset([SITE+'/a/'])}))));
 check('URL 인코딩된 로컬 조각 이름 지원',()=>{const root=fixture({'sitemap.xml':index([SITE+'/sitemaps/with%20space.xml']),'sitemaps/with space.xml':urlset([SITE+'/a/'])});assert.equal(sitemapLocs(root).length,1);});
 check('외부 사이트맵을 빈 목록으로 보지 않음',()=>assert.throws(()=>sitemapLocs(fixture({'sitemap.xml':index(['https://example.invalid/out.xml'])}))));
 check('루트 밖 파일 경로는 읽지 않음',()=>{
  fs.writeFileSync(path.join(outer,'outside.xml'),urlset([SITE+'/outside/']));
  const root=fixture({'sitemap.xml':index([SITE+'/%2e%2e%2foutside.xml'])});
  assert.throws(()=>sitemapLocs(root));
 });
 check('빈 URL목록은 정상 보존',()=>assert.deepEqual(sitemapLocs(fixture({'sitemap.xml':urlset([])})),[]));
}finally{fs.rmSync(outer,{recursive:true,force:true});}
console.log(total+'검증 / '+failed+'실패');if(failed)process.exitCode=1;
