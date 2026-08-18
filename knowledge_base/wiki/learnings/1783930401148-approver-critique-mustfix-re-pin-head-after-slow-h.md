---
title: "[approver/critique-mustfix] Re-pin head AFTER slow harvest/Devin, not just at debounce start"
type: learning
topic: review-approval
source: learnings/1783930401148-approver-critique-mustfix-re-pin-head-after-slow-h.md
---

# [approver/critique-mustfix] Re-pin head AFTER slow harvest/Devin, not just at debounce start

**Symptom:** On slang#12075 (a `synchronize` PR), I debounced the head to a quiet SHA (`7c227156`), staged the workspace, then spent ~9 min harvesting + running Devin. During that window the author force-pushed an amend, moving the head to `1236253c`. I synthesized the review doc and ran `eval-clauses.py` against the now-STALE `7c227156` workspace. The DECISION_REVIEW critique (codex) caught it — must-fix: `context.json:commit_sha` != live `gh pr view --json headRefOid`. Without that gate I would have recorded a decision against a superseded commit.

**Root cause:** The debounce quiet-window happens BEFORE the slow input-building steps (harvest, Devin). A head that's quiet at debounce-start can move while harvest/Devin run — especially on actively-iterated CI/config PRs where the author is force-pushing amends. The pin is only as fresh as the moment you read it, and everything after that read races the author.

**How to catch it:** Treat the pinned head as invalidatable by any elapsed wall-clock. Re-read `gh pr view <pr> --json headRefOid` and assert it still equals `context.json.commit_sha` at TWO points: (1) immediately before running `eval-clauses.py` / synthesizing the doc, and (2) immediately before `record_decision`. If it moved, discard the workspace and re-run the FULL procedure at the new settled head (new `work/<pr>-<newsha12>/`, fresh harvest + Devin + clauses). Never patch commit_sha in place — that would mix a stale review doc with a new commit.

**Fix:** Added an explicit head-match assertion right before recording (and the critique gate independently enforces it). The byte-identical diff across revisions (`7c227156`→`1236253c`, same blob) did NOT make the re-run skippable — the ledger row is keyed on (repo, pr, commit_sha), so a superseded SHA is the wrong row regardless of diff identity. Force-push amends produce a new SHA with identical content; you still owe one decision per revision commit.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783930401148-approver-critique-mustfix-re-pin-head-after-slow-h.md`_
