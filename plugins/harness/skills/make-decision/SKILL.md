---
name: make-decision
description: 여러 선택지 중 정해야 하는 항목(결정)을 워크스페이스 `docs/decisions/` 아래 결정 폴더(brief·d-main·d-sub·result)로 관리하고, 메인의 선택을 보지 못한 서브에이전트의 독립 의견과 비교해 점검 스크립트로 완료·보류를 가른다. 사용자가 "결정 정리", "결정할 것 모아", "선택지 비교", "두 번째 의견", "결정 폴더", "결정 점검", "보류된 결정", "이거 정해줘" 라고 하거나, 작업 중 사용자·에이전트가 골라야 할 항목이 생겼을 때 쓴다.
---

# Decisions

Each decision is a **folder**. The main agent writes its opinion, a subagent that never sees it writes a second one, and a dependency-free script compares them: same choice → complete, different → halt for the user. This stops the agent from adopting its own recommendation unchecked, and keeps status, rationale and history per item instead of in one growing table.

Output language: decision files follow the workspace docs language (usually Korean). The field keys the script reads (`선택:`, `결정 근거:`, `결정자:`, `사용자 확인:`, `질문:`, `막힌 카드:`) stay exactly as written. Reports follow the user's language.

## 1. Layout

```text
docs/decisions/
├── README.md                         # summary table (rebuilt by the script) + how it works
├── open/<label>/<ID>-<slug>/         # waiting for opinions
├── complete/<label>/<ID>-<slug>/     # decided (agents agreed, or the user chose)
├── halt/<label>/<ID>-<slug>/         # waiting for the user
└── later/<label>/<ID>-<slug>/        # parked on purpose; the script leaves it alone until the user decides
```

- `<label>` is a domain: `payment`, `auth`, `privacy`, `ux`, `infra`, `content`, … Pick from existing labels before adding one.
- `<ID>` is `D-<NNN>`, never renumbered. A reversed decision gets a new ID that says which one it replaces.
- Start a new workspace from [assets/readme.md](assets/readme.md). The table lives between `<!-- decisions:start -->` and `<!-- decisions:end -->`; the script replaces only that block.

## 2. Files

| File | Who writes | Template |
|---|---|---|
| `brief.md` | main agent | [assets/brief.md](assets/brief.md) — question, background, options A/B/(C), facts, doc paths, blocked cards, `사용자 확인:` |
| `d-main.md` | main agent | [assets/opinion.md](assets/opinion.md) |
| `d-sub.md` | subagent | same |
| `result.md` | script (or user) | written on complete/halt; see §4 |

`d-main.md` and `d-sub.md` are exactly:

```text
선택: <A|B|C>

결정 근거: <1–3 lines>
```

## 3. Independent second opinion

1. Write `brief.md`. It must stand alone: facts and doc paths, **no recommendation** and no leaning wording.
2. Write `d-main.md`. Do not mention its choice anywhere the subagent can see (conversation summary, brief, card).
3. Spawn a subagent with a fresh context, read-only, and give it only: the path of `brief.md`, the doc paths in it, and the d-sub format. Never pass `d-main.md`, its path, or the main choice. It writes `d-sub.md` (or returns the text and the main agent writes it verbatim).
4. Run the script (§4).

**User-check items**: legal, business, pricing, refunds, personal data, contracts, anything that commits money or creates an obligation. Set `사용자 확인: 필요 (<why>)` in `brief.md`. The script then halts the item **even when both opinions agree** — agents never decide these. If unsure whether an item qualifies, mark it.

## 4. Sweep script

```bash
node "${CLAUDE_SKILL_DIR}/scripts/decisions.mjs" docs/decisions --dry-run   # plan only
node "${CLAUDE_SKILL_DIR}/scripts/decisions.mjs" docs/decisions             # apply
```

Node 18+, no dependencies. `--date YYYY-MM-DD` overrides today.

- `open/*`: both choices present and equal (and no user check) → writes `result.md` (choice, merged main + sub rationale, date, `결정자: 에이전트 합의`) and moves to `complete/<label>/`. Different, or user check → writes a halt summary (both choices side by side, question, blocked cards) and moves to `halt/<label>/`. A missing file or choice → stays in `open/`, reported.
- Any state: `result.md` with `결정자: 사용자` and a `선택:` → moves to `complete/`. To record a user decision, fill the two blank lines at the end of the halt `result.md` (or write them in a `later/` item) and run the script.
- Rebuilds the README table from the folders (ID · 제목 · 라벨 · 상태 · 결과 · 막힌 카드 · 경로).

Tests: `node --test "${CLAUDE_SKILL_DIR}/scripts/decisions.test.mjs"`. Change the tests with the script.

## 5. Reporting halts

For each halted item, give the user one block: the question, both choices with their rationale, the impact, the default if they do not decide, and the blocked cards. Ask; do not pick for them.

## 6. Task cards

With `harness:plan-tasks`: `brief.md`'s `막힌 카드:` lists the card IDs it blocks; those cards are `blocked-by-decision` with this decision ID in their 결정 field, and the decision appears in `docs/tasks/README.md`'s 결정 table. When the sweep completes a decision, update those cards and both READMEs in the same change.

## 7. Workspace CLAUDE.md

The workspace-claude-md template has a line for this. In short: decisions live in `docs/decisions/` (`harness:make-decision`); never adopt your own recommendation on an open decision without the independent second opinion and the sweep.
