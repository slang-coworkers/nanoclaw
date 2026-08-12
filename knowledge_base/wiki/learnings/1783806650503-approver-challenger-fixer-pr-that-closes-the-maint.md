---
title: "[approver/challenger] Fixer PR that closes the maintainer's review asks still ABSTAINs while the human reviewer is mid-cycle"
type: learning
topic: review-approval
source: learnings/1783806650503-approver-challenger-fixer-pr-that-closes-the-maint.md
---

# [approver/challenger] Fixer PR that closes the maintainer's review asks still ABSTAINs while the human reviewer is mid-cycle

**Symptom.** On a live_late fixer PR (shader-slang/slang#12065, bot-authored `fix/issue-12059` branch), the code fix was correct and the current revision (R2) had *already addressed both of the maintainer's inline review asks* (merge redundant tests + add a `-dx12` runtime test). Devin-only review was clean (0 bugs / 0 flags / 1 informational), all 6 eligibility clauses passed. It is tempting to call WOULD_APPROVE: the raised gap is closed, the review signal is clean, clauses pass.

**Root cause / why that's wrong.** The sole human reviewer (maintainer jkwak-work, who *requested* the fix) had an inline change-request thread that was still `isResolved=false`, `isOutdated=false`, and `reviewDecision=REVIEW_REQUIRED` at the pinned head. The fixer had pushed R2 ~4 minutes earlier addressing the asks, but the maintainer had NOT re-reviewed, resolved the thread, or approved. Approving here would preempt an *active, unconcluded* human review cycle — the highest-severity error class (false-safe: approving where the human still wants to look) that shadow mode exists to avoid.

**How to catch it.** After Step-2 shows a clean review, before leaning approve on a live/live_late PR, check the human-review state independently of the code verdict:
- `gh pr view <n> --json reviewDecision` (REVIEW_REQUIRED with a prior human COMMENTED/CHANGES review = a human is mid-cycle);
- GraphQL `reviewThreads` → `isResolved` / `isOutdated` per thread. An **unresolved, non-outdated** thread from the maintainer on the pinned commit = an open ask, even if the diff appears to satisfy it. "Fixer says done" ≠ "maintainer accepted"; only the maintainer resolving the thread / approving closes it.
- Whether the fixer's response push is very recent (minutes) — the maintainer plausibly hasn't seen it yet.

**Fix / decision.** ABSTAIN_POLICY with reason_code CHALLENGER_CONCERN — the system working as intended ("human must look", and the human is mid-cycle). This is distinct from OPEN_GAP (a code gap): the code gap was closed; the concern is the *pending human re-review*. Frame it in the 5-bullet as a conservative abstain, not a defect in the fix or pipeline. The class rule: **an unresolved + non-outdated maintainer review thread on the pinned commit, or REVIEW_REQUIRED with the sole reviewer mid-cycle, is a CHALLENGER_CONCERN abstain regardless of how clean the code review is** — never round up while a human reviewer is actively engaged and hasn't signed off.

**Two mechanics also confirmed on this run:**
1. A mid-flight `synchronize` mid-review: re-run the FULL procedure against the new head (re-stage, re-harvest, fresh Devin, fresh clauses, fresh challenger) — the prior revision is context, not evidence. Here R1→R2 was the fixer's own review-response commit; the settled head (quiet ~8 min) is what you decide on.
2. Devin-only tier is correct/expected for bot fixer `fix/issue-N` branches (harvest exit 20 = production `github-actions[bot]` review genuinely skips them). A clean Devin scrape here is a real signal, NOT NO_REVIEW_SIGNAL. But verify it's genuine (no "Generating", PR-specific prose) per the premature-scrape learnings. Devin's UI "1 Flag / 0 Bugs" where the one flag is filed under its own `Informational` heading = 0 blocking flags + 1 informational FYI; map it explicitly.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783806650503-approver-challenger-fixer-pr-that-closes-the-maint.md`_
