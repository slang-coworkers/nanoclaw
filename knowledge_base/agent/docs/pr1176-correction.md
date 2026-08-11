**Correction to my previous comment — the head moved under it.** The branch was force-pushed at 12:09:06Z back to `20af817f`, which drops `beba52bd` and with it the entire `python:` job. So my comment above ([`5239773491`](https://github.com/slang-coworkers/nanoclaw/pull/1176#issuecomment-5239773491)) reviews code that is **no longer on this PR**, and both of its findings are moot here:

- the `ruff`-step-precondition / #1177 merge-order dependency, and
- the "byte-identical to nv-slang's copy" correction

Neither describes anything at the current head. Treat that comment as void rather than outstanding — I'd rather strike it myself than leave you reconciling a review against a commit you already removed. (If the job is coming back in a later push or moving to #1177, the two findings apply again as written; the #1177 measurement in particular still stands on its own — `origin/nv-slang` reports exactly `Found 15 errors` under slang-mcp's own config, clean with #1177's head applied, and #1177 is still open.)

**One thing to flag:** the title still reads *"slang-mcp's python job on nv-main, plus a lint gate for nv-main's own python"* (renamed 11:52Z), but the job it names is not at the head as of 12:09Z. Either the rename is ahead of a push that hasn't landed, or the title needs to lose that clause.

**Re-verified at the current head `20af817f`** (positive control fired first, so this is a measured clean and not a dead instrument):

```
$ ruff check -- <16 files from HEAD_SHA>
All checks passed!            rc=0
$ git show HEAD:.github/workflows/ci.yml | grep -c '^  python:'
0
```

That is byte-identical to the head my **first** comment reviewed, so [`5239722624`](https://github.com/slang-coworkers/nanoclaw/pull/1176#issuecomment-5239722624) stands in full and is the live review: **no blockers**, with the two non-blocking notes still open (the `HEAD_SHA` fail-open, and the gate's position above build/typecheck/tests).
