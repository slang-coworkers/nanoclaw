---
name: feedback_a_tools_output_set_is_scoped_to_the_tools_question
description: "The git conflict set bounds what git flags, not what the change breaks — three agents used it as a completeness criterion and all three were wrong"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c1e5200-765f-4703-8e18-4b677d151754
---

**2026-08-05, slangpy#1052 / PR #1054.** Resolving a signature-format change (`[Dn,Sm,V...]` × `[Dn,Sm,Gk]` → composed), all three of us — me, slangpy-triager, slangpy-fixer — treated the **6-file `git merge-tree` conflict set** as the definition of "everything this change touches." The fixer then found `slangpy/tests/slangpy_tests/test_bridge_fallback_gaps.py` asserting a hardcoded `"[D1,S6,V1]"` — **outside the conflict set**, because PR #1054 never edited that file, so git had nothing to flag. It would have failed post-merge with the resolution otherwise "complete."

⭐⭐⭐**`merge-tree` answers "where do these two histories disagree textually." It never answers "what depends on the invariant I am changing."** Those coincide only when every dependent happens to have been edited by one of the two branches. For a **format / contract / protocol** change they systematically don't: consumers that merely *assert* the old format were never touched by either side.

⇒ **For an invariant change, the completeness criterion is a sweep for the INVARIANT. The conflict set is a subset of it, not a substitute.**

**Sweep result (recorded because the shape is instructive):**

| file | expectations | in conflict set? |
|---|---|---|
| `slangpy/tests/utils/test_torch_bridge.py` | **6** — `:107` plus `:269-273` | ✅ |
| `slangpy/tests/slangpy_tests/test_torchintegration.py` | 1 — `:104` | ✅ |
| `slangpy/tests/slangpy_tests/test_bridge_fallback_gaps.py` | 2 — `:61`, `:66` | ❌ **outside** |

**Second-order trap found while sweeping:** `:269-273` is a `@pytest.mark.parametrize` table whose assertion lives 15 lines away at `:284` (`assert signature == expected`). **Five expectations behind one assertion** — a grep for `assert ... == "[D` finds the two direct literals and misses all five. One of them, `((2,)*16, "[D16,S6,V2222222222222222]")`, is also the repo's only high-rank case, so it interacts with the bounds guard as well as the format. ⇒ **grep for the DATA, not the assertion** — parametrized tables, fixtures, and golden files separate the expected value from the comparison.

**How to apply:**
- **Name the question your tool actually answers, then ask whether it is your question.** Same root as [[feedback_control_the_instrument_not_the_reasoning]] and [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] — the tool returns a correct answer to a narrower question and it reads as coverage.
- **Changing a format/contract/wire-protocol ⇒ sweep for every literal and producer of that format repo-wide**, both directions: consumers asserting it *and* producers constructing it. Check the inverse too (non-literal constructions, shape-based assertions) before declaring the sweep clean.
- **A "complete" resolution that compiles and passes the conflicted files is not evidence of completeness** — the untouched dependents aren't in the build you just ran if they're skipped or in another suite.

Related: [[feedback_a_true_claim_that_widens_past_its_evidence]] (sibling: scope silently widening) · [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] · [[project_slangpy_1052_autograd_cache_grad_bit]].
