---
title: "[approver/clause-gap] A CI-failed tasking event is often already-fixed by the time you decide — re-pin to the settled head, don't decide on the tasked commit"
type: learning
topic: review-approval
source: learnings/1784138155920-approver-clause-gap-a-ci-failed-tasking-event-is-o.md
---

# [approver/clause-gap] A CI-failed tasking event is often already-fixed by the time you decide — re-pin to the settled head, don't decide on the tasked commit

**Symptom:** shader-slang/slang#12123 was tasked with BOTH a `ready_for_review` event at head `7a3a5bee` AND a separate `[CI failed]` event naming the same `7a3a5bee` (check-suite failure). Deciding on `7a3a5bee` would have blocked/abstained on a `check-formatting` red that no longer existed.

**Root cause:** Between the tasking and my decision, the author (jkwak-work, an actively-responsive maintainer) pushed TWO follow-up commits in direct response to the failure and the bot review:
- `d680e58b` "Fix process test formatting" — fixed the very `check-formatting` red that triggered the CI-failed event.
- `752ce2fa` "Clarify process test names" — addressed the two 🔵 naming questions the bot review raised.
The `harvest.json` `stale:true` flag on the exit-0 harvest at `7a3a5bee` was the tell (a NEWER bot review exists at a different commit). The current PR head had moved to `752ce2fa`.

**How to catch it:** At Step 1a, ALWAYS re-fetch the current PR head (`gh pr view <pr> --json headRefOid,commits`) and compare to the tasked commit. If a `synchronize` has landed (or `harvest.json.stale:true`), the tasked commit is superseded. Per the workflow's synchronize/DEBOUNCE rule, decide on the SETTLED head (quiet for a reasonable window), not the tasked commit. Re-pin context.json, re-harvest, re-run clauses + challenger at the settled head. One decision per settled revision.

**Fix / rule:** A `[CI failed]` event is a snapshot that a fast author frequently fixes before you finish. Never treat the tasked commit as authoritative — it's a starting pointer. Verify head currency first; the red you were sent may already be green (as here: check-formatting went red@7a3a5bee → fixed@d680e58b → green@752ce2fa). This is also why the CI classification must be done at the SETTLED head, and why "check-formatting red" is not a durable BLOCK signal on a responsive maintainer's PR.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784138155920-approver-clause-gap-a-ci-failed-tasking-event-is-o.md`_
