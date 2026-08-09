---
name: project_slangpy_1090_metal_buffer_from_native_handle
description: "slangpy#1090 (fknfilewalker) Device::create_buffer_from_native_handle for Metal buffer import — dispatched to slangpy-pr-approver 2026-08-03; RESUME = approver verdict"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# slangpy#1090 — `Device::create_buffer_from_native_handle` (Metal buffer import)

- **Repo/PR:** shader-slang/slangpy#1090 · https://github.com/shader-slang/slangpy/pull/1090
- **Author:** `fknfilewalker` (**non-bot human contributor** — not a bot-echo park)
- **Inbound:** `kind: webhook`, `content.event = github.pr_ready_for_review`, `reason = opened` (opened non-draft), 2026-08-03.
- **Routing:** dispatched to **`slangpy-pr-approver`** via `mcp__nanoclaw__send_message`, thread
  `gh-issue-shader-slang/slangpy-1090`, trailer byte-exact
  (`<github-post-authorized />` / `REPO=` / `PR=1090` / `MODE=pr-approve`).
  Per [[feedback_webhook_dispatch_by_event]] a reviewable event goes to the
  `*-pr-approver` ONLY — never a reviewer/fixer. No 👀 posted (no triggering
  comment on a reviewable event); **I did not and must not post on this PR** —
  see [[feedback_approver_never_posts_route_reviewer]] for who carries the
  GitHub footprint if the approver's verdict needs publishing.

## State — verdict in (2026-08-03)

**`ABSTAIN_POLICY` (`OPEN_GAP`)** @ head `5c384a20b11b`, policy
`v0-shadow-relaxed`, mode `live`. Ledger row written; **nothing posted to
GitHub** (correct — [[feedback_approver_never_posts_route_reviewer]]).
Clauses 6/6 pass, **0 🔴 bugs**; CodeRabbit's lone 🟡 cleared as pre-existing.
115 lines / 6 files; bumps `external/slang-rhi` → `11eefdc6` (= slang-rhi#801).

Two gaps, both **approver's findings — I have not read the slangpy diff**:
- **G1** the new `create_buffer_from_native_handle` has **zero executing test
  coverage at any slangpy layer** (none added, none pre-existing); macOS CI only
  **builds** it. Failure mode is GPU memory corruption — i.e. the gap is on
  exactly the property the PR exists to provide.
- **G2** Python-reachable on Vulkan/D3D12, which type-check but never
  size-check. Pre-existing upstream; **first exposed** here.

**MINE-VERIFIED (REST, anonymous, 200):** the prior "test masked to
`D3D12 | Vulkan`, Metal-only code never run on Metal" gap **is** fixed at the
pinned commit — `tests/test-buffer-from-handle.cpp:6` at
`11eefdc6a2c0bb5295fd8f6fde33cd29942f477d` reads
`GPU_TEST_CASE("buffer-from-handle", D3D12 | Vulkan | Metal)`. Commit is
`fknfilewalker`'s own "Implement native Metal buffer import (#801)".
⚠️ **That is REGISTRATION, not EXECUTION** — rhi `ci.yml` at the same commit runs
macos-aarch64 on **`runs-on: macos-latest`** (lines 48-49), the paravirtual
runner, which is precisely the configuration that **skips** Metal GPU tests
(cf. rhi#802's `OPEN_GAP`, [[feedback_green_job_skipped_backend_zero_coverage]]).
So "the mask now includes Metal" does **not** establish Metal coverage upstream,
and G1 stands undiminished. I did **not** open an rhi CI log to confirm the skip.

## Verdict on the verdict

The abstain is **calibrated**, not timid — same shape as rhi#802, where a human
Metal maintainer independently filed CHANGES_REQUESTED from the identical
zero-execution-coverage premise. No action from me on the review itself.

## 🔁 SYNCHRONIZE 2026-08-05 — RE-ENGAGED, debounce correctly DECLINED

Webhook `pr_ready_for_review (synchronize)`. Ran the debounce recipe; **it says
re-dispatch, not hold.** All MINE-VERIFIED by anonymous REST.

1. **Head MOVED** — decided `5c384a20b11b` → new `bb870c1750cc` (`ahead_by: 1`,
   `behind_by: 0`). **Not a duplicate webhook.**
2. **Delta is exactly the premises G1/G2 rested on** — the opposite of
   non-operative:
   - `+ slangpy/tests/device/test_buffer_from_native_handle.py` **(+74, NEW)** —
     directly retires **G1**'s "zero test coverage".
   - `M src/sgl/device/resource.cpp` **+31/-0** — adds
     `native_buffer_handle_type()` + `SGL_CHECK`s for *not-implemented backend*
     and *handle-type mismatch*, directly addressing **G2**.
3. 🔴**HUMAN `CHANGES_REQUESTED` in the window — ccummingsNV, 2026-08-05T11:42Z**,
   `commit_id 5c384a20b11b` (the decided sha). Body verbatim: *"Looks solid. Is
   this Metal only … If it is not implemented on other platforms we should
   probably throw not implemented. Can we also get a test in? …"*
   ⭐**This is the debounce rule's load-bearing job paying off exactly as
   documented** ([[feedback_debounce_approver_dispatch_deterministic_abstain]]) —
   a diff-only check would have held silently and buried a human blocker.
4. **Ordering establishes the delta is a RESPONSE to that review**: review
   11:42:00Z → new commit authored **12:37:11Z** (Lukas Lipp, msg `tests`).
   The author is answering the maintainer, and the two asks map 1:1 onto the two
   files.
5. Other endpoints: `issues/1090/comments` = 1 (coderabbit bot),
   `pulls/1090/comments` = 1 inline (coderabbit 🟡, the pre-existing one already
   cleared). **No other non-bot input.**

### ⚠️ G1's premise has genuinely MOVED — but "moved" ≠ "closed"

The reason G1 held was *macOS builds but never executes*. On the new head that
is **no longer structurally true**, MINE-VERIFIED in `.github/workflows/ci.yml`
@ `bb870c1750cc`:
- `:219` **Unit Tests (Python)** is gated `contains(matrix.flags,'unit-test')`
  **only — NOT macOS-excluded**, unlike `:205` and `:164` which carry an explicit
  `runner.os != 'macos'`. So the pattern "macOS is excluded from python tests"
  does **not** apply to this step.
- Both macOS rows (`:62`, `:63`) carry `unit-test` in `flags`, `runs-on: macos-latest`.
- `slangpy/testing/helpers.py:43-44`: on `darwin`,
  `DEFAULT_DEVICE_TYPES = [DeviceType.metal]` ⇒ the new
  `@pytest.mark.parametrize("device_type", helpers.DEFAULT_DEVICE_TYPES)` test
  **parametrizes to Metal on the macOS legs**.

⛔**What I did NOT establish, and the approver must:** whether the test
*actually executes and passes* on `macos-latest`. A GPU-touching test can still
`skip`/`xfail`/error at `get_device()` on a paravirtual runner — that is the
whole rhi#802 / [[feedback_green_job_skipped_backend_zero_coverage]] pattern, and
a green leg is its **affirmative signature**, not its refutation. **Read the
pytest summary in the macOS job log for this test's name — passed vs skipped —
not the job conclusion.** I did not open a log.

**CI state at dispatch:** `check-runs` total 14, len 14 (pagination OK; 12
`build (` + 2 non-build, reconciles). **12 `in_progress`**, 2 `success`. Both
macOS legs `in_progress`. ⇒ **Any verdict must be taken on a settled head; the
combined-status blindness of D2 makes "green" especially untrustworthy here.**

## 🔴 R2 INTERIM 08-05 — the new test FAILS in CI. 4 legs, not 2.

Approver reported the crash; **I independently reproduced its evidence from the
job logs** (anonymously readable — its correction to my note is right, `http 200`,
no auth needed). Its Linux figures reproduce **exactly**: job 92307324639 log is
**11,082 lines**, `"crashed while running"` ×2, `4139 passed` ×1.

**MINE-VERIFIED, all 4 failing legs** at head `bb870c1750cc`
(check-runs 18/18, pagination OK; **4 `failure`**, 7 success, 3 skipped,
**4 still `in_progress`** incl. **both macOS legs**):

| leg | job | result |
|---|---|---|
| linux gcc **Debug** | 92307324639 | `1 failed, 4139 passed` — `gw0` crashed |
| linux gcc **Release** | 92307324577 | same crash |
| **windows msvc Debug** | 92307324755 | `1 failed, 5678 passed` — `gw1` crashed |
| **windows msvc Release** | 92307324539 | `1 failed, 5678 passed` — same |

⚠️**The approver reported only the 2 Linux legs; Windows msvc failed too.**
Same test, same `[DeviceType.vulkan]` param, same crashed-worker mode.
⭐**Per-device breakdown is the useful cut:** `d3d12` **PASSED**, `cuda`
**PASSED**, `_invalid[vulkan]` **PASSED** — only
`test_buffer_from_native_handle[DeviceType.vulkan]` dies. Deterministic ×4 ⇒
**not a flake**, and it is **the PR's own new test**.

### ⚠️ The Windows crashpad stack names a DIFFERENT mechanism than the reported root cause

Approver's root cause: `m_memory` left indeterminate ⇒ `vkMapMemory` on garbage
(`vk-buffer.cpp:462`). **Its code reading is CORRECT — MINE-VERIFIED at rhi
`11eefdc6`:** `createBufferFromNativeHandle` (`vk-buffer.cpp:441-456`) assigns
**only** `buffer->m_buffer.m_buffer` (`:447`) and never `m_memory`; `mapBuffer`
(`:462`) then maps `bufferImpl->m_buffer.m_memory`.

**But the Windows crash did not die there.** The crashpad stack
(`STATUS_FATAL_APP_EXIT`, `abort` ← `rhi::handleAssert`) is:
```
 3 rhi::handleAssert            assert.cpp:27
 4 rhi::vk::calcPipelineStageFlags   vk-utils.cpp:419
 5 rhi::vk::CommandRecorder::commitBarriers()  vk-command.cpp:1718
 6 rhi::vk::CommandRecorder::record()          vk-command.cpp:193
 7 CommandEncoderImpl::finish()                vk-command.cpp:2195
10 sgl::CommandEncoder::finish()               command.cpp:963
```
`vk-utils.cpp:419` is **`SLANG_RHI_ASSERT(src)` under
`case ResourceState::Undefined:`** — i.e. an **imported buffer carries
`Undefined` state into a barrier as the *destination*.** That's the
`encoder.upload_buffer_data(imported, …)` + `finish()` half of the test, **not**
the `to_numpy()` readback. ⇒ ⭐⭐**Two candidate defects on the same missing
initialization — uninitialized `m_memory` AND untracked initial
`ResourceState`.** Neither of us has shown which fires on Linux (its log has
**no crashpad section**; only Windows emitted one). **Do not collapse these into
one causal story — that is exactly the D1-part-2 error from earlier today**
([[project_approver_pipeline_defects_devin_fetch_ci_green]]).

✅Approver-confirmed and I did not re-derive: backend lists **agree** with rhi
`11eefdc6` (d3d12/vulkan/metal/wgpu all implement; cpu/cuda → `undefined` ⇒ the
not-implemented `SGL_CHECK`) — **my wgpu concern checks out clean.**
`mode = live_late`; `CHANGES_REQUESTED` joined against the prior sha.

⭐**My own miss, worth keeping:** I first grepped the Linux log for
`crash reason|Crash most probably` and got **0**, and briefly read that as "no
crash on Linux." Wrong — Linux emits **no crashpad section at all**; the crash
appears only as pytest's `worker 'gwN' crashed`. **A zero from a
platform-specific pattern is a claim about the PATTERN, not the platform.** Third
null-result-misread of this exchange; the fix was grepping the approver's
**exact** strings with a non-zero control.

## ✅ R2 FINAL 08-05 — **BLOCK** `VERIFIED_BUG:vulkan_import_undefined_state`

@ `bb870c1750cc`, policy `v0-shadow-wide` (⚠️mounted policy changed under the
approver mid-chain, `v0-shadow-relaxed` → `v0-shadow-wide`, human-signed
haaggarwal 08-04 — it **verified rather than assumed**, the right move).
Clauses 6/6 pass; critique gate passed both stages; nothing posted to GitHub.

**MINE-VERIFIED before relaying (all anonymous REST / job logs):**
- **Head still `bb870c1750cc`** at decision time and after — decision correctly
  pinned. CI now **SETTLED**: 18/18 (pagination OK), 11 success, **4 failure**,
  3 skipped, **0 in_progress**.
- 🔴**G1 IS CLOSED ON THE TARGET PLATFORM — the Metal test genuinely EXECUTES.**
  Job **92307324662** (macos Debug): `PASSED
  test_buffer_from_native_handle[DeviceType.metal]` **and** `PASSED
  ..._invalid[DeviceType.metal]`; summary `1771 passed, 393 skipped`. Not
  skipped, not xfailed. ⇒ **the rhi#802 build-without-execute pattern does NOT
  apply here.** This is the question my re-dispatch existed to force, and the
  answer went *against* my prior expectation — worth noting, since I had
  emphasized the skip risk.
- **The corrected root cause's DISCRIMINATING claims all hold** @ rhi
  `11eefdc6`: `fixupBufferDesc` **is** called in the import path for
  **metal** (`metal-buffer.cpp:141`) and **wgpu** (`wgpu-buffer.cpp:115`), and
  is **absent** from vulkan's `createBufferFromNativeHandle`
  (`vk-buffer.cpp:441-456`) and from d3d12's (`d3d12-device.cpp:1588-1603`) —
  while d3d12 survives because `d3d12-utils.cpp:312-313` maps
  `ResourceState::Undefined → D3D12_RESOURCE_STATE_COMMON`.

### ⭐⭐⭐ The rule this chain earned

**My `vkMapMemory` discriminator was right and the approver withdrew its own
root cause** — codex refuted it on the call path (`to_numpy()` → `get_data()` →
rhi `readBuffer()` builds a **separate staging** `VKBufferHandleRAII` and maps
*that*, never the imported `m_memory`), so the mechanism **could not have fired
on the reviewed path**. Real defect, wrong causal role — recorded separately as
**real-but-unfired**, correctly not folded in.

⭐⭐⭐**A MECHANISM THAT CANNOT EXPLAIN WHY THE PASSING CASES PASS IS NOT A ROOT
CAUSE YET.** The per-device cut (`d3d12` PASS · `cuda` PASS · `_invalid[vulkan]`
PASS · only `[vulkan]` dies) is what forced the real boundary out.
⚠️And the approver **explicitly refused to round up**: the `fixupBufferDesc`
story explains vulkan/metal/d3d12 but **not cuda** — cuda passes only because
the test's `pytest.raises("not implemented")` branch fires before any rhi
import. Naming the case its own mechanism doesn't cover is the behavior to keep.

**Fix for the block:** call `fixupBufferDesc()` in rhi's Vulkan import path, or
set a non-`Undefined` `default_state` before import. **Follow-up, explicitly NOT
required to clear the block:** initialize `m_memory`.

### 🔴⭐⭐⭐ THE BUG FILE IS **NOT** IN THE SUBMODULE BUMP — the defect is PRE-EXISTING in rhi

**MINE-VERIFIED against the 22-file inner diff** (`1a976874…11eefdc6`):

| file | role | in the bump? |
|---|---|---|
| `src/vulkan/vk-buffer.cpp` (`:441-456`, the missing `fixupBufferDesc`) | **the BUG site** | ❌ **NO** |
| `src/vulkan/vk-utils.cpp` (`:419`, the `SLANG_RHI_ASSERT(src)` that aborts) | **the crash site** | ❌ **NO** |
| `src/metal/metal-buffer.cpp` (`:141`, *has* `fixupBufferDesc`) | **the CONTRAST case** | ✅ yes |

⇒ **The Vulkan defect is pre-existing in slang-rhi and was newly *REACHED*, not
introduced, because slangpy exposed `create_buffer_from_native_handle` to
Python.** `src/vulkan/**` contains **zero** files in this bump.

⛔**Correction to a peer claim, and it inverts a file's role:** the approver wrote
that `metal-buffer.cpp` is *"the file the BLOCK's own `fixupBufferDesc` evidence
was read from"* and therefore *"the file containing the bug."* **It is the
opposite** — `metal-buffer.cpp` is the backend that **does** call
`fixupBufferDesc`, i.e. the reason Metal *passes*. The bug is the **absence** of
that call in `vk-buffer.cpp`, which is not in the bump at all.
⭐⭐**The evidence for a differential finding lives in TWO files with OPPOSITE
roles — "where the evidence was read" is ambiguous between them, and picking the
wrong one inverts the causal story.** Name the *role*, never just the file.

⚠️**Consequence for D3's worked example:** the compiled-source exposure is still
real (5 `src/metal/*` files + 5 `tests/*` genuinely compiled into slangpy and
reviewed as 220 lines), **but this PR is NOT an instance of "a gitlink hid the
bug."** The bug was reachable from source the approver read directly. ⭐**Don't let
a worked example claim more than it shows** — D3 stands on the size/attention
undercount, not on concealment of this defect.

⚠️Human verdict joined: `ccummingsNV` CHANGES_REQUESTED stamped onto the R1 row;
his 2 asks map 1:1 onto R1's 2 gaps, in order. **The block is narrow and
specific — not a rejection of the revision**, which met both asks.

⭐**My own matcher miss (4th null-result instance today):** grepping
`d3d12-buffer.cpp` for the import path returned **empty** and I nearly read it as
"d3d12 has no import path" — it lives in **`d3d12-device.cpp`**. Treating a
surprising empty as a **matcher suspect first** ([[feedback_audit_grep_false_negatives_asymmetric]])
is what caught it. **A zero located in the wrong file is indistinguishable from
absent code.**

⚠️**Tooling datum for gate work:** `codex-reply` **cannot carry
developer-instructions**, so a stage re-review sent as a *reply* is **silently
not recorded** — relevant to anyone relying on it for a critique gate.

## 🟢 R3 SYNCHRONIZE 08-07 — THE BLOCK'S FIX LANDED. Re-dispatched.

Webhook `pr_ready_for_review (synchronize)`. Debounce recipe run; **re-dispatch,
not hold.** All MINE-VERIFIED by anonymous REST.

1. **Head MOVED** `bb870c1750cc` → **`eca1dc49e1eb`** (`ahead_by 1`). Not a duplicate.
2. **Delta is a LONE GITLINK BUMP** — `external/slang-rhi` `+1/-1`,
   `11eefdc6` → **`5f00bdc5`**, commit *"update slang-rhi"* (Lukas Lipp).
   ⭐**This is the D3 shape exactly: a one-line diff that is the entire change** —
   and here it carries the fix, so the same blindness that undercounts risk also
   undercounts a *remedy*. **A gitlink-only delta must never be debounced as
   trivial.**
3. 🟢**THE PRESCRIBED FIX IS PRESENT.** `vk-buffer.cpp` at `5f00bdc5`: blob
   **`eda0548ead59`** (was `3318cadb8cd8`), `fixupBufferDesc` count **1 → 2**:
   - `:340` `createBuffer` (pre-existing)
   - **`:443` `createBufferFromNativeHandle`** — `RefPtr<BufferImpl> buffer(new
     BufferImpl(this, fixupBufferDesc(desc)));`
   ⇒ **exactly option 1 of the BLOCK's fix guidance**, and it closes the intra-file
   asymmetry the verdict rested on (`:340` had it, `:441` didn't).
4. **Upstream provenance:** slang-rhi**#813** *"Apply fixupBufferDesc when importing
   buffers from native handles (vulkan/d3d)"* — **MERGED 2026-08-07T14:30:33Z,
   merge_commit `5f00bdc50f1f`** == the newly pinned sha. So the author fixed it at
   the correct layer (rhi, not a slangpy workaround) and bumped the pin.
5. **Non-bot inbounds — 3, all read:**
   - `fknfilewalker` 08-05T12:38 — answers ccummingsNV: implemented for d3d/vk/webgpu;
     **cuda + cpu have no native-handle impl** (offers a follow-up PR); "Done" on tests.
   - `fknfilewalker` 08-05T12:54 — *"Tests fail because of slang-rhi #813"* — i.e. the
     author independently identified the same root cause as the BLOCK.
   - **`guoxx` 08-06T15:32 — NEW third party**: confirms the approach works on Vulkan,
     wants it for NPU interop. **Corroborating, not blocking.**
6. ⚠️**ccummingsNV's `CHANGES_REQUESTED` is still open and still pinned to
   `5c384a20b11b`** (two heads stale). Both his asks are now answered, but **only he
   can dismiss it.**
7. **CI NOT SETTLED at dispatch:** 14/14 pagination OK — 2 success, **8 in_progress,
   4 queued.** Decide only on a settled head.

### ⚠️ MY OWN D3 MISS — I called the delta "the fix" and never enumerated the gitlink

**Approver caught it; MINE-VERIFIED after.** `11eefdc6..5f00bdc5` is **3 commits,
6 files, +246/−24 = 270 lines**, not just #813:

| commit | what |
|---|---|
| `57b5dec033c9` | #806 README license correction |
| **`fcbacea7433b`** | **#808 "Validate pipeline cache blob lengths and offsets before use"** — `vk-pipeline.cpp` **+75/−21** + `tests/test-pipeline-cache.cpp` **+165** |
| `5f00bdc50f1f` | **#813** the actual fix — `vk-buffer.cpp` +1/−1, `d3d12-device.cpp` +1/−1 |

⇒ ⛔⭐⭐⭐**I wrote "the delta IS the fix" one round after filing D3, whose whole
content is that a `+1/−1` gitlink conceals its payload.** The fix is **2 source
lines**; the gitlink carried **~250 lines of unrelated arriving code** under the
message *"update slang-rhi"*. **I applied the D3 lesson to the RISK direction and
not to the REMEDY direction — the same "must not be debounced as trivial in either
direction" I had just written.** ⭐⭐**Having filed a lesson is not having applied
it; the application is a separate act with its own failure mode.**

🔴**And #808 is not inert for me: `vk-pipeline.cpp` is the file at the centre of
the LIVE [[project_slangpy_1089_shader_cache_path_vulkan_segv]] chain** (P1,
`shader_cache_path` SIGSEGV on first pipeline creation, **still OPEN**, assignee
`kaizhangNV`). #808 merged 2026-08-04T22:42:45Z and **arrives in slangpy via this
very pin bump.** My #1089 row already lists *"#808 MERGED"* and *"NEITHER carries
`Fixes`"* — ⇒ **this PR is the vehicle by which #808 lands in slangpy, which is a
#1089 RESUME condition I have to evaluate on its own thread, not here.**
⭐**A pin bump on PR A can silently satisfy or invalidate a premise on unrelated
chain B — enumerate the bump's commits against your OTHER live chains, not just
the current one.**

### 🟢 R3 CI — MINE-VERIFIED BY TEST NAME on the legs that CRASHED at R2

**2 of the 4 R2-failing legs have landed and both flipped to green.** Read from
job logs, by test name, with a non-zero control (11,141 lines) — not from job
conclusions:

| leg | R2 @ `bb870c1750cc` | R3 @ `eca1dc49e1eb` |
|---|---|---|
| linux x86_64 gcc **Debug** (92898524558) | `1 failed, 4139 passed` — `gw0` crashed | ✅**`4148 passed`**, 0 crashes |
| linux x86_64 gcc **Release** (92898524634) | `1 failed, 4139 passed` — `gw1` crashed | ✅**`4148 passed`**, 0 crashes |

All four pre-registered rows present on the Release leg, exactly as specified:
```
PASSED  test_buffer_from_native_handle[DeviceType.vulkan]
PASSED  test_buffer_from_native_handle[DeviceType.cuda]
PASSED  test_buffer_from_native_handle_invalid[DeviceType.vulkan]
SKIPPED test_buffer_from_native_handle_invalid[DeviceType.cuda]
        (reason: "DeviceType.cuda cannot import native buffers")
```
`grep -cF "crashed while running"` = **0** (control: 11,141 lines).
**macOS Debug (92898524698): `PASSED [metal]` + `PASSED _invalid[metal]`,
`1772 passed`** — still *executing* on Metal, not skipping.

⭐**The `4139 → 4148` delta is the cleanest single figure**: +9 = the previously
crashed/uncollected tests now running. **A pass-count increase is a stronger
signal than a green conclusion** — it shows tests were *gained*, not merely that
nothing failed.

⚠️**STILL SHORT OF THE BAR — 2 legs outstanding:** both **windows msvc**
(92898524522 Debug, 92898524563 Release) still `in_progress`; macOS Release too.
CI 14/14: 10 success, 4 in_progress. **The approver is holding, correctly — "one
green leg is not four", and it set the bar before the evidence arrived.**

### ✅ Approver ran D3's OTHER half unprompted (its read, recorded as such)

Re-anchored the submodule's changed paths to the consumer tree
(`external/slang-rhi/...`) and checked against **`v0-shadow-wide`**'s
`protected_paths`: **zero hits** — the only protected glob is
`**/slang-tag-version.h` and nothing in the bump matches; 6 files / 270 lines is
inside the 8000-line / 150-file caps. ⇒ **the gitlink hides real code here but
nothing policy-relevant — stated from evidence rather than from the clause
script's silence.** ⭐**That is the difference between "the gate didn't fire" and
"I checked what the gate would have seen."**

### ⚖️ Symmetry the approver insisted on, recorded because it is fair

It caught my gitlink miss **only because my own D3 learning was in its recall
set** — it ran the enumeration *because* D3 said to. And it made the structurally
identical error at R2: **it had the per-device cut in hand and theorized a
mechanism without using it.** ⇒ **Same failure, same remedy, both directions: the
enumeration is cheap and neither tier should skip it.** ⭐**A lesson that catches
its own author's peer is doing its job; a lesson its author then fails to apply is
still doing half of it.**

### ✅ Approver's R2 mechanism correction (its own, accepted — sharper than mine)

#813's commit message supplies the precise chain, and the approver flagged that
its R2 wording implied the **upload** transition was the trigger. Correct
derivation: upload transitions `Undefined → CopyDestination` (**valid — `Undefined`
is fine as *source***), then **`requireDefaultStates()` transitions it BACK**,
making `Undefined` the **destination** ⇒ `commitBarriers` →
`calcPipelineStageFlags(..., stateAfter, src=false)` → `SLANG_RHI_ASSERT(src)` →
`abort()`. ⭐**This independently explains why `_invalid[vulkan]` PASSED** — it
never reaches the requireDefaultStates path. Verdict unaffected; mechanism sharper.

### Approver's other verified items (its reads, flagged as such)

- **`m_memory` STILL OUTSTANDING** — checked, not assumed: #813 does not touch
  `vk-buffer.h`; at `5f00bdc5` the ctor still initializes only `m_api` and the
  import still assigns only `m_buffer.m_buffer`. **Real, unfired, not required to
  clear the block.**
- **Author's platform claim ACCURATE** — `createBufferFromNativeHandle` defined in
  exactly 4 backends (d3d12/metal/vulkan/wgpu); `src/cuda/` and `src/cpu/` have
  zero. Agrees with slangpy's `native_buffer_handle_type()` switch **and** the
  test's table.
- **D3D12 got the fix too** despite never crashing (it survived only via
  `Undefined → COMMON`) — correct, it had the identical omission.
- **Harvest exit 10 = STALE, not 0** — CodeRabbit's newest review is pinned to
  `bb870c17`; falls to the Devin-only tier noting staleness, **not an abstain**.
  Confirmed a genuine skip rather than a race (CodeRabbit status already `success`
  on this head, no review-bot check-run pending) — consistent with a gitlink-only
  delta.
- ✅**Approver PRE-REGISTERED its expectation before the legs landed**: vulkan
  PASSED ×4, metal still PASSED, cuda PASSED via not-implemented, `_invalid[cuda]`
  SKIPPED — *"anything else and I don't clear the block."*
  ⭐⭐**Pre-registration converts a post-hoc reading into a test** and is the right
  answer to this session's state-5 problem (a correct conclusion licensing
  unchecked detail).

## ✅ R3 FINAL 08-07 — **BLOCK CLEARED** → **ABSTAIN_POLICY `OPEN_GAP`** @ `eca1dc49e1eb`

Ledger written, critique gate passed both stages, head re-verified unchanged after
recording, **nothing posted to GitHub**. **MINE-VERIFIED independently:**

- **Head pinned correctly** — still `eca1dc49e1eb` at decision time and after.
- 🟢**THE DECIDING QUESTION, `[DeviceType.vulkan]` PASSED BY NAME ON ALL 4 LEGS
  THAT CRASHED AT R2**, zero crash markers, against large non-zero controls:

| job | leg | vulkan | `crashed` | summary |
|---|---|---|---|---|
| 92898524558 | linux gcc Debug | **PASSED** | 0 | `4148 passed` |
| 92898524634 | linux gcc Release | **PASSED** | 0 | `4148 passed` |
| 92898524522 | windows msvc Debug | **PASSED** | 0 | `5689 passed` |
| 92898524563 | windows msvc Release | **PASSED** | 0 | `5689 passed` |

Metal still `PASSED [metal]` + `PASSED _invalid[metal]` (92898524698) — executing,
not skipping. **Pre-registered bar met 4/4 with nothing renegotiated**, cuda rows
included.
⭐**`4139 → 4148` = +9 passes; R2's total included a failure, so it is +8
COLLECTED.** The approver caught its own "+9 collected" draft error. **A
pass-count increase beats a green conclusion — it shows tests were GAINED.**

### 🔴 The carried-over gap it abstains on — and it is WORSE than R1's G2

`device.h:404` (MINE-VERIFIED, verbatim): *"\param desc Buffer description. **The
size must not exceed the native allocation.**"* — a documented promise.
**MINE-VERIFIED which backends enforce it** at rhi `5f00bdc5`, by reading each
`createBufferFromNativeHandle` body:

| backend | checks `desc.size`? |
|---|---|
| **metal** | ✅ `desc.size > nativeBuffer->length()` |
| **vulkan** | ❌ |
| **d3d12** | ❌ |
| **wgpu** | ❌ |

⇒ **3 of 4 supported import backends type-check the handle and never check the
size — all Python-reachable.**

⚠️**Sub-correction, and it is the trap the approver had just named, applied to its
own sentence.** It wrote *"wgpu's **only** `.size` line is an assignment."*
**MINE-VERIFIED: `wgpu-buffer.cpp` has THREE `.size` lines** — `:46`
`bufferDesc.size = desc.size;` (createBuffer), `:75` a `wgpuQueueWriteBuffer`
argument (createBuffer), `:146` `size_t size = bufferImpl->m_desc.size;`
(mapBuffer). **None is in `createBufferFromNativeHandle`, so the 3-of-4
conclusion HOLDS** — but "only" is wrong, and it is the *count of hits* again,
one message after coining ⭐**"a hit is not a predicate; read the operator."**
⇒ ⭐⭐⭐**The trap has a second half nobody stated: read the operator AND count the
hits.** Both halves are membership claims about the same grep, and this session
has now produced the error in both.
✅**For the record, wgpu's import path DOES validate the handle**
(`handle.type != NativeHandleType::WGPUBuffer || handle.value == 0` →
`SLANG_E_INVALID_HANDLE`) and calls `fixupBufferDesc` — it is the **size** promise
alone that goes unenforced. ⭐**The approver had this as 2 of 4 and corrected
itself UPWARD; it had missed wgpu.** ⚠️**This is R1's G2, unfixed and now
better-quantified — the abstain is on the GAP, not on the fix.**

### ⭐⭐⭐ The propagation-worthy process finding: ASK FOR BOTH DIRECTIONS BY NAME

**OUTPUT_REVIEW took 6 must-fix rounds**, three of them *the same overclaim
leaking one abstraction level at a time* (stale fact → unverified inference →
categorical claim) — because after each fix it **grepped for the phrase it had
just changed instead of the concept.** ⭐⭐**A fix verified by grepping its own new
wording cannot detect the claim reappearing in different words.**

Then the key move: **it explicitly asked the reviewer whether it had
*UNDER*-claimed anywhere — and that question is what surfaced wgpu.**
⇒ ⭐⭐⭐**Repeated narrowing rounds bias you toward UNDER-claiming, while reviewers
optimise for catching OVERclaims. So the under-claim direction has no natural
detector — ask for it BY NAME.** This is the missing counterpart to everything
this week's catalogue collected (all overclaim-shaped):
[[feedback_four_states_where_the_decisive_check_feels_unnecessary]].

### ⚠️ Two corrections it made against itself, and one against me

- **Withdrew** a relayed subagent claim of a *"byte-identical finding set"* — the
  two artifacts' hashes differ and the re-run file has zero flag titles, so it was
  **uncheckable from its evidence.** ⭐**Relaying a subagent's verification as your
  own verified fact is the same laundering as relaying a peer's.**
- **Signal quality, and it matters MORE than usual here:** harvest **exit 10
  (stale)** *and* Devin's first run also stale — **on a revision whose ENTIRE
  delta is the gitlink, i.e. precisely what a stale analysis cannot see.** It
  re-ran rather than reasoning around the gap; the re-run is head-current
  (`+5f00bdc5`, `Checks 16/16`) but establishes **head currency and unchanged
  counts only** — finding bodies come from the first run and apply to the
  unchanged non-gitlink code; **the submodule is covered solely by source reading
  + CI.** ⭐**Naming exactly what a re-run does and does not establish is the
  honest form.**
- ✅**CORRECTION TO ME (accepted, MINE-RE-VERIFIED):** ccummingsNV's review is
  **2 heads stale, not 3.** `compare/5c384a2...eca1dc4` → `ahead_by: 2`
  (`bb870c1750cc` "tests", `eca1dc49e1eb` "update slang-rhi"). **I said "three
  heads stale" twice.** The PR has had 3 *heads* (`5c384a2` → `bb870c1` →
  `eca1dc4`) but only **2 moves since the reviewed one** — I counted heads, not
  moves. ⭐**"N stale" is a DISTANCE, not a population count; say which you mean
  and run `rev-list --count`.**

## 🔁 R4 SYNCHRONIZE 08-08 — **REBASE, not a push.** Re-dispatched.

⛔⭐⭐⭐**THE OLD-HEAD COMPARE IS THE WRONG INSTRUMENT ON A REBASE — and it lied
loudly.** `compare/eca1dc49...f906a119` returns **`status: diverged`, ahead 6 /
behind 3**, listing **24 files** including 7 `.github/workflows/*` and
`external/slang-rhi` — i.e. it looked like the PR had grown enormously and taken
on CI-workflow changes. **All of that is upstream `main` traffic**, not the PR.
✅**The PR's OWN diff (`pulls/1090/files`, base…head) is 6 files, +189/−29** —
`test_buffer_from_native_handle.py`, `device.{cpp,h}`, `resource.{cpp,h}`,
`slangpy_ext/device/device.cpp`.
⇒ ⭐⭐⭐**On a `diverged` compare, STOP and switch instrument: use `pulls/N/files`
(or the merge-base), never `compare/<old-head>...<new-head>`.** The author's
commits were **rewritten** (`fac1587e5dfd` "Add Device::create_buffer_from_native_handle",
`f906a11983f8` "tests" — new SHAs for the same work). `head.ref native-buffer-handle`,
`base bd564212fc4e` (main).

🔴**AND THE GITLINK BUMP IS GONE FROM THE PR.** `external/slang-rhi` is **no longer
in the PR's diff** — the carrier of the BLOCK's fix has left. **Do not read that as
the fix being reverted.** MINE-VERIFIED:
- PR head pin == **`8ffe21c501b2`** and **`main`'s pin is the SAME** ⇒ the bump
  **landed upstream independently**, so the PR no longer needs to carry it.
- At that pin `vk-buffer.cpp` is blob **`eda0548ead59`** (identical to R3),
  `fixupBufferDesc` count **2** — `:340` `createBuffer`, **`:443`
  `createBufferFromNativeHandle`**. Fix **PRESENT**.
- `compare/5f00bdc5...8ffe21c5` → **`ahead_by: 1`** ⇒ #813 is an **ancestor**;
  the fix is retained, not reverted.
⇒ ⭐⭐⭐**A file LEAVING a PR's diff can mean "merged upstream", not "reverted" —
check the base's value before reading a disappearance as a regression.** This is
the mirror of D3: the gitlink hid an arrival, and now its *absence* hides that
nothing changed.

**Inbound scan (all 3 endpoints):** no new non-bot input — still the same 3
(`fknfilewalker` ×2, `guoxx`). CodeRabbit posted a **new COMMENTED review at
`f906a11983f8`** (08-08T07:29:22Z) ⇒ **harvest should be head-current this time,
unlike R3's exit-10.** ⚠️**ccummingsNV's `CHANGES_REQUESTED` still open, still
pinned to `5c384a20b11b`** — and note his sha **no longer exists on the branch**
after the rebase, so "N heads stale" is now ill-defined; only he can dismiss it.

**`mergeable_state: blocked`** (his review is the block). **CI NOT SETTLED:** 18/18
pagination OK — 7 success, 2 skipped, **9 in_progress**.

## ✅ R4 FINAL 08-08 — **ABSTAIN_POLICY `OPEN_GAP`** @ `f906a11983f8`; R2 BLOCK stays cleared

Ledger written, critique gate passed, head re-verified unchanged after recording,
**nothing posted to GitHub**. **MINE-VERIFIED independently:**

- **Head still pinned** `f906a11983f8`.
- 🟢**Pass set HOLDS across the rebase** — re-read by test name on the new head,
  `crashed while running` = **0** on every leg against `PASSED` controls:

| job | leg | row | summary | ctrl |
|---|---|---|---|---|
| 93075061205 | linux gcc Debug | `PASSED …[vulkan]` | `4148 passed` | 4148 |
| 93075061236 | linux gcc Release | `PASSED …[vulkan]` | `4148 passed` | 4187 |
| 93075061194 | windows msvc | `PASSED …[vulkan]` | `5689 passed` | 5689 |
| 93075061171 | windows msvc | `PASSED …[vulkan]` | `5689 passed` | 5749 |
| 93075061188 | macOS | `PASSED …[metal]` | `1772 passed` | 1772 |

Counts **identical to R3** (4148/4148/5689/5689/1772) — and the approver
**pre-registered the bar again before reading.**
- **Gap UNCHANGED** — it re-grepped all four import paths at the **new** pin rather
  than inheriting R3: only Metal enforces the size precondition. The intervening
  **#814 is inert here** (CUDA capability files only,
  `grep -c createBufferFromNativeHandle` = 0). **`m_memory` still uninitialized**
  at `8ffe21c501b2`.

### ⛔⭐⭐⭐ FOUR RANGES ANSWER TO "THE FILE COUNT" — **state the range with the number**

**MINE-VERIFIED, all four, labelled:**

| range | repo | result |
|---|---|---|
| single-commit `parents[0]...head` | slangpy | **2 files** |
| **PR-level `main...head`** | slangpy | **6 files / 218 lines** ← *the PR* |
| **PR-level `pulls/1090/files`** | slangpy | **6 files / 218 lines** (agrees) |
| **DIVERGED `old-head...new-head`** | **slangpy** | **22 files** |
| submodule rhi `11eefdc6...5f00bdc5` | slang-rhi | **6 files / 270 lines** |

⇒ ⭐⭐⭐**"The file count" is meaningless without its range.** The recorded clause
evidence (`6 changed path(s)`, `218 lines / 6 files`) matches the PR-level range
exactly — so the *dispute* was never 22-vs-24, it was **the wrong range**.

⚠️**One correction back to the approver, which it got backwards:** it said both our
numbers "described the **submodule** compare." **They did not.** The 22-file list is
the **diverged SLANGPY compare** — MINE-VERIFIED: it contains
`slangpy/tests/device/…`, `src/sgl/…`, and **`external/slang-rhi` as a single
gitlink ENTRY**, and contains **zero** rhi-internal paths (`src/vulkan/…` etc.).
The submodule compare is a **different range in a different repo** returning **6
files / 270 lines**. ⭐⭐**Two wrong numbers can share a cause and still be
mis-attributed to the wrong range — "we were both looking at X" is itself a
membership claim needing the check.** Its conclusion (*the PR is 6 files*) is right;
its account of what my 22 measured is not.

⭐⭐**AND A COLLIDING-VALUE TRAP INSIDE THE SAME TABLE (approver's catch): TWO
ranges both return "6 files"** — PR-level slangpy (6 / **218** lines) and submodule
rhi `11eefdc6...5f00bdc5` (6 / **270** lines) — **measuring entirely different
things.** ⇒ ⭐⭐⭐**A matching number is NOT evidence you are on the right range**,
which makes *"state the range with the number"* load-bearing rather than stylistic.
✅**Line counts disambiguated them here (218 vs 270) where file counts could not —
carry a SECOND dimension whenever a count is load-bearing.**

⚠️**A further collision I found, MINE-VERIFIED, which makes it worse:** the
approver cited `compare/5c384a20b11b...f906a119` and I cited
`compare/eca1dc49...f906a119` — **different bases, and BOTH return exactly 22
files with IDENTICAL file sets** (`ahead 6/behind 1` vs `ahead 6/behind 3`).
⇒ ⭐⭐**Two different ranges agreeing on both the count AND the membership is the
worst case for range confusion — the only distinguishing fields were
`ahead_by`/`behind_by`.** So "we got the same 22" could not have detected that we
were on different ranges either. **Print the range string itself, not just its
result.**

### 🔴⭐⭐⭐ THE COLLISION IS BY CONSTRUCTION, NOT COINCIDENCE — **both ranges share a merge-base**

**MINE-VERIFIED, and this supersedes the "carry a second dimension" remedy I
proposed (which FAILS on this very case):**

| range | files | lines | sorted-set sha256 | status | ahead | behind | **merge_base** |
|---|---|---|---|---|---|---|---|
| `5c384a20...f906a119` (R1 head) | 22 | **876** | `b58e4d9596a4` | diverged | 6 | **1** | **`086ca32f8db4`** |
| `eca1dc49...f906a119` (R3 head) | 22 | **876** | `b58e4d9596a4` | diverged | 6 | **3** | **`086ca32f8db4`** |

⇒ ⭐⭐⭐**GitHub's `compare` reports the THREE-DOT diff from the merge-base, so any
two bases sharing a merge-base with the head produce BYTE-IDENTICAL file lists and
counts.** The agreement is **structural**, not lucky — which is why *file count*,
*line count*, and even a *hash of the sorted membership* all collide. **No output
dimension can distinguish these queries; only the inputs can.** `behind_by` differs
only because it is computed against the base itself rather than the merge-base.

✅**Correct remedy, one level up from any output check (approver's, adopted):
PRINT THE PROVENANCE WITH THE FIGURE** —
`compare/<base>...<head> -> 22 files, 876 lines (ahead 6, behind 1)`. The
identifying string is the only field guaranteed to differ when the queries differ.
✅**And when reconciling with a peer, COMPARE INPUTS, NOT OUTPUTS** — *"which range
are you on?"* settles in one exchange what output-matching cannot settle at all.

⭐⭐⭐**GENERAL FORM: agreement on a RESULT is never evidence of agreement on the
QUERY.** This is the exact inverse of Tuesday's duplicate-artifact rule
([[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]): there,
**disagreement** was stable under mutual re-verification; here, **agreement** is.
**Both are resolved only by exchanging the artifact or the query — never by
comparing conclusions.**
⚠️**And it is ROUTINE, not exotic: neither base was wrong.** After any rebase there
are several defensible "previous heads", so this failure mode is available on
**every rebased PR**.

### ✅⭐⭐⭐ OUT-OF-SAMPLE CONFIRMATION — the mechanism predicted a case neither of us had inspected

**R2's head (`bb870c17`) was never part of the dispute.** The three-dot mechanism
predicts: same merge-base, byte-identical files/lines/membership, and
`behind_by` = 2 (between R1's 1 and R3's 3). **MINE-VERIFIED, fetched after
stating the prediction:**

```
R1 5c384a20: files=22 lines=876 set=b58e4d9596a4 mb=086ca32f8db4 ahead=6 behind=1
R2 bb870c17: files=22 lines=876 set=b58e4d9596a4 mb=086ca32f8db4 ahead=6 behind=2   <- PREDICTED
R3 eca1dc49: files=22 lines=876 set=b58e4d9596a4 mb=086ca32f8db4 ahead=6 behind=3
```

⇒ ⭐⭐⭐**This is the check that was missing from `json.loads` and `vkMapMemory`
earlier in the week: a mechanism that PREDICTS AN UNINSPECTED CASE and is then
confirmed, versus one that merely accounts for the case that prompted it.**
**Prediction-then-fetch is the counterfactual's positive twin** — cf.
[[feedback_mechanism_must_predict_observed_coordinates]], which demanded the
mechanism explain the *observed* coordinates; this goes further and demands it
call *unobserved* ones.

⛔⭐⭐**And the footgun that follows, approver's, worth the handoff: `compare`
CANNOT give you a two-dot diff at all.** If you want "changes since R1" with R1
taken **literally**, `compare` silently answers a different question whenever R1
isn't the merge-base — you need `git diff base..head` on a local clone, or both
trees. ⇒ **the "carry a second dimension" remedy was not merely insufficient, it
was UNSOUND: every output field except `behind_by` is a function of the
MERGE-BASE, not of the base you asked about.**

✅**D3 does NOT apply to this revision** — no gitlink left in the diff to
under-count. **Still valid as a general finding for the re-tightening owner; simply
not instantiated here.** ⭐**A finding can be correct and inapplicable at once; say
which.**

### ⚠️ CORRECTION TO ME — the diverged compare returns **22** files, not 24

**MINE-RE-COUNTED: `len(files)` = 22** (7 workflow + `.github/zizmor.yml` +
`external/slang-rhi` + 13 source/test). **I said 24.** ⭐⭐**I printed the list and
then stated a number I had not counted — the exact "count the hits" half of the
trap I had corrected the approver on one round earlier.** It kept 22 and shipped
the reproducing script rather than propagate either figure unverified — the right
handling.
✅**Everything else in my warning held**: `diverged`, ahead 6 / behind 3, 7 workflow
files, `pulls/1090/files` = **6 files / +189−29**.
⭐**And the trap is NARROWER than I framed it: `eval-clauses.py` is ALREADY correct**
— it diffs `base_ref...sha` and reported 6 paths / 218 lines. **The danger was a
human hand-feeding it the diverged list, not the script.** ⇒ **Name the vulnerable
STEP, not the whole tool** — I implied a tool defect where there was only an
operator one.

### 🔎 Approver's additions past my list (its reads; the two I could check, I did)

- ⭐⭐**Devin's staleness discriminator INVERTED** — with no gitlink in the
  post-rebase PR, *rendering one at all now proves staleness*. Its change-group 4
  was `slang-rhi +1/−1`, 7 files against the true 6. ⇒ **the same artifact that
  proved currency last round proves staleness this round; a discriminator's
  polarity is a function of the revision, not a fixed property.**
- Rather than assert the findings still applied, it measured **per-file blob SHAs
  across the rebase**: `resource.cpp`, `resource.h`,
  `slangpy_ext/device/device.cpp` and the test file **byte-identical** ⇒ findings
  apply verbatim; only `device.cpp`/`device.h` moved, neither for this PR's
  reasons. ⭐**Blob-SHA equality is the right instrument for "does a prior finding
  still apply after a rebase."**
- 🔴**CodeRabbit's new 🟠 Major belongs to a DIFFERENT PR — MINE-VERIFIED both
  ways:** this PR's *only* `device.cpp` hunk is **`@@ -578`**, and **#1094
  (`31a351726ec2`, "Improve persistent cache robustness")** owns **`@@ -116,8
  +116,16`** — the flagged shader-cache `create_directories`-outside-try block at
  `device.cpp:119-128`. **Genuine-looking concern, wrong PR.** ⇒ **a rebase makes a
  bot attribute upstream code to the PR that merely rebased onto it.**
- Harvest **exit 0, head-current** this time (vs R3's exit-10 stale).

### ⭐⭐ Its self-corrections, one of which is the new under-claim state firing

- **It wrote "Blocker: None" on an ABSTAIN** — conflating *"my pipeline is
  healthy"* with *"nothing blocks."* ⇒ **an under-claim, caught by OUTPUT_REVIEW,
  and exactly the direction with no natural detector.**
- **The concept-vs-phrase leak, one level deeper:** it had upgraded from
  phrase-grepping to concept-grepping **but kept `grep`**, so a claim **wrapped
  across a newline** still slipped through. **Fixed the tool class, not the
  instance** — multiline whitespace-insensitive matcher. ⭐⭐⭐**This is the
  artifact-over-noticing rule paying out: the durable fix was a better INSTRUMENT,
  not more care.** Same defect family as
  [[feedback_audit_grep_false_negatives_asymmetric]].

## RESUME triggers

- ✅ Approver verdict received 08-03 → rolled up to operator.
- **Human maintainer reviews G1/G2** — the named next-action. A non-bot review
  or comment is the resume signal.
- A `synchronize` webhook lands → **debounce the re-run, never the inbound
  scan** ([[feedback_debounce_approver_dispatch_deterministic_abstain]]): check
  head SHA moved, `compare/<decided>...<new-head>` file scope, **and** scan
  `pulls/1090/reviews` **plus** `issues/1090/comments` **plus**
  `pulls/1090/comments` for non-bot input
  ([[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]] — a
  blocking directive can arrive as a plain issue comment and a review-state
  predicate cannot fire on it).
- A non-bot comment on a chain I've closed **re-opens it** — my prior position
  is a position, not a reply.

## Notes / adjacency

- Metal + native-handle import touches the same surface family as the held
  Metal chains ([[project_10842_metal_descriptorhandle_runtime]],
  [[project_11970_metal_bindless_msl]]) and the CI-runner coverage trap: a green
  slangpy job with the Metal backend skipped is **zero** executed coverage
  ([[feedback_green_job_skipped_backend_zero_coverage]]). If the approver
  approves on "CI green", that premise needs the runner checked, not the job
  conclusion.
