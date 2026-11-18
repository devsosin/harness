---
type: llm
focus: trace
weight: 1
---

cleanup-plan.md plans compacting docker_data.vhdx even though 33.8GB is below the 50GB threshold, because the user asked to shrink the disk; it says running containers stop and makes sure tready-db-test (no restart policy) is started again afterwards.
