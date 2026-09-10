---
name: project_11952_module_link_perf_reopened
description: "#11952 module_link +5% regression from #11921 — RE-OPENED (was wrongly closed); P2; awaiting fixer cross-drive draft PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 92b21b01-b7fc-408a-b0c9-41f0e4df7896
---

shader-slang/slang **#11952** — `module_link` compile-time +5% regression bisected to **#11921** (correct cross-drive cache fix for #11918; stays).

**History / correction:** first pass CLOSED it 2026-07-06 as "codegen/LTO-layout artifact, no fix" after a STEP 0 byte-compare showed identical `.slang-module` bytes. That verdict was **wrong on environment**: the byte-compare ran on **Linux single-filesystem** where #11921's `result.empty()` cross-drive branch is **unreachable** — so it proved nothing. See [[feedback_verify_branch_in_env_where_it_fires]].

**RE-OPENED 2026-07-08** on the reporter's (jvepsalainen-nv, human) sharper 3-point ladder on `windows-x64-perf` (checkout `W:`, temp `C:` → genuine cross-drive, the exact condition #11921 targets):
- #10996 exonerated (flat); step lands at **#11921**.
- Cost is in **`SemanticChecking` +13.5%** (`compileInner` +7.4%), NOT deserialization/linking (`readSerializedModuleIR`/`readSerializedModuleAST`/`linkIR` all flat) → per-`import` resolution work, ~0.1 ms × 100 modules.
- Windows-cross-drive-only: macOS single-fs flat; Windows source-load (non-binary) flat.

**Mechanism (triager hypothesis, code-grounded):** `isBinaryModuleUpToDate` (slang-session.cpp:1825) inside loadBinaryModuleImpl→loadModuleImpl, called from import → under SemanticChecking. Pre-#11921 the empty own-source path hit the #11125 early-accept `return true` (skips per-dep resolve→read→digest loop); post-#11921 the absolute path resolves so the loop runs fully.

**Re-classified med / P2** (was P3). GitHub trail: triage 4894171628 + fixer STEP 0 4894582918 (both now superseded) + corrected re-open comment **4915790006**. `regression` label; issue OPEN.

**Fixer gate (corrected):** repro/trace on a REAL cross-drive setup (NOT single-fs); fix that recovers per-import time while preserving #11921's cross-drive cache-hit correctness; **draft PR + `report_pr_created`** (fix/issue-* has no prefix-route fallback); verify against the **post-#11779 baseline** (#11779 link gating masks ~10 ms). Triager owns the fixer edge + GitHub; rolls up to me on thread `gh-issue-shader-slang/slang-11952`. Awaiting fixer report. Ready-flip/merge operator-gated.
