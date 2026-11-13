# Rust Project Structure

Shared module and file layout rules for Rust repositories. For code rules, see [CODE_STYLE.md](CODE_STYLE.md).

> **The repository's own document comes first.** If a repository has `docs/REPO_ARCHITECTURE.md`, read it first for the actual structure (module list, per-service folders, exceptions) and use this guide for anything it does not cover. If they disagree, follow `REPO_ARCHITECTURE.md`.

## 1. Principles

- **Dependencies point inward.** Domain types do not know external formats (HTTP responses, DB rows, screens). Conversion between an external format and the domain lives in the `types.rs` of the module that talks to that external system (the adapter).
- **Keep entry points thin.** `main.rs`, HTTP handlers and trait implementations take input, call the workflow and return the result.
- **Group by feature (domain)**, not by layer (`models/`, `services/`, `controllers/`) first. Layers live *inside* a feature (web service: handler → usecase → repository, §3).
- **Share only what two or more places actually use.** Otherwise keep it where it is used.
- Create a file only for a clear responsibility. A small feature can be a single `mod.rs`.

## 2. Feature folder (all shapes)

| File | Owns | Does not contain |
|---|---|---|
| `mod.rs` | Entry points (trait impls, public functions) and the workflow: ordering, retries, concurrency, collecting results | Wire types, request body assembly details |
| `types.rs` | Request/response DTOs (serde), external ↔ domain conversion, local validation, the feature's enums | Network or DB calls |

Web service domains add layers on top of this (`handler`, `usecase`, `repository`, optional `dto/`, `constants.rs`) — see §3 "Domain feature layout".

## 3. Layout by project shape

### API client library (lib)

```text
src/
  lib.rs       module declarations, result alias
  config.rs    factory (config → implementation), e.g. get_api()
  errors.rs    shared errors and the reaction per error (stop / re-login / retry)
  traits.rs    traits the caller uses (ports)
  types/       unified domain (provider-agnostic)
  utils/       used by two or more providers: http, retry, time, ...
  <provider>/  one per external service
    mod.rs     client struct, from_env, submodules, host constants
    client.rs  request helpers (get/post/put): auth injection, mutations, envelope parsing
    types.rs   response envelope enum + into_data, provider error-code classification
    <feature>/ mod.rs (trait impl, workflow) + types.rs
```

Callers use only the factory and traits; expose concrete provider types only when needed.

### Executable (bin — collectors, workers, CLIs)

```text
src/
  main.rs      read config, start runtime/logging, handle shutdown, call the lib entry (no logic)
  lib.rs       module declarations — keep logic in the lib so it can be tested
  config/      config types and validation (mod.rs + types.rs)
  <job>/       one per job (e.g. collector/): cycle/step workflow (mod.rs), mapping rules (mapping.rs, ...)
  <adapter>/   clients for external services (e.g. backend/), shaped like the library layout
  heartbeat.rs, halt.rs — one named file per program-level concern
```

### Web service (HTTP API server)

```text
src/
  main.rs      config, DB pool, start server (no logic)
  app.rs       Router assembly: middleware order, then `.merge(<domain>::router())` per domain
  <domain>/    business unit (e.g. orders/, inventory/) — layered inside, see below
  http/        shared extractors (validated JSON/query/path), response shapes, middleware
  auth/        authentication, caller extractors, permission scopes
  errors.rs    domain error → HTTP response (status, body) in one place
  db/          pool, transaction helpers (migrations live at the repository root)
```

There is no crate-wide `routes/` folder: each domain owns its HTTP boundary.

#### Domain feature layout

Three layers per domain, called in one direction only: **handler → usecase → repository**.

```text
<domain>/
  mod.rs          submodule declarations and `pub fn router() -> Router<AppState>` (path table only)
  handler.rs      HTTP boundary
  usecase.rs      use cases
  repository.rs   SQL
  types.rs        domain types and enums shared by the layers
  constants.rs    fixed values (limits, page sizes, reserved ids) — optional
  dto/            API request/response shapes, when they no longer fit in types.rs — optional
```

| Layer | Owns | Does not contain |
|---|---|---|
| `handler` | Extracting the request, validating request objects (and the caller/permission), calling one use case, validating what goes out (response object contract, status), wrapping it in the HTTP response and mapping errors, audit-log wrapping | Business logic, building the response object from domain data, SQL, transactions |
| `usecase` | Business logic for one operation: transaction (begin/commit), lock order, rules, combining repository calls, **converting entities/records into the response object** (dto) | HTTP types (`StatusCode`, extractors, headers), SQL strings |
| `repository` | DB communication only: one function per query, taking a connection/transaction (`&mut PgConnection`) and returning `entity`/`record` types | `begin`/`commit`, business decisions, dto conversion, HTTP |

- Reads go through a use case too, even when it only calls one repository function — one rule, and a natural place for the next rule.
- **Every response object is built in the use case** — including batch results (per-item failure codes and messages), export rows (CSV columns and labels) and page metadata. The handler only turns that object into bytes and headers (JSON body, CSV encoding/BOM, `Content-Disposition`, status code) and maps errors to HTTP.
- `entity`/`record` types never reach the API: the use case converts them into the response dto (a `From` impl in `dto/` is fine — the use case calls it).
- The name is `usecase`, not `service`: in Axum `Service` is the tower trait, and "service" is often already a domain word (service accounts, sending services).

#### Splitting a layer into a folder

Turn a layer file into a folder of the same name when it passes ~250 non-test lines or mixes responsibilities (§4). Keep the folder names below so every domain reads the same.

```text
<domain>/
  handler/
    mod.rs        re-exports only
    get.rs        list / detail / export (GET)
    create.rs     POST that creates
    update.rs     PUT / PATCH
    delete.rs     DELETE or POST …/delete
                  (or action names for non-CRUD endpoints: cancel.rs, resend.rs, charge.rs)
  usecase/
    mod.rs        re-exports only
    <action>.rs   one file per use case or tight group (create.rs, cancel.rs, charge.rs)
  repository/
    mod.rs        re-exports only
    entity.rs     table row types — one struct per table, columns as stored (names, nullability)
    record.rs     SELECT result types — joined, aggregated or partial rows (`query_as!` targets)
    <group>.rs    queries grouped by what they read/write (orders.rs, search.rs, stock.rs)
    sql/          very long statements as .sql files (`sqlx::query_file!`), named like the function
  dto/
    request.rs    request bodies and query parameters (serde, validation attributes)
    response.rs   response bodies (serde names as in the API spec)
```

- `entity` vs `record`: an `entity` mirrors a table and is used for inserts/updates and whole-row reads; a `record` is whatever a particular SELECT returns. Do not widen an entity to fit a join — add a record.
- Split a long query out of a group file into its own file (or `sql/`) before splitting the group by tables.
- Types used by two or more layers stay in `types.rs` (domain enums, ids, value objects); request/response shapes go to `dto/`; plain fixed values go to `constants.rs`.

## 4. Split rules

1. **Split inside the feature folder first.** When a file passes ~250 non-test lines or mixes two or more responsibilities, split it into responsibility-named files.
   - Large `types.rs`: `request.rs`, `response.rs`, rule names (`pricing.rs`, `grouping.rs`); in a web service domain, request/response shapes go to `dto/` and fixed values to `constants.rs` (§3)
   - Large `mod.rs` workflow: step names (`detail.rs`, `batch.rs`, `session.rs`); `mod.rs` keeps entry points and step order only.
2. **Used by two or more features of the same parent → move to that parent's root** (e.g. a provider's `client.rs`, `session.rs`).
3. **Used by two or more parents → move to a crate-level shared module** (under `utils/`, named by role).
4. **Several files → make a folder** (`x.rs` → `x/mod.rs` + children). Children default to `pub(super)`.
5. Name modules by role. No `utils.rs`, `helpers.rs`, `common.rs`, `misc.rs` (the crate-level `utils/` folder is the only exception).
6. Move tests together with the code they cover.
7. If a file stays above ~250 lines unsplit, say why in the PR.

## 5. Long automation flows (browsers, multi-step auth)

- Shared tooling (e.g. `utils/selenium/`): one file per responsibility — session lifecycle (`mod.rs`), options, waits, cookies, error classification.
- Service-specific flows: one file per screen or step (`login.rs`, `email.rs`, `wait.rs`, `page.rs`); `mod.rs` holds only the lifecycle and step order. Keep fragile selectors in the screen file or a `selectors.rs`.
- If one screen grows again, turn only that screen into a folder.

## 6. Verification

A structure-only PR does not change behavior: the same tests pass in the same number, and every supported feature combination builds.
