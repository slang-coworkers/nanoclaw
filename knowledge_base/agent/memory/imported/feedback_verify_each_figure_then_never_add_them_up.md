---
name: feedback-verify-each-figure-then-never-add-them-up
description: "Per-figure verification does not verify a partition — say \"consistent with\" only after performing the arithmetic; and a sum that matches the total can still be a double-count"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6671f318-efeb-4b8d-8a33-d95b81cddb95
---

# Verifying every figure is not verifying their sum

**EVIDENCE BASE: ONE exchange (slang#12366 CI-census, 2026-08-05), caught by a peer,
then a second self-inflicted error in the same probe.** Re-derive before executing.

## The original defect — mine

I reproduced a peer's CI run counts on my own edge: `pull_request` = 14,113,
`merge_group` = 2,765, `push` = 165, all-events total = 17,051. Every bucket
verified. I then wrote that they were **"consistent with"** the total.

**`14,113 + 2,765 + 165 = 17,043`, not 17,051.** I never performed the addition.

⛔⭐⭐⭐**This is the class of error no per-figure audit catches: every number
correct, only their SUM wrong.** Each bucket survived independent verification, which
is precisely what made the aggregate feel checked. "Consistent with" is a *claim about
a relationship* — verifying the operands says nothing about it.

⇒ **CHECK: never write "consistent with" / "adds up" / "accounts for" until you have
literally computed it.** One `python3 -c` is the whole cost. If a partition is claimed,
print `total - sum` and require **0**.

The peer's discriminating control: **sample the delta repeatedly.** Constant delta
(8 / 8 / 8) ⇒ a real gap. Varying delta ⇒ live-corpus movement. That distinguishes a
structural gap from a timestamp artifact, which is otherwise unfalsifiable.

## The second defect — same probe, mine again, and worse

Hunting the missing 8, I partitioned by `status` instead of `event`, found
`action_required = 8` and `completed = 17,043`, computed `17,043 + 8 = 17,051`, and
declared the cause found.

**Then the decisive test refuted it:** `event=pull_request&status=action_required`
= **8**, and `event=pull_request&status=completed` = **14,113** = the whole
`pull_request` bucket. So the 8 are **inside** `completed`, and `17,043 + 8`
**double-counts** them. The exact match with the total was a **coincidence**.

⛔⭐⭐⭐**A sum that equals the total is NOT evidence of a partition — the buckets must
be DISJOINT, and equality is exactly what stops you checking disjointness.** The
arithmetic landing on the right number is the most persuasive possible reason not to
run the containment test. **Two orthogonal facets (`status`, `event`) are not two
halves of one partition; their categories overlap by construction.**

⇒ **CHECK, before treating buckets as a partition: prove DISJOINTNESS (query the
intersection and require 0) and EXHAUSTIVENESS (sum == total) — separately.** A
matching sum satisfies neither on its own.

## Third defect — my "localization" was itself refuted (peer-caught, 08-05)

I concluded *"the gap is localized to the **event** dimension."* **Refuted.** The peer
partitioned a **third, independent facet** — `created=` date ranges, disjoint by
construction — and the same 8 reappeared. I reproduced it with same-instant pairing,
three rounds: dates `248 / 5,147 / 9,757 / 1,892` = **17,044**, total **17,052**,
**delta 8/8/8, `moved=0`**.

So: sum-of-events **17,043** · `status=completed` **17,043** · sum-of-dates **17,043**
· unfiltered `total_count` **17,051** (all +1 later, together).

**My own decisive test, which settles it:** `created=>2000-01-01` — a date filter that
matches *everything* — returns **17,044**, not 17,052. And `exclude_pull_requests`
returns **17,052 for either value** (so it doesn't filter this counter at all;
it is the correct matches-everything control, whereas `branch=master` = **260** is
*not* a superset because PR runs live on head branches).

⇒ ⭐⭐⭐**The 8 rows are invisible to EVERY FILTERED QUERY, not to one facet. The gap
is a property of filtering itself.** No amount of event-name probing could ever have
found them — my localization pointed all future work at the one dimension guaranteed
to be barren. **When two facets show the same delta, the shared cause is the
filtering path, not either facet.** Cause still not established (rows the filter path
excludes but the unfiltered counter includes — deleted/expired runs, or null facet
fields); **left open, not guessed.**

## Fourth defect — I read an instrument failure as a finding (mine, same turn)

Trying to enumerate the 8, I walked `--paginate` and got **100 rows against
`total_count` 17,052**, then wrote that as "delta 16,952 ⇒ the 8 are phantom."
**That was my instrument failing, not a measurement** — precisely the
`--paginate`-hides-a-mid-stream-failure trap recorded below, committed one screen
after filing it.

I then hypothesized a 1,000-item API ceiling — **also wrong**: `page=11` returns 100
rows. ⇒ **Honest state: my enumeration probe failed for an undetermined reason; I did
not guess a third time.** ⛔⭐⭐**A number far larger than the effect you are chasing
is a signal about your instrument, not a dramatic result.** A 16,952 "gap" while
hunting 8 should read as *my probe broke*, never as *huge finding*.

**What the conclusion partition did establish** (still valid, independently) —

**What actually closes within `status=completed`:** the *conclusion* partition —
success 13,472 + failure 2,336 + skipped 1,199 + cancelled 14 + action_required 8 +
**startup_failure 14** = **17,043 = completed**, delta **0**. (`startup_failure` is
the category I had not probed; without it the sum is short by 14.) So the 8 missing
runs are a gap in the **event** dimension only. ⭐**Cause still NOT established** —
plausibly rows whose `event` no longer maps to a filterable value, or deleted/expired
runs still counted in `total_count`. **Left as an open gap rather than guessed**;
a bogus-event control returns `0` (not an error), so the event filter cannot
distinguish "no such event" from "no runs".

## The unifying rule — this API's failure mode is a PLAUSIBLE NUMBER, never an exception

Four independent instrument failures in one hunt, all four returning a *usable-looking
number* instead of raising:

| probe | returned | why it lied |
|---|---|---|
| `event=zzz_bogus` | `0` | cannot distinguish "no such event" from "no runs of it" |
| `--paginate \| jq \| uniq -c` | an extra "event" | an auth-error body scored as a data value |
| `created=<2025-07-01` in a raw query string | empty | needs `-X GET -f`; silently dropped 2 of 4 cells |
| `actions/runs?workflow_id=<id>` | **40,000** | param **silently ignored**; 40,000 is a *cap*, not a count |

⛔⭐⭐⭐**An unsupported filter param does not error — it returns the UNFILTERED
result, which reads as a real measurement of a different population.** Verified with
the decisive control: `workflow_id=999999999` (a **nonexistent** workflow) *also*
returns 40,000, identical to no-scope — so **a deliberately absurd value is
indistinguishable from a valid one**, which is the only test that proves the param is
inert. The correct form is the **path**: `…/actions/workflows/<id-or-filename>/runs`;
both spellings (`124338832` and `check-formatting.yml`) agree at 17,053.

⇒ **CHECK: for every filter param, run a bogus-value control and require the result to
CHANGE.** If bogus == valid, the param is inert and your "filtered" figure describes
some other population.

## The magnitude rule — and why filing a rule isn't firing it

⭐⭐⭐**A number far larger than the effect you are chasing is a signal about the
instrument, not a dramatic result.** Every bogus figure in this hunt —
**16,952** (mine), **2,147** (peer's), **40,000** (peer's) — was produced while
chasing **8**. The magnitude *itself* is the tell, available before any analysis.

⭐⭐**And I committed the `--paginate` trap one screen after filing it.** ⇒ **A rule
filed is not a rule fired** — which is the argument for cheap *mechanical* checks
(a bogus-value control, `total - sum` printed, a shape assert) over remembered
principles. The check runs; the memory may not. Same retrieval-failure shape as the
`PIPESTATUS` rule that sat in five files and never fired.

## Instrument note — an error body must never occupy a data column

The peer's first census was
`gh api … --paginate | jq '.workflow_runs[].event' | sort | uniq -c`, which
**silently tallied an auth-error body (`app_not_connected` JSON) as if it were an
event name.** ⇒ **A probe loop must assert response SHAPE and classify anything else
as `PROBE_FAILED`** — `jq -e 'type=="object" and has("workflow_runs")'` before
scoring. `--paginate` aggravates it: a mid-stream page failure is invisible in a
concatenated tally. I adopted the shape guard in every loop above; zero
`PROBE_FAILED` rows, and it is what let me trust the 12-event census.

⭐**Census the field; don't assert the values you expect.** Probing 12+ event names
(nine of them zero) is what established the non-zero set, rather than assuming the
three I already knew.

Companion to
[[feedback_a_guarantee_claim_names_the_enforcer_not_the_nearby_mechanism]] (same
chain, same shape one level up: sound measurement, unlicensed conclusion) and to
[[feedback_an_anchor_that_is_not_unique_is_not_an_anchor]].
