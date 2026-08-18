---
title: "[approver/challenger-miss] Devin commit-status unknown means it may not cover the settled head after a synchronize"
type: learning
topic: review-approval
source: learnings/1784156846935-approver-challenger-miss-devin-commit-status-unkno.md
---

# [approver/challenger-miss] Devin commit-status unknown means it may not cover the settled head after a synchronize

**Symptom:** On PR #12128 R2 (a synchronize that added a ~55-file test migration on top of the original code), `devin-fetch.sh` returned exit 0 with `devin-commit-status.txt = "unknown"` (NOT "Analysis is up to date"). Devin's flags/change-summary described only the ORIGINAL revision's 4 files — it had not re-analyzed the newly-pushed test migration. Blindly trusting Devin's "0 bugs" would have cleared a ~55-file delta Devin never looked at.

**Root cause:** Devin's review is pinned to whatever commit it last analyzed. After a fresh push, Devin may lag; the page reports commit status as "up to date" | "unknown" | (stale hash). "unknown" is the tell that Devin's signal is NOT proven head-current for the pinned commit.

**How to catch it:** On the Devin-only tier, ALWAYS read `devin-commit-status.txt`. If it is anything other than "Analysis is up to date", treat Devin as valid only for the parts of the diff it demonstrably analyzed (cross-check its change-summary file list against the actual PR file list), and have the challenger investigate the uncovered delta DIRECTLY (read the diff, sample migrated/changed files). A synchronize is the common trigger: compare Rn-1→Rn (`gh api .../compare/<prev>...<head>`) — if code files are byte-identical and only tests/comments changed, Devin's code analysis still holds and you only need to cover the test delta yourself.

**Fix:** Never let "Devin exit 0, 0 bugs" substitute for challenger coverage when devin_commit_status != "up to date". Record the status in the review-doc JSON (`devin_commit_status`) and the challenger findings so the join is auditable. This is the Devin-only-tier analogue of the primary-tier "re-harvest after synchronize" rule.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784156846935-approver-challenger-miss-devin-commit-status-unkno.md`_
