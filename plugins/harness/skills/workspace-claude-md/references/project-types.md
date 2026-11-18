# Project types

What changes in CLAUDE.md for each kind of multi-repo project. A project can be more than one (re-engineering that also migrates a production DB): apply both.

## New service (including prototypes)

Signs: no legacy source, `docs/product/` (definition, persona, feature spec, scenarios) written first, maybe `docs/design/`.

- **Sources of truth**: `docs/product` → `docs/design` → code. Decisions not made yet are `TBD`, never guessed.
- **Mock first**: frontend builds every screen against MSW before the API exists; the API contract (`docs/product/ApiSpec.md` or `API_SPEC.md`) is what both sides code against. A screen needing something the contract lacks → propose a contract change, don't invent it in the client.
- **Schema**: one schema source (`db/init.sql` or the backend's migrations — pick one and say which). Seed data for dev is fake or anonymized.
- **Prototype scope**: say explicitly what is out of scope (auth hardening, scaling, analytics) so sessions do not gold-plate. Security basics (secrets out of git, server-side validation, auth on every API) are never out of scope.
- **Feature requests**: if features are added via request docs (`docs/feature/FR_*.md`), say where they live and that a feature starts from one.

## Re-engineering / upgrade (legacy → new stack)

Signs: a legacy folder (Spring Boot `build.gradle`/`pom.xml`, PHP, older Python), `analysis/` with source map / feature inventory / As-is specs, `.claude/reverse-engineering/` or similar rules.

- **Two document sets, never mixed**: `analysis/` = As-is (what the old system does, with evidence), `docs/` = To-be (what we build). As-is behavior is evidence, not a requirement — especially security gaps.
- **Sources of truth**: user decisions + mandatory security requirements (e.g. `target-stack.md`, `SR-*`) → `docs/product` → `docs/design` → `analysis/`.
- **Legacy is read-only**: never modify; never copy credentials found there (treat them as exposed).
- **Who writes `analysis/`**: only the reverse-engineering workflow. Other tasks report conflicts instead of editing it.
- **Same database?** If the new system reuses the existing DB, schema names/types/enum values are constraints; schema changes are explicit migrations with a decision recorded.
- **Cutover**: where the cutover plan lives (`docs/operation/Migration.md`) and what must be true before switching (data checks, parallel run, rollback).

## Migration (data / server / schema)

Signs: production DB copy in a local container, migration SQL folders, `migrate.sh`/apply scripts, checklists, deploy runtime examples.

- **Production data locally**: say which container has it and the snapshot date. Any code path that calls real external APIs (payment, messaging, sales channels, partner APIs) affects production — confirm with the user before running it.
- **Migration files**: naming (`YYMMDD_NN_name.sql`), where new ones go, how they are applied and recorded (`schema_migrations`, sqlx `_sqlx_migrations`), which old files are superseded or skipped and why. Applied files are never edited (checksums, and other DBs already ran them).
- **Line endings**: `.sql`/`.sh` pinned to LF in `.gitattributes` — CRLF breaks scripts in Linux containers and changes sqlx checksums.
- **Proof of completeness**: rebuild an empty DB from the files and diff `pg_dump -s` against the current DB; note the known differences (unused legacy tables) in CLAUDE.md.
- **Before production**: precheck queries, backup command, approval by the user.

## Refactoring (same stack)

Signs: one or more existing repos, no new stack, issues labeled refactor.

- **Behavior is preserved**: record the baseline (test count, passing checks) before starting; the PR shows the same or more tests passing.
- **Scope**: one concern per issue; no drive-by changes in other folders.
- Point to the language guides (`harness` `docs/<lang>/CODE_STYLE.md`, `CLEAN_ARCHITECTURE.md`) instead of restating rules.
