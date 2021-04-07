self.addEventListener('install', (evt) => 
{
  console.info("[LOGi]",'ServiceWorker ==> install');
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => 
{
  console.info("[LOGi]", 'ServiceWorker ==> activate');
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => 
{
});