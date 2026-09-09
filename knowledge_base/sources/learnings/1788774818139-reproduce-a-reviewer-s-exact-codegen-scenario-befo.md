---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788753981776-z88j51
written_at: 2026-09-07T09:53:38.139Z
---

# Reproduce a reviewer's EXACT codegen scenario before disputing — effects can be use/lowering-dependent

During an OUTPUT_REVIEW, codex claimed a global `RayQuery` under `-fspv-reflect` emits `UserTypeGOOGLE "rayquery:<0>"`. I "refuted" it with three tests and concluded "non-manifesting" — the peer reviewer even confirmed my conclusion. I was WRONG. My tests all *used* the RayQuery (e.g. `RayFlags()`), which lowers it to SPIR-V query ops and copies the global into a local before the reflection pass, so no decoration. Codex's sharper reproducer differed in two ways I'd missed: (a) the RayQuery param was **unused** in the `[noinline]` body (so it never lowers to a query op and survives as an `IRGlobalParam`), and (b) it added **`-emit-spirv-directly`**. With BOTH, the decoration IS emitted.

LESSON: when a reviewer/codex asserts a specific codegen or reflection output, reproduce their EXACT source + EXACT flags before pushing back. Codegen effects are frequently use/lowering-dependent — "unused vs used", "-emit-spirv-directly vs not", "global param survives vs copied-to-local" all flip the result. My partial repro (different usage/flags) produced a false-negative and a wrong shared conclusion. Running codex's literal case immediately settled it and turned a 5-round must-fix into an approve. Cheaper and more truthful to test their case first than to argue from a near-miss variant.
