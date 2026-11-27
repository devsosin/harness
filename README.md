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
        ├── pr-reviewer/                     # /harness:pr-reviewer — PR 적대적 리뷰(초안)
        │   └── SKILL.md
        ├── code-order/                      # /harness:code-order — 파일 안 코드 순서 확인·정렬
        │   ├── SKILL.md
        │   └── scripts/rust.mjs, rust.test.mjs   # Node 18+, 의존성 없음
        ├── cleanup/                         # /harness:cleanup — 작업 후 세션·워크트리·브랜치·Docker 정리, WSL 디스크 압축
        │   ├── SKILL.md
        │   └── scripts/inventory.mjs (Node 18+, 읽기 전용), compact-vhdx.ps1 (Windows)
        ├── workspace-claude-md/             # /harness:workspace-claude-md — 여러 저장소 워크스페이스의 CLAUDE.md(루트·저장소별)
        │   ├── SKILL.md
        │   ├── scripts/workspace-map.mjs, workspace-map.test.mjs   # 저장소·스택·docs 트리 지도, CLAUDE.md 경로 검사(Node 18+, 의존성 없음)
        │   └── references/root-template.md, project-types.md, docker-dev.md, rust/README.md(진입점) + lib/·bin/·server/README.md
        ├── fetch-docs/                      # /harness:fetch-docs — 외부 문서를 압축 Markdown(docs/<소스>/)으로, 출처·날짜·재실행 명령
        │   ├── SKILL.md
        │   └── scripts/fetch-docs.mjs, fetch-docs.test.mjs   # Node 18+, 의존성 없음(--browser 만 Playwright 선택)
        ├── fetch-article/                   # /harness:fetch-article — 기사·뉴스레터·블로그를 한 편 한 파일(front matter·링크·영상·이미지)
        │   ├── SKILL.md
        │   └── scripts/fetch-article.mjs, fetch-article.test.mjs   # Node 18+, fetch-docs 변환기 재사용
        ├── frontend/                        # /harness:frontend — React 프론트엔드 셋업·화면 구현 규칙
        │   ├── SKILL.md
        │   └── references/presets.md(Vite SPA·Next.js), vite-spa.md, nextjs.md, api-and-mocks.md, testing.md, pwa.md, seo-aeo.md
        ├── make-decision/                   # /harness:make-decision — 결정 폴더(brief·d-main·d-sub·result)·독립 두 번째 의견·점검 스크립트
        │   ├── SKILL.md
        │   ├── assets/brief.md, opinion.md, readme.md
        │   └── scripts/decisions.mjs, decisions.test.mjs   # Node 18+, 의존성 없음
        ├── plan-tasks/                      # /harness:plan-tasks — 저장소별 작업 카드(docs/tasks/)·README 표·요청 시 이슈
        │   ├── SKILL.md
        │   └── assets/task-card.md, tasks-readme.md
        ├── local-run/                       # /harness:local-run — 실행 모드 3가지(mock·remote·local compose)와 배포 준비
        │   ├── SKILL.md
        │   └── references/compose.md(.env.example·Vite 프록시·compose.yaml), deploy.md(운영 compose·nginx·certbot)
        └── reverse-engineer/                # /harness:reverse-engineer — 기존 시스템 역공학 → 재구축 As-is 문서(STEP 1~8)
            ├── SKILL.md
            └── references/steps.md, stacks.md(스택별 볼 곳), scope-template.md, security-baseline.md(SR)
    docs/<lang>/                             # 언어별 공통 가이드 — 스킬이 ${CLAUDE_SKILL_DIR}/../../docs/ 로 읽음
        └── rust/CODE_STYLE.md, CLEAN_ARCHITECTURE.md
            └── templates/                    # lints.toml, clippy.toml, rust-ci.yml, db_enum_test.rs — 각 저장소에 복사해 CI 로 검사
```

공통 문서는 플러그인 안 `plugins/harness/docs/<lang>/` 에 둔다. 설치하면 플러그인 폴더만 캐시로 복사되므로 저장소 루트의 파일은 스킬이 읽을 수 없다. 새 언어는 `docs/<lang>/CODE_STYLE.md`(+ `CLEAN_ARCHITECTURE.md`)를 더하고 implement 스킬의 언어 판별 목록에 확장자를 추가한다.

외부 스타일 가이드는 비교·검토용으로 텍스트만 받아 `references/`(git 제외)에 섹션별 파일로 둔다:

```bash
node plugins/harness/skills/fetch-docs/scripts/fetch-docs.mjs https://google.github.io/styleguide/rustguide.html references/rust-style-guide/google
```

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

`plugins/harness/skills/<이름>/SKILL.md` 를 만들고 `plugin.json` 의 `version` 을 올린다. 작성 규칙:

- `description`(스킬 선택 때 읽힘)은 **한국어**로, 무엇을 하는지 한 문장 + 언제 쓰는지(사용자가 쓰는 말) 위주로 약 300자 안팎. 절차 요약은 본문으로. `<`·`>` 는 쓰지 않는다 — 스킬 목록에서 `&lt;` 로 바뀌고 그 뒤가 잘린다.
- 본문과 `references/*.md`(스킬 실행 때 읽힘)는 **영어**로 간결하게. 다른 스킬이 참조하는 절 번호(예: implement §1.5)는 유지한다.
- 본문에 출력 언어 한 줄: 스킬이 만드는 이슈·PR·보고는 저장소 설정 `language`(없으면 사용자 언어)를 따른다. 저장소에 그대로 나가는 출력물 틀(`assets/*-template.md` 등)은 그 언어로 둔다.

확인:

```bash
claude plugin validate .
```
