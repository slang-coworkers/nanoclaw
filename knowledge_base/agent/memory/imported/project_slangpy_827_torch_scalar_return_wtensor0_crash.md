---
name: project_slangpy_827_torch_scalar_return_wtensor0_crash
description: P1 live crash regression on scalar-return torch interop; original Vulkan VRAM leak unverifiable; A-vs-B semantics fork maintainer-gated
metadata: 
  node_type: memory
  type: project
  title: "slangpy#827 torch scalar-return WTensor<T,0> compiler crash + Vulkan leak"
  tags: 
    - slangpy
    - torch-integration
    - regression
    - P1
    - maintainer-gated
  originSessionId: 4faeedf6-6510-4adf-9c7a-5b84583d8962
---

# slangpy#827 — Memory leak (Vulkan+torch) EVOLVED into scalar-return compiler crash

Re-triage 2026-07-27 (jhelferty-nv asked "still a problem?"). Triager re-triaged
against HEAD `5a1b34b`. Issue split into TWO problems:

1. **Original VRAM leak** (Vulkan + `enable_cuda_interop` + torch loop): reportedly
   fixed by PR #781. NOT empirically re-measurable — only interop-capable runner
   errors on `command_encoder->finish()` SLANG_FAIL under Vulkan+CUDA-interop; prior
   probe showed NO leak on CUDA. Needs a Vulkan+cuda-interop runner to close.
2. **LIVE P1 crash** `InternalError: didn't find tuple element` — STILL REPROS at HEAD
   (confirmed by code inspection, NOT yet live build). Root cause unchanged since
   jhelferty-nv's March analysis: `calldata.py:207-208` forces `return_type=torch.Tensor`
   BEFORE `call_dimensionality` computed (`calldata.py:262`) → scalar returns bypass the
   `call_dimensionality==0 → ValueRef` default (`callsignature.py:222-227`, only fires when
   return_type is None) → torch marshall (`torchtensormarshall.py:254-268`, L265) builds
   `WTensor<T,0>` (zero-length `uint[0] _shape/_strides`) → Slang ICEs on type legalization
   in ParameterBlock. No fix landed; NO regression test in test_torchintegration.py.

## Design fork (maintainer-gated — NOT my call)
- **A** (jhelferty-nv): guard torch return override to `call_dimensionality>0` so scalars
  fall through to ValueRef → returns Python scalar (surgical, stops crash, but NOT torch-faithful).
- **B** (ccummingsNV): support 0-D torch returns end-to-end → `module.test(...)` yields 0-D
  `torch.Tensor` (matches torch; larger; needs codegen to stop emitting crashing uint[0]).
- ccummingsNV OPEN question: verify torch's real 0-D return behavior FIRST. Landing A could
  need reverting if maintainers want B. Slang ICE itself arguably upstream robustness bug
  (should error cleanly) → secondary `escalate-to-slang`.

## Routing (2026-07-27)
- GitHub 5-bullet verdict POSTED by triager: issuecomment-5097870926 (fresh comment, human
  labels regression/Dev Reviewed untouched).
- MAIN dispatched slangpy-fixer scoped to PREREQUISITE ONLY: (1) verify torch 0-D return
  semantics (ccummingsNV's ask), (2) attempt live-build repro to upgrade crash from inspection
  → empirical, (3) prepare Approach A as HELD DRAFT only — NOT to land. A-vs-B semantics
  decision held for maintainer (jhelferty-nv/ccummingsNV). Merge operator-gated.
- Repro: `float test(ITensor<float,1> tex, float i){return tex[int(i)];}` called
  `module.test(tex=torch_cuda_tensor, i=0.0)` on DeviceType.vulkan, enable_cuda_interop=True.

## Empirical A/B run #1 (2026-07-27, fixer, L40S torch 2.13.0+cu126) — INCONCLUSIVE
- BLOCKER: native `slangpy_torch` bridge NOT built in worktree (`import slangpy_torch`→ModuleNotFound;
  `is_torch_bridge_using_fallback()=True` reason='missing'). Literal repro raised RuntimeError at
  calldata.py:198 (BEFORE fix block @278), never reached compiler.
- Fixer re-ran all 3 with `SLANGPY_ALLOW_TORCH_FALLBACK=1` (Python fallback; still runs full
  calldata kernel-gen + Slang compile — the path the fix touches). Results:
  - Run1 BASELINE (fix stashed out): scalar repro → gen `RWTensor<float,0>` → **EXIT 0, NO CRASH**,
    returned `tensor(0., cuda:0)`. The zero-rank WTensor<float,0> the triage said ICEs — compiled clean here.
  - Run2 CONTROL (elementwise add): OK, torch.Size([16]).
  - Run3 WITH FIX: scalar repro → gen `ValueRef<float>`/`RWValueRef<float>` → EXIT 0, returned Python `float 0.0` (not tensor).
- PROVEN: fix changes scalar-return codegen WTensor<T,0>→ValueRef<T>, return type torch.Tensor→float.
- NOT PROVEN: the baseline ICE. Two hypotheses (fixer, labeled): (1) fallback marshalling avoids the
  trigger the NATIVE bridge hits (ICE only fires with slangpy_torch natively installed); (2) ICE is
  Slang-compiler-version-specific, bundled compiler here doesn't ICE on WTensor<float,0>.
- Note: posted GitHub verdict correctly hedged "not yet by a live build" → not falsified.
- MAIN AUTHORIZED native torch-bridge build (/slangpy-build src/slangpy_torch) + clean native A/B
  (baseline no-fallback: does `didn't find tuple element` ICE fire? + fixed run). Still HELD DRAFT,
  NOT to land. If native baseline ALSO doesn't crash → material: bug may be env/version-specific or
  already-resolved; fix may be unnecessary — report plainly, don't force it.
- Logs: /tmp/repro827_baseline.log, /tmp/ctrl827_baseline.log, /tmp/repro827_fixed.log (fixer FS).

## Native A/B run #2 (2026-07-28 00:18, fixer, L40S native bridge) — TWO MATERIAL FINDINGS
1. **Native baseline does NOT reproduce the ICE.** Built native `slangpy_torch` cleanly at HEAD
   5a1b34b (no source edits, `is_torch_bridge_using_fallback()==False`). Scalar repro, NO fallback:
   baseline (fix removed) → EXIT 0, generated exact `WTensor<float,0>` `_result`, compiled+dispatched,
   returned `tensor(0., cuda)`. Also FORCED `ParameterBlock<CallData>` path (monkeypatch, no source
   edit) — still EXIT 0. → #827 ICE is **environment/Slang-version-specific**; does NOT fire on this
   stack (L40S/CUDA/native bridge/bundled Slang @5a1b34b). Reporter+jhelferty-nv hit it on a diff config.
   **Approach A is not fixing a crash we can observe here** — reported plainly.
2. **Literal Approach A (guard `call_dimensionality>0`) is WRONG — regresses behavior.**
   `call_dimensionality==0` is NOT scalar-only; also covers whole-tensor/aggregate returns
   (`float3`, `float[5]`). dim>0 guard diverts those to ValueRef too → breaks **16 existing torch tests**
   (test_add_values/test_polynomials, return-mode, dim-0 vector/array) in autograd hook
   (`save_for_backward … type list`). = the revert risk MAIN flagged; caught pre-land.
3. **Corrected Approach A (fixer's draft):** guard on return ELEMENT TYPE scalar
   (`_result.vector_type is ScalarType`), NOT dimensionality. Distinguishes `float`(ScalarType) from
   `float3`/`float[5]`(Vector/Array). scalar→Python float (#827 behavior), aggregate/vector→torch.Tensor
   (unchanged). 16-test regression disappears; scalar regr test red@baseline/green@fix. Full torch
   suite running for zero-regression confirmation. Draft HELD, no PR, no GitHub writes.
- IMPLICATION for A-vs-B + maintainer routing: since crash unreproducible here AND fix returns Python
  float (not torch-faithful), the whole change is now genuinely maintainer-gated — may be unnecessary
  or wrong-semantics. Await fixer's final suite counts + recommendation, THEN take to jhelferty-nv/ccummingsNV.

## FINAL prereq report (2026-07-28 00:25, fixer report_827.md) — COMPLETE
Branch `dev/slangpy-fixer/827` local/unpushed, commit 5869472 (3 files +41/-3). HELD, no PR, nothing landed.
- **D1 torch 0-D behavior (ccummingsNV's ask) — SETTLED empirical:** torch scalar-logical ops return a
  **0-D `torch.Tensor`** (shape `()`), NEVER a Python scalar (only explicit `.item()`/`float()` does).
  `t[2]`→tensor(2.) shape (); `a+b`, `.sum()`, `relu()` all 0-D tensors. → **torch convention favors B.**
  Approach A returns ValueRef/Python float → diverges (user chaining .backward()/.cuda()/+ gets float not tensor).
- **D2 empirical repro — ICE does NOT reproduce here:** native bridge built clean, fallback==False.
  Baseline (fix removed, no fallback): EXIT 0, generated exact `WTensor<float,0>`, compiled+dispatched,
  returned tensor(0.,cuda). Forced `ParameterBlock<CallData>` path (monkeypatch): still EXIT 0.
  → ICE is **env/Slang-version-specific**; WTensor<T,0> legalizes fine on this stack. NOT refuted (reporter
  hit it on diff config), just not reproducible here. (CPU-torch fallback SIGSEGV was generic interop
  artifact, control-discarded as non-evidence.)
- **D3 HELD DRAFT corrected-A:** literal-A (guard call_dim>0) regresses 16 tests (dim0 also = aggregate
  float3/float[5] returns → ValueRef → autograd `save_for_backward…type list`). Corrected: guard on RETURN
  ELEMENT TYPE `_result.vector_type is ScalarType` (float=Scalar→ValueRef; float3/[5]=Vector/Array→Tensor
  unchanged). Verify: test_torchintegration 334 passed/84 skip/0 fail; +12 (pytorch/torchbuffers); +8 return_types;
  new `test_scalar_return_with_torch_input` red@baseline/green@fix. Diff: calldata.py (move+guard override) +
  test .slang `read_element` + test .py. If B chosen, discard draft + invert test assertion.
- **RECOMMENDATION (fixer):** torch convention→B; crash not reproducible→no urgency to rush A; A viable ONLY
  with corrected element-type predicate; B out-of-scope (needs codegen for WTensor<T,0> 0-D readback).
- **MAIN ACTION 07-28:** authorized fixer to post ONE follow-up observability comment on #827 (narrow write
  lift; draft/PR/land STILL gated) with empirical update + A-vs-B question to @jhelferty-nv + @ccummingsNV.
  MUST correct prior "still reproduces (code inspection)" → "code path unchanged but ICE not reproducible on
  our stack; env/version-specific; needs reporter's config to confirm". Chain then HOLDS pending maintainer
  reply via webhook. Decision (A-vs-B) is maintainer's; if A→open draft PR; if B→discard, build B.

Related: [[project_slangpy_782_torch_coverage_gaps]] · shared learning 1782324497848 (leak probes).
