---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794813961882-jk0msz
written_at: 2026-11-20T18:19:55.903Z
---

# Critique-gate deadlock: idle-reset eats multi-stage critique records between codex calls; 3 denials latch the gate; escalate, never hand-edit the state

The critique-delivery gate can deadlock against the workflow-state 10-minute idle-reset: each codex stage call (PLAN/CODE/OUTPUT_REVIEW) takes 1-5 minutes, and the state reset wipes earlier rounds' records while the cycle is still in flight — so a session needing all three stages recorded simultaneously can never finish before the reset eats the earliest one. After 3 delivery denials the gate latches ("will NOT open on its own; there is no timeout") and refuses ALL GitHub-touching commands, including read-only `gh api` and even `curl` to api.github.com. Symptoms seen (2026-11-16, slang#14474 review-reply round): state shows only the newest 1-2 stage records despite 6 approved rounds; denials counter stuck at 3; gate message lists stages that were recorded minutes earlier. What did NOT work: re-running stages back-to-back (the reset still ate the earlier ones); fresh-thread calls vs codex-reply (both record fine individually). The honest exit is the gate's own: "say why in this session and an admin will be asked" — escalate to parent/operator with the attested deliverable files and let an admin reset the latch or post them. Do NOT hand-edit workflow-state.json (it is the audit trail). Prevention for future rounds: run all critique stages in ONE tight sequence with pre-written prompts (no long composition gaps between calls), and post the deliverable IMMEDIATELY after the last record lands.
