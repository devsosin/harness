---
name: github-issue
description: 작업·버그·결정 사항을 어느 저장소에서든 같은 형식(개요·사용자 검토 필요·대상·현재 상태·작업 내용·완료 조건·결정 기록)의 GitHub 이슈로 만들고 갱신·닫는다. 설정은 `.claude/github-issue.yml`. 사용자가 "이슈 만들어/작성해/올려줘", "ISSUE 로 남겨", "이슈 정리", "작업 계획을 이슈로", "OPEN_ISSUES/TODO 에 기록" 이라고 하거나, 나중에 할 작업·보류 결정·확인할 것이 생겼을 때, 이슈를 닫거나 결정을 덧붙일 때, 라벨 체계를 정할 때 쓴다.
---

# GitHub issues

The reader of an issue is **whoever later reviews or picks up the work** (usually the user, or Claude in a new session). From the issue alone they must know what is done and why, what the user has to decide, and which files to open. So the review items and target files go at the top.

Per-repo details (labels, ID prefix, language, build and verify commands) live in that repo's config file; this skill only defines the common procedure.

Output language: issue titles, bodies and comments follow the config's `language` (if missing, the language of the repo docs/README, else the user's language).

## 1. Repo and config

1. **Repo** — the repo that holds the target code. Get `owner/repo` with `git remote get-url origin` in that folder. In a workspace with several cloned repos, create the issue in the repo that owns the target files.
   - If the work also changes another repo (e.g. a library change plus the app that uses it), create the issue in the main repo **and an issue for that repo's part in the other repo**, and link them. Each issue's "Target" lists the other repo's files and its issue (`owner/repo#N`). Follow that repo's own config (§1.2).
2. **Config** — `.claude/github-issue.yml` at that repo's root; format in [references/config.md](references/config.md). Read and follow it if present.
3. **No config (first use in a repo)** — settle the config once before creating issues. Labels stay in the repo for a long time and others see them, so never decide them without the user.
   - See current labels: `gh label list -R <repo> --limit 100`
   - From the repo structure (top-level folders, modules, issue IDs in existing docs), draft area labels and ID prefix candidates.
   - Ask the user in one go: area labels (e.g. per store or module), whether to use review and on-hold labels, ID prefix, issue language. Offer a recommendation. If they want only the default labels (bug, enhancement, documentation), record exactly that.
   - Write the answers to `<repo>/.claude/github-issue.yml` in the [references/config.md](references/config.md) format and create missing labels (`gh label create <name> -R <repo> --color <hex> --description "<desc>" --force`). The config must be committed to the repo so later sessions and other people use the same rules — tell the user and commit when asked.

## 2. Duplicates and IDs

```bash
gh issue list -R <repo> --state all --search "<keywords>" --limit 20
```

If a similar issue exists, comment on it instead of creating a new one (for decisions and findings, also update its "Decision log").

The title follows the config's `title_format` (default `[ID] one-line summary`). The ID is `PREFIX-number` (e.g. `AUTH-003`). Docs, commits and PRs refer to each other by this ID, so never renumber. Find the next number from existing titles with the same prefix:

```bash
gh issue list -R <repo> --state all --search "AUTH- in:title" --limit 200 --json title -q '.[].title'
```

If no prefix in `id_prefixes` fits, use a new short uppercase prefix and add it to the config (tell the user). If the config disables IDs (`id_prefixes: []`), the title is the summary only.

## 3. Writing the body

Use `.github/ISSUE_TEMPLATE/` or the config's `template` path if present, otherwise the structure of [assets/issue-template.md](assets/issue-template.md). The section names below are English glosses of the template headings (개요, 사용자 검토 필요, 대상, 선후관계, 현재 상태, 작업 내용, 완료 조건, 결정 기록) — in the issue, use the headings in the output language. Per section:

- **Overview** — what and why in 2–4 sentences, with the symptom or evidence (a log line, an official doc sentence, the user's request).
- **Needs user review** — a checklist of what the user must decide or confirm. Each item has the options and a recommendation (e.g. "Use the single-item API — recommended: no (keep one processing path)"). Checks that need production (real accounts, production logs) go here. If none, write "None". This section is the main reason the issue exists, so look hard before leaving it empty.
- **Target** — do not name the repo the issue lives in. Focus on **files and folders that change or are affected** (in backticks), the functions and types inside, and what changes. Only list paths you opened and confirmed. Name `owner/repo`, its files and its issue (`owner/repo#N`) only when another repo also changes. Related issues and PRs on the last line (`#N`, `owner/repo#N` for other repos).
- **Order** — issues that must merge first (`Prerequisite: #N` + reason) and issues that may run at the same time (`Parallel OK`). The implement skill does not start while a prerequisite is open. Something is a prerequisite when it touches the same part of the same file, when this issue assumes its result (baseline, test environment, removed code), or when both use the same migration number or versioned doc. When creating several issues at once, fill in their order after all exist. If none, write "None".
- **Current state** — current behavior and evidence (file:line, real responses). Remove or replace personal data, accounts, tokens, coupon or order numbers.
- **Work** — the steps in order, as a checklist. A short code block if there is a design.
- **Done when** — test and verify commands and the behavior to check. Use the config's `verify` if present.
- **Decision log** — a `| date | decision |` table. Only what the user decided, with the date (YYYY-MM-DD).

Write section headings and text in the output language above. Never translate code identifiers, paths, endpoints, IDs or config keys. Never write secrets or `.env` values (key names only). Be extra careful with internal information (internal URLs, accounts, customer data) in public repos.

## 4. Labels

Follow the config's `labels`. General rules:

- One type label (`labels.type`, default `bug`, `enhancement`, `documentation`). Refactoring is `enhancement`.
- Area labels (`labels.areas`) when their `when` matches (several allowed).
- `labels.review` (e.g. `needs-review`) while "Needs user review" has open items; remove it once the user has decided all of them.
- `labels.on_hold` (e.g. `status:on-hold`) for issues the user put on hold.
- Never create labels outside the config. If one is needed, ask the user, add it to the config, then create it.

## 5. Creating

If the workspace keeps task cards (`docs/tasks/`, `harness:plan-tasks`) and the user asks to issue a card, use the card's 이슈 초안 as the draft, then set the card to `issued` with the URL and update `docs/tasks/README.md` (plan-tasks §5).

If the user asked for an issue, create it right away. If the plan is still forming and the content is not settled, show a draft and create it after confirmation. When migrating many at once (e.g. from an issue file), create them one by one in the same format and replace cross-references with `#number` after all exist.

Write the body to a temp file (the session scratchpad) and pass `--body-file` — it avoids shell quoting problems.

```bash
gh issue create -R <repo> --title "[ID] summary" --body-file <tmp>/issue.md --label enhancement --label <area>
```

Afterwards tell the user the link (`[owner/repo#N](URL)`) and the review items in a line or two.

## 6. Updating and closing

- When the user decides or confirms something, comment it and also update the body's "Needs user review" checkboxes and "Decision log" (`gh issue edit -R <repo> <N> --body-file …`).
- Put `Closes #N` (`Closes owner/repo#N` for another repo) in the work PR body so the merge closes it.
- When the order changes (a prerequisite is split or reordered), update "Order" in both issues.
- When it ends by decision (won't do) or is closed separately, comment the reason and close: `gh issue close -R <repo> <N> --reason completed|"not planned" --comment "…"`.
- On hold: do not close; add the on-hold label and write the reason and resume condition in the decision log.
- If the repo has an old issue file (OPEN_ISSUES.md etc.), do not write new issues there. If the config has `index_file`, add only one line (ID and GitHub link) to its table.
