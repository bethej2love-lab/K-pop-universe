// K-POP UNIVERSE 서비스 워커 — PWA 오프라인 지원용.
// 빌드 스텝이 없는 프로젝트라 캐시 무효화는 이 버전 문자열을 수동으로 올려서 처리한다.
// 의미 있는 배포(html/css/js 변경) 때마다 CACHE_VERSION을 올릴 것 — 안 올리면 재방문 유저가
// 옛 캐시를 계속 보게 된다.
const CACHE_VERSION='kpu-20260901-179e1d11';

// index.html이 이제 정식 앱 셸(kpop_universe.html은 index.html로 리다이렉트하는 얇은 파일로 전환,
// 2026-08-18 — 기존엔 index.html이 kpop_universe.html의 수동 복사본이라 동기화를 깜빡하면 옛 버전이
// 보이는 사고가 있었음). 루트 방문('/')과 명시적 './index.html' 둘 다 요청 URL이 달라서 Cache API가
// 별개로 취급하므로 둘 다 미리 캐시하고, kpop_universe.html도 옛 PWA 바로가기/북마크가 오프라인에서도
// 리다이렉트 자체는 되도록 그대로 캐시해둔다(그 안의 JS가 './'로 이동하는데 그 대상도 캐시돼있어야 함).
const PRECACHE_URLS=[
  './',
  './index.html',
  './kpop_universe.html',
  './kpop_universe.css',
  './manifest.json',
  './groups.slim.json',
  './artists.slim.json',
  './connections.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache=>cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

// 그룹/아티스트/연결 JSON은 앱 코드 자체가 이미 cache:'no-cache'로 fetch해서 항상 최신을 받으려 하므로,
// 서비스 워커는 그 위에 캐시-우선 전략을 얹지 않는다 — 네트워크 우선, 실패(오프라인)했을 때만 캐시로
// 대체하는 방식으로 기존 "항상 최신 데이터" 의도를 그대로 유지한다.
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return; // 유튜브/외부 API는 SW가 개입하지 않음

  event.respondWith(
    fetch(req).then(res=>{
      const resClone=res.clone();
      caches.open(CACHE_VERSION).then(cache=>cache.put(req,resClone));
      return res;
    }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./')))
  );
});
