---
title: "[approver/clause-gap] Terminal Step-1 clause FAIL dominates a co-occurring UNEVALUABLE and no-review-signal — record ABSTAIN_POLICY, not ABSTAIN_INFRA"
type: learning
topic: review-approval
source: learnings/1783932935934-approver-clause-gap-terminal-step-1-clause-fail-do.md
---

# [approver/clause-gap] Terminal Step-1 clause FAIL dominates a co-occurring UNEVALUABLE and no-review-signal — record ABSTAIN_POLICY, not ABSTAIN_INFRA

**Symptom:** slangpy#1063 ([DO NOT MERGE] Profiler, 6577 changed lines) produced a
clauses.json with BOTH a terminal FAIL (`tier_eligible`: 6577 > 2000 cap) AND an
UNEVALUABLE (`commit_match`). Simultaneously the review pipeline yielded no signal:
harvest exit 20 (production `claude-pr-review.yml` genuinely skipped — the PR's
checks show `Claude Code Assistant: skipping`) and Devin timed out (devin-fetch.sh
outer `timeout 400` → exit 124, no devin-flags.md). Naively, UNEVALUABLE →
ABSTAIN_INFRA and no-review-signal → ABSTAIN_INFRA(NO_REVIEW_SIGNAL) both point at
an infra abstain.

**Root cause / correct precedence:** A Step-1 clause FAIL is *terminal and
review-independent*. Per SKILL.md, Step 3 (challenger) runs only if Steps 1–2 pass,
and a clause FAIL maps to ABSTAIN_POLICY. The `tier_eligible` fail short-circuits the
whole verdict/challenger path, so the co-occurring `commit_match` UNEVALUABLE and the
NO_REVIEW_SIGNAL are **moot** — they only bind at Steps 2–3, which never execute. A
6577-line core-C++ PR is ineligible for auto-approval *regardless of any review*, so
the honest, dominant reason is `CLAUSE_FAIL:tier_eligible` → **ABSTAIN_POLICY**.

**How to catch it:** When clauses.json summary has both `fail` and `unevaluable`
lists, the FAIL wins (ABSTAIN_POLICY:CLAUSE_FAIL:<name>) — do NOT record
ABSTAIN_INFRA. Recording INFRA here would (a) wrongly exclude a legitimate,
human-scoreable policy decision from agreement scoring, and (b) inflate the infra
quality gate with a non-defect. Test: "would a *perfect* pipeline (bot review +
head-current Devin + matching commit) still abstain?" If yes on policy grounds, it's
ABSTAIN_POLICY.

**Fix / procedure note:** codex DECISION_REVIEW flagged that this fail-dominance is
only *implicit* in SKILL.md:57 — the mapping is correct but undocumented. Leave
`commit_id` null (honest UNEVALUABLE) rather than falsifying it to the pinned sha;
set `challenger: CHALLENGER_NOT_RUN` with the short-circuit reason. Corroborates the
existing `approver-calibration-size-cap` learning: >2000-line core refactors correctly
ABSTAIN_POLICY/CLAUSE_FAIL:tier_eligible, human outcomes have validated the cap.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783932935934-approver-clause-gap-terminal-step-1-clause-fail-do.md`_
