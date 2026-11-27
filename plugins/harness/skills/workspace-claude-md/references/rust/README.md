# Rust repo CLAUDE.md — entry point

Read this first for any Rust repo, then **every** sub-doc that matches the repo's shape:

| Shape | Signs | Read |
|---|---|---|
| Library crate | `[lib]` only, used by other crates or repos | [lib/README.md](lib/README.md) |
| Executable — collector, worker, CLI | `src/main.rs`, no HTTP server | [bin/README.md](bin/README.md) |
| HTTP API server | Axum (or another web framework) in dependencies | [server/README.md](server/README.md) |
| Workspace | `[workspace]` in the root `Cargo.toml`, `crates/*` | each member's doc (e.g. server + worker → `server/` + `bin/`; `core`, `repository` → `lib/`) |

**One deploy unit → one crate. Two or more (server + worker, API + scheduled collector) → one Cargo workspace in one repo** (`crates/`), not separate repos for DB and server code. Layout and dependency rules: harness `docs/rust/CLEAN_ARCHITECTURE.md` §7 "Workspace". For a new repo, ask the user which deploy units exist before picking.

## Common to every Rust repo

- **Toolchain**: Rust 1.99 (edition 2024), host or Docker `rust:1.99-bookworm` (check `cargo --version`; without host Rust, write Docker commands).
- **Code rules**: write only one line in CLAUDE.md pointing to them, plus this repo's exceptions — never copy rule text:
  `Code rules: harness docs/rust/CODE_STYLE.md and CLEAN_ARCHITECTURE.md (docs/REPO_ARCHITECTURE.md wins for layout). Exceptions: <none | …>.`
- **Lints**: if `Cargo.toml` has no `[lints]` (or `[workspace.lints]`) table and there is no `clippy.toml`, **suggest** applying harness `docs/rust/templates/lints.toml`, `clippy.toml` and `rust-ci.yml` (the comments in each say how, including the workspace form). It changes the repo's code checks, so it goes through the repo's issue/PR flow after the user agrees; CLAUDE.md does not wait for it.
- **Checks** (same as `verify` in `.claude/github-issue.yml`): `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` (workspace: `cargo clippy --workspace --all-targets -- -D warnings`), `cargo test` (workspace: `--workspace`).
- **Refactoring check order** — cheapest and most exact first:
  1. `cargo clippy` with the template lints (long functions, unwraps, globs …)
  2. rust-analyzer, if installed: find references (LSP) before renaming, moving or deleting a public item; grep only after
  3. `/ponytail-audit` for meaning-level duplication and design (refactoring only — not per task or PR, it is costly)
  4. Graphify only when the module graph itself is the question; write its output under `/tmp`, never into the repo

## Snippet for the repo CLAUDE.md

Every Rust repo CLAUDE.md gets these lines (the shape doc adds its own sections):

````markdown
## Code rules

Code rules: harness `docs/rust/CODE_STYLE.md` and `CLEAN_ARCHITECTURE.md` (`docs/REPO_ARCHITECTURE.md` wins for layout). Exceptions: <none | …>.

## Checks

| Command | What |
|---|---|
| `cargo fmt --check` | format |
| `cargo clippy <--workspace> --all-targets -- -D warnings` | lint (`[lints]` in `Cargo.toml`, `clippy.toml`) |
| `cargo test <--workspace>` | tests |

Refactoring: clippy → rust-analyzer find references (if installed) → `/ponytail-audit` → Graphify only if needed (output in `/tmp`).
````
