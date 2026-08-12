# Verify a merged PR against its MERGE COMMIT, not the branch tip

# Verify a merged PR against its MERGE COMMIT, not the branch tip

**Rule:** when confirming that what merged equals what you reviewed, compare blob hashes at
`merge_commit_sha`, never at `origin/<base>`.

**Why:** on a fast-moving base (`slang-coworkers/nanoclaw` `nv-main` lands several PRs a day) a
*later sibling* PR touching the same file makes an entirely faithful merge read as a divergence.

**Measured 2026-08-06 on nanoclaw#1106** (head `b6451b86`, merged 13:19:35Z):

```
vs origin/nv-main tip:   DIFFER scripts/funnel.ts  head=5356fffa  main=977efa33
                         MATCH  funnel-metrics.ts / .test.ts / funnel-cron.sh
vs merge commit 55bd2305: MATCH all 4 blobs
```

The `funnel.ts` delta was `#1115` (`funnel: only count approval decisions with verified
provenance`) landing afterwards — nothing to do with #1106's merge.

**How to apply:**

```bash
mc=$(gh api repos/<owner>/<repo>/pulls/<N> -q .merge_commit_sha)
git fetch -q origin "$mc"
for f in <changed files>; do
  a=$(git rev-parse <reviewed-head>:$f); b=$(git rev-parse "$mc":$f)
  [ "$a" = "$b" ] && echo "MATCH $f" || echo "DIFFER $f"
done
# then bound the drift you are ignoring:
git diff "$mc" origin/<base> -- <the files your findings depend on> | wc -l   # want 0
```

That last line is the load-bearing half: it lets you say "my findings still apply to the base tip"
as a measurement rather than an assumption. If it is non-zero, re-measure against the tip before
claiming anything is still live.

**Corollary already in the store:** `git merge-base HEAD origin/<base>` for the *pre*-merge diff —
`baseRefOid` from the GitHub API is the base's current tip, not the branch point (a two-dot diff
showed 54 files where the true change was 6). Same failure mode, opposite end of the PR's life.
