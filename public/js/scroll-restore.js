/**
 * Restores scroll position after a language switch (full page reload),
 * since the public menu can be long and losing your place is jarring.
 * Any link carrying data-preserve-scroll saves scrollY just before
 * navigating away; it is restored once, on the next load of the same path.
 */
(function () {
  var storageKey = 'qaemati-scroll:' + location.pathname;

  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-preserve-scroll]');
    if (link) {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
  });

  var saved = sessionStorage.getItem(storageKey);
  if (saved !== null) {
    sessionStorage.removeItem(storageKey);
    window.addEventListener('DOMContentLoaded', function () {
      window.scrollTo(0, parseInt(saved, 10));
    });
  }
})();
