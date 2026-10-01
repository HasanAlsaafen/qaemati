# Qaemati

Digital menu demo for restaurants and cafes in Palestine. NestJS (MVC, server-rendered) with
Nunjucks templates, Tailwind CSS, Prisma/PostgreSQL, and bilingual (Arabic/English) support.

## Stack

- NestJS + Express, TypeScript (strict)
- Nunjucks templates
- PostgreSQL + Prisma
- Tailwind CSS, htmx, Alpine.js
- nestjs-i18n (Arabic default, English secondary)
- Docker Compose for local PostgreSQL

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose (your user must be in the `docker` group, or use `sudo`)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

4. Run migrations and seed demo data (one fictional cafe, one fictional restaurant, bilingual
   menus):

   ```bash
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. Run the app in development (Nest in watch mode plus a Tailwind watcher):

   ```bash
   npm run start:dev
   ```

6. Open http://localhost:3000 for the home page (lists the seeded demo menus), or go straight to
   a menu: http://localhost:3000/m/bayt-al-zaytoun or http://localhost:3000/m/al-sanabel. Arabic
   is the default language; the switcher sets a cookie that persists the choice.

## Scripts

- `npm run start:dev` - development server with hot reload and CSS rebuild on change
- `npm run build` - production build (Tailwind CSS + Nest)
- `npm run start` - run the production build
- `npm run lint` / `npm run lint:fix` - ESLint
- `npm run format` - Prettier on TypeScript sources
- `npm run prisma:generate` - generate the Prisma client
- `npm run prisma:migrate` - run Prisma migrations
- `npm run prisma:seed` - wipe and reseed demo data (one cafe, one restaurant; see
  `prisma/seed.ts`). Prints the shared demo admin password when it finishes.

## Project layout

- `src/` - NestJS application code
- `views/` - Nunjucks templates (`layouts/`, `pages/`, `components/`)
- `public/` - static assets (compiled CSS, fonts, images)
- `i18n/` - translation files (`ar/`, `en/`)
- `prisma/` - Prisma schema and migrations
- `docs/` - design system and progress notes

## Demo data

`npm run prisma:seed` creates two fictional, fully bilingual businesses:

- **Bayt Al-Zaytoun** (`bayt-al-zaytoun`) - a cafe, 7 categories, 30 items, ILS.
- **Al-Sanabel** (`al-sanabel`) - a restaurant, 6 categories, 21 items, JOD.

Each gets one seeded admin user (`admin@<slug>.example.com`); every seeded account shares the
password `Qaemati@Demo123` (also printed at the end of the seed run). Item images are generated
gradient SVG placeholders (`prisma/seed/placeholder-image.ts`), never real photos.

## Notes

- The Arabic typeface is Thmanyah, a licensed asset in `public/fonts/thmanyah/` (see
  `docs/design-system.md` for the licensing caveat around self-hosting it).
- All demo data is fictional; no real businesses or copyrighted assets are used.
