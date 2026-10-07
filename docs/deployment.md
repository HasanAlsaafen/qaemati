# Deployment

A single server (a small VPS is enough to start) runs three containers: the app, Postgres and Caddy, which gets and renews the HTTPS certificate on its own. The image runs pending database migrations every time it starts.

## First deployment

1. Point a DNS record for your domain at the server. Open ports 80 and 443 only.
2. Install Docker and Docker Compose, then copy the project to the server.
3. `cp .env.production.example .env.production` and fill in every line (domain, database password, the two secrets, Gmail app password). The app refuses to start in production with weak or missing secrets.
4. Start it:
   ```
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
5. Check `https://your-domain/health` answers `{"status":"ok"}`.
6. Create the first platform operator, which prints a one time password:
   ```
   docker compose -f docker-compose.prod.yml --env-file .env.production exec app npm run super:create -- you@example.org "Your Name"
   ```
7. Sign in at `/super/login`. In production you are taken straight to set up two step verification with an authenticator app, and shown 10 recovery codes. Save them in a password manager.
8. Create a plan, then create your first restaurant.

Optional: restrict the platform area to your own addresses with `SUPER_ALLOWED_IPS` in `.env.production` (see `docs/saas-architecture.md`).

`DEMO_MODE` is forced off in the compose file, so the demo reset endpoint does not exist in production. Do not run the seed there: it wipes data.

## Updating

```
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations apply on start. Take a backup first when a release adds a migration.

## Backups

```
COMPOSE=1 scripts/backup.sh
```

writes a database dump and an archive of the uploaded photos to `backups/` and keeps the newest 14 (`KEEP=30` to change). Both files are checked for readability before the script reports success. To run it every night at 02:00:

```
0 2 * * * cd /srv/qaemati && COMPOSE=1 scripts/backup.sh >> backups/backup.log 2>&1
```

A backup on the same disk dies with the disk. Copy `backups/` somewhere else, for example `rclone sync backups remote:qaemati-backups` to any cloud storage, or `rsync` to another machine.

### Restore, and rehearsing it

```
COMPOSE=1 scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.dump backups/uploads-YYYYMMDD-HHMMSS.tar.gz
```

It stops the app, replaces the data and starts the app again, after you type `restore`. The uploads file is optional.

Rehearse once before you need it, on a copy and not on the live database:

```
createdb qaemati_rehearsal
TARGET_URL=postgresql://user:pass@host:5432/qaemati_rehearsal scripts/restore.sh backups/db-....dump
```

Then open it with the app (point a throwaway `DATABASE_URL` at it) and check a restaurant, its menu and a payment are there.

## Photos

Uploaded photos are files on the `uploads` volume, so they survive redeploys and are in the backups. They are served by the app itself. If you outgrow one server, move them to object storage and serve them from a CDN. Until then, one server with a volume is the simplest thing that works.

## What was and was not tested

- Backup, retention and restore were run against a real Postgres: the restored copy had identical row counts.
- The compose file renders correctly and the CI workflow is valid YAML.
- The Docker image was not built or run in the environment this was written in (no access to a Docker daemon), and neither was the Caddy certificate step. Expect to fix a small thing on the very first build, and use `docker compose logs app` and `logs caddy` to see what.
- The CI workflow has not run on GitHub yet.

## Updating checklist before going live

- [ ] DNS set, `https://domain/health` is ok
- [ ] Gmail app password works (send yourself a password reset)
- [ ] First backup taken and a restore rehearsed
- [ ] Backups copied off the server
- [ ] Landing page contact set (`LANDING_CONTACT_WHATSAPP` or `LANDING_CONTACT_EMAIL`), and the Thmanyah web license confirmed before `THMANYAH_WEB_LICENSED=true`
- [ ] Platform operator created, two step verification on, recovery codes saved, demo accounts absent
