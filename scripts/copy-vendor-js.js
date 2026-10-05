/**
 * Copies the pinned htmx and Alpine.js builds into public/js/vendor so they
 * are served self-hosted (no external CDN request) and referenced by a
 * stable, version-independent path from templates.
 */
const fs = require('fs');
const path = require('path');

const files = [
  {
    from: 'node_modules/htmx.org/dist/htmx.min.js',
    to: 'public/js/vendor/htmx.min.js',
  },
  {
    from: 'node_modules/alpinejs/dist/cdn.min.js',
    to: 'public/js/vendor/alpine.min.js',
  },
  {
    from: 'node_modules/sortablejs/Sortable.min.js',
    to: 'public/js/vendor/sortable.min.js',
  },
];

for (const file of files) {
  const from = path.join(__dirname, '..', file.from);
  const to = path.join(__dirname, '..', file.to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`copied ${file.from} -> ${file.to}`);
}
