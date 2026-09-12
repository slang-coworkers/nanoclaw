---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789156991227-1jf1wi
written_at: 2026-09-11T20:21:02.330Z
---

# Localizing a compiler stack-overflow: stack-size sweep + differential-target test

When a Debug-only `STATUS_STACK_OVERFLOW` / SIGSEGV is suspected to be deep recursion linear in input size, two cheap GPU-free tests confirm and localize root cause without gdb/a debugger (validated on shader-slang/slang#13018):

**1. Stack-size sweep = a POSITIVE recursion signature.** slangc compiles on the caller's MAIN thread with the OS-default stack (no worker/large-stack thread exists anywhere in the compiler; only vendored test frameworks set stack sizes). So `ulimit -s <KB>` directly constrains the compile stack. Sweep the input size N at a fixed small stack, then vary the stack: if the crash threshold N **moves monotonically** with stack size (smaller stack → smaller crashing N), that's genuine linear-depth recursion. On Linux the 8 MB default won't overflow at the reporter's N; `ulimit -s 512` (~0.5 MB) brought #13018's threshold into range (N≤260 ok, ≥280 → rc=139 core-dumped).
  - IMPORTANT contrast with the prior learning "a stack-limit sweep does not establish recursion": that warns that rc=139 *invariance* under a *growing* ulimit proves nothing (a bad-pointer OOB faults regardless of stack). The discriminator that DOES establish recursion is the threshold **changing** with stack size. Invariance ⇒ suspect bad pointer; movement ⇒ recursion.

**2. Differential-target test to localize the recursive stage.** Compile the identical source to a target that shares the suspect stage vs one that doesn't. Slang's C-like source-expression emitter (`slang-emit-c-like.cpp`, used by CUDA/HLSL/GLSL/Metal) recurses `emitInstExpr(:2381) → emitOperand(:2656) → emitOperandImpl(:2019) → shouldFoldInstIntoUseSites(:1495) → emitInstExpr` when folding single-use, side-effect-free operand chains. SPIR-V does NOT use this emitter. If C-like targets crash but `-target spirv` compiles the same IR even at a tiny stack, the recursion is in SOURCE-EMIT, not any target-agnostic IR pass (which would crash SPIR-V too). This also reveals scope: #13018 was titled "to CUDA" but all four source targets crash — SPIR-V is the only immune one.

**Concrete mechanism (#13018):** an N-texture accumulator (`acc += tex_i.SampleLevel(...)` in one block) folds after mem2reg into ONE giant left-leaning nested expression `(a) + (b) + ... + (n)` — every intermediate `add` is single-use so all fold. Verified: the Release-emitted `.cu` was a single ~22 KB line. The emitter walks that expression O(N) deep and overflows the larger Debug frames. FIX = cap fold-chain depth at the `shouldFoldInstIntoUseSites`/schedule layer so a deep chain materializes bounded intermediate temporaries — NOT a mid-recursion `getName` bailout in `emitOperandImpl` (would name an inst that was never given its own statement). No emit-path recursion guard exists; `kMaxTypeNestingDepth`=128 is front-end-only.
