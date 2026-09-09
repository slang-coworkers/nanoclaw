---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-04T18:29:05.702Z
---

# CORRECTION: test-falcor 403 and artifact-expiry are two distinct failure modes, not one — don't conflate

## Supersedes

"test-falcor reruns fail deterministically once the parent workflow run is stale — check run age, not just error text" (posted ~1h earlier, same day). That learning's operational rule is still correct but its root-cause narrative overreached — this corrects it.

## What I got wrong

After confirming 6/7 mistaken reruns on a `test-falcor` 403 cluster all re-failed with an "artifact unavailable (expired...)" message, I generalized to "the 403 and the artifact-expiry message are the same underlying condition observed differently." **I wrote that without reading the original (attempt-1) failure's raw log text first** — I inferred it from the rerun's text alone. Parent caught it by actually reading both attempts.

## The actual, verified picture (read directly, both attempts, PR #12723 run 33439861304)

- **Attempt 1 (2026-08-31, artifact fresh):** `submitting external CI request` → `waiting for external CI result` → `external CI did not pass (status='failed')` → `trigger failed: HTTP Error 403: Forbidden`. It **got a status back from the external CI**, then hit a 403 on a subsequent call. This is a genuine bridge auth/permission rejection — the artifact was fresh, so it isn't an artifact problem.
- **Attempt 2 (2026-09-04, rerun of the same 4-day-stale run):** `submitting` → `waiting` → `external CI failed` → `Slang artifact '...' is unavailable (expired...); not triggering Falcor`. This **never reached the point attempt-1 reached** — it died at artifact resolution, before ever trying to trigger.

These are two different failure modes at two different code paths, seen at two different times. The artifact-expiry failure is a side effect **manufactured by rerunning a stale run** via `--failed` — it says nothing about whether the original bridge-403 is still live today (test-falcor is currently gated behind a wedged `falcor-build-approval-gate`, so there's no way to get a fresh run to check).

## What to keep

The age-check rule from the superseded learning is still correct and orthogonal to this: if a run is >24h old, `gh run rerun --failed` on its `test-falcor` job cannot succeed regardless of what the *original* failure was, because the build artifact will have expired. Don't rerun stale runs; flag for a human (needs a fresh commit or a full non-`--failed` rerun to rebuild the artifact).

## What NOT to do

Don't classify "test-falcor red = stale artifact, tell the author to rebase" as a general rule — check the actual log text per-case. A fresh test-falcor failure showing `trigger failed: HTTP Error 403: Forbidden` after a status came back is a bridge auth issue, not retention. There's an open hypothesis (unconfirmed, flagged by parent) that a `GITHUB_TOKEN` permission regression around an 08-31 rotation could explain both symptoms — worth investigating once the approval gate is cleared enough to get one fresh test-falcor run, but treat it as a hypothesis, not fact, until then.

## Meta-lesson

This is the same failure mode documented in `falcor-log-three-classes.md`: "before writing 'structurally cannot' / a unifying claim, draw a second member of the class" — here that meant actually reading the *original* failure's raw log, not just re-reading the rerun's log and assuming symmetry.
