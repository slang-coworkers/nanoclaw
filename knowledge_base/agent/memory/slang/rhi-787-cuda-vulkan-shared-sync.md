---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: Real missing cross-API ownership bug (not tolerance). Maintainer jhelferty-nv rejected #812's create-time approach, then rejected the fixer's IExternalMemoryQueue sketch and MANDATED his own explicit API — handOffShared/takeOverShared appended to ICommandEncoder. Implemented in DRAFT PR #881 (current head 360bd42, GPU-CI-green, per-test PASSED incl the #4 round-trip, crash-free, warning-flood gone). Two gates remain: (1) reviewer re-confirm on final head; (2) operator drafts-only lift on explicit maintainer go. #812 (register-all) held as the other alternative. Review-round history split to [[rhi-787-review-history.md]].
tags: [slang-rhi, synchronization, cuda, vulkan, interop, live-chain]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 — CUDA↔Vulkan shared-texture missing synchronization

**State (2026-09-24): LIVE. Draft PR #881 implements jhelferty's mandated explicit API; head
`360bd42` is GPU-CI-green and I have per-test re-verified it. Held as draft pending (1) slang-reviewer
re-confirm on `360bd42` and (2) the operator drafts-only guardrail lift on an explicit maintainer go.**
#812 (register-all internal design, HEAD `6e040d1`, GPU-green) is held untouched as the alternative.
Canonical thread `gh-issue-shader-slang/slang-rhi-787`; PR review thread `gh-pr-slang-rhi-881-review`.
Re-opens on jhelferty's webhook. Full review-round history: [[rhi-787-review-history.md]].

## The bug (triager verdict, comment 5049387926)
`texture-shared-cuda.vulkan` release-only flake is a **real missing cross-API sync bug, NOT a
numeric-tolerance flake.** The shader is a bit-exact float4 copy of exactly-representable {0.0,0.5,1.0} in
RGBA32Float ⇒ delta must be exactly 0.0 when synced. The Vulkan→CUDA hand-off did the transfer with **no
external-semaphore wait** and **no `VK_QUEUE_FAMILY_EXTERNAL` ownership transfer**, relying only on host
`waitOnHost()`; shared images stay `VK_SHARING_MODE_EXCLUSIVE` on the graphics queue, so CUDA reads an
image Vulkan still owns. The sibling surface path (`cuda-surface.cpp`) already had the correct machinery.
**D3D12 already works.** The triager's earlier draft #791 (which *widened tolerance*) MASKED the bug ⇒
closed; #812 (create-time approach) was the first fix attempt, since superseded.

## Revised policy (comment 5704482839) — supersedes the earlier scope decision AND #812's approach
jhelferty **confirmed** the diagnosis and **rejected #812's create-time release** ("makes Vulkan and D3D12
mean different things and only covers a one-shot initialized create"):
- **Same contract on VK + D3D12:** one allocation; producer keeps it after `create*`; another API accesses
  only after the producer's `waitOnHost()` OR after waiting on a shared `IFence` the producer signaled;
  producer may reuse after the matching wait — **ping-pong REQUIRED.**
- **Vulkan:** release to `VK_QUEUE_FAMILY_EXTERNAL` and **acquire back INSIDE submit / `waitOnHost` / fence
  signal — NOT at create time** (reuse the per-frame pattern in `src/cuda/cuda-surface.cpp:1047-1069`).
- **D3D12:** NO behavior change ⇒ revert #812's create-time COMMON transition.
- **Document** next to the `Shared` flags / `FenceDesc::isShared` in `include/slang-rhi.h`.
- **Tests:** fix the impl, DO NOT change `texture-shared-cuda`; EXTEND `buffer-shared-cuda` to a real
  ping-pong (producer reads CUDA's writes back after waiting; drop the producer-readback hack).
- **OUT OF SCOPE:** `createFenceFromSharedHandle` for CUDA — CUDA `IFence` is a host counter; GPU-side CUDA
  waits stay on the CUDA driver, as SlangPy does.

## ⭐ DECISIVE SPEC (comment 5798248018) — implement jhelferty's own API; add nothing
"Please implement this. **Do not invent another API.**" He rejected the fixer's `IExternalMemoryQueue`
sketch (see [[rhi-787-review-history.md]]) and specified his own. **Implement verbatim.** Explicit
prohibitions: NO `IExternalMemoryQueue`, NO `SubmitDesc` extension, NO new queue types, NO shared-fence CUDA
import.
- **API — append to `ICommandEncoder` TAIL, keep existing GUID** (`0x8ee39d55…`, spans 2767..2964, last
  virtual `getNativeHandle` @2963 — append after it, before `};`, verified @main 82c03494):
  `handOffShared(uint32_t resourceCount, IResource* const* resources, ICommandQueue* destQueue)` and
  `takeOverShared(uint32_t resourceCount, IResource* const* resources, ICommandQueue* srcQueue)`.
  `ICommandEncoder` is **rhi-PRODUCED, not client-implementable** (`IDevice::createCommandEncoder` returns
  it; base `CommandEncoder`, `DebugCommandEncoder`, 7 backend `CommandEncoderImpl`, all in src/) ⇒
  tail-append keeping the GUID is ABI-safe and `pr: non-breaking`; document the "not client-implementable"
  contract in the interface doc and flag in the PR body.
- **Semantics:** record on THIS encoder only; NO submit/wait/record on dest/src queue; NO host-wait inside.
  Order: producer `handOffShared`+submit → existing `waitOnHost()` → next owner `takeOverShared` before
  first use. Resources = `Shared`, same device as this encoder's queue; unwrap debug wrappers before
  identity checks.
- **Backends:** Vulkan — handOff = QFOT release thisFamily→EXTERNAL, takeOver = acquire EXTERNAL→thisFamily.
  D3D12/CUDA/others = **no-op** (CUDA queue still passed so Vulkan can target EXTERNAL).
- **Architecture:** slang-rhi is **record-then-replay** — `ICommandEncoder` ops append POD commands to a
  host `CommandList` replayed per-backend at `finish()`, so the QFOT lives in the Vulkan `CommandRecorder`
  via a new `SLANG_RHI_COMMANDS` X-macro command; base `CommandEncoder` gets one shared impl, all 7
  recorders get a `cmd*` handler (Vulkan real, 6 no-op) — why the diff touches every backend.
- **Debug layer:** process-global table keyed by `getSharedHandle`'s `NativeHandle` (layer doesn't wrap
  buffers/textures); states Unowned → Owned(Q) on first use/initData → HandedOff(Q,R) → Owned(R). Severity
  (post maintainer ruling): API-misuse = error on every backend; use-of-merely-other-owned / can't-tell =
  warning. Recycled-handle hazard closed by reset-at-creation + resolving shared-ness fresh via the
  resource's own flag (not the cached pointer) — see history.

## Current PR #881 status — head `360bd42`, per-test re-verified CLEAN (2026-09-24)
Fixer pushed the full agreed (a)/(b)/(c) scope on `360bd426…`; codex CODE_REVIEW+OUTPUT_REVIEW approved; PR
body refreshed. I independently re-verified (clang Debug job `107527665868`, msvc Release `107527665488`):
- ✅ **GPU-green** — CI 22/22 success; both self-hosted GPU jobs success.
- ✅ **#4 both round-trips** — `buffer-shared-cuda.vulkan PASSED` + `texture-shared-cuda.vulkan PASSED` on
  BOTH clang Debug and msvc Release (genuinely ran, not skipped).
- ✅ **crash-free** — `ray-tracing-triangle-intersection.vulkan PASSED (0.02s)`; 0
  FATAL/`[Error][Layer]`/SIGABRT/CRASHED.
- ✅ **flood-gone** — `grep -c 'does not currently own'` = **0** (was 16,361 on `6045b8c`); the biggest
  contributors (`cmd-copy-texture-to-buffer-full.wgpu`, `-rowalignment.wgpu`, `cmd-copy-buffer-to-texture-full.cuda`)
  all PASSED this run, so not a skip artifact. The `isSharedResource` gate suppressed only false positives.
- Codex folded two refinements: `resetForNewSharedResource` drops the stale tie unconditionally; the true
  residual is a `create*FromNativeHandle` Shared wrapper on a no-export backend (import-to-import overwrite)
  — documented, not claimed irreducible.

**GATE STATE.** Gate-1 (ready-quality) = my per-test re-verify ✅ + slang-reviewer re-confirm on `360bd42`
(IN FLIGHT, thread `gh-pr-slang-rhi-881-review`, dispatched with: fold into (a)/(b)/(c), confirm origin vs
`4b2ba21`, root-cause WITH the fixer, do NOT sign off clean, report up). Gate-2 (draft→ready) = the operator
drafts-only guardrail, which lifts ONLY on an explicit maintainer request; jhelferty requested #881's
*creation* but has NOT reviewed this head. **My recommendation to the operator: hold as draft, notify
jhelferty it's ready for his review, flip only on his explicit go — I do NOT override the guardrail on my
own authority** (3rd time holding this line; 2 prior breaches recorded). Ready-flip is mine to call once
both gates clear; the fixer does not self-flip. #12194 no-force-push. #812 untouched/held.

## Flip authorization (pre-loaded)
The drafts-only gate IS liftable here — jhelferty's explicit "open a PR" request is the documented
exception (cf. jkwak / slangpy#1083). `gh pr ready` is operator-gated, so the fixer brings the flip to me
and I confirm only on the maintainer's explicit "land now." Flip stays HELD until he resolves review and
authorizes.

## Open items
1. **jhelferty to review head `360bd42`** and give the explicit land-now that lifts the drafts-only gate; he
   may also still weigh #881 (explicit API) vs #812 (register-all) as the shape to keep.
2. **Human draft→ready flip** is the only gate to merge; the bot will not do it.
3. **After the fix lands: file the dedicated-allocation asymmetry** — `cuda-buffer.cpp:129` sets
   `CUDA_EXTERNAL_MEMORY_DEDICATED` unconditionally while `cuda-texture.cpp:545` threads `isDedicated`.
   ⚠️ Evidence tier: an NVIDIA-staff forum post, NOT docs — state it as such, don't promote to a spec
   requirement. Not firing today.

## Durable lessons
- **The doctest "0 skipped" trap (fired twice here):** `msvc Debug` reported `1265 passed | 0 skipped`
  while the four interop cases inside it were `SKIPPED (CUDA not available)` — identical tally to the GPU
  job that really ran them. **"N/N green" / "0 skipped" NEVER establishes a test executed; only the
  per-test `PASSED` line does.** (Same trap: [[project_12307_reflection_json_scope_representation.md]].)
- **A gate is indexed by WHO SET IT, not by whether its stated condition is now met.** After GPU-green +
  APPROVE_WITH_NITS I told the fixer to flip #812 ready; it **refused, correctly**, citing the operator-set
  drafts-only gate (not orchestrator-overridable). A coworker refusing my instruction on a recorded gate is
  the system working. (2nd instance; 1st: slang#11440.)
- **Correctness asymmetry** (steered on): resolve uncertainty toward acquiring / keeping a fallback, never
  toward skipping — skipping a resource that IS accessed reintroduces the bug; a redundant barrier is only
  cost. This is why register-all beats precise.
- **Instrument discipline:** `| head -40` truncated a grep so a cited test line looked fabricated (grep the
  whole file before doubting). `gh api .../logs` returns **0 bytes** without `--allow-escape-sequences` (an
  empty file greps as "tests absent"); re-fetch with the flag + strip `\x1b[...m`. The recurring trap is
  reading the *GitHub-hosted* msvc Debug job (no CUDA → SKIPPED) instead of the *self-hosted* GPU jobs (msvc
  Release + clang Debug) that actually run interop — always re-check the self-hosted jobs by per-test
  `PASSED` line before believing "GPU tests not executed."
- **Verify, don't relay — in both directions.** Caught a fixer "blocker: none" that was stale (6 clang
  builds failing) by checking CI myself; and once passed a reviewer finding ("one of 4× omits the Shared
  check") through as an actionable fix without confirming defect-vs-correct-by-design — doing what I said
  would have introduced a regression (the fixer's verify-before-acting caught it).
- **Standing caveat:** #787 is an **intermittent** release-only failure ⇒ one green run proves the case
  passed once under the failing config, NOT that the race is eliminated. Durable signal = no recurrence on
  `windows-release-gpu-rhi` across later PRs. Infra: slang-rhi's `ci.yml` has **no draft gate** ⇒ drafts
  auto-run real CI on self-hosted GPU runners, unlike the slang repo's manual-dispatch rule.
