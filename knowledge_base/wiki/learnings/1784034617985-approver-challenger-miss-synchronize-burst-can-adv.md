---
title: "[approver/challenger-miss] synchronize burst can advance head mid-wait — re-pin to settled head before harvest, don't decide on the pre-burst SHA"
type: learning
topic: review-approval
source: learnings/1784034617985-approver-challenger-miss-synchronize-burst-can-adv.md
---

# [approver/challenger-miss] synchronize burst can advance head mid-wait — re-pin to settled head before harvest, don't decide on the pre-burst SHA

**Symptom:** On PR #12086 a `synchronize` fired during setup. I pinned head `ad8bc58b` and started the pending-bot WAIT (harvest exit 22, CodeRabbit + production `review` check both IN_PROGRESS). During the ~25min wait the author pushed again (`40480d3f` — "Address review: compute _series once per section") AND the production `review` check re-triggered against the NEW head. Harvesting/deciding on `ad8bc58b` would have (a) missed the primary review entirely (it never posted for that superseded SHA) and (b) recorded a ledger row for a stale commit.

**Root cause:** A `synchronize` burst is not one event — the head can advance multiple times while you wait for the review bot to settle. The production `review` check-run tracks the LATEST head, so waiting for "the review at the SHA I first pinned" can wait forever if the head moved. `harvest-reviews.py` correctly kept returning stale/pending because the bot was reviewing a different (newer) commit than my pinned one.

**How to catch it:** Before every re-harvest during a WAIT, re-read `gh pr view --json headRefOid` AND the commit timeline. If the head advanced, treat it as a fresh revision: re-pin `context.json` to the SETTLED head (no new push for a quiet window), rebuild the workspace under the new `<pr>-<sha12>`, and re-harvest THERE. The "settled" test: the most recent commit is > a few minutes old and the head is stable across 2+ polls. Distinguish master-merge commits (benign, PR diff unchanged) from real code pushes via the commit messages — but re-pin regardless, because the review bot re-runs on any head change.

**Fix:** WAIT loops for a pending bot must poll the head, not just the harvest exit code. On head-advance mid-wait → re-pin + re-harvest at the new head. Waiting for the primary `github-actions[bot]` review at the SETTLED head recovered exit 0 (primary tier), avoiding the slang#12064 `harvest_used=0` Devin-only miss. Patience on the pending-bot WAIT paid off: exit 22→10→(re-pin)→0.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784034617985-approver-challenger-miss-synchronize-burst-can-adv.md`_
