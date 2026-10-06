/**
 * Service Worker Registration & Realtime Update Listener
 */
export function registerServiceWorker(onUpdateFound) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Do not register in Electron desktop app
  if (window.electronAPI?.isElectron || window.navigator.userAgent.includes('Electron')) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates periodically every 30 minutes
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              if (onUpdateFound) {
                onUpdateFound(() => {
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                });
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  });
}
