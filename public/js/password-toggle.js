// The eye on a password field: shows what was typed, or hides it again. One
// listener for the whole page, so it also works on fields added later. The
// two labels live here, in the page's language, because the shared input
// template has no access to the translations.
(function () {
  var LABELS = {
    ar: { show: 'إظهار كلمة المرور', hide: 'إخفاء كلمة المرور' },
    en: { show: 'Show password', hide: 'Hide password' },
  };

  function labels() {
    return LABELS[document.documentElement.lang] || LABELS.en;
  }

  function label(button, shown) {
    button.setAttribute('aria-label', shown ? labels().hide : labels().show);
  }

  document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
    label(button, false);
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-password-toggle]');
    if (!button) return;
    var input = document.getElementById(button.getAttribute('data-password-toggle'));
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', show ? 'true' : 'false');
    label(button, show);
    button.querySelector('[data-eye-open]').classList.toggle('hidden', show);
    button.querySelector('[data-eye-off]').classList.toggle('hidden', !show);
  });
})();
