---
name: feedback_success_shaped_output_from_a_component_that_never_ran
description: "Five instances in one session where a CHECK emitted success-shaped output because the check itself was broken, not because the condition held. The discriminator is never 'verify more' — it is: what does this check's output look like when the check is broken? If that is indistinguishable from PASS, it is not a check."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f17c5aef-b8a2-4844-b2d1-4d8df2e3a2bd
---

Measured 2026-08-06 across the shader-slang/slang #12371/#12382 chain, four agents. Five independent
instances of **one** failure class in a single session. Filed under the class, not the instances,
because the remedy is a question you can ask before running anything.

## The five

| # | component | success-shaped output | what was actually true |
|---|---|---|---|
| 1 | review merge step | `_skipped_` for a reviewer | reviewer was **dispatched and died**; absence rendered identically to "reviewed, nothing found" |
| 2 | extraction guard | `DISPATCHES=0` ⇒ *"no reviewers ran"* | **7 ran, 4 returned**; the guard was reporting the absence of **its own input file** |
| 3 | criterion's marker check | *"all blocks marker-bearing"* | **tautology** — it imported the extractor's own `MARKERS`, so it was satisfied by construction |
| 4 | my CI mechanism (source read) | a confident file:line causal claim | the accused branch **never executed** — 0 of 100 retry fires reached it |
| 5 | triager's must-hit control | control 404'd *alongside* the target | control **shared the defect** ⇒ it *confirmed* a false capability-negative |

Two more of the same shape from the same session, one tier down: a `gh api` list returning **30 of 65**
comments with no error (⇒ "last comment on the PR" was page 1's last row, and a false
*maintainer-ignored-for-41h* claim reached an operator escalation), and `gh api -f` **404ing** a GET it
had silently promoted to POST.

## The discriminator

⭐⭐⭐ **Ask: what does this check's output look like when the CHECK is broken? If that is
indistinguishable from PASS, it is not a check — it is decoration.**

This is not "verify more." Every one of the five *was* verified in the ordinary sense: #4's citations
were accurate and two peers confirmed them; #5's control was run before publishing; #3's negative
control fired correctly. What none of them had was a case where the *mechanism* was broken while the
*world* was fine.

**Corollaries earned individually:**

- ⭐⭐ **A control must vary the SUSPECTED CAUSE, not merely the target** (#5). Uniformity across cells
  is diagnostic only if the cells differ in the dimension you suspect. 12 identical 404s felt like
  overwhelming evidence and were one bug.
- ⭐⭐ **When a tool writes its own decision, read the DECISION, not its source** (#4). Source says what
  *could* happen; the log says what *did*. The retry job printed its verdict on every fire — free, and
  I reached for the code instead.
- ⭐⭐ **A checker needs its own adversary, not just its own control** (#3). The author's negative
  control *voided* the marker set (forcing the fallback); the failure mode the mitigation targeted was
  *widening* it. Both are "the control fired," only one tests the real path.
- ⭐⭐ **A tighter assertion is a search for provenance errors you don't know you have.** Adding a
  strictly-longer assertion made a *real* fixture fail; inspecting rather than relaxing revealed the
  shipped artifact was **hand-assembled** (two stream blocks plus a 68-byte human-written header), so
  it had never been a truncation incident at all. Right conclusion, wrong warrant — caught by a
  stricter check failing on real data, not by any prose review.
- ⭐⭐ **A rejecting heuristic needs its false-positive rate measured against the whole corpus**, and
  **specificity does not generalize the way sensitivity does**: 0/34 is a fact about *that* corpus, so
  it must be re-measured on every run rather than recorded as prose. Building that control found a
  live hazard in the regex itself — an anchor (`All my independent verification`) that scored 0/34 only
  by luck, while **18 of 34** real reviews open with `All `.
- ⭐ **Never assert "last comment" / any count from an unpaginated list.** The default page is 30 and
  there is no error; the boundary only bites past 30, so every smaller check is silently correct.

## ⭐⭐⭐ A count of your own mistakes has NO FIXED POINT — publish the list and the query, never a total

Earned 2026-08-06 by six successive wrong totals of *"withdrawn claims on this chain"* across two
agents, each corrected from the artifact:

```
~12  approximated (mine)   → correct for the file at that time
 10  peer's                → union computed before its own row #8 existed
 11  mine                  → missed its row #9
 11  peer's, "derived"     → from MY MESSAGE, not from its own table
 12  mine, from the file   → correct for the file at that time
 13  peer's, from the file → because recording the miscount added row #10
```

⇒ **That is not six instances of carelessness. It is a count that increments when you count it.** Every
correction of the total adds a row; every added row changes the total. **No fixed point exists while
the list is open.**

⭐⭐ **So "publish the enumeration, not the tally" needs its operational form: publish only the list and
the query that counts it.** Any number written down is a claim about a *past state of the file*. Keep
membership (`measurement errors are #3,#4,#5,#7,#8,#9`) rather than a ratio (`four of seven`) — a list
makes its own staleness visible and mechanically checkable; a fraction hides it.

**Four costumes of the one mechanism, all seen here:** narrating a table without deriving the narration
→ approximating a total instead of enumerating → updating an enumeration without updating the total
derived from it → **deriving a total from someone's summary of a list instead of from the list**. The
fourth is the worst because it happens *during verification*, wearing the shape of diligence.

⚠️ **My own index already carried this scar and I didn't transfer the lesson:** `MEMORY.md` once held a
per-shard row-count table that was stale on **5 of 7 shards within hours** (two writers, plus
`reindex.sh` re-packing boundaries), so it now says *"for counts, run `bash reindex.sh --check`"* and
carries no numbers. Same defect, same fix, one file away —
[[feedback_a_rule_that_doesnt_fire_is_a_retrieval_failure]].

⭐ Footnote worth keeping: an **approximation that happens to be right is still the wrong method**, but
`~12` beat two confident derivations, and both parties talked the approximator out of the correct
figure. Confidence in a derivation is not evidence the derivation used the right source.

## Why this class is the expensive one

None of the five produced a *wrong answer*. Each produced a **wrong sense of coverage**, and coverage
is what decides whether anyone looks again — so every member is invisible to outcome-based checking.
Worst of all is when the broken check is the one meant to *catch* a broken measurement (#1, #2, #3):
that inverts a safety net into a source of false assurance.

⛔ **And it recurs inside its own fix.** #3 was a defect in the verifier written to prevent #1 and #2.
A verifier that green-lights a broken extractor is the same class as a merge step substituting
`_skipped_`. Expect the fix to contain the bug; test the fix on the path it changes for *everyone*,
not on the case that motivated it.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[feedback_a_pushing_draft_starves_its_own_ci_retry]] ·
[[feedback_gh_api_f_flag_turns_a_get_into_a_post]] ·
[[project_review_pipeline_substitutes_skipped_for_missing_artifact]]
