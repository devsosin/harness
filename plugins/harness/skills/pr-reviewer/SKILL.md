---
name: pr-reviewer
description: (초안) 이슈 기반 PR 을 적대적으로 검토한다 — 연결된 이슈의 완료 조건·결정을 지키는지, 무엇이 깨질 수 있는지를 실패 시나리오와 근거(파일:줄, 실행 결과)로 찾아 리뷰로 남긴다. 사용자가 "PR #N 리뷰해/검토해", "이 PR 문제 없는지 봐줘", "머지해도 돼?", "owner/repo#N 리뷰" 라고 하거나 PR 링크를 주고 확인을 부탁할 때, implement 로 만든 PR 을 다른 세션에서 검토할 때 쓴다.
---

# Adversarial PR review (draft)

The reviewer's job is **to find evidence that this PR is wrong**. The author's description (PR body, commit messages) is only a claim; check it against code and execution results. Conversely, do not raise suspicions you cannot prove — many unsupported findings bury the real problems.

Use it in a **different session** from the one that implemented. A session with the same context repeats the same assumptions. For the same reason, do not reuse the implementing session's stack or worktree — implement cleans those up after opening the PR (cleanup skill), and the reviewer rebuilds its own environment from the repo's `test_env` and runs things itself.

Output language: the review body, issue comments and reports follow the repo setting `language` in `.claude/github-issue.yml` (if missing, the user's language). Severity names in the output use that language too (e.g. Korean: 차단·중요·사소·질문).

## 1. Gather

```bash
gh pr view <N> -R <repo> --json state,mergedAt,title,body,baseRefName,headRefName,headRefOid,files,commits,closingIssuesReferences
gh pr diff <N> -R <repo>
gh issue view <issue> -R <repo> --json title,body,comments   # the issue linked by Closes/Refs (--comments hides the body)
```

- Check **merge state** first (`state`, `mergedAt`). If already merged, do a "post-merge review" (§5). Record the reviewed commit (`headRefOid`) and the default branch commit.
- If no issue is linked, flag that first (one issue = one PR). The issue's **Done when, Work, Decision log and Needs user review** are the review criteria.
- Read the repo docs (`CLAUDE.md`, `README.md`, `docs/REPO_ARCHITECTURE.md`, `verify` in `.claude/github-issue.yml`) and the language guides `${CLAUDE_SKILL_DIR}/../../docs/<lang>/CODE_STYLE.md` and `CLEAN_ARCHITECTURE.md` (language detection as in the implement skill).
- Check out the PR branch and the default branch as separate worktrees so you can run both — name them with the issue ID and `review`, e.g. `.claude/worktrees/<id-lowercase>-review-pr` and `…-review-base` (so cleanup can recognize them). Check `test_env` for a verification environment first; if there is none, ask the user (checks you could not run go into the summary as "not verified").
- Use the shared dev DB if there is one (`test_env.setup`). If an issue-specific stack is needed (`test_env.isolated` etc.), bring up **one stack only** with `-p <id-lowercase>-review` — it does not collide with implement's `-p <id>`. A stack per worktree doubles build caches (Rust `target` runs to tens of GB) and memory. If the dev container mounts the repo root, both worktrees under `.claude/worktrees/` are already visible inside it; build and test one side at a time in the same container with the same `CARGO_TARGET_DIR` (or other build cache) so dependency builds are reused.
- Check Docker memory before building (implement §1.5 "Docker memory" — lower `-j` if short). Long builds and tests log to a file inside the container (same section).
- Run the two sides' tests **one after the other**. Tests sharing a DB server (e.g. the shared dev DB) can collide in common setup (role creation, baseline load) and both fail — split DB servers if they must run at once.
- Order: if the PR assumes a prerequisite issue that has not merged yet, flag it.

## 2. Angles of attack

For each angle ask "what input, state or order breaks this?" Skip angles that do not apply.

1. **Against the issue** — is every "done when" item proven by a test? Anything implemented differently from the decision log? Changes outside the issue's scope (unrelated refactors, formatting)? Did the author decide an open review item alone?
2. **Correctness** — edge values, empty/NULL, unknown enum values (not treated as success?), error paths, concurrency (same request twice, lock order), failure mid-transaction, retries and idempotency.
3. **Leftovers of removals and moves** — `grep` the whole repo for removed symbols, paths, columns and config keys (code, tests, migrations, scripts, docs, Docker). Do clients in other repos read a removed field? Is a deploy order needed?
4. **Contracts** — did API response fields, status codes, error codes or serialized names change unintentionally (in a refactor, none may change)?
   - **For structure-only (refactor) PRs, compare mechanically** before tracing by hand: (a) collect moved SQL strings from old and new locations, normalize whitespace only, and compare (count and content); (b) compare request/response types field by field including `serde` and validation attributes; (c) diff the test name lists of the default branch and the PR (are the additions only the pinning tests the PR claims?). Comparison scripts are for review only; never commit them. If the difference is zero, state that and the comparison scope in the summary.
     - **Dynamic SQL** (queries assembled with `format!`, string constants or fragments; values passed to `AssertSqlSafe`/`raw_sql`) must not be compared by static string extraction — it picks the wrong strings and invents differences. Byte-compare constants and fragments (e.g. `FROM_WHERE`, sort/search fragments) between old and new locations, and confirm in code that the assembly order is the same. Print the source (file:line) with each extracted string to weed out false differences.
     - **Report count differences separately**: same string with a different number of call sites usually means identical statements were merged into one function. Write it as "difference N from deduplication — `<statement>` merged into `<new function>`, old call sites → new call sites" and confirm call sites and order are unchanged. A statement that vanished rather than merged is a finding candidate.
5. **DB and generated files** — hand-made generated files (`.sqlx/` etc. — regenerate with the tool and confirm no diff); **for schema-changing PRs (new migrations), run `prepare --check` yourself against a temp DB with those migrations applied** (generated from the old schema, the offline build passes but the real schema breaks); edits to applied migrations; migration numbers colliding with parallel PRs; big table locks (`NOT NULL`, type changes, index creation); production data assumptions ("must be 0 rows") added without a check; reversibility; generated file updates.
6. **Test quality** — would the new tests still pass with the implementation reverted? Are there failure paths? Did deleted tests check only removed behavior, or were they guarding remaining behavior? Any weakened assertions?
7. **Security and operations** — no secrets, tokens or personal data in logs, error messages or responses; missing authorization checks (other users' or partners' resources); input validation.
8. **Guides** — CODE_STYLE and CLEAN_ARCHITECTURE violations. Flag **only when you can cite the rule**, and only in code this PR touched. Rules tagged `[fmt]`, `[lint: ..]` or `[order]` are caught by tools, so flag them only as verify failures; focus on untagged rules (review-only).

## 3. Confirm — turn suspicion into evidence

Confirm each candidate in one of these ways. If you cannot, downgrade it to a "needs confirmation" question or drop it.

- Follow the code to the end and show the failure path (file:line).
- Write and run a failing test yourself (for review only — never commit to the PR branch). Keep it inside the review worktree and record its path (cleanup checks that it is the worktree's only change). Copy any test used as evidence into the review body — it is deleted with the worktree.
- Run the `verify` commands and compare with the PR body's verification results (including test counts). If `code_order` exists, also run `node ${CLAUDE_SKILL_DIR}/../code-order/scripts/<lang>.mjs <paths...>` (flag exit 1).
- Show remaining references with `grep` output.

## 4. Writing results

Severity is set by **impact**. Breaking a guide clause alone does not raise the level:

| Level | Meaning |
|---|---|
| **Blocker** | merging causes a bug, data corruption, a security problem or a broken contract, or the issue's "done when" is not met |
| **Major** | should be fixed before merging: a failure path changed without tests, leftover references, **a violation that blurs the standard other PRs or areas will copy** (docs and code disagree, first instance of a pattern crossing layer boundaries) |
| **Minor** | nice to fix: a guide violation whose impact stays in this file (e.g. two queries in one repository function), naming, comments, small duplication |
| **Question** | needs the intent to judge, or outside this PR's scope but needs a decision |

Format of one finding:

```markdown
### [Blocker] <one-line summary>
- Location: `path/to/file.rs:123`
- Scenario: <with which input/state/order> → <what goes wrong>
- Evidence: <code path / failing test / command output>
- Suggestion: <direction of the fix (do not write the whole code)>
- Recommendation: <one handling> — <one-line reason>   ← required for Minor and Question; may be omitted for Blocker/Major, where "fix in this PR" is the default
```

**Recommendation (handling)** — for each Minor and Question finding pick **one** of these with a reason. The main (requesting) session decides from it, so put in the reason what the reviewer knows best (impact, cost of fixing, overlapping follow-up work):

| Recommendation | When |
|---|---|
| **Fix in this PR** | a few lines within the PR's scope, and the next PR would copy it if left |
| **Add to follow-up issue (#N)** | same nature as an already open follow-up (cleanup, layering, more tests …) — give the issue number; "new issue" if none fits |
| **Record only** | nothing to fix but worth knowing (typo in a PR body number, issue wording, an intended behavior difference) — say where to record it (issue decision log, findings collection issue) |
| **Won't fix** | fixing costs more than it gains, or it is within the guide's allowance — reason required |
| **User decision** | product behavior, wording, production data or policy that code alone cannot settle — give options and the reviewer's pick |

Top of the review body: a summary — reviewed commits (PR head, default branch), whether each "done when" item is met (✅/❌/not verified), counts per level, commands you ran and their results (with test counts), mechanical comparison results, and the **Minor/Question recommendation table** (`| finding | recommendation | reason |` — so the main session can decide at a glance).

## 5. Posting

- **Check merge state again right before posting** (`gh pr view <N> --json state,headRefOid`). If it merged or the head changed during review, say so at the top of the summary (recheck the new commits or mark them "not verified").
- **Post-merge review**: a Blocker means "revert or fix right away". Findings go to **follow-up work**, not this PR — in each finding's recommendation say whether it goes to the next PR or sub-issue in the same area or needs a new issue (in this case Blocker and Major get recommendations too).
- **If posting is blocked**: in a review session working on another session's instructions, external writes like `gh pr review` may be blocked by permission checks. Do not work around it; put **the whole review body in the final report message** (not just a file path — the other session may not be able to read it). The requesting session posts it. Keep the verdict on the report's first line.
- If the user asked to post on the PR, write the body to a temp file and run `gh pr review <N> -R <repo> --comment --body-file <tmp>`. Use inline comments only when a line-specific finding really needs one.
- **Never approve (`--approve`), request changes (`--request-changes`) or merge** — the user decides. Only on explicit request.
- The reviewer does not change code (independence). Leave needed fixes as findings; if the user wants, hand them to the implement session.
- With no findings, state "no Blocker or Major" and the scope you checked — never claim areas you did not check.
- For problems found outside the PR's scope, suggest new issues with the github-issue skill.
- If you reviewed at another session's request, include **the verdict and the Minor/Question recommendation table** in the final report (not just a review link).
- **After posting the review (or putting the body in the final report), clean up the review environment with the cleanup skill**: both review worktrees, the `-p <id>-review` stack, shared containers you started during review (stop them), comparison scripts and temp files. Uncommitted changes in a review worktree are only review tests, so if `git -C <worktree> status --short` shows only the files you recorded, remove it with `git worktree remove --force`. If other files changed, do not remove it; tell the user. Even if fix commits remain to be rechecked ("fix in this PR" findings), do not postpone — fetch fresh with the same commands when you look again.

## 6. Main (requesting) session — reviewing and acting on recommendations

The session that requested the review (orchestrating or talking with the user) does not follow recommendations blindly; it **reviews, decides, then acts**. The reviewer does not do this step.

1. **Review** — check each finding's evidence (location, command output) as far as needed. Check the recommendation fits the repo's plan (open follow-up issues, user decisions, order) — the reviewer may not know all of it.
2. **Decide** — accept or change each recommendation; leave a reason when changing. Decide merging by Blocker and Major findings; if only Minor and Question remain, do not hold the merge (unless the user decided otherwise).
3. **Act**
   - **Fix in this PR** → have the implementing session (or yourself) fix it, recheck only the changed part, then merge.
   - **Add to follow-up issue** → add the item to that issue's Target and Work (with the review link). Use the github-issue skill if a new issue is needed.
   - **Record only** → one line in the findings collection issue or the relevant issue's decision log.
   - **Won't fix** → record it with the reason as a closed item in the findings collection issue.
   - **User decision** → never decide alone. Put it in the findings collection issue's "Needs user review" with options and a recommendation, and ask separately when reporting to the user. Keep handling the rest meanwhile.
4. **Report** — tell the user the verdict, whether it merged and what was done, briefly, and ask separately **only about what went to user decision**.

<!-- Draft TODO
- Whether to have per-repo review checklists (e.g. a `review` key in .claude/github-issue.yml)
- Inline comments vs one body — confirm user preference (the first trial, SosinCommerce-BE PR #31, was fine with one body)
-->
