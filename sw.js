// sw.js
// ▼ここを変えるとスマホ側に「アップデートがあるよ！」と強制的に伝わります
const CACHE_NAME = 'tama-navi-v2.1'; 

const ASSETS = [
    './',
    './index.html',
    './poke-ai.js',
    './pokemon-db.js',
    './poke-tamachan-data.js'
];

// インストール時にキャッシュを保存し、すぐに待機状態をスキップする
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting(); 
});

// アクティブになった時、古いバージョンのキャッシュ（ゾンビ）を全削除する
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('古いキャッシュを削除しました:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 通信リクエストの処理（ネットワーク・ファースト）
// まずネットから最新版を取りに行き、電波がない時だけキャッシュ（保存データ）を使う
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

