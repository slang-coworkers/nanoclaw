---
title: "Regression Test Fixture Design"
type: concept
group: general-misc
tags: [regression-test, fixture, negative-control, one-variable, enforcement]
source_count: 0
---

# Regression Test Fixture Design

## TL;DR
- Test a status field against a row whose state you already know.
- Remove the constraint, don't detect violations — and negative-control every regression test.
- Enumerate what must DIFFER in a fixture, not what must exist.
- A negative control must differ by exactly one variable — and by the comparator the claim names.
- An inconclusive control means the construction can't test the claim, not that the claim is false.
- Beware inert fixes and unenforced enforcement — a fix that is never exercised is unverified.

## Test a status field against a row whose state you already know

A uniformly-negative signal should indict the instrument before the system: joining `messages_out` to `processing_ack` returns no match for any row because the tables are structurally disjoint (measured 0 of 9 overlap), a phantom-outage false alarm that looks like diligence ([`processing_ack` never contains outbound ids — "not acked" ≠ undelivered](../learnings/1785786323245-processing-ack-never-contains-outbound-ids-not-ack.md)).


## Remove the constraint, don't detect violations — and negative-control every regression test

Prefer replacing many emit-time guards with one principled entry (`isInlinableGlobalInst`) over detecting violations; negative-control every regression test (rewrite a vacuous "`OpIAdd` exists" assertion to bind operands and run against a pre-fix binary: 0 matches pre-fix, 1 post-fix), and never cite a self-caveating summarizer over the actual spec text ([remove the constraint, don't detect violations of it](../learnings/1785783085348-remove-the-constraint-don-t-detect-violations-of-i.md)).


## Enumerate what must DIFFER in a fixture, not what must exist

A fallback that coincides with the correct answer makes a test inert while it reads green (a SPIR-V `DebugFunction` lookup miss pins to the entry point's CU, so any fixture where the right answer equals the entry-point CU passes regardless). Name the fallback's value and the expected value out loud and construct the case where they are provably distinct insts; a pre-registered red baseline is the only thing that catches this ([a fallback coinciding with the correct answer makes tests inert](../learnings/1785826158533-a-fallback-that-coincides-with-the-correct-answer-.md)).


## A negative control must differ by exactly one variable — and by the comparator the claim names

A baseline emitting zero of the thing validates any test (four causes of a false zero-CU control in one day, one a mis-attribution that was then reused as evidence). Let the claim's wording pick the baseline ("no worse than master" ⇒ pristine master; "this test discriminates" ⇒ this tree minus the fix); a tidy one-variable control against the wrong comparator is more dangerous than a sloppy one, and a null result never names its own cause ([a negative control must differ by exactly one variable, and by the comparator the claim names](../learnings/1785829322355-a-negative-control-must-differ-by-exactly-one-vari.md)).


## An inconclusive control means the construction can't test it, not that the claim is false

Never convert an apparatus failure into a verdict — not "false", not even "untestable" — before trying a different construction (a local `const int a[]` exercised a parser defect a global array could not). Put a must-pass and a must-fail row in every isolation matrix and read those first; pair every ref probe with `wc -c` and `git ls-tree`; reserve "unverified" for claims where a working apparatus produced no signal ([an inconclusive control means this construction can't test it](../learnings/1785829714063-an-inconclusive-control-means-this-construction-ca.md)).


## Inert fixes and unenforced enforcement

"Implementing" a policy by **writing data** (a flag in a state file) or **writing prose** (a schema in a README) does nothing until some code path *reads* it — and until then it is inert while reading as done. Two same-day fixes, both inert, same root: a `terminal_unclassifiable` skip written as 17 marks in `rerun-tracker.json` plus one prose line, with **zero sweep scripts referencing the key**, so 0 PRs were actually skipped and triage stayed at 22 (never the promised 5) for two sweeps; and a `labels[]` schema headed "Required on every new row" carried by **0 of 1855 rows**, including the 7 written after specifying it ([a fix stored as data or prose with no consumer is inert — verify the metric moved, not that you wrote the rule](../learnings/1786228060109-a-fix-stored-as-data-or-prose-with-no-consumer-is-.md)). The detector: after declaring a fix, **run the metric it targets and print before/after** — "I wrote the rule" is not "the rule fires"; `grep -rl <flag>` and ask which file *executes* it, not which mentions it; and if the metric doesn't move when the file does, it's measuring you, not the file — check on run 2, not run 4. The next layer is subtler: a fix that failed because **nothing called it** cannot be caught by a control that *calls it and checks the result*. Verifying the skip mechanism with "simulate a new head sha, confirm 17/17 marks release" gave **17/17 PASS** while the defect was untouched, because the control tested `is_skipped()` — the library — when the bug was the wiring, a bare comprehension `nf = [k for k,v in results.items() if v["failed"]]` that consulted nothing ([test the wiring, not the library — a correct helper nothing calls passes every unit control](../learnings/1786228460408-test-the-wiring-not-the-library-a-correct-helper-n.md)). The repair is not "the sweep should consult the skip list" but **"the sweep cannot produce a triage set without consulting it"** — route output through a function that raises when marks exist but `skipped == 0`, run the real path end-to-end, and make `0` a failure rather than a quiet default. Two second-order traps travel with it: a guard computed from the *same dict* the function returns is a self-confirming zero (a broken `skip_list() → {}` makes the overlap empty and the check pass — re-read the state file as an independent basis), and a must-pass control row is essential or a raise-everything stub looks like a working guard. Enforcement itself is not exempt: two hours after building `sweeplib.triage_set()` *specifically* so a triage set could not be produced without consulting the skip list, the next sweep used four fresh `/tmp` scripts that re-derived all 76 PRs with **zero references to `sweeplib`** — because **a guard only binds code paths that invoke it, and a throwaway script cannot be forced to consult anything** ([a guard only binds callers who call it — an ad-hoc script bypasses your own enforcement](../learnings/1786235354224-a-guard-only-binds-callers-who-call-it-an-ad-hoc-s.md)); the parent's inference that "the wiring must have fired" from a favourable delta (2 declines vs. prior 17–22) was wrong — the drop had an unrelated cause — and what caught it was `grep -l "sweeplib\|triage_set"` over the scripts actually executed plus a `stat` on the artifact the real path writes. The final variant is the sealed exit: a classifier with a documented `UNCLASSIFIED → legitimate` upgrade path was **unreachable**, because 3 of 17 `REGRESSION_EVIDENCE` labels were never added to the closed `LABELS` vocabulary the writer enforced, so every row trying to use them was rejected — and **a sealed upgrade path and a genuinely clean repo produce the same ledger** ([a validation enum whose only exit is sealed reads exactly like a clean result](../learnings/1786249510423-a-validation-enum-whose-only-exit-is-sealed-reads-.md)). It stayed invisible for days (only surfacing when a real regression hit the wall), the corroborating smell (244 "legitimate" rows but 97% unlabelled) was misread as sloppy logging, and the fix is to **assert the set containment at import** (`_unreachable = REGRESSION_EVIDENCE - LABELS`), verified against a planted defect — because a gate you haven't watched fire is not known to work. Whenever two sets must relate, assert the relation where they are defined; otherwise the broken relation shows up as an absence of findings, the one symptom that never prompts investigation.

**Source learnings (9):**
- [`processing_ack` never contains outbound ids — "not acked" ≠ undelivered](../learnings/1785786323245-processing-ack-never-contains-outbound-ids-not-ack.md) — `processing_ack` never contains outbound ids — "not acked" ≠ undelivered
- [remove the constraint, don't detect violations of it](../learnings/1785783085348-remove-the-constraint-don-t-detect-violations-of-i.md) — remove the constraint, don't detect violations of it
- [a fallback coinciding with the correct answer makes tests inert](../learnings/1785826158533-a-fallback-that-coincides-with-the-correct-answer-.md) — a fallback coinciding with the correct answer makes tests inert
- [a negative control must differ by exactly one variable, and by the comparator the claim names](../learnings/1785829322355-a-negative-control-must-differ-by-exactly-one-vari.md) — a negative control must differ by exactly one variable, and by the comparator the claim names
- [an inconclusive control means this construction can't test it](../learnings/1785829714063-an-inconclusive-control-means-this-construction-ca.md) — an inconclusive control means this construction can't test it
- [a fix stored as data or prose with no consumer is inert — verify the metric moved, not that you wrote the rule](../learnings/1786228060109-a-fix-stored-as-data-or-prose-with-no-consumer-is-.md) — a fix stored as data or prose with no consumer is inert — verify the metric moved, not that you wrote the rule
- [test the wiring, not the library — a correct helper nothing calls passes every unit control](../learnings/1786228460408-test-the-wiring-not-the-library-a-correct-helper-n.md) — test the wiring, not the library — a correct helper nothing calls passes every unit control
- [a guard only binds callers who call it — an ad-hoc script bypasses your own enforcement](../learnings/1786235354224-a-guard-only-binds-callers-who-call-it-an-ad-hoc-s.md) — a guard only binds callers who call it — an ad-hoc script bypasses your own enforcement
- [a validation enum whose only exit is sealed reads exactly like a clean result](../learnings/1786249510423-a-validation-enum-whose-only-exit-is-sealed-reads-.md) — a validation enum whose only exit is sealed reads exactly like a clean result
