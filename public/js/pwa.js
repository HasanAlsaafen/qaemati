// B4: service worker registration, offline banner, "Add to Home Screen"
// prompt, and the share button -- kept as one small vanilla file (no
// Alpine) since it's wiring up a handful of one-off browser APIs, not
// managing reactive state, same reasoning menu.js's header comment
// already gives for staying off Alpine.
(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Offline support degrading to "just a normal page" isn't worth
      // surfacing to the visitor -- nothing else on the page depends on
      // the service worker being present.
    });
  }

  var offlineBanner = document.querySelector('[data-pwa-offline-banner]');
  function updateOfflineBanner() {
    if (!offlineBanner) return;
    offlineBanner.hidden = navigator.onLine;
  }
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);
  updateOfflineBanner();

  var installButton = document.querySelector('[data-pwa-install-button]');
  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  if (installButton) {
    installButton.addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function () {
        deferredInstallPrompt = null;
        installButton.hidden = true;
      });
    });
  }
  window.addEventListener('appinstalled', function () {
    if (installButton) installButton.hidden = true;
  });

  var shareButton = document.querySelector('[data-share-button]');
  if (shareButton) {
    shareButton.addEventListener('click', function () {
      var url = window.location.href;
      var title = shareButton.getAttribute('data-share-title') || document.title;
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () {
          // AbortError from the user dismissing the native share sheet
          // is expected, not a failure worth reporting.
        });
        return;
      }
      var copiedLabel = shareButton.getAttribute('data-share-copied-label') || '';
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(url)
          .then(function () {
            window.dispatchEvent(
              new CustomEvent('toast', { detail: { message: copiedLabel, variant: 'success' } }),
            );
          })
          .catch(function () {});
      }
    });
  }
})();
