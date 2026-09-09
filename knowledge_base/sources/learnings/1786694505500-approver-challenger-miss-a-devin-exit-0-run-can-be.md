---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784269307766-ml7a4j
written_at: 2026-08-14T08:01:45.500Z
---

# [approver/challenger-miss] A Devin exit-0 run can be CACHED-STALE — verify its cited symbols exist in the current diff; on a Devin-only tier a stale Devin is NO head-current review signal

## Symptom
slang-rhi#797 was WOULD_APPROVE'd at head `b34042ac` (a large batched-resolve design), author self-parked to draft, then re-opened as a **materially different, much smaller** 2-file change at head `3044352d` (base had advanced; master absorbed the old design). On the re-gate, the Devin fetch returned **exit 0** but its analysis described the OLD `b34042ac` batched design (`m_pendingTimestampQueryResolves`, `kMaxPendingTimestampQueryResolveRanges`, `d3d12-command.h:39-48`, submit()/waitOnHost(), a 5th test) — **none of which is in the current 2-file diff**. I initially treated exit 0 + my own source inspection + real-HW CI as sufficient for WOULD_APPROVE.

## Root cause
Devin's review page is CACHED per PR; a fetch returns whatever Devin last analyzed, which after a rebase/reopen can be a superseded revision. Exit 0 means "the fetch succeeded," NOT "the analysis is head-current." And on the slang-rhi **Devin-only fallback tier** (no production github-actions[bot] review), Devin IS the review signal — so a stale Devin means there is **no head-current independent review signal at all**. The skill is explicit that challenger source-inspection + CI can only ADD CAUTION, never SUBSTITUTE for a missing review signal or upgrade a verdict. Codex's DECISION_REVIEW caught this correctly: WOULD_APPROVE without a head-current review signal is not a clean conjunction.

## How to catch it
- After any Devin run, grep its output for symbols/lines that must exist in the CURRENT diff. If Devin cites files/lines absent from `gh pr diff`, it analyzed a stale revision — treat as no head-current signal.
- Especially suspect after a self-park→re-open or a rebase (the head moved; the diff shape may have changed entirely).
- On a Devin-only tier, "stale Devin" ⇒ ABSTAIN_INFRA:STALE_STAGE unless you can repair it.

## Fix (repair, don't abstain if you can catch up)
`devin-fetch.sh` has **no force/refresh flag** (it only scrapes the rendered DOM). To force a catch-up: clear the stale browser state (`agent-browser close --all` + `rm -rf /tmp/agent-browser-chrome-* /tmp/agent-browser-profile-*`) then re-run the fetch. This made Devin re-render the current head; the re-run analyzed the exact 2-file change and returned 0 bugs/0 flags — a genuine head-current signal. Only if the re-fetch still can't reach head do you abstain (STALE_STAGE). Outcome: PR merged at my exact decided head ⇒ WOULD_APPROVE agreed with the human verdict.
