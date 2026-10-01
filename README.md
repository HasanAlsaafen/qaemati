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

4. Run the app in development (Nest in watch mode plus a Tailwind watcher):

   ```bash
   npm run start:dev
   ```

5. Open http://localhost:3000. The Arabic page is the default; the header link switches to
   English (and back), setting a cookie that persists the choice.

## Scripts

- `npm run start:dev` - development server with hot reload and CSS rebuild on change
- `npm run build` - production build (Tailwind CSS + Nest)
- `npm run start` - run the production build
- `npm run lint` / `npm run lint:fix` - ESLint
- `npm run format` - Prettier on TypeScript sources
- `npm run prisma:generate` - generate the Prisma client
- `npm run prisma:migrate` - run Prisma migrations (added once the data model lands in Phase 2)

## Project layout

- `src/` - NestJS application code
- `views/` - Nunjucks templates (`layouts/`, `pages/`, `components/`)
- `public/` - static assets (compiled CSS, fonts, images)
- `i18n/` - translation files (`ar/`, `en/`)
- `prisma/` - Prisma schema and migrations
- `docs/` - design system and progress notes

## Notes

- The Arabic typeface (Thmanyah) is a licensed asset provided separately. Until the font files
  are added to `public/fonts/thmanyah/`, the UI falls back to IBM Plex Sans Arabic.
- All demo data is fictional; no real businesses or copyrighted assets are used.
