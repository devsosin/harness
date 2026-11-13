# Rust Code Style

Shared code rules for Rust repositories (API client libraries, executables, web services). For module and file layout, see [CLEAN_ARCHITECTURE.md](CLEAN_ARCHITECTURE.md). When a repository's own docs differ from this guide, follow the repository.

## 1. Construction

- Build application types with `Type::new(..)` rather than struct literals at call sites. Keep fields private by default; put initialization rules in the type's `impl`.
- If construction needs validation, `new` returns `Result<Self, Error>`. Do not panic.
- For many unrelated arguments, introduce a parameter type or a builder.
- Entry points: `new` (explicit inputs), `Default` (a complete, meaningful default), `from_env` (environment config, fallible → `Result`), `From`/`TryFrom` (conversions). External responses are built by deserialization; do not add unused constructors.

## 2. Fixed values are enums

- Model statuses, modes, kinds and policies as enums, not strings or several bools. Accept the enum in function parameters too.
- Match external spelling with `#[serde(rename/rename_all)]`.
- Unknown external values: reject if accepting breaks a contract; `#[serde(other)] Unknown` if they can be ignored; `Other(String)` if the original is needed. **Never treat an unknown value as success or as eligible for a state change.**
- Put an enum in the `types.rs` of the narrowest module that owns the concept; promote it to a shared domain module only when several features use it.

## 3. Ownership and visibility

- Borrow (`&str`, `&[T]`) when only reading; take owned values (`String`, `Vec<T>`) when storing or consuming. Clone only with a reason.
- Use the narrowest visibility: private → `pub(super)` → `pub(crate)` → `pub`. Do not generate a getter and setter for every field.
- Use `Arc`/`Mutex` only for genuinely shared state.

## 4. Naming

- Types and variants `UpperCamelCase`, functions and fields `snake_case`, constants `SCREAMING_SNAKE_CASE`.
- Name by role: `CreateOrderRequest`, `OrderPage`, `OrderStatus`, `RetryPolicy`. Drop prefixes that repeat the module name.
- Conversions: `as_*` (borrowed view), `to_*` (non-consuming conversion), `into_*` (consuming).
- No `_` prefix on private functions; name them after what they do.

## 5. Errors

- Return `Result` for recoverable failures. A result alias (`type XResult<T>`) is fine when used consistently at one boundary.
- `unwrap`/`expect` only in tests or for invariants evident from the code — never for environment variables, input, external responses or network calls.
- Split errors when callers react differently: configuration, authentication (re-login vs. bad credentials), invalid data, business rejection, transport failure, and **unknown outcome of a state change** (lost response). Decide the reaction for each error (stop / re-login / retry) in one place.
- Keep the cause chain (`source()`) and show it when displaying the error. Never put secrets in messages.
- Retry state-changing requests only when idempotent or reconcilable. Validate a batch before the first request; never count missing, duplicated or unrecognized results as success.

## 6. Boundaries (external representations)

- Use typed request/response models for stable external contracts (HTTP APIs, DB rows, messages). Keep spelling differences in serde attributes and boundary conversions, not string keys scattered through workflows.
- Use dynamic JSON (`serde_json::Value`) only for genuinely variable data or deliberately raw access, and convert to types before making decisions. When a fetched document must be sent back unchanged, type only the fields you use and keep the rest in `#[serde(flatten)] rest: Map`.
- Never log passwords, tokens, cookies, one-time codes or personal data. Log the stage and the context needed for diagnosis.

## 7. Docs, tests, verification

- Format with `rustfmt`. Separate declarations and implementations with blank lines.
- Doc comments (`///`) for public contracts, failure conditions and side effects; plain comments for decisions and constraints the code cannot express.
- Test behavior, not implementation details: for boundary types, serialized field names, enum values, numeric vs. string representation, required fields and unknown values; for workflows, failure paths, partial results and mutation outcomes.
- Keep tests that need live services, credentials or real state changes apart from routine tests (e.g. `#[ignore]`). Report only checks that were actually run.
- Default checks: `cargo fmt --check`, `cargo check --all-targets` (supported feature combinations), `cargo test`, `cargo clippy --all-targets`.
