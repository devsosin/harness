---
name: plan-tasks
description: 신규 프로젝트의 기획·갭 분석 결과를 워크스페이스 `docs/tasks/` 아래 저장소별 작업 카드(한 장 = 작업 하나)와 README 요약 표로 정리하고, 사용자 요청 시 카드를 GitHub 이슈로 올린다. 사용자가 "작업 목록 정리", "작업 카드 만들어", "과업 정리", "할 일 쪼개서 정리", "이슈 초안", "이슈로 올릴 것 정리", "카드 이슈로 올려" 라고 하거나, 기획 문서에서 저장소별 작업을 뽑을 때 쓴다.
---

# Task cards

Before issues exist, planned work for a new project lives as **one card file per task** under the workspace `docs/tasks/`, plus a compact `README.md` index. Cards hold the issue draft; issues are created **only when the user asks** (github-issue skill), and only for repos that exist.

Output language: cards and README follow the workspace docs language (see its CLAUDE.md, usually Korean); reports follow the user's language. The templates in `assets/` are in Korean — translate headings if the docs language differs.

## 1. Layout

```text
docs/tasks/
├── README.md                     # index: tasks table + decisions table (assets/tasks-readme.md)
└── <repo>-<NN>-<slug>.md         # one card per task (assets/task-card.md)
```

- `<repo>` is the target repo's folder name (`backend`, `frontend`, …). `<NN>` is a two-digit sequence per repo, never renumbered. Card ID = `<repo>-<NN>` (e.g. `backend-03`). If the planning docs already have candidate IDs (F-*, G-*), keep them in the card's "참조 ID" field.
- One card = one future issue = one PR. Split a card that would need two PRs.

## 2. Card fields

See [assets/task-card.md](assets/task-card.md). Markdown sections, no frontmatter: 제목, 저장소, 우선순위(P0–P2), 유형, 상태, 의존(카드 ID), 결정(결정 ID), 참조 ID, 배경, 범위, 범위 밖, 완료 조건, 검증, 문서 링크, 이슈 초안, 이슈.

- **이슈 초안** follows the target repo's `.claude/github-issue.yml` (title format, ID prefix, body sections of the github-issue skill §3). If the repo has no config yet, write the draft in the github-issue template and settle the config when the issue is created.
- Point to specs by path (`docs/product/…`); do not copy them into the card.

## 3. Status

| Status | Meaning | Next |
|---|---|---|
| `todo` | defined, something still to fill or check | → `ready-for-issue` when the README checklist passes |
| `blocked-by-decision` | an open user decision blocks it; the card's 결정 field names the decision ID | → `todo` / `ready-for-issue` when the decision is complete |
| `ready-for-issue` | draft complete, dependencies known | → `issued` on user request |
| `issued` | issue exists; card's 이슈 field has the URL | — the issue is now the source of truth |

After `issued`, do not keep editing the card; update the issue instead.

## 4. README index

[assets/tasks-readme.md](assets/tasks-readme.md). Keep it **compact** — it is what someone scans before creating issues:

- **작업 표**: ID · 제목 · 저장소 · 우선순위 · 상태 · 의존 · 결정 · 이슈. One row per card (rows = card files).
- **결정 표**: decisions that block cards — ID · 질문(한 줄) · 상태(`open` / `complete` / `halt`) · 결과 · 막는 카드. If the workspace uses the `make-decision` skill, the ID links to the decision folder and status/result mirror its `result.md`; otherwise this table is the decision record.
- **이슈 전 점검**: the short checklist in the template (dependencies issued first, no open decision, draft matches repo config, repo exists). Nothing else — no restating card contents.

When a decision completes, update both tables and move the blocked cards' status in the same edit.

## 5. Creating issues (on request only)

1. The user names cards (or "ready 인 것 전부"). Never create issues unasked.
2. For each card: run the README checklist. Skip cards whose repo does not exist yet or whose dependencies are not issued — report them.
3. Create the issue with the github-issue skill from the card's 이슈 초안 (duplicate check, labels, ID numbering from that skill). Replace card IDs in "선후관계" with `#N` of already-created issues.
4. Set the card's 상태 to `issued` and its 이슈 to the URL; update the README row.

## 6. Parallel writing

When subagents write cards or design docs in parallel, assign files per agent (e.g. one agent per repo's cards). Only the main agent edits `README.md`, after the subagents finish — two writers on one file lose rows.

## 7. Workspace CLAUDE.md

Add one line to the workspace CLAUDE.md "Sessions & plans" section (workspace-claude-md template §8): `Planned work: docs/tasks/README.md (harness:plan-tasks); issues only on request.`
