---
type: project
title: slang-rhi#787 / PR #881 — review-round history (condensed)
description: Chronological, condensed record of the #881 explicit-API review rounds (codex OUTPUT_REVIEW + maintainer jhelferty-nv + slang-reviewer), the superseded #812 forks, and the 09-24→10-07 ready-flip / re-chase log, kept out of the live parent [[rhi-787-cuda-vulkan-shared-sync.md]] so it stays under budget. Settled history — the current head/gates live in the parent.
tags: [slang-rhi, synchronization, cuda, vulkan, interop, history]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 / PR #881 — review-round history (condensed)

Settled history split out of the live parent [[rhi-787-cuda-vulkan-shared-sync.md]] during okf-synthesis
(2026-09-25). The **current** head, gates, and open items live in the parent; this file preserves how the
design converged and the review rounds resolved. Head progression on #881:
`03587b8 → 4b2ba21 → 99263c1 → eaa551f → 6045b8c → 360bd42 → 775f522`.

## Superseded #812 (register-all internal design) — the other alternative, held
#812 was the first fix attempt. Its **original create-time approach** (release graphics→EXTERNAL at
`createTexture`/`createBuffer` gated on `Shared && initData`, D3D12 shared texture → `RESOURCE_STATE_COMMON`)
was one-shot, never acquired back, VK/D3D12-asymmetric — exactly what jhelferty rejected. Reverted to clean
baseline `d4d53a7`, then reworked to a **register-all** design: an internal shared-resource registry on
`DeviceImpl` (live shared Buffer/TextureImpl + `{OwnedByProducer, ReleasedToExternal}`); release/acquire ride
the app's existing `submit`/`waitOnHost`/shared-fence calls (satisfies "no new entry points"). Verified
GPU-CI-green at HEAD `6e040d1` (24/24), draft, **held untouched** as the alternative to #881.

**Fork 1 — precise vs register-all (resolved: register-all).** jhelferty requested precise acquire
granularity (acquire only submitted CBs' `m_trackedObjects`). But the tracked-set enumeration keeps growing
under probing (device-address `vk-buffer.cpp:248` → bindless `vk-bindless-descriptor-set.cpp:161-213` →
`getNativeHandle` raw `VkBuffer`) — precise correctness is an exhaustiveness bet that keeps losing. Per the
**asymmetric-failure rule** (acquiring too little reintroduces the bug in reverse; too much is only a
redundant barrier, near-free via early-out), register-all is total by construction with zero dependency on
formation-path completeness. This all became moot once jhelferty chose the explicit API (below).

**Fork 2 — fence-signal release trigger (deferred).** Policy listed 3 release triggers (submit / waitOnHost
/ fence signal). Fixer shipped waitOnHost(release)+submit(acquire-back), both tested, and removed the
fence-signal trigger: as first written it ran release as a separate submission AFTER the fence-signalling
submit, so on one FIFO queue the fence signals before the release barrier executes (codex-confirmed ordering
bug). Correct form folds the release barrier into the SAME `vkQueueSubmit` — feasible but risky and
untested. Endorsed: land waitOnHost-only now, fence-signal as a tested follow-up.

## The explicit-API sketch → REJECTED in favour of jhelferty's own API
jhelferty asked for a separate alternative PR making the External transition an explicit public-API part,
sketch-first. Fixer designed **`IExternalMemoryQueue : ISlangUnknown`** (own GUID, via
`ICommandQueue::queryInterface`; batched `releaseToExternal`/`acquireFromExternal`). ABI-checked and posted
for confirmation (issuecomment-5795943347). Its strategic edge (§5a): explicit-only **dissolves the
completeness burden** — the app names exactly which resources to release/acquire, so RHI never infers and the
untracked-formation problem vanishes.

**DECISIVE (comment 5798248018): jhelferty rejected `IExternalMemoryQueue` and specified their own API** —
`handOffShared`/`takeOverShared` appended to the `ICommandEncoder` tail. "Do not invent another API." That
mandated spec is the current design, recorded in the parent.

## #881 review rounds (codex OUTPUT_REVIEW + maintainer + slang-reviewer)
The gate is codex OUTPUT_REVIEW (a PreToolUse hook mechanically blocks `gh pr create` until approve);
escalation past 3 rounds is to the orchestrator BY DESIGN (to adjudicate, not bypass). Key resolutions, in
order:

- **Round-4 3-must-fix escalation (msg 104→105):** #3 tracker atomicity RESOLVED in fixer's favour (debug
  layer TRACKS not GATES; reject-and-not-apply desyncs the tracker → keep apply-and-warn); #1 setBinding
  best-effort + #2 end-of-encoding state-restoration routed to the maintainer (deviations from their explicit
  spec). Owned that codex's #2 pushback had merit and my prior directive under-weighted it. Mechanism:
  ungated ruling-request COMMENT to jhelferty (hook blocks only `gh pr create`, not comments); do NOT bypass
  the hook.
- **Maintainer ruled (comment 5801238026), all 3 resolved:** #1 setBinding **DROPPED** (it genuinely
  false-positives — bind is record-time, use is submit-time; per "thread it or don't cover it"); use-point
  checks stay and only ever false-negative (correct direction for a debug aid). #2 VK state-restoration
  **MANDATED** — QFOT release deferred to end-of-encoding, emitted after default-state restoration as the
  last barrier. #3 apply-and-warn **CONFIRMED**, severity refined: API-misuse = error on every backend;
  use-of-merely-other-owned/can't-tell = warning (supersedes the original error-if-Vulkan/warning-if-D3D12
  split; removed dead `producerType`).
- **Gate non-convergence (msg 110→111):** codex thread expired → re-ran fresh, no prior context → 8 must-fixes
  (memoryless reviewer regenerates unbounded coverage demands). Root cause = **context starvation, not a
  wrong gate**; directed one context-fed round WITH the rulings + adjudications in the prompt. It converged
  (msg 112→113), accepting all deprioritized items and surfacing a REAL bug (`getSharedHandleOf` called
  `getSharedHandle()` on every non-Shared resource → spurious export errors; fixed by gating on Shared
  first). Stop-condition: concrete new fixables → continue; regression to the deprioritized set → STOP +
  operator.
- **Draft PR #881 opened, clang-only build failures (msg 114→115):** VERIFIED (not relayed) the fixer's
  "blocker: none" was stale — 6 clang builds failed, identical
  `debug-helper-functions.h:110: error: declaration requires an exit-time destructor
  [-Werror,-Wexit-time-destructors]` (the process-global debug table = file-scope static w/ non-trivial
  dtor; gcc/msvc/local-Debug don't enforce it). This is the table-lifecycle concern flagged at msg 99, now at
  compile time. Fixed on `4b2ba21`: leaked function-local static (`static auto* p = new Table(); return *p;`),
  reproduced locally under the clang flags with a negative control. Full GPU CI green — READY-FLIP
  PREREQUISITE met (per-test PASSED incl #4 Vulkan-acquire round-trip; verified the source, not just the
  PASSED line).
- **Maintainer review round, 4 inline comments (msg 122→123):** #1 warning→error when originating queue is
  Vulkan; #2 **reset-at-creation** for recycled handles (solves the msg-99 lifecycle hazard WITHOUT a
  destruction hook — the seam is the create* wrappers) → dropped the eviction known-limitation; #3
  equal-family guard QUESTION (verified correct @85b99b4: one side is always EXTERNAL 0xFFFFFFFE, guard never
  fires for external transfers); #4 setBinding via bind-time bit, validate at draw/dispatch.
- **Rework rounds 2/43/44 (msg 126→132):** #4 texture-gap was FALSE — `ITextureView::getTexture()` (verified
  @slang-rhi.h:1165) resolves view→texture→shared-handle, so Shared textures ARE trackable; buffers-only
  caveat dropped. Real bug fixed: `m_boundRootObject` non-owning raw ptr → use-after-free → `RefPtr<DebugShaderObject>`.
  CAP HELD on the pass-encoder-mock sprawl (thin active-root glue guarded 3 ways: GPU CI FAIL-on-Error happy
  path, RefPtr structurally prevents the hazard, object-level host tests). Harness fact: `testing.cpp`
  DebugCallback = FAIL on Error, log on Warning → GPU CI catches a false-positive ERROR but is blind to
  warnings and can't prove fires-on-misuse → the **host test is the real guard**. A bounded context-fed
  re-argument got codex to downgrade the pass-coverage item to an advisory gap; approved round 44, head
  `99263c1`. No operator needed.
- **slang-reviewer round-2:** APPROVE_WITH_NITS, 0 bugs, 3 gaps, none blocking. Decided (b) consolidated
  polish before flip (jhelferty actively reviewing). Pushed `eaa551f` (7 items). **My framing was WRONG on
  the "one of 4× queryInterface omits the Shared check"** — fixer corrected me: `retainSharedResource`
  correctly does NOT gate on shared-ness (retention must keep the resource alive for replay regardless);
  gating would have been the actual bug. Did the dedup without the spurious check. (My own "verify before
  relaying findings as fact" applied to me relaying the reviewer to the fixer; no harm, fixer didn't apply
  it.) Also decided: do NOT wire `create*FromNativeHandle` into the tracker (wraps an existing resource by
  OBJECT handle — neither a fresh alloc nor a shared-handle import; reset or tie would both be incorrect).
- **`eaa551f` blocked (msg 142→147): CI crash + REQUEST_CHANGES, pre-existing.** VERIFIED at source: clang
  Debug GPU job `107468073903` L22176 `testing.cpp(244): FATAL [Error][Layer]: a shared resource is used on a
  queue that does not currently own it` → `test-ray-tracing.cpp(125) CRASHED SIGABRT`, on a ray-tracing test
  with NO shared resources; msvc Release green (allocation-layout-dependent → recycled-address). Mechanism:
  `resolveKey()` hits the raw-ptr `m_resourceKeys` cache first with no re-validation; `resetForNewSharedResource`
  fires only on Shared-PRODUCER creation, so a non-Shared resource recycling a freed shared address inherits
  the stale entry (process-global under `-use-test-server`). Reviewer round-3 REQUEST_CHANGES: (a) same-encoder
  handOff+takeOver inverts barrier order; (b) base path no operand validation. **Design lock (msg 146→147):**
  (c) ROOT-FIX — `getSharedHandle` is cached per-resource (`vk-buffer.cpp:196`/`vk-texture.cpp:66`), so STOP
  pointer-caching producers in `m_resourceKeys`; resolve fresh via `getSharedHandleOf` each time (`m_resourceKeys`
  keeps only imported ties). (a) cancel BOTH same-encoder ops (net no-op) + a warning diagnostic. (b) base-path
  graceful `SLANG_E_INVALID_ARG` on out-of-contract operands.

## 360bd42 → ready → 775f522, and the re-chase log (09-24 → 10-07)
Folded in from the parent by okf-synthesis 2026-10-09.
- **09-24, `360bd42` per-test clean** (clang Debug `107527665868`, msvc Release `107527665488`): CI 22/22, both
  round-trips PASSED on both jobs, ray-tracing PASSED, `does not currently own` = 0 (16,361 on `6045b8c`; its top
  contributors all PASSED, so not a skip artifact). Codex folded `resetForNewSharedResource` dropping the stale tie
  unconditionally; the residual (a `create*FromNativeHandle` Shared wrapper on a no-export backend) is documented.
  I held the operator's drafts-only gate (3rd time) and recommended notifying jhelferty rather than flipping.
- **09-28 the maintainer flipped it.** jhelferty-nv went `ready_for_review` at 19:06:51Z, seconds after "I accept your
  proposal" (r4126017892, same-encoder fallback), requested skallweitNV, and closed #812 at 19:37Z. We never flipped.
  Their inline r4124277593 (support table + portability note) and r4124507698 (same-encoder reversal → ERROR) were
  addressed in `eb5229dfe`, `5f237d8f6`, `775f52231` (debug layer, tests, docs/api.md only).
- **09-30** reviewer APPROVE_WITH_NITS at 09:00, then **corrected at 09:01 to REQUEST_CHANGES on R4/R5** (session
  `sess-1785935169470-plpq2f`; its 6taxcp session retracted the APPROVE). A/C runs on 775f522 were lost in the 09-28
  outage; I declined a bot re-run (small source-verified delta, human review under way).
- **Re-chases:** 10-02 (`rechase-rhi-881-r4r5-8fb7`), 10-03 (`…-381b`, found #812 already closed, so that terminal step
  was dropped), 10-07 (`…-5bfe`: jhelferty silent 7 d but reassigned review to skallweitNV on 10-06; the operator was
  asked 1/2/3). Each run told the operator on the dashboard and re-armed; the current timer is in the parent.

## Instrument / method lessons that recurred here (folded into the parent's Durable lessons)
- The **self-hosted-vs-GitHub-hosted** conflation recurred repeatedly: coworkers read the *GitHub-hosted*
  msvc Debug job (CUDA not supported → all SKIPPED) and concluded "GPU tests not executed", when the
  *self-hosted* GPU jobs (msvc Release + clang Debug on `nvrgfx-kernelvm-bridge`) actually ran interop.
  Always re-check the self-hosted jobs by per-test `PASSED` line.
- **Don't infer a diagnostic's presence/absence from crash-location when severity is backend-dependent**
  (Vulkan=ERROR / wgpu-cuda=WARNING). The "warnings new to the rework" inference was WRONG — 2,157
  `does not currently own` warnings already fired on `eaa551f` before its crash; verified via
  `compare eaa551f...6045b8c` (debug-device.cpp byte-identical) that the flood was pre-existing. Grep the
  pre-fix run's own log; a "warnings gone" summary must be checked with `grep -c` on the Debug job (Release
  is Debug-layer-silent and always looks clean).
