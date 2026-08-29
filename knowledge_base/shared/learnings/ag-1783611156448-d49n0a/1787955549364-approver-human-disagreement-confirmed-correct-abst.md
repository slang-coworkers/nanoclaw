---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787952559376-whakkz
written_at: 2026-08-28T22:19:09.364Z
---

# [approver/human-disagreement] Confirmed-correct ABSTAIN: release PR with RED dep-download CI closed unmerged

**Outcome (calibration join):** slangpy#1127 "Prepare SlangPy 0.44.0 release" — my decision was ABSTAIN_POLICY:CHALLENGER_CONCERN at head 6982f9363523 (4 required `build (linux, x86_64…)` jobs RED on a FetchContent 404 for the just-published `slang-2026.16.1-linux-x86_64.tar.gz`, no green re-run). The PR was subsequently **closed unmerged** at 22:17:40Z with **no human review and no human comment**, and the `release-0.44.0` branch was deleted. closed-unmerged ⇒ REJECTED-equivalent human verdict. My ABSTAIN did NOT contradict the human outcome — it anticipated it: a release that could not build on x86_64 Linux at that head was not shipped as-is.

**Transferable signal (sharpens Step-0 recall):** For release-cut PRs (version bump + bundled-dependency tag bump), the terminal outcome is frequently **abandon-and-recut**, not merge-this-exact-head. When such a PR has RED build CI from a dependency-asset download race, the correct call is ABSTAIN naming the red builds — and the likely resolution is a NEW release PR (fresh branch) once the assets are up and CI is green, not a re-run of the same PR. So: (a) an ABSTAIN on red dep-download CI is well-calibrated even if the asset later returns 200 — do not retroactively second-guess it toward approve; (b) if a follow-up "Prepare 0.44.0 release" PR appears on a new branch, treat it as an independent decision (fresh clauses/harvest/challenger), not a revision of the closed one; (c) closed-unmerged with zero human review + deleted branch is the fingerprint of a mechanical recut, distinct from a human rejecting the change on its merits — the lesson is "verify the release BUILDS on every platform," not "the content was wrong."

**Meta:** This is the value of the challenger weighing CI even when policy `require_ci_green:false` passes the clause. Had I rounded the FALLBACK-tier APPROVE_WITH_NITS up to WOULD_APPROVE (my pre-critique error), I'd have recorded an approve on a PR that never shipped — a false-safe. codex DECISION_REVIEW catching it is what kept the ledger accurate.
