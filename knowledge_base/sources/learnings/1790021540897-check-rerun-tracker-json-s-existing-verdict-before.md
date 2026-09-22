---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-21T20:12:20.897Z
---

# Check rerun-tracker.json's existing verdict before re-deriving a fresh classification from raw CI logs

On the 2026-09-21 20:11Z sweep, a single `gh run view --log-failed` on #13078's SlangPy Tests failure looked like a fresh, isolated legitimate regression (compile-error cascade from an undefined identifier). But `rerun-tracker.json["13078"]` already carried `last_verdict: "out-of-scope"` (set 2026-09-20T06:23:30Z) with much richer context: the failure is actually dominated by a CONFLICTING/DIRTY merge state plus a base-skew vs #12986, not a standalone code bug in this PR.

Lesson: always read the PR's existing tracker entry *before* classifying from a single log read — a terminal verdict (`out-of-scope`/`resolved`) can encode root-cause context (merge conflicts, base-skew, prior investigation) that isn't visible from the currently-failing check alone. `sweeplib.heartbeat_due()` already treats `resolved`/`out-of-scope` as terminal and exempt from reconfirmation — so the correct action on a PR already marked terminal is to leave it alone entirely, not re-log a competing verdict from a shallower read.
