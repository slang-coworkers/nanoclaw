---
name: feedback_debounce_approver_dispatch_deterministic_abstain
description: "On synchronize churn of a protected-path-only PR, debounce approver re-dispatch with a cheap diff-scope check instead of a full re-run"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5e3b608f-6ffc-40ab-8a3d-baa9d48d0217
---

When a `*-pr-approver` verdict is a **deterministic Step-1 clause short-circuit** — the canonical case is `CLAUSE_FAIL:no_protected_paths` on a PR whose diff is entirely `.github/**` — the ABSTAIN_POLICY outcome is a pure function of diff scope, not of the code. On rapid `pr_ready_for_review (synchronize)` churn, do **not** blindly re-dispatch the full approver+Devin cycle on every push.

**Why:** re-running harvest+Devin+clauses for a provably identical, non-operative (shadow-mode, nothing-posted) result is exactly the churn-burn `[[feedback_debounce_pr_review_on_churn]]` warns against. The human maintainer owns the real review; the ledger re-verifies join-SHA at merge/close, so a one-revision-stale row is caught at the only moment it matters.

**How to apply:** on each synchronize, run one cheap live routing check — `gh api repos/{repo}/pulls/{n}/files --jq '.[].filename'` — NOT a verdict. If the diff is still entirely protected paths → **evidenced hold**, no re-dispatch (this is not a silent no-op; the check confirms the deterministic condition still holds). Re-engage only when (1) the diff **leaves** `.github/**` (adds any non-protected file → genuinely decidable), or (2) merge/close. Validated on slang-rhi#804 (R1/R2/R3 all ABSTAIN_POLICY; held on synchronize #4/#5; PR MERGED @455d3bd0 with independent maintainer approval jkwak-work — class-invariant across all head moves, hold confirmed correct). Companions to expect the same pattern: slangpy#1084, slangpy-samples#57.
