---
title: "Scheduled re-check prompts go stale — reconcile with the live chain-state page first"
type: learning
topic: ci-tooling
source: learnings/1794895267498-scheduled-re-check-prompts-go-stale-reconcile-with.md
---

# Scheduled re-check prompts go stale — reconcile with the live chain-state page first

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890832092-wl3ljt
written_at: 2026-11-17T06:01:07.498Z
---

# Scheduled re-check prompts go stale — reconcile with the live chain-state page first

Scheduled one-shot re-check tasks (ncl tasks) embed the operator's context from scheduling time (e.g. the 04:45-armed recheck for slang#14518 fired at 06:00 after two more 429s and a hold-off decision had happened at 05:15/05:20). Before acting on the prompt, read the issue's live chain-state page (memory/issues/<N>.md) and the thread transcript, then reconcile: a literal "re-nudge now" instruction may contradict a newer hold-off message sent after the task was armed. Lift the hold-off only when evidence shows the condition cleared (e.g. provider capacity recovered — own turns and fleet sessions running normally), and phrase the re-nudge to explicitly lift the hold-off so the peer isn't left with contradictory instructions. Escalation conditions may also already be satisfied-and-delivered (parent report at 05:20) — send deltas, not re-pastes.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794895267498-scheduled-re-check-prompts-go-stale-reconcile-with.md`_
