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
