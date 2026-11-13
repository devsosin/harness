---
name: github-pr
description: 이슈 하나를 PR 하나로 올리는 방법 — 작업 단위 커밋, diff 확인, 이슈 제목과 1:1 인 PR 제목, 커밋 요약 + 검증 + Closes 본문. 사용자가 "PR 만들어/올려/생성해", "커밋하고 PR", "작업 마무리해서 올려" 라고 하거나 이슈 작업을 끝내고 올릴 때 쓴다. 이슈가 없으면 먼저 github-issue 스킬로 만든다.
---

# GitHub PR

PR 하나 = 이슈 하나. 일의 중심은 구현과 diff 확인이고, PR 본문은 이슈를 다시 쓰지 않고 커밋 요약만 둔다.

## 1. 올리기 전
- 이슈 ID·번호를 확인한다(제목 `[ID] 요약`). 다른 저장소 이슈면 `owner/repo#N`.
- 브랜치: `<type>/<id-소문자>-<영어 kebab 요약>`(예: `refactor/order-002-remove-v1-order`). 도구가 만든 브랜치(`claude/…` 등)에서 시작했으면 첫 push 전에 `git branch -m` 으로 이 이름으로 바꾼다. 기본 브랜치에 직접 커밋하지 않는다.
- 저장소 `.claude/github-issue.yml` 의 `verify`(없으면 저장소 문서의 검증 명령)를 돌려 통과시킨다. 돌릴 수 없는 검증이 있으면 사용자에게 먼저 묻고(implement 스킬 §1.5), 부분 검증으로 올리면 draft PR 로 연다.
- **diff 를 직접 읽는다**: `git status`, `git diff --stat`, 전체 `git diff`. 의도하지 않은 변경(비밀값·`.env`·임시 파일·포맷만 바뀐 파일·다른 작업)이 없는지 본다.
- 저장소가 커밋 전 검토를 요구하면(CLAUDE.md 등) 변경을 보여 주고 승인 뒤 커밋한다.

## 2. 커밋

Conventional Commits 형식에 이슈 ID 를 붙인다 — `git log --oneline` 만으로 종류와 이슈가 보이게.

```text
<type>: <요약> (<이슈 ID>)

<본문 — 왜 바꿨는지, 무엇이 달라지는지. 무엇을 했는지는 diff 가 보여 준다>

Refs #<이슈 번호>
<저장소·환경이 요구하는 trailer(Co-Authored-By 등)>
```

- `type`: `feat`(기능) · `fix`(버그) · `refactor`(동작 그대로 구조 변경·제거) · `test`(테스트만) · `docs`(문서만) · `build`(의존성·빌드·Docker) · `chore`(개발 환경·설정·스크립트). 동작을 바꾸면 `refactor` 가 아니라 `feat`/`fix`.
- 요약: 명령형, 72자 이내, 끝에 마침표 없음. 언어는 저장소 기존 커밋을 따른다(없으면 영어).
- 이슈 연결은 `Refs #N` 만 — `Closes` 는 PR 본문에 둔다(커밋이 기본 브랜치에 들어가는 순간 이슈가 닫히는 것을 피한다).
- 작업 단위마다 커밋 하나, 이동과 수정은 다른 커밋. 한 PR 에 여러 커밋이 들어가는 것이 기본이다.
- 파일은 경로로 추가한다(`git add -A`·`git add .` 금지). 이름 바꾸기는 옛 경로와 새 경로를 함께(`git add -A <옛> <새>`). 커밋 전에 `git diff --cached --stat` 으로 의도한 파일만 들어갔는지 본다.

## 3. PR 만들기
- 제목 = 이슈 제목 그대로(`[ID] 요약`) — 이슈와 1:1.
- 본문은 [assets/pr-template.md](assets/pr-template.md): 커밋별 요약, 검증 결과, 이슈 연결. 이슈의 배경·결정은 다시 쓰지 않는다.
- 이슈 연결: 이 PR 로 이슈의 작업 내용을 모두 끝내고 열린 검토 항목이 없으면 `Closes #N`, 아니면 `Refs #N`.
- 본문은 임시 파일에 쓰고 `gh pr create -R <repo> --base <기본 브랜치> --title "<이슈 제목>" --body-file <tmp>`.
- 이미 PR 이 있으면 커밋을 더 push 하고 `gh pr edit --title/--body-file` 로 맞춘다.

## 4. 올린 뒤
- 기본 브랜치가 앞서 충돌하면 force push 대신 기본 브랜치를 병합해 해결하고 verify 를 다시 돌린다. 선행 PR 의 브랜치 위에서 작업해야 하면 그 브랜치를 병합한다(rebase·force push 하지 않는다).
- 여러 PR 을 순서대로 병합할 때는 앞 PR 병합 후 다음 PR 에 기본 브랜치를 병합하고 verify 를 다시 돌린 뒤 병합한다.
- 리뷰 반영은 새 커밋으로. 병합은 사용자가 요청할 때만 한다.
- 사용자에게 PR 링크(`[owner/repo#N](URL)`)와 확인하지 못한 것을 알린다.
