# Rust Project Structure

Shared module and file layout rules for Rust repositories. For code rules, see [CODE_STYLE.md](CODE_STYLE.md).

> **The repository's own document comes first.** If a repository has `docs/REPO_ARCHITECTURE.md`, read it first for the actual structure (module list, per-service folders, exceptions) and use this guide for anything it does not cover. If they disagree, follow `REPO_ARCHITECTURE.md`.

## 1. Principles

- **Dependencies point inward.** Domain types do not know external formats (HTTP responses, DB rows, screens). Conversion between an external format and the domain lives in the `types.rs` of the module that talks to that external system (the adapter).
- **Keep entry points thin.** `main.rs`, HTTP handlers and trait implementations take input, call the workflow and return the result.
- **Group by feature (domain)**, not by layer (`models/`, `services/`, `controllers/`) first.
- **Share only what two or more places actually use.** Otherwise keep it where it is used.
- Create a file only for a clear responsibility. A small feature can be a single `mod.rs`.

## 2. Feature folder (all shapes)

| File | Owns | Does not contain |
|---|---|---|
| `mod.rs` | Entry points (trait impls, public functions) and the workflow: ordering, retries, concurrency, collecting results | Wire types, request body assembly details |
| `types.rs` | Request/response DTOs (serde), external ↔ domain conversion, local validation, the feature's enums | Network or DB calls |

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
  main.rs      config, DB pool, router assembly, start server
  routes/      HTTP boundary, one file per path group: parse/validate → call domain → map response (no SQL, no business rules)
  <domain>/    business unit (e.g. orders/): mod.rs (use cases), types.rs, repo.rs (queries), rule-named files
  db/          pool, migrations, transaction helpers
  errors.rs    domain error → HTTP response (status, body) in one place
  auth/        authentication, middleware
```

## 4. Split rules

1. **Split inside the feature folder first.** When a file passes ~250 non-test lines or mixes two or more responsibilities, split it into responsibility-named files.
   - Large `types.rs`: `request.rs`, `response.rs`, rule names (`pricing.rs`, `grouping.rs`)
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
