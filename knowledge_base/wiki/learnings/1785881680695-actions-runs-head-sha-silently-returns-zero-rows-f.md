---
title: "actions/runs?head_sha= silently returns ZERO rows for a TRUNCATED sha (HTTP 200)"
type: learning
topic: misc
source: learnings/1785881680695-actions-runs-head-sha-silently-returns-zero-rows-f.md
---

# actions/runs?head_sha= silently returns ZERO rows for a TRUNCATED sha (HTTP 200)

## The trap

Two GitHub REST surfaces disagree on sha length, and only one of them tells you:

| endpoint | 8-char prefix sha | full 40-char sha |
|---|---|---|
| `commits/{sha}/check-runs` | ✅ **works** (prefix resolution) | ✅ works |
| `actions/runs?head_sha={sha}` | ⛔ **`total_count: 0`, HTTP 200, no error** | ✅ works |

So a pipeline that stores `sha[0:8]` (cheap for logging) and reuses it for both calls gets real
data from the first and **an empty set that looks like a clean result** from the second.

## Why it bit hard (2026-08-04 CI sweep)

I built a phantom-red detector — "for each red PR, is there a LATER successful run of the SAME
workflow name?" — and ran it over 24 red PRs. It reported **"TRULY RED: 0, phantom-only: 24"**,
i.e. *the entire repo's CI is fine*. Every PR printed a bare header line and nothing under it,
because `byname` was built from an empty `workflow_runs` list. Zero rows ⇒ no `bad` runs found ⇒
no live-red appended ⇒ absence read as **agreement**.

The tell was **implausibility, not an error**: #11709 demonstrably had a `failure` CI run I had
read minutes earlier, so "0 truly red" could not be true. Note the failure mode is asymmetric and
dangerous in one direction only: it manufactures **green**, never red.

## What to do

1. **`assert len(sha)==40`** before any `head_sha=` query. Enumerate PRs with `.head.sha`, never
   a truncated copy.
2. **Treat `total_count==0` as UNRESOLVED, never as "no failures."** Push those rows into an
   explicit residual bucket and print it loudly; fail on leftovers rather than summarizing.
3. **Sanity-check any aggregate that retires a question.** "0 truly red across 73 PRs" is a
   reassurance — exactly the class that gets audited least. One known-red control row (a PR you
   independently confirmed is failing) inside the loop turns this from a silent false pass into an
   immediate assertion failure.

Generalizes: when two endpoints accept "the same" identifier, verify the *lenient* one isn't
lending false confidence to the *strict* one.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785881680695-actions-runs-head-sha-silently-returns-zero-rows-f.md`_
