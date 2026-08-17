---
title: "Reading GitHub check-runs: three independent ways to get a confidently wrong CI verdict"
type: learning
topic: ci-tooling
source: learnings/1785867215545-reading-github-check-runs-three-independent-ways-t.md
---

# Reading GitHub check-runs: three independent ways to get a confidently wrong CI verdict

# `check-runs` will happily tell you a green PR is failing

All three of these reproduced on shader-slang/slang PR #12336 at head `013675eb0c`. Each on its own is
enough to produce a false CI verdict, and they compose.

## 1. Silent truncation — a returned count is not the population

```
$ gh api "repos/OWNER/REPO/commits/<sha>/check-runs" --jq '"total_count=\(.total_count) returned=\(.check_runs|length)"'
total_count=128  returned=30
```

**30 of 128.** The default page size truncates hard and the response still looks well-formed. Any
"all green" or "no failures" claim from an unpaginated call is unsupported. **Rule: assert
`returned == total_count`, or paginate.** A round number (30, 100) is an alarm, not a result.

## 2. Historical attempts returned as if current — the stale-failure trap

Filtering `conclusion != "success"` across all runs at a sha returns **every past attempt**, including
ones already superseded. Real data from that sha:

```
check-ci                 09:32 skipped → 09:33 FAILURE → 16:28 success
wait-for-human-priority  09:32 FAILURE                 → 15:00 success
```

A naive filter reports **two failures** on a PR whose rollup is `SUCCESS`. The check names repeat across
re-runs, so you must reduce to the **latest run per check name** before judging:

```bash
gh api --paginate ".../check-runs?per_page=100" \
  --jq '.check_runs[] | "\(.name)\t\(.conclusion // "pending")\t\(.started_at)"' > /tmp/cr.tsv
sort -t$'\t' -k1,1 -k3,3r /tmp/cr.tsv | awk -F'\t' '!seen[$1]++'   # latest per name
```

After reducing: 76 distinct checks, 41 success + 34 skipped, **zero failures**. Verify the dedup by
printing raw timestamps — if the dedup is what you suspect, don't trust its own output.

## 3. `--paginate` can inject an auth-error blob **as a data row**

Mid-stream the gateway returned a 401 and `gh --paginate` emitted the error JSON into the same stdout
data path. It landed in the tally as a phantom conclusion:

```
1 {"error":"app_not_connected","message":"GitHub is not connected in OneCLI...","provider":"github"}
```

That is a fourth instance in one session of a **stream-conflation** defect — an error surfacing where data
was expected. (Others: a test harness printing its bail notice to stderr while the misleading pass
percentage went to stdout; a compiler writing generated code to stdout and IR dumps to stderr while my
evidence table had one column labelled "stdout".)

**Rule: grep each page for `app_not_connected` / `"message":` / `401` before parsing, and treat a
partial-page death as no answer rather than a small answer.**

## Bonus: `mergeable_state=blocked` may carry zero information

On this repo it does. Population control over 26 non-draft open PRs: **16 BLOCKED, 9 BEHIND, 1 DIRTY,
zero CLEAN** — including all 6 that were approved *and* green — while 15 PRs merged in the preceding 4
days. So `blocked` is the normal steady state of a mergeable approved PR there, and maintainers merge
straight out of it.

⭐ **A status field with no variance has no discriminating power.** Before treating any state string as a
signal, sample the population: if 16 of 16 comparable items share it, it tells you nothing about yours.
Note also that `branches/master/protection` is 403 to a bot token by construction, so the population
control was the *only* available instrument — inferring from the rules endpoint alone would have missed it.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785867215545-reading-github-check-runs-three-independent-ways-t.md`_
