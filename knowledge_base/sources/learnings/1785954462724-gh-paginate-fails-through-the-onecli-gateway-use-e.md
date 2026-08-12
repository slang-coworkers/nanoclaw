# gh --paginate fails through the OneCLI gateway — use explicit page= loops

## `gh api --paginate` breaks through the OneCLI gateway; the error looks like an auth outage

Observed 2026-08-05 while sweeping 76 PRs' check-runs.

`gh api --paginate <path>` fails with:

```
gh: GitHub is not connected in OneCLI. Ask the user to open this URL to connect it: http://.../connections?connect=github...
```

**The trap:** this reads exactly like the known flapping-gateway 401, so the instinct is "gateway is down, retry later." It is not. The first page succeeds; the *follow-up* request `--paginate` issues internally goes out unauthenticated. So the failure is **deterministic and selective** — it hits only resources with more than one page.

In my sweep it failed on exactly 6 of 76 PRs. Those 6 were precisely the ones with **>100 check-runs** (120–157 each). The other 70 fit in one page and "worked", which made the pattern look random until I compared the failing set against `total_count`.

**Diagnostic that separates the two causes:** run the same path with and without `--paginate`.

```bash
gh api "repos/O/R/commits/$SHA/check-runs?per_page=100"             # rc=0
gh api --paginate "repos/O/R/commits/$SHA/check-runs?per_page=100"  # rc=1, "not connected"
```

If the bare call succeeds and only the `--paginate` call fails, it is this defect, not the gateway. A `{viewer{login}}` GraphQL probe will come back green and mislead you.

**Fix — explicit page loop, terminating on `total_count`:**

```bash
page=1
while :; do
  gh api "repos/O/R/commits/$SHA/check-runs?per_page=100&page=$page" > p$page.json || break
  got=$(python3 -c "import json;print(len(json.load(open('p$page.json'))['check_runs']))")
  total=$(python3 -c "import json;print(json.load(open('p$page.json'))['total_count'])")
  [ "$got" -eq 0 ] && break
  [ $(( (page-1)*100 + got )) -ge "$total" ] && break
  page=$((page+1))
done
```

**Then assert completeness**, because the real hazard is silent truncation, not the loud error: for every fetched resource check `len(items) == total_count`. A partial check-run list makes a red PR read as green — a false pass that retires the question. I verified 76/76 complete before classifying anything.

Same class of bug as `gh api -F/-f` without `-X GET` POSTing to a 404 whose body is valid JSON: the instrument fails in a way that yields parseable output, so downstream counts look like measurements.
