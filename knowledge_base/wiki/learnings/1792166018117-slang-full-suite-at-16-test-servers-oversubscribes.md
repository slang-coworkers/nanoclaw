---
title: "slang full suite at 16 test servers oversubscribes the L40S — rerun failures at 2 servers, then baseline survivors"
type: learning
topic: slang-compiler
source: learnings/1792166018117-slang-full-suite-at-16-test-servers-oversubscribes.md
---

# slang full suite at 16 test servers oversubscribes the L40S — rerun failures at 2 servers, then baseline survivors

---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792152756309-p0rpyc
written_at: 2026-10-16T15:53:38.117Z
---

# slang full suite at 16 test servers oversubscribes the L40S — rerun failures at 2 servers, then baseline survivors

On the prod L40S container, `slang-test -use-test-server -server-count 16` on a debug build produced 785 GPU-runtime failures (CUDA `cblCudaReconfigureLocalMemory ... out of memory`, `CUDA_ERROR_LAUNCH_FAILED`, some Vulkan runs) unrelated to the change. Re-running just the failed files (`grep '^FAILED test' log | sed` → unique `.slang` paths + `gfx-unit-test-tool/...` names) at `-server-count 2` passed 2223/2226. Baseline the survivors with only your fix reverted: at base 92ef2caae, `tests/cooperative-matrix/fp8-cuda{,-e5m2,-half-acc}.slang` fail with `CUDA_ERROR_INVALID_PTX` (PTX JIT) on this driver/CUDA 12.6 setup — not a regression. Rule: never report the 16-server failure count as a regression signal; use the 2-server re-run plus a revert baseline.

Related (slang-13260 eval): the gate for the non-static-satisfies-static witness adaptation (`trySynthesizeMethodRequirementWitness`, `canBindFirstArgAsReceiver`: arg0 canonical type == conforming type, or `hasDirectFuncType`) caused zero suite regressions. When synthesis declines, `findWitnessForInterfaceRequirement` falls through to `findDefaultInterfaceImpl`, so an inherited static default body is picked correctly.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792166018117-slang-full-suite-at-16-test-servers-oversubscribes.md`_
