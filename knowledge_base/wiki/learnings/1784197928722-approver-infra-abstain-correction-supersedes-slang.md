---
title: "[approver/infra-abstain] CORRECTION+SUPERSEDES — slang#12055 commit_id-omission abstain is FIXED via Option 1 (delegate path retired), NOT an open 'stamp the handoff' task"
type: learning
topic: review-approval
source: learnings/1784197928722-approver-infra-abstain-correction-supersedes-slang.md
---

# [approver/infra-abstain] CORRECTION+SUPERSEDES — slang#12055 commit_id-omission abstain is FIXED via Option 1 (delegate path retired), NOT an open "stamp the handoff" task

**Supersedes the forward-looking claim in the slang#12055 JOIN atom** ("[approver/infra-abstain] JOIN: commit_id-omission infra-abstain ... merged-APPROVED at exact decided head", ts 1784197707754, point #1) and refines the companion "[approver/infra-abstain] reviewer-coworker review-doc omits commit_id/_approver_result" (ts 1784186159657). Both were written before the fix landed and frame the remaining work as "fix the Verity handoff to stamp the block" — **that framing is now stale and points at the REJECTED option.** This atom is the current truth; prefer it on recall.

**What the earlier atoms got wrong (only the forward-looking priority, not the calibration):**
- They said: *"Priority: fix the Verity handoff to stamp the full contract-required result block; every reviewer-coworker-path PR is currently abstaining on commit_match."* That was true **at decision time** but is no longer — and stamping the handoff was **Option 2, which was rejected.**

**The actual root cause (verified against on-disk source, all three instruction layers diffed):** NOT a handoff missing a stamp. It was the stale `.instructions.md` "Verity" overlay (dated 2026-07-09) still routing the approver's decision-input review to the **`slang-reviewer` coworker** (delegate path), contradicting the newer **deployed `SKILL.md` (07-15) + `/slang-pr-approve` workflow**, which had already moved to **harvest+Devin self-synthesis** — a path that stamps `_approver_result:true` + `commit_id = commit_sha` **by construction**. #12055 abstained because the stale overlay took the delegate path, whose 3-reviewer doc omits those fields.

**Resolution — Option 1 (retire the delegate path), applied & verified 2026-07-16 ~07:44Z:**
- `.instructions.md` Verity overlay rewritten to the harvest+Devin self-synthesis model (6 targeted edits; all six invariants preserved: no-GitHub-write, critique-gating, R0-pinning, human-outcome join, never-round-up, untrusted-input).
- `request_restart` → recomposed `CLAUDE.md` + live `.instructions.md` grep-confirmed clean; no residual `slang-reviewer`/dispatch/three-reviewer language. The unstamped-doc path **no longer exists** in the approver's instructions. Orchestrator verified twice and marked the contradiction resolved.

**Actionable state now:**
- ❌ Do NOT re-prioritize "stamp the Verity handoff." The path it would patch is retired; reviewer-coworker-path PRs are no longer a live class for this approver.
- ✅ Residual watch item ONLY: `NO_REVIEW_SIGNAL` = nothing harvestable on GitHub (no `github-actions[bot]`/`coderabbitai[bot]` review) **AND** no Devin signal → record `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` and **flag Main as a reviewer-webhook routing gap** (Main owns reviewer webhook routing). **Never re-dispatch a reviewer to paper over a missing harvest input.**

**The calibration signal in the JOIN atom's point #2 remains fully valid** — a single LOW-severity test-durability gap on an otherwise-clean, principled, trusted-author producer-side fix is high-probability human-approve-and-merge (the #12037/#12041/#12064 cluster); frame such a gap as low-concern-conservative withhold-on-SAFE, not "PR is risky." And the meta-lesson stands: an infra-abstain forced purely by a staging defect on a clean, human-approved, merged-as-is PR is exactly why the fix mattered — anchor it to "already fixed via Option 1," not "still to do via Option 2."

**Meta-lesson for the harness owner / future me:** when closing a loop in a FRESH session, a JOIN/calibration learning captured mid-incident can carry a forward-looking "priority: fix X" that a later session already resolved. Before acting on such a priority, verify current on-disk state — the fix may have landed, and the named option may not even be the one that was chosen.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784197928722-approver-infra-abstain-correction-supersedes-slang.md`_
