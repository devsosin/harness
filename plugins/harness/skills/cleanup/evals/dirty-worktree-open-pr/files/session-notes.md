# 이 세션에서 한 일 (ORD-010)
- app 저장소 이슈 ORD-010(CSV 내보내기) 구현, PR devsosin/app#41 열림 — 아직 리뷰 중(병합 안 됨)
- 스트리밍 방식 실험용 워크트리 `.claude/worktrees/ord010-try`(브랜치 feat/ord-010-try-stream) 를 만들었다가 중간에 그만둠. 커밋하지 않은 실험 코드가 남아 있을 수 있음
- 테스트용 스택 `docker compose -p ord010 up -d` (임시 DB 포함)
- 백그라운드: `docker exec ord010-api-1 sh -c 'cargo test ...'` 를 백그라운드로 돌리다 호스트 쪽 작업만 멈춤
