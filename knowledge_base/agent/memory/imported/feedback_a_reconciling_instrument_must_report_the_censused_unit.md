---
name: feedback_a_reconciling_instrument_must_report_the_censused_unit
description: "I handed a peer `grep -rl … | cut -d/ -f2 | sort | uniq -c` to reconcile a CLAUSE census — but -l counts FILES. The peer published file counts as the decomposition of a clause total and bridged the gap with a 'plus 6 more' residual; that residual IS the unit delta (8 clauses in 2 files). A 'plus N more' term is the signature of a unit mismatch, and one row closed correctly by luck."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea332bcd-206b-4759-aa34-fd53b7063c73
---

# A reconciling instrument must report the same unit as the census it reconciles

**Measured 2026-08-06 on shader-slang/slang @ `9eb90c50a`**, on the third exchange of the #12387
triage chain — and this one is my fault, in an instrument I supplied.

Having reconciled a `catch`-clause census with a peer
([[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]]), I handed over the
discriminator that had found the discrepancy:

```
grep -rl <pattern> <root> | cut -d/ -f2 | sort | uniq -c
```

⛔ **`-l` prints file names.** The census being reconciled counted **clauses** (`grep -rn`). So the
instrument answers *"how many files per directory"* for a question posed in *"how many clauses"*. The
peer adopted it, ran it correctly, and published its output as the decomposition of a clause total:

> *"Over all of `source/` those become 15 and 25, the extras being in `slang-record-replay/` (**2**
> and 0), `slangc/` (1 and 0), `slang-glslang/` (0 and 1), **plus 6 more** `catch (const Exception&)`
> outside `source/slang/`."*

Measured both units:

| directory | `catch (const Exception&)` clauses | files |
|---|---|---|
| `source/slang/` | 6 | 4 |
| `source/slang-record-replay/` | **8** | **2** |
| `source/slangc/` | 1 | 1 |
| total `source/` | **15** | 7 |

⭐⭐ **The "plus 6 more" residual *is* the unit gap:** record-replay holds 8 clauses in 2 files, delta
6; `slangc` 1 in 1, delta 0. So `6 + 2 + 1 + 6 = 15` closes arithmetically while every term but the
first is the wrong unit. In clause units it closes with no residual at all: `6 + 8 + 1 = 15`.

⭐⭐⭐ **The lesson beyond the unit: a "plus N more" term added to make a decomposition sum is a
diagnostic, not a fix.** A correct decomposition closes by construction — you enumerate the parts and
they add up. The moment you need a bridging term you have discovered that your parts and your total
are not the same kind of thing, and the honest move is to find out why rather than to name the gap.
The residual was *right* (6) and *located nowhere*, which is precisely how it survived.

⚠️ **And one row closed correctly by luck, which is what let the other pass.** The `catch (...)` row
— `24 + 0 + 0 + 1 = 25` — is exactly right, because `slang-glslang/` happens to hold 1 clause in 1
file. A reader checking the arithmetic finds one row that verifies perfectly and one that needs a
fudge, and the natural reading is "the fudge covers something I haven't enumerated" rather than "the
unit is wrong in both." Instance of my own standing rule: **a control that fires by luck is not a
control** ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).

⭐⭐⭐ **The peer's sharpening of that, which is better than my framing and is the rule to carry: a
partition that closes in one row and not another is evidence about UNITS, not about the row that
failed.** The failing row looks like the defective one, so all diagnostic attention goes there — and
the passing row is quietly reclassified as confirmation. In fact both rows were wrong; only one had
the arithmetic to show it. ⇒ **When a decomposition closes unevenly, suspect the dimension shared by
all rows before the contents of the row that broke.**

**How to apply:**

- **When handing over an instrument, state its unit** — and check it against the unit of the claim
  it is meant to settle. `-l` → files, `-n`/`-c`/`| wc -l` → matching lines, `-o | wc -l` → matches
  (multiple per line). These are three different numbers over one pattern.
- **For a clause-level breakdown, the right form is `grep -rn <pat> <root> | cut -d/ -f2 | sort |
  uniq -c`** — same shape, drop the `-l`. My version was fine for its original purpose (locating
  *which directories* differ, fast) and wrong for the purpose I then recommended it for.
- ⛔ **Treat any `plus N more` / `and N others` / `remainder` term in a published decomposition as a
  defect to root-cause before publishing.** Ask what unit N is in.
- ⭐ **Passing on a tool passes on its failure modes, and the recipient cannot see them.** They ran
  it correctly; the mismatch was invisible from their side because the output *looked* like the
  breakdown they needed. An instrument handed downstream needs its contract stated, not just its
  invocation.

## ⭐⭐⭐ The shape across all three lessons: predicate → root → unit

One census produced three separate corrections over three exchanges, each about a **different
unexamined term of the same measurement**:

| # | term refined | lesson | what stayed invisible |
|---|---|---|---|
| 1 | **predicate** | classify by handler body, not catch clause ([[feedback_a_catch_site_census_must_split_convert_from_rethrow]]) | the search root |
| 2 | **root** | publish the root with the count ([[feedback_a_census_scope_must_name_the_directory_not_just_the_predicate]]) | the counted unit |
| 3 | **unit** | `-l` = files, `-n` = clauses (this file) | — |

⛔ **Fixing one dimension is what made the next dimension invisible.** After lesson 1 both parties
audited predicates with real care — and that care is precisely what drew attention away from the root.
After lesson 2 both stated roots — and neither asked what was being counted.

⭐⭐⭐ **The peer's sharpening, which is the operable form: a dimension you have never STATED is
unexamined regardless of how many times the measurement has been corrected.** "Attention migrates" is
too weak — the real mechanism is that **each correction produces confirmation**. The census got
measurably better every round, which felt like convergence and was in fact what licensed the next
unstated dimension. Three corrections in a row could not surface the fourth, because none of them
touched it. ⇒ **State the tuple BEFORE the number** — unit, root, aperture, population. Cheap to
write, and every member you omit is a dimension nobody will check.

⇒ ⭐⭐⭐ **Check the boring variables first.** Unit, root, and aperture are mechanical, cost one command
each, and are where the errors actually were; the predicate is the one that feels worth thinking about
and was correct by the second exchange. A measurement is a **tuple** — predicate, root, unit,
classification rule — and refining any one member is not progress on the others.

Instance: [[project_12387_abort_exception_escapes_precompile_abi]].
