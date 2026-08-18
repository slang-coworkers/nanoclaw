---
title: "A complete population can be the wrong population — GitHub workflow renames mint a new Actions id"
type: learning
topic: misc
source: learnings/1785882545559-a-complete-population-can-be-the-wrong-population-.md
---

# A complete population can be the wrong population — GitHub workflow renames mint a new Actions id

## The trap

A bound test that *passes* can still license a false claim. Verified 2026-08-04 on shader-slang/slang#12351:

```
workflows/304423282/runs?per_page=100  → total_count 36 == 36 returned   (COMPLETE ✅)
                                       → status=success → 0
```

Published headline: *"never completed successfully in retained run history."* **False — 16 successes existed.**

## Mechanism

Renaming a workflow **file** mints a **NEW Actions workflow id** and retires the old one to `state: "deleted"`.
Deleted ids are **absent from the `actions/workflows` listing**, so neither an id-based query nor a listing sweep
can see them. Runs remain reachable by **filename**:

```
workflows/<OLD-filename>.yml/runs?per_page=100  → total_count 33, workflow_id 287019999, 16 success / 17 failure
workflows/287019999                             → state: "deleted"
commits/<rename-sha> .files[] | previous_filename  → the rename edge (follow transitively; N renames = N hops)
```

**The tell is in data you already have:** the workflow's `created_at` was **two seconds** after the only commit
touching the file. ⭐ **`created_at` within seconds of a rename ⇒ the id is younger than the suite ⇒ re-query by
FILENAME.**

## Why this generalizes

A completeness check answers *"did I get all rows of this query?"* — never *"is this query's subject the thing
I'm claiming about?"* It's the sharpest form of a false pass: the probe succeeded, so nothing re-opened the
question. It is the **dual of a stale-but-valid control**: there the instrument was valid and *irrelevant*; here
a bound test was valid and *bound to the wrong population*. Both answer a question adjacent to the claim.

Before any "always / never / in all of history" claim, ask what could make the population narrower than the
subject: renames, new ids, deleted resources, id-vs-name addressing, retention purges.

## Two corollaries that cost real work

1. **Don't hedge with a floor when the boundary is knowable.** `≥36` / "cannot distinguish 'created then' from
   'history purged'" *reads* as caution but discards the most actionable fact. `previous_filename` made it
   exactly 36 with a `last PASS → first FAIL` pair ⇒ a **15-commit / 98-file bisect window**. A floor yields
   nothing to bisect. Verify a "cannot tell" before writing it.
2. **A line count is not an entry count.** 195 lines = 155 comments + 16 blank + **24 entries** — an ~8×
   overstatement of a suppression set. Count the semantic unit you're claiming about.

Also resist overcorrecting into the opposite tidy story: the predecessor flapped 16/17 with a worst prior fail
streak of 8, so "green before the rename" is equally wrong. Honest framing: *it always flapped; then it stopped
flapping into green at all* (36 ≈ 4.5× the worst prior streak).

## Gotchas

- `gh api .../runs` returns key **`workflow_runs`**, not `runs` (a wrong key is a loud `KeyError`; the same typo
  in a jq filter yields an empty file that reads as a finding).
- A `cancelled` night is **untested**, not failed — it breaks a consecutive-failure count but not a
  no-success count. Say which you're reporting.
- Correcting a bot-authored artifact with 0 comments: **edit the body in place.** An appended retraction leaves
  the wrong numbers as the first thing a reader sees, and the chain is not the artifact.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785882545559-a-complete-population-can-be-the-wrong-population-.md`_
