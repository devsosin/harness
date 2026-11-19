---
name: local-run
description: 신규 서비스 저장소가 같은 형태의 로컬 실행 모드 3가지(mock: 프론트만 MSW 로, remote: 기존 서버·DB 를 환경변수로, local: docker compose 로 DB·백엔드·프론트를 한 번에)와 운영 배포 준비(운영용 compose, nginx·certbot 예시)를 갖추게 한다. 사용자가 "로컬 실행 방법 정리", "실행 모드", "목으로 띄워", "기존 서버 붙여서 실행", "DB 까지 로컬로", "docker compose 구성", ".env.example", "시드 데이터", "배포 준비", "nginx·certbot" 이라고 하거나 새 서비스 저장소를 셋업할 때 쓴다.
---

# Local run modes

Every new service repo runs the same three ways, each with **one command**, and the mode-3 setup moves to a server with nginx and certbot added. The `frontend` and `workspace-claude-md` skills point here instead of repeating these rules.

Output language: files written into the repo (`.env.example` comments, README/CLAUDE.md lines) follow the repo's doc language; reports follow the user's language.

## 1. The three modes

| Mode | Command | Runs | Backend / DB |
|---|---|---|---|
| 1. mock | `pnpm dev:mock` (frontend repo) | frontend dev server with MSW | none |
| 2. remote | `pnpm dev` (frontend) / backend run command | the repo(s) on the host | an existing server and DB, from env vars |
| 3. local | `docker compose up` (repo that owns `compose.yaml`) | DB + migrations + seed + backend + frontend | fresh, in containers |

### Mode 1 — mock

- Vite mode `mock`: `.env.mock` (committed) sets `VITE_API_MOCK=true`; `"dev:mock": "vite --mode mock"`. This one flag is the only switch — mock setup and handlers follow the frontend skill's `references/api-and-mocks.md` and `vite-spa.md`.
- Never a fallback: when the flag is off, a failing API shows the error state.

### Mode 2 — remote

- Frontend: the client calls the relative `/api`; the dev server proxies it to `API_PROXY_TARGET` (Vite `server.proxy`, read with `loadEnv`). Same-origin keeps the `HttpOnly` cookie flow working. `API_PROXY_TARGET` is not `VITE_*`, so it never reaches the bundle.
- Backend: `DATABASE_URL` (and external service keys) from `.env`.
- Real values go in `.env` / `.env.local` (git-ignored). **`.env.example` is committed** and lists every key with a safe placeholder and a one-line comment; adding a key to code means adding it there in the same commit.
- If the remote DB or server holds production data or calls real external APIs, write that next to the key in `.env.example` and confirm with the user before running against it.

### Mode 3 — local

- `compose.yaml` at the root of the repo that owns the DB (backend repo, or the monorepo root). Top-level `name: <repo-name>`, so a bare `docker compose up` gets a stable project name. Task sessions still override it with `-p <task-id>` (implement §1.5).
- Services, in start order: `db` → `migrate` (one-shot, exits 0) → `seed` (one-shot) → `api` → `web`. Order with `depends_on` conditions (`service_healthy`, `service_completed_successfully`), not sleeps.
- **Data is disposable**: the DB is always rebuilt from migrations + seed. `docker compose down -v && docker compose up` must give the same state. Nothing worth keeping lives only in a volume.
- No `container_name:`, ports bound to localhost with env defaults, passwords from `${VAR:?}` — same rules as the workspace-claude-md skill's `references/docker-dev.md`.
- Templates: [references/compose.md](references/compose.md).

## 2. Files

| File | Repo | Committed |
|---|---|---|
| `.env.example` | every repo | yes |
| `.env`, `.env.local` | every repo | no (`.gitignore`) |
| `.env.mock` | frontend | yes (no secrets, only `VITE_API_MOCK=true`) |
| `package.json` scripts `dev`, `dev:mock` | frontend | yes |
| `compose.yaml` | DB-owning repo | yes |
| `db/migrations/`, `db/seed.sql` (or the stack's tool, e.g. `sqlx migrate`) | backend | yes |
| `compose.prod.yaml`, `deploy/nginx/`, `deploy/README.md` | DB-owning repo | yes |

Seed data is fictional or anonymized — never a production copy.

## 3. Moving to a server

Same services, production overrides: images built once, no published DB port, the frontend built to static files served by nginx, nginx + certbot in front. Short version and examples: [references/deploy.md](references/deploy.md). Automating the server setup is out of scope here.

## 4. Record and check

1. Write the three commands (and the `.env.example` key names, never values) into the repo's CLAUDE.md "Commands" and the README.
2. Run each mode once and report what you saw:
   - mode 1: dev server starts, a mocked request returns fixture data;
   - mode 2: a request through the proxy reaches the configured server (skip and say so if no server is reachable);
   - mode 3: `docker compose up -d --wait`, then a request through `web` returns seeded rows; finish with `docker compose down -v`.
3. Modes you could not run are reported as not verified, with the reason.
