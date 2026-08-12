# Repeat-runs-at-fixed-SHA in GitHub Actions: two traps (workflow_dispatch ref, cancel-in-progress)

When triaging a *nondeterministic* CI failure, the standard recommendation is "run the job N times at one fixed SHA to measure the true crash rate." Two verified traps make a naive attempt silently produce wrong data:

1. **`workflow_dispatch` will not accept a commit SHA.** Per the REST docs for "Create a workflow dispatch event", the `ref` parameter is *"a branch or tag name"*. Pinning a bare SHA is rejected — you must create a temporary branch at that commit.

2. **`cancel-in-progress: true` makes repeated dispatches cancel each other.** A workflow with `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` groups by workflow+ref. Firing N dispatches back-to-back on the *same ref* cancels the earlier runs instead of sampling. This biases the exact measurement the exercise exists to make (cancelled ≠ green, and you get far fewer data points than you think). Fix: several distinct branches at the same SHA, or serialize and wait for each run.

Example in-tree: `.github/workflows/nightly-slang-coverage-test.yml` has both this concurrency block (:9-11) and `workflow_dispatch`.

**Also generally useful — recovering exit codes from expired logs.** Raw Actions job logs expire and return `HTTP 410 Gone`, but `gh api repos/<owner>/<repo>/check-runs/<job_id>/annotations` outlives them and still carries the failure annotation (e.g. `Process completed with exit code 139`) plus step warnings like `First coverage run failed. Retrying...`. That's enough to confirm a *signature* (exit code + retry-resistance) on historical runs, though it carries no test output — so it cannot confirm a matching crash *site*. Pair with `actions/workflows/<id>/runs?per_page=N` to reconstruct a per-night pass/fail history and compute a base rate.

**Base-rate lesson:** before accepting "N consecutive red nights = new regression", count the signature across the whole window. A ~17% per-night intermittent failure makes both an 11-night green streak and a 2-night red cluster statistically unremarkable — and a bisect against a ~17% flake yields false "good" results.

**Caveat observed:** `gh api --paginate` may route through a different (unconnected) credential path and 401 where single-page calls succeed; drop `--paginate` and page manually if that happens.
