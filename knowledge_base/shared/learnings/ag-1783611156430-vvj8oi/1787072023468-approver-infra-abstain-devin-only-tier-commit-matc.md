---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787069167721-fc70ed
written_at: 2026-08-18T16:53:43.468Z
---

# [approver/infra-abstain] Devin-only tier commit_match passes by fiat — a STALE Devin analysis is only caught by cross-checking its cited line-numbers/findings against the head

**Symptom.** On a bot-authored slang PR (production claude-code-action review skipped, harvest exit 20 → **Devin-only fallback tier**), Step-1 `commit_match` PASSED and Devin reported "0 bugs / 0 flags", which reads as a clean APPROVE. But Devin had actually analyzed the PARENT commit, not the pinned head — so the whole verdict was about code that no longer exists at head.

**Case:** shader-slang/slang#12194 @ head `9ae5301b77cb` (2026-08-18). Devin's lone informational note cited `isStageOnlyRequirement` "does not filter multi-stage stage-only requirements — slang-check-shader.cpp:**161-171**". Git proof:
- PARENT `4a0e6eba`: `isStageOnlyRequirement` at **lines 164-172**, one-way `CapabilitySet((CapabilityName)stageAtom).implies(CapabilitySet{capSet})` — exactly the non-filtering shape Devin described.
- HEAD `9ae5301`: same fn MOVED to **lines 172-181** and reworked to a **bidirectional** projection (`stageCaps.implies(x) && x.implies(stageCaps)`) that FIXES multi-stage filtering (it was the fix for jhelferty's 08-14 review comment).
Devin's line citation AND its finding both match the parent. Corroborated by `review/devin-commit-status.txt == "unknown"` (freshness NOT confirmed "up to date").

**Root cause.** On the Devin-only tier the synthesis writes `commit_id = commit_sha` by *convention* (Devin is assumed head-current), so `eval-clauses.py`'s `commit_match` passes structurally even when Devin's actual content proves it reviewed an older commit. There is no data-level check that Devin's analysis is head-current — and Devin is the SOLE review signal on this tier, so a stale Devin = no head-current review signal at all.

**How to catch it (mechanical, in Step 3 for the Devin-only / fallback tier).** Before trusting a Devin verdict:
1. Read `review/devin-commit-status.txt`. Anything other than "up to date" (esp. "unknown"/"out of date"/"behind") ⇒ treat the signal as unverified.
2. Cross-check every file:line Devin cites against the pinned head with `git show <head>:<file> | grep -n`. If Devin's cited line numbers or the code it describes match the PARENT (or any non-head commit), Devin analyzed stale code.
3. A Devin finding that describes a shape the head *already reworked* is the tell — the head's own diff tells you what changed; if Devin talks about the pre-diff shape, it didn't see the diff.

**Fix / decision.** Stale sole-signal ⇒ **ABSTAIN_POLICY, reason_code = STALE_STAGE** (infra family). Do NOT round up to WOULD_APPROVE on your own code read — the approver decides FROM the review signal and must not substitute a self-review for a stale one (skill Hard rules). Independent reassurance (CI green incl. test-slang-rhi, clause pass, all human comments addressed) does not manufacture a head-current review signal. "Inability to complete the check ⇒ ABSTAIN."

**Transferable rule for Step-0 recall on similar PRs:** any Devin-only fallback tier (bot-authored / fixer / Claude-branch PRs where production review is skipped) MUST have Devin's freshness affirmatively confirmed against the pinned head — `commit_match` passing is necessary but NOT sufficient there, because it's satisfied by convention rather than by evidence.
