# STEP 1–8

Each section: input (stop if missing) → work → output structure → report. Common rules (evidence, confidence, IDs, safety, As-is/Required) are in SKILL.md §3. If output already exists, edit it and keep existing IDs and user-written content.

- [STEP 1 Source map](#step-1--source-map)
- [STEP 2 Feature analysis](#step-2--feature-analysis)
- [STEP 3 Feature spec](#step-3--feature-spec)
- [STEP 4 Data model](#step-4--data-model)
- [STEP 5 API spec](#step-5--api-spec)
- [STEP 6 Screen spec](#step-6--screen-spec)
- [STEP 7 Tech stack](#step-7--tech-stack)
- [STEP 8 Review and final report](#step-8--review-and-final-report)

## STEP 1 — Source map

Input: the source roots in `scope.md`. If missing, find them via build files (`build.gradle`, `pom.xml`, `package.json`, `Cargo.toml`, `composer.json`, `pyproject.toml`) and state the paths used.

Work:
1. Structure, build, runtime versions, main dependencies; entry points, modules, config files.
2. Endpoints by domain: kind (`JSON API` · `Page` · `Form submit` · `Webhook`), handler, auth and authorization requirements.
3. **Callers**: where templates, JS or other repos' code call each endpoint (`file:line`); if none, `No caller found in this repository` (not proof that it is unused).
4. Cross-cutting concerns: filters, interceptors, middleware, AOP, global exception handling.
5. Persistence: DB, schema management (ORM auto-generation, Flyway, SQL files, none), DDL and migration locations.
6. ERD and schema material: images, `.sql`, `.dbml`, `.drawio` etc. in `docs/` and the whole repo. Open images. Record only location, format and entities covered; comparison is STEP 4.
7. External integrations, scheduled jobs, events and async processing.
8. Trace a few representative features through every layer. Also note generated and apparently unused code (do not assume it can be deleted).
9. Set the domain codes.

Output `analysis/source-map.md`: overview · assumptions of this run (differences from scope, options) · module responsibilities · domain codes · endpoint list (method, path, kind, handler, auth, callers) · core entities · ERD/DDL material · security and integration overview · feature candidates · risks and open questions.

Report: counts of endpoints, entities, feature candidates; ERD material; big risks.

## STEP 2 — Feature analysis

Input: `source-map.md` (else STEP 1 first).

For each feature candidate, follow entry point to data access and fill 12 items: ① purpose and result ② actor and entry point ③ preconditions and permissions ④ input and validation ⑤ processing order ⑥ business rules and calculations ⑦ data created, updated, deleted, read ⑧ state transitions and transaction boundaries ⑨ success response and resulting state ⑩ failure conditions, error responses, side effects ⑪ related features, APIs, entities ⑫ evidence and open questions.

Easy to miss: ownership limits, implicit defaults, pagination, soft delete, duplicate handling, concurrency, the difference between validation errors and business rule failures. Where failures arise (binding validation, service checks, global handler, DB constraints) and their responses (status code, body, redirect, re-rendered page). Security defects go in as As-is with the related SR.

Output `analysis/feature-inventory.md`: 12 items per feature ID, user features vs internal/operational features. At the end, candidates merged or dropped and why.

Report: feature count per domain, open question count.

## STEP 3 — Feature spec

Input: `feature-inventory.md` (else STEP 2 first), `source-map.md`, the source for anything uncertain.

Write observable product behavior, independent of the legacy implementation technology. Several endpoints serving one goal are one feature. Both success and failure paths. Do not describe how the new stack implements it.

```markdown
# Feature Specification
## 1. Product Overview — purpose, capabilities, actors, domain concepts
## 2. Feature Index — | Feature ID | Name | Description | Actor | Domain/API | Confidence |
## 3. Feature Details — per feature: purpose · actor & preconditions · trigger · input & validation · main flow · business rules · data changes & state transitions · success · failure & errors · authorization (As-is / Required) · related · evidence · open questions
## 4. Cross-Cutting Rules — auth (As-is / Required + SR), validation & errors, shared rules, integrations & async
## 5. Unknowns and Open Questions — unverified, conflicting evidence, missing systems, decisions needed
```

Report: feature count (user/internal), open question count.

## STEP 4 — Data model

Input: `source-map.md` (with the ERD material list), `feature-inventory.md`, entities, enums, repositories (custom queries), persistence config, the `erd=` and `schema=` options.

1. Data model from code (entities, mappings, SQL): fields, relations, enums, constraints, lifecycle.
2. If ERD material exists and the mode is not `ignore`, compare per entity and field.
   - `reference` (default): code is authoritative; ERD differences go in §4.
   - `as-is`: the ERD is authoritative; code differences go in §4. Differences that would change the existing schema are `Requires decision`.
   - `ignore`: only note in §1 that it exists.
3. With `schema=`, treat it as the authority for the physical schema and compare it with code (and the ERD). Without it, physical names and types are `Verified` only when confirmed by explicit mappings or DDL, otherwise `Inferred`.
4. Anything not clearly readable from an image is `Unknown`.

```markdown
# Data Model
## 1. Sources and Mode — ERD found & mode, schema dump, what is authoritative
## 2. Entity Overview — | Entity | Table | Purpose | Feature IDs | Confidence | + Mermaid erDiagram if useful
## 3. Entity Details — columns (field, column, type → DB type, null, unique, default, length), PK & ID generation, relationships (cardinality, FK/join table, cascade), enums (values + storage), indexes & unique, soft delete/audit/timestamps, state transitions (→ feature IDs), evidence
## 4. Differences: ERD / Code / Schema — | Item | ERD | Code | Schema | Followed | Confidence |
## 5. Existing Database Compatibility — naming, ID generation, enum storage values, date/time & time zone, decimal, boolean/LOB, tables only in the DB, constraints only in code
## 6. Open Questions
```

Do not design new tables or columns. Point to FeatureSpec for business rules. Do not connect to the DB.

Report: entity count, ERD mode and difference count, items needing decisions.

## STEP 5 — API spec

Input: `FeatureSpec.md` (feature IDs; else STEP 3 first), `source-map.md`, `feature-inventory.md`, `DataModel.md` (if present), controllers, DTOs, forms, validation, exception handling, response wrappers, calling templates and scripts.

Scope: `JSON API`, `Form submit`, `Webhook`. `Page` is STEP 6.

Per endpoint: ① API ID, method, path, kind ② feature ID and purpose ③ request (path, query, headers, body/form fields: name, type, required, validation, default, nesting) ④ success response (status, body field table, or redirect/view) ⑤ error responses (status, condition, body, where raised) ⑥ side effects (entities, external calls) ⑦ auth and authorization As-is/Required ⑧ callers ⑨ evidence and confidence. JSON examples use type placeholders (`"<string>"`, `0`) instead of invented values.

```markdown
# API Specification (As-is)
## 1. Common Conventions — base paths & kinds, wrapper & error format, formats, pagination, auth (As-is / Required)
## 2. API Index — | API ID | Method | Path | Kind | Feature ID | Callers | Confidence |
## 3. APIs by Feature — ### F-XXX-NN → #### A-XXX-NN METHOD path (items ①–⑨)
## 4. Review Notes — no caller found, duplicates, inconsistent styles, form submits needing JSON, security gaps (SR)
## 5. Redesign Candidates — empty; STEP 8 fills it
## 6. Open Questions
```

Report: endpoint count per feature, endpoints without callers.

## STEP 6 — Screen spec

Input: `FeatureSpec.md` (else STEP 3 first), `ApiSpec.md` (if missing, refer by method and path and say so), the source.

If there is screen evidence (frontend code, server templates, screenshots), look at it directly — those screens are **existing**. With a backend only, derive **candidate** screens from verified flows and APIs, and never write them as confirmed UI. Where to look per kind of screen evidence: stacks.md.

```markdown
# Screen Specification
## 1. Screen Inventory — per screen: ID, name, purpose, actor, route, entry/exit, feature IDs, evidence & confidence (existing / candidate)
## 2. Screen Details — content, actions, inputs & controls, loading/empty/success/error, validation & feedback, navigation, API & feature IDs, evidence, inferences
## 3. Navigation Flow — transitions, entry & return paths, branches, auth routing (As-is / Required), dialogs & multi-step flows
## 4. Screen-Level Unknowns
```

Do not guess layout, colors or copy from backend code (copy present in templates may be recorded as existing UI). Do not assume every API has a screen.

Report: screen count (existing/candidate), features without screens.

## STEP 7 — Tech stack

Input (precedence): target stack sentences in the run arguments → `target-stack.md` → user-written content of an existing `docs/product/TechStack.md`. Conflicts go in §5. `source-map.md` is required; other analysis docs if present.

Output location: with a target stack, `docs/product/TechStack.md`; without, `analysis/product/TechStack.md` (legacy stack, mapping candidates and defects only) — say which.

```markdown
# Tech Stack
## 1. Technology Stack — frontend, backend, API style, DB & data access, auth, file storage, test/build/dev tools, deployment
## 2. Target Architecture — frontend / backend responsibilities, API boundary, data ownership, auth boundary, integration boundary
## 3. Existing-to-Target Mapping — only mappings with evidence (e.g. controller → handlers, service → application service, ORM entities → SQL against the existing schema, server pages & form submits → SPA screens calling JSON APIs, session login → token auth)
## 4. Security Requirements — every SR: requirement, As-is (compliant / gap / n.a.) with evidence, affected F/A IDs
## 5. Decisions and Open Questions — user decisions, dependencies, unspecified choices (TBD / Requires decision), migration risks, proposed extra security measures
```

Migration risks only with evidence: server pages and forms → SPA + JSON API; session login → tokens (logout, password change, expiry, roles); reusing the existing DB (DataModel §5; the migration baseline for an ORM-managed schema is `Requires decision`; compile-time query checks need a DB or offline metadata at build); file storage changes; exposed credentials; clients outside this repo (endpoints without callers); existing data compatibility.

Do not invent versions, dependencies, deploy tools or architecture decisions. Never drop or weaken an SR.

Report: decisions applied, defects found, TBD items.

## STEP 8 — Review and final report

Input: the five docs from STEP 3–7 (for missing ones, say which step to run and review what exists), `source-map.md`, `feature-inventory.md`, `target-stack.md`, the source.

Checks: ① are all important features from STEP 1–2 documented ② are IDs stable and referenced consistently ③ features missing success, failure, validation or authorization ④ do API contracts and state transitions match the source ⑤ are screens linked to the right F and A IDs ⑥ are inferred screens and rules marked ⑦ does TechStack follow the user's requirements ⑧ are existing behavior and proposals separated ⑨ conflicts, duplicates, unsupported claims ⑩ were open questions resolved silently ⑪ DataModel entities ↔ FeatureSpec data changes ↔ ApiSpec side effects, ERD mode consistency ⑫ does every defect have Required + SR, and is no insecure behavior written as a requirement ⑬ no config secrets in the docs. Recheck important items in the source and fix only inconsistencies with evidence. Do not invent things to look complete.

API necessity review → `ApiSpec.md` §5: `| API ID | Observation | Proposal | Reason & evidence | Decision needed |`, proposals being keep · merge · replace · form submit → JSON · removal candidate. Never propose removal just because no caller was found in this repo (make it a removal candidate needing confirmation). Do not change the As-is sections.

Output `analysis/review-report.md` (same summary in chat): docs created and edited, features analyzed and documented, main findings and structural traits, API review summary (count per proposal), defects per SR, known gaps and open questions, areas for a human to check.

Done when: the five docs are in place; the feature spec rests on implementation evidence; the data model states its evidence, ERD mode and differences; every in-scope API is present with parameters and return values; screens are split into confirmed and inferred; the target stack follows the user's requirements; every SR is written as Required and defects are visible; important flows have success and failure; uncertainties are written down; and the final report honestly states the analysis scope and remaining gaps.
