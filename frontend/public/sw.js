const CACHE_NAME = 'computech-exam-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

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
