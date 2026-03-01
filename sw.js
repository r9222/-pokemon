// sw.js
// ⚠️ここを変えると全ユーザーのスマホで「アップデートしろ！」という強制命令が出ます
const CACHE_NAME = 'tama-navi-v3.1'; 

const ASSETS = [
    './',
    './index.html',
    './poke-ai.js',
    './pokemon-db.js',
    './poke-tamachan-data.js'
];

self.addEventListener('install', (e) => {
    // ★新しいsw.jsが届いたら、順番待ちを無視して「即・強制インストール」する魔法
    self.skipWaiting(); 
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    // ★アプリが起動した瞬間、友達のスマホ内にある「古いキャッシュ」をすべて焼き払う魔法
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('古いキャッシュを削除！', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // ★即座に新しいプログラムがスマホのコントロールを奪う魔法
    self.clients.claim();
});

// ★常にネットワーク（最新版）を最優先で取りに行く最強のフェッチ設定
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // ネットが繋がっていれば最新版を表示し、ついでにスマホのキャッシュも最新に書き換える
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                return response;
            })
            // 機内モードなど、完全に電波がない時だけ仕方なくキャッシュを使う
            .catch(() => caches.match(e.request)) 
    );
});

