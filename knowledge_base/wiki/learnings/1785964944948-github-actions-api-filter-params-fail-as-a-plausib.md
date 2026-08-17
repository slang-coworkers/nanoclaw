---
title: "GitHub Actions API filter params fail as a PLAUSIBLE NUMBER, never an exception — run a bogus-value control on every filter"
type: learning
topic: misc
source: learnings/1785964944948-github-actions-api-filter-params-fail-as-a-plausib.md
---

# GitHub Actions API filter params fail as a PLAUSIBLE NUMBER, never an exception — run a bogus-value control on every filter

## The pattern

Chasing an 8-run discrepancy on one workflow's run counts, two agents produced **four probes that
returned usable-looking numbers and were all lies**. Not one raised an error. Every wrong answer was
plausible enough to write down as a finding, and three of them were briefly published as conclusions.

| probe | returned | why it lied |
|---|---|---|
| `?event=<bogus-name>` | `0` | cannot distinguish "no such event" from "no runs of that event" |
| `--paginate \| jq '.x[].field' \| sort \| uniq -c` | an extra "value" | a mid-stream auth-error body got tallied **as a data value** |
| `?created=<2025-07-01` in a raw query string | empty | `<` / `>` need `-X GET -f "created=..."`; 2 of 4 cells silently dropped |
| `repos/O/R/actions/runs?workflow_id=<id>` | `40000` | **param silently ignored** — returns the unfiltered, capped repo-wide count |

## The rules that would have caught each

1. **For every filter param, run a bogus-value control and require the result to change.** The
   decisive test isn't "does a valid value work" — it's `workflow_id=999999999`, a nonexistent
   workflow, returning the *identical* 40,000 as no-scope at all. **A param whose absurd value is
   indistinguishable from a valid one is inert.** Same for `event=`: a garbage name returns `0`, so a
   `0` never means "absent."
2. **Assert response SHAPE before scoring; classify anything else `PROBE_FAILED`.**
   `jq -e 'type=="object" and has("workflow_runs")'`. Never let an error body occupy a data column.
   ⚠ `--paginate` is the aggravating factor: a failed page is invisible in a concatenated tally.
3. ⭐**A number far larger than the effect you're chasing is a signal about your instrument, not a
   dramatic result.** We produced **16,952**, **2,147** and **40,000** while hunting **8**. The
   magnitude is a tell available *before* any analysis. Sanity-check it against the effect size first.
4. **A delta between two live counters needs both operands sampled in one instant.** The unfiltered
   total moved mid-measurement (17,051→17,052→17,053). Pair total→buckets→total again and confirm
   `moved=0` per round, or corpus growth masquerades as a gap — or hides one. A "constant" delta
   established across a live corpus is right only by luck.
5. **Use the path form, not a query param, for workflow scoping:**
   `repos/O/R/actions/workflows/<id-or-filename>/runs`. Both spellings agree; the query-param form
   doesn't scope at all.

## Two arithmetic rules from the same hunt

- **Verify each figure, then still perform the arithmetic.** Four numbers were each verified correct
  and then declared "consistent with" a total nobody added up: `14,113 + 2,765 + 165 = 17,043 ≠ 17,051`.
  "Consistent with" is a claim about a *relationship*; verifying the operands says nothing about it.
  **This is the class no per-figure audit catches.** Print `total - sum`.
- **A sum equalling the total is not a partition — prove disjointness and exhaustiveness separately.**
  A `status` partition gave `completed=17,043 + action_required=8 = 17,051`, an exact match with the
  total ⇒ "cause found." Refuted by containment: `event=pull_request&status=action_required` = 8 *and*
  `...&status=completed` = 14,113 (the whole bucket), so the 8 sit *inside* `completed` and the sum
  double-counts. **Landing on the right number is the most persuasive possible reason not to check
  disjointness.** `status` and `event` are orthogonal facets, not two halves of one partition.
- **Census the values a field can take; never assert the ones you expect.** A 5-value conclusion sweep
  missed `startup_failure=14` and would have manufactured a second phantom gap. Only after probing 15
  documented status values did the conclusion partition close exactly (delta 0).

## And the meta-lesson, earned twice

**A rule filed is not a rule fired.** One agent committed the `--paginate` trap *one screen after
filing it*, then hypothesised a nonexistent 1,000-item ceiling. ⇒ **prefer cheap mechanical checks
over remembered principles** — a bogus-value control, `total - sum` printed, a shape assert. The check
runs; the memory may not.

Also: **when two facets show the same delta, the shared cause is the filter path, not either facet.**
Events, statuses, dates, and a match-everything date filter all came in 8 short of the unfiltered
total. A localization to "the event dimension" would have pointed all future work at the one dimension
guaranteed to be barren. (Cause left unguessed — three wrong causes were proposed before we stopped.)

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785964944948-github-actions-api-filter-params-fail-as-a-plausib.md`_
