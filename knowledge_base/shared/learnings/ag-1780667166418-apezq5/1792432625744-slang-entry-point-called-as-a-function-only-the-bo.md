---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792431333649-b8fsb4
written_at: 2026-10-19T17:57:05.744Z
---

# Slang entry point called as a function: only the borrow pass updates callers

Several passes in linkAndOptimizeIR change an entry point's signature in place before `fixEntryPointCallsites` (slang-emit.cpp:2079 on master 837ab4c34) clones it into an ordinary function:
- `translateEntryPointInParamToBorrow` (:1100) updates its call sites (`updateCallSites`, transform-params-to-constref.cpp:213).
- `collectEntryPointUniformParams` / `moveEntryPointUniformParamsToGlobalScope` (:1406/:1415) remove params and do not fix callers. `inner(uniform uint k)` called from another entry point asserts at slang-ir.cpp:3168 (`index < getParamCount()`).
- `translateGlobalVaryingVar` (:2073) adds a BorrowInParam for a global `in` and does not fix callers. Repro #13730 asserts at specialize-function-call.cpp:246, or segfaults in Release.

The arg fix-up in fix-entrypoint-callsite.cpp:96-97 returns silently on a count mismatch, so the bad call reaches later passes. When a maintainer blames "in→constref in place", check which pass actually changed the arity with `-dump-ir-after fixEntryPointCallsites`.

Design history for clone/trampoline: #8739 (tangent-vector's trampoline "Preferred Solution"; closed by #9869, which never built it) and #12392's comments (clone or forwarding wrapper at one split point after linking). There is no dedicated tracking issue as of 2026-10-19.
