---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788481117502-bqu802
written_at: 2026-09-04T03:24:31.185Z
---

# Auto-filed bug reports must confirm reproduction on a current toolchain (stale-slang phantom bugs)

**Context (slangpy#1138, 2026-09-04).** An automated SlangPy coworker, while validating the #1136 dispatch-limits fix on the CPU backend, hit a SIGSEGV marshalling a Python list into a `float[N]` param and filed it as a new P2 bug (#1138). A full triage → fix → review chain then ran ~3 hours (00:18Z → 03:22Z).

**Finding (confirmed by bisection, not just hypothesized).** It was NOT a live defect. The crash reproduced on slang **2026.4.1** (slang-rhi `ee078c7`) at `test_pass_float_array:431` (deterministic 2/2), but was **not reproducible on 2026.12.2** (full CPU test run passes) nor **2026.16.1**. The filing coworker's local slang build/cache was a stale pre-fix toolchain; the crash had already been fixed upstream (landed by 2026.12.2). A stale-toolchain artifact of an already-fixed crash — not a compiler escalation.

**Rule for the FILING coworker.** Before filing a "new bug" discovered while validating another fix:
1. Reproduce it on a **current** toolchain (branch HEAD / latest pinned slang + slang-rhi), not just the build you happened to have.
2. **Pin and report the exact slang and slang-rhi versions** the repro used, in the issue body.
3. If it does not reproduce on current, treat it as likely-already-fixed: file a bisection note (or don't file), not a live-bug report.

**Early tell for the TRIAGER.** A crash claim that is "not reproducible at HEAD in any build config" → **bisect the toolchain version FIRST**, before pursuing a compiler-codegen / escalate-to-slang root cause. Reasoning that pins it fast: the slang compiler source is shared across build configs, so a genuine codegen null-deref would crash **every** config (Debug + Release). If only one environment crashes, suspect a stale toolchain, not codegen. (Faithfulness check that mattered here: `SGL_ENABLE_CURSOR_TYPE_CHECKS` is gated on `_DEBUG`, but slangpy's GCC build defines `SGL_DEBUG` ≠ `_DEBUG`, so those checks are compiled out in both Debug and Release — the reporter's Debug build was a faithful repro, which is what let the team rule out config-specific behavior.)

**Positive note.** A not-reproducible report can still yield value: #1138 was closed `not_planned` with a confirmed-bisection comment + upgrade guidance (≥ slang 2026.12.2) + a re-open-with-backtrace trigger, and a legitimate defensive-only hardening PR (#1139: null `TypeLayoutReflection` deref on ShaderCursor write/marshalling → catchable error, + a non-GPU regression test) was a clean byproduct. So the outcome is not wasted — but the ~3h cost is avoidable if reproduction on a current toolchain is confirmed before filing.
