---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: real missing cross-API ownership bug (not tolerance); maintainer rejected #812's create-time approach and gave a submit-path release/acquire ping-pong policy. #812 reworked to register-all (HEAD 6e040d1, GPU-CI-green, DRAFT/held). Two forks in front of jhelferty — precise-vs-register-all (recommend register-all) and fence-signal trigger (land waitOnHost now + follow-up) — plus a NEW parallel explicit-public-API sketch he requested. Flip authorized on his answer.
tags: [slang-rhi, synchronization, cuda, vulkan, interop, live-chain]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 — CUDA↔Vulkan shared-texture missing synchronization

**State (2026-09-18): LIVE, cleanly the maintainer's calls; no bot action pending except executing his
pick.** #812 has been reworked to a **register-all** design (HEAD **`6e040d1`**, DRAFT, GPU-CI-green
including the producer read-back) and is **held**. Two design forks are in front of jhelferty-nv on the
PR; separately he asked for a **parallel explicit-public-API sketch** (below). Re-opens on his webhook.
Canonical thread `gh-issue-shader-slang/slang-rhi-787`.

## The bug (triager verdict, comment 5049387926)
`texture-shared-cuda.vulkan` release-only flake is a **real missing cross-API sync bug, NOT a
numeric-tolerance flake.** The shader is a bit-exact float4 copy of exactly-representable {0.0,0.5,1.0} in
RGBA32Float ⇒ delta must be exactly 0.0 when synced. The Vulkan→CUDA hand-off did the transfer with **no
external-semaphore wait** and **no `VK_QUEUE_FAMILY_EXTERNAL` ownership transfer**, relying only on host
`waitOnHost()`; shared images stay `VK_SHARING_MODE_EXCLUSIVE` on the graphics queue, so CUDA reads an
image Vulkan still owns. The sibling surface path (`cuda-surface.cpp`) already had the correct machinery.
**D3D12 already works.** The triager's earlier draft #791 (which *widened tolerance*) MASKED the bug ⇒
closed; #812 (create-time approach) was the first fix attempt.

## ⭐ REVISED POLICY (comment 5704482839) — supersedes the earlier scope decision AND #812's approach
jhelferty **confirmed** the diagnosis and **rejected #812's create-time release** (gated on
`Shared`+`initData`: "makes Vulkan and D3D12 mean different things and only covers a one-shot initialized
create"). He asked @nv-slang-bot to open a PR implementing this policy, **existing API only, no new entry
points:**
- **Same contract on VK + D3D12:** one allocation; producer keeps it after `create*`; another API accesses
  only after the producer's `waitOnHost()` OR after waiting on a shared `IFence` the producer signaled;
  producer may reuse after the matching wait — **ping-pong REQUIRED.**
- **Vulkan:** release to `VK_QUEUE_FAMILY_EXTERNAL` and **acquire back INSIDE submit / `waitOnHost` / fence
  signal — NOT at create time** (reuse the per-frame pattern in `src/cuda/cuda-surface.cpp:1047-1069`).
- **D3D12:** NO behavior change ⇒ **revert #812's create-time COMMON transition.**
- **Document** next to the `Shared` flags / `FenceDesc::isShared` in `include/slang-rhi.h`.
- **Tests:** fix the impl, DO NOT change `texture-shared-cuda`; EXTEND `buffer-shared-cuda` to a real
  ping-pong (producer reads CUDA's writes back after waiting; drop the producer-readback hack).
- **OUT OF SCOPE:** `createFenceFromSharedHandle` for CUDA — CUDA `IFence` is a host counter; GPU-side CUDA
  waits stay on the CUDA driver, as SlangPy does.

## Implementation — register-all is committed & green
Load-bearing design (`/workspace/agent/reports/rhi-787-pingpong-plan.md`): an **internal shared-resource
registry on `DeviceImpl`** (private list of live shared Buffer/TextureImpl + `{OwnedByProducer,
ReleasedToExternal}`). Release/acquire ride the app's existing `submit`/`waitOnHost`/shared-fence calls —
this is what satisfies "no new entry points". Release producer→EXTERNAL before `vkQueueWaitIdle` in
`waitOnHost`; acquire-back EXTERNAL→producer prepended to the producer's next submit.

✅ **REWORK VERIFIED GREEN (2026-09-16), HEAD `6e040d1`, draft, held:** 24/24 check-runs + combined status
success. Per-test (NOT tally) all four interop cases `PASSED` in msvc Release (job 104995889524) and clang
Debug (104995889626); negative control holds — msvc Debug (104995889491) `SKIPPED (CUDA not available)`.
The round-trip #812 had declared UNSUPPORTED now works and is pinned: `test-buffer-shared.cpp:75`
`compareComputeResult(srcDevice, srcBuffer, {1,2,3,4})` PASSED on GPU. **Risk #1 did NOT materialize:**
host-wait ordering + the acquire barrier's visibility masks suffice, **no semaphore** — exactly as
jhelferty said. ⭐ Steered the fixer off the semaphore path pre-emptively: if the ping-pong readback ever
fails on GPU CI, the fix is the **memory dependency in the acquire barrier (availability/visibility
masks on the QFOT)**, NOT a semaphore, which the maintainer put explicitly out of scope.

## Fork 1 — precise vs register-all (recommend KEEP register-all; jhelferty's call)
jhelferty later requested **precise acquire granularity** (review r4041473666): `submit()` acquires only
the Shared resources in the submitted CBs' `m_trackedObjects`; `readBuffer()` only that buffer;
`waitOnHost()` unchanged. His design Q: can a Shared resource be used by a submit WITHOUT landing in
`m_trackedObjects`? **Answer: yes, and the enumeration keeps growing under probing** — device-address
(`vk-buffer.cpp:248`, bare uint64, untracked) → bindless (`vk-bindless-descriptor-set.cpp:161-213`, no
RefPtr, no CB touch) → `getNativeHandle()` raw `VkBuffer` (`vk-buffer.cpp:192`) run via `ExecuteCallback`
(`vk-command.cpp:1624`). The enumeration grew 2→3→(3+native-handle) under two probes.
⭐⭐ **REFRAME (load-bearing): the committed, GPU-green `6e040d1` IS register-all** — registers every Shared
resource, acquires all `ReleasedToExternal` at submit, **total by construction, zero dependency on
formation-path completeness.** Precise mode's correctness is an *exhaustiveness bet that keeps losing*.
Per the **asymmetric-failure rule** — acquiring too little reintroduces THIS bug in reverse (producer
touches CUDA-owned memory); acquiring too much is only a redundant barrier, and register-all's coarseness
is near-free (early-out = zero cost when nothing is released, the common case). **Recommendation: keep
register-all.** ⭐ This does NOT depend on the third path being real — register-all needs no completeness
proof at all. The in-flight *precise* build (a 3-trigger fallback, uncommitted, gap = the native-handle
path) is HELD. **This is jhelferty's explicit request, so I do NOT preempt it** — routed to him with the
recommendation; if he picks precise → add the native-handle trigger + a codex gate with exhaustiveness as
the explicit target.

## Fork 2 — fence-signal release trigger DEFERRED (land waitOnHost now + tested follow-up)
The policy listed 3 release triggers ("inside submit / waitOnHost / fence signal"). The fixer implemented
**waitOnHost (release) + submit (acquire-back)** — both tested — and **removed the fence-signal trigger**:
as first written it ran the release as a separate submission AFTER the user submit that signals the shared
fence, so on the same FIFO queue the fence signals before the release barrier executes ⇒ an external
waiter could see a still-Vulkan-owned resource (codex-confirmed ordering bug). Doing it correctly folds
the release barrier into the SAME `vkQueueSubmit` that signals the fence — feasible but risky (mixes an
`m_deviceQueue` CB into the user submit lifecycle) and **not exercised by any current test**, so
unvalidatable even in GPU CI. **Fixer recommends + I endorse: land waitOnHost-only now; fence-signal as a
tested follow-up.** Do NOT ship the risky fold-into-signal version speculatively. Carried up to jhelferty
in the PR body as an explicit "deviation from your 3-trigger policy" open question + @mention.

## 🔀 NEW parallel track (comment 5782267774) — explicit-public-API alternative, SKETCH-FIRST
jhelferty: *"create a separate alternative PR that makes the transition to External an explicit part of
the public API. Propose and sketch out an API for me to confirm before creating the PR."*
- **SEPARATE / ALTERNATIVE track — #812 is untouched** (do NOT un-hold or edit it). Deliverable is an API
  **SKETCH for confirmation, NOT a PR** — no branch/draft until he confirms.
- ⚠️ **NEW public API ⇒ strict `include/` ABI rules** (departure from #812's "no new entry points"): per
  slang CLAUDE.md — append-only enums; never reorder/insert/remove virtuals in existing COM vtables;
  prefer a NEW derived/versioned interface with its own UUID over extending in place; keep existing UUIDs.
  `include/slang-rhi.h` is public COM-style surface.
- Sketch must compose with existing `Shared` / `getSharedHandle` / `FenceDesc::isShared`; express the
  release-to-External / acquire-back ping-pong contract explicitly; include a usage example (buffer-shared
  ping-pong via the API) + an ABI-safety rationale; and state how internal register-all relates (consumer
  of this primitive, or fully replaced).
- **Process:** fixer sketches → codex design pass (ABI-safety + minimality) → report to me (fast
  sanity-check) → post to jhelferty for confirmation. Routed to slang-fixer (owns context/worktree).

### ✅ SKETCH ABI-CHECKED + APPROVED to post (2026-09-23, doc rhi-787-explicit-api-sketch.md)
Design: new **`IExternalMemoryQueue : ISlangUnknown`** (own `SLANG_COM_INTERFACE` GUID), obtained via
`ICommandQueue::queryInterface` (null/`SLANG_E_NO_INTERFACE` on non-Vulkan; debug-layer queue forwards QI —
correctly flagged). Batched `releaseToExternal`/`acquireFromExternal(IResource* const* , uint32_t)` — mix
buffer+texture ok (IResource base), all-or-nothing validation, one submission per hand-off, **synchronous
(submit+wait)**. Reuses `Shared`/`getSharedHandle`/`FenceDesc`; no enum/struct/vtable touched → `pr: non-breaking`.
**I VERIFIED all load-bearing claims at main `82c03494`:** ICommandQueue:3028 derives ISlangUnknown + declares
no own queryInterface (mechanism touches no vtable); IResource:727 is IBuffer/ITexture base; ICommandBufferD3D12:2967
derives ICommandBuffer (the removed bad-template precedent); SubmitDesc:3011-26 has no version field (Approach C
rightly rejected). Doc's only line cite (IResource:727) is correct. ⚠️Fixer's *chat* line refs drifted (said
2828/2991, real 3028/2967) — doesn't affect the doc.
⭐**Strategic point the doc makes (§5a) — highlight for jhelferty's comparison:** explicit-only (Approach a)
**dissolves the completeness burden** that drove the register-all-vs-precise debate — with the app naming exactly
which resources to release/acquire, RHI never infers, so the device-address/bindless untracked-formation problem
vanishes (contract must still *document* that touching an externally-owned resource is invalid). That's a genuine
architectural edge of the explicit API, directly relevant to his choice.
**4 open Qs correctly left to him:** fence variant in v1 (MUST decide pre-ship — can't append to a shipped COM
interface; else a later new-GUID `IExternalMemoryQueueFenced`); explicit-only (a) vs both-layers (b); interface
name; queue- vs device-level. **Approved to post to jhelferty as a proposal awaiting his confirmation. No PR yet.**

**POSTED (2026-09-23, issuecomment-5795943347)** — §5 strengthened per my note (correct-by-construction framing:
explicit API removes RHI's inference so there's no completeness set to keep whole; honest counterweight kept —
explicit-only moves the "don't touch an externally-owned resource" obligation onto the app, doc-enforced). Design
task CLOSED on fixer's side. **Chain now waits on jhelferty's decision** across BOTH tracks: (#812 forks) precise
-vs-register-all + fence-signal trigger, AND (new) confirm/refine the explicit-API sketch's 4 open Qs. His pick
opens the next work (a PR only if/when he chooses a shape). #812 HEAD `6e040d1` untouched/held throughout.
Nothing pending on our side — re-opens on his webhook.

### ⭐ DECISIVE SPEC (2026-09-23, comment 5798248018) — implement HIS API, IExternalMemoryQueue REJECTED
jhelferty: "Please implement this. **Do not invent another API.**" He rejected the fixer's `IExternalMemoryQueue`
and specified his own. **Implement verbatim; add nothing.** Explicit prohibitions: NO `IExternalMemoryQueue`, NO
`SubmitDesc` extension, NO new queue types, NO shared-fence CUDA import.
- **API — append to `ICommandEncoder` TAIL, keep existing GUID:**
  `handOffShared(uint32_t resourceCount, IResource* const* resources, ICommandQueue* destQueue)` and
  `takeOverShared(uint32_t resourceCount, IResource* const* resources, ICommandQueue* srcQueue)`.
- **ABI grounded (I verified @main 82c03494):** `ICommandEncoder : ISlangUnknown` (2767), GUID at 2769, spans
  2767..2964, last virtual = `getNativeHandle` (2963) ⇒ append the two after it, before `};`. It's **rhi-PRODUCED
  not client-implemented** (`IDevice::createCommandEncoder` returns it) ⇒ tail-append keeping GUID is SAFE (the
  "prefer new interface" caution applies to client-implementable interfaces; this isn't one). No escalation needed;
  fixer confirms no client impl + documents the rationale.
- **Semantics:** record on THIS encoder only; NO submit/wait/record on dest/src queue; NO host-wait inside. Order:
  producer `handOffShared`+submit → existing `waitOnHost()` → next owner `takeOverShared` before first use. Resources
  = `Shared`, same device as this encoder's queue; other owner = `ICommandQueue*` (CUDA device's graphics queue in
  tests); **unwrap debug wrappers before identity checks.**
- **Backends:** Vulkan — handOff = QFOT release thisFamily→`VK_QUEUE_FAMILY_EXTERNAL`, takeOver = acquire
  EXTERNAL→thisFamily. D3D12/CUDA/others = **no-op** (CUDA queue still passed so Vulkan can target EXTERNAL).
- **Native ownership:** Vulkan exclusive; **unowned at create; first use (incl `initData`) acquires originator
  graphics queue**; `getSharedHandle`/`create*FromSharedHandle` do NOT transfer; CUDA import maps memory only.
- **Debug layer:** debug-only table keyed by `getSharedHandle`'s `NativeHandle`, ties export+import; **do NOT AddRef
  originator on import** (no public lifetime change); shared table across the two `DebugDevice`s. States: Unowned →
  Owned(Q) on first use/initData → HandedOff(Q,R) on handOff → Owned(R) on takeOver. USE (illegal unless Owned(this
  queue)): encoder copy/clear/state, AS/micromap ops, `setBinding` of resource/view, `readBuffer`/`readTexture`/
  `mapBuffer`. NOT a use: `getSharedHandle`, import, `getDesc`, `getNativeHandle`, `getDeviceAddress` alone. Severity:
  **error if producer Vulkan, warning if D3D12**, warning if untied/unknown. Invalid args = error; batch all-or-nothing.
- **Tests:** update texture-shared-cuda / buffer-shared-cuda → Vulkan/D3D12 `handOffShared` to CUDA queue →
  `waitOnHost()` → CUDA `takeOverShared` before use; reverse before any originator reuse.
- **Shape check (do NOT implement):** the same two methods must later express same-device graphics/compute transfers
  (dest/src = other queue; Vulkan QFOT between families; D3D12 split barriers). Signature is queue-parameterized so it
  generalizes — fixer confirms; if it can't express that, it's the wrong shape → flag to me.
- **PR:** NEW separate PR (the "alternative" he asked for), draft, Fixes #787, report_pr_created, 5-bullet. His
  explicit PR request lifts drafts-only ⇒ flip authorized once VERIFIED (GPU CI green + updated tests actually running,
  per-test PASSED lines); bring flip to me. **#812 untouched/held** as the other alternative. codex CODE_REVIEW before
  commit (debug-layer state machine + QFOT are where bugs hide). Dispatched to slang-fixer.

**Plan milestone (msg 98) — branch `feature/shared-handoff-787` @ `82c0349`, #812 untouched. Both preconditions ✅:**
(1) no external `ICommandEncoder` implementer (base `CommandEncoder`, `DebugCommandEncoder`, 7 backend
`CommandEncoderImpl`, all in src/) ⇒ tail-append is vtable-layout-only, going in PR ABI rationale; (2) shape-check
passes — target family derivable from `destQueue` (`getDevice()==this` → `m_queueFamilyIndex`, else EXTERNAL), so
signature expresses future same-device family→family transfer, no signature change. **Architectural fact:** slang-rhi
is **record-then-replay** — `ICommandEncoder` ops append POD commands to a host `CommandList` replayed per-backend at
`finish()`, so the QFOT lives in the Vulkan `CommandRecorder` via a new `SLANG_RHI_COMMANDS` X-macro command; base
`CommandEncoder` gets one shared impl, all 7 recorders get a `cmd*` handler (Vulkan real, 6 no-op) — why the diff
touches every backend. Maps exactly onto "record on this encoder only, no submit/wait." Debug layer = process-global
table keyed by `NativeHandle` (layer doesn't wrap buffers/textures).
⚠️**I flagged for codex (msg 99):** the process-global table's **entry lifecycle** — stale-handle reuse/collision
(evict on resource destroy; a recycled NativeHandle value must not inherit a dead resource's ownership state), leak
(unbounded growth), and multi-device cross-talk (NativeHandle uniqueness carries it). Plus: severity split (error if
producer Vulkan / warning if D3D12) lives in debug validation, INDEPENDENT of the D3D12 recorder no-op. Next report:
implemented+building; codex gate before commit.

**Implemented + Debug-compiles-clean (msg 102), branch @ `260418b`; still grinding codex OUTPUT_REVIEW (not yet a PR).**
codex caught + fixed: IResource-lacks-getSharedHandle (downcast to IBuffer/ITexture), debug-callback-under-mutex
deadlock (report outside lock — exactly the intricate debug layer), false "no vtable changes" PR-body claim,
change-history comment in a test; still implementing state-machine fidelity (Owned→HandedOff→Owned + batch
all-or-nothing). **Judgment call I endorsed (msg 103):** harden cheap+correct, DON'T gold-plate untestable-locally
(no-GPU) validation. **BUT — my refinement:** where impl is best-effort/partial vs his EXPLICIT spec, disclose
VISIBLY in PR body as "known limitation," not a code comment — same don't-silently-deviate pattern as point-3/fence.
Two to disclose: (1) `setBinding` validation is best-effort (queue unknown at bind time) — say what it can/can't check;
(2) Vulkan end-of-encoding state-restoration conflicts only if handOff shares an encoder with other state-tracked ops
(tests use a dedicated hand-off encoder). Pre-PR force-push OK (not under review yet; #12194 no-force-push kicks in
ONCE it's a PR). Next: draft PR (Fixes #787, alt to #812) when OUTPUT_REVIEW approves → report_pr_created + CI →
slang-reviewer → 5-bullet. Ready-flip mine after GPU CI green (per-test PASSED). #812 untouched/held.

### 🔴 BLOCKER adjudicated (2026-09-23, msg 104→105) — codex round-4 escalation; routed disputes to maintainer
Branch @ `bbdb5b3`, Debug-compiles-clean; codex OUTPUT_REVIEW (PreToolUse hook mechanically blocks `gh pr create`
until approve) held **3 must-fixes at round 4** (past the 3-round threshold ⇒ escalated to me BY DESIGN — adjudicating
is what the escalation is for, NOT a bypass). My disposition:
- **#3 tracker atomicity (apply-and-warn vs reject-and-not-apply): RESOLVED in fixer's favor.** Debug layer TRACKS,
  doesn't GATE — the real QFOT barrier records regardless, so reject-and-not-apply desyncs the tracker → spurious
  errors on later legit ops. codex over-extrapolated "batch all-or-nothing" (an argument-validation property, already
  satisfied at preflight) onto state-transition atomicity. Keep apply-and-warn. (Note to jhelferty since he specified
  the state machine: "implemented apply-and-warn b/c reject desyncs — flag if you disagree.")
- **#1 setBinding best-effort + #2 end-of-encoding state-restoration: MAINTAINER's call** (deviations from his
  EXPLICIT spec). ⚠️**I owned that codex's #2 pushback has merit + my #132 under-weighted it** — "only conflicts if
  handOff shares an encoder with other state-tracked ops" may hit jhelferty's OWN pattern ("handOff after last use"
  could share the encoder); tests dodge it via a dedicated encoder. Real gap, not untestable edge case, if his usage
  shares. (Didn't defend my prior directive just because I gave it.)
- **Mechanism (decouple ruling from the gate):** fixer posts an **ungated** ruling-request COMMENT to jhelferty (hook
  blocks only `gh pr create`, not comments) — 3 items + recommendations + the direct **#2 question: dedicated vs shared
  encoder in your intended usage?** Implement what he wants fixed (his mandate supersedes #132 for those); for blessed
  items, record his acceptance as the round-4 resolution + re-run codex (API-owner acceptance should downgrade must-fix).
  **Do NOT bypass the hook.** If it STILL mechanically blocks after maintainer ruling + implement/accept → fixer reports,
  I take the gate-vs-authority mechanics to the OPERATOR (gate config is theirs, not mine to waive). PR held until his ruling.

### ✅ MAINTAINER RULED — all 3 resolved (2026-09-23, comment 5801238026; fixer read-back 5801394400)
My adjudication held on every axis:
- **#1 setBinding — DROPPED (real fix, not a doc gap).** jhelferty asked if it false-positives; it DOES (bind is
  record-time, use is submit-time; a takeOver can precede the actual dispatch, so a handed-off resource may be
  legitimately bound). Per his "thread it or don't cover it," fixer removed `checkBinding`. Use-point checks
  (copy/clear/readBuffer/etc.) remain and only ever **false-negative** (miss some misuse via record-vs-submit order),
  never false-positive — the correct failure direction for a debug aid. Vindicates codex's "disclosure ≠ fix" on #1.
- **#2 VK state-restoration — MAINTAINER MANDATED THE FIX** (⇒ my routing was right; codex's pushback had merit,
  my #132 under-weighted it). Impl: QFOT release **deferred to end-of-encoding, emitted AFTER default-state
  restoration as the last barrier**; takeOver acquire stays inline. No longer a documented constraint.
- **#3 apply-and-warn — CONFIRMED (my call)** + severity REFINED: **API-misuse (incl. hand-off-already-handed-off)
  = error on EVERY backend; use-of-merely-other-owned / can't-tell = warning.** This SUPERSEDES the original spec's
  producer-backend split (error-if-Vulkan/warning-if-D3D12) — fixer replaced it, removed dead `producerType` field.
Fixer implementing all three, verification build running → re-run codex OUTPUT_REVIEW with his ruling as resolution →
update PR body (drop #1/#2 "known limitations", keep only the eviction limitation; #3 maintainer-confirmed) → commit →
draft PR (Fixes #787, report_pr_created, pr: label, ci.yml) → slang-reviewer → 5-bullet. Ready-flip mine after GPU CI
green (per-test PASSED). If hook still blocks post-ruling+fixes → fixer escalates, I take gate mechanics to operator.
#812 untouched/held.

### 🔴 GATE NON-CONVERGENCE (2026-09-23, msg 110→111) — codex fresh-session context starvation
After the rulings were implemented (`d7c6ef5`, compiles) the codex thread EXPIRED → OUTPUT_REVIEW re-ran **fresh, no
prior-round context** → 8 must-fixes, regenerating unbounded coverage demands (memoryless reviewer never converges).
Fixer invoked #134. **My call: NOT operator yet — one real fix undone + fixable root cause.** Adjudicated 5 residuals:
#4 round-trip test (Vulkan EXTERNAL→thisFamily acquire) = **ADD** (reversed fixer's defer — it's jhelferty's OWN test
spec "reverse before any originator reuse", covers the one otherwise-untested barrier, GPU-CI-verifiable); #5 first-use
"should warn" = **decline** (codex misread — severity of detected misuse, not every legit first-use); #1 texture
GENERAL→GENERAL = **keep documented** (correct for CUDA interop, cuda-surface.cpp precedent); #3 eviction = **documented**
(infeasible, no destruction hook); #2 exhaustive use-path validation = **HOLD per #132 + DISCLOSE** (untestable debug-aid;
unrun paths only false-POSITIVE — cf. dropped setBinding; PR body names validated-vs-not, hands "want exhaustive?" to
jhelferty at review). **Root cause = context starvation, not a wrong gate:** directed ONE more OUTPUT_REVIEW round WITH
full context in the prompt (3 rulings + my adjudications + #4-added + explicit "coverage/layout deprioritized as
untestable per orchestrator, disclosed" + reasoning). **Bounded: one context-fed round.** Converge → open draft PR.
STILL blocks despite full context → fixer reports+STOPS (NO bypass, NO more grinding), I take gate-vs-authority to the
OPERATOR (memoryless-gate defect + maintainer-ruled/hardened deliverable — their config to adjust, not mine to waive).
⚠️Memory file drifting/duplicating from many appends — due for okf-synthesis condense.

### 🔴 DRAFT PR #881 OPEN but CLANG BUILDS FAIL (2026-09-23, msg 114→115) — verified, corrected fixer's "blocker: none"
Draft **PR #881** ("Add explicit handOffShared/takeOverShared ownership-transfer API"), head `03587b8`, base main,
`Fixes #787`, references #812 as alternative, `report_pr_created` ✓, `pr: non-breaking`, jhelferty-nv assignee+reviewer
(CODEOWNERS automation — LEAVE it, he requested this impl). codex OUTPUT_REVIEW approved at head. **I VERIFIED the PR
state AND caught that the fixer's "blocker: none / builds re-running" was STALE** — head has **6 clang build FAILURES**
(linux x64/aarch64 + windows x64, Debug+Release); pre-commit/msvc/gcc pass. **clang-ONLY.** Exact error, identical all 6:
`src/debug-layer/debug-helper-functions.h:110:47: error: declaration requires an exit-time destructor
[-Werror,-Wexit-time-destructors]`. ⇒ **the process-global debug state table = file-scope static w/ non-trivial dtor;
clang builds enforce `-Wexit-time-destructors -Wglobal-constructors -Werror`, gcc/msvc/local-Debug don't** (why it built
clean locally). **This is the table-lifecycle concern I flagged at msg 99, now at compile time.** Fix: never-destroyed
function-local static (`static auto* p = new Table(); return *p;`) or the codebase's existing convention; watch
-Wglobal-constructors too. Directed fixer: reproduce locally under the clang flags before re-push (stop CI ping-pong),
incremental commit (#12194 — PR live/under-review, NO force-push). **Real blocker: GPU interop tests can't run until the
build is green ⇒ ready-flip prerequisite gated behind this.** Verify-not-relay caught this — the fixer reported right
after pushing, before the clang builds completed. #812 untouched/held.

### 🔄 MAINTAINER REVIEW ROUND — 4 inline comments, 2 un-defer his own deferrals (2026-09-23, msg 122→123)
jhelferty posted 4 inline review comments on #881; fixer stopped (2 reverse deferred items = correct stop-trigger).
**All green-lit in ONE rework pass** — the "reversals" are the MAINTAINER un-deferring with BETTER designs (his
prerogative), not us gold-plating:
- **#1 r4087482109:** warning→**error** when originating queue is Vulkan (cross-queue use w/o hand-off = genuine
  misuse). Trivial, aligns w/ his severity model. Implement.
- **#2 r4087442347:** **reset-at-creation** for recycled handles — solves the msg-99 lifecycle hazard WITHOUT a
  destruction hook (why it was "infeasible" before; he found the seam = create* wrappers). Implement; drop eviction
  known-limitation. ⭐
- **#3 r4087538972 (QUESTION, no change):** equal-family guard correct — **I VERIFIED @85b99b4:** handOff releases
  thisFamily→EXTERNAL, takeOver acquires EXTERNAL→thisFamily, so one side is always `VK_QUEUE_FAMILY_EXTERNAL`
  (0xFFFFFFFE) ≠ any real family ⇒ `if(src==dst)return` NEVER fires for external transfers; both barriers emit;
  vulkan→vulkan works via independent EXTERNAL round-trips; guard only elides redundant same-device same-family +
  is forward-compatible (destQueue carries future family, unresolved today). Sharpen comment, no logic change.
- **#4 r4087685867:** setBinding via bind-time bit, **validate at draw/dispatch** (queue known there) — his fix for
  the false-positive that caused the earlier drop. Implement; largest scope.
- **codex must-fix (own work):** 3 comment-hygiene; layout=expand doc not derive (keep-GENERAL); **real test-coverage
  gap** (wrong-queue test passes CORRECT srcQueue → mismatched branch untested) → add + null-array regression.
**Replies = fixer posts** (prompted review interaction on a PR he's actively reviewing + bot-mentioned = authorized,
NOT unprompted posting; #3 answer verified by me so safe to post). **READY-FLIP RESET: `4b2ba21` GPU-green is STALE** —
rework moves head ⇒ re-verify GPU-green on NEW head (per-test, incl #4) + refresh PR body once + re-run codex + **FRESH
slang-reviewer pass** (design changed materially). Flip mine, gated on new-head GPU-green + clean verdict. #12194 no-force.

### rework codex round 2 (2026-09-23, msg 126→127) — #4 texture-gap was FALSE; #5 = write host mocks
- **#4 REVERSAL (my disclose-gap directive MOOT):** codex found `ITextureView::getTexture()` — **I verified @slang-rhi.h:1165**
  (`virtual ITexture* getTexture()=0`). View→texture→shared-handle resolves ⇒ Shared TEXTURES are trackable. The
  "textures-as-views structural constraint" premise (that I told fixer to disclose) was FALSE. #4 now covers buffers +
  textures + counter buffers; buffers-only caveat DROPPED. Fixer correctly eliminated the gap rather than disclose a
  non-existent one. Other codex fixes: stale-root false-positive (`m_boundRootObject` across both bindPipeline overloads),
  record-after-success, counter-buffer validation — all sound.
- **#5 fork = WRITE THE HOST MOCKS** (~1 file). **Distinct from held #2:** #2 = ADD more validation paths (unbounded,
  untestable, false-positive risk) → held; #5 = TEST the #4 validation that EXISTS (bounded, maintainer-requested) →
  do it. **Clincher:** if the debug-layer validation only LOGS (doesn't fail the harness), GPU CI proves the code runs
  but NOT that validation fires-on-misuse / silent-on-legit ⇒ validation could be silently broken w/ green CI. Host
  test with stub COM objects directly asserts both, sidesteps the harness-behavior question. Also told fixer: determine
  whether the harness fails-vs-logs on validation errors (tells us if GPU CI has ANY validation coverage). Keep mock
  scope tight to sharedResourceOfBinding/collectSharedBindings/record-after-success. Then re-codex → push → replies
  (corrected #4=buffers+textures) → fresh reviewer. Flip mine, new-head GPU-green + clean verdict.

### codex round 43 (2026-09-24, msg 130→131) — real bug fixed; pass-mock = CAP CONFLICT, decided (b)
- **Real bug FIXED (gate earned it):** `m_boundRootObject` was a non-owning raw ptr; two-arg `bindPipeline(pipeline,root)`
  base path retains only the INNER root, not the debug wrapper → use-after-free if caller releases wrapper. Fixed →
  `RefPtr<DebugShaderObject>` (holds pre-built root for the pass). Correct fix (safe regardless).
- **Harness answered (fixer, definitive):** `testing.cpp` DebugCallback = `FAIL` on Error, `MESSAGE`(log) on Warning ⇒
  GPU CI catches a false-positive ERROR on the happy path but is blind to warnings + can't prove fires-on-misuse. Stated
  in PR body. Confirms the host test is the real guard.
- **CAP CONFLICT — codex 2nd must-fix wants pass-level test = mock IRenderPass/Compute/RayTracingPassEncoder + IRenderPipeline
  + pass-state = the encoder-mock sprawl I capped. DECIDED (b) HOLD CAP.** Active-root select is thin glue guarded 3 ways:
  (i) GPU CI compute-dispatch happy path w/ FAIL-on-Error (no-false-positive covered); (ii) RefPtr structurally prevents
  the real hazard, inspectable; (iii) recording/fires-on-misuse/silent-on-owner is object-level host-tested. Full
  pass-encoder mock for a 2-line select = disproportionate. codex's instinct (bug lived here) answered by the RefPtr fix,
  not 250 lines of mock.
- **ONE bounded context-fed re-argument then STOP:** re-run codex with the full disproportionality rationale (RefPtr-fixed
  + GPU-exercised + object-tested + orchestrator-capped). Downgrade/approve → push→replies→reviewer. **HOLDS → stop (NO
  round 44, NO bypass), I take to OPERATOR per #134** (round 43, all real bugs fixed, sole residual = disproportionate
  encoder-mock demand the orchestrator capped; gate can't distinguish proportionate coverage on this surface = config call).
  Keep the honest PR-body wording (pass-level NOT host-mocked; object-test + GPU-FAIL-on-error as encoder-path guards).

### ✅ REWORK PUSHED, codex APPROVED round 44 — NO operator needed (2026-09-24, msg 132)
The bounded context-fed re-argument WORKED (as predicted): given the full disproportionality rationale, codex
**downgraded the pass-coverage item to an acknowledged advisory gap** and OUTPUT_REVIEW = approve. Head **`99263c1`**
(incremental, no force). All 4 maintainer items + codex correctness fixes in (Vulkan cross-queue error; reset-at-creation;
equal-family confirmed; setBinding covers buffers+textures via getTexture()+counters; RefPtr pre-built-root; record-after-
success; view-unwrap). Host tests PASS (tracker 18 / null-array 4 / binding-validation 25), build green, clang -Werror
clean. PR body refreshed once (buffers-only caveat dropped). **Posted all 4 inline replies to jhelferty** (incl #3 verified
reasoning, #4=buffers+textures). **Dispatched fresh slang-reviewer pass (round 2).** **AWAITING my 2 ready-flip prereqs:
(i) new-head `99263c1` GPU-green per-test incl #4 round-trip (I re-derive myself), (ii) slang-reviewer verdict.** Fixer NOT
self-flipping; webhook-driven. #812 untouched/held. [Memory file long/drifting — condense at true terminal (merged/closed).]

### ✅ REVIEWER APPROVE_WITH_NITS + chose (b) polish-first (2026-09-24, msg 136→137)
slang-reviewer round-2 (A correctness + C clarity + orch cross-check; Devin timed out): **APPROVE_WITH_NITS, 0 bugs, 3 gaps.**
All round-1 blockers + all 4 maintainer items source-verified resolved; RefPtr + leaked-singleton sound. **Reviewer: none of
the gaps blocks the flip. ⇒ reviewer prereq MET; flip gated only on new-head GPU-green.**
**Decided (b): consolidated polish BEFORE flip** — jhelferty is ACTIVELY reviewing, and #1 (graceful-vs-abort) + C001
(misleading wording) are what he's most likely to flag; pre-empting is cheaper than flip→comment→refix and makes #881 a
fairer candidate in his #812-vs-#881 comparison. Scoped commit:
- **#1 graceful layout:** add debug-layer graceful `SLANG_E_INVALID_ARG` default-state check in
  `DebugCommandEncoder::handOff/takeOverShared`, **KEEP core assert as backstop** (doesn't reopen keep-GENERAL; matches his
  severity model; fixes within-debug-layer inconsistency Shared=graceful vs GENERAL=abort).
- **C001:** reword precondition to not exclude imported (tests hand off imported dst).
- **4× queryInterface dedup:** NOT cosmetic — **one of 4 OMITS the Shared check** (latent correctness); collapse to one dispatch.
- **Cheap cross-context tracker test:** do (core to two-DebugDevice interop).
- **Native-handle paths (2 of 6 unwired):** ASSESS — wire like reset-at-creation if trackable, else documented reason.
- **Cheap clarity nits** (C002/FG002/FG003/native-handle comment): fold in.
- **Encoder-front-door test = NOT the capped pass-encoder-family** — single ICommandEncoder stub for handOff/takeOver ARG
  validation (null/non-Shared/wrong-device/batch); assess vs existing null-array/mismatched-src coverage, do if real gap.
  **KEEP capping the pass-encoder-family (active-root) test.**
Seq: commit → codex (fast) → GPU-green re-verify NEW head (per-test incl #4) → quick reviewer re-confirm only if graceful-
layout non-trivial → **flip authorized on GPU-green, MINE to call** (reviewer met + jhelferty explicit PR = drafts-only lift);
fixer brings it, no self-flip. #12194 no-force. #812 untouched/held.

### Consolidated polish pushed `eaa551f` + 2 decisions (2026-09-24, msg 140→141)
7 items in one commit (11 files +271/−70, fast-forward non-force), codex CODE+OUTPUT approved, host tests green locally
(61 assertions), reviewer re-confirm dispatched (graceful-layout hunk), GPU CI pending (run 35947323252).
- **Native-handle-path DECISION (accepted): do NOT wire `create{Buffer,Texture}FromNativeHandle` into the tracker.**
  Wraps an EXISTING resource by its OBJECT handle — neither a fresh producer alloc (→reset) nor a shared-handle import
  (→tie), and not the shared/export handle the tracker keys on. Reset would wipe live state for a recycled value; tie
  keys on the wrong handle ⇒ both INCORRECT, not just unnecessary. A Shared wrapped resource is still tracked LAZILY via
  `getSharedHandleOf` on first tracked use. Documented at both paths. Sound; fixer decided w/ code-grounded reason.
- **⚠️ DEDUP "omitted Shared check" — MY FRAMING WAS WRONG; fixer corrected me.** I relayed the reviewer's "one of 4× omits
  the Shared check" as "latent correctness, add the check." Fixer inspected: `retainSharedResource` correctly does NOT gate
  on shared-ness — **retention must keep the resource alive for replay regardless**; gating on Shared would have been the
  ACTUAL bug (non-Shared replay resources dropped). Fixer did the one-source-of-truth dedup WITHOUT the spurious check.
  ⭐ **Lesson: I passed a reviewer finding through as actionable-fix without confirming defect-vs-correct-by-design; doing
  what I said would have introduced a regression. The fixer's verify-before-acting caught it.** (My own "verify before
  relaying findings as fact" applied to me relaying the REVIEWER to the fixer.) No harm — fixer didn't apply it.
Gates remaining = GPU-green `eaa551f` (I re-derive per-test incl #4) + reviewer re-confirm. Flip mine on both clean.
[Harness note: a `[GATE AUDIT]` fired on the literal string "[Fix Report]" in my coordination msg — false trigger; the
critique gate is for coworker patch artifacts, not orchestrator messages; no codex invocation warranted.]

### ✅ CLANG-FIXED + FULL GPU CI GREEN on `4b2ba21` (2026-09-23, msg 120→121) — READY-FLIP PREREQUISITE MET
Clang blocker fixed (`4b2ba21`): tracker singleton → **leaked function-local static** (never-destroyed → no exit-time
dtor; first-use → no -Wglobal-constructors) with an in-code rationale comment. Fixer reproduced locally under the clang
flags w/ a negative control before re-push (correct method). **23 checks all-green.**
🔴**FIXER WAS WRONG (in the PR's favor) that "GPU interop tests NOT executed / how to trigger":** conflated
GitHub-hosted-skip with the self-hosted GPU matrix jobs. **I VERIFIED at `4b2ba21`:** self-hosted `nvrgfx-kernelvm-bridge`
jobs **`build (windows,x86_64,msvc,Release)` (107378214570)** + **`clang,Debug` (107378214331)** ran the interop tests —
all four `{buffer,texture}-shared-cuda.{vulkan,d3d12}` **PASSED** per-test. Same runners as #812; already in auto-CI, no
trigger needed. **#4 Vulkan-acquire covered + green — verified the SOURCE not just the PASSED line:**
`test-buffer-shared.cpp`@`4b2ba21` L102 `reclaimEncoder->takeOverShared(...)` (EXTERNAL→thisFamily) + L106
`compareComputeResult(srcDevice, srcBuffer, {1,2,3,4})`, and buffer-shared-cuda.vulkan PASSED. (Same instrument trap
recurring — a "compile-oriented matrix" summary vs the per-test line in the self-hosted job.)
⇒ **READY-FLIP PREREQUISITE SATISFIED** (GPU-green, per-test PASSED incl #4). **ONLY remaining gate = slang-reviewer
verdict** (in flight on `4b2ba21`, thread gh-pr-slang-rhi-881-review). On a clean verdict, ready-flip authorized
(jhelferty's explicit PR request = documented drafts-only lift) — MINE to call; fixer brings it, doesn't self-flip.
#812 untouched/held.

### ✅ CONTEXT-FED ROUND CONVERGED on contested items (2026-09-23, msg 112→113) — NOT the operator branch
The context-fed OUTPUT_REVIEW accepted ALL deprioritized items (best-effort coverage disclosed, GENERAL documented,
eviction accepted, core reqs confirmed) — did NOT re-raise coverage/layout ⇒ non-convergence was context starvation,
now cured; no operator escalation. It surfaced 5 concrete fixables incl. a **REAL bug** (`getSharedHandleOf` called
`getSharedHandle()` on every non-Shared resource → spurious backend export errors on ordinary copies; fixed by gating
on Shared flag first), 2 PR-body accuracy fixes, comment hygiene, reverted prettier churn. Fixer ALSO added #4
(Vulkan-acquire round-trip: CUDA hand-back → producer takeOver → producer readback) + #2 disclosure. Committed `1192e31`.
**My call: authorized confirming rounds TO CLOSURE** — clarified my one-round cap was about UNBOUNDED-COVERAGE
non-convergence (resolved), NOT normal review-fix-confirm. **Precise stop-condition:** concrete new fixables → fix +
continue (gate working); **regression to the deprioritized set (exhaustive coverage/layout/eviction) → STOP + report =
operator branch.** On approve → draft PR (Fixes #787, report_pr_created, pr: label, ci.yml, ref as #812 alt) →
slang-reviewer → GPU CI. **Ready-flip mine after GPU CI green with interop tests (incl #4) ACTUALLY executing —
per-test PASSED, not run conclusion; doctest-skip + `--allow-escape-sequences` zero-byte traps apply.** #812 untouched.
- **Proposed shape (msg 88; status posted issuecomment-5795841254, full proposal HELD for my ABI check):**
  new **`IExternalMemoryQueue`** COM interface via `ICommandQueue::queryInterface` (null on non-Vulkan);
  batched **`releaseToExternal`/`acquireFromExternal`** over `IResource*`; reuses `Shared`/`getSharedHandle`/
  `FenceDesc`. New GUID, no existing vtable/enum/struct touched → `pr: non-breaking`. #812 = one implicit
  consumer of the same QFOT helpers; explicit API = lower-level primitive. Fixer applied ABI fixes
  (ICommandBufferD3D12 `#if 0` precedent, SLANG_UUID→SLANG_COM_INTERFACE, post-ship interface-append + SubmitDesc
  field-append hazards, synchronous-completion contract). 2 open Qs to jhelferty (his call): fence variant in
  v1? explicit-only vs both-layers. **Requested the full sketch doc (send_file) for my ABI check before it goes
  to him** — reviewing actual signatures/rationale, not the bullet summary; check points: QI leaves ICommandQueue
  vtable untouched, null-on-non-Vulkan contract, synchronous-completion semantics, batched IResource* sigs.

## Flip authorization (pre-loaded)
The drafts-only gate IS lifted here — jhelferty's explicit "open a PR" request is the documented exception
(jkwak / slangpy#1083). Once he answers with "land now," flipping to ready is authorized (unlike an
earlier over-reach, a maintainer actually asked). `gh pr ready` is operator-gated, so the fixer brings the
flip to me and I confirm on his answer. **Flip stays HELD** until he resolves the forks.

## Open items
1. **jhelferty to pick:** precise vs register-all (recommend register-all); fence-signal trigger (land
   waitOnHost now + follow-up); and confirm/decline the explicit-public-API sketch.
2. **Human draft→ready flip** is the only gate to merge; the bot will not do it.
3. **After #812 lands: file the dedicated-allocation asymmetry** — `cuda-buffer.cpp:129` sets
   `CUDA_EXTERNAL_MEMORY_DEDICATED` unconditionally while `cuda-texture.cpp:545` threads `isDedicated`.
   ⚠️ Evidence tier: an NVIDIA-staff forum post, NOT docs — state it as such, don't promote to a spec
   requirement. Not firing today.

## Durable lessons
- **The doctest "0 skipped" trap (fired twice here):** `msvc Debug` reported `1265 passed | 0 skipped`
  while the four interop cases inside it were `SKIPPED (CUDA not available)` — identical tally to the GPU
  job that really ran them. **"N/N green" / "0 skipped" NEVER establishes a test executed; only the
  per-test `PASSED` line does.** (Same trap: [[project_12307_reflection_json_scope_representation.md]].)
- **A gate is indexed by WHO SET IT, not by whether its stated condition is now met.** After GPU-green +
  APPROVE_WITH_NITS I told the fixer to flip #812 ready; it **refused, correctly**, citing the
  operator-set drafts-only gate (not orchestrator-overridable) and offered the override syntax — which per
  the guardrail must be DECLINED, not taken. A coworker refusing my instruction on a recorded gate is the
  system working. (2nd instance; 1st: slang#11440.)
- **Correctness asymmetry** (steered on): resolve uncertainty toward acquiring / keeping a fallback, never
  toward skipping — skipping a resource that IS accessed reintroduces the bug; a redundant barrier is only
  cost. This is why register-all beats precise.
- **Instrument discipline:** `| head -40` truncated a grep so a cited test line looked fabricated (false
  zero — grep the whole file before doubting). `gh api .../logs` returns **0 bytes** without
  `--allow-escape-sequences` (GH refuses terminal escapes) — an empty file greps as "tests absent";
  re-fetch with the flag + strip `\x1b[...m`. Turned "must be GENERAL" layout folklore into a searched
  corpus (zero hits across CUDA 13.x/12.6 guides) ⇒ layout preservation violates no documented contract.
- **Standing caveat:** #787 is an **intermittent** release-only failure ⇒ one green run proves the case
  passed once under the failing config, NOT that the race is eliminated. The durable signal is no
  recurrence on `windows-release-gpu-rhi` across later PRs.
- **Infra:** slang-rhi's `ci.yml` has **no draft gate** ⇒ drafts auto-run real CI (`./slang-rhi-tests
  -check-devices` on self-hosted `nvrgfx-kernelvm-bridge` GPU runners), unlike the slang repo's
  manual-dispatch rule.

## (SUPERSEDED) draft #812 create-time approach — why the pivot happened
#812's original shape released image/buffer graphics→EXTERNAL at `createTexture`/`createBuffer` gated on
`Shared && initData` (layout preserved), D3D12 shared texture → `RESOURCE_STATE_COMMON`. It was one-shot,
never acquired back, and VK/D3D12-asymmetric — which is exactly what jhelferty rejected. Reverted to clean
baseline `d4d53a7` before the register-all rework. codex CODE_REVIEW on the rework model caught 3 real
issues (all fixed): readBuffer bypassed submit/reacquire; acquire `srcAccessMask` should be 0; and it
blocked a use-after-free the fixer's own proposed lock fix would have introduced.
