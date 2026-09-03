---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788287460260-mgjz4l
written_at: 2026-09-02T09:11:07.545Z
---

# Arch-only miscompile: refute the triage root cause with a poison test, then let whole-process valgrind find the real uninitialized read

On slang#12871 (fwd-diff of user `IFloat.neg()` returned `0 0` on aarch64, correct `-9 -6` on x86_64, via slangi). Triage's root cause was "slangi VM working-set frame memory is never zero-initialized → read uninitialized" with recommended fix = zero-init the VM frame on push (Approach A).

**That root cause was wrong, and a cheap experiment refuted it before I wasted a build shipping the mask.** On the x86_64 box I built slangi with an env-gated frame fill and ran the repro three ways: baseline, poison every callee/entry frame word with `0xCC`, and zero-fill `0x00`. All three produced the correct `-9 -6`. Per-site copy-overlap instrumentation on every VM memcpy: 0 overlaps. The disassembled bytecode writes every `ws:` slot before reading it. Conclusion: no working-set uninitialized read affects the result on x86_64, so Approach A is INERT — shipping it would be a band-aid (and it might even make x86_64 wrong if x86_64's correctness came from warm reuse). Don't ship a change you can't name a failing test for.

**Key lever (what the triage correctly asked for): whole-process valgrind, not a frame poison.** A frame-poison test only covers memory you can fill (the VM working set); it cannot see the *emit step*, handler C++ locals, or libc. `valgrind --track-origins=yes` on the debug binary flagged exactly one error — "Conditional jump or move depends on uninitialised value(s)" — and, crucially, valgrind flags a *dependency* on an uninitialized value even when the local x86_64 output is correct. Origin: `new Module(linkage)` in `emitHostVMCode` (slang-emit.cpp) → `PathInfo::hasFoundPath()` reads `PathInfo::type` during host-VM module serialization. Root cause: `PathInfo` (source/compiler-core/slang-source-loc.h) is a ctor-less struct whose `type` field had no default member initializer, and the synthesized "kernels" module never calls `setPathInfo`. Fix: `Type type = Type::Unknown;` (producer-side, one line). valgrind clean after.

Caveats worth carrying: (1) the read is benign-in-effect on x86_64 because `hasFoundPath = (type∈{…}) && foundPath.getLength()>0` and foundPath is empty → false regardless of `type`; so this may not be the sole cause of the aarch64 `0 0`, and the aarch64 CI legs are the real oracle (memcheck can't see the next suspect, strict-aliasing UB in the VM's uint64-buffer type-punning). (2) `-Wno-maybe-uninitialized` in cmake/CompilerFlags.cmake is why the compiler never warned. (3) `valgrind` was not preinstalled — needed `install_packages(apt:[valgrind])` (approval + container restart; worktree/build persist).
