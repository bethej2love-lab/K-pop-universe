// K-POP UNIVERSE 서비스 워커 — PWA 오프라인 지원용.
// 빌드 스텝이 없는 프로젝트라 캐시 무효화는 이 버전 문자열을 수동으로 올려서 처리한다.
// 의미 있는 배포(html/css/js 변경) 때마다 CACHE_VERSION을 올릴 것 — 안 올리면 재방문 유저가
// 옛 캐시를 계속 보게 된다.
const CACHE_VERSION='kpu-v1';

const PRECACHE_URLS=[
  './kpop_universe.html',
  './kpop_universe.css',
  './manifest.json',
  './groups.json',
  './artists.json',
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
    }).catch(()=>caches.match(req).then(cached=>cached||caches.match('./kpop_universe.html')))
  );
});
