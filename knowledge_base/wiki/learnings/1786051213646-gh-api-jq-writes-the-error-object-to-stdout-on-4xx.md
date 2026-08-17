---
title: "gh api --jq writes the error object to stdout on 4xx, so emptiness guards are unreachable dead code"
type: learning
topic: misc
source: learnings/1786051213646-gh-api-jq-writes-the-error-object-to-stdout-on-4xx.md
---

# gh api --jq writes the error object to stdout on 4xx, so emptiness guards are unreachable dead code

**Verified 2026-08-06 in two independent forms (shader-slang/slang tooling).** `gh api --jq` prints the
API **error JSON to stdout** when the request fails, so any guard that tests the captured value for
emptiness can never fire.

```bash
CTL=$(gh api "repos/O/R/commits/0000000000/check-runs" --jq '.check_runs|length' 2>/dev/null)
# rc=1  AND  stdout = {"message":"No commit found for SHA: 0000000000",…,"status":"422"}

[ -z "$CTL" ] || [ "$CTL" = "0" ] && echo "PROBE BROKEN"    # ← NEVER FIRES: non-empty, not "0"
```

The value is simultaneously *a failure signal* and *plausible-looking data*. `2>/dev/null` makes it
worse — it hides the human-readable half while the JSON still lands on stdout. Capturing into `$( )`
discards `rc`, so the one honest signal is thrown away and the remaining test is dead code.

**Second form, same mechanism, worse blast radius:** with `--paginate` on a paginated endpoint, an
auth failure mid-walk was emitted **as a data row** — `{"error":"app_not_connected",…}` — so
`sort | uniq -c` tallied the error object as if it were a check-run conclusion, alongside
`skipped`/`failure`. The walk also stopped at **100 of `total_count: 122`**. A partial, contaminated
census formatted identically to a complete clean one.

**Fixes — validate the SHAPE you expect, never merely non-emptiness:**
```bash
printf '%s' "$CTL" | grep -qE '^[0-9]+$' || { echo "PROBE BROKEN"; exit 1; }   # error object fails regex
```
- For row streams, add two guards: **rows collected == `total_count`**, and **grep the rows for error
  keys** (`error"`, `app_not_connected`, `"status":"4`).
- Prefer an explicit `page=` loop over `--paginate` when the figure will be published.
- **Check `rc` OR validate the shape — emptiness validates neither.** These are two distinct guards.

⭐⭐ **The meta-rule that caught it: write a control-of-the-control.** Point the probe at a deliberately
bogus id and confirm the "probe broken" branch actually fires. Both instances were found that way, and
in both cases the guard had looked correct on inspection. Ask of any guard: *what would this print if
the call failed?* If the answer is "the same thing", it is a formatting step, not a check.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786051213646-gh-api-jq-writes-the-error-object-to-stdout-on-4xx.md`_
