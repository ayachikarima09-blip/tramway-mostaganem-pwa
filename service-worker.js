const CACHE_NAME = 'tramway-mostaganem-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installation en cours...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Tous les fichiers sont mis en cache');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Erreur lors de la mise en cache:', error);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Activation en cours...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activé');
      return self.clients.claim();
    })
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes vers l'API backend
  if (url.origin.includes('tramway-pwa-backend.onrender.com')) {
    // Laisser passer les requêtes API sans cache
    return;
  }

  // Stratégie Cache First pour les fichiers statiques
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Retourner depuis le cache si disponible
        if (response) {
          return response;
        }

        // Sinon, faire la requête réseau
        return fetch(request).then((response) => {
          // Vérifier si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Cloner la réponse
          const responseToCache = response.clone();

          // Mettre en cache pour les prochaines fois
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // En cas d'erreur réseau, retourner une page hors ligne si disponible
        return caches.match('/index.html');
      })
  );
});

// Gestion de la synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  console.log('🔄 Background Sync déclenché');
  
  if (event.tag === 'sync-observations') {
    event.waitUntil(
      syncObservations()
    );
  }
});

// Fonction de synchronisation des observations
async function syncObservations() {
  try {
    console.log('📤 Tentative de synchronisation des observations...');
    
    // Ouvrir IndexedDB
    const db = await openIndexedDB();
    const observations = await getAllObservationsFromDB(db);
    const pendingObservations = observations.filter(obs => !obs.synced);

    if (pendingObservations.length === 0) {
      console.log('✅ Aucune observation en attente de synchronisation');
      return;
    }

    console.log(`📊 ${pendingObservations.length} observation(s) à synchroniser`);

    // Synchroniser chaque observation
    for (const obs of pendingObservations) {
      try {
        const response = await fetch('https://tramway-pwa-backend.onrender.com/api/observations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(obs)
        });

        if (response.ok) {
          // Marquer comme synchronisé dans IndexedDB
          obs.synced = true;
          await updateObservationInDB(db, obs);
          console.log(`✅ Observation ${obs.id} synchronisée`);
        }
      } catch (error) {
        console.error(`❌ Erreur de sync pour observation ${obs.id}:`, error);
      }
    }

    console.log('✅ Synchronisation terminée');
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error);
  }
}

// Fonctions utilitaires pour IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tramway-observations', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllObservationsFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['observations'], 'readonly');
    const store = transaction.objectStore('observations');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function updateObservationInDB(db, observation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['observations'], 'readwrite');
    const store = transaction.objectStore('observations');
    const request = store.put(observation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Gestion des notifications push (optionnel)
self.addEventListener('push', (event) => {
  console.log('📬 Notification Push reçue');
  
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle mise à jour disponible',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'tramway-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('Tramway Mostaganem', options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification cliquée');
  
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('✅ Service Worker chargé');
