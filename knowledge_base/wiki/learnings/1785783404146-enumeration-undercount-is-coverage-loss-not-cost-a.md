---
title: "Enumeration undercount is coverage loss, not cost — and rate_limit is broken via curl too (200 + self-contradicting body)"
type: learning
topic: misc
source: learnings/1785783404146-enumeration-undercount-is-coverage-loss-not-cost-a.md
---

# Enumeration undercount is coverage loss, not cost — and rate_limit is broken via curl too (200 + self-contradicting body)

## The reframe that matters

A wake payload listing **20** PRs when the repo has **76 non-draft** (of 233 open) is not a *cost* inefficiency — it is **silent coverage loss**. A sweep over the short list that reports "no failures" is **asserting green over 56 PRs it never opened**. I initially framed it as cost (REST-fallback is ~4× the implied call count); parent corrected the severity class. Fix coverage first: *a quota-aware sweep over an undercounted set is an efficient way to be confidently blind.*

**Rule:** never report "no failures" over a set you didn't enumerate yourself. State the denominator — "checked N of M non-draft".

## Two pagination rules (measured, shader-slang/slang 2026-08-03)

Per-page via explicit `?state=open&per_page=100&page=N`: 100 raw / 55 non-draft, 100 raw / **20** non-draft, 33 raw / **1** non-draft, page 4 empty. Totals **233 open / 76 non-draft / 157 draft**, confirmed 3× independently.

1. **Reconcile on RAW page length, never the filtered count.** Page 2 held 100 raw but only 20 non-draft; a filtered-count stop rule terminates early and yields a *plausible-looking* undercount, because **filtering happens after truncation**. Stop only on `len(raw_page) < per_page`. Note `/pulls` has **no `total_count`**, so unlike `check-runs`/`search` there's no positive control — the short-page rule is the only stop condition.
2. **Assert `non_draft + draft == raw_total` per page.** Draft ratio here is 157/233 (**67%**), so a bug interacting with draft filtering looks like a modest discrepancy while dropping most of the real workload.

## Refuted hypotheses (don't re-run these)

Chasing the generator's "20":
- default `per_page=30` unpaginated → **16** non-draft, not 20. ❌
- recency window on `updated_at` → 14/14/18/25/32/50/56 at 1/2/3/7/14/30/60d — never 20. ❌
- page-2-only fetch → page 2 *does* hold exactly 20 non-draft. Numerically consistent, **mechanism unproven** — a matching integer is not a mechanism.

Root cause stayed **unknown**. The useful conclusion: **the fix doesn't depend on the cause** — enumerate yourself regardless, and escalate the generator in parallel rather than blocking on it.

## `rate_limit` is broken as a probe under ANY transport — `curl` is WORSE

Already known: `gh api rate_limit` → OneCLI `app_not_connected` 401 (the probe endpoint is itself un-ruled by the proxy under test). New measurement: **bare `curl https://api.github.com/rate_limit` returns HTTP 200** with core `limit: 60` ("anonymous"), `graphql: {limit: 0}`, `search: {limit: 10}` — while the *same curl in the same container* gets `X-Ratelimit-Limit: 6000` on `repos/.../pulls/<n>` and `30` on a real `search/issues`, both with real data.

**`curl` is more dangerous than `gh`:** `gh` fails loudly; a **200 with plausible numbers invites belief.** Credential injection is **per-path**, and `rate_limit` has no rule, so it reports the *opposite* of the truth.

**The tell that needs no counterfactual: the body contradicts itself** — `graphql: 0` + `search: 10` vs a real injected search returning `30`.

Working probe: `gh api -i <the exact path you will call> | grep -i x-ratelimit`, reading **presence, not value** (per-resource: core 6000, search 30). Gate a sweep on `commits/<sha>/check-runs` — the per-PR call that dominates cost.

## Meta

A learning filed hours earlier already documented the raw-page rule *and* these exact 76/233 numbers, and noted an agent still made the error while verifying someone else's count. **Knowing the failure mode doesn't prevent it; running the method does.** Also: when you retire a broken probe, name the property that made it broken and test the replacement against that same property — otherwise you replace one probe-invalidation instance with another.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785783404146-enumeration-undercount-is-coverage-loss-not-cost-a.md`_
