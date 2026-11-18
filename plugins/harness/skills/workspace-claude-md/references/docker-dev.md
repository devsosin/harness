# Docker dev & test environment

The default dev setup: **tools run in containers when the host lacks them** (Rust is usually not installed on the host). CLAUDE.md records how, in commands a session can paste.

Several sessions often run at once (one per issue, often in separate git worktrees). The setup must let each task create its own containers and remove exactly those at the end. The cleanup procedure itself is the `harness:cleanup` skill; CLAUDE.md only records the naming rule and points to it.

## Rules to write into CLAUDE.md

1. **One compose project per task**: `docker compose -p <task-id> -f <file> …` (`<task-id>` = issue ID in lowercase, e.g. `be-012`; for a manual check, `<repo>-manual`). Containers, networks, and volumes are then prefixed with it, and `docker compose -p <task-id> down -v` removes exactly that task's things.
   - Don't set `container_name:` in dev compose files — a fixed name collides between tasks and defeats `-p`.
   - Ports from env with a default, bound to localhost: `"127.0.0.1:${DB_PORT:-55432}:5432"`. A second task sets a different `DB_PORT` (or omits the published port and reaches the DB over the compose network).
2. **One-off commands use `docker run --rm`** (build a crate, run a test once) so nothing is left behind. Name long-lived ones (`--name <task-id>-db`) so they can be found later.
3. **Caches vs data**:
   - Cargo registry/git caches are safe to share between tasks: declare them `external: true` with fixed names (`cargo-registry`, `cargo-git`), created once with `docker volume create`. They are re-downloadable, so cleanup may remove them when nothing runs.
   - `target/` is per task (a volume inside the task's project, or the worktree's own `target/`). Two builds sharing one target dir block each other on the cargo lock.
   - DB data volumes are data: never removed without the user naming them.
4. **Stop what you started inside containers**: stopping a host `docker exec` does not stop the `cargo`/`node` process inside; end it with `docker exec <c> pkill -f <cmd>` or stop the container.
5. **Windows / Git Bash**:
   - `MSYS_NO_PATHCONV=1` before `docker run -v "$PWD:/w" -w /w …` or any container path argument; otherwise `/w` becomes `C:/Program Files/Git/w`.
   - Pin LF for `*.sh`, `*.sql`, `Dockerfile` in `.gitattributes` (`* text=auto eol=lf` is simplest). CRLF shell scripts fail in Linux containers (`set: Illegal option -`), and CRLF changes sqlx migration checksums.
   - From a container, the host is `host.docker.internal` (e.g. a DB published on the host's 5432).

## Backend dev compose (Rust + PostgreSQL)

Pattern used in practice (`docker-compose.dev.yml` in the backend repo):

```yaml
# docker compose -p <task-id> -f docker-compose.dev.yml up -d --build
# docker compose -p <task-id> -f docker-compose.dev.yml exec rust cargo test
# docker compose -p <task-id> -f docker-compose.dev.yml down -v      # end of task
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${LOCAL_PG_USER:-app_dev}
      POSTGRES_PASSWORD: ${LOCAL_PG_PASSWORD:?set LOCAL_PG_PASSWORD in .env}
      POSTGRES_DB: ${LOCAL_PG_DATABASE:-app_dev}
    ports: ["127.0.0.1:${LOCAL_PG_PORT:-55432}:5432"]
    volumes:
      # runs only when the volume is empty
      - ./db/schema.sql:/docker-entrypoint-initdb.d/10_schema.sql:ro
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 2s
      retries: 30
  rust:
    build: { context: ., dockerfile: dev.Dockerfile }   # rust:1.99-bookworm + rustfmt, clippy, sqlx-cli
    working_dir: /workspace/app
    command: sleep infinity
    depends_on: { db: { condition: service_healthy } }
    environment:
      PGHOST: db              # sqlx reads PG* for what DATABASE_URL leaves out — no password in a URL
      PGUSER: ${LOCAL_PG_USER:-app_dev}
      PGPASSWORD: ${LOCAL_PG_PASSWORD:?}
      PGDATABASE: ${LOCAL_PG_DATABASE:-app_dev}
      DATABASE_URL: postgres://db:5432/${LOCAL_PG_DATABASE:-app_dev}
      CARGO_TARGET_DIR: /cargo-target
    volumes:
      - .:/workspace/app
      - cargo-registry:/usr/local/cargo/registry
      - cargo-git:/usr/local/cargo/git
      - cargo-target:/cargo-target
volumes:
  pg-data:
  cargo-target:
  cargo-registry: { external: true }
  cargo-git: { external: true }
```

`dev.Dockerfile`:

```dockerfile
FROM rust:1.99-bookworm
ARG SQLX_CLI_VERSION=0.9.0
RUN rustup component add rustfmt clippy \
 && cargo install sqlx-cli --version ${SQLX_CLI_VERSION} --locked --no-default-features --features postgres,rustls \
 && rm -rf /usr/local/cargo/registry /usr/local/cargo/git
WORKDIR /workspace/app
```

Without a compose file (quick check of one crate):

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/w" -w /w -v cargo-registry:/usr/local/cargo/registry \
  -e SQLX_OFFLINE=true rust:1.99-bookworm cargo test -p <crate>
```

## Database for tests

Write down which kind each test needs — sessions otherwise run DB tests against the wrong DB and read failures as bugs:

| Kind | DB | Example |
|---|---|---|
| Unit / contract | none | `cargo test` without DB env |
| Integration, schema only | throwaway DB per test (`#[sqlx::test]`) or per task | baseline schema + new migrations |
| Integration, needs rows | seeded DB (anonymized seed or production copy), each test in a rolled-back transaction | tests that `SELECT … LIMIT 1` an existing product |

- Mark tests that need a DB (`#[ignore = "needs DB: …"]`) and give the run command (`cargo test -- --ignored`).
- A test that needs existing rows fails with `RowNotFound` on an empty DB — say so, so it is not mistaken for a schema bug.
- **Rebuild check** (migration projects): start an empty Postgres (`docker run --rm -d --name <task-id>-verify …`), apply the baseline + migration files in order, `pg_dump -s --no-owner` both DBs, and diff. Record the known differences in CLAUDE.md.

## Frontend

Node and pnpm usually exist on the host; then frontend commands run on the host. If not, `docker run --rm -v "$PWD:/w" -w /w node:24 corepack pnpm …`. Mock-backed dev servers (`pnpm dev:mock`) need no backend container.

## What not to write

- `docker system prune -a --volumes` or any unscoped prune — it deletes other projects' stopped DBs.
- Passwords in compose files or commands; use `${VAR:?}` and `.env` (not committed).
