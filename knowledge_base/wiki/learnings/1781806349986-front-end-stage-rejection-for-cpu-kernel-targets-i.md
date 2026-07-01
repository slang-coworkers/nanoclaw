---
title: "Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid"
type: learning
topic: misc
source: learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md
---

# Front-end stage-rejection for CPU-kernel targets is over-broad — graphics→CPU cross-compile is valid

**Rule:** Do NOT add a front-end (`validateEntryPoint`) rejection of non-compute pipeline stages on CPU kernel targets (`isCPUTarget(target) && isKernelTarget(...)`, i.e. cpp/hpp/c/object-code/host-callable/shader-llvm/shared-library). Graphics-stage (vertex/fragment) entry points compiling to those targets is **valid input**, not a malformed shape to reject at the front end.

**Why (slang#11659 / PR #11661, 2026-06-18):** The #11659 crash was a null-deref in the CPU varying-parameter legalizer (`slang-ir-legalize-varying-params.cpp`): `processEntryPoint` legalizes the entry-point RESULT before the parameter loop sets `m_param` (default null), so an unsupported result varying (e.g. `SV_Position`) hit `diagnoseUnsupported{System,User}Val` → `m_param->sourceLoc` null-deref. Triage recommended ALSO rejecting the stage/target combo at the front end (reuse E36107) as "the principled layer." That premise — "kernel-style CPU targets only emit compute kernels" — is **FALSE**. CI proved it: the front-end rejection broke `tests/render/cross-compile-entry-point.slang`, `cross-compile0.hlsl`, `imported-parameters.hlsl` (the `syn (llvm)` variant), which legitimately cross-compile vertex/fragment entry points to the LLVM CPU kernel target and PASS on master. The legalizer lowers their varyings fine (their entry points have input params + struct results that ARE representable). There is **no front-end signal** distinguishing an entry point the legalizer can lower from one it cannot — that's a per-shape decision made inside the legalizer. So the rejection cannot live at the front end without breaking valid cross-compilation.

**The correct fix is legalizer-only:** make the unsupported-varying diagnostic use a null-safe source location (fall back to `m_entryPointFunc->sourceLoc` when `m_param` is null) + reset `m_param`/`m_paramLayout` per entry point. This converts the crash into the legalizer's existing diagnostic ONLY on the unsupported path and is a no-op when `m_param` is non-null, so valid graphics→CPU compiles are untouched.

**How to apply:** When a CPU/LLVM-target crash looks like "this stage shouldn't reach this backend," verify against `tests/render/*` `syn (llvm)` (and any cross-compile/synthesis path) BEFORE adding a front-end stage/target gate — those paths deliberately compile graphics shaders to the CPU/LLVM target. Fix the crash at the consumer (legalizer null-guard), not by rejecting the input shape upstream. Also: a triage memo's recommended layering is a hypothesis, not ground truth — run the FULL test suite (incl. tests/render with `-api cpu+llvm`), not just the obviously-related dirs, before trusting a front-end gate. (My local pre-PR verification ran capability/headers/diagnostics but NOT render/ — that gap let the regression reach CI.)

**Target-reachability gotcha for tests:** only cpp/hpp/host-callable reach the CPU varying-param legalizer for a graphics entry point; `-target c` fails earlier with E00028 (no C backend) and `-target object-code` with E52006 (no downstream object compiler) in CPU-only configs — so those are NOT valid regression cases for this legalizer path.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781806349986-front-end-stage-rejection-for-cpu-kernel-targets-i.md`_
