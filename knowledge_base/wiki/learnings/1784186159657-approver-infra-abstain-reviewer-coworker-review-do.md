---
title: "[approver/infra-abstain] reviewer-coworker review-doc omits contract-required commit_id + _approver_result → commit_match UNEVALUABLE → ABSTAIN_INFRA"
type: learning
topic: review-process
source: learnings/1784186159657-approver-infra-abstain-reviewer-coworker-review-do.md
---

# [approver/infra-abstain] reviewer-coworker review-doc omits contract-required commit_id + _approver_result → commit_match UNEVALUABLE → ABSTAIN_INFRA

# [approver/infra-abstain] Verity delegated-reviewer doc omits `commit_id`/`_approver_result` → `commit_match` unevaluable

**Case:** slang#12055 (live_late, BOM-strip for #line DebugSource). Recorded **ABSTAIN_INFRA / CLAUSE_UNEVALUABLE:commit_match** @6580f014 despite a substantively clean PR (0🔴, principled producer-side fix, challenger-verified lifetime-safe; reviewer APPROVE_WITH_NITS).

**Symptom:** `eval-clauses.py` returns `commit_match=unevaluable` ("carries no commit_id") even though the review doc is present, parseable, >500 bytes, and carries a correct `diff_hash`.

**Root cause (verified against on-disk source, NOT memory — the SKILL.md loaded into context at session start was STALE):**
- The CURRENT input contract (`slang-pr-approver/SKILL.md:28-29`) requires the embedded result block to be `{_approver_result:true, verdict, bugs, gaps, questions, diff_hash, commit_id, reviewers_complete}`. The deployed `eval-clauses.py` keys `commit_match` on `commit_id == pinned commit_sha`, and SKILL.md:59 says synthesis writes `commit_id = commit_sha` by construction — so a compliant doc PASSES on any tier.
- In the **Verity delegated-reviewer path** the slang-reviewer coworker returns a doc whose result block carries only `{verdict,bugs,gaps,questions,diff_hash,reviewers_complete}` — it OMITS `_approver_result` and `commit_id`. The harvest-based `/slang-pr-approve` workflow synthesizes those fields itself; the reviewer-coworker handoff does not stamp them. So `commit_match` is unevaluable on EVERY reviewer-coworker-path PR until this is fixed.
- This is a malformed/contract-noncompliant staging artifact — NOT a script-vs-contract skew. The script and the contract AGREE; the doc is the non-compliant party.

**How to catch it:** After running `eval-clauses.py`, if `commit_match=unevaluable` with a doc that IS present + has a diff_hash, grep the result block for `commit_id` and `_approver_result`. If absent → this defect. Confirm by reading the DEPLOYED `eval-clauses.py` + SKILL.md on disk (don't trust the in-context copy — it can be an older version; the commit_match predicate changed from "diff_hash present" to "commit_id == sha").

**Don't hand-repair.** Per "run the script; never judge these yourself / unevaluable input… never a guess, never a workaround": do NOT inject commit_id/_approver_result into the staged doc to force a pass, even when you've independently verified head-currency (diff_hash == your own `gh pr diff @ reviewed_sha`; byte-identity across a master-merge). Record ABSTAIN_INFRA and name the artifact. Also note: hand-completing wouldn't have helped here anyway — the doc also had `reviewers_complete=false` (Devin lost to session teardown), which independently forces a Step-2 harness abstain.

**Fix (pipeline, for the harness owner):** the Verity/delegated-reviewer handoff must stamp the FULL contract-required result block — `_approver_result:true` + `commit_id = pinned commit_sha` — into review-doc.md, mirroring the harvest-based workflow's synthesis. Until then, reviewer-coworker-path PRs systematically land ABSTAIN_INFRA on commit_match.

**Correction I had to make (recorded for honesty):** my first derivation draft called this a "script-vs-contract skew" and claimed the SHA-equality predicate was "structurally unsatisfiable" for a master-merged head (reviewed 0a1da47 ≠ pinned 6580f014). Codex DECISION_REVIEW caught both as false: the contract sets `commit_id=commit_sha` (the PINNED head) by construction, so a compliant doc carries `commit_id=6580f014` and passes. The defect is purely the omitted field. Lesson: read the on-disk contract before diagnosing a clause failure's root cause.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784186159657-approver-infra-abstain-reviewer-coworker-review-do.md`_
