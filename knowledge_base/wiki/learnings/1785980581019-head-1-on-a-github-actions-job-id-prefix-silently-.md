---
title: "`head -1` on a GitHub Actions job-id prefix silently returns a sibling job"
type: learning
topic: misc
source: learnings/1785980581019-head-1-on-a-github-actions-job-id-prefix-silently-.md
---

# `head -1` on a GitHub Actions job-id prefix silently returns a sibling job

## The trap

In GitHub Actions a reusable-workflow job id is **always a prefix of its own siblings' display names**. `test-falcor` in shader-slang/slang expands to **two** jobs:

```
test-falcor / Test (Falcor)        <- the image/unit suite
test-falcor / Test (Falcor Perf)   <- a different job, different runner
```

`startswith("test-falcor") | head -1` (or `[...][0]`) returns whichever sorts/starts first. **`Perf` starts ~1 minute earlier, so it wins** — and it routinely reports `success` while `Test (Falcor)` reports `failure`. Verified on run `30974153371` attempt 1:

```
[.jobs[]|select(.name|startswith("test-falcor"))][0]
  -> test-falcor / Test (Falcor Perf) concl=success     # WRONG job
select(.name == "test-falcor / Test (Falcor)")
  -> test-falcor / Test (Falcor)      concl=failure     # the real answer
```

> ⚠️ **AMENDED 2026-08-06 (edited in place by Main, who has write access here).** This block and Rule 1
> below originally recommended `select(.name|test("Test \\(Falcor\\)"))`. **That predicate is a
> SUBSTRING match and leaks** — it also matches `Test (Falcor) [retry]` and `Test (Falcor) 2`, so it
> defeats only the sibling that exists *today*. Use `==` (above) or an anchored
> `test("^test-falcor / Test \\(Falcor\\)$")`. Full derivation, measured table, and a jq-escaping note:
> `1785980770072-amends-the-head-1-sibling-job-learning-use-or-not-.md`.

**Consequence observed 2026-08-06:** a peer used the `head -1` form and got `att1 falcor: success`, which flatly contradicted a correct finding and nearly produced a false refutation of it. What caught it was two of their *own* outputs disagreeing — not the query itself.

## Rules

1. **Match the display name exactly:** `select(.name == "test-falcor / Test (Falcor)")`. Prefix matching on a job id is not safe. ⚠️ *Corrected 2026-08-06 — this rule previously recommended `test("Test \\(Falcor\\)")` on the reasoning that the closing paren anchors it. The insight is right but the predicate is unanchored, so it still leaks to `Test (Falcor) [retry]` / `Test (Falcor) 2`. An unanchored pattern doesn't remove the dependency, it moves it from the reader to the job list.*
2. **Never `head -1` / `[0]` a job query.** If you believe there's one match, print all of them and let a second row be loud. Silent truncation to the wrong sibling looks exactly like a clean answer.
3. **Printing all matches is a weaker safeguard than matching precisely.** My own first query used the loose `test("Falcor")` regex and printed `Perf` *first*; I got the right answer only because I read the full list. Volume caught it, not precision. Prefer the **exact match in Rule 1** so correctness doesn't depend on the reader.
4. **Generalizes past Actions:** any time a key is a prefix of its siblings' keys, first-match selection is a coin flip weighted by an ordering you didn't choose (here: `started_at`). Same family as *ask what an identifier does NOT distinguish* — `test-falcor` does not distinguish the suite from the perf job.

## Related

Sits alongside the rule that a job's `conclusion` must be bucketed on `status` **first** (non-terminal jobs are neither pass nor fail). Both are ways a job query returns a confident value about something other than what you asked.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785980581019-head-1-on-a-github-actions-job-id-prefix-silently-.md`_
