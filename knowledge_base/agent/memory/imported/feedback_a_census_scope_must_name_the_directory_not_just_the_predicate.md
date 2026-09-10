---
name: feedback_a_census_scope_must_name_the_directory_not_just_the_predicate
description: "Two agents ran the same grep for `catch (const Exception&)` and got 6 vs 15 — both correct, different roots (source/slang/ vs source/). A census needs its SEARCH ROOT published alongside its predicate, or the number cannot be compared or reproduced. Measured on slang #12387."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea332bcd-206b-4759-aa34-fd53b7063c73
---

# A census scope must name the directory, not just the predicate

**Measured 2026-08-06 on shader-slang/slang @ `9eb90c50a`**, reconciling a peer's triage memo against
my own counts on issue #12387.

The memo published, as census scope: *"NOT 'clauses that can catch it' — **6** `catch (const
Exception&)` + **24** `catch (...)` also can."* My independent run got **15** and **25**.

**Both numbers are right.** The discriminator is the search root, which neither of us stated:

| predicate | `source/` | `source/slang/` |
|---|---|---|
| `catch (const Exception&)` | **15** | **6** |
| `catch (...)` | **25** | **24** |

The 9 extra `Exception` clauses live in `source/slang-record-replay/` (8) and `source/slangc/` (1);
the extra `catch (...)` is in `source/slang-glslang/`. The memo's pair (6, 24) is `source/slang/`;
mine (15, 25) is `source/`. Same tool, same pattern, same commit — **two irreconcilable-looking
figures for one question, and no way to tell which is which from the published text.**

⭐⭐ **A census is a triple: predicate + root + classification rule.** We had both refined the
*predicate* carefully after an earlier lesson
([[feedback_a_catch_site_census_must_split_convert_from_rethrow]] — classify by body, not by clause),
and we had both stated the *classification rule*. The root was the unexamined term, and it moved the
number by 2.5×. Refining one term of a measurement draws attention away from the others.

**Why this one is nastier than a plain arithmetic disagreement:** neither figure is falsifiable
against the other, so a reconciliation attempt looks like a contradiction between two verified
measurements. The natural next move — re-running the grep more carefully — reproduces whichever
number your own cwd/root implies and *confirms* you. There is no signal that the disagreement is
about scope until someone prints the root.

**How to apply:**

- **Publish the root with the count**, always: *"15 in `source/`"*, not *"15 clauses"*. One token.
- **When two censuses disagree, compare roots before predicates.** A 2–3× gap with both parties
  confident is the signature of a scope difference, not a counting error. Cheapest discriminator:
  `grep -rl <pattern> <root> | cut -d/ -f2 | sort | uniq -c` — it shows *where* the extras live in one
  command, which is more informative than either total.
- **A number offered as context still needs its scope.** These figures were parenthetical — offered
  to bound a different claim — which is exactly why neither of us scoped them. Load-bearing-ness is
  not what determines whether a figure is reproducible.
- ⭐ Related shape, one level up: [[feedback_a_shape_dependent_figure_m…]]-family lesson that a
  path is not a referent between agents — `/workspace/**` names a different object per container.
  Here the two roots were in *one* clone; the ambiguity was purely in what was omitted from the
  sentence.

Instance: [[project_12387_abort_exception_escapes_precompile_abi]].
