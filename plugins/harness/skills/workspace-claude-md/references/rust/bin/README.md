# Executable CLAUDE.md — collectors, workers, CLIs

For programs started by a scheduler, a container or a person, without an HTTP API. Common parts (toolchain, lints, checks, refactoring order) come from [../README.md](../README.md). Layout: harness `docs/rust/CLEAN_ARCHITECTURE.md` §3 "Executable".

## Rules to write

- **Thin `main.rs`**: read config, start runtime and logging, handle shutdown, call the lib entry. Logic lives in `lib.rs` modules so it can be tested.
- **Config**: environment variables (`from_env`, fail fast on a missing key) or `clap` arguments. List key names only; values stay in `.env` / SSM.
- **Exit codes**: `0` success; non-zero on failure so the scheduler or container restarts or alerts. Write which codes mean what if more than one.
- **Retries**: only idempotent or reconcilable steps; bounded attempts with backoff; an unknown outcome of a state change is reported, never retried blindly (CODE_STYLE §5).
- **Shutdown**: on SIGTERM finish or abandon the current unit safely; say which.
- **Real external calls** (sales channels, messaging, payment): confirm with the user before running against them.

## Template

````markdown
# <name> — <collector | worker | CLI>: <one line>

Runs: <cron / container / by hand>, every <interval>. Workspace context: <folder> in <workspace>.

## Run

| Command | What |
|---|---|
| `cargo run -- <args>` | <one cycle / dry run> (needs `.env`: <KEY names>) |

Exit codes: `0` ok, `1` <failure>, <…>. Retries: <which steps, how many, backoff>.

<Code rules + Checks snippet from rust/README.md>
````
