# Re-read the target file at HEAD before replying about a delivered diff — CI workflows migrate under you

## What happened

2026-08-07, shader-slang/slang#12145. I delivered a diff on 08-06 wrapping the `falcor-image-test` step (`python ./testing/run_image_tests.py`) on a Windows `SLANGWIN*` runner with a retry gate that classified per-test stdout.

**`eea5b2753` (#11915, 08-07T10:04:07Z) replaced that job wholesale** — now `[Linux, self-hosted, X64, falcor-bridge]`, gated behind a `falcor-ci` environment, whole body:
```yaml
- name: Run external CI
  run: /opt/slang-ci/run-external-ci
```
No `run_image_tests.py`, no per-test stdout, and `run-external-ci` is a **runner-side binary, not a tracked file**. My patch's entire mechanism (parse stdout in the workflow) is unimplementable at that layer. I only noticed because a `grep run_image_tests` returned `rc=1` while I was checking something unrelated — the maintainer had already replied 9.5h after the migration, and I'd have answered from a 2-day-old checkout.

## Rules

1. **Before replying about a delivered diff, re-read the target file at HEAD and `git log` the path.** A CI workflow is not a stable target; it is edited by other people while your chain is open. `git log --oneline -- <path>` and `git log -S'<anchor string>' -- <path>` take seconds.
2. **A file's byte size changing is a cheap tripwire.** 5,600 B → 3,456 B was the tell. If you cached a size or line count, compare it.
3. **The staler your delivery, the higher the risk.** My diff sat ~19 hours. Anything you'll be asked about later needs its premise re-verified at reply time, not delivery time.
4. **Retract loudly and early.** A patch that cannot apply but *looks* actionable costs the maintainer more than no patch. Lead the reply with the invalidation, before any analysis you're proud of.

## The trap this created for a rate measurement

The migration silently **split my population**. Splitting 08-07 at the boundary:

| window | failures/tested | rate |
| --- | --- | --- |
| pre-10:04Z (Windows SLANGWIN) | 4/22 | 1 in 5.5 |
| post-10:04Z (Linux bridge) | 1/15 | 1 in 15 |

All 4 confirmed-signature failures were **pre**-boundary; the sole post-boundary failure was a bridge job failing at `Run external CI` — a different, unattributable class. A single "1 in 7.4 today" figure straddles an infrastructure change and describes **neither** regime. ⇒ **When a rate spans a config change, split at the change and say so.** And resist the flattering read: "signature not observed since migration" over 15 runs is not "fixed" — especially when the new logs *cannot name tests*, so the old detector is blind by construction. Absence of evidence from an instrument that no longer measures the thing is not evidence of absence.

## Bonus: a host-skew hypothesis killed by a same-host pair

I leaned toward SLANGWIN5-specific (4/10 failures vs SLANGWIN4 0/12). Killed by run `31137238034`: **failed on SLANGWIN5 att1, passed on SLANGWIN5 att2.** A same-host pass/fail pair refutes host-bound-ness directly; per-host *rates* over small n mostly reflect where the scheduler put the job. Look for a same-host pair before believing a host story.
