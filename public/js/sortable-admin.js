// Wires SortableJS onto any [data-sortable] container on the admin
// categories page (categories list, and each category's item list).
// Only elements carrying data-sort-id are draggable -- this is what
// keeps the "add category"/"add item" form at the bottom of each list
// out of Sortable's reach without a separate wrapper element.
(function () {
  function initSortable(container) {
    if (!window.Sortable || container.sortableInstance) return;
    const url = container.getAttribute('data-sort-url');
    const target = container.getAttribute('data-sort-target');
    if (!url || !target) return;

    container.sortableInstance = new Sortable(container, {
      handle: '[data-drag-handle]',
      draggable: '[data-sort-id]',
      animation: 150,
      onEnd: function (evt) {
        if (evt.oldIndex === evt.newIndex) return;
        const ids = Array.from(container.querySelectorAll('[data-sort-id]')).map((el) =>
          el.getAttribute('data-sort-id'),
        );
        window.htmx.ajax('POST', url, {
          source: container,
          target: target,
          swap: 'outerHTML',
          values: { ids: ids },
        });
      },
    });
  }

  function initAll() {
    document.querySelectorAll('[data-sortable]').forEach(initSortable);
  }

  document.addEventListener('DOMContentLoaded', initAll);
  document.body.addEventListener('htmx:afterSwap', initAll);
})();
