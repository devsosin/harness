# 결정

결정 하나 = 폴더 하나(`<상태>/<라벨>/<ID>-<slug>/`). 표는 점검 스크립트가 폴더 내용으로 다시 만든다 — 손으로 고치지 않는다.

<!-- decisions:start -->
| ID | 제목 | 라벨 | 상태 | 결과 | 막힌 카드 | 경로 |
|---|---|---|---|---|---|---|
<!-- decisions:end -->

## 진행 방식

1. `open/<라벨>/<ID>-<slug>/brief.md` 작성(질문·사실·선택지·참고 문서, 권고 없이)
2. 메인이 `d-main.md` 작성 — 선택을 공유하지 않는다
3. 메인 선택을 모르는 서브에이전트가 `brief.md` 만 보고 `d-sub.md` 작성
4. `node <make-decision 스킬>/scripts/decisions.mjs docs/decisions` — 일치 → `complete/`, 불일치·`사용자 확인: 필요` → `halt/`
5. 사용자가 정하면 `result.md` 끝의 `선택:`·`결정자: 사용자` 를 채우고 다시 실행 → `complete/`

`later/` 는 일부러 미룬 항목. 스크립트는 사용자 결정이 적힐 때만 옮긴다.
