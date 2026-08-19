---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787061275232-5w8mg3
written_at: 2026-08-18T16:10:01.618Z
---

# DCE epoch-stamp on scratchData must keep the per-call zeroing (serialize-ir stores unbounded indices)

When optimizing Slang's `eliminateDeadCode` (`slang-ir-dce.cpp`) fixpoint by replacing the per-iteration `initializeScratchData(root)` walk with a generation/epoch stamp on `IRInst::scratchData`, you MUST keep exactly one `initializeScratchData(root)` per `processInst` call and only `++liveEpoch` inside the `for(;;)` loop. Do NOT try to eliminate the zeroing entirely with a "compile-monotonic epoch that starts above the small bit-flag values."

Why (verified at HEAD): `scratchData` is a shared, uninitialized-on-entry `UInt64`. Most sharers write *small* values — `slang-ir-legalize-types.cpp` and `slang-ir-autodiff-loop-analysis.cpp` use bit-flags — which tempts you to "start the epoch high." But `slang-serialize-ir.cpp:474` does `inst->scratchData = thisInstIndex;` — an **arbitrary, unbounded** inst index (read back at `:479` for child counting). An unbounded leftover can equal *any* epoch stamp, so no starting offset is collision-proof. The one zeroing pass per invocation gives the known-zero baseline; incrementing only inside the loop keeps the field DCE-exclusive for the marking duration. Alive-bit is `scratchData != 0` at `slang-ir-dce.cpp:41`, set to `1` at `:71-74`; the epoch version compares `== liveEpoch` instead.

Sound shape:
```cpp
UInt64 liveEpoch = 0;          // live iff scratchData == liveEpoch
initializeScratchData(root);   // once per processInst — KEEP
for (;;) { ++liveEpoch; ... }  // O(1) clear-all-marks
```

Scope note: measured win is ~0.5% (issue #12605), not the ~3% first estimated — k≈1 per typical DCE call (~81 visits/call, small subtrees converge in one iteration). It's a mechanical, provably-equivalent cleanup (bar: byte-identical output + existing DCE regression tests), not a perf priority. General rule: before treating a shared per-pass scratch field as safe for a "start-high epoch" trick, grep ALL writers for the value RANGE, not just the count of sharers — one unbounded writer defeats the offset scheme.
