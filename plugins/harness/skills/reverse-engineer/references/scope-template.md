# `.claude/reverse-engineering/scope.md` template

On the first run the skill drafts from this template and has the user confirm it. Draft sources: the output of `workspace-claude-md`'s `workspace-map.mjs` (repos, stacks), README, existing `analysis/`.

```markdown
# Reverse-engineering scope

## Source roots (read-only)

| Path | Stack | Role | Analyze |
|---|---|---|---|
| `<legacy-app>/` | <Spring Boot 2.7, Thymeleaf> | <back office web app> | all |
| `<legacy-client>/` | <Python order client> | <collects store orders, calls the app> | integration evidence only (`Inferred` + pointer) |
| `<shared-lib>/` | <Rust crate> | <third-party API client> | <only usage lookup and cancel> |

## Rebuild scope

- <What is rebuilt: whole app / admin frontend only / API only>
- <What stays: e.g. server changed minimally, DB schema unchanged>
- Out of scope: <features, integrations, folders not analyzed>

## Evidence options

- ERD material: <path(s) or "none">; default mode `erd=<reference>`
- Schema source: <`schema=db/schema.sql` (pg_dump --schema-only) | migration SQL folder | none>
- Other docs: <existing specs, third-party API docs (paths)>

## Domain codes

| Code | Domain |
|---|---|
| <INV> | <coupon inventory> |
```

`target-stack.md` is written by the user. Template:

```markdown
# Target stack — user decisions

Authoritative. Command-argument stack statements override this file (recorded in `docs/product/TechStack.md`). Anything not listed is `TBD` or `Requires decision`.

## Decisions
| Area | Decision |
|---|---|
| Frontend | <React + TypeScript, Vite SPA …> |
| Backend | <Rust, Axum> |
| Database | <reuse existing DB / new PostgreSQL> |
| Data access | <SQLx> |
| Authentication | <JWT in HttpOnly cookies, lifetimes …> |
| Deployment | <…> |
| Secret storage | <…> |

## Implications
<consequences of the decisions above: schema additions decided, compatibility constraints>

## Security requirements (mandatory)
| ID | Requirement |
|---|---|
| SR-01 | … (start from security-baseline.md; remove only what does not apply, with the reason) |
```
