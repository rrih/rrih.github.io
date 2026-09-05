// One-time retirement for the obsolete root registration; no fetch handler or cache deletion.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.registration.unregister()))
