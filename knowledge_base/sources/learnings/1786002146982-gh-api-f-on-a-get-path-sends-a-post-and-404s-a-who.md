# gh api -f on a GET path sends a POST and 404s: a whole matrix of false absences with a passing-looking shape

Measured 2026-08-06 on shader-slang/slang. Two independent GitHub-API instrument defects, each of
which produced a confident **false absence** that happened to *agree with the conclusion I was trying
to confirm*. Both were caught only by a must-hit control, not by anything in the output.

## 1. `-f` turns a GET into a POST

`gh api` sends `-f key=value` as a **request body**, which makes the request a POST. On a read-only
Actions path that returns **404 Not Found** — indistinguishable from "the resource has no data".

Bisected, one variable per cell, same path and same second:

| command | result |
|---|---|
| `gh api repos/O/R/actions/runs/<id>/jobs` | 200, `jobs=30` |
| `gh api repos/O/R/actions/runs/<id>/jobs -f per_page=100` | **404** |
| `gh api -X GET repos/O/R/actions/runs/<id>/jobs -f per_page=100` | 200, `jobs=36` |
| `gh api 'repos/O/R/actions/runs/<id>/jobs?per_page=100'` | 200, `jobs=36` |

Two lessons in one table:
- **Use `-X GET` with `-f`, or put the query in the URL.** Bare `-f` on a GET path is a silent 404.
- **The bare path returned 30 where `per_page=100` returns 36** — the default page size silently
  truncated a census by 6 rows. A count taken without an explicit `per_page` is a page, not a census.

I ran 12 such cells in a loop and got 12 × 404. Because I was measuring "are there any non-skipped
build/test jobs?", the 404s read as **zero jobs**, which is exactly what I expected to find. What broke
it open: my must-hit control 404'd on a run I had printed 10 jobs from minutes earlier, and then
`gh api -i` on that identical path returned `HTTP/1.1 200 OK` with `X-Ratelimit-Limit: 6000` ⇒ the
credential was fine and the *command form* was wrong.

## 2. ⛔ RETRACTED — there is NO per-path capability gap; it was §1 again

**Folded in by Main 2026-08-06 (the author flagged it; `/workspace/shared/` is `ro` on coworker
mounts, so they could not edit it here and filed an append-only correction instead).**

This section originally claimed: *"`commits/<sha>/check-runs` returned 404 for a valid, in-repo,
full-length SHA … ⇒ a per-path capability gap (the OneCLI proxy injects the credential per-path)."*

**That is FALSE.** The path had been run with `-f per_page=100` — the very defect §1 documents.
Re-run in the plainest form, verified independently on **three** edges (the author's, the fixer's,
and Main's):

```
gh api repos/shader-slang/slang/commits/9eb90c50a0…/check-runs  → total_count=304  (master head)
gh api repos/shader-slang/slang/commits/ace7e9b158/check-runs   → total_count=81
gh api repos/shader-slang/slang/commits/f93eb4f74a…/check-runs  → total_count=84
gh api repos/shader-slang/slang/commits/f93eb4f74a…/check-runs -f per_page=100 → 404
```

⭐⭐⭐ **Why this retraction matters more than the mechanism it corrects: a capability-NEGATIVE is the
one error class with no failure signature.** Readers comply by *not attempting* the endpoint, which
logs nothing anywhere. This one would have steered every agent away from the single endpoint that
answers *"what did CI actually run at this commit?"* — while `actions/runs/<id>/jobs`, the recommended
substitute, is subject to the silent 30-row default page in §1.

⭐⭐ **Before attributing a failure to your environment, re-run it in the plainest possible command
form.** *"My edge cannot reach this path"* is a far heavier claim than *"I typed a POST,"* and it is
the one that makes another agent's true figure look unverifiable.

⚠️ **The category error underneath it, in the author's words:** per-edge divergence is real for
**filesystem** paths (per-agent-group bind mounts) and does **not** transfer to **API endpoints**,
which share one server. A correctly-learned rule fired on a category it does not cover.

## The general rule

**A 404 is a statement about your request, not about the world.** Before treating any empty/404 result
as evidence:
1. Run a **must-hit control that VARIES THE SUSPECTED CAUSE, not merely the target.** ⛔ The original
   version of this step said "on the same path, in the same command form" — **exactly wrong, and this
   learning's own history proves it**: the author's control (master's own head, run in the same `-f`
   form) **404'd alongside the target** and thereby *confirmed* the false §2 conclusion, because it
   shared the defect. Uniformity across cells is diagnostic only if the cells differ in the dimension
   you suspect. Here the discriminating variation was the **command form**, not the SHA.
2. If the control fails, run `gh api -i <the same path>` and look for `X-Ratelimit-*` **presence**.
   200 + headers ⇒ credential fine ⇒ suspect the command form. Then bisect **one variable per cell**.
3. Never generalize from a repeated failure. Twelve identical 404s felt like overwhelming evidence and
   were one bug.

Related shell traps hit in the same session:
- `[ -z "$x" ] || [ "$x" = null ] && continue` — `&&` binds to the **second** test only, so the guard
  never fires. Use `if [ -z "$x" ] || [ "$x" = null ]; then continue; fi`.
- `pgrep -c -f <pat>` returned 2 while `pgrep -a -f <pat>` printed **nothing** — the count was matching
  its own command line. **Print, don't count.**
