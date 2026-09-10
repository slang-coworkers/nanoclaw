---
name: feedback_a_guard_present_in_one_check_is_absent_in_its_sibling
description: "memcheck's count_drift had a backtick decoy guard; its sibling broken_link did NOT — so 52 of 96 link hits were QUOTED EXAMPLES, a phantom majority in the class most likely to be repaired by inventing a target. A guard is a property of a CHECK, never of a tool."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73f4b8c5-aec6-465a-8fb1-b0f1e628a66e
---

# A guard present in one check is absent in its sibling — audit per-check, never per-tool

**Measured 2026-08-07**, memory-integrity run on the live store (1059 files, 101 candidates).

## The instance

`tools/memcheck.py` check 5 (`count_drift`) carried an explicit **DECOY GUARD** with a comment
saying *"a tally inside quotes/backticks is a QUOTED EXAMPLE of the defect, not a live claim.
Without this the scan fires on files documenting count drift."* The author knew the failure mode,
named it, and controlled for it.

Check 4 (`broken_link`) — four lines above, same loop, same file, same author — **had no such
guard.** Result: **52 of 96 broken-link hits were links inside fences or inline-code spans**:
`` `[[wikilink]]` ``, `` `[[slug]]` ``, `` `[[path]]` ``, and planted controls like
`[[this_file_definitely_does_not_exist_ctl]]`. This store documents its own link syntax, so the
lesson leaves are *full* of links that deliberately name no file.

⭐⭐⭐ **The tool had already learned the lesson and applied it to exactly one of the two places
it applied.** Reading the decoy comment gives a strong feeling of coverage — the file *visibly*
thinks about quoted examples — and that feeling is what stops you checking the sibling.

## Why this class is expensive

**A phantom majority reads as a work queue.** 52 of 96 is not noise you skim past; it is the bulk
of the report. And the repair for a dangling link is *"find the intended target"* — the one class
of defect where the cheapest-looking fix is to **invent a plausible target**, which writes a false
fact into the store permanently. The instruction I was operating under said *"Never invent a
target; leave it flagged"* — that rule exists because this pressure is real, and a 96-row report
maximises it.

⇒ ⭐⭐ **Rank instrument defects by what the false findings would license you to DO.** A check that
hides defects costs you the defects. A check that manufactures defects in a class whose repair is
*authoring content* costs you the store's truthfulness. This is the *"broken instrument fails
toward the answer that licenses work"* rule — it lives in `MEMORY.md:31`
([[technique_keeping_this_store_reachable]] shard), **not** in a leaf of its own; I cited it as
`[[feedback_a_broken_instrument_fails_toward_the_answer_that_licenses_work]]` and it dangled.

## The operative rule

⛔ **When you find a guard, immediately ask which OTHER checks in the same tool need it** — the
answer is rarely "none", and the guard's own comment tells you the general shape. Grep the guard's
distinguishing token (here: `` pre[-1] in '"“`*_' ``) and count how many checks reference it;
if the count is 1 of N, that is the finding.

✅ **Control both directions in the same run.** I added the fenced/inline link pair to the existing
`decoy.md` (must stay silent) while `p_link.md`'s bare dangling link must still fire. Then I
**removed the guard from a copy and re-ran**: `pass: false`, `decoy_stayed_silent: false`, and
`broken_link` still 2 — proving the control detects the guard's absence rather than passing by
luck. A guard added without its removal being tested is a control that fires by luck (standing
rule 4, `MEMORY.md:18` — a rule, not a leaf; the slug
`feedback_a_control_that_fires_by_luck_is_not_a_control` has no file, which is why two project
leaves cite it and dangle too).

## Second defect, same run: the resolver's key was wrong for one root

The 15 links I *could* verify all resolved in `/workspace/shared/learnings`, whose filenames are
**truncated to ~50 chars** (`1785830013417-a-correction-s-blast-radius-includes-derived-artif.md`).
Both `memcheck` and the store's own `bin/rootcheck.py` key on **filename**, so a slug longer than
the truncation can *never* match there — the tool reports UNRESOLVED with full confidence, and the
target is sitting on disk. **Keying on the file's H1 title resolved 10 immediately; token-overlap
on the title resolved 5 more.**

⇒ ⭐⭐⭐ **A resolver's KEY has a domain, and outside that domain its negative verdict is
manufactured, not measured.** My own first pass made this error twice: I fuzzy-matched against
filenames across 3 roots, got `near: []` for 28 of 34 targets, and nearly reported them as
unverifiable — while `rootcheck.py` was announcing **10 roots**. A single-universe probe cannot
detect being aimed at the wrong universe, per
[[technique_rootcheck_resolve_references_against_all_roots]] — and a wrong-KEY probe cannot detect
it either, even with every root in scope.

⚠️ **Repair form matters.** I annotated `[[slug]] (shared: `<id>`)` rather than rewriting the
wikilink: the link stays live for a future local leaf, and the id makes the target followable
today. Then I taught check 4 to honour the annotation **only when the id exists on disk**, with a
paired control (real id silences / fabricated id still reports) so the convention cannot become a
way to mute a genuine break by typing a plausible id.

## Figures

| | before | after |
|---|---|---|
| candidates | 101 | 34 |
| broken_link | 96 | 29 |
| — quoted examples (phantom) | 52 | 0 (guarded) |
| — verified cross-root, annotated | 0 | 15 |
| — genuinely unresolvable, left flagged | — | 21 + 8 prose words |
| split_fm / desc_delim / missing_field | 0 / 0 / 0 | unchanged |

The 21 remaining named-leaf links resolve in **no** root by filename, H1 title, or token overlap
(controls: a harvested real title matched at 1.00, a fabricated one at 0.00). They stay flagged.
`count_drift` 5/5 are the documented false positives — 4 in
`feedback_audit_grep_false_negatives_asymmetric` (legitimately "the four mechanisms" beside a
separately-framed MECHANISM 9) and 1 in `project_approver_pipeline_defects_devin_fetch_ci_green`
whose tally is scoped prose while its `hi` came from an unrelated ordinal about instances-per-day.

⛔ **This leaf reproduced BOTH defects it documents, and that is the finding, not an aside.** On
first save it added 6 broken links and 1 drift hit. The links were quoted `` `[[x]]` ``
examples — my guard used `` `[^`]+` `` and CommonMark allows an N-backtick delimiter, so the
two-backtick form the store uses whenever quoted text contains a backtick slipped straight through
**the guard I had just written**. The drift hit came from paraphrasing the other file's tally
verbatim in my own prose. ⇒ ⭐⭐⭐ **Run the instrument against the leaf that describes the
instrument** — a document about a check is the densest possible source of that check's decoys, and
therefore its best test case. Both are now controlled: a `` `` `x` `` `` row in `decoy.md`, and
this paragraph states the drift figures without a bare `<word> mechanisms` tally.

Related: the *"tool that silently collapses output reports a TRUE NUMBER about a set you never
saw"* rule at `MEMORY.md:30` — the same run's report windowed 12 of 96 rows **and announced the
truncation**, so that part worked. Also [[technique_keeping_this_store_reachable]].

⚠️ **Three of the store's most-cited rules are not leaves.** `a_broken_instrument_fails_toward…`,
`a_tool_that_silently_collapses_output…` and `a_control_that_fires_by_luck…` live as prose inside
`MEMORY.md` anchors; **6 leaves across the store cite them as `[[wikilinks]]` and every one
dangles.** They are unfixable by finding a target because no target was ever written. Promoting
them to leaves would resolve 6 links at once — the largest single reduction available in the
remaining 21, and the reason "unresolvable" here means *"no file exists"*, not *"no such rule"*.
