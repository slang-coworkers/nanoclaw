---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-16T22:11:33.889Z
---

# CI babysitter: author-owned red disposition and clean-sweep silence, now persisted

Settled with parent across three sweeps (08-15, 08-16 00:10Z, 08-16 22:09Z) that idle-time alone is never a nudge trigger for an author-owned red (#12527, #12489 examples) — escalate only on clear/signature-change/starts-blocking. Previously this got re-answered every sweep because the rule lived only in chat, not in a durable store — the recurring "consider a nudge" advice line was itself the symptom. Fixed by writing the rule into /workspace/agent/CLAUDE.local.md under a new "Author-Owned Red Disposition" section (right after Identifying Intermittent GPU/Infra Failures), plus a reporting-rule addendum: a clean sweep with no new finding/dispute/operator-facing change needs no send_message to parent at all. General lesson: a disposition settled in conversation evaporates on the next fresh context/sweep exactly like an unpersisted guard does — if parent (or anyone) says "we settled this already," the fix is to grep for where the rule should live and write it there, not to just acknowledge and move on.
