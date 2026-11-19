# Mode 2 and 3 templates

Replace `<...>`. Ports, user names and paths are defaults; keep the patterns.

## `.env.example`

One per repo, every key the code reads. Values are placeholders.

```dotenv
# --- mode 2 (remote): real values go in .env / .env.local, never committed ---
# Frontend dev server proxies /api here
API_PROXY_TARGET=http://localhost:8080
# Backend DB. Production data? say so here and confirm before use
DATABASE_URL=postgres://app_dev@localhost:55432/app_dev

# --- mode 3 (local compose) ---
LOCAL_PG_PASSWORD=change-me
# LOCAL_PG_PORT=55432
# API_PORT=8080
# WEB_PORT=5173
```

## Frontend: `vite.config.ts` proxy and scripts

```ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // '' = also non-VITE_ keys; they stay on the dev server
  return {
    server: {
      host: true, // reachable from the compose network in mode 3
      proxy: { '/api': { target: env.API_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true } },
    },
  }
})
```

```json
"scripts": { "dev": "vite", "dev:mock": "vite --mode mock" }
```

Mock start in `src/main.ts(x)` (frontend skill, `vite-spa.md`):

```ts
if (import.meta.env.VITE_API_MOCK === 'true') {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}
```

Next.js uses the same split: `NEXT_PUBLIC_API_MOCK` for the flag, `rewrites()` for the proxy in dev.

## `compose.yaml` (mode 3)

```yaml
# docker compose up -d --wait        # whole stack, project name from `name:`
# docker compose -p <task-id> up -d --wait   # per-task copy (implement §1.5)
# docker compose down -v             # drop everything; next `up` recreates it
name: <repo-name>

x-pg: &pg
  PGHOST: db
  PGUSER: ${LOCAL_PG_USER:-app_dev}
  PGPASSWORD: ${LOCAL_PG_PASSWORD:?set LOCAL_PG_PASSWORD in .env}
  PGDATABASE: ${LOCAL_PG_DATABASE:-app_dev}

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${LOCAL_PG_USER:-app_dev}
      POSTGRES_PASSWORD: ${LOCAL_PG_PASSWORD:?}
      POSTGRES_DB: ${LOCAL_PG_DATABASE:-app_dev}
    ports: ["127.0.0.1:${LOCAL_PG_PORT:-55432}:5432"]
    volumes: [pg-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 2s
      retries: 30

  migrate:   # one-shot; Rust preset: the api image running `sqlx migrate run` instead
    image: postgres:16
    environment: *pg
    volumes: ["./db/migrations:/migrations:ro"]
    entrypoint: ["sh", "-ec", "for f in /migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f \"$$f\"; done"]
    depends_on: { db: { condition: service_healthy } }

  seed:      # one-shot; fictional/anonymized rows only
    image: postgres:16
    environment: *pg
    volumes: ["./db/seed.sql:/seed.sql:ro"]
    entrypoint: ["psql", "-v", "ON_ERROR_STOP=1", "-f", "/seed.sql"]
    depends_on: { migrate: { condition: service_completed_successfully } }

  api:
    build: .
    environment:
      <<: *pg
      DATABASE_URL: postgres://db:5432/${LOCAL_PG_DATABASE:-app_dev}  # password from PGPASSWORD, not the URL
    ports: ["127.0.0.1:${API_PORT:-8080}:8080"]
    depends_on: { seed: { condition: service_completed_successfully } }
    healthcheck:
      test: ["CMD-SHELL", "<a command that exits 0 when /api/health answers>"]
      interval: 2s
      retries: 30

  web:
    image: node:24
    working_dir: /app
    command: ["sh", "-c", "corepack enable && pnpm install --frozen-lockfile && pnpm dev"]
    environment: { API_PROXY_TARGET: "http://api:8080" }
    volumes: ["${FRONTEND_DIR:-./frontend}:/app", "web-node-modules:/app/node_modules"]
    ports: ["127.0.0.1:${WEB_PORT:-5173}:5173"]
    depends_on: { api: { condition: service_healthy } }
    healthcheck:   # without it `up --wait` returns while pnpm install is still running or has failed
      test: ["CMD-SHELL", "node -e \"fetch('http://localhost:5173/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))\""]
      interval: 3s
      retries: 60

volumes:
  pg-data:
  web-node-modules:   # host node_modules (Windows binaries) must not leak into the Linux container
```

- pnpm in `web`: pin `packageManager` in `package.json` and commit the `allowBuilds` list pnpm writes to `pnpm-workspace.yaml` (`pnpm install --allow-build=<pkg>`). Otherwise corepack fetches another pnpm and the container install stops on `ERR_PNPM_IGNORED_BUILDS` (esbuild, msw).
- MSW in mode 1 needs a browser with service workers; some embedded preview panes never register one — check in a normal or headless Chrome/Edge before calling the mocks broken.
- Separate frontend repo: `FRONTEND_DIR=../<frontend-repo>` in `.env`; record that sibling checkout in CLAUDE.md as "relative to the workspace".
- Migrations must be safe to re-run on `up` (the tool tracks applied ones, or the SQL uses `IF NOT EXISTS`); the seed must be idempotent (`ON CONFLICT DO NOTHING`) since `up` on an existing volume runs it again.
- Rust preset: build the `api` image from a release Dockerfile; dev and test containers stay in `docker-compose.dev.yml` (workspace-claude-md `references/docker-dev.md`).
