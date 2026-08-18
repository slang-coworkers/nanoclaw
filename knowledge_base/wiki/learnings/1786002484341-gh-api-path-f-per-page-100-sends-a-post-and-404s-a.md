---
title: "`gh api <path> -f per_page=100` sends a POST and 404s — and the bare path silently truncates a census to 30"
type: learning
topic: misc
source: learnings/1786002484341-gh-api-path-f-per-page-100-sends-a-post-and-404s-a.md
---

# `gh api <path> -f per_page=100` sends a POST and 404s — and the bare path silently truncates a census to 30

Two `gh api` traps that both produce a **clean, plausible, wrong answer** when you are counting things. Reproduced on shader-slang/slang, 2026-08-06.

**Trap 1: `-f` makes it a POST.** `gh api <path> -f key=value` sends the field as a **request body**, which switches the method to POST. GitHub has no POST route for most read endpoints, so you get:
```
$ gh api "repos/O/R/actions/runs/<id>/jobs" -f per_page=100 --jq .total_count
{"message": "Not Found", "documentation_url": "https://docs.github.com/rest", ...}
```
…while the query-string form works:
```
$ gh api "repos/O/R/actions/runs/<id>/jobs?per_page=100" --jq .total_count
36
```
**Why it is dangerous: a 404 is a statement about your request, not about the world.** A peer ran 12 cells this way, got 12 × 404, and read it as *"no build/test jobs exist"* — which was the conclusion they were trying to confirm. Confirmation and instrument failure are indistinguishable here. It also mimics a permissions/capability gap, so you may conclude an endpoint is unavailable from your edge when it is fine.

**Trap 2: the bare path truncates to the default page, with no signal.** Same run, same endpoint:
```
bare path        -> 30 jobs
?per_page=100    -> 36 jobs
total_count      -> 36
```
Six jobs vanish with **no error and no marker**. If you are computing "how many build/test jobs failed / were skipped", the bare path can give you a smaller, entirely reasonable-looking census. Always pass `?per_page=100` (in the URL) and **cross-check `.jobs | length` against `.total_count`** — if they differ, paginate.

**How to apply:**
- Read requests: put every parameter in the **URL**. Reserve `-f`/`--field` for genuine POST/PATCH bodies. (`-F`/`--raw-field` has the same POST-switching effect.)
- Any time you assert a **count** or a **zero** from `gh api`, verify the instrument in the same breath: check `total_count` vs the array length, and run a must-hit control — a path you *know* returns data. A 404 or a short array on the control means your query is broken, not that the world is empty.
- Sibling rule from the same session: **source says what could happen, the log says what did** — when a scheduled job explains its own decision in its log, read the log rather than predicting from its code. Both are the same failure: reaching for a convenient instrument that answers a *different* question than the one asked, and returning success-shaped output either way.

Related notes worth grepping together: `statusCheckRollup` can report 0 failing while `commits/<sha>/check-runs` reports 2 (dedupes by job name); `gh run list --branch` cannot see amended-away SHAs and returns a smaller head count with no error.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786002484341-gh-api-path-f-per-page-100-sends-a-post-and-404s-a.md`_
