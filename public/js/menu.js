/**
 * Public menu interactions: instant client-side search (with Arabic
 * normalization) and category scroll-spy. Plain vanilla JS, not Alpine,
 * because this runs over every item card on the page and Alpine's
 * reactivity overhead isn't worth it for a scroll listener and a text
 * filter. The item detail bottom sheet (Alpine) is unaffected by this file.
 */
(function () {
  // Mirrors src/common/text/normalize-search-text.ts. Keep both in sync.
  function normalize(value) {
    return value
      .normalize('NFKC')
      .replace(/[ً-ْٰ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .toLowerCase()
      .trim();
  }

  var searchInput = document.querySelector('[data-menu-search]');
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-category-section]'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('[data-category-chip]'));
  var sectionsContainer = document.querySelector('[data-menu-sections]');
  var emptyState = document.querySelector('[data-menu-empty-state]');
  var categoryBar = document.querySelector('[data-category-bar]');

  var ACTIVE_CLASSES = ['bg-primary', 'text-primary-on'];
  var INACTIVE_CLASSES = ['bg-muted-surface', 'text-text', 'hover:bg-primary-soft'];

  function setChipActive(chip, isActive) {
    if (isActive) {
      chip.classList.remove.apply(chip.classList, INACTIVE_CLASSES);
      chip.classList.add.apply(chip.classList, ACTIVE_CLASSES);
      chip.setAttribute('aria-current', 'true');
    } else {
      chip.classList.remove.apply(chip.classList, ACTIVE_CLASSES);
      chip.classList.add.apply(chip.classList, INACTIVE_CLASSES);
      chip.removeAttribute('aria-current');
    }
  }

  function chipForSection(section) {
    var anchor = '#' + section.id;
    return chips.filter(function (chip) {
      return chip.getAttribute('data-category-chip') === anchor;
    })[0];
  }

  // --- Search -------------------------------------------------------

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var query = normalize(searchInput.value);
      var totalVisible = 0;

      sections.forEach(function (section) {
        var items = Array.prototype.slice.call(section.querySelectorAll('[data-menu-item]'));
        var visibleInSection = 0;

        items.forEach(function (item) {
          var matches = query === '' || (item.getAttribute('data-search-text') || '').indexOf(query) !== -1;
          item.classList.toggle('hidden', !matches);
          if (matches) visibleInSection++;
        });

        section.classList.toggle('hidden', visibleInSection === 0);
        var chip = chipForSection(section);
        if (chip) chip.classList.toggle('hidden', query !== '' && visibleInSection === 0);

        totalVisible += visibleInSection;
      });

      var hasQuery = query !== '';
      emptyState.classList.toggle('hidden', !(hasQuery && totalVisible === 0));
      sectionsContainer.classList.toggle('hidden', hasQuery && totalVisible === 0);
    });
  }

  // --- Scroll-spy -----------------------------------------------------

  var manualNavigationUntil = 0;

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      manualNavigationUntil = Date.now() + 800;
      chips.forEach(function (c) {
        setChipActive(c, c === chip);
      });
    });
  });

  if ('IntersectionObserver' in window && sections.length > 0) {
    var observer = new IntersectionObserver(
      function (entries) {
        if (Date.now() < manualNavigationUntil) return;

        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var chip = chipForSection(entry.target);
          if (!chip) return;

          chips.forEach(function (c) {
            setChipActive(c, c === chip);
          });

          if (categoryBar) {
            chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        });
      },
      { rootMargin: '-30% 0px -65% 0px', threshold: 0 },
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }
})();
