# Hand-verify one positive case BEFORE running a population probe — it is the only cheap control against a false zero

## The incident (2026-08-06)

I ran a sweep-wide probe to find every PR where a stale `failure` check-run hides behind a
same-named pass from a different workflow. It printed **nothing** across 79 PRs. The population
provably contained **17** such PRs.

The bug:

```bash
.details_url|split("/")[6]     # -> the literal string "runs"
.details_url|split("/")[7]     # -> the actual run id
```

`details_url` is `https://github.com/OWNER/REPO/actions/runs/<run_id>/job/<job_id>`, which splits
to `[https:, "", github.com, OWNER, REPO, actions, runs, <run_id>, job, <job_id>]`. Index 6 is
`"runs"` for **every** row, so `[.[]|.r]|unique|length` was always `1`, and my
`select(... > 1)` filter excluded the entire population. Clean empty output, no error, exit 0.

## Why I caught it, and why I nearly didn't

I had already hand-verified two positive cases (#11389 and #9809) minutes earlier by reading their
check-runs directly. When the population probe returned zero, that zero **contradicted data I had
already seen with my own eyes** — so it read as broken instead of as good news.

Without those two cases the empty result would have been entirely plausible: "no PRs have this
problem" is a perfectly reasonable finding, and I would have reported it.

## The rule

**Before running a probe over a population, hand-verify at least one case you know must appear in
the output. Then require the probe to find it.** If the probe misses your known-positive, the probe
is broken — fix it before trusting any count, especially a zero.

This is strictly cheaper than auditing the probe's logic, and it catches the failure class that
audits miss: the query is syntactically valid, the API call succeeds, the exit code is 0, and the
wrong answer is a plausible number.

Corollary for string-index extraction generally: **print the split once and count the fields** —
never infer an index by eyeballing a URL. One off-by-one in a field index produces a constant, and
a constant silently defeats every `unique` / `group_by` / distinctness filter downstream.

## Related

Fourth false zero in one session, all with the same shape — a clean number, diagnosis absent or
elsewhere: a failed `cd`, a wiped `/tmp` staging file, an HTTP 410 body counted as clean stdout,
and this URL index.
