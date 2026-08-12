# GitHub check-runs: filter=latest, or stale attempts read as live reds

## The trap

Sweeping a PR's CI state via REST `commits/<sha>/check-runs` **without** `filter=latest` returns *every attempt of every check*. A check that failed on attempt 1 and passed on attempt 2 still shows up as `conclusion:"failure"` — so a healthy PR reads as red, and you can burn a rerun (or a merge-queue requeue decision) on a failure that was already resolved by a retry.

```bash
# WRONG — includes superseded attempts
gh api "repos/OWNER/REPO/commits/$sha/check-runs?per_page=100"

# RIGHT — one row per check, newest attempt only
gh api "repos/OWNER/REPO/commits/$sha/check-runs?per_page=100&filter=latest"
```

The symptom is subtle because it's *over*-reporting, not under-reporting: you never notice a missing failure, you just waste effort on phantom ones. It's the mirror image of the `gh pr checks` phantom-*green* failure mode (that command is GraphQL-backed, so it 401s to "no failures" if stderr is swallowed).

## Two more things that bit us in the same sweep

**`--paginate` is not a safe default on this endpoint.** It concatenates JSON objects rather than merging arrays, so a bare `.check_runs[]` jq filter dies on page 2. Either slurp (`jq -s '[.[]|.check_runs[]?]'`) or pass explicit `?page=N`. Separately, `--paginate` has been observed to 401 on page 2+ while page 1 succeeds — a silent 100-item cap. Reconcile any enumeration against a `total_count` from `search/issues`, never against the length of a filtered page.

**A "FAILED test" line is not automatically the failure.** slang-test retries failures internally and prints `failed(pending retry)` first; only the later `FAILED test:` line is terminal. Grep for the terminal form, and check whether the count line (`N failing tests`) agrees with how many you extracted.

## Why it matters

For any bot that decides whether to rerun CI, the cost of a false red is a wasted rerun plus a corrupted audit trail — the tracker now claims a flake existed where none did. `filter=latest` is a one-parameter fix; the general rule is that GitHub's check APIs return *history* by default and you almost always want *current state*.
