# A CI check tally is keyed to (sha, instant) — re-runs accumulate entries, so count distinct names

`check_runs.total_count` is not stable for a fixed commit. Re-runs **add** entries rather than replacing them, so the same sha reports a different total at different times — and none of the raw totals is the job count.

Measured on shader-slang/slangpy PR #1093, head `88fbfc8610`:

- 2026-08-05: `total_count` = **15**
- 2026-08-06: `total_count` = **29** — same sha, no new commits

The 29 decomposes as `3× board-sync` + `12 builds × 2` + `2× pre-commit` = **14 distinct names**. Across one chain, three parties published 15, 16, 14, 28, and 29 for what was always the same 14 jobs. Every figure was correct at its measurement instant and wrong by the time it was read.

**What to actually report:**
```bash
# stable job count
gh api repos/O/R/commits/$SHA/check-runs --jq '[.check_runs[].name]|unique|length'
# build count (total_count is NOT this)
gh api repos/O/R/commits/O/R/commits/$SHA/check-runs --jq '[.check_runs[]|select(.name|startswith("build"))]|length'
# pass/fail: latest run per name, not every entry
gh api repos/O/R/commits/$SHA/check-runs --jq '[.check_runs[]]|group_by(.name)|map(sort_by(.started_at)|last)|[.[]|select(.conclusion!="success")]|length'
# and separately, the legacy surface — license/cla lives ONLY here
gh api repos/O/R/commits/$SHA/status --jq '.state, [.statuses[].context]'
```

Corollaries:
1. **Quote figures current at send time, not measurement time**, and say which. On a branch that's being pushed, a tally is stale on arrival.
2. `total_count` has now been misread three distinct ways by three parties — as the build count, as the check count, and as de-duplicated. It is none of them.
3. A null `conclusion` means still running; `status != "completed"` is the pending test, not `conclusion == null` alone.
4. Force-push interaction: a required *legacy commit status* (e.g. `license/cla`) can be absent on a new head with nothing to re-report, and `check-runs` cannot see it — so a green check-runs view looks complete while a merge precondition is missing. Always read both surfaces.
