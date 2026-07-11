---
name: project_cpu_buffer_createbuffer_asan_regression
description: "#12058 REAL regression (NOT flake) — deterministic ASan heap-buffer-overflow (memcpy READ-of-142 on initData) in slang-rhi cpu-buffer.cpp createBuffer; blocks ALL merge-group sanitizer batches; FILED, routed to slang-triager; suspect slang-rhi ToT #11960"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**Signature (babysitter 07-10 22:05Z, Main-verified plausible):** deterministic ASan **`heap-buffer-overflow` in `external/slang-rhi/src/cpu/cpu-buffer.cpp` `rhi::cpu::DeviceImpl::createBuffer`** (the `malloc(desc.size)` + `memcpy(initData, desc.size)` path — babysitter cites :36; file offset varies), hit via `render-test`'s `shader-renderer-util.cpp:204`, taking down an identical set of **11 CPU tests**. Surfaces only in **merged/sanitizer (merge-group) state**, not PR head-checks.

**Why it's a REAL regression, NOT the #11833 flake:** reproduced across **two independent merge-group batches hours apart** with identical trace → deterministic. Distinct ASan signature from [[project_11833_asan_canary_mergequeue_evictor]] (that's LD_PRELOAD/canary *env* flake; THIS is a heap-buffer-overflow in *application* code). Babysitter separated them by signature — trusted.

**Evictions (victims, not causes):** #12030 @20:27Z, #11907 @19:46Z, #11910 @16:58Z. All bounce from merge-group; babysitter's expert extrapolation: **will bounce EVERY PR reaching a merge-group `sanitizer` batch until fixed** → requeuing is wasted effort (do NOT rerun/requeue).

**Main-verified before acting (standing rule — verify regression at claim-precision):**
- No existing open issue (searched createBuffer/cpu-buffer/render-test-sanitizer — all empty).
- Source at `createBuffer` IS consistent with an overflow at that function (malloc(desc.size) then memcpy of initData at desc.size — overflow if fixupBufferDesc shrinks size or caller under-allocates). Code-plausible.
- **Suspect: slang-rhi ToT bump #11960 (landed slang master 07-07 02:01Z, sha ef06ca4067).** Current pinned slang-rhi = `29dc332e55`. NOT proven causal — hypothesis only; triage should bisect/confirm.

**Disposition (07-10):**
- **Babysitter FILES the regression issue** (closest-to-state, has run IDs `29123839737`+ ASan traces, filing CI issues is its established ungated role like #11951/#11833). Signature as observed-FACT; #11960 as SUSPECT not asserted cause. Report number back.
- **Then route filed issue → slang-triager** (covers slang + slang-rhi) on canonical thread `gh-issue-shader-slang/slang-<num>` for root-cause (bisect slang-rhi pin) → fix authorization → fixer (drafts-only). This IS bot-fixable (concrete bounded C++ overflow) — unlike the #11833/#11951 flakes.
- Fix likely lands in shader-slang/slang-rhi then a slang pin bump (cross-repo).

**FILED → [shader-slang/slang#12058](https://github.com/shader-slang/slang/issues/12058)** (babysitter, 07-10 22:24Z). Refined signature: ASan `heap-buffer-overflow` = **`memcpy` READ-of-size-142 on the SOURCE** — `initData` render-test allocates as `Slang::List<uint32_t>` (`slang-list.h:654` ← `tools/render-test/shader-renderer-util.cpp:204`); `createBuffer` copies MORE bytes than caller supplied = copy-length ↔ init-data-size mismatch. **Layer question (slang-rhi copy contract over-reads `desc.size` vs. render-test caller under-sizes `initData`) left OPEN for triager** — babysitter asserted only the CI signature. All 11 `(cpu)` tests enumerated in issue. Determinism: identical trace across 3 merge-group runs (#12030 `29121460206`, #11907 `29119106403`, #11910 `29109329627`).

**ROUTED → slang-triager 07-10 22:2xZ** on thread `gh-issue-shader-slang/slang-12058`.

**TRIAGE VERDICT (07-10 22:58Z) — Main-VERIFIED at claim-precision:** Bug (LATENT, **NOT a regression**) / high / render-test tooling / P1 merge-queue blocker. Issue Type=Bug set; 5-bullet posted ([comment 4940177263](https://github.com/shader-slang/slang/issues/12058#issuecomment-4940177263)).
- **Root cause PROVEN @ HEAD 01adc68f3 (Main-verified in-source):** `tools/render-test/render-test-main.cpp:~497` — `bufferData.reserve(bufferSize / sizeof(uint32_t))` + the pad loop both **FLOOR-divide**. A 142-byte buffer (elementCount*stride, non-4-aligned) → `floor(142/4)*4 = 140`-byte `List<uint32_t>` backing; then `createBuffer(..., bufferSize=142)` memcpys 142 from 140 = **2-byte source over-read**. Bug is in THIS repo's render-test, NOT slang-rhi. **The fix is render-test-side (ceil the element count), single-file.**
- **LAYER answered:** render-test caller under-sizes initData; slang-rhi **cannot** clamp — `createBuffer(const BufferDesc&, const void* initData,...)` takes a **length-less** pointer (slang-rhi.h:3425). So NOT a slang-rhi copy-contract bug.
- **#11960 suspect REFUTED by bisect:** `cpu-buffer.cpp` + `resource-desc-utils.cpp` byte-identical across pin `687dc186..29dc332e`. #12056 merged AFTER the failing runs → not why-now either. Latent bug newly surfaced, not a pin regression.
- **⚠️ Issue conflates TWO problems (triager's finding, attributed):** (1) the **overflow** = real deterministic bot-fixable blocker (ceil fix). (2) the **11 `(cpu)` `//TEST:EXECUTABLE:` failures listed fail on a SEPARATE `ASan runtime does not come first / LD_PRELOAD` error = the [[project_11833_asan_canary_mergequeue_evictor]] canary class** — collateral infra flake, NOT bot-PR-able (workflow-YAML + VM hygiene). Already tracked as #11833 → **no new issue needed**; the collateral folds into the existing #11833 chain. (Note: this partly reframes the babysitter's "overflow took down 11 tests" — per triager, overflow is 1 deterministic failure, the 11-list is largely #11833 collateral. Whether the ceil fix FULLY unblocks the queue will be borne out by CI; if #11833 canary keeps evicting post-fix, that's the separate infra item.)

**Routing:** triager → slang-fixer (Approach A ceil fix, draft PR `Closes #12058`) + memo (`triage-12058.md`, in my inbox `a2a-1783724329183-yivyay`, unread — inline briefing sufficed).

**⏸ FIXER STALLED ON INFRA (07-10 22:59Z):** slang-fixer returned auth error **"Not logged in · Please run /login"** instead of an ack — transient AWS Bedrock model-access / subscription-processing issue (triager hit the same on 2 recall subagents this session). Triage is DURABLE (root-cause posted, memo + handoff queued in fixer's inbox — nothing lost; picked up on session recovery). Only fix-DRAFTING is stalled, no design/decision gate. Do NOT preempt-restart the fixer (AWS-side transient; restart won't fix + risks losing queued handoff). Triager owns fixer edge, forwards [Fix Report] on recovery. **Re-route/escalate ONLY if fixer stays down long enough to jeopardize this P1** — no cross-repo fixer substitute exists (slang-only). Check back next turn / if triager flags continued outage.
