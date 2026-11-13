# 저장소 설정 `.claude/github-issue.yml`

저장소마다 다른 규칙을 둔다. 저장소 루트의 `.claude/github-issue.yml` 이고, 그 저장소에 커밋해 같이 관리한다. 없으면 스킬이 처음 쓸 때 사용자에게 확인해 만든다(SKILL.md §1).

모든 키는 선택이다. 없는 키는 기본값을 쓴다.

```yaml
# 이슈를 만들 저장소. 없으면 이 폴더의 `git remote get-url origin`.
repo: owner/name

# 이슈 본문 언어(ko, en …). 없으면 저장소 문서의 언어.
language: ko

# 제목 형식. {id} 와 {summary} 를 쓴다.
title_format: "[{id}] {summary}"

# ID 접두어. 비우면([]) 제목에 ID 를 쓰지 않는다.
id_prefixes: [AUTH, ORDER, ERROR]

# 본문 템플릿 경로(저장소 기준). 없으면 .github/ISSUE_TEMPLATE/ 이나 스킬 기본 템플릿.
# template: .github/ISSUE_TEMPLATE/task.md

labels:
  # 종류 라벨 — 이슈마다 하나.
  type: [bug, enhancement, documentation]
  # 영역 라벨 — when 에 맞으면 붙인다. color 는 6자리 hex(# 없이).
  areas:
    - name: "area:auth"
      color: 1d76db
      description: 인증
      when: src/auth/ 가 대상일 때
  # 사용자 검토가 남은 이슈. 쓰지 않으면 키를 지운다.
  review:
    name: needs-review
    color: d93f0b
    description: 사용자 검토·결정이 필요한 항목이 있음
  # 사용자 결정으로 보류한 이슈.
  on_hold:
    name: "status:on-hold"
    color: bfbfbf
    description: 사용자 결정으로 보류

# 완료 조건에 쓸 검증 명령(선택). implement·github-pr 스킬이 PR 전에 모두 돌린다.
verify:
  - cargo fmt --check
  - cargo clippy --all-targets -- -D warnings
  - cargo test

# 파일 안 코드 순서 확인(code-order 스킬, 선택). 언어 → 확인할 경로.
# implement·github-pr·pr-reviewer 가 verify 와 함께 호스트 Node 로 돌린다(설치된 플러그인의 스크립트).
# code_order:
#   rust: [src, examples, tests]

# verify 를 돌리는 데 필요한 환경(선택). implement 스킬이 구현 전에 check 를 돌려 보고,
# 실패하면 setup 을 제시하며 사용자에게 먼저 묻는다(부분 검증으로 진행할지 등).
# test_env:
#   needs: [PostgreSQL 16 (개발 compose 의 db), sqlx-cli 0.9]
#   setup: docker compose -f docker-compose.dev.yml up -d db
#   check: docker compose -f docker-compose.dev.yml exec -T db pg_isready
#   env: DATABASE_URL 은 .env 에서(값은 출력·커밋하지 않는다)

# 예전 이슈 파일을 ID → GitHub 번호 목록으로 남겼으면 그 경로(선택). 새 이슈도 한 줄 더한다.
# index_file: docs/OPEN_ISSUES.md

# 사용자가 이 설정을 정한 날짜.
decided: 2026-01-01
```

## 라벨 맞추기

설정의 라벨이 GitHub 에 없으면 만든다. `--force` 는 이미 있으면 색·설명만 맞춘다.

```bash
gh label create "<name>" -R <repo> --color <hex> --description "<description>" --force
```

## 설정 바꾸기

라벨을 더하거나 이름을 바꾸려면 사용자에게 확인하고 이 파일을 고친 뒤 라벨을 맞춘다. 이름을 바꿀 때는 `gh label edit "<old>" -R <repo> --name "<new>"` 로 바꿔야 붙어 있던 이슈에서 떨어지지 않는다.
