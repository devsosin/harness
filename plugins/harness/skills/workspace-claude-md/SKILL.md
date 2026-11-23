---
name: workspace-claude-md
description: 여러 git 저장소를 한 폴더에서 다루는 워크스페이스의 루트 CLAUDE.md(폴더·저장소 지도, 문서 우선순위, 수정 범위, Docker 개발·테스트)와 저장소별 CLAUDE.md(스택·구조·명령)를 만들거나 다시 맞춘다. 사용자가 "CLAUDE.md 만들어/작성/정리/업데이트해", "프로젝트 셋업", "새 프로젝트 시작", "워크스페이스 구조 정리", "폴더 구조 파악해", "레포 여러 개 관리" 라고 하거나, 새 세션이 구조를 매번 다시 찾을 때, CLAUDE.md 의 경로·명령이 실제와 달라졌을 때 쓴다.
---

# Workspace CLAUDE.md

Goal: a new session reads **only CLAUDE.md** and immediately knows what each folder is, which docs to trust, where to edit and how to run tests. Sessions do not know earlier conversations, so any fact missing from CLAUDE.md gets re-discovered every time or guessed wrong.

CLAUDE.md enters every session's context. So it is **short, factual and only points**: specs and designs live in `docs/`; CLAUDE.md gives only their locations and precedence. Aim for about 150 lines at the root and under 200 per repo. For a single-repo project, writing only that repo's CLAUDE.md, follow §5 too.

Flow: **map → read → classify → confirm decisions → check environment → write → check**

Output language: the CLAUDE.md files follow §6; reports to the user follow the user's language.

## 1. Map — structure script

```bash
node "${CLAUDE_SKILL_DIR}/scripts/workspace-map.mjs" <workspace root>
```

Read-only (Node 18+, no dependencies). Prints markdown:

- Folder table: which folders are git repos (nested ones too), `origin` (tokens stripped) and current branch, stack (main dependencies and scripts from `Cargo.toml`, `package.json`, `pyproject.toml`, Gradle/Maven), dev and test files (compose, Dockerfile, `.env.example`, `.claude/github-issue.yml`, CI, CLAUDE.md, README).
- `docs/` and `analysis/` trees: the first heading of each md; many files with one extension fold into `*.sql × 12 (first … last)`. `--depth N` changes depth (default 3).
- Warnings: CRLF shell scripts (they fail at once in Linux containers with `set: Illegal option -`).
- `--json` prints the same as JSON.

`.env` is only reported as present and **never read.** If values are needed, use only key names from `.env.example`.

Script tests: `node --test ${CLAUDE_SKILL_DIR}/scripts/workspace-map.test.mjs`. Change the tests with the script.

## 2. Read

From what the script showed, read:

- Existing CLAUDE.md files (root and per repo), README, config/command/rule docs under `.claude/` (`verify` in `github-issue.yml` is direct evidence for commands).
- Heads of the product, design and operations docs in `docs/` (version line, contents), and the purpose of `analysis/` if present.
- compose files, Dockerfiles, `package.json` scripts — these, more than the docs, are the real commands.

If a CLAUDE.md already exists, **edit it instead of rewriting.** Keep the rules the user built up (ways of working, prohibitions, decisions) and replace only stale paths and commands. Report what changed at the end.

## 3. Classify — project type

Pick from [references/project-types.md](references/project-types.md). The type changes doc precedence and edit scope:

| Type | Signs | Key points |
|---|---|---|
| New service | no existing code, `docs/product` is the source | mocks first; undecided items marked as needing decisions |
| Re-engineering / upgrade | existing system folders (Spring, PHP, Python …) + `analysis/` | existing code read-only; As-is (`analysis/`) apart from To-be (`docs/`) |
| Migration | production DB copy, migration SQL, cutover procedure docs | check production impact; apply log and procedure |
| Refactoring | same stack, behavior preserved | baseline test count; no out-of-scope changes |

If mixed (re-engineering + migration), write both. If unsure, ask the user once.

## 4. Confirm decisions — stack

- **The backend is a fixed preset**: Rust + Axum + SQLx + PostgreSQL, tests in Docker. Template: [references/backend-rust.md](references/backend-rust.md). AI/LLM calls are adapters inside the Axum service too (no separate Python server). If an existing repo uses another stack, write that stack as it is — the preset is only for new repos.
- **The frontend is chosen by requirements**: with the questions in the frontend skill's `${CLAUDE_SKILL_DIR}/../frontend/references/presets.md` (SEO/AEO, deploy target, PWA, admin vs public screens), propose Vite SPA (default) or Next.js (static deploy); the user decides. The frontend repo CLAUDE.md template is at the end of that file. Do not copy screen implementation rules into CLAUDE.md; point to the `harness:frontend` skill.
- For existing repos, the real dependencies the script found override the docs. If they disagree, do not write both; tell the user.
- Leave undecided items in CLAUDE.md as `TBD — <who/when decides>`. Guesses get read as decisions by the next session.
- Manage open decisions with the `harness:make-decision` skill (`docs/decisions/`, independent second opinion, sweep script) and point to them from CLAUDE.md as `TBD — D-<NNN>`. Write the root template §6 decisions line so every session uses it.

## 5. Check environment — Docker dev and test

[references/docker-dev.md](references/docker-dev.md). Commands in CLAUDE.md must be **ones that actually run on this machine**:

1. Host tools: `cargo --version`, `node --version`, `pnpm --version`, `docker version`. Without Rust, write Docker commands (this user defaults to Docker).
2. Run each repo's `verify` (or build and test) once, in the background if slow. For commands you could not run, append `(not verified: <reason>)` in CLAUDE.md and report it.
3. New service repos: write the three run modes (mock / remote / local compose) and their one-line commands. The rules and templates are the `harness:local-run` skill (`${CLAUDE_SKILL_DIR}/../local-run/SKILL.md`); CLAUDE.md gets only the commands and `.env.example` key names.
4. Write the naming rule (compose `-p <task id>`) so per-task containers and volumes can be removed. The cleanup procedure itself belongs to the harness `cleanup` skill — CLAUDE.md gets only the rule and that skill's name.
5. If any path touches a DB with production data or real external APIs (payment, messaging, sales channels), write "confirm with the user before calling".

## 6. Write

Templates: root [references/root-template.md](references/root-template.md), backend [references/backend-rust.md](references/backend-rust.md), frontend at the end of the frontend skill's `references/presets.md`.

- **Language: CLAUDE.md body in English.** Code identifiers, paths, commands and IDs unchanged. The language rule for `docs/` (usually Korean) goes separately in CLAUDE.md's Documentation section. If the user names another language, use it.
- **Folder structure as tree + table**: do not paste the script output; keep hand-picked lines with one-line comments. Per folder: "git repo (owner/name) / not", role, read-only or not. If the root is not a git repo, say so on the first line — it explains why `git` fails at the root.
- **Point**: specs, designs and decisions by doc path. Writing the same thing in two places makes one go stale.
- **Commands copy-paste runnable**: working folder, needed env var names, Windows Git Bash caveats (`MSYS_NO_PATHCONV=1`).
- **One-line reasons**: prohibitions carry a reason (e.g. "never edit applied migrations — sqlx rejects the checksum"). With the reason, the next session can judge exceptions.
- Never write secrets, accounts, tokens or internal IPs. Only key names and where they are kept (`.env`, SSM path rules).
- A repo's CLAUDE.md is committed to that repo. Mark paths outside it (root, sibling repos) as "relative to the workspace" — someone who cloned only that repo does not have them.

## 7. Check

```bash
node "${CLAUDE_SKILL_DIR}/scripts/workspace-map.mjs" <root> --check CLAUDE.md
node "${CLAUDE_SKILL_DIR}/scripts/workspace-map.mjs" <root> --check <repo>/CLAUDE.md
```

Shows backticked paths that exist nowhere in the workspace (container paths, image tags and placeholders skipped). Go through each: fix typos and moved paths; mark paths to be created later with `(planned)`.

Then check yourself:

- Given "run the backend tests", can a new session find the command from CLAUDE.md alone?
- When "this doc and that doc disagree", does it say which to follow?
- Are folders that must not be touched listed with reasons?

## 8. Report

Briefly tell the user: files created or edited, the chosen project type and stack, commands actually run and not run, decisions left `TBD`, the `--check` result. Commit when the user wants — a repo's CLAUDE.md follows that repo's issue/PR flow (github-issue, github-pr skills). If the root is not a git repo, say the root CLAUDE.md has nothing to commit to.

## 9. Re-syncing

To bring an existing CLAUDE.md up to date, run only the §1 map and the §7 check first and edit what changed. Fixing it in the PR that moves folders or adds repos keeps it least stale.
