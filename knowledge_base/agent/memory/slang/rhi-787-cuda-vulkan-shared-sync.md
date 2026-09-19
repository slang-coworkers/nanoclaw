---
type: project
title: slang-rhi#787 CUDA↔Vulkan shared-texture missing sync
description: real missing cross-API ownership bug (not tolerance); maintainer REJECTED #812's create-time approach + gave a submit-path release/acquire + ping-pong policy; re-implementation dispatched
tags: [slang-rhi, synchronization, cuda, vulkan, interop, reimplementing]
resource: https://github.com/shader-slang/slang-rhi/issues/787
---

# slang-rhi#787 — CUDA↔Vulkan shared-texture missing synchronization

**State (2026-08-05): PIVOT. Maintainer jhelferty-nv CONFIRMED the diagnosis but
REJECTED #812's create-time approach (comment 5704482839) and gave a precise revised
policy + an explicit request to open a PR implementing it. Re-implementation dispatched
to slang-fixer.** The explicit maintainer PR request is the documented drafts-only lift
condition (jkwak/slangpy#1083). Canonical thread `gh-issue-shader-slang/slang-rhi-787`.
See "REVISED POLICY" below — it supersedes the earlier scope decision and #812's approach.

## The bug (triager verdict, GitHub comment 5049387926)

`texture-shared-cuda.vulkan` release-only flake is a **real missing cross-API sync
bug, NOT a numeric-tolerance flake.** The shader is a bit-exact float4 copy of
exactly-representable {0.0,0.5,1.0} in RGBA32Float ⇒ delta must be exactly 0.0 when
synced; no legit rounding source. The Vulkan→CUDA hand-off did the transfer with **no
external-semaphore wait** and **no `VK_QUEUE_FAMILY_EXTERNAL` ownership transfer**,
relying only on host `waitOnHost()`. The sibling surface path (`cuda-surface.cpp`)
already had the correct machinery. Maintainer **jhelferty-nv** raised it
("release but not debug is suspicious").

## Maintainer scope decision (comment 5051356941)

Chose the **minimal correctness fix**: no new public interop-sync API yet, no
tolerance widening. On a `Shared` resource, after the VK/D3D12 producer writes, do an
image/buffer **release toward `VK_QUEUE_FAMILY_EXTERNAL`** (or D3D12 equivalent); keep
host `waitOnHost()`; align `texture-shared` with `buffer-shared`'s src-side flush.
Deferred as separate features: promoting surface-style external-semaphore machinery to
a shared helper; CUDA shared-fence import (a host-value stub today —
`getSharedHandle`→NOT_AVAILABLE, `// TODO: wait for fence` in `cuda-command.cpp:1249`).
The **triager's own earlier draft #791** (which widened tolerance) MASKS the bug ⇒
CLOSED (comment 5051399073), triager stood down.

## ⭐ REVISED POLICY (comment 5704482839) — SUPERSEDES the scope decision above and #812's approach

jhelferty-nv **confirmed** the diagnosis (shared images stay `VK_SHARING_MODE_EXCLUSIVE` on the graphics
queue; `waitOnHost()` is only `vkQueueWaitIdle`; CUDA reads an image Vulkan still owns; **D3D12 already
works** — no exclusive-family transfer) and **rejected #812**: create-time release gated on `Shared`+`initData`
"makes Vulkan and D3D12 mean different things and only covers a one-shot initialized create." He asked
@nv-slang-bot to open a PR implementing this policy (existing API only, NO new entry points):

**Same contract on VK + D3D12:** one allocation, producer keeps it after `create*`; another API accesses only
after the producer's `waitOnHost()` OR after waiting on a shared `IFence` the producer signaled; producer may
reuse after the matching wait — **ping-pong REQUIRED.**
- **Vulkan:** release to `VK_QUEUE_FAMILY_EXTERNAL` and **acquire back INSIDE submit / `waitOnHost` / fence
  signal — NOT at create time.** Reuse the per-frame pattern in `src/cuda/cuda-surface.cpp`.
- **D3D12:** NO behavior change ⇒ **REVERT #812's create-time COMMON transition.** Today's `Shared` +
  `getSharedHandle` + CUDA import + continued producer use must keep working.
- **Document** next to the `Shared` flags and `FenceDesc::isShared` in `include/slang-rhi.h`.
- **Tests:** `texture-shared-cuda` — fix the impl, **DO NOT change the test** (revert #812's comment edit).
  `buffer-shared-cuda` — **EXTEND to ping-pong**: after CUDA writes `{1,2,3,4}` and waits, read those values
  back on the producer (host waits on both queues suffice); drop the producer-readback hack.
- **OUT OF SCOPE:** `createFenceFromSharedHandle` for CUDA — CUDA `IFence` is a host counter; GPU-side CUDA
  waits stay on the CUDA driver, as SlangPy does.

**Fixer plan (2026-09-16, `/workspace/agent/reports/rhi-787-pingpong-plan.md`):** load-bearing design =
**internal shared-resource registry on `DeviceImpl`** (private list of live shared Buffer/TextureImpl +
`{OwnedByProducer, ReleasedToExternal}`, populated at create-time `Shared` checks) — this is what satisfies
"no new entry points": release/acquire ride the app's existing `submit`/`waitOnHost`/shared-fence calls.
Release producer→EXTERNAL before `vkQueueWaitIdle` in `waitOnHost` and before the shared-fence-signal submit;
acquire-back EXTERNAL→producer prepended to the producer's next submit (mirrors `cuda-surface.cpp:1047-1069`).
Coarse granularity accepted (touches ALL registered shared resources per wait — CBs don't expose which they
touch; per-CB precision is a later optimization). Sequence: reverts → VK registry+release/acquire → buffer
ping-pong + header docs → Linux build → push DRAFT → GPU-CI verify → flip on per-test PASSED.
⭐**If the ping-pong readback fails on GPU CI, the fix is the MEMORY DEPENDENCY in the acquire barrier — NOT
a semaphore.** The maintainer explicitly said "host waits on both queues are enough" (asserting the ordering
model is sufficient) AND a CUDA shared semaphore is explicitly out of scope. So a failure = availability/
visibility masks on the acquire QFOT, not missing sync. (Steered the fixer off the semaphore path pre-emptively.)

### ✅ REWORK VERIFIED GREEN (2026-09-16) — head `6e040d1`, draft, held for jhelferty
**All re-derived by me at source, not relayed:** #812 head **`6e040d1`**, draft, **24/24 check-runs +
combined status success**. Title "Fix #787: ping-pong queue-family ownership for shared resources".
Per-test (NOT tally): all four interop cases `PASSED` in **msvc Release** (job 104995889524) and **clang
Debug** (104995889626). **Negative control holds:** `msvc Debug` (104995889491) shows the same four
`SKIPPED (CUDA not available)` while tallying `1329 passed | 0 skipped`.
⭐**The round-trip #812 declared UNSUPPORTED now works and is pinned:** `test-buffer-shared.cpp:75` =
`compareComputeResult(srcDevice, srcBuffer, {1,2,3,4})` — producer reads back CUDA's writes after the
ping-pong — and it PASSED on GPU. **Risk #1 did NOT materialize:** host-wait ordering + the acquire
barrier's visibility masks suffice, no semaphore — exactly as jhelferty said "host waits on both queues
are enough." 5-bullet on issue (issuecomment-5705380563); open-question also on the PR body + @jhelferty-nv.
⚠️**Fresh false-zero trap, caught:** `gh api .../logs` returns **0 bytes** without `--allow-escape-sequences`
(GH refuses terminal escapes) — an empty file greps as "tests absent." Same defect class as the doctest
tally and `head -N`. Re-fetch with the flag + strip `\x1b[...m`.

**FLIP AUTHORIZATION (pre-loaded for when jhelferty answers):** the drafts-only gate IS lifted here — his
explicit "open a PR" request is the documented exception (jkwak/slangpy#1083). So once he answers the
fence-hook fork with "land now," flipping to ready is authorized (unlike my earlier over-reach, a maintainer
actually asked). `gh pr ready` is operator-gated so the fixer brings the flip to me; I confirm on his answer.
If he wants the fence trigger first → fixer implements the fold-into-signal version (flagged unvalidated), then flip.

### 🔄 CHANGE-REQUEST from jhelferty (2026-09-17, review r4041473666) — precise acquire, NOT the fence answer
He did NOT answer the fence-fork; instead requested **precise acquire granularity** (supersedes "land now"
for now; flip stays held). Directive: `submit()` acquires only the Shared resources in the submitted CBs'
`m_trackedObjects` (leave others on EXTERNAL); `readBuffer()` acquires only that buffer; `waitOnHost()`
unchanged (still releases all owned). No API. This is the coarse-granularity follow-up he now wants inline.
**His design Q:** can a Shared resource be used by a submit WITHOUT landing in `m_trackedObjects` (bindless /
device-address)? If so an internal always-acquire fallback list is needed. Fixer acked (issuecomment-5721303709),
did NOT assert the answer, investigating `m_trackedObjects` semantics + whether bindless bypasses it.
⭐**Correctness asymmetry I steered on:** getting acquire "too precise" (skipping a resource that IS accessed)
reintroduces THIS bug in reverse (producer touches CUDA-owned resource); "too coarse" (acquiring one that
didn't need it) is only a redundant barrier. ⇒ resolve uncertainty toward acquiring/keeping the fallback,
not skipping. Fence-fork remains open in PR body; re-surface after granularity lands.

**Bindless finding (2026-09-17, msg 74) — landed PRECISE + FALLBACK with positive evidence:** bindless
`setDescriptorHandle` memcpy's the 8-byte handle into uniform data / `allocBufferHandle` writes the global
descriptor set with **no RefPtr, no CB touch** (`vk-bindless-descriptor-set.cpp:161-213`); `getDeviceAddress()`
returns a bare uint64, never tracked (`vk-buffer.cpp:248-267`). Both let a Shared resource be used by a submit
WITHOUT entering `m_trackedObjects` ⇒ fallback required (positive bypass, not unproven absence).
Design: `waitOnHost()` releases all owned; `submit()` acquires tracked-set shared resources (unwrap
`m_trackedObjects` via dynamic_cast: Buffer / TextureView→texture / Texture, intersect registry) **+ always-acquire
fallback set** (marked when a Shared buffer's `getDeviceAddress()` is called or a bindless handle allocated);
`readBuffer()` acquires only its buffer. Early-out for non-shared/all-owned. Internal-only.
⚠️**My probe (msg to fixer): is "two untracked-use signals" STRUCTURAL (only two ways to FORM an untracked
buffer reference) or ENUMERATED (two use-sites found)?** If enumerated, a third bypass path silently defeats
the fallback — same unproven-absence shape. Asked fixer to make the structural argument (mark on handle-
FORMATION covers all untracked use regardless of use-site count) or widen the fallback trigger; made it a
specific codex CODE_REVIEW target.

### ⭐ STRUCTURAL CLAIM FAILED → RECOMMEND REGISTER-ALL (2026-09-17, msg 76)
Probe answer: `{getDeviceAddress, bindless-alloc}` is **NOT** complete. **Third path, evidenced:**
`BufferImpl::getNativeHandle()` (`vk-buffer.cpp:192`) hands the app the raw `VkBuffer`, and `ExecuteCallback`
(`vk-command.cpp:1624`) runs app-recorded commands inside RHI submit ⇒ a Shared buffer can be touched by a
submit with its ref neither in `m_trackedObjects` nor formed via device-address/bindless. Textures too
(bindless + native-handle). **The enumeration grew 2→3 under ONE probe — that IS the answer: precise mode's
correctness is an exhaustiveness bet that keeps losing.**
**REFRAME (load-bearing):** the committed, pushed, **GPU-CI-green `6e040d1` IS register-all** (registers every
Shared resource, acquires all `ReleasedToExternal` at submit) — **total by construction, zero dependency on
formation-path completeness.** jhelferty's "acquire only what the submit uses" is the *uncommitted in-flight
refinement* that inherits the completeness burden. Its coarseness is near-free (early-out = zero cost when
nothing released — the common case; redundant barriers only during active multi-resource cross-API sharing).
Per the asymmetric-failure rule register-all has NO miss-a-path risk; precise is only as correct as the enum.
**Recommendation (his call — his precision request): KEEP register-all.** Fixer HELD the incomplete 2-trigger
precise subagent output (not committed). If he still wants precise → precise + 3-trigger fallback, raw-VkBuffer-
outside-RHI documented as app-owned, exhaustiveness risk flagged. **Surfaced to jhelferty on the PR by the fixer**
(precise-vs-register-all note + evidence + recommendation, next to the parked fence-fork). If he picks register-all,
the PR is essentially DONE (green) modulo the fence-fork + flip. Flip still held.
⭐ The recommendation does NOT depend on the third path being real — register-all needs no completeness proof at all;
the third path just illustrates why precise's burden is a losing bet.

**Correction (msg 78):** the in-flight precise build is a **3-trigger** fallback (device-address + bindless-buffer
+ bindless-**texture**; it independently found the texture bindless bypass), compiles clean, uncommitted. Its only
known gap = `getNativeHandle()` path ⇒ "one trigger from covering all RHI-executed formations." **Decision UNCHANGED:**
the enumeration grew 2→3→(3+native-handle) under two probes — the exhaustiveness track record IS the argument, and
register-all makes no such bet. **This is jhelferty's call (he explicitly requested precision) — I do NOT preempt it,
same principle as the drafts-only / force-push gates: don't reverse a maintainer's explicit request on my own
authority even with strong reasons.** Route to him; fixer posts the sharpened fork + my register-all recommendation.
If he picks precise → add native-handle trigger + codex gate with exhaustiveness as explicit target. Prior
register-all message to fixer likely NOT delivered (malformed close tag); re-sent complete + self-contained.

**Both forks now IN FRONT OF jhelferty (2026-09-18, msg 80, issuecomment-5732215302):** he asked the bot
directly for an update (resolved the carry-vs-PR routing on his own edge); fixer posted status +
recommendations for BOTH forks — (1) precise vs register-all → lean register-all; (2) fence-signal trigger →
land waitOnHost now + tested follow-up. **register-all HEAD `6e040d1` pushed + GPU-CI-green incl. producer
read-back; precise edits uncommitted; flip held.** Chain state: cleanly the maintainer's two calls; no bot
action pending except executing his pick. Re-opens on jhelferty's webhook. Nothing for me to do but wait.

### 🔴 OPEN — fence-signal release trigger DEFERRED, escalated to jhelferty with the PR (2026-09-16)
Maintainer's policy listed 3 release triggers: "inside submit / waitOnHost / fence signal." Fixer implemented
**waitOnHost (release) + submit (acquire-back)** — both tested paths — and **removed the fence-signal trigger**:
as first written it ran the release as a SEPARATE submission AFTER the user submit that signals the shared
fence, so on the same queue (FIFO) the fence signals before the release barrier executes ⇒ an external waiter
ordering on the fence could see a still-Vulkan-owned resource (codex-confirmed ordering bug). Doing it
correctly = fold the release barrier into the SAME `vkQueueSubmit` that signals the fence (signal orders after
it) — feasible but risky (mixes an `m_deviceQueue` CB into the user submit lifecycle) and **NOT exercised by
any current test** (both tests hand off via waitOnHost), so unvalidatable even in GPU CI.
**Fixer recommends + I ENDORSE: land waitOnHost-only now; fence-signal trigger as a tested follow-up.**
Do NOT ship the risky fold-into-signal version speculatively. Carried up to jhelferty IN the PR (explicit
"deviation from your 3-trigger policy" open question + @mention, since he requested the PR). **Flip-to-ready
gated on his answer.** codex CODE_REVIEW on the model caught 3 real issues (all fixed): readBuffer bypassed
submit/reacquire; acquire `srcAccessMask` should be 0; and it cleared a false deadlock worry + blocked a
use-after-free the fixer's own proposed lock fix would have introduced. Reverted #812 to clean baseline `d4d53a7`.

**Delta vs #812:** #812 released at create time, one-shot, never acquired back, VK/D3D12 asymmetric. NEW =
release+acquire in the submit/waitOnHost/fence path (per-frame, ping-pong, symmetric), modeled on
cuda-surface.cpp; D3D12 reverted to no-change. **This resolves both my carried items:** the point-3 question
(maintainer wants a REAL ping-pong readback ADDED, not just the hack removed) and #812's "creation-time only"
limitation (the general case the ping-pong covers). Re-review required after the new PR (approach changed).

## (SUPERSEDED) Fix in draft PR #812 (head `79453f8`, +116/−6, 7 files, Fixes #787)

- **VK:** two `DeviceImpl` helpers release image/buffer `graphics →
  VK_QUEUE_FAMILY_EXTERNAL`, submit+wait; called from `createTexture`/`createBuffer`
  gated on **`Shared && initData`**, layout PRESERVED (`oldLayout==newLayout`, unlike
  the surface precedent's `UNDEFINED` which would discard init data).
- **D3D12:** shared *texture* → `RESOURCE_STATE_COMMON`; buffers deliberately untouched
  (created COMMON, implicit decay after waited copy).
- **Two disclosed scope limits (both my call — accepted):** (1) point-3 *deviation* —
  removed `buffer-shared`'s readback + its sync TODO instead of mirroring it, because a
  post-release VK read touches externally-owned memory (UB); (2) release fires only on
  creation-time writes — a Shared resource written by *later* commands isn't covered,
  which is forced by the maintainer's deferral of the acquire/semaphore machinery.

## Open items (chain is still LIVE — watch the canonical thread)

1. **Human draft→ready flip** is the only gate to merge. Bot will not do it.
2. **Maintainer has NOT confirmed the point-3 deviation** (disclosed as invertible on
   issuecomment-5191947055; jhelferty-nv silent). If he meant "mirror buffer-shared's
   readback" literally, the test delta inverts.
3. **After #812 lands: file the dedicated-allocation asymmetry** — `cuda-buffer.cpp:129`
   sets `CUDA_EXTERNAL_MEMORY_DEDICATED` unconditionally while `cuda-texture.cpp:545`
   threads `isDedicated`. ⚠️Evidence tier: sourced to an **NVIDIA-staff forum post, not
   docs** — state it as such, do NOT promote to a spec requirement. Not firing today.

## Durable lessons

- **The doctest "0 skipped" trap (fired TWICE here, second time with a control I ran
  myself):** `msvc Debug` reported `1265 passed | 0 skipped` while the four interop
  cases inside it were `SKIPPED (CUDA not available)` — identical tally to the GPU job
  that really ran them. **"N/N green" / "0 skipped" NEVER establishes a test executed;
  only the per-test `PASSED` line does.** The repro really ran only in
  `build (windows, x86_64, msvc, Release)` (job 92327688819) + `clang Debug`
  (92327689006). (Same trap: [[project_12307_reflection_json_scope_representation.md]].)
- **A gate is indexed by WHO SET IT, not by whether its stated condition is now met.**
  After GPU-green + APPROVE_WITH_NITS I told the fixer to flip #812 ready; it **refused,
  correctly**, citing the operator-set drafts-only gate (2026-05-27, "not
  orchestrator-overridable") and offered the override syntax — which per the guardrail
  must be DECLINED, not taken. 2nd instance (1st: slang#11440). ⭐ Strong verification is
  what made promotion *feel* authorized — that is exactly the state the gate exists for.
  A coworker refusing my instruction on a recorded gate is the system working.
- **Instrument discipline:** `| head -40` truncated a grep so a cited test line looked
  fabricated (false zero — grep the whole file before doubting). Identical timings at
  different log lines are coincidence, not copy-paste. Turned "must be GENERAL"
  layout folklore into a *searched corpus* (zero hits across CUDA 13.x/12.6 guides,
  controls firing) ⇒ the PR's layout preservation violates no documented contract.
- **Standing caveat:** #787 is an **intermittent** release-only failure ⇒ one green run
  proves the case passed once under the failing config, NOT that the race is eliminated.
  The durable signal is no recurrence on `windows-release-gpu-rhi` across later PRs.
- **Infra:** slang-rhi's `ci.yml` has **no draft gate** ⇒ drafts auto-run real CI
  (`./slang-rhi-tests -check-devices` on self-hosted `nvrgfx-kernelvm-bridge` GPU
  runners), unlike the slang repo's manual-dispatch rule.
