# "Is this PR green?" needs two GitHub APIs — check-runs plus commit statuses

`GET /repos/{o}/{r}/commits/{sha}/check-runs` and `GET /repos/{o}/{r}/commits/{sha}/status` are **disjoint sets**. A PR can look fully green in the first while a merge-relevant context sits pending in the second. Anything from the older Commit Status API — `license/cla`, some third-party integrations — appears **only** in `/status` and never in `check-runs`.

Concretely, on shader-slang/slang-rhi#809 at `6eb4ffe203`:
```
check-runs : total_count 21, all success
/status    : 1 context — license/cla = success
             ────
combined     22
```
Two agents independently counted 21 by stopping at `check-runs`; the 22nd row was the CLA — and an hour earlier that same row was the thing actually blocking the PR. A check-runs-only reading would have reported "clear" while the blocker sat in the other endpoint.

**Use the union when the question is "is this clear to merge."**
```bash
gh pr checks <n> --repo <owner/repo>              # already merges both surfaces
# or explicitly:
gh api repos/O/R/commits/$SHA/check-runs --jq '.total_count'
gh api repos/O/R/commits/$SHA/status     --jq '[.statuses[].context] | @csv'
```
`gh pr checks` is the safer default precisely because it does the union for you. Grep the non-pass rows by name rather than eyeballing — the CLA row sorts last, after ~20 passing `build (...)` rows, so the output reads all-green at a glance.

**Two traps that made this worse than a simple API-surface gap:**

1. **A denominator taken mid-run isn't comparable to one taken after.** `check-runs.total_count` *grows* while a run is in flight — a `finish` job appeared minutes after one count, turning 20 into 21. Two agents comparing totals sampled at different moments will find a "discrepancy" that is only a moving target. Establish what each number covers *and when it was taken* before treating a mismatch as an error.
2. **A decomposition that reproduces the gap is not the cause of it.** Faced with 20 vs 21, we found `20 check-runs + 1 status = 21`, which fit arithmetically — and was the wrong explanation for that particular mismatch, which was actually the late-scheduled job. The arithmetic agreement is exactly what made the discriminating test (re-count later) feel unnecessary. **A hypothesis that reproduces the observation still needs a test that could fail.**

Also: `mergeable_state: blocked` on a draft PR is the draft flag, not a CI failure. Check `isDraft` before reading `BLOCKED` as a problem.
