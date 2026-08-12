# A CI-failure signature changes between ticks — reclassify from the failed JOBS, never from your stored verdict

On a supervisor CI nudge for a week-old draft PR (slang#12294), my own memory note said "draft ci_failed benign (priority-yield)". Acting on that stored classification would have been wrong twice over.

**What actually changed.** Same run id, but `run_attempt=2` — the aging retry had force-run the real build since the last tick. Latest attempt: **34 jobs SUCCESS** (including all 6 macOS build/test jobs), and the failures were now `test-falcor / Test (Falcor)` + the `check-ci` rollup — NOT the original `wait-for-human-priority` + `check-ci` priority-yield. A stored "benign" verdict would have hidden both the good news (the real build finally ran) and the actual failing job.

**Rule:** a run's failure signature is not stable across ticks. Re-read the failed job list (`gh run view <id> --json jobs`) at the moment of action; treat any stored classification as a hypothesis about a past attempt. Note `runs/<id>/jobs` returns the LATEST attempt only — use `attempts/<n>/jobs` if you need an earlier one.

**Two sub-traps found in the same pass:**

1. **`failedSteps: []` on a failing job = job/infra-level failure, not a test assertion.** `test-falcor / Test (Falcor)` failed with zero failed steps while its sibling `Test (Falcor Perf)` passed, and falcor is red on master too ⇒ pre-existing infra, unrelated to the diff. Also: a name-substring `--jq` filter matched TWO falcor jobs and returned both ids into a command expecting one (`accepts 1 arg(s), received 2`) — query `actions/jobs/<id>` per job, since the passing sibling can mask which one is red.

2. **GHA logs age out (~7 days) and the absence is INDISTINGUISHABLE from "never ran".** For the 7-day-old run, `actions/jobs/<id>` returned an **empty `steps[]`** and a log grep for my test name returned nothing. That means "all macOS jobs green ⇒ my `-target metallib` test executed and passed" is **inference, not proof** — a silently-skipped test looks exactly like a passing one at job level. If the whole point of a held PR is one CI-arbitrated fact, you must re-verify on a FRESH run before reporting it confirmed; do not upgrade the inference to "validated".

**Bonus instrument trap from the same investigation:** an empty `git rev-list --count A..B` is a TOOLING FAILURE, not `0`. The remote branch wasn't in the base clone (`git rev-parse` → `fatal: Needed a single revision`), so the count printed blank. After an explicit refspec fetch the true answer was "master 45 ahead". Verify the ref resolves before reading any ancestry count — and never let a blank stand in for a legitimate observation.
