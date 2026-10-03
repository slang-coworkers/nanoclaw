---
name: project-12182-cuda-optix-callable-rdc-linkage
description: "MERGED 2026-09-01 (jkwak-work, 5ed83a468c). Human PR by ksavoie-nv adding OptiX callables on CUDA; settled linkage policy = static on every generated CUDA __device__ fn unless HLSLExport/CudaDeviceExport-decorated. Our rounds-4–6 isPublicOrExportedFunc recommendation was WRONG (couples Slang-module visibility to CUDA TU linkage); kept for the lessons."
metadata: 
  node_type: memory
  type: project
  originSessionId: d48066a0-5d47-4266-ae79-573534644728
---

shader-slang/slang PR **#12182** "Add callable shader support to CUDA/OptiX backend" — author
**ksavoie-nv**, branch `add-callshader-support-to-optix`, labels `pr: breaking change` + `optix`.
Human-contributor PR; we answered @nv-slang-bot questions from jkwak-work and ksavoie over seven
rounds (07-28 → 08-06), explanation-only via `slang-fixer` (MODE=pr-review-fix), thread
`gh-issue-shader-slang/slang-12182`.

## Outcome (terminal)

**MERGED 2026-09-01T14:00:50Z by jkwak-work**, merge commit `5ed83a468c`, final head `3395e9b6`
(≥4 force-pushes over the life of the PR). jkwak approved 08-26 after a Slack discussion with Yong;
ksavoie fixed `tests/cuda/noinline.slang` (now expects `static __device__ __noinline__`) and added a
breaking-change note 08-28 — the break being our round-1 point that cross-module references to
generated helpers now need `[CudaDeviceExport]`. No bot action remains.

**Shipped linkage policy (ksavoie's rule):** emit `static` on **all** generated CUDA functions except
those explicitly exported (`HLSLExportDecoration` or `CudaDeviceExportDecoration`). This decouples
downstream CUDA TU linkage from Slang-module visibility. Callable entry points stay external
(`extern "C" __device__ __direct_callable__<name>`; the entry-point branch in `slang-emit-cuda.cpp`
returns before helper logic).

## The technical substance

- **Why helpers collide.** Under `-rdc`, `__device__` functions get external linkage — intended nvcc
  behaviour (NVCC manual §4.2.7.4, §6.2 `nvlink`), not a downstream bug. Two entry points sharing a
  struct each emit a synthesized initializer ⇒ duplicate definition at `optixPipelineCreate`/`nvlink`.
  `-rdc` is auto-added only for the RayTracing pipeline (`slang-nvrtc-compiler.cpp:1341-1345`), but a
  user `-rdc` on plain `-target cuda` hits the same collision.
- **Why the original RT-stage gate was wrong.** It keyed off `m_entryPointStage`, which
  `slang-emit.cpp` collapses to `Stage::Unknown` when `getEntryPointCount()!=1`, and
  `isRaytracingStage(Stage::Unknown)` is false — so the protection was silently off for multi-entry
  compiles, invisible in single-entry tests. Dropping the gate and making `static` unconditional
  dissolves the problem.
- **`-rdc` is not visible at source emission** — it is decided downstream (`slang-code-gen.cpp`
  DownstreamCompileOptions), so gating on it would need new plumbing into the emitter `Desc`.
- **The `raytracing` capability atom can't discriminate** — its alias expands to `… | cuda`, so every
  CUDA target satisfies it.
- **Cross-backend precedent:** HLSL and C++/CPU couple export to `public`; **SPIR-V decouples** via
  `DownstreamModuleExport/Import` → `LinkageAttributes`, not visibility-derived — SPIR-V is the real
  precedent for the shipped design. `HLSLExportDecoration` as a CUDA co-predicate is a policy reading
  of the bare `export` keyword; we asked for an explicit code comment.
- `[CudaDeviceExport]` is `/// @experimental` (`core.meta.slang`) yet is now one of only two opt-outs.

## Our error (rounds 4–6), corrected by the author in round 7

We recommended `static` iff `!isPublicOrExportedFunc(func)` (hoisted from `slang-emit-cpp.cpp`). That
predicate's **first case is `kIROp_PublicDecoration`**, so any `public` Slang function stayed external
and collided (`slang-unit-test-tool/optixMultipleDefinition`). I had named the matching subset
(EntryPoint + CudaDeviceExport) and never flagged the `public` superset — the wrong axis (Slang
module visibility vs downstream TU linkage) was the whole error. We posted a plain concession
(comment 5199013899, 08-06T00:31Z, verified) before jkwak's human design meeting.

## Lessons

- **Re-verify the PR HEAD SHA every round and cite PR-HEAD permalinks**, not master/working-tree
  line numbers — a force-push moved the whole citation base mid-thread, and an Explore subagent
  returned stale line numbers that were caught only by `git show pr-12182:` re-verification.
- **Decl/def linkage must agree.** The function preamble runs for both forward declaration
  (`slang-emit-c-like.cpp:4001`) and definition (`:3916`); a predicate that differs between them
  yields `extern` decl vs `static` def. Key on a property of the `IRFunc` itself — `isDefinition()`
  is fine for that reason, a per-emission-site check is not.
- **When borrowing a predicate, audit its full positive set, not the subset you need.**
- ⭐**An overclaim inside a concession is the least-audited claim in the turn** — codex caught a
  SPIR-V "nuance" asserted from a stale code comment (`compiler-tu.cpp:155`) inside our round-7
  correction; the humility framing buys unearned trust for what follows.
- **Died-vs-working after a dispatch:** probe (1) does the outward artifact exist? (2) is the
  recipient session frozen at the delivery timestamp with no outbound row? Frozen + absent ⇒ died,
  redrive safely (round 7 was killed by a container restart and redriven). See
  [[feedback_verify_elapsed_time_from_live_artifact]].
- Infra (fixer-reported, unverified): the codex OUTPUT_REVIEW gate false-positived on REST
  `pulls/.../replies`; the GraphQL `addPullRequestReviewThreadReply` mutation worked.
