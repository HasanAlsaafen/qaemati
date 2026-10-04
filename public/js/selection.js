// "My selection" (A1): a tap-to-build list stored in localStorage, no
// account, scoped per restaurant so switching between two demo menus in
// the same browser doesn't mix their selections. A global Alpine store
// (not a per-component x-data) since the item cards' "+" buttons, the
// floating bar, and the summary sheet are independent DOM subtrees that
// all need to read and write the same state.
document.addEventListener('alpine:init', () => {
  const restaurantSlug = document.body.dataset.restaurantSlug || 'menu';
  const storageKey = 'qaemati:selection:' + restaurantSlug;

  Alpine.store('selection', {
    items: {}, // { [itemId]: { id, name, priceFormatted, price, currency, quantity } }
    note: '',

    init() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.items = parsed.items || {};
          this.note = parsed.note || '';
        }
      } catch (e) {
        // Corrupt or inaccessible storage (private browsing, quota) --
        // start empty rather than breaking the page.
      }
    },

    persist() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ items: this.items, note: this.note }));
      } catch (e) {
        // Selection still works for this page view even if it can't be
        // saved across reloads (e.g. storage quota exceeded).
      }
    },

    add(item) {
      const existing = this.items[item.id];
      if (existing) {
        this.items[item.id] = { ...existing, quantity: existing.quantity + 1 };
      } else {
        this.items[item.id] = { ...item, quantity: 1 };
      }
      this.persist();
      window.dispatchEvent(
        new CustomEvent('toast', { detail: { message: item.addedToastMessage, variant: 'success' } }),
      );
    },

    setQuantity(itemId, quantity) {
      if (quantity <= 0) {
        const next = { ...this.items };
        delete next[itemId];
        this.items = next;
      } else {
        this.items[itemId] = { ...this.items[itemId], quantity };
      }
      this.persist();
    },

    setNote(note) {
      this.note = note;
      this.persist();
    },

    clear() {
      this.items = {};
      this.note = '';
      this.persist();
    },

    get list() {
      return Object.values(this.items).sort((a, b) => a.name.localeCompare(b.name));
    },

    get count() {
      return Object.values(this.items).reduce((sum, item) => sum + item.quantity, 0);
    },

    get total() {
      return Object.values(this.items).reduce(
        (sum, item) => sum + item.quantity * Number(item.price),
        0,
      );
    },

    get currency() {
      const first = Object.values(this.items)[0];
      return first ? first.currency : '';
    },
  });
});
