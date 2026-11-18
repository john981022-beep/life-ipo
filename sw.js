/* 人生上市 Service Worker
   - 遊戲畫面的檔案（html、css、js、圖示）存在手機裡，打開更快，網路不穩也能先顯示畫面
   - 行情、下單、聊天等資料一律即時向伺服器拿，不會快取，避免看到舊股價
   更新程式時：改 index.html 的 ?v= 版本號，並同步改下面的 VERSION。 */
const VERSION = '20261118j';
const CACHE = 'lifeipo-' + VERSION;
const CORE = ['./', 'index.html', 'manifest.json', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  ...['style.css', 'config.js', 'app.js', 'ceo.js', 'v3.js', 'main.js', 'ext.js', 'intro.js', 'v4.js', 'v5.js', 'v6.js', 'v7.js', 'v8.js', 'v9.js'].map(f => f + '?v=' + VERSION)];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('lifeipo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // 遊戲資料（Supabase）不經過快取
  if (url.hostname.endsWith('supabase.co')) return;
  // 打開頁面：先上網拿最新版，失敗才用手機裡的
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put('index.html', c)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  const sameOrigin = url.origin === location.origin;
  const cdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');
  if (!sameOrigin && !cdn) return;
  // 帶版本號的檔案內容不會變，手機裡有就直接用；其他的先用手機裡的，同時在背景更新
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  }));
});
