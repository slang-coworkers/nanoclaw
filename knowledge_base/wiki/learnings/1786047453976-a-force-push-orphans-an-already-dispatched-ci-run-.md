---
title: "A force-push orphans an already-dispatched CI run and it keeps looking like your pending CI"
type: learning
topic: ci-tooling
source: learnings/1786047453976-a-force-push-orphans-an-already-dispatched-ci-run-.md
---

# A force-push orphans an already-dispatched CI run and it keeps looking like your pending CI

# `workflow_dispatch` pins the SHA at dispatch time — every force-push silently orphans the run

**Observed** 2026-08-06, shader-slang/slang#12401. A run was dispatched at head `cc9e6e906d`, then the
branch was force-pushed twice (review fixes, including a **real UB bug in a test**). The original run
stayed `queued` against the old SHA. Forty minutes later it still looked like the PR's pending CI — a
green conclusion there would have been green on code that no longer existed, and specifically on the
version containing the defect the reviewer had just found.

**Why it has no failure signature.** The orphaned run doesn't error, warn, or disappear. It sits in
`queued`/`in_progress` and renders identically to a live run in every UI and in `gh run list`. The
only distinguishing field is `headSha`, which nobody reads when a run "is already running."

**How to apply:**
- **Re-dispatch after every force-push.** Treat the old run as dead the moment you rewrite history,
  and cancel it so a stale conclusion can't be mistaken for current.
- **Check `headSha` before reading any run's result** — this is the whole detector, and it is one
  field: `gh run view <id> --json headSha,status,conclusion`. Compare against
  `git rev-parse HEAD` / the PR's current head.
- Reporting a run number upstream? Report it **with its SHA**, so a reader can tell for themselves
  whether it still describes the current branch. A bare run id is unfalsifiable once history moves.
- A cancel may lag: GitHub can show `queued` for a while after submission. Expect the terminal state
  to be `cancelled` rather than a conclusion, and say so when you hand the number to anyone.

**Same shape as the wider class:** the instrument was fine, it was pointed at the wrong target. A
correct measurement of a superseded object is not a weaker result than no measurement — it is worse,
because it licenses a decision.

**Related disposition rule, worth reaching for directly.** When an assumption can't be verified
before shipping, the useful question is not *"how confident am I?"* but **"if this is wrong, does it
fail loudly or silently?"** In the same PR an unverifiable claim (nvcc present in a CI image the
workflow never invokes it in) was safe to ship precisely because a missing nvcc is a red step with an
obvious message, not a skipped one. Loud-failing unverified assumptions are shippable; silent-failing
ones need verification first.


## Companion rule — the re-dispatch itself cancels the prior run

**Added 2026-08-06, same PR.** The remedy above (re-dispatch after every force-push) has a second
half that must travel with it, or the fix for one trap looks like a failure of the other. On
shader-slang/slang, `ci.yml` sets `concurrency` with
`cancel-in-progress: ${{ github.event_name != 'push' }}` — so **your own re-dispatch cancels the
previous run.** The orphaned run then shows `cancelled`, which reads as an infra failure or someone
else's intervention.

- A `cancelled` conclusion on a run you superseded is **expected and not a signal.** Do not
  investigate it, and do not report it upstream as a CI problem.
- Conversely: do not assume a `cancelled` you did not expect was self-inflicted. Check the repo's
  `concurrency` block and the run's `headSha` before attributing it either way.
- Report the pair together — "superseded run X cancelled by my re-dispatch; watch Y @ <sha>" — so a
  reader never has to guess which cancellations were intentional.

## `gh run cancel` returns an acknowledgement, not an outcome — and a cancel can wedge permanently

**Added 2026-08-06, same PR — this corrects the section above.** I wrote "cancel it" and "expect the
terminal state to be `cancelled`." Both are unreliable. `gh run cancel` prints
**`✓ Request to cancel workflow submitted`**, which acknowledges that the *request* was accepted. It
says nothing about whether the run stopped. An agent reported a run cancelled twice on that basis; the
run was still `status=queued` 20+ minutes later across a retry and three polls over 36s — plausibly
never scheduled to a runner, so there was nothing to signal.

- **Verify the state, never the submit message**: `gh api repos/<o>/<r>/actions/runs/<id> --jq .status`
  (or `gh run view <id> --json status,conclusion`). The CLI ✓ is not evidence.
- ⭐ **`conclusion` is `null` for BOTH "still queued" and "finished with no result."** A
  conclusion-only read cannot distinguish them — **`status` is the discriminating field.** Read both.
- A wedged queued run may never reach a terminal state. Don't keep poking it, but don't claim it is
  cancelled either: report it as *"superseded, still queued, cancel did not take"* and name the
  authoritative run + SHA instead.

**The generalisable form, and it is the most transferable thing here:** *a tool's acknowledgement of a
request is not the outcome of the request.* Same shape as reading an interface limit as a property of
the object ("`append_learning` is immutable" → the file was plain markdown on a mount someone else
could write). Whenever a command reports success, ask whether it confirmed **the state you care
about** or merely **that your request was accepted**.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786047453976-a-force-push-orphans-an-already-dispatched-ci-run-.md`_
