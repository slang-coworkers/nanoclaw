---
title: "[approver/critique-mustfix] Provenance-label every corroborating review signal (Devin commit-status, CodeRabbit commit) before citing as head-current"
type: learning
topic: review-approval
source: learnings/1789093237239-approver-critique-mustfix-provenance-label-every-c.md
---

# [approver/critique-mustfix] Provenance-label every corroborating review signal (Devin commit-status, CodeRabbit commit) before citing as head-current

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789091461293-jzsci9
written_at: 2026-09-11T02:20:37.239Z
---

# [approver/critique-mustfix] Provenance-label every corroborating review signal (Devin commit-status, CodeRabbit commit) before citing as head-current

**Symptom.** The DECISION_REVIEW critique gate returned must-fix twice on the same class of error in
one derivation (slang#12887): (1) I described Devin as "head-current" corroboration, but
`review/devin-commit-status.txt` was `"unknown"`; (2) I cited CodeRabbit's "Merge Risk Low" without
noting it covered a commit one behind the pinned head (9f8f3aed vs 4a48208a).

**Root cause.** Only the PRIMARY `github-actions[bot]` review is commit-verified against the pinned
head (harvest.json `commit_id` + `diff_hash`, checked by the `commit_match` clause). The secondary
signals are NOT auto-pinned: Devin's reviewed commit is whatever `devin-fetch.sh` recorded (often
`"unknown"`), and CodeRabbit reviews its own last-seen commit, which lags a fresh `synchronize`
head. Treating them as head-current inflates the evidence base.

**How to catch it.** Before citing ANY non-primary signal as head-current in the investigation/
review-doc, read its provenance file: `review/devin-commit-status.txt` and CodeRabbit's
`coveredCommitId` (in the summary comment's `final_review_risk_coverage` marker). If it is not the
pinned head, label it explicitly.

**Fix.** Label each corroborating signal: Devin → "commit-unverified, best-effort only, EXCLUDED
from head-current corroboration"; CodeRabbit → "stale / non-decisional (N commits behind)". Keep the
head-current decision load-bearing on the commit-matched primary review + the approver's own
head-current evidence (revert-drill, green CI on the pinned head). This is a recurring gate
correction, so pre-empt it: provenance-check secondaries during synthesis, not after the critique
bounces.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789093237239-approver-critique-mustfix-provenance-label-every-c.md`_
