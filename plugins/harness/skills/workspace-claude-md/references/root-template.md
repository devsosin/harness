# Root CLAUDE.md template

The workspace root's CLAUDE.md. Sections marked *(required)* are always written; drop the others when they do not apply. Replace every `<…>`. Keep it under ~150 lines — link to `docs/` instead of copying.

Sources this template was distilled from: a re-engineering project (Spring Boot → React SPA + Rust/Axum on the existing DB), a migration project (admin rebuild on a production-data copy), and a prototype (new service, Next.js + API + admin).

````markdown
# <Project name>

<1–3 sentences: what the product does, for whom. Project type (new service / re-engineering of <legacy> / migration / refactor). As-is → To-be in one line if it applies.>

This folder is **not** a git repository; the folders below are separate repositories. Run `git` inside each one.

## 1. Workspace layout *(required)*

```text
/
├── backend/        # New Rust/Axum API (owner/backend-repo)
├── frontend/       # New React SPA (owner/frontend-repo)
├── <legacy>/       # Existing system — read-only reference, never modify
├── db/             # init.sql (schema baseline), seed.sql (anonymized sample)
├── analysis/       # As-is: reverse-engineering output (written only by `harness:reverse-engineer`)
└── docs/
    ├── product/    # To-be features (F-*), scenarios, TechStack, API spec
    ├── design/     # BASE (design system), pages/, components/
    └── operation/  # cutover, migration checklist
```

| Folder | Git repo | Role | Notes |
|---|---|---|---|
| `backend/` | `<owner>/<repo>` | API | own CLAUDE.md |
| `frontend/` | `<owner>/<repo>` | web app | own CLAUDE.md |
| `<shared-crate>/` | `<owner>/<repo>` (private) | client library used by backend | edited by other sessions too: `git pull --ff-only` before editing |
| `<legacy>/` | `<owner>/<repo>` | As-is source | read-only |
| `docs/` | — | planning docs | |

Not in this folder but needed for <build>: `<repo>` — clone next to `<x>/` (see `<Dockerfile path>`).

## 2. Sources of truth *(required)*

When documents disagree, follow this order and report the conflict instead of silently picking one:

1. <user decisions + security requirements, e.g. `.claude/reverse-engineering/target-stack.md` (SR-*)>
2. `docs/product/` — features, scenarios, open questions (Q-*)
3. `docs/design/` — screens and components
4. <`analysis/` — evidence of existing behavior only; never a requirement (especially its security gaps)>
5. Code — what actually runs; if code and docs differ, ask which is right.

## 3. Scope of changes *(required)*

- Backend tasks → `backend/`; frontend tasks → `frontend/`. Touch other folders only when the task says so.
- Never modify `<legacy>/` (read-only reference).
- Generated files are regenerated with their tool, never edited by hand: `<.sqlx/>`, `<lockfiles>`, `<fixtures/*.generated.json>`.
- Update `docs/` in the same task when requirements, screens, or APIs change. Keep IDs stable (mark removed items; do not renumber).

## 4. Build & test *(required)*

<Host has no Rust → everything Rust runs in Docker (`rust:1.99-bookworm`). Node <24> and pnpm on the host.> In Git Bash, prefix container paths with `MSYS_NO_PATHCONV=1`.

| Repo | Check (same as `.claude/github-issue.yml` `verify`) |
|---|---|
| `backend/` | `docker compose -p <task-id> -f docker-compose.dev.yml run --rm rust cargo test` |
| `frontend/` | `pnpm typecheck && pnpm lint && pnpm test` |

- Dev/test containers are per task: `docker compose -p <task-id> …`, so parallel sessions do not share or overwrite each other's containers. Remove them when the task ends (`harness:cleanup`).
- <DB tests need data: which DB, which tests, how they roll back.>

### Local databases

| Container | Port | Data | Purpose |
|---|---|---|---|
| `<name>` | `127.0.0.1:<port>` | <empty schema / anonymized seed / production copy (date)> | <tests / manual checks> |

- Recreate from scratch: <command or steps; which migration files, in which order, which ones to skip and why>.
- <If production data: the server calls real external APIs (<payment, messaging, sales channel>) — confirm with the user before any real call.>

## 5. Workflow *(required)*

- Issue → branch → PR per repo (harness skills: `github-issue`, `implement`, `github-pr`). Never commit to the default branch.
- Commits and PR titles: English summary + issue ID. Issue and PR bodies: <Korean>.
- Secrets: `.env` is never committed (only `.env.example` with key names). Never write values, accounts, or tokens into logs, commits, PRs, or chat.

## 6. Documentation

- Prose in <Korean>; code identifiers, paths, endpoints, IDs, config keys stay as they are.
- Each spec has a version line; bump it and add a change-log row when you change it.
- Record user decisions in the open-questions table of `<docs/product/FeatureSpec.md §N>`, not only in chat.

## 7. Security

- <Every SR-* in <file> applies even where the legacy system does not meet it.>
- Credentials found in legacy config are treated as exposed: never copy or reuse them.

## 8. Sessions & plans

<Where the work plan / session order / progress table lives (e.g. `frontend/CLAUDE.md` §Work Plan, `docs/SESSION-SUMMARY.md`). Read it before starting; update it before ending.>
````

## Notes for filling it in

- **§1 tree**: pick the lines a new session needs; don't paste the whole script output. One comment per line. Mark read-only folders in the tree and the table.
- **§1 table "Notes"** is where cross-session hazards go: shared crates other sessions edit, folders that are git repos without a remote, things that must be cloned from elsewhere.
- **§2**: the order differs by project type — see project-types.md. A prototype often has only `docs/product` → code.
- **§4**: every command must have been run on this machine, or carry `(not verified: <why>)`. Prefer the `verify` list from `.claude/github-issue.yml` so the two never drift.
- **Recreate-from-scratch** steps are worth writing even when nobody asked: they prove the migration files are complete (diff `pg_dump -s` of the rebuilt DB against the current one) and they let a session make a throwaway DB instead of writing to the shared one.
- Leave out what a session can read from code in seconds (module lists inside a repo, dependency versions). Keep what it cannot: why a folder is read-only, which document wins, which DB holds production data.
