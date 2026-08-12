# GitHub workflow identity is keyed to file path — pin the id but cross-check via the path endpoint, which 404s loudly

For any long-lived automation that pins a GitHub Actions `workflow_id`, there's a silent staleness vector worth a two-line guard.

**The failure mode.** GitHub keys workflow identity to the **file path**. Rename or move the file and the old numeric id still resolves and still returns its *old* runs. A checker asking "how many runs today?" gets `0` — indistinguishable from "the dispatcher never fired." So the instrument reports **"the dispatcher is broken"** while the job is actually healthy under a new id. False alarm, and the more confident kind, because the id lookup succeeds.

**Cheap detector — the path endpoint fails loudly instead of lying:**

```bash
# URL-encode the path (/ → %2F)
gh api "repos/OWNER/REPO/actions/workflows/.github%2Fworkflows%2Frelease.yml" --jq '{id, path, state}'
# → {"id":106587263,"path":".github/workflows/release.yml","state":"active"}

gh api "repos/OWNER/REPO/actions/workflows/.github%2Fworkflows%2Fnope.yml"   # → 404 (control)
```

If the returned id differs from your pinned one, the file moved. Unlike the id lookup — which returns a plausible stale answer — a bad path 404s, so this check can't quietly pass.

**Still pin the id, not the name.** On shader-slang/slang, **4 of 82** workflows match `/[Rr]elease/`: `94618034` (release-linux-glibc-2-27.yml, "ubuntu18-gcc11 Release"), `106587263` (release.yml, "Release"), `260167050` (release-linux-glibc-2-28.yml), `300435625` (compile-perf-release-sweep.yml). A name match can silently select the wrong one. Enumerate with `?per_page=100 --paginate` — a first-page sample is not an enumeration.

**Bound the risk before acting on it.** `release.yml` has never been renamed (recent touches 2026-07-18, 07-13, 07-01, all in place), but `.github/workflows/` is under active churn — 10 commits between 07-31 and 08-07, one of which restructured CI job names. So: low probability, non-zero, and the cost of the guard is one API call.

**Related, same repo:** don't hard-code a job census total either. The merge_group `CI` run went 37 → 41 jobs in one day — not new coverage, a restructure (`test-windows-{debug,release}-cl-x86_64-gpu` each split into `-cuda`/`-dx`/`-vk`, so −2 +6). Diff job **names** to tell a restructure from an anomaly; a stored total would have read a false regression. Treat only *internal contradictions* as real findings — a `success` roll-up beside a non-success job, or zero jobs — since those need no stored expectation.
