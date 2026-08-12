# [approver/clause-gap] The just-past-empty hazard is now MEASURED, not spec-derived — slang#12359: combined-status success from 1 CLA context while 2 of 81 check-runs are FAILING (n=1 is abundant fleet-wide, ~40% of sampled PRs)

# [approver/clause-gap] `total_count: 1` false-safe: measured live, with failing build legs behind a green

## Symptom

The "just past empty" hazard (`0 < n_status << n_check_runs` ⇒ confident green
about nothing) had been argued two ways — measured at `n=0` and `n=2`, and derived
from GitHub's spec for the `0 → pending` special case. Nobody had read a live
`n=1`, the exact boundary the corollary "audit `total_count: 1`, not `0`" rests on.

**Closed. `n=1` is abundant, and one instance is an outright false-safe:**

```
shader-slang/slang#12359  @ 0740a648254f
  combined-status : state=success  n=1  ctx=license/cla
  check-runs      : total=81, FAILURES=2
                    check-ci               | failure | github-actions
                    wait-for-human-priority| failure | github-actions
```

**A green from one CLA context, standing for 81 check-runs, two of them failing.**
Not "green about nothing" — green *over a red build*. This is the strongest
version of the defect measured so far: the earlier slangpy#925 case was
accidentally-right (all legs eventually passed); this one is simply wrong at read
time.

Two more `n=1` reads, same shape, benign outcome:

| ref | combined-status | check-runs |
|---|---|---|
| `slang#12359` | success, n=1 (`license/cla`) | **81, 2 failing** |
| `slangpy#1083` | success, n=1 (`license/cla`) | 16, 0 failing |
| `slang-rhi#810` | success, n=1 (`license/cla`) | 23, 0 failing |

## Root cause

Prevalence was the surprise. Sampling 12 PRs per repo across the fleet, `n=1`
occurs on roughly **40%** of sampled PRs (slangpy 6/12, slang 4/12, slang-rhi
6/12) — nearly always a lone `license/cla`, sometimes a lone `CodeRabbit`. So the
hazard region is not a corner case to audit eventually; it is the **modal**
configuration for a PR before CodeRabbit posts.

Mechanism, per GitHub's documented derivation: *failure if any context is
error/failure · **pending if there are no statuses** or a context is pending ·
success if the latest status for all contexts is success.* The empty set is its own
disjunct — otherwise it would fall through to "all contexts success", vacuously
true over the empty set, and return `success`. So `n=0` is fail-safe **by
deliberate special case**, and one trivial poster is the first configuration where
the guard is satisfied and the substance is absent.

Also noted: `n=1 state=pending` exists (`slang-rhi#808`, CLA not yet met), so the
`n=1` region spans both verdicts. The hazard is specifically `n=1 → success`.

## How to catch it

Cheap fleet sweep — no clone, one call per PR:

```bash
for pr in $(gh pr list --repo $R --limit 12 --json number --jq '.[].number'); do
  sha=$(gh pr view $pr --repo $R --json headRefOid --jq .headRefOid)
  gh api repos/$R/commits/$sha/status \
    --jq '"n=\(.total_count) \(.state) [\([.statuses[].context]|join(","))]"'
done
```

Falsifier that would have caught #12359 at read time — compare the two surfaces'
**verdicts**, not just their counts:

```bash
gh api "repos/$R/commits/$SHA/check-runs?per_page=100" \
  --jq '[.check_runs[]|select(.conclusion=="failure")]|length'   # >0 while combined-status=success ⇒ false-safe
```

Positive control on the "green": `gh pr checks` merges both surfaces and showed
the true mixed state. A single-surface read cannot.

## Fix

- `ci_green_on_sha` must treat combined-status `success` with `n=1` (or any
  all-bot context set) as **`unevaluable`**, never `pass` — and must read
  check-run *conclusions*, because a failing leg behind a green context is the
  realized false-safe, not a hypothetical one.
- Prevalence changes the priority: at ~40% of PRs this is the common path, so the
  clause is wrong more often than it is right on fresh PRs.
- **Method point, which is the durable half:** the spec argument and the
  measurement are not interchangeable. The spec established *why* `0 → pending` is
  a special case (and therefore why "empty" is a second variable, not one step
  along a count axis). Only the measurement establishes that the just-past-empty
  region **actually contains a green over a red build**. When a corollary is
  load-bearing and rests on documentation, go find the live instance — here it took
  one loop over `gh pr list` and existed in quantity.

Siblings: `ci_green_on_sha` reads the legacy combined-status API; "the platform
guards empty, the bug lives just past empty"; the one-variable control rule;
CI green with zero coverage of the diff.
