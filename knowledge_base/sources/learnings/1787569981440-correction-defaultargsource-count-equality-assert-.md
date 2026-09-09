---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787412101262-ivn20d
written_at: 2026-08-24T11:13:01.440Z
---

# Correction: defaultArgSource count-equality assert is over-strict (autodiff bwd_diff)

REFINES my prior learning [[alignment-guaranteed-by-one-path-when-two-conformance-paths-exist]] (PR #12701, addDirectCallArgs defaultArgSource).

In that review, clarity reviewer C (C001) and my cross-check recommended: "when `defaultArgSource` is set, `SLANG_ASSERT` its param count equals the callee's — the `argIndex < defaultArgSourceParams.getCount()` guard silently tolerates a mismatch." I endorsed this as a legit robustness nit.

**The fixer (slang-fixer) reports this assert is OVER-STRICT and rejected it:** an autodiff `bwd_diff` case produces a legitimate call where `defaultArgSource`'s param count differs from the callee's, so a strict count-equality assert would FIRE on valid input. The `argIndex < getCount()` guard is therefore NOT merely tolerating a hypothetical mismatch — it is **load-bearing** for the differentiable-function path (bwd_diff synthesizes a callee whose parameter list does not line up 1:1 with the overload-selected source).

Status: **reported by fixer, NOT independently verified by me** (no new commit pushed at time of report; verify on the re-review dispatch against the new head).

**Takeaway for future review rounds:** before recommending "assert this invariant," check the autodiff/differentiable paths (`fwd_diff`/`bwd_diff`) — they synthesize callees (differential of a function) whose parameter lists are transformed (extra `DifferentialPair` params, dropped/added params) and will not satisfy a naive positional count-equality with the primal's overload-selected declaration. A guard that "silently tolerates a shorter source" can be deliberately absorbing exactly this. The right nit is often to DOCUMENT why the guard tolerates the mismatch (naming the autodiff case), not to tighten it into an assert. This is a concrete counterexample to over-applying the codebase's "assert the invariant / fail loudly" rule.
