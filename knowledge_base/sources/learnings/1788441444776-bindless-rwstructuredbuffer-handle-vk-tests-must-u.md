---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787839870753-hpdgfi
written_at: 2026-09-03T13:17:24.776Z
---

# Bindless RWStructuredBuffer.Handle -vk tests must use -emit-spirv-directly or they hard-fail the "Test Slang via glsl" cross-check

**Context:** shader-slang/slang PR #12800 (fix for #12797). A test that reads a bound bindless `RWStructuredBuffer<float>.Handle` with a dynamic index (`bindless[tid]`) under a `//TEST(compute):COMPARE_COMPUTE(...): -vk ...` directive **passed on Linux/macOS but hard-failed on the Windows-release GPU `test-slang` jobs** — all three (dx/vk/cuda) — in a step named **"Test Slang via glsl"**.

**Why:** slang-test's "Test Slang via glsl" step re-runs `-vk` tests through the **glslang** reference path (`-emit-spirv-via-glsl`), a common step present in every GPU `test-slang` job (so a single `-vk` test failure shows up in the dx AND cuda AND vk jobs — it looks "backend-agnostic → not my change," but it isn't). Slang's GLSL emitter produces **invalid GLSL** for a bindless storage-buffer dynamic-index read: (1) it doesn't request `GL_EXT_nonuniform_qualifier` for the variable heap index, and (2) it leaves the raw SSBO block (`block{... array of float _data}`) as an operand instead of the indexed `float` element. glslang hard-rejects → filecheck finds no output → FAIL. The **direct-SPIR-V** path (`-emit-spirv-directly`, used by Linux/macOS `-vk`) is unaffected.

**The rule / fix:** bindless buffer-handle `-vk` execution tests must carry **`-emit-spirv-directly`** on the directive — exactly as the sibling `tests/language-feature/descriptor-handle/desc-handle-test-input.slang:1` does (`-vk ... -render-feature bindless -emit-spirv-directly`). `-emit-spirv-directly` overrides the injected `-emit-spirv-via-glsl` (`slang-test-main.cpp:4263`), so the test runs direct-only and skips the broken bindless-via-GLSL cross-check. The underlying GLSL-emit gap is tracked as **#12897** (distinct from #12161, which is NonUniform-decoration *propagation* on a texture/resource-heap handle that compiles fine).

**Two triage meta-lessons this cost:**
1. **Don't accept a "backend-agnostic failure → not my change" argument at face value — pull the failing job log.** A `-vk`/spirv-asm test-only change *can* make dx+cuda+vk jobs all fail, because the shared "Test Slang via glsl" step runs the `-vk` test via glslang inside every GPU job. The fixer's plausible reasoning was wrong; the log (job `.../logs`, `gh api ... --allow-escape-sequences`, grep for `FAILED test:` / `error:`) named the exact tests + glslang errors and settled it.
2. **CI "reds" on a bot PR are often the priority-yield, not failures — but verify which.** `check-ci` + `wait-for-human-priority` red with all real jobs `skipped` = the bot-PR priority-yield (bot PRs yield CI-runner priority to human PRs; clears on ~8h aging or a maintainer prioritizing). But once priority is granted and real jobs run, read the actual job conclusions + step logs. Use the master baseline (`check-runs` on recent master commits) + concurrent open-PR state + `runner_name` (three different runners failing the same step deterministically ⇒ not a bad box) to separate real-code from infra/flake.
