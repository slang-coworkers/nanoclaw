---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786749174835-feop8m
written_at: 2026-08-15T03:25:25.591Z
---

# [approver/critique-infra] OUTPUT_REVIEW codex 429s — back off and retry, don't premature-abstain

**Symptom:** On PR #12548 (WOULD_APPROVE), the mandatory OUTPUT_REVIEW critique (`mcp__codex__codex`, STAGE: OUTPUT_REVIEW) returned `exceeded retry limit, last status: 429 Too Many Requests` four times over ~5 minutes. The delivery gate (`gate-critique-on-deliver.sh`) blocks `record_decision`/`[Approval Decision]` until OUTPUT_REVIEW is recorded with verdict=approve, so a WOULD_APPROVE/BLOCK cannot ship while codex is rate-limited.

**Root cause:** Transient endpoint rate limiting on the codex MCP server, NOT a review outcome and NOT a harness defect. The 429 is a turn-level transport failure — it says nothing about the decision.

**How to catch / handle it:**
- A 429 on the critique call is CRITIQUE_UNAVAILABLE-shaped but transient. Do NOT immediately record `ABSTAIN_INFRA:CRITIQUE_UNAVAILABLE` — that abstains a sound decision on a passing endpoint's bad minute. Back off (I used 60s → 180s → 300s via a background `sleep` loop; foreground `sleep` is blocked) and retry the SAME critique call. It cleared on the ~5th attempt.
- The gate is fail-closed and has a 3-denial soft-cap→escalation, but the 429 never reached a `send_message`/`record_decision` attempt (it failed at the codex call itself), so no denial was counted — retrying the critique is free of that cap.
- Only escalate to the operator / consider ABSTAIN_INFRA if the endpoint stays down long enough to threaten the SLA on the routed PR.

**Ordering rule confirmed (memory-critical):** finish ALL memory/learning writes BEFORE the OUTPUT_REVIEW round. `track-edits.sh`'s allowlist exempts `/workspace/agent/memory/*` and `/workspace/.claude/*` but NOT the native auto-memory tree (`/home/node/.claude/projects/.../memory/`), and NOT the `work/<pr>/` artifacts — a post-OUTPUT_REVIEW edit to either bumps `edits_since_critique` and the freshness check denies delivery until you re-run OUTPUT_REVIEW. (Corollary: an OUTPUT_REVIEW must-fix that you fix by editing `investigation.md` REQUIRES a re-run anyway — freshness + attested-hash both reset.)

**Transferable:** For any critique-gated approver decision, treat critique-endpoint 429s as retryable transport, sequence all mutations before the final OUTPUT_REVIEW, and keep the `work/<pr>/` artifacts frozen after it.
