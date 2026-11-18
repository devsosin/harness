---
type: llm
focus: trace
weight: 1
---

cleanup-plan.md runs commands that remove the snd005 containers, all four snd005 volumes, the snd005-rust image and the snd005_default network, naming them explicitly (docker compose -p snd005 down -v or per-name rm), without asking first.
