# Production deployment

The production stack is a workspace with three independently deployable
application services:

- `publish-web` serves the public site on `SITE_ADDRESS`.
- `cms` serves only CMS/login/API-admin routes on `CMS_SITE_ADDRESS`.
- `backend` owns `/api/*`, `/media/*`, PostgreSQL and S3 access. Both frontend apps proxy these paths to it over the private Docker network.
- `cms` and `publish-web` obtain their server-rendered data through the Backend API; neither container receives database or S3 credentials.
- `db` is PostgreSQL, with its own persistent volume.
- `s3` is MinIO, with its own persistent volume.
- `migrate` is a short-lived job that applies Drizzle migrations before `app` starts.
- `proxy` is Caddy and is the only service that exposes ports 80 and 443.

Source code is separated as follows:

```text
apps/
  backend/       API and media routes
  cms/           CMS pages and UI components
  publish-web/   public pages and UI components
packages/core/
  src/db/        shared database schema/client
  src/server/    shared domain services during the migration
```

`packages/core` is used by Backend for domain logic and database access. Frontend type-only contracts are erased during their builds and do not give frontend containers database access.

## First deployment on a VPS

1. Point both `SITE_ADDRESS` and `CMS_SITE_ADDRESS` to the VPS. Open inbound TCP ports 80 and 443.
2. Clone the repository and create the untracked production environment file:

   ```sh
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

3. Replace every `replace_with_...` value in `.env.production`. Do not commit this file.
4. Start the stack:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml up -d --build
   ```

5. Create the first CMS account and content once migrations complete:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml run --rm migrate pnpm db:seed:cms
   ```

   Do not run data-import commands automatically during deploys.

## Updating

```sh
git pull --ff-only
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Compose runs migrations before it replaces the application container. Watch the migration job if the release does not start:

```sh
docker compose --env-file .env.production -f compose.production.yaml logs migrate
```

## Local development

Use separate terminals for the services you need:

```sh
pnpm dev:backend
pnpm dev:cms
pnpm dev
```

The frontend defaults to `http://localhost:3002` for backend proxying. Set `BACKEND_URL` when a backend is running on a different local port.

## Backup

Back up both named volumes. Database example:

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > iorder-db.sql
```

For MinIO, back up the `minio-data` volume (or configure an external S3 replication/backup policy). Test restores before relying on a backup procedure.
