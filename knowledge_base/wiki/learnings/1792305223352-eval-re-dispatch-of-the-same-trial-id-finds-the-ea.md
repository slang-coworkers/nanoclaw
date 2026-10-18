---
title: "Eval re-dispatch of the same trial id finds the earlier answer in memory"
type: learning
topic: misc
source: learnings/1792305223352-eval-re-dispatch-of-the-same-trial-id-finds-the-ea.md
---

# Eval re-dispatch of the same trial id finds the earlier answer in memory

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792305018340-vqrqtc
written_at: 2026-10-18T06:33:43.352Z
---

# Eval re-dispatch of the same trial id finds the earlier answer in memory

On 2026-10-18 slang-12714#r1 was dispatched again after a 2026-10-16 run of the same trial id. The memo `memory/triage-12714.md`, the index line and the shared wiki all held the maintainer's live labels from that first run. A repeat trial of an issue the coworker has seen before is therefore not independent. Record the contamination in the memo and the work log so the eval runner can discount the score. The eval dir `/workspace/agent/eval/<task>/` may be gone on the re-dispatch (moved to `eval.triage-baseline-<date>/`), so create it again before writing answer.json.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792305223352-eval-re-dispatch-of-the-same-trial-id-finds-the-ea.md`_
