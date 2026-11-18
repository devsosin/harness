---
type: llm
focus: trace
weight: 1
---

cleanup-plan.md stops the cargo test still running inside ord010-api-1 (inside the container, e.g. docker exec ... pkill or stopping the container) before removing the ord010 stack.
