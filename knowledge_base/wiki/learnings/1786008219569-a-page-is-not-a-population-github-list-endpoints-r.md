---
title: "A page is not a population — GitHub list endpoints, rates, and partial fetches"
type: learning
topic: misc
source: learnings/1786008219569-a-page-is-not-a-population-github-list-endpoints-r.md
---

# A page is not a population — GitHub list endpoints, rates, and partial fetches

## The rule

Never derive a **rate, total, or boundary claim** from what a GitHub list endpoint returned. Use `total_count` from the **narrowest endpoint that actually answers the question asked**, and state the denominator.

## What happened (2026-08-06, shader-slang/slang CI)

A `merge_group` CI failure rate was built from **repo-wide** `/actions/runs`, whose 100-item pages interleave *all* workflows. The oldest CI row *in that page* was then read as a **retention floor** — a page mistaken for a population. Published figure **48.7%**; honest figure over 500 runs of the actual workflow: **28.5% (140 of 491 conclusive)**. The bad premise propagated upward into an instruction to "carry the reproducible 48.7%".

Nothing errored, and the wrong number looked *more* alarming than reality.

This is the axis-generalized form of the **`attempts/<n>/jobs` trap**: GitHub list endpoints answer a narrower question than their name implies. The shape recurs on every axis — runs, jobs, issues, comments, PRs.

## A live-window rate is a reading, not a fact

The same 43-run slice measured **48.7%, then 46.3%** minutes apart. Ship every rate with its **window (bounds + N) and a measured-at timestamp**, or it gets quoted later as a constant.

## Same class, one layer down: a partial fetch also reads as a population

`gh api --paginate` hit a **401 mid-stream** and injected `{"error":"app_not_connected"}` into counted output, where `uniq -c` rendered it as a datum next to real conclusions. This is the `|| echo 0` failure with a different mouth.

**Guard:** per-page `jq -e '.workflow_runs'` check + a **non-ISO-row control** that must come back clean, wrapped around every count.

## Corollaries

- Never infer retention, age floors, or "that's all there is" from the last row of a page.
- Separate conclusive rows from cancelled/in-flight explicitly, and say how.
- **A correction isn't applied until every restatement is fixed** — strike retracted figures *inline* wherever still asserted; fixing them lower down leaves the wrong number reading as current.
- Our own maintainer instructions seed this: `AGENTS.md`/`CLAUDE.md` CI Health Monitoring hands out `/actions/runs?status=failure&per_page=3`. Fine for "show recent failures," **never** a base for a rate.

Same family as the earlier "absence requires corroboration" learning — a clean-looking signal that actually means "not observed."

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786008219569-a-page-is-not-a-population-github-list-endpoints-r.md`_
