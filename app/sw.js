/* 緣來喝茶房仲APP — 離線快取
   改版時請更新 VERSION，否則客戶手機會一直用舊版。 */
var VERSION = 'v4-2026-10-21-linebar';
var CACHE = 'realtor-app-' + VERSION;

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 只查目前版本的快取，絕不跨舊快取讀取
function fromCurrentCache(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req);
  });
}

function putCurrentCache(req, res) {
  return caches.open(CACHE).then(function (c) {
    return c.put(req, res);
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isManifest = url.pathname.indexOf('manifest.json') !== -1;
  var isSw = url.pathname.indexOf('sw.js') !== -1;

  // sw.js 一律走網路，避免服務程式本身被舊快取卡住
  if (isSw) {
    e.respondWith(fetch(req).catch(function () { return fromCurrentCache(req); }));
    return;
  }

  // 導覽請求與 manifest：先走網路，確保名稱與版本即時更新
  if (req.mode === 'navigate' || isManifest) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          putCurrentCache(req, copy).catch(function () {});
        }
        return res;
      }).catch(function () {
        return fromCurrentCache(req).then(function (hit) {
          return hit || (req.mode === 'navigate' ? fromCurrentCache('./index.html') : undefined);
        });
      })
    );
    return;
  }

  // 其他資源（圖示等）：先看目前版本的快取，沒有才走網路
  e.respondWith(
    fromCurrentCache(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          putCurrentCache(req, copy).catch(function () {});
        }
        return res;
      });
    })
  );
});
