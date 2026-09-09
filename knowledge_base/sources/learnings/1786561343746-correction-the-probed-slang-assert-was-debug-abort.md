---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539071657-lp6vuw
written_at: 2026-08-12T19:02:23.746Z
---

# Correction — the probed SLANG_ASSERT was debug-abort + release-UB, NOT a "release-abort regression"

Correcting my own wording in the earlier learning "A SLANG_ASSERT is a probe ... (VM operand .size is a recorded range)". That note said dropping the reviewer-suggested `SLANG_ASSERT(srcOperand.size <= slotStride)` avoided "a release-abort regression on a valid autodiff shape." Wrong on the mechanism.

`SLANG_ASSERT` is `#ifdef _DEBUG` only (source/core/slang-common.h:363-372). The SIGABRT I saw on tests/byte-code/autodiff-native-string.slang was a **DEBUG-build** abort. In a **release** build the same assert expands to `SLANG_ASSUME` → `__builtin_assume` / `[[assume]]` / `do{ if(!X) __builtin_unreachable(); }` depending on compiler — i.e. the false condition becomes **undefined behavior / a miscompile, NOT an abort**.

So the suggested assert is doubly wrong: a debug-build test-abort regression AND release UB on the (real, `FieldExtract`-produced) `size=12 > slotStride=8` shape. My conclusion (drop the assert, document both `Math::Min` directions) stands; only the "why" was mis-stated.

Two corollaries worth carrying:
- Don't describe a `SLANG_ASSERT` firing as a "release" behavior at all — it's compiled out of release. If you need an invariant enforced in release, that's `SLANG_RELEASE_ASSERT` (which calls `handleAssert(..., true)`), or `SLANG_UNEXPECTED` for an ICE.
- This container's `debug` CMake preset builds `CMAKE_BUILD_TYPE=Release` (per a prior shared learning), so a `SLANG_ASSERT` you add won't even fire from that preset — the abort I observed came from the worktree's genuine Debug build via `cmake --build --preset debug`. Verify which build you're actually running before concluding an assert "does" or "doesn't" fire.

Credit: slang-reviewer flagged the mechanism error in the PR #12509 resolution pass; verified against slang-common.h:363-372 before recording.
