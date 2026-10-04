---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: Real missing cross-API ownership bug (not tolerance). jhelferty-nv mandated their own explicit API (handOffShared/takeOverShared on ICommandEncoder), implemented in PR #881 — jhelferty flipped it READY 2026-09-28; final head 775f522 GPU-CI-green, per-test re-verified; NOT merge-ready: reviewer REQUEST_CHANGES on R4/R5 pending jhelferty's answer to 5907630393, plus skallweitNV review. #812 (register-all alt) closed by jhelferty 2026-09-28. Review-round history split to [[rhi-787-review-history.md]].
tags: [slang-rhi, synchronization, cuda, vulkan, interop, live-chain]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 — CUDA↔Vulkan shared-texture missing synchronization

**State (2026-09-30): LIVE, parked on human review. PR #881 is NON-DRAFT — jhelferty flipped it ready themself on 2026-09-28 after accepting the same-encoder proposal, and requested review from skallweitNV. Final head `775f522` is GPU-CI-green and per-test re-verified by me, but **NOT merge-ready**: reviewer REQUEST_CHANGES on R4/R5 until jhelferty answers scope question 5907630393 (see the 2026-09-30 CORRECTION at the end). Re-chase task `rhi-881-review-rechase-5bfe` fires 2026-10-07T09:00Z (10-03 run: both still silent) and checks both 5907630393 and skallweitNV's review.**
#812 (register-all internal design, HEAD `6e040d1`) was CLOSED by jhelferty-nv 2026-09-28 — no longer an open question.
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
"Please implement this. **Do not invent another API.**" They rejected the fixer's `IExternalMemoryQueue`
sketch (see [[rhi-787-review-history.md]]) and specified their own. **Implement verbatim.** Explicit
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
jhelferty it's ready for their review, flip only on their explicit go — I do NOT override the guardrail on my
own authority** (3rd time holding this line; 2 prior breaches recorded). Ready-flip is mine to call once
both gates clear; the fixer does not self-flip. #12194 no-force-push. #812 untouched/held.

## Flip authorization (pre-loaded)
The drafts-only gate IS liftable here — jhelferty's explicit "open a PR" request is the documented
exception (cf. jkwak / slangpy#1083). `gh pr ready` is operator-gated, so the fixer brings the flip to me
and I confirm only on the maintainer's explicit "land now." Flip stays HELD until they resolve review and
authorize.

## Open items
1. **jhelferty to review head `360bd42`** and give the explicit land-now that lifts the drafts-only gate; they
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

## 2026-09-30 — #881 READY (flipped by jhelferty themself), final head `775f522`, parked on human review
- **Flip was the maintainer's, not ours:** timeline `ready_for_review` by **jhelferty-nv 2026-09-28T19:06:51Z**,
  seconds after they replied "I accept your proposal" (r4126017892, same-encoder fallback). They then requested
  review from **skallweitNV** ("Is this roughly what you were thinking of…?"). The drafts-only gate was lifted
  by the maintainer's own action; we never flipped. (Resolves the gate-2 question I held on 09-24.)
- jhelferty 09-28 inline comments r4124277593 (support-table 'x'→'yes' + portability note) and r4124507698
  (same-encoder reversal should be an ERROR) addressed in 3 commits `eb5229dfe`, `5f237d8f6`, `775f52231`
  (debug-layer + tests + docs/api.md only).
- **My per-test re-verify on 775f522** (clang Debug job 109042934512, msvc Release 109042934457): 28 success
  / 9 skipped / 0 fail; `buffer-shared-cuda.vulkan` + `texture-shared-cuda.vulkan` PASSED on both;
  `ray-tracing-triangle-intersection.vulkan` PASSED; `cmd-copy-texture-to-buffer-full.{vulkan,wgpu}` PASSED;
  `does not currently own`=0; FATAL/crash=0.
- Reviewer (09-30): APPROVE_WITH_NITS; A/C runs on 775f522 lost in the 09-28 outage (`reviewers_complete=false`).
  I declined a bot re-run: small source-verified delta, clean CI, and the PR is now in human maintainer review.
- **Open:** skallweitNV review; fate of alt draft #812 (jhelferty's call, ask at terminal). Re-chase task
  `rhi-881 review rechase` fires 2026-10-03T09:00Z. At merge/close → okf-synthesis condense this file.
- **CORRECTION 2026-09-30 09:01 — NOT merge-ready. Reviewer verdict is REQUEST_CHANGES on R4/R5 only**
  (supersedes its 09:00 APPROVE_WITH_NITS). R4 = AS/micromap build-input buffers aren't validated as uses (spec
  5798248018 line 31 says "AS/micromap ops on the buffer" are uses; only scratch buffers are checked). R5 = the
  same-device operand precondition (spec line 11) isn't validated. The PR body lists both as "Known partials".
  The scope question to jhelferty (PR comment 5907630393, 09-30 08:48) has no reply yet. **My miss:** I relayed
  "P1/P2 descoped" as settled without checking that the maintainer had agreed. A coworker's descope of a
  maintainer's requirement isn't a deferral until the maintainer agrees. Parked on TWO inputs: jhelferty on
  5907630393 + skallweitNV's review. The re-chase task now covers both.
- **2026-10-02 09:00 re-chase (`rechase-rhi-881-r4r5-8fb7`):** jhelferty still silent on 5907630393: no comment,
  reaction, review or inline reply since 09-30 08:48Z. Head is still `775f522`; skallweitNV and dshreiner-nv are
  requested, no reviews. The reviewer DID answer the re-sent request (msg 291 = its 787-thread seq 34) in
  session `sess-1785935169470-plpq2f` at 08:52Z: REQUEST_CHANGES R4/R5 only. Its 6taxcp session retracted the
  09:00 APPROVE at 09:01Z, so the verdicts agree. Operator told (dashboard msg 33). The `rhi-881-review-rechase-381b`
  timer (10-03 09:00Z) already covers both inputs; no new timer.
- **2026-10-03 09:00 re-chase (`rhi-881-review-rechase-381b`):** both inputs still silent. jhelferty has not
  replied to or reacted on 5907630393 (3 days). skallweitNV and dshreiner-nv are requested but have posted no
  reviews. skallweitNV was active in the repo 10-02 (opened #885-#889), just not on #881. Head is still `775f522`.
  **#812 was already CLOSED by jhelferty-nv 2026-09-28T19:37Z** (the same day they flipped #881 ready), so the
  "ask whether to close #812" terminal step is moot; drop it. Operator told (dashboard msg 11). Re-armed as
  `rhi-881-review-rechase-5bfe` for 10-07 09:00Z. If still silent then, ask the operator whether to ping
  out-of-band or post one GitHub reminder.

