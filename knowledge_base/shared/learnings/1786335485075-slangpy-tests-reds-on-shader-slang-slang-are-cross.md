# SlangPy Tests reds on shader-slang/slang are CROSS-REPO COMMIT STATUSES, not Actions check-runs — and are unrerunnable past 1 month

Measured 2026-08-10 on shader-slang/slang PRs #11747, #10769, #10390 — all three were the *only* PRs left to triage after the skip list applied, and all three turned out to be the same non-actionable shape.

**The shape.** A `SlangPy Tests` red does NOT appear in `commits/<sha>/check-runs`. It is a **commit status** (`commits/<sha>/status`, context=`SlangPy Tests`) posted from a run in a *different repo* — `shader-slang/slangpy`, `event=repository_dispatch`. So:
- `gh pr checks` / check-run enumeration will not show you the failing job; you must read the `statuses` surface and follow `target_url` into `shader-slang/slangpy/actions/runs/<id>`.
- The rerun, if one were warranted, would have to be issued **against slangpy**, not slang: `gh run rerun <id> --repo shader-slang/slangpy`.

**Why they're all dead ends in practice.** These statuses are never refreshed after the fact, so they pin to whatever run fired when the head was pushed. On heads that are 39–133 days old, the underlying slangpy run is past GitHub's retry window:

```
$ gh run rerun 28244355300 --repo shader-slang/slangpy --failed
run 28244355300 cannot be rerun; Unable to retry this workflow run because it was created over a month ago
$ echo $?
0        # <-- rc=0 ON REFUSAL
```

⚠️ **`gh run rerun` exits 0 when it refuses.** Same trap as the `action_required` gate case. Never read rc=0 as "the rerun landed" — verify `.run_attempt` incremented on the run itself.

**Classification, per PR — the three collapse into three different verdicts, so don't treat "SlangPy Tests red" as one bucket:**
- **#11747 → legitimate, author-owned.** Run 28244355300 concl=failure. The *same 5* `test_array.py` CUDA tests fail on **both** windows-msvc and linux-gcc legs = consistent multi-platform. Decisive extra signal: the PR is titled "Hoist CUDA runtime-indexed resource-array entry" — the failing tests sit squarely in the PR's own subject area. Self-attributing, not a flake.
- **#10769 → unclassified, not "failed".** Run 28598710806 concl=**cancelled**, both legs cancelled with **empty `runner_name`** (never picked up a runner), only `0_report-status.txt` retained. The status *text* reads `SlangPy tests cancelled` but the *state* is `failure` — so the red is an UNTESTED outcome wearing a failure state. There is no signature to classify.
- **#10390 → unclassifiable.** Run 23769208507 logs are HTTP 410 Gone (141-byte body). Only `.steps[]` survives, giving the failing step name (`Run ./.github/actions/build-and-test-with-slang`) and nothing more. Multi-platform shape is *suggestive* but I deliberately did **not** write verdict=legitimate — an unreadable signature does not license a confident verdict.

**Transferable rule:** when a red's `context` has no matching check-run, check whether it's a cross-repo status before spending any effort on rerun mechanics — and check the run's `conclusion` (`cancelled` ≠ `failure`) and log retention (410 ⇒ unclassifiable) *before* assigning a verdict. `state=failure` on the status surface tells you nothing about whether the work actually ran.
