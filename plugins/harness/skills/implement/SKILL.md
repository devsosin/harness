---
name: implement
description: GitHub 이슈를 받아 이슈·선행·결정 확인 → 테스트 환경 확인 → 테스트 → 구현 → 검증 → PR(github-pr) 까지 진행한다. 사용자가 "이슈 #N 구현해/작업해/진행해", "이 이슈 처리해줘", "owner/repo#N 해결", "ISSUE-ID 작업 시작", "#5~#8 진행해" 라고 하거나 이슈 링크만 주고 "이거 해줘" 라고 할 때, 새 세션에서 이슈를 넘겨받아 코드를 고칠 때 쓴다. 이슈 없이 코드를 크게 바꾸려 할 때도 먼저 이슈를 만들고 이 스킬로 진행한다.
---

# Implementing an issue

This skill usually starts in a **new session** with just one issue. There is no earlier conversation, so the issue body, comments, decision log and repo docs are the only sources. The goal is one PR whose tests prove the issue's "done when" items.

Flow: **prepare (issue, prerequisites, environment) → classify → tests → implement → verify → update issue → PR**

If you were given several issues, first set the order with [§8 Several issues](#8-several-issues).

Output language: issue comments, PRs and reports follow the repo setting `language` in `.claude/github-issue.yml` (if missing, the user's language). Issue section names here are the github-issue skill's English glosses (e.g. "Needs user review" = `사용자 검토 필요`).

## 1. Prepare

### 1.1 Read the issue

```bash
gh issue view <N> -R <repo> --json number,title,state,labels,body,comments
```

(`gh issue view --comments` does not show the body — read body and comments together as JSON, as above.)

- **If "Needs user review" has open items (`- [ ]`), do not implement those parts.** Summarize why a decision is needed plus the recommendation, and ask the user. If the parts unrelated to the decision can go first, say so and do them. Issues are implemented as the user decided; guessing a decision gets reverted in review.
- Decisions in the "Decision log" and comments override the rest of the body (Work, Target) — decisions are often added later.

### 1.2 Prerequisite issues

For every issue marked as a **prerequisite** in "Order" (or "Related issues" if there is none), check its state:

```bash
gh issue view <prereq N> -R <repo> --json state,closedByPullRequestsReferences
```

If a prerequisite is not closed or its PR is not merged into the default branch, **do not start.** Tell the user which prerequisite work remains and stop. The code you would build on does not exist yet, and starting anyway means editing the same files twice. If the user explicitly says "start on top of the prerequisite branch", use that branch as the base and note it in the PR.

### 1.3 Repo config and docs

Read `.claude/github-issue.yml` (especially `verify`, `test_env`), `CLAUDE.md`, `README.md`, `docs/REPO_ARCHITECTURE.md` if present. Repo docs override this skill and the common guides.

### 1.4 Language guides

Pick by the language of the files that will change. They are in this plugin's `docs/<lang>/`:

- Path: `${CLAUDE_SKILL_DIR}/../../docs/<lang>/CODE_STYLE.md`; structure in `CLEAN_ARCHITECTURE.md` in the same folder.
- Language: `Cargo.toml`/`.rs` → `rust`. For other languages, check which folders exist with `ls ${CLAUDE_SKILL_DIR}/../../docs/`.
- Frontend (`react` in `package.json`, or `.ts`/`.tsx`/`.jsx` files): read the frontend skill instead of `docs/` — `${CLAUDE_SKILL_DIR}/../frontend/SKILL.md` plus the references its §0 table names for this issue (framework, API and mocks, testing, PWA, SEO/AEO).
- Lint and CI configs are in the same folder's `templates/` (Rust: `lints.toml`, `clippy.toml`, `rust-ci.yml`). If the repo has no lint config, adding one is out of scope; at most suggest it in the PR's "Notes".
- If there is no folder for the language, follow the repo docs and the language's usual conventions, and note the missing guide in the PR's "Notes".

### 1.5 Test environment — ask first if it is missing

Before touching code, confirm every `verify` command can actually run. If the config has `test_env`, run its `check`; otherwise run `verify` once. Common gaps: no DB or external service, missing tools (sqlx-cli …), missing baseline files or sibling repos.

If anything cannot run, **ask the user before implementing**: what is missing, what it prevents you from verifying, and the options:

1. **Prepare the environment** (recommended) — present `test_env.setup` or the README's method; proceed once the user prepares it or allows you to.
2. **Continue with partial verification** — run what you can, list every skipped check under the PR's "Not verified", and open the PR as **draft** (`gh pr create --draft`). Once the environment exists, finish verification and mark it ready.
3. **Stop.**

**Temporary test stack**: when you bring up the repo's dev compose just for this issue, name the project after the issue ID (`docker compose -p <id-lowercase> …`, e.g. `-p snd005`). It stays apart from the shared dev DB and other worktrees' stacks, and the cleanup skill later finds "what this work created" by that name. If host ports clash with another stack, drop them with a compose override (`ports: !reset []`) and run inside the container. Generate random passwords for this stack only and pass them as process env vars (do not edit `.env`); if you wrote them to a file, delete it during cleanup. Record the exact commands (override included) — they prove the environment can be recreated after cleanup. If the config has no `test_env`, suggest those commands as `test_env.setup`. If you started a stopped shared container (`docker start`), note it too — stop it at the end.

**Docker memory**: before big builds (Rust etc.) check headroom with `docker info --format '{{.MemTotal}}'` and `free -m` inside the container. On Windows Docker Desktop, `memory` in `%USERPROFILE%\.wslconfig` caps the whole VM; sharing it with other containers can make the entire engine hang mid-build (`docker ps` stalls or returns 500). With under 4GB free, lower parallelism (`cargo … -j 2`) and tell the user. If the engine hangs, restarting Docker Desktop/WSL or changing `.wslconfig` changes the user's environment — ask first.

**Long commands write to a file in the container**: background builds and tests log to a file inside the container (`docker exec <c> sh -c '<cmd> > /tmp/run.txt 2>&1; echo exit=$? >> /tmp/run.txt'`). You can check progress at any time, and you will not forget that the command keeps running even if you stop the host-side job — stop it inside the container.

**Never write or edit generated files by hand** (`.sqlx/` query metadata, snapshots, lock files, codegen output). If a tool cannot regenerate one, say so in the PR and keep it draft as in option 2. A hand-edited generated file can build yet differ from reality, and the reviewer cannot tell.

### 1.6 Branch

- Name: `<type>/<id-lowercase>-<summary>` — `type` is the issue's main commit type (§4), `summary` is 2–5 English kebab-case words. E.g. `refactor/order-002-remove-v1-order`, `feat/snd-004-kakao-retry`, `fix/auth-003-refresh-race`.
- One issue = one branch = one PR.
- Base: latest default branch (`origin/<default>` after `git fetch`). If the user allowed building on a prerequisite branch in 1.2, that branch.
- **If the session started on a tool-made branch (e.g. a worktree's `claude/…`)**, do not create another branch; rename it to the rule before the first push: `git branch -m <name>`. Never rename an already pushed branch (the PR is tied to it).
- Never commit directly to the default branch. If the working tree is not clean, tell the user before starting.

### 1.7 Baseline

Before changing anything, run `verify` and record the result (test names, pass and fail counts), so tests that were already failing are not mistaken for your breakage. Use the execution environment (Docker container etc.) the repo README describes.

## 2. Classify

Decide by the **issue content** (Overview, Work), not the labels — an `enhancement` label can still be legacy removal. If it is mixed, suggest splitting the issue, or split commits by kind.

| Kind | Examples | Test principle | Details |
|---|---|---|---|
| **New feature / bug fix** | new API, rule change, bug | write tests for the changed behavior first, **see them fail**, then implement | [references/feature.md](references/feature.md) |
| **Refactor / legacy removal** | moving structure, adding enums, removing paths or columns | remaining behavior **unchanged** (same tests pass); removed behavior proven gone | [references/refactor.md](references/refactor.md) |

Read and follow the matching reference.

## 3. Tests first

Turn the issue's "Done when" and "Work" into a test list. Each test proves at least one "done when" item; items no test can prove (production checks, production data queries) go on a separate "Not verified" list.

- Follow the repo's existing tests for location, naming and helpers (no new test framework).
- Exclude tests needing external services or real accounts from the default run (e.g. Rust `#[ignore]`), and never claim to have run what you did not run.
- A tests-only commit first is fine (the reviewer can see what the tests demand on their own).

## 4. Implement

- Change **only the issue's scope.** Do not fix other problems you find; note them and at the end create issues with the github-issue skill or tell the user. Mixed-scope PRs are hard to review and to revert.
- Follow the language guides (CODE_STYLE, CLEAN_ARCHITECTURE). Where the guide and existing code differ, align **only the code this issue covers**; no sweeping edits of surrounding code.
- Commit per unit of work in the github-pr skill §2 format (`<type>: <summary> (<issue ID>)` + body + `Refs #N`). Add files by path.
- Regenerate generated files **with their tools** per the repo docs and commit them together (1.5).
- Generate schema-derived files (`.sqlx/` query metadata etc.) **from a DB with this PR's migrations applied** — generating from a pre-migration schema (e.g. a shared dev DB still on the old version) passes the offline build but breaks compilation against the real schema. Do not alter the shared DB; create a temp DB with baseline + all migrations, run `cargo sqlx prepare` / `--check` there, then drop it. An offline (`SQLX_OFFLINE=true`) build alone does not verify generated files.
- **Versioned docs edited by many PRs** (version lines and change logs in plans, the next CHANGELOG number): leave them alone unless the issue requires the change. If it does, merge the latest default branch right before opening the PR and use the next number on top of it. If a parallel PR might take the same number, note it in the PR's "Notes" — whoever merges reconciles the numbers.
- DB migrations follow the repo's rules (never edit applied files, add new ones …). Steps needing production data checks stay as user review items on the issue instead of being replaced by code. Pick migration numbers after checking open PRs so they do not collide.

## 5. Verify

0. If the default branch moved during the work (`git fetch`, then `git log HEAD..origin/<default>`), merge it first and **re-measure the baseline** — the 1.7 numbers belong to the old default branch. Put the new numbers in the PR body's "Baseline".
1. Every `verify` command (if none, the language guide's defaults — Rust: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`). If `code_order` exists, also run `node ${CLAUDE_SKILL_DIR}/../code-order/scripts/<lang>.mjs <paths...>` per language (must exit 0; on 1, reorder with the code-order skill and keep it as a separate `style:` commit).
2. Compare with the 1.7 baseline — zero newly failing tests, and test count changes match the intent (per-kind bars in the references).
3. Go through "Done when" one by one and record "passing evidence (test name, command output)" or "not verified (reason)".
4. Read `git diff <default>...HEAD` from start to end — unintended changes, leftover debug code, remaining references to deleted code (`grep`), secrets, hand-made generated files.

On failure, fix and verify again. If the same failure survives more than three attempts, stop and tell the user what you tried and where you are stuck.

## 6. Update the issue

- Tick the finished items in the body's "Work" (`gh issue edit <N> --body-file`). Do not change decisions or review items in the body.
- Comment on the issue with items not done and any new user checks.

## 7. PR

Create the PR with the github-pr skill (title = issue title, body = commit summary + verification + issue link). Copy the step 5 results into the verification section and list every unverified "done when" item.

- Issue link: `Closes #N` if this PR finishes all of the issue's work and no review item is open. `Refs #N` if decisions remain or only part was done (merging will not close the issue).
- **When production data checks remain** (behavior depends on production data you cannot see here): use `Refs #N` and **ask the user to review** — add check items to the issue body's **"Needs user review"** section with the read-only query to run and what changes per result (e.g. "if this value exists, that template fails to send"), add the `needs-review` label, and show the query verbatim in the final report. When the user returns the result, tick the item and switch the PR to `Closes #N`.
- Draft if you continued with partial verification in 1.5.

After opening the PR, use the cleanup skill to remove what this work created (temp stacks, worktrees, temp files, leftover background jobs) and stop the containers this work started — finished work should not leave containers running. Delete the branch after the PR is merged.

Finally tell the user: the PR link, what was not verified, new issues created, cautions such as deploy order, and issues waiting on this PR as a prerequisite. For review, point them to the pr-reviewer skill in a **different session** on the same repo — a session reviewing its own work tends to repeat its own assumptions.

## 8. Several issues

Given several issues ("do #5–#8"), build an **execution plan** before implementing and show it to the user.

1. Read each issue's "Order", "Related issues" and "Target" files.
2. **Serial** (start after the earlier one merges) when:
   - the issue says `Prerequisite: #N`;
   - it assumes the earlier issue's result (new baseline, changed test environment, removed code);
   - both edit the same part of the same file, or the same generated files, migration number or versioned doc.
3. Everything else is **parallel** (each in its own session and worktree). If they overlap only in different parts of the same file, run in parallel and fix the merge order.
4. Plan as a table: `order | issue | prerequisite | parallel group | overlapping files | merge order`. If an issue's "Order" is empty or disagrees with the plan, fix it with the github-issue skill (after the user confirms).
5. Start only the parallel group; do not start a serial follow-up until the earlier issue closes (1.2).
