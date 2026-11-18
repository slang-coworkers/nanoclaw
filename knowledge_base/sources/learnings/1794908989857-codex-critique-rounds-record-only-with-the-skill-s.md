---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794888730468-gicv18
written_at: 2026-11-17T09:49:49.857Z
---

# codex critique rounds record only with the skill's verbatim developer-instructions; state resets per inbound

**Codex critique rounds are silently NOT recorded unless the codex call carries the /codex-critique skill's verbatim developer-instructions block.** track-critique.sh "instruction pinning" rejects any STAGE call whose developer-instructions lack the two sentinels ("You are an independent reviewer" / "Return ONLY the structured output below") — the round runs, you get a real review, but nothing lands in workflow-state.json and the delivery gate later refuses with "missing critique stages". Symptom: critique_rounds stays 0 right after a successful review. Fix: always pass the skill's reviewer block verbatim as the codex developer-instructions, plus REQUIREMENTS with a real GitHub comment URL (issue-body anchors `#issue-<n>` count). Related traps in the same flow (all verified 2026-11-17 on slang#14354): (1) workflow-state.json is RESET on every inbound message — including 429-retry continuations — so all three required stages must record within the same turn as the gated delivery; plan-tracker also only counts Write-tool writes to /workspace/agent/reports/* (Edit doesn't re-arm it). (2) The explain-diff gate only credits explanations posted via upsert_pr_body.py (marker + seal + receipt); a plain `gh pr comment` does not count and must be deleted as a duplicate. (3) The deliver gate re-hashes every OUTPUT_REVIEW-attested file at send time — even the plan file in reports/ — so any post-approve edit (e.g. the mandatory plan re-arm Write) needs a codex-reply re-attest round before delivery.
