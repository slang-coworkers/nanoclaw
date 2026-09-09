---
title: Slang compiler and build-system findings surfaced during CI/review work
type: concept
group: ci-tooling
tags: [slang, ir, terminator, divergence, dce, spirv, cmake, fiddle, windows, review]
source_count: 7
---

## TL;DR

Deep Slang compiler and build findings that came out of approver/review/CI sessions — each
verified firsthand against a specific HEAD and worth citing rather than re-deriving.

- **Terminator/divergence soundness (`let ... else`, #12612):** `discard` is NOT an IR
  terminator (execution continues past it), and a `switch` with no `default` falls through to
  the switch exit — both *look* terminating but don't. For a v1 "does not complete normally"
  check, accept only `return`/`break`/`continue`/(conditional)`throw` and nested if/else where
  both arms diverge; use the class-hierarchy `getTerminator()`, not the coarser enum-switch
  `isTerminatorInst(IROp)`.
- **DCE epoch safety (#12605):** an epoch/round-stamp reusing a shared `scratchData` field is
  safe only with an up-front local zero-baseline that makes the field pass-exclusive — never a
  "high enough starting constant," because `slang-serialize-ir.cpp` writes unbounded inst
  indices there. A false-alive in DCE deletes a live operand (dangling), not merely conservative.
- **`&buf[i]` on an explicit-layout structured buffer loses its stride** through a plain `T*`
  (default-layout) parameter — a PRE-EXISTING `operator&` bug, not introduced by the
  `__getAddress` fix; a reproduced symptom is not a reproduced cause.
- **A binary protocol stream must never sit on a text-mode CRT `FILE*`** — the test-server garble
  hook's `\r\n\r\n` gets mangled to `\r\r\n\r\r\n` on Windows (CRLF translation on one of two
  write paths sharing the pipe), explaining a Windows-only symptom but NOT a debug-only one.
- **Build-system:** `-exported_symbols_list` must be applied directly, not through a
  `check_linker_flag` probe (the probe links an empty `main` that has none of the listed symbols,
  fails, and silently drops the flag). A from-scratch Slang build needs ~11G on the shared
  fleet volume; push + draft PR to let CI build; FIDDLE keys generated code by `__LINE__`, so you
  can't syntax-check a `.cpp` against stale generated headers if you also edited a `FIDDLE()` header.

## IR terminators and divergence: get the accepted set exactly right or it's a soundness bug

Two atoms from designing the `let ... else` guard-divergence contract (#12612) converge, with an
independent critique catching an over-reach in each.
[Slang: discard is NOT an IR terminator](../learnings/1787094619589-slang-discard-is-not-an-ir-terminator-excludes-it-.md)
verifies at HEAD `0b78add933` that fall-through is decided by `IRBlock::getTerminator()` =
`as<IRTerminatorInst>(...)` (the class hierarchy), that `IRThrow : IRTerminatorInst` caps a block
but `kIROp_Discard` sits OUTSIDE the terminator group and `visitDiscardStmt` emits `emitDiscard()`
with no trailing `emitUnreachable()` — so `else { discard; }` completes normally and falls through
(unsafe). It also notes Slang has NO checker-level reachability analysis (missing-return is
diagnosed structurally at IR level), and `Never`/`BottomType` is inert as a function result type.
[Slang divergence analysis: switch without default falls through to exit](../learnings/1787096714301-slang-divergence-analysis-switch-without-default-f.md)
adds the `switch` case (`slang-lower-to-ir.cpp:9607` routes the no-`default` unmatched path to
`breakLabel`, the exit), so "every explicit case arm diverges" does NOT make the switch diverge —
safest for v1 is to exclude `switch` entirely and accept only if/else where both arms diverge.
`throw` diverges only conditionally (uncaught, needs a non-`Never` error type), and `break`/`continue`
only if the resolved target is outside the block under test. The meta-lesson: check each candidate
against how it actually LOWERS, not intuition — and a second set of eyes (codex caught the switch
over-reach) is worth it on soundness-critical enumerations.

## Shared-field epoch stamps need a local zero-baseline

[DCE scratchData epoch: safety comes from a local zero-baseline, not a high starting constant](../learnings/1787073638302-dce-scratchdata-epoch-safety-comes-from-a-local-ze.md):
replacing "re-zero a shared scratch field every fixpoint iteration" with a generation stamp
(#12605, `slang-ir-dce.cpp`) is only collision-safe if one up-front `initializeScratchData(root)`
zeroes the subtree (making the field pass-exclusive) and then a process-local `++liveEpoch` runs
inside the loop. A compile-monotonic counter "starting above the small bit-flag values other passes
use" is unsound because `slang-serialize-ir.cpp:474` writes an arbitrary unbounded inst index to
the same shared `scratchData` — a leftover index can equal any epoch and make a dead inst read as
live, and a false-alive in DCE fails to propagate liveness to an operand referenced only by it,
deleting it (dangling operand), so it is NOT merely conservative. The general rule: an epoch reusing
a shared field is safe only if a local baseline erases prior residuals. (Cite `tests/ir/loop-dce.slang`
for the `phiRemoved` fixpoint path — a simple accumulator loop converges in one iteration and doesn't
exercise it.)

## Reproduced symptom ≠ reproduced cause; and text-mode CRT vs a binary protocol

[slang: &buf[i] on explicit-layout structured buffer loses stride through a T* param (pre-existing)](../learnings/1786991645305-slang-buf-i-on-explicit-layout-structured-buffer-l.md):
verified at master `a0690fa7d` that a custom-layout structured-buffer element address escaping
through a plain `float*` param mixes `ArrayStride 16` with `ArrayStride 4` in the emitted SPIR-V —
a PRE-EXISTING bug in `operator&` (`core.meta.slang:3002` returns default-layout `Ptr<T,RW,Device>`),
NOT introduced by the #12581 `__getAddress` fix (which deliberately produces the same default-layout
pointer per the #10280 equivalence contract). The lesson that kept the fix scoped: verify the claim
against the BASE compiler rather than inheriting it — a reproduced symptom (wrong stride) is not a
reproduced cause; the control is running the same scenario with plain `&` on the unpatched compiler.
[test-server garble hook writes through text-mode CRT stdout — mangles \r\n\r\n on Windows](../learnings/1787044349307-test-server-garble-hook-writes-through-text-mode-c.md):
the fault-injection hook writes its `"...\r\n\r\n"` via `fwrite` on the CRT `FILE* stdout` (text
mode, no `_setmode` `_O_BINARY` anywhere in Slang source) while the framed reply goes through raw
`::WriteFile` — so text-mode translation turns `\r\n\r\n` into `\r\r\n\r\r\n` and defeats the
client's malformed-header detection on Windows only. The trap it flags: this cleanly explains a
*Windows-only* symptom but NOT a *debug-only* one (text mode is identical in debug and release) — a
debug-vs-release split needs a co-factor. General rule: a binary protocol stream must never sit on a
text-mode CRT `FILE*`, and when two write paths share one pipe, CRLF translation applies to only one.

## Build-system traps: linker-flag probes and the shared fleet volume

[exported_symbols_list must not go through check_linker_flag helpers](../learnings/1787679115155-exported-symbols-list-must-not-go-through-check-li.md):
`-Wl,-exported_symbols_list,<file>` must be applied directly via `target_link_options`, not through
a `check_linker_flag`-based helper — the probe links a trivial `int main(){}` defining NONE of the
exported symbols, ld64 treats a listed-but-undefined symbol as an error, the probe fails, and the
helper silently drops the flag (shipping the module unbounded — the exact bug being fixed). A
"fail-loud" guard keyed on the probe result would instead abort every macOS configure.
`-exported_symbols_list` is a core always-supported ld64 option needing no probe; a malformed list
surfaces at the real target link on CI. (The ELF `--version-script` path tolerates the probe, but
direct application + a real link is safest for both; the helper also caches negatively with no
content hash, so editing the referenced file never re-probes.)
[Fleet disk-full blocks Slang builds; verify via CI, and FIDDLE line-shift breaks single-file syntax checks](../learnings/1787282979852-fleet-disk-full-blocks-slang-builds-verify-via-ci-.md):
a from-scratch build needs ~11G and the `/workspace/agent` volume is shared fleet-wide, so it fills
at the DXC+SPIRV-Tools deps phase; when it hits 0 bytes even `git commit` fails (ENOSPC) — only
remove your OWN build dir (worktree-isolation), and push + draft PR to let CI do the build. And
because FIDDLE keys generated code by `__LINE__`, you cannot syntax-check a changed `.cpp` against a
sibling clone's stale `.fiddle` headers if you also edited a `FIDDLE()` header (line numbers shift →
`FIDDLE_863` mismatches) — that's a hack artifact, not a real bug; a real build regenerates fiddle.
(Adding a non-`FIDDLE()` field to a FIDDLE AST class is safe only if the node is consumed before
clone/serialization — verify the lifecycle first.)

**Source learnings (7):**

- [slang: &buf[i] on explicit-layout structured buffer loses stride through T* param (pre-existing)](../learnings/1786991645305-slang-buf-i-on-explicit-layout-structured-buffer-l.md) — a custom-layout element address escaping through a default-layout T* mixes ArrayStride 16/4; a pre-existing operator& bug, not the __getAddress fix; verify the claim on the base compiler.
- [test-server garble hook writes through text-mode CRT stdout — mangles \r\n\r\n on Windows](../learnings/1787044349307-test-server-garble-hook-writes-through-text-mode-c.md) — CRT FILE* text mode turns \r\n\r\n into \r\r\n\r\r\n while the reply uses raw WriteFile; explains Windows-only but not debug-only; a binary stream must not sit on a text-mode FILE*.
- [DCE scratchData epoch: safety comes from a local zero-baseline, not a high starting constant](../learnings/1787073638302-dce-scratchdata-epoch-safety-comes-from-a-local-ze.md) — the serializer writes unbounded inst indices to the shared scratchData; safety needs an up-front initializeScratchData + process-local ++epoch; a DCE false-alive deletes a live operand.
- [Slang: discard is NOT an IR terminator](../learnings/1787094619589-slang-discard-is-not-an-ir-terminator-excludes-it-.md) — discard sits outside the TerminatorInst group and execution continues past it; use class-hierarchy getTerminator(); accepted v1 set is return/break/continue/(conditional)throw + both-arm-diverging if.
- [Slang divergence analysis: switch without default falls through to exit](../learnings/1787096714301-slang-divergence-analysis-switch-without-default-f.md) — no-default switch routes unmatched to breakLabel, so all-arms-diverge doesn't make it diverge; exclude switch for v1; check how each form lowers, not intuition; codex caught the over-reach.
- [Fleet disk-full blocks Slang builds; verify via CI, and FIDDLE line-shift breaks single-file syntax checks](../learnings/1787282979852-fleet-disk-full-blocks-slang-builds-verify-via-ci-.md) — ~11G on a shared volume; push + draft PR to let CI build; FIDDLE keys by __LINE__ so stale generated headers mismatch when a FIDDLE() header is edited.
- [exported_symbols_list must not go through check_linker_flag helpers](../learnings/1787679115155-exported-symbols-list-must-not-go-through-check-li.md) — the probe links an empty main with none of the listed symbols → ld64 errors → the helper silently drops the flag; apply -exported_symbols_list directly and let the real link catch a bad list.
