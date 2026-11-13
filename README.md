# harness

여러 저장소에서 같이 쓰는 Claude Code 스킬 모음. 이 저장소는 Claude Code **플러그인 마켓플레이스**(`devsosin-harness`)이고, 스킬은 `harness` 플러그인에 들어 있다.

```text
harness/
├── .claude-plugin/marketplace.json         # 마켓플레이스 목록
└── plugins/harness/
    ├── .claude-plugin/plugin.json
    └── skills/
        ├── github-issue/                    # /harness:github-issue
        │   ├── SKILL.md
        │   ├── assets/issue-template.md
        │   └── references/config.md         # 저장소별 설정 형식
        ├── github-pr/                       # /harness:github-pr — 이슈 하나 = PR 하나
        │   ├── SKILL.md
        │   └── assets/pr-template.md
        ├── implement/                       # /harness:implement — 이슈 → 테스트 → 구현 → 검증 → PR
        │   ├── SKILL.md
        │   └── references/feature.md, refactor.md
        └── pr-reviewer/                     # /harness:pr-reviewer — PR 적대적 리뷰(초안)
            └── SKILL.md
    docs/<lang>/                             # 언어별 공통 가이드 — 스킬이 ${CLAUDE_SKILL_DIR}/../../docs/ 로 읽음
        └── rust/CODE_STYLE.md, CLEAN_ARCHITECTURE.md
```

공통 문서는 플러그인 안 `plugins/harness/docs/<lang>/` 에 둔다. 설치하면 플러그인 폴더만 캐시로 복사되므로 저장소 루트의 파일은 스킬이 읽을 수 없다. 새 언어는 `docs/<lang>/CODE_STYLE.md`(+ `CLEAN_ARCHITECTURE.md`)를 더하고 implement 스킬의 언어 판별 목록에 확장자를 추가한다.

## 설치

한 번만 하면 이 컴퓨터의 모든 프로젝트에서 쓸 수 있다(사용자 범위).

```bash
claude plugin marketplace add devsosin/harness
claude plugin install harness@devsosin-harness
```

업데이트: `claude plugin marketplace update devsosin-harness` 후 새 세션(또는 `/reload-plugins`).

스킬을 고치는 중에는 클론한 폴더를 직접 마켓플레이스로 등록하면 고친 내용이 다음 세션에 바로 반영된다:

```bash
claude plugin marketplace add ./harness
claude plugin install harness@devsosin-harness
```

## 저장소별 설정

스킬의 공통 절차는 여기 두고, 저장소마다 다른 규칙(라벨·ID 접두어·언어·검증 명령)은 **각 저장소의 `.claude/github-issue.yml`** 에 둔다. 형식은 [config.md](plugins/harness/skills/github-issue/references/config.md). 설정이 없는 저장소에서 처음 쓰면 스킬이 사용자에게 한 번 확인해 그 파일을 만든다.

## 스킬 추가

`plugins/harness/skills/<이름>/SKILL.md` 를 만들고 `plugin.json` 의 `version` 을 올린다. 확인:

```bash
claude plugin validate .
```
