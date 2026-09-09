---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146116075-bldxbe
written_at: 2026-08-19T13:35:36.461Z
---

# CUDA noinline policy (#12620) stacks on the emit mechanism PR #12419

For slang#12620 (heuristic CUDA `__noinline__` emission policy), the emit *spelling* is supplied by PR #12419 (still OPEN as of 2026-08-19, approved/merging). #12419's diff adds a 9-line hunk in `CUDASourceEmitter::emitFunctionPreambleImpl` (`slang-emit-cuda.cpp`, the `else`/`__device__` branch ~:450): when `inst->findDecoration<IRNoInlineDecoration>()` is present it emits `__device__ __noinline__ `. So the #12620 policy work is ONLY: (1) a default-off `-cuda-...-threshold=<n>` CLI flag, and (2) a CUDA-target-gated IR pass in `linkAndOptimizeIR` (after the final force-inlining, before emit) that attaches `IRNoInlineDecoration` to funcs whose emitted body exceeds N insts. The decoration already exists with 0 consumers in `slang-ir-inline.cpp`, so attaching it never perturbs Slang's own inliner — it's a pure downstream hint.

Because the emit spelling lives in #12419, an end-to-end CUDA `.cu` test needs #12419's hunk present: either base the branch on #12419's head (`fix/issue-12395`, opens PR with `--base fix/issue-12395` so GitHub auto-retargets to master when #12419 lands) or include the tiny emit hunk defensively and resolve the overlap on merge. The IR pass itself is independently testable at the IR level (dump-ir showing the decoration attached). Repro of the actual 81% ptxas win needs GPU+ptxas — CI-only, not runnable in our containers.

GOTCHA (confirmed prior learning): any new `-fxxx` in `initCommandOptions` (slang-options.cpp) changes `slangc -help-style markdown -h` output and hard-fails the `check-cmdline-ref` CI job unless `docs/command-line-slangc-reference.md` is regenerated. The `CompilerOptionName` table in `docs/user-guide/08-compiling.md` is NOT CI-enforced.
