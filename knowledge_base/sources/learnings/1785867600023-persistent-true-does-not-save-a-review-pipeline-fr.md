# persistent:true does NOT save a review pipeline from session teardown — use a host cron, and check disk before declaring the run lost

## The correction

Prior guidance (mine, and I suspect others') said: arm the reviewer-completion `Monitor` with `persistent: true` so it survives teardown. **That is wrong.** On shader-slang/slang#12269 I armed `Monitor(persistent: true, timeout_ms: 3600000)` over a 3-reviewer pass. Reviewer A finished 90 min later and wrote a complete `final-review.md`. The monitor **never fired** — the session tore down and the verdict sat undelivered for **6 days** (2026-07-29 → 08-04) until the human parent pinged to close the loop.

**No in-session watcher survives teardown**: `Monitor` (persistent or not), a background `nohup` poller, an armed waiter. Teardown leaves *no transcript marker*, so the watcher dies without firing — and silence is indistinguishable from "still running."

## What to do instead

1. **Host-level `schedule_task` cron** for any guard that must span a possible session gap. The cron is host-owned and survives container/session teardown; the Monitor is in-session and does not.
2. **Or run the pass foreground / bounded blocking polls in-turn.** For a 20–30 min pipeline this has been reliable in practice — there's no watcher to lose. (Slower wall-clock, but it actually delivers.)
3. A 20–30 min pass is *well inside* the window where an inactivity gap kills the watcher. Don't assume "short enough to be safe."

## The good news — outputs survive on disk

Before declaring a stranded run lost, **check the run-dir**. The reviewer subprocesses are `nohup`-detached, so they keep running and keep writing after the session dies. On #12269, `final-review.md` (6.6 KB) and `clarity-review.md` (10.6 KB) were both intact 6 days later. Recovering them cost one `Read` each; re-running would have cost ~30 min and ~$60.

Verify identity before trusting a recovered doc:
- `<run_dir>/pr-diff.reference` — the diff actually captured for that run.
- The review's own footer (`reviewed: <sha> · diff sha256 <hash>`) — cross-check against the live head.
- **Do NOT trust `tmp/context.json`** — it's a shared path that concurrent runs clobber.

## Corollary: INTEGRITY-FAIL is often a false positive from that same shared tmp

`compose-and-run.sh`'s diff-integrity guard compares the model-materialized `tmp/pr-diff.patch`, which is **shared across concurrent runs**. On #12269 it fired listing files from an entirely different PR, while the run's own `pr-diff.reference` and the review footer both pinned the correct head. Same clobber independently explains why one of A's six subagents (`code-quality-reviewer`) reported on a *different* PR (#12271) despite reading the right diff.

**Adjudicate, don't auto-trust:** if `pr-diff.reference` matches the real PR file list and the footer sha matches the head, the marker is a false positive. This has now fired spuriously 5+ times across #12262/#12263/#12275/#12281/#12269. The real fix is run isolation (worktree-per-run) so runs stop sharing `tmp/`.
