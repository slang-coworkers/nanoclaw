---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790100843509-0c3iak
written_at: 2026-09-23T07:27:13.531Z
---

# NO-GO on autonomous design-sensitive autodiff fix vindicated by human instrumentation (slang#13226)

On **shader-slang/slang#13226** (`bwd_diff` over interface-typed `[Differentiable]` params → `specializeModule` non-termination), the coworker triage posted three candidate fix directions and labeled **approach B** — "unbounded higher-order existential `IDifferentiable` witness synthesis; record a structural fixed point" — as "the real fix," explicitly as a **source-consistent HYPOTHESIS**, and recommended **NO-GO on autonomous implementation** (design-sensitive autodiff+typeflow, miscompiled-gradient risk, member self-assigned, autodiff-maintainer domain).

The assignee (jkwak-work) then **instrumented `specializeModule` on master and measured** the actual mechanism: a **type-spelling canonicalization ping-pong** in `slang-ir-typeflow-specialize.cpp` — `replaceType` collapses a one-element `UntaggedUnionType` to its element (retypes the stored value to the concrete `S`), while `handleDefaultStore` and the `upcastSet` path in `specializeStore` target the destination's *raw* pointee and rewrite it back to the union form (minting a fresh `packAnyValue` → +2 insts/round). Each rewrite undoes the other → `performDynamicInstLowering` returns `true` forever. **Witness-table and function counts were FLAT (`wtable=35 func=122`) across 1000+ rounds**, which directly refutes approach B for master. His fix routes the store destination's pointee through `getLoweredType` once and hands the canonical type to `handleDefaultStore`, at the **value layer** (not collapsing singleton sets in `getUntaggedUnionType`, which carries set-lattice meaning). Verified with a standalone 40-line regression test + full suites.

**Lessons:**
1. **Source-archaeology root causes for non-termination are hypotheses — label them as such and prefer instrumentation/measurement before asserting a fix direction as "the real fix."** The triager *did* label B a hypothesis; that framing let the human correct it without the bot losing credibility.
2. **NO-GO on autonomously implementing a design-sensitive fix whose root cause is unverified is validated** — here it prevented shipping an incorrect fix (approach B) and let the domain expert measure the true cause. Had the bot implemented B, it would have been wrong.
3. **The durable high-value bot contributions were the *measured/verified* facts**, not the fix hypothesis: pinning the regression to #9808 (confirmed by the reporter's runtime bisect), root-causing the distinct #11146-class spirv-opt `MergeReturnPass`/`DefUseManager` UAF into a new tracker (#13230), and the cross-links. Offer directions + verified evidence; leave design-sensitive implementation to the assignee/maintainer.
4. **A fix for one non-termination bug can unmask a distinct downstream one:** fixing #13226 (the `specializeModule` hang) does not close #13230 (the intermittent spirv-opt UAF) — the UAF is downstream of emission, reached via the API path that already completed pre-fix, and a single passing run is consistent with a ~25%-intermittent crash not firing.
