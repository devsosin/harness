# Library crate CLAUDE.md

For API client libraries and other crates used by other crates or repos. Common parts (toolchain, lints, checks, refactoring order) come from [../README.md](../README.md). Layout: harness `docs/rust/CLEAN_ARCHITECTURE.md` §3 "API client library".

## Rules to write

- **Public API is a contract**: every `pub` item is used by someone else. Renaming or removing one is a breaking change — find its references in the dependent repos first and bump the version.
- **Doc comments** on every public item, with `# Errors` / `# Panics` where they apply. Turn on the library-only lints commented in `lints.toml` (`missing_docs`, `missing_errors_doc`, `missing_panics_doc`).
- **Versions and tags**: version in `Cargo.toml` follows semver; each release is a git tag `v<x.y.z>`. Dependents pin a git `rev` (or tag) and commit `Cargo.lock`; they update through their own issue/PR, not by editing this repo.
- Growing public enums are `#[non_exhaustive]` (CODE_STYLE §2).
- Tests that call live services stay `#[ignore]`.

## Template

````markdown
# <crate> — <one line: what it wraps or provides>

Used by: <repos / crates>. Workspace context: <folder> in <workspace>; paths outside this repo are *(workspace)*.

## Public API

- Entry: <factory / traits callers use>. Concrete provider types are <exposed | private>.
- Breaking changes: bump the version, tag `v<x.y.z>`, list dependents to update: <repos>.

<Code rules + Checks snippet from rust/README.md>

## Tests

- `cargo test` — unit and recorded-response tests. Live calls: `cargo test -- --ignored` (needs <KEY names>, confirm with the user first).
````
