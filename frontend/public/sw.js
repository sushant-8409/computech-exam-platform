const CACHE_NAME = 'computech-exam-v2.0';
const STATIC_CACHE = 'computech-static-v2.0';
const DYNAMIC_CACHE = 'computech-dynamic-v2.0';

// Essential files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico'
];

// API endpoints to cache for offline support
const API_CACHE_PATTERNS = [
  '/api/auth/verify-token',
  '/api/student/profile',
  '/api/tests/',
  '/api/student/results'
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        console.log('Service Worker: Caching static files');
        await cache.addAll(STATIC_FILES);
        console.log('Service Worker: Static files cached successfully');
        // Force activation of new service worker
        await self.skipWaiting();
      } catch (error) {
        console.error('Service Worker: Failed to cache static files', error);
      }
    })()
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
          .filter(cacheName => 
            cacheName.startsWith('computech-') && 
            cacheName !== STATIC_CACHE && 
            cacheName !== DYNAMIC_CACHE
          )
          .map(cacheName => {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        await Promise.all(deletePromises);
        
        // Take control of all clients immediately
        await self.clients.claim();
        console.log('Service Worker: Activated and ready');
        
        // Notify clients about update
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            message: 'App updated! Refresh for latest features.'
          });
        });
      } catch (error) {
        console.error('Service Worker: Activation failed', error);
      }
    })()
  );
});

// Enhanced fetch event with intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Strategy 1: Static files - Cache First
        if (STATIC_FILES.includes(url.pathname) || 
            url.pathname.startsWith('/static/')) {
          return await cacheFirst(request, STATIC_CACHE);
        }
        
        // Strategy 2: API calls - Network First with cache fallback
        if (url.pathname.startsWith('/api/')) {
          return await networkFirst(request, DYNAMIC_CACHE);
        }
        
        // Strategy 3: Navigation requests - Network First with offline fallback
        if (request.mode === 'navigate') {
          return await networkFirst(request, DYNAMIC_CACHE, true);
        }
        
        // Strategy 4: Everything else - Network First
        return await networkFirst(request, DYNAMIC_CACHE);
        
      } catch (error) {
        console.error('Service Worker: Fetch failed', error);
        
        // Return offline fallback for navigation requests
        if (request.mode === 'navigate') {
          const cache = await caches.open(STATIC_CACHE);
          return await cache.match('/') || new Response('App is offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
        
        throw error;
      }
    })()
  );
});

// Cache First strategy - good for static assets
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Network request failed:', error);
    throw error;
  }
}

// Network First strategy - good for API calls and dynamic content
async function networkFirst(request, cacheName, isNavigation = false) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      // Only cache successful responses
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For navigation requests, return the main app shell
    if (isNavigation) {
      const appShell = await cache.match('/');
      if (appShell) {
        return appShell;
      }
    }
    
    throw error;
  }
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any background sync operations
      console.log('Background sync triggered')
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: data.actions || []
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action) {
    // Handle action button clicks
    console.log('Notification action clicked:', event.action);
  } else {
    // Handle notification body click
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Service Worker: Loaded and ready');

// ✅ NEW: Push notification event handler
self.addEventListener('push', function(event) {
  console.log('📱 Push message received:', event);

  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error('Error parsing push data:', error);
    data = {
      title: 'CompuTech Notification',
      body: 'You have a new notification'
    };
  }

  const title = data.title || 'CompuTech Exam Platform';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-192x192.png',
    tag: data.tag || 'computech-notification',
    data: data.data || {},
    requireInteraction: true, // Keep notification visible until user interacts
    actions: [
      {
        action: 'open',
        title: 'Open Dashboard',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ],
    silent: false,
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    timestamp: Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ✅ NEW: Notification click event handler
self.addEventListener('notificationclick', function(event) {
  console.log('📱 Notification clicked:', event);

  event.notification.close();

  if (event.action === 'close') {
    // Just close the notification
    return;
  }

  // Handle 'open' action or general click
  const urlToOpen = event.notification.data.url || '/student';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If app is not open, open it
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ✅ NEW: Handle background sync (for offline notifications)
self.addEventListener('sync', function(event) {
  console.log('📱 Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Sync any pending notifications when back online
      syncPendingNotifications()
    );
  }
});

// ✅ Helper function for background sync
async function syncPendingNotifications() {
  try {
    // Check if there are any pending notifications to sync
    const response = await fetch('/api/student/notifications/pending', {
      headers: {
        'Authorization': `Bearer ${getStoredToken()}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📱 Synced pending notifications:', data);
    }
  } catch (error) {
    console.error('📱 Failed to sync notifications:', error);
  }
}

// Helper to get token from IndexedDB or fallback
function getStoredToken() {
  // This is a simplified version - you might need to implement proper token storage
  return 'stored-token-here';
}
