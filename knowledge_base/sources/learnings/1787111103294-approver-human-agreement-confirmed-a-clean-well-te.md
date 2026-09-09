---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786990775788-cvhll8
written_at: 2026-08-19T03:45:03.294Z
---

# [approver/human-agreement] CONFIRMED: a clean, well-tested .github/** workflow-tooling PR merges as-is — the v0-shadow-wide widening (dropping .github/** from protected) is calibrated, and a stale Step-0 "protected-path is terminal" prior would have manufactured a false abstain

## Signal
slang PR #12579 (widen linked-issue assignee inheritance owners→source-internal, in `.github/workflows/pr-board-sync.yml` inline github-script JS + unit test + docs; MEMBER author). I decided **WOULD_APPROVE** on 2026-08-17. It **MERGED 2026-08-19 at my exact decided commit, 0 interval commits, reviewDecision=APPROVED** (human reviewed + approved, merged by author). Confirmed HIT — shipped byte-identical to what I approved.

## Why this is worth keeping (the transferable calibration)
Step-0 recall confidently predicted a TERMINAL `ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths` because 3/4 paths were under `.github/**`, citing the wiki's protected-path learnings (slang-rhi#804 etc.). That prior was STALE — it described the pre-2026-08-04 `v0-shadow` / `v0-shadow-relaxed` policy. The effective mounted `v0-shadow-wide` deliberately removed `.github/**` and `*.yml` from `protected_paths` (human-signed). Running `eval-clauses.py` refuted the prior (all 6 clauses pass), I decided WOULD_APPROVE, and the **human merge confirmed the live-policy read was right**, not the stale-prior read.

Lesson, transferable to the next `.github/**` / workflow-tooling PR:
1. **This class of PR is now WOULD_APPROVE-eligible and, when clean+tested, merges as-is.** A small, well-tested workflow/tooling change from a trusted author with a clean head-current signal is a normal approval under the current shadow-wide policy — do not reflexively abstain on the `.github/` prefix.
2. **When a Step-0 prior and the Step-1 clause script disagree about a policy predicate, the clause script (reading the LIVE mounted policy) wins.** The prior is the stale artifact to flag, not the clause result. The merge outcome here is the empirical confirmation of that ordering.
3. The productive challenger probe for a workflow-JS PR was NOT policy-path fear but: do the referenced helpers exist / are they in scope (no ReferenceError), and does the PR's own unit test pass at head against the ACTUALLY-INLINED JS (extract-workflow-js.js)? That (19/19 pass) + safe null-roster degradation is what made the approval sound — and it held up at merge.

Caveat retained: the policy `_comment` says `.github/workflows/**` MUST be re-protected before real enforcement (supply-chain surface). So "merges as-is in shadow mode" is a measurement fact, not a permanent judgement that CI-workflow PRs are low-risk.
