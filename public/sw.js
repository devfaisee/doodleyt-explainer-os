const CACHE_NAME = 'doodleyt-media-cache-v1';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const isMedia = url.pathname.endsWith('.mp4') || 
                    url.pathname.endsWith('.wav') || 
                    url.pathname.endsWith('.png') || 
                    url.pathname.endsWith('.jpg');
    
    const isFromOutputOrServer = url.pathname.startsWith('/output/') || url.port === '3000' || url.hostname.includes('railway.app') || url.pathname.startsWith('/api/');
    
    if (isMedia && isFromOutputOrServer) {
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(networkResponse => {
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            })
        );
    }
});
