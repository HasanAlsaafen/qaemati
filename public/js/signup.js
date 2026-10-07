// Suggests the menu address from the English name, until the person types their own.
(function () {
  var name = document.querySelector('[name="nameEn"]');
  var slug = document.querySelector('[data-slug-field]');
  if (!name || !slug) return;
  var touched = slug.value !== '';
  slug.addEventListener('input', function () {
    touched = slug.value !== '';
  });
  name.addEventListener('input', function () {
    if (touched) return;
    var suggestion = name.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 38)
      .replace(/-+$/g, '');
    slug.value = suggestion.length >= 3 ? suggestion : '';
  });
})();
