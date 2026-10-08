// "Goes well with": other dishes offered next to what the guest chose. The server
// only sends which dishes (and why); everything shown comes from the dish data
// already in this page, so what is offered is always something on this menu, in
// this language, at today's price.

var suggestionDishes = null;

// Every dish in the page, by id, read once from the cards.
function suggestionDishIndex() {
  if (suggestionDishes) return suggestionDishes;
  suggestionDishes = {};
  document.querySelectorAll('[data-menu-item] [data-item]').forEach(function (node) {
    try {
      var dish = JSON.parse(node.dataset.item);
      if (dish && dish.id) suggestionDishes[dish.id] = dish;
    } catch (e) {
      // A card that cannot be read is just not offered.
    }
  });
  return suggestionDishes;
}

var suggestionRequest = {};

// Resolves to [{ dish, reason }]. onlyReasons narrows what is shown, for places
// where a vague "popular" offer would be noise.
function loadSuggestions(keys, onlyReasons, scope) {
  var slug = document.body.getAttribute('data-restaurant-slug');
  if (!slug || !keys.length) return Promise.resolve([]);
  var name = scope || 'selection';
  suggestionRequest[name] = (suggestionRequest[name] || 0) + 1;
  var ticket = suggestionRequest[name];
  return fetch('/m/' + encodeURIComponent(slug) + '/suggestions?items=' + encodeURIComponent(keys.join(',')), {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(function (response) {
      return response.ok ? response.json() : { suggestions: [] };
    })
    .then(function (body) {
      var index = suggestionDishIndex();
      // A newer question was asked meanwhile: this answer is out of date.
      if (ticket !== suggestionRequest[name]) return null;
      return (body.suggestions || [])
        .filter(function (s) {
          return index[s.id] && index[s.id].available !== false && (!onlyReasons || onlyReasons.indexOf(s.reason) !== -1);
        })
        .map(function (s) {
          return { dish: index[s.id], reason: s.reason };
        });
    })
    .catch(function () {
      return [];
    });
}

function countSuggestionAdd(dish, reason) {
  var slug = document.body.getAttribute('data-restaurant-slug');
  if (!slug) return;
  fetch('/m/' + encodeURIComponent(slug) + '/suggestions/' + encodeURIComponent(dish.id) + '/added?reason=' + encodeURIComponent(reason), {
    keepalive: true,
  }).catch(function () {});
}

// For the selection sheet. Methods, not getters, because this is spread into another component.
function suggestionsState() {
  return {
    sugg: [],
    suggTimer: null,

    suggInit: function () {
      var self = this;
      var refresh = function () {
        clearTimeout(self.suggTimer);
        self.suggTimer = setTimeout(function () {
          self.suggLoad();
        }, 250);
      };
      this.$watch('$store.selection.count', refresh);
      this.$watch('open', function (isOpen) {
        if (isOpen) refresh();
      });
    },

    suggLoad: function () {
      var self = this;
      var keys = Object.keys(Alpine.store('selection').items);
      if (!keys.length) {
        self.sugg = [];
        return;
      }
      loadSuggestions(keys).then(function (found) {
        if (found) self.sugg = found;
      });
    },

    suggReason: function (reason) {
      return this.suggestionLabels[reason] || '';
    },

    // A dish with sizes or extras needs those chosen, so it opens its own sheet.
    suggAdd: function (entry) {
      var dish = entry.dish;
      countSuggestionAdd(dish, entry.reason);
      if ((dish.variants && dish.variants.length) || (dish.addons && dish.addons.length)) {
        this.open = false;
        this.$dispatch('open-item-sheet', dish);
        return;
      }
      Alpine.store('selection').add({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        priceFormatted: dish.priceFormatted,
        currency: dish.currency,
        currencySymbol: dish.currencySymbol,
        addedToastMessage: this.suggestionLabels.added,
      });
    },
  };
}
