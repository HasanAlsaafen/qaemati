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
- `npm run test` - unit tests (Jest, colocated `*.spec.ts` files)
- `npm run test:e2e` - end-to-end tests (Supertest, against a dedicated `qaemati_test`
  database — see "Running the e2e tests" below)
- `npm run prisma:generate` - generate the Prisma client
- `npm run prisma:migrate` - run Prisma migrations
- `npm run prisma:seed` - wipe and reseed demo data (one cafe, one restaurant; see
  `prisma/seed.ts`). Prints the shared demo admin password when it finishes.

## Running the e2e tests

The e2e suite runs against its own database (`qaemati_test`), never the dev `qaemati` one, so
tests can freely create/delete data without touching anything you're looking at in the browser.

1. Copy the test environment file and create the database once:

   ```bash
   cp .env.test.example .env.test
   psql -h localhost -p 5435 -U qaemati -d postgres -c "CREATE DATABASE qaemati_test OWNER qaemati;"
   DATABASE_URL="postgresql://qaemati:qaemati@localhost:5435/qaemati_test?schema=public" npx prisma migrate deploy
   ```

2. Run the suite:

   ```bash
   npm run test:e2e
   ```

Each spec file creates its own restaurant/admin fixture (a unique slug per file) and tears it
down in `afterAll`, so files can run back-to-back without clobbering each other's data.

## Project layout

- `src/` - NestJS application code
- `views/` - Nunjucks templates (`layouts/`, `pages/`, `components/`)
- `public/` - static assets (compiled CSS, fonts, images)
- `i18n/` - translation files (`ar/`, `en/`)
- `prisma/` - Prisma schema and migrations
- `docs/` - design system and progress notes

## Demo data

`npm run prisma:seed` creates two fictional, fully bilingual businesses:

- **Bayt Al-Zaytoun** (`bayt-al-zaytoun`) - a cafe, two menus (Breakfast 07:00 to 12:00, All day), 7 categories, 30 items, ILS.
- **Al-Sanabel** (`al-sanabel`) - a restaurant, one Main menu, 6 categories, 21 items, JOD.

Each gets one seeded admin user (`admin@<slug>.example.com`); every seeded account shares the
password `Qaemati@Demo123` (also printed at the end of the seed run). Item images are generated
gradient SVG placeholders (`prisma/seed/placeholder-image.ts`), never real photos.

## Notes

- The Arabic typeface is Thmanyah, a licensed asset in `public/fonts/thmanyah/` (see
  `docs/design-system.md` for the licensing caveat around self-hosting it).
- All demo data is fictional; no real businesses or copyrighted assets are used.
