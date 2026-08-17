---
title: "slangpy CI flake triage: re-symbolize the existing .dmp before designing fixes"
type: learning
topic: slang-compiler
source: learnings/1779545587070-slangpy-ci-flake-triage-re-symbolize-the-existing-.md
---

# slangpy CI flake triage: re-symbolize the existing .dmp before designing fixes

## What

When triaging a slangpy CI flake whose abort message is buried under crashpad symbolizer noise (`elf_dynamic_array_reader.h:64 tag not found` spam in the failing job log), the highest-leverage first action is to download the failing run's existing `crash-reports-${os}-${platform}-${compiler}-${config}` artifact and re-symbolize the `.dmp` locally with full symbols (e.g., `minidump-stackwalk` against a debug build of the same sha).

Verified on slangpy#994 (2026-05-23): triage spec'd 5 candidate approaches based on assumptions about Vulkan multi-process contention; re-symbolization revealed the abort was actually in slang's bundled SPIRV-Tools `MergeReturnPass`/`DefUseManager` — single-threaded use-after-free, completely unrelated to xdist concurrency. Three of the five candidate approaches dropped instantly; root cause moved upstream to `shader-slang/slang`.

## Why

slangpy's CI **already** uploads minidumps via `.github/workflows/ci.yml:228-234` (`Upload Crashpad Reports` step → artifact path `.crashpad/reports/`) when the matrix has the `crashpad` flag. The .dmp + .txt + .json files are there; what's missing is **inline** readable output in the job log. The on-the-fly stackwalk that runs as part of `slangpy/testing/crashpad.py:_postprocess_reports` (~lines 105-145) is shallow, and stderr from the aborting worker gets buried by the symbolizer's own warnings. So the artifact has the answer; the log doesn't.

## How to apply

When triaging *any* slangpy CI abort/SIGABRT issue:

1. Before designing concurrency hypotheses or solution-space mapping — check whether the failing run has a `crash-reports-*` artifact. Almost always yes for Linux Debug builds with `crashpad` flag.
2. Download the artifact, run `minidump-stackwalk` (or `lldb`/`gdb` on the .dmp via `breakpad`) against a build at the same sha. The actual abort signature usually points at one specific layer (slang, slang-rhi, slangpy, or driver).
3. Use that to scope the solution space *before* enumerating candidate approaches — don't write 5 hypotheses when re-symbolization will eliminate 3 of them.
4. The triage memo can list "re-symbolize the .dmp" as the *first fixer action* under "Risks / open questions" — slangpy#994's triage memo did this and the prediction held: that single check collapsed the solution space.

## Caveats

- Only works when `matrix.flags` contains `crashpad`. Verify before assuming the artifact exists.
- xdist worker-abort dumps go into the same shared `.crashpad` DB as the controller's; pid→test correlation lives in `slangpy/testing/plugin.py:81` (per-pid `<pid>.txt` markers). When re-symbolizing, cross-reference the pid in the dump with the per-pid marker file in the artifact to identify which test was running.
- If the dump-symbol mismatch is severe (debug symbols not available for the exact sha), build slangpy at the failing sha with the crashpad cmake flag enabled before stackwalking.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779545587070-slangpy-ci-flake-triage-re-symbolize-the-existing-.md`_
