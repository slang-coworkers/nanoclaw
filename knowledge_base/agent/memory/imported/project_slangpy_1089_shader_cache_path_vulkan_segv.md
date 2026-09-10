---
name: project_slangpy_1089_shader_cache_path_vulkan_segv
description: "slangpy#1089 — shader_cache_path segfaults on first pipeline creation (Vulkan); crash in slang-rhi vk-pipeline.cpp; dispatched to slangpy-triager 2026-08-03"
metadata: 
  node_type: memory
  type: project
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# slangpy#1089 — `shader_cache_path` SIGSEGV on first pipeline creation (Vulkan)

- **Issue:** https://github.com/shader-slang/slangpy/issues/1089 — opened 2026-08-03 by `iveevi`
- **Canonical thread:** `gh-issue-shader-slang/slangpy-1089`
- **Dispatched:** 2026-08-03 → `slangpy-triager` (issue, not a PR ⇒ triager per routing table)
- **State:** dispatched, no triage findings in hand yet. Nothing below is verified by me.

## Reporter's claims (UNVERIFIED — AI-assisted report, author says "generated with Opus 5")

- `spy.Device(type=vulkan, shader_cache_path=...)` ⇒ first `create_compute_pipeline` /
  `create_render_pipeline` terminates process with SIGSEGV, no Python exception.
  Removing the arg fixes it. `module_cache_path` alone unaffected.
- Bisect by PyPI release: 0.36.0 ok, **0.37.0 through 0.43.1 all segfault**.
- Fresh empty cache dir still reproduces ⇒ not a stale/corrupt entry.
- Crash site claimed in **slang-rhi**, not slangpy: `rhi::vk::getPipelineCacheKey`
  @ `src/vulkan/vk-pipeline.cpp:178` (0.43.1); `vk-pipeline.cpp:72` on 0.42.0
  (before `getPipelineCacheKey` was templated on the fallback-key type).
- Env: Ubuntu 24.04.4, kernel 6.17.0-1030-oem, RTX PRO 5000 Blackwell, driver 610.43.02, Py 3.13.13.
- Repro attached: `https://github.com/user-attachments/files/30668704/repro.py`

## My hypothesis flagged to triage (MINE, not the reporter's, NOT verified)

The backtrace's headline evidence — `device=0x1` alongside `device@entry=0x5464250`
in the *same* frame — is the classic gdb rendering of a **callee-clobbered / optimized-out
register** in an optimized build, not proof of a garbage pointer. Frame 1 passes the
correct `device=0x5464250`. So "reached with a garbage `device` pointer" may be a
reporting artifact over a different real fault (e.g. a null/uninit member reached
*through* a valid device, or a cache-file/mmap path). Triage should establish the
faulting instruction and dereferenced address from a debug build rather than inherit
the reporter's causal claim. See [[feedback_label_dispatch_suspicions_as_hypotheses]].

## Corrections to my own dispatch (2026-08-03, from triager)

- ❌ I told them "neither I nor (as far as I know) you hold a slang-rhi clone." **Wrong about them:**
  `external/slang-rhi` is a populated submodule in their slangpy clone ⇒ they read `vk-pipeline.cpp`
  at the pinned commit directly, no REST needed. Lesson recorded in
  [[feedback_shallow_clone_makes_your_head_the_graft_root]] — my clone-absence is evidence about me
  only, and a hedged premise still carries its instruction.
- Their submodule gives a capability I lacked: `ls-tree <slangpy-tag> external/slang-rhi` per release
  tag converts the reporter's **PyPI-release** bisect into a **slang-rhi commit range**. That is the
  discriminator for the 0.36.0→0.37.0 boundary; I flagged it to them.
- Issue was 2 min old at dispatch: zero comments, zero labels.

## Cross-repo note

If the crash is genuinely in `slang-rhi/src/vulkan/vk-pipeline.cpp`, the **fix lands in
shader-slang/slang-rhi**, and slangpy gets it via a submodule/pin bump — same shape as
[[project_12325_metal4_std_flag_vs_capability]]. slangpy's own change may be zero-line.
⚠️ I hold no slang-rhi clone — see [[feedback_shallow_clone_makes_your_head_the_graft_root]].

## Triage 2026-08-03 (slangpy-triager) + MY INDEPENDENT REST VERIFICATION

Their classification: bug / high / **P1 regression** / SGL + slang-rhi (Vulkan) / cross-repo → slang-rhi.
Posting **HELD** (root cause = hypothesis). Forwarded to `slangpy-fixer` w/ memo.

**Boundary story — I re-derived all of it myself via REST, and it holds. The rhi reading is DEAD:**

| claim | my check | result |
|---|---|---|
| pin moved across 0.36→0.37 | `contents/external/slang-rhi?ref=v0.3{6,7}.0` | ✅ `96fef6f9` → `af6a1168`, 15 commits / 78 files |
| but rhi cache code UNCHANGED | blob SHA of `src/vulkan/vk-pipeline.cpp` at both pins | ✅ **`8c37f8c6…` IDENTICAL** — same blob object, stronger than "byte-identical by inspection" |
| no cache file in the 78 | `compare` → filter pipeline\|cache | ✅ only `cuda-`/`d3d12-`/`wgpu-pipeline` + `tests/test-shader-cache.cpp` |
| slangpy is what changed | `persistent_cache.h?ref=` | ✅ **404 @v0.36.0, 200 @v0.37.0** |
| 0.37.0 first wires it | `device.cpp?ref=v0.37.0` | ✅ `.persistentPipelineCache = m_persistent_cache.get()` |

⇒ **0.37.0 did not break rhi; it became the first release to TURN ON a latent rhi path.** Their
substance was right, reached via file-existence rather than an unmoved pin.

⚠️ **Tag prefix trap:** `v0.36.0` 404s the file (real absence); bare `0.36.0` **also 404s — because
the tag doesn't exist.** Two identical 404s, different meanings. Always confirm the tag resolves
before reading a 404 as absence. Cf. [[feedback_shallow_clone_makes_your_head_the_graft_root]] mode 3.
⚠️ Memo cites `device.cpp:265-266`; at **v0.37.0** it's **`:210-211`** (`:87-93` builds the cache).
Version-dependent line cite — NAME THE REF.

**Mechanism legs — all 4 confirmed by me from source at pin `1a976874` (v0.43.1):**
- `areDefined(ProcType::Device)` → `VK_API_DEVICE_PROCS` **only**, not `VK_API_ALL_DEVICE_PROCS` (`vk-api.cpp:102`).
- `vkGetPipelineKeyKHR` is in **`VK_API_DEVICE_OPT_PROCS`** (`vk-api.h:290`, block `:255-295`) ⇒ may stay null, init still OK.
- `addFeatureExtension` returns false at `:729`/`:733` **without clearing the feature bool** (`vk-device.cpp`).
- Gate `vk-pipeline.cpp:380` tests the **feature bit** `pipelineBinaryFeatures.pipelineBinaries` (query-populated @`:673`), not the proc.

## ⭐ THE HOLE I FOUND — the memo's own mechanism is inconsistent with the reported line numbers

`getPipelineCacheKey` calls `vkGetPipelineKeyKHR` **TWICE**: `:170` (global key, `pPipelineCreateInfo=nullptr`)
then `:178-179` (pipeline key, `pNext=createInfo`). The fault is reported at **`:178` = the SECOND call**.

**A null proc predicts death at `:170`.** Reaching `:178` requires `:170` to have executed and returned
⇒ **`vkGetPipelineKeyKHR` was NOT null.** Airtight because *a null function pointer faults at the call
instruction, before any return-value check* — so `SLANG_VK_RETURN_ON_FAIL_REPORT`'s semantics don't matter.

Corroborating (weaker, gdb-dependent): a null indirect call normally shows `#0 0x0 in ?? ()` with the
caller at `#1`. Reporter's `#0` **is** `getPipelineCacheKey` — no null-PC frame.

Holds at 0.42.0 too: first call `:65`, second `:73`, reported `:72` — a 1-line slip toward the **second**
call, 8 lines from the first. So the off-by-one the triager found makes the two backtraces agree with
each other **and** does not stretch to reach the first call.

⇒ **Gate at `:380` is a REAL latent defect worth fixing (defence in depth), but it is probably NOT this
crash.** Shipping Approach A and closing #1089 without the reporter re-testing = exactly
[[feedback_descope_recheck_original_acceptance_bar]]. Their `p api.vkGetPipelineKeyKHR` ask is the right
datapoint but is a **discriminator between two live hypotheses**, not confirmation of a near-certain one.

**Triage's stated limit — ❌ RETRACTED 17:02, see R4 below.** They said "no NVIDIA Vulkan ICD"; **false**
— ICD is at `/etc/vulkan/icd.d/nvidia_icd.json`. A recon subagent had checked only
`/usr/share/vulkan/icd.d` (Mesa-only). `gdb` absent is true. slangpy-unbuilt is true.

## POSTED 2026-08-03 16:46:05 — comment `5169214782`, VERIFIED FAITHFUL BY ME

https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5169214782 · `nv-slang-bot[bot]`,
created == updated (no silent edit). I read the body: **matches the authorization exactly** — carries
the boundary finding + `device=0x1` correction, presents null-proc **vs** driver-side `pNext` as two
live hypotheses with both branches' meanings spelled out, makes **no root-cause claim**, and states
the no-repro limit publicly. Also volunteers the `shader_cache_path`-drop workaround and correctly
separates `module_cache_path` as a different subsystem. Bot-disclaimer footer present.

One supporting claim in it I had **not** checked pre-authorization and verified after (it was public
by then): "slang-rhi's pipeline cache landed months earlier" ⇒ slang-rhi#379 *Pipeline cache* merged
**2025-06-02**, `ba8a80bb`; only 2 cache-touching commits ever in `vk-pipeline.cpp` (`ba8a80bb`
2025-06-02, `1a976874` 2026-07-06 RT-pipeline fix). slangpy#561 merged **2025-10-10** ⇒ "months
earlier" is right by ~4 months. ⚠️ Lesson: I authorized a post containing a date claim I hadn't
verified — the *scope* was right but I graded the framing, not every fact.

Triager confirmed they relayed the correction to the fixer **before** the fixer started, on the
canonical thread, and flagged that Approach A must not close #1089. Their memo now carries a STATUS
CORRECTION section superseding the original mechanism; `addFeatureExtension` re-cited to `:726` (my
`:745` pointer was the `SIMPLE_EXTENSION_FEATURE` macro, not the lambda).

## R2 EDIT 16:51:56 — mechanism near-refuted; both new claims MINE-VERIFIED

Comment PATCHed in place (edit-if-self; `updated` 16:51:56 ≠ `created` 16:46:05, reporter hadn't
replied). Both changes originated with the **fixer**, were re-derived by the triager, then by me:

**1. Better discriminator — gdb ask DROPPED.** Now `device.has_feature(spy.Feature.pipeline_cache)`
— one line of Python, no debugger, no rebuild, in the MRE the reporter already has. Chain verified
by me end-to-end: `sgl/device/types.h:53` (`pipeline_cache = rhi::Feature::PipelineCache`, name map
`:137`) → binding `slangpy_ext/device/device.cpp:639` (`has_feature`). Push sites across **all** rhi
backends = exactly 2: `vk-device.cpp:1153` (inside the pipeline-binary acceptance block) and
`d3d12-device.cpp:833` (unrelated backend). ⇒ on Vulkan the flag is true **iff** the extension was
accepted. Sound probe. ⭐A discriminator the reporter will actually run beats a stronger one they bounce off.

**2. My/their null-proc mechanism now close to refuted.** Fixer refused to inherit the triager's
`:1422` "vkCreateDevice fails outright" leg (which came from **codex**, unchecked). Re-derived, and
I confirmed: `pipelineBinaries` has **one writer** — the features2 chain at `vk-device.cpp:673`;
the query at `:606-611` is a **decoy** (local `deviceFeatures2`, nothing chained, comment literally
says *"doesn't use, but useful when debugging"*). `addFeatureExtension` rejects only when the
extension is missing from `vkEnumerateDeviceExtensionProperties`. ⇒ the state the mechanism needs =
a driver reporting `pipelineBinaries` **true** while **omitting** `VK_KHR_pipeline_binary`.

⚠️ **My caveat on calling that "self-contradictory":** `pipelineBinaryFeatures` is
brace-initialized with only `sType` (`vk-api.h:502-504`) ⇒ `pipelineBinaries` starts **false**, and
the sole writer is the driver's own `vkGetPhysicalDeviceFeatures2`. So the bit can only be true if
*this driver* set it. That makes the required state **driver-self-inconsistent** — which is a strong
claim about a *conforming* driver, not an impossibility. Prototype/beta stacks (610.43.02 on
Blackwell is exactly that population) are where feature-vs-extension inconsistency actually shows
up. Fine as posted ("close to self-contradictory", branch-2 named likelier); would NOT support
closing on it. ⇒ still **two live branches**, just re-weighted.

## R3 16:57 — clean hold. Comment UNCHANGED (accurate as posted, no edit needed)

Triager accepted the qualifier and found the **worse instance themselves**: the unhedged
"driver self-contradiction" was in the **memo to the fixer**, not the public comment — hedged the
visible artifact, shipped the unhedged one to the implementer. Fixed in memo v4 + explicit
"not grounds for closing branch 1". **My gap: I gated the GitHub comment twice and never asked to
see the memo.** Lesson in [[feedback_mechanism_must_predict_observed_coordinates]].

Also conceded by them: they had only checked `Feature::PipelineCache` in Vulkan + the d3d12 hit that
fell out of the same grep — my all-backend enumeration is what actually licenses "true iff the
extension was accepted."

**Final state:** boundary SETTLED (not an rhi regression) · `device=0x1` reading SETTLED (unsafe) ·
root cause OPEN, branch 2 likelier, **branch 1 not retired**.

## R4 17:02 — ❌ TWO RETRACTIONS, and branch 1 is now REFUTED ON RUNTIME EVIDENCE

**Retraction 1 — "no NVIDIA Vulkan ICD" was FALSE.** ICD lives at `/etc/vulkan/icd.d/nvidia_icd.json`
→ `libGLX_nvidia.so.565.57.01`. Their recon subagent checked only `/usr/share/vulkan/icd.d` (Mesa-only)
and the negative was published to the memo, the **public comment**, and to me — and **I re-published it
to the operator**. `/etc/vulkan/icd.d` is the standard vendor-ICD location. Fixer caught it.

**Retraction 2 — "nobody has executed the faulting instruction" is OUTDATED.** They built the exact
state (real `VkDevice` on the L40S without `VK_KHR_pipeline_binary`, proc fetched as `initDeviceProcs`
does, both key queries replayed in order under `SA_SIGINFO`), stable ×3:

```
vkGetPipelineKeyKHR = (nil)
*** SIGSEGV at FIRST call site (:170)   si_addr=(nil)  RIP=(nil)
```

⇒ three results: (1) the proc **really is null** without the extension ⇒ the `:380` gate is a **real**
latent defect, Approach A justified on merit; (2) the fault lands at the **first** call and never reaches
the second — my ordering objection is now **demonstrated, not argued**; (3) `RIP=0x0` with **no frame for
the calling function** (control jumps to address 0), whereas the reporter has a **named** frame with a
line number inside `getPipelineCacheKey` ⇒ **different fault signature.**

⭐ **This supersedes the whole "self-contradictory" debate — and resolves it better than either of us did.**
Branch 1 dies by **fault signature**, so driver plausibility is now irrelevant: even granting an
advertises-but-omits driver, it produces the wrong crash shape. **Cuts both ways from where each of us
stood:** the mechanism leg is *more real* than their over-correction implied (proc genuinely null), and the
branch is *more dead* than my "don't collapse it to zero" hedge implied. A **signature** discriminator beats
both a probability argument and its hedge. My caveat was right in method (don't retire on plausibility) and
obsolete in fact within the hour.

Comment PATCHed 17:02:02 — I verified: ICD caveat now "L40S on 565.57.01, extension absent"; branch 1
documented as ruled out **by test**; discriminator re-framed so `True` is the **expected** answer confirming
branch 2, not a vindication of branch 1. Still true: **not a repro of #1089** (565.57.01 vs their 610.43.02,
extension absent ⇒ cache path never entered), and **Approach A must not carry `Fixes #1089`**.

⚠️ **MY FAILURE:** I relayed their environmental negative to the operator as fact in a rollup. Lesson →
[[feedback_published_negative_env_claims_need_rederivation]].

## R5 2026-08-05 22:08 — MAINTAINER ASSIGNED; 2 rhi PRs shipped, `Fixes` guardrail HELD

Webhook: `jkwak-work` → *"@kaizhangNV, please take a look at the description and see if you can work
on it."* **`kaizhangNV` is now the sole assignee.** Issue still **OPEN**, no labels, 2 comments only
(our 08-03 triage + this). ⚠️ **No `@nv-slang-bot` mention** ⇒ NOT a post-task; routing/awareness only.

⭐ **The reporter never answered the discriminator — 2 days of silence.** The whole chain was gated on
one line of Python that never came. Lesson: *a discriminator the reporter will run* still assumes they
come back at all; a 2-day-quiet gate needs its own resume path, not indefinite holding.

**Two slang-rhi PRs exist that I never received a `[Fix Report]` for** (found by looking, not by being
told — the fixer's report never reached me):

| PR | state | what |
|---|---|---|
| [#808](https://github.com/shader-slang/slang-rhi/pull/808) | **MERGED 08-04 22:42:45** | Validate pipeline cache blob lengths/offsets before use (deserialization hardening) |
| [#809](https://github.com/shader-slang/slang-rhi/pull/809) | **open, DRAFT**, `fix/pipeline-cache-proc-and-key-validation` | Approach A — only report the Vulkan pipeline cache when its entry points are present |

✅ **Both carry a "Note on shader-slang/slangpy#1089" and NEITHER carries `Fixes`/`Closes`.** I verified
by grep. #809's note is exactly the framing I asked for, unprompted: *"It is still deliberately not
marked as fixing that issue… their backtrace is inconsistent with the mechanism it repairs… That
issue's cause remains unlocated and it should stay open."* It also correctly ranks the evidence —
call-ordering as decisive, frame shape as *"short of proof on its own"* given optimized DWARF.
⇒ **The guardrail I flagged 4 rounds earlier survived into two public artifacts without me re-asserting it.**

⚠️ #809 notes `clang-format` unavailable locally ⇒ CI formatting authoritative. Also flags an
out-of-scope residual: **serializer size arithmetic (unchecked table multiply) still unaddressed.**

## R6 2026-08-05 22:14:53 — DELTA COMMENT POSTED, chain closed at our tier

Comment [`5198010118`](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5198010118) —
**fresh comment, not a PATCH**, correctly: `jkwak-work` commented after our 08-03 one, so editing in
place would have hidden the update below a human's message. ⭐**Edit-if-self applies only while yours
is still the last word.**

**I read the body — accurate on every checkable claim, no new analysis, addressed to `@kaizhangNV`.**
It does the one thing that mattered: says the comment *above it* is stale, that branch 1 was tested
and set aside, that both rhi PRs deliberately lack `Fixes` because neither fixes this, and that the
root cause is **still unlocated**. Correctly ranks call-ordering as decisive and frame-shape as
corroboration only. Names the two captures a 610.43.02 box would need: `VkResult` +
`pipelineKey.keySize` after the second query, and `info symbol $pc` at the faulting frame.

✅ **Their extra check, which I had NOT made and should have:** #808's fix is **on `main`**, not merely
merged. I re-derived it — `vk-pipeline.cpp` at `main`: `keySize > VK_MAX_PIPELINE_BINARY_KEY_SIZE_KHR`
→ `SLANG_FAIL` at **`:355-358`**, *before* the `memcpy` at `:366`; `dataOffset`/`dataSize` range-checked
against `tableEnd`/`blobSize` at `:359-363`. ⭐**"Merged" and "present on main" are different claims** —
a squash/revert/follow-up can separate them, and I pointed a maintainer at a PR without checking the
second. Sibling of [[feedback_verify_pushed_state_by_branch_not_sha]].

## R7 22:18 — `[Fix Report]` received; #809 CI green; ⭐two-surface check-count trap (MINE-verified)

Fixer's report finally arrived at the triager (root cause of the gap: **its reports had gone up its
parent edge only**). Committed to reporting on #809 draft→ready + any successor; triager will still
verify bodies itself rather than rest on the agreement.

**#809 CI at head `6eb4ffe203`: 22/22 green, 0 pending, awaiting maintainer promotion from draft.**
⭐ **I re-measured and would have reported 21.** Two independent API surfaces:

| surface | call | result |
|---|---|---|
| Checks | `commits/6eb4ffe2/check-runs?per_page=100` | `total_count: 21`, all `success` |
| **Legacy Statuses** | `commits/6eb4ffe2/status` | `state: success`, **1** — `license/cla` |

`license/cla` is a **commit status**, invisible to `check-runs` at any `per_page`. ⚠️ **My store already
held this** ([[feedback_two_nv_slang_bot_identities_cla_gate]]) — filed under *bot identity*, i.e. not
where a check-counting task looks. **A fact under the wrong retrieval key is not stored** — ⚠️true of
**MY** store specifically, NOT the general diagnosis I first offered: the triager checked and theirs was
*held-but-not-consulted*, filed under the right key (opposite remedy — procedural trigger, not
re-filing; discriminate by asking whether the note was reachable under the key you'd have used, and
**never infer a gap from your own surprise**). Cross-linked
both ways into [[feedback_filter_latest_returns_two_suites_per_sha]] with a two-call recipe.

#808 confirmed on `main` independently by them via `compare/fcbacea743...main` → `identical` (I had
verified the clamp in the file at `:355-358`; theirs is the stronger form — *tree equality*, which also
excludes a later revert).

⭐ Their disposition rule went into **`.instructions.md`, not a learning** — correct reasoning I should
adopt: *a learning doesn't fire at the moment a decision is made; standing orders load every session.*
Covers prefer-a-self-runnable-experiment, ~72h cap then escalate, never close silently, re-read your
last public comment on ownership change, and the `Fixes`-guardrail + on-`main` check.

## R8 2026-08-06 00:19 — MAINTAINER ENGAGED, accepted handoff, deferred to next sprint

`kaizhangNV` (assignee) commented [`5269592309`](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5269592309):
*"This needs further investigation, bot doesn't root cause the issue, and it points to slangpy#561 as
a possible culprit PR. Will look into that first. Self assigned, and move to next sprint."* Issue OPEN,
assignee `kaizhangNV`, milestone still null (his "next sprint" not yet stamped), 4 comments.

**Read: healthy handoff acceptance — NOT a counter-proposal / gap / refusal.** He (a) confirms our own
stated position that root cause is unlocated, (b) picks up **#561** as his first lead — which is the
boundary finding from our delta comment (0.37.0 = first release to wire `.persistentPipelineCache`,
added by #561), (c) takes ownership, (d) schedules it. Per the non-bot-author rule this is an
ownership-acceptance restatement, so **acknowledge-and-hold, no forced routing.**

⚠️ **One substance point for the triager's judgment (theirs — they own the footprint and wrote both
comments):** our finding is #561 is **correct** and merely *activated* a latent path; the actual
suspect is branch 2 (driver-side handling of the `pNext`-chained create-info on the **2nd**
`vkGetPipelineKeyKHR`). If he reads "#561 = culprit" as "#561 introduced a defect", a bisect could
burn a sprint proving a correct PR correct.

❌ **MY RELAY ERROR (caught by triager, verified by me R9):** I told the triager "the delta comment
`5198010118` directly above his already says exactly this (#561 activated a latent path)." **False.**
Verified 08-12: the **#561 mention + "turns a pre-existing cache path on" framing is in the TRIAGE
comment `5169214782`, TWO above his**; the delta comment `5198010118` never names #561 by number
(only "first release to wire `.persistentPipelineCache`"). Right value, **wrong container** — a
citation error. It would have flipped the decision: had the disambiguation truly sat directly above
his, holding = correct; it's two up in the longer comment he likely skimmed ⇒ a pointer WAS warranted.
**No `<github-post-authorized />`** — his "bot" is a third-person reference, not an @-mention asking us
to act.

## R9 2026-08-12 16:40 — pointer POSTED by triager; my relay was one comment-id off

Triager posted [`5269664944`](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5269664944):
#561 = activation point not defect origin, `vk-pipeline.cpp` blob-identical across the pin move,
suspect = 2nd `vkGetPipelineKeyKHR` at `:178-179`, captures in the comment two above. Pointer only,
"not asking you to act", fresh comment (he's human + last poster). Within post-VERIFIED. Routing
concur: ownership restatement, chain rests with him, nothing re-opened.

⭐ **Lesson — a relayed claim ABOUT AN ARTIFACT is a filesystem claim, whoever asserts it.** "My/your
comment says X" is checkable and I got the container wrong (content in `5169214782`, not `5198010118`).
The triager grepped instead of accepting it, and it **changed the outcome** — one id off would have had
them hold (thinking the info sat directly above his) or point him at a comment that doesn't contain the
fix. This is [[feedback_published_negative_env_claims_need_rederivation]]'s self-directed twin (claims
about yourself/your artifacts skip verification because they feel like recall) applied to a **relay** —
recorded fully in [[feedback_a_relayed_claim_about_an_artifact_is_a_filesystem_claim]].

## RESUME

**Root cause STILL UNLOCATED.** Branch 1 refuted by test; branch 2 (driver-side handling of the
`pNext`-chained `VkPipelineCreateInfoKHR` on the second key query) is the surviving hypothesis,
unconfirmed. Reporter never ran the `has_feature` discriminator (2 days silent).

**Now maintainer-owned:** `kaizhangNV` assigned 08-05 by `jkwak-work`. Our tiers hold nothing
actionable — the useful handoff is that #809's body already carries the full diagnosis.

**CLOSED at both our tiers 08-05 22:16.** Two real defects fixed in slang-rhi; #1089's own root cause
unlocated and correctly left OPEN. Public footprint now current (delta comment `5198010118`).
Lesson: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].

**Triggers to re-engage:** reporter posts the `has_feature` result (`True` ⇒ confirms branch 2 and the
extension IS enabled on 610.43.02, making the `pNext` path the live suspect; `False` ⇒ routes back to
us, since it would contradict the extension being enabled) · `kaizhangNV` asks a question or mentions
the bot · a `Fixes #1089` appears on #809 or any successor · #809 merges (verify #1089 stays OPEN).
