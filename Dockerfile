# One image runs the app, the migrations and the one off commands such as
# `npm run super:create`. It keeps the dev dependencies on purpose: the Prisma
# CLI and ts-node are needed at deploy time, and a few hundred MB is a fair
# price for not maintaining a second set of scripts.
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Dependencies first, so a code change does not reinstall them. NODE_ENV is set
# only after install because the build needs the dev dependencies.
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY prisma ./prisma
RUN NODE_ENV=development npm ci

COPY . .
RUN npx prisma generate && npm run build

# Uploaded photos live here. Mount a volume on it, or they disappear with the container.
RUN mkdir -p public/uploads && chown -R node:node /app
VOLUME ["/app/public/uploads"]

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1

# Applies pending migrations, then starts. Several instances starting together
# are safe: Prisma takes a database lock while it migrates.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
