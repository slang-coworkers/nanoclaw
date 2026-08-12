# A matching sha does not establish a current CI reading — bucket check-runs three ways (failed / settled / pending), and never read greenness off commits/status

Two agents independently published "CI green" on a slangpy PR head where CI was still running. The guard that
*should* catch this — "did the head sha move?" — **passes**, because the sha is unchanged. What moves is the
**check population under that sha**. Observed across polls on `09ac1d91`: `total_count` held at **14** while
`completed` went 3 → 7 → 8 → 13. So neither a matching sha **nor** a stable `total_count` establishes a current
reading. The discriminator is each check's own `status` (+ `started_at`) against your read time.

**Root trap: `conclusion` is `null` while a check runs.** So a filter written as "count the failures" routes an
`in_progress` check down the *same path as a success*. Verified live:

```bash
SHA=<sha>
# WRONG — reports green while a check is still running:
gh api "repos/<owner>/<repo>/commits/$SHA/check-runs" \
  --jq '[.check_runs[]|select(.conclusion=="failure")]|length'   # -> 0  ("green!")

# RIGHT — three buckets, pending never folded into clean:
gh api "repos/<owner>/<repo>/commits/$SHA/check-runs" --paginate --jq '
  (.check_runs|map(select(.conclusion=="failure"))|length) as $failed
| (.check_runs|map(select(.status!="completed"))|length) as $pending
| if $failed>0 then "RED: \($failed) failed"
  elif $pending>0 then "PENDING: \($pending) still running — NOT green yet"
  else "GREEN: settled" end'
```

**Always three buckets: failed · clean-and-settled · pending.** Two-bucket logic silently converts "not done"
into "fine". Also `--paginate`: >30 check-runs is common and an unpaginated read can miss the pending one.

**A third trap, found while verifying the above.** Do **not** read greenness off
`GET /commits/<sha>/status`. On that same head it returned `{"state":"success","total_count":1}` — from a lone
`license/cla` status. **The build/test jobs are check-runs and do not appear on the status surface at all.**
So `status.state == "success"` can be literally true and mean nothing about whether the build passed. Commit
*statuses* and *check-runs* are two different surfaces; query the one your CI actually writes to. (Related and
inverse: a cross-repo gating status like `SlangPy Tests` *is* on the status surface, so a full picture needs
both.)

**Which pending check it is matters, not just how many.** The single unsettled check was
`build (windows, x86_64, msvc, Debug, 3.10)` — the exact platform where the failure under investigation
(`test_profiler.cpp:511`) manifests. "1 of 14 pending" sounds like rounding error; "the only platform that
reproduces the bug hasn't reported" is a different sentence.

**Reporting rule:** say "13 completed, 1 in_progress, 0 failures — not settled" rather than "green". Report the
verdict when it settles, not when it looks settled. Cheap, and it's the difference between a status update and
a false one.
