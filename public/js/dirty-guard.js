// Warns before leaving a settings page with changes that were not saved.
// A form opts in with data-dirty-guard="name". The page's own state is the
// baseline: it is taken once the page (and Alpine) has settled, and again after
// a save succeeds, so a rejected save keeps the warning on. The browser shows
// its own wording, which cannot be customised, so there is nothing to translate.
(function () {
  var baselines = {};

  function snapshot(form) {
    var parts = [];
    new FormData(form).forEach(function (value, key) {
      if (key === 'csrf_token' || typeof value !== 'string') return;
      parts.push(key + '=' + value);
    });
    return parts.join('&');
  }

  function guarded() {
    return document.querySelectorAll('form[data-dirty-guard]');
  }

  function keyOf(form) {
    return form.getAttribute('data-dirty-guard');
  }

  function takeBaselines() {
    guarded().forEach(function (form) {
      if (!(keyOf(form) in baselines)) baselines[keyOf(form)] = snapshot(form);
    });
  }

  function isDirty() {
    return Array.prototype.some.call(guarded(), function (form) {
      var key = keyOf(form);
      return key in baselines && baselines[key] !== snapshot(form);
    });
  }

  window.addEventListener('load', function () {
    setTimeout(takeBaselines, 0);
  });

  document.body.addEventListener('htmx:afterRequest', function (event) {
    var form = event.target;
    if (!form.matches || !form.matches('form[data-dirty-guard]') || !event.detail.successful) return;
    // The saved page may come back normalised, so measure it again once it has settled.
    delete baselines[keyOf(form)];
    setTimeout(takeBaselines, 150);
  });

  window.addEventListener('beforeunload', function (event) {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();
