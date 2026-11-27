# Backend repo CLAUDE.md — Rust / Axum preset

Default stack for a new backend repo. For an existing repo, keep its actual stack and fill the same sections from what is there.

Code rules live in the harness language guides — point to them, don't restate: `docs/rust/CODE_STYLE.md`, `docs/rust/CLEAN_ARCHITECTURE.md` (and `templates/` for lints and CI). If the repo has `docs/REPO_ARCHITECTURE.md`, it wins for module layout.

## Preset

| Area | Choice |
|---|---|
| Language / toolchain | Rust 1.99 (edition 2024), host or Docker `rust:1.99-bookworm` |
| HTTP | Axum + tower-http (trace, CORS, request ID), tokio |
| DB | PostgreSQL 16, SQLx (compile-time checked queries, `.sqlx/` offline data committed), SQLx migrations |
| Auth | JWT (HMAC, fixed algorithm) in `HttpOnly` cookies, refresh rotation tracked in DB, CSRF header; Argon2id passwords |
| Errors | one app error type → JSON `{ error: { code, message, fieldErrors, requestId } }`; no SQL/stack traces in responses |
| Config | environment variables only (`.env` locally, SSM Parameter Store in production) |
| External APIs | one adapter crate or module per provider (`reqwest`), normalized to internal types; mocked in tests |
| AI / LLM | an adapter per provider behind a trait (OpenAI, Gemini, Anthropic HTTP APIs via `reqwest`), structured output parsed with `serde` and validated before use; prompts and model config outside handlers. No separate Python service. |
| Tests | unit + `#[sqlx::test]` integration + HTTP contract tests (`tower::ServiceExt::oneshot`) |
| Lint / format | `cargo fmt`, `cargo clippy --all-targets -- -D warnings` |
| Image | multi-stage Dockerfile → `debian:trixie-slim` runtime; migrations are not run by the image |

## Template

````markdown
# <Service> — Rust/Axum API

<One paragraph: what this API serves, who calls it (web app, admin, order client, webhooks).>

Workspace context: this repo is `<folder>/` in the `<workspace>` workspace; see the root CLAUDE.md for docs and other repos. Paths outside this repo are marked *(workspace)*.

## Stack

<the preset table rows that apply, plus anything specific: message queue, S3 presigned URLs, scheduler>

## Structure

- `src/http/` — router, extractors, middleware, error → response mapping
- `src/<domain>/` — one module per domain: handlers (thin) → service (use cases) → repository (SQL)
- `src/integrations/<provider>/` — external API and AI adapters
- `src/config.rs` — env loading; fail fast on missing keys
- `migrations/` — SQLx migrations (never edit an applied one)
- `tests/` — integration and HTTP contract tests
- Layering and naming: harness `docs/rust/CLEAN_ARCHITECTURE.md`; style: `docs/rust/CODE_STYLE.md`.

## API

- Contract: `<docs/product/API_SPEC.md>` *(workspace)* — base path, casing, envelope, error codes. Change the spec in the same PR as the code.
- Deny by default: every route needs auth except the listed public ones. Authorization (role + ownership) on the server for every operation.
- Validate all input on the server (type, length, range, format), regardless of client validation.

## Database

- Migrations: `sqlx migrate add <name>`; applied files are never edited (sqlx rejects changed checksums). `*.sql` pinned to LF.
- Queries only through SQLx bind parameters. After changing a query: `cargo sqlx prepare -- --all-targets` and commit `.sqlx/` (never hand-edit it).
- Multi-step writes in one transaction.
- <Existing DB? list constraints: reused schema, enum storage values, ID generation.>

## Testing

- Unit tests for domain rules; integration tests against a throwaway DB; HTTP tests for status codes, validation, auth, and error shape.
- External APIs and AI providers are mocked; routine tests never need live credentials.
- <Which tests need seeded rows and which DB to use — see root CLAUDE.md §4.>

## Commands

Run from this repo's root. <Host Rust | Docker: prefix with `docker compose -p <task-id> -f docker-compose.dev.yml exec rust`.>

| Command | What |
|---|---|
| `cargo fmt --check` | format |
| `cargo clippy --all-targets -- -D warnings` | lint |
| `cargo test` | unit + integration (needs `DATABASE_URL` or PG* env) |
| `cargo sqlx prepare --check -- --all-targets` | `.sqlx/` up to date |
| `cargo run` | dev server on `127.0.0.1:8080` (needs `.env`: <KEY names>) |
| `docker build -t <name> .` | production image |

## Environment

Key names in `.env.example`. Values in `.env` (never committed) or SSM in production (`/<service>/<env>/<KEY>`).
````
