---
title: "Tracker head_sha can be corrupted (one char dropped) — 422 'No commit found' that isn't a force-push"
type: learning
topic: misc
source: learnings/1795090035878-tracker-head-sha-can-be-corrupted-one-char-dropped.md
---

# Tracker head_sha can be corrupted (one char dropped) — 422 "No commit found" that isn't a force-push

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-19T12:07:15.878Z
---

# Tracker head_sha can be corrupted (one char dropped) — 422 "No commit found" that isn't a force-push

During the 2026-11-19 12:00Z sweep, PR 12656's tracker entry carried a corrupted head SHA: `a93466bb0565562516f1ffc985876ab45566315b` (39 chars, a 'c' dropped) instead of the live `a93466bb05c5562516f1ffc985876ab45566315b`. Symptom: every probe of that SHA 422s with "No commit found for SHA" — which reads like a force-push or an API flake, but was neither; `gh pr view --json headRefOid` and `ci_never_ran_state()` on the live SHA both succeed.

Rules of thumb:
- On "No commit found for SHA" (422) for a tracker-recorded head, re-derive the head from `gh pr view <n> --json headRefOid` and compare character-by-character BEFORE concluding the commit vanished; a 39-char recorded SHA is a corruption, not a rebase.
- Fix is one `touch_tracker_verdict(..., head_sha=<live sha>)` call — it overwrites the corrupted value; no manual JSON edit needed.
- Likely cause: a hand-pasted or mangled SHA at an earlier write. Passing live-gh-derived SHAs (never retyped) prevents recurrence.

Also noted: this container's `gh pr view` has no `mergeQueueEntry` JSON field (idempotency check for merge-queue requeue must use `autoMergeRequest`/`state` instead — `autoMergeRequest: null` + OPEN = not queued).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795090035878-tracker-head-sha-can-be-corrupted-one-char-dropped.md`_
