# Rust Code Style

Shared code rules for Rust repositories (API client libraries, executables, web services). For module and file layout, see [CLEAN_ARCHITECTURE.md](CLEAN_ARCHITECTURE.md). When a repository's own docs differ from this guide, follow the repository. Anything not covered here follows the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).

- API rules are binding for **library** code (used by other crates) and a strong recommendation for **application** code, which favors directness over reuse.
- Tags say what enforces a rule: `[fmt]` rustfmt, `[lint: name]` a lint from [templates/lints.toml](templates/lints.toml) (CI fails), `[order]` the `code-order` script. An untagged rule is checked in review — that is where explanations stay.

## 1. Construction

- Build application types with `Type::new(..)` rather than struct literals at call sites. Keep fields private by default; put initialization rules in the type's `impl`.
- Validated construction is `try_new(..) -> Result<Self, Error>`. Do not panic.
- For many unrelated arguments, introduce a parameter type or a builder. An options struct with public fields implements `Default`.
- Entry points: `new` (explicit inputs), `Default` (a complete, meaningful default; required when `new` takes no arguments `[lint: new_without_default]`), `from_env` (environment config → `Result`), `From`/`TryFrom` (conversions). External responses are built by deserialization; do not add unused constructors.

## 2. Fixed values are enums

- Model statuses, modes, kinds and policies as enums, not strings or several bools. Accept the enum in function parameters too `[lint: fn_params_excessive_bools]`.
- Match external spelling with `#[serde(rename/rename_all)]`.
- Unknown external values: reject if accepting breaks a contract; `#[serde(other)] Unknown` if they can be ignored; `Other(String)` if the original is needed. **Never treat an unknown value as success or as eligible for a state change.**
- A library's public enum that may grow is `#[non_exhaustive]`; closed sets (`Visible`/`Hidden`) are not.
- Put an enum in the `types.rs` of the narrowest module that owns the concept; promote it to a shared domain module only when several features use it.

### Status values and constants

Keeps one value in one place, so a rename or a new variant cannot miss a copy.

- **Status values are enums with `sqlx::Type`** (`#[sqlx(type_name = "...", rename_all = "snake_case")]`), and reach SQL only as bind parameters (`.bind(OrderStatus::Paid)`, `$1`). Never write a status string in SQL (`WHERE status = 'paid'`) — CI greps for it ([templates/rust-ci.yml](templates/rust-ci.yml)). Migrations are the exception (types, defaults, `CHECK`, partial indexes).
- One test per such enum proves its spelling matches the DB ([templates/db_enum_test.rs](templates/db_enum_test.rs)).
- If a query is slow without the literal, add an index where it is needed; do not inline the value.
- Where each constant lives:

  | Value | Place |
  |---|---|
  | statuses, kinds | enum in the domain's `types.rs` |
  | used by one domain (limits, page sizes, reserved ids) | `src/<domain>/constants.rs` |
  | used by two or more domains | `src/constants.rs` — move it there when the second domain needs it (in a workspace: the shared `core` crate) |
  | error codes | `errors.rs` |
  | times (timeouts, intervals, TTLs) | `Duration` constants named by purpose: `const LOGIN_TIMEOUT: Duration = Duration::from_secs(10);` |

- **Same value, different meaning → separate constants.** `PAGE_SIZE = 50` and `MAX_BATCH = 50` stay apart; merging them couples two decisions.

## 3. Ownership and visibility

- Borrow when only reading — `&str`, `&[T]`, `&T`, `Option<&T>`, not `&String`, `&Vec<T>`, `&Box<T>` `[lint: ptr_arg, borrowed_box]`; take owned values when storing or consuming. Clone only with a reason.
- Use the narrowest visibility: private → `pub(super)` → `pub(crate)` → `pub`. Do not generate a getter and setter for every field.
- Use `Arc`/`Mutex` only for genuinely shared state, not to avoid designing ownership.

## 4. Naming

- Types and variants `UpperCamelCase`, functions and fields `snake_case`, constants `SCREAMING_SNAKE_CASE` `[lint: rustc default]`.
- Name by role: `CreateOrderRequest`, `OrderPage`, `OrderStatus`, `RetryPolicy`. Drop prefixes that repeat the module name. No abbreviations an outsider would not know.
- Conversions: `as_*` (borrowed view), `to_*` (non-consuming), `into_*` (consuming) `[lint: wrong_self_convention]`. Accessors: `foo()`, `foo_mut()`, `set_foo()`, `take_foo()`.
- No `_` prefix on private functions; name them after what they do.

## 5. Errors

- `Option` when the cause is obvious, `Result` for recoverable failures, `panic!` only for bugs (broken invariants). A result alias (`type XResult<T>`) is fine when used consistently at one boundary.
- No `unwrap` outside tests `[lint: unwrap_used]`. `expect("why this holds")` only for invariants evident from the code — never for environment variables, input, external responses or network calls. Prefer `if let`/`let else` over check-then-unwrap `[lint: unnecessary_unwrap]`.
- Split errors when callers react differently: configuration, authentication (re-login vs. bad credentials), invalid data, business rejection, transport failure, and **unknown outcome of a state change** (lost response). Decide the reaction for each error (stop / re-login / retry) in one place.
- Keep the cause chain (`source()`) and show it when displaying the error. Never put secrets in messages.
- Retry state-changing requests only when idempotent or reconcilable. Validate a batch before the first request; never count missing, duplicated or unrecognized results as success.

## 6. Boundaries (external representations)

- Use typed request/response models for stable external contracts (HTTP APIs, DB rows, messages). Keep spelling differences in serde attributes and boundary conversions, not string keys scattered through workflows.
- Use dynamic JSON (`serde_json::Value`) only for genuinely variable data or deliberately raw access, and convert to types before making decisions. When a fetched document must be sent back unchanged, type only the fields you use and keep the rest in `#[serde(flatten)] rest: Map`.
- Never log passwords, tokens, cookies, one-time codes or personal data. Log the stage and the context needed for diagnosis.

## 7. Imports and item order

- No glob imports, except `use super::*` in test modules `[lint: wildcard_imports]`. Import types and traits by name; call free functions from other modules through their module (`mem::swap(..)`).

Top-level items in a file follow this order `[order]` (checked and applied by the `code-order` skill, `scripts/rust.mjs`):

1. Inner docs and attributes (`//!`, `#![...]`), `extern crate`
2. `mod` declarations
3. `use`, in blank-line-separated groups: `std`/`core`/`alloc` → external crates → `crate`/`super`/`self`/this file's modules → `pub use` re-exports
4. `macro_rules!`, then `const`/`static`, then `type` aliases (shared types normally live in `types.rs`). A `macro_rules!` is visible only below its definition, so compiling wins over this order: a `use` of a macro defined in the file (`pub(crate) use my_macro;`) follows that macro, and a macro written above a `mod` declaration stays above the mods.
5. One block per type, in the order the types are defined: definition (`struct`/`enum`/`trait`, or a macro call that declares exactly one, like `string_enum! { pub enum Kind { .. } }`) → inherent `impl` → trait `impl`s → free functions those items call (transitively, in first-use order). An `impl` of a type defined elsewhere forms its own block; a local trait's impl for an outside type follows the trait.
6. Free functions no block uses, then non-test inline modules, then `#[cfg(test)] mod tests` last

Most files hold one main type, so this reads as: imports → constants → the type → its impls → its helpers → tests.

A plain comment followed by a blank line is a section heading (e.g. `// ---------- carriers ----------`), not part of the next item: it stays where it is and the order above applies within each section. A comment directly above an item (no blank line) moves with that item. A file with many sections usually wants splitting by section instead.

## 8. Code, docs, tests, verification

- Format with `rustfmt` defaults `[fmt]`; `#[rustfmt::skip]` only for deliberate alignment or generated code. Separate declarations and implementations with blank lines.
- Prefer a `for` loop over long or side-effecting combinator chains and `for_each` `[lint: needless_for_each]`; bind a chain to a named variable before looping over it. No `dbg!`/`todo!` in committed code `[lint: dbg_macro, todo]`.
- `unsafe` only when safe code cannot do it, wrapped in a safe API, with a `// SAFETY:` comment `[lint: undocumented_unsafe_blocks]`.
- Doc comments (`///`) for public contracts, failure conditions (`# Errors`, `# Panics`) and side effects `[lint: missing_docs, missing_errors_doc, missing_panics_doc — libraries]`; plain comments for decisions and constraints the code cannot express. Do not restate the name.
- Test behavior, not implementation details: for boundary types, serialized field names, enum values, numeric vs. string representation, required fields and unknown values; for workflows, failure paths, partial results and mutation outcomes. Give `assert!` a message when the reason is not obvious.
- Keep tests that need live services, credentials or real state changes apart from routine tests (e.g. `#[ignore]`). Report only checks that were actually run.
- Split a long function into named steps `[lint: too_many_lines]` (threshold in [templates/clippy.toml](templates/clippy.toml)).
- Before renaming, moving or deleting a public item, find its references with rust-analyzer (LSP "find references") if it is installed, then grep for what LSP cannot see (macro input, SQL files, docs, other repos).
- Checks (same as [templates/rust-ci.yml](templates/rust-ci.yml)): `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` (supported feature combinations), `cargo test --workspace`, status literal grep, `code-order` script.

## 9. Macros

- Use derive and attribute macros from established crates where the type is the contract: `serde` at boundaries (§6), `thiserror` for error enums (§5), `clap` for command-line arguments (doc comments become the help text). Test the representation they produce, not the generated code.
- Write your own macro only when a function, generic or trait cannot remove the repetition (the same `impl` for many types, compile-time checks of literals). Prefer `macro_rules!` over a proc-macro crate.
- Keep macros in the framework layer: in the module that owns the pattern (or one `macros.rs`), `pub(crate)`. Feature and application code calls macros; it does not define them.
- Libraries: `#[macro_export]` only when the macro is meant to be public API — it then becomes part of the semver surface.
- Document on the macro what it generates. A macro call that declares items follows item order (§7).
