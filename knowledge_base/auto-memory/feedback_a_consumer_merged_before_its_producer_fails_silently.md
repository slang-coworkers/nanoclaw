---
name: feedback_a_consumer_merged_before_its_producer_fails_silently
description: "A renderer consuming a NEW schema while its producer PR is unmerged renders an authoritative headline over zero rows — and a `complete === false` fail-closed guard cannot catch it, because the OLD producer never writes that key (undefined === false is false)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e5a24ae7-c55e-4c72-b210-2090d1160367
---

# A consumer merged before its producer degrades silently, and the fail-closed guard misses it

**Measured 2026-08-06 on nanoclaw#1104 head `b8f83c94`**
([[project_nanoclaw_1104_dashboard_denominator_panels]]).

A dashboard PR was rewritten to consume corrected metric schemas from two sibling PRs (`#1106`,
`#1107`). Every field it read genuinely existed — verified line-by-line in both producer heads. **But
both producers were still OPEN.** Piping the *currently deployed* producer into the new renderer:

```
old production schema -> {issues, unattributed, by_month, bot_month, merged_bot, …}
new renderer          -> "Attribution coverage 14% (12/84) … floor, not a total"
                         culprit merge month | bot-caused | per 100 … | mixed
                         (ZERO rows)
```

An authoritative coverage headline and a "numerator and denominator describe the same population"
caption, both rendering above an empty table. It reads as *"no regressions this period"*, not
*"schema mismatch"*.

## ⭐⭐⭐ The fail-closed guard could not catch it, and the reason generalises

The new producer publishes `complete: false` on a broken run, and the renderer checks
`if (rq.complete === false)`. That guard is correct for its intended case and **structurally unable**
to fire here:

```js
rq.complete            // undefined — the OLD producer never writes this key
undefined === false    // false  -> falls through to the cohort read
months = union(cohort_bot, cohort_human, cohort_mixed)  // all absent -> []
```

⇒ **A sentinel that means "the producer told me it failed" cannot detect "the producer is too old to
have a sentinel."** Absence-of-key and explicit-false are different states, and a strict `=== false`
collapses the first into the happy path. Cf.
[[feedback_a_null_guard_inside_a_truthiness_branch_is_dead]] — same family: read the guard's
reachability, not its wording.

## ⭐⭐⭐ The discriminator: a sibling panel in the SAME FILE degraded honestly

The other panel in the same commit read a new field *and* a new discriminant:

```js
rc.roundDefinition === 'feedback-session' ? <the rule> : 'Round definition unavailable from this snapshot.'
```

Against the old producer it renders `no data` plus that explicit sentence. **Same mismatch, same
file, one panel says so and the other stays silent** — because one branched on a schema *marker* and
the other only read schema *payload*. ⇒ **When consuming a new schema, branch on a marker whose
ABSENCE is meaningful, not just on the fields you need.** Then merge order stops mattering in either
direction, which is a better fix than hand-managing it.

⭐⭐ **Having the honest sibling in the same diff is what made the silent one provable rather than
speculative** — it demonstrated the fix already existed ten lines away. *Look for the same class of
handling elsewhere in the diff before writing a finding as a design suggestion.*

## ⚠️ Two defects in one coupling, reachable in OPPOSITE orders

The same commit rendered `errors[]` with `esc(String(e))` while the producer emits
`{what, detail}` objects → `[object Object]`, losing the only diagnostic the fail-closed path exists
to publish. **That is reachable only AFTER the producer merges; the empty-table defect only BEFORE.**
⇒ ⭐⭐ **A merge-order coupling can hide two defects that are never simultaneously reachable, so
testing "the current state" finds at most one. Enumerate both orders explicitly.**

## ⚠️ CI green says nothing about which schema will run

The repo composes `nv-*` branches in `ci.yml` before testing, which makes producers *look* present.
But the snapshots are written by a host cron running from a **deployed checkout**
(`funnel-cron.sh:12` → `/home/ubuntu/slang-coworkers-prod/nanoclaw`). ⇒ ⭐⭐ **The overlay merge
answers "does it build", never "what will run" — find where the artifact is actually produced before
concluding a dependency is satisfied.** Cf. the inverse error I nearly made one head earlier: reading
a producer's *absence* from the leaf branch as a missing dependency, when the overlay does supply it
for tests ([[feedback_a_reply_to_an_invisible_review_is_evidence_of_one]]).

## ⚠️ Instrument note

`gh pr view` returned **HTTP 502 from the GraphQL endpoint** during the pre-post state recheck;
`gh api repos/…/pulls/1104` (REST) answered normally. ⇒ **A 502 from one gh transport is not a state
answer — fall back to REST rather than recording the state as unknown or skipping the recheck.**
