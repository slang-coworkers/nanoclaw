---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1780733377038-23ni6p
written_at: 2026-09-23T08:21:51.334Z
---

# CI crash triage: 'Vulkan-only + no code change' can be a nondeterministic compile-time spirv-opt UAF, not driver/env

# A Vulkan-only CI crash with "no code change" is NOT automatically environmental

**Case (2026-09, slangpy #1181 → slang #13230/#13226).** The `ci-latest-slang` (Slang-`master` canary) nightly crashed a pytest-xdist worker on exactly one test — `test_tensor_with_grads.py::test_differentiable_interface_parameters[DeviceType.vulkan]` — 2 nights running; the `[DeviceType.cuda]` variant passed; and there were **zero slang-master commits** between the last-green and first-red run. The slangpy-triager (and I, relaying) concluded: *"leading hypothesis: a runner Vulkan driver/ICD/env change; needs a GPU CI-owner to diff driver versions"* and even *"uncatchable SIGKILL, no minidump possible."*

**Both were wrong.** A from-source repro on a clean box (single test, `-p no:xdist`, under gdb) showed it is a **Slang SPIR-V compile-time use-after-free** in the bundled SPIRV-Tools `MergeReturnPass` (`assert(unique_id_ != 0)` at `instruction.h:251` → `DefUseManager::EraseUseRecordsOfOperandIds` → `glslang_optimizeSPIRV` → Slang `emitSPIRVForEntryPointsDirectly`), a **catchable SIGABRT (rc=134)**, ~25% nondeterministic, triggered by the autodiff-through-`interface` `bwd_diff` kernel. Tracked as #13230, part of the #13226 differentiable-interface autodiff cluster.

**Why the "environmental" signature was a false lead — the three traps:**
1. **"Vulkan-only / CUDA passes" ≠ backend/driver-specific.** Only the SPIR-V target runs the bundled SPIRV-Tools optimizer; CUDA emits C++/PTX and never reaches that pass. So a *compile-time optimizer* bug is intrinsically Vulkan-only, with no GPU/driver involvement.
2. **"No code change in the green→red window" ≠ environmental.** A use-after-free is nondeterministic by nature (allocation/ordering). Its manifestation can flip night-to-night — or amplify to near-deterministic under xdist parallelism — with **no code change**. Don't infer "the environment changed" from "the code didn't."
3. **"No crashpad dump" ≠ uncatchable kill.** It was a normal catchable SIGABRT; the dump gap had other causes. Absence of a dump is not evidence of an OS-level SIGKILL.

**Rule.** Before hypothesizing "driver/env" for a Vulkan-only CI crash, get the actual stack: repro the single test from source with `-p no:xdist` + gdb / core dump. A compile-time SPIR-V-opt crash convincingly mimics an environmental signature. And when relaying a coworker's *hypothesis* upward, relay it AS a hypothesis — don't harden "leading hypothesis: X" into "it's X."
