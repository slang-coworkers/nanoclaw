---
name: project_11225_capability_target_incompat_slangpy_break
description: "slang PR #11225 (E36121 capability-incompatible-with-target, zangold-nv, fixes #4422) blocked ONLY by cross-repo `SlangPy Tests` red — 28x 'hlsl_nvapi incompatible with spirv'. Real intended break, not a flake. Root cause = slangpy src/sgl/device/shader.cpp:404-408 adds hlsl_nvapi UNCONDITIONALLY while the nvapi module link is d3d12-guarded. Fix = target/device-conditional guard in slangpy, landed alongside #11225."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-03
---

**Filed 2026-08-03 08:2xZ from slang-ci-babysitter sweep (msg 212), Main-verified via REST.**

## State (Main-verified 08-03)

- **slang PR #11225** — `zangold-nv`, head `db61cec735107248c3c87428e7814c7ca672cde2`, branch `gh-4422`, base `master`, **open / non-draft / `mergeable_state=blocked`**, label `pr: breaking change`, created 2026-05-21 (long-running), last touched 08-03T02:59Z. Title: *"Capabilities: error on capabilities incompatible with compilation target (fixes #4422)"*.
- **Combined status = `failure`, and the ONLY red is cross-repo `SlangPy Tests`** (run https://github.com/shader-slang/slangpy/actions/runs/30779697035). `license/cla` success, `CodeRabbit` success. All slang-side check-runs green (only non-success is `retry-on-gpu-failure :: skipped`, which is normal). ⇒ the PR is gated entirely on the downstream break.
- 7 files changed: `slang-check-shader.cpp`, `slang-diagnostics.lua`, `slang-target.{cpp,h}`, + 3 tests incl. new `tests/language-feature/capability/incompatible-capability-for-target.slang`.
- Zero non-bot comments on the PR (only coderabbitai auto-summary from 05-21).

## Failure signature (babysitter, causally verified in the PR's own diff)

`error[E36121]: requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'` ×28, identical on **linux-gcc AND windows-msvc**, on **both run attempts**. `sgl_tests` 172 pass / 28 fail / 3 skip but **0 of 18535 assertions failed** — every failure is a thrown `Failed to load slang module "test" from source`. Slang C++ build itself fully green (`[1450/1450]`). Deterministic ⇒ **legitimate, not rerunnable**; the change is working as designed.

Ruled out by the babysitter: fiddle/GCC-PCH break (#12227→#12233 merged 07-26; zero `'friend' used outside of class` hits, PR rebased past it), Windows `setup-python` toolcache flake (step succeeded in 98 ms), `sgl_tests` exit-code teardown flake (28 *real* case failures), CUDA-OOM (#1024), `test_nested` mismatch.

## Root cause — downstream, in slangpy (Main-verified against slangpy HEAD)

`src/sgl/device/shader.cpp`:

- L404-408 — **unconditional**: `session_options.add(CompilerOptionName::Capability, findCapability("hlsl_nvapi"))`, with an adjacent TODO noting that passing *all* detected capabilities "leads to slang compilation errors and needs more investigation."
- L250 / L656 — the actual NVAPI **module create + link are guarded**: `if (SGL_HAS_NVAPI && m_device->type() == DeviceType::d3d12)`.

So the capability request is broader than the module link it exists to support. Under #11225 that unconditional request becomes a hard error for every non-HLSL target (spirv/vulkan, and by implication metal/cuda/wgsl). **Recommended fix: gate L404-408 with the same `SGL_HAS_NVAPI && type()==d3d12` predicate as L250/L656** (or a target-conditional equivalent) so the capability is only requested where the NVAPI module is actually linked.

No existing slangpy issue: `search/issues repo:shader-slang/slangpy hlsl_nvapi` → total_count **0**; `nvapi in:title state:open` → **0**.

## Disposition / routing

- **No CI action** — not rerunnable, not a flake. Babysitter correctly took 0 reruns.
- **08-03 08:2xZ:** dispatched `slangpy-triager` on thread `gh-issue-shader-slang/slang-11225` to verify at slangpy HEAD, file the slangpy issue, and post the cross-repo coordination note on slang#11225 (closest-to-the-state owner of the verified root cause — Main does NOT post on its behalf, per [[feedback_dont_post_and_delegate_same_write]]).
- **08-03 08:27-08:29Z — triager DELIVERED, all three artifacts confirmed by Main:**
  1. **slangpy#1087 filed** — *"hlsl_nvapi capability requested unconditionally — breaks all non-HLSL targets under slang#11225"*, open, 0 comments, author `nv-slang-bot[bot]`, created 08-03T08:27:56Z. Body carries the file:line digest, the CI-run link, the ON/OFF natural experiment, the suggested patch, and the sequencing constraint. Verified at slangpy `main` @ `086ca32`.
  2. **Cross-repo verdict posted on slang#11225** — comment `5164041512` @ 08:28:25Z, *"Root cause is downstream in SlangPy — this PR is working as designed"*, links slangpy#1087. Zangold-nv now has the artifact.
  3. **`slangpy-fixer` dispatched** by the triager on thread `gh-issue-shader-slang/slang-11225` (sess-1785745778370-lgec2m, running) with the triage handoff (P1 / SGL) + a full memo, **recommending Approach A** = gate `shader.cpp:404-408` with `SGL_HAS_NVAPI && device_type == DeviceType::d3d12`.
- **The `github.issue_opened` webhook for #1087 is a bot echo of this chain's own artifact — NOT a routing inbound.** Main took **zero** dispatch on it (no double-dispatch onto a live fixer; the triager owns the fixer edge). Same rule class as the bot-comment-webhook echoes.
- 08-03 08:29Z: two new `github-actions[bot]` review-comment gaps landed on slang#11225 (`3701075305` wrong rationale comment / untested `spirv-via-glsl` branch; `3701075706` `checkCapabilities()` duplicates the `-capability` decode in `getTargetCaps()` with divergent guards). Slang-side review nits for zangold-nv — **not** blockers on our downstream fix, and not ours to drive.
- Confirmed **no slangpy fix branch exists yet** (`dev/slangpy-fixer/*` has 1051/1052/1056/1058/1062/1067/1072/1079/carrier-996 — nothing for 1087) and no open slangpy PR touches this. Fixer work is drafts-only per standing guardrail.
- **The generalizable rule** is already captured in the babysitter's shared learning `/workspace/shared/learnings/1785744645210-slang-capability-error-prs-break-downstream-slangp.md`: a slang PR whose purpose is to *add* a diagnostic will legitimately break downstream repos that trip it; verify causality in the PR's own diff (`pulls/<N>/files --jq '.[].patch'` + grep the code), and land the downstream fix alongside. Do not duplicate into a second learning.
- **08-03 08:31Z — triager posted the chain-state comment on slangpy#1087** (`5164070567`, Main-verified; id saved by the triager for edit-in-place) and holds for the fixer's `[Fix Report]`, then forwards upstream. Correctly did NOT reply to the fixer's bare ack, and did NOT touch `shader.cpp` — the fixer owns the edit and independently re-verifies the cited sites (intended redundancy on the triage).
- **RESUME** = `slangpy-fixer` opens the Approach-A draft on `dev/slangpy-fixer/1087` → **merge to slangpy `main` is required** (an open/draft PR does NOT change `SlangPy Tests`, because `ci-latest-slang.yml` checks slangpy out at its *default branch* for `repository_dispatch`) → human re-dispatch (**not bot-rerunnable**) → `SlangPy Tests` green on #11225 → #11225 unblocked (still ALSO needs `bmillsNV` review). So this chain has a **hard operator merge gate**, not just a draft gate. Or a fresh human comment on either side.

## ⚠️ SEQUENCING — guard is PREREQUISITE not follow-up (triager correction to my dispatch; Main-verified in the workflow)

My dispatch said "landed alongside #11225" — **wrong ordering**. `slangpy/.github/workflows/ci-latest-slang.yml` `build-pr` runs `actions/checkout@v6` with **no `ref:`** (L94-97) ⇒ slangpy always builds its **default branch**; `client_payload` carries only the *slang* ref (L108-111, `slang-checkout-mode`/`slang-pr-number`/`slang-ref`/`slang-repo`). So `SlangPy Tests` cannot go green until the guard is **merged to slangpy main**.

- **Stage 1 (safe now, pin-independent):** the guard itself. `external/CMakeLists.txt:85` pins `SGL_SLANG_VERSION "2026.12"` (Main-verified, pre-#11225) and L86 downloads a **release tarball** (`releases/download/v${VER}/…`), not a SHA ⇒ the guard is a green **no-op today**; lands independently.
- **Stage 2 (genuinely gated, TWO gates out):** the `SGL_SLANG_VERSION` bump. Chain = **#11225 merged → next release tag cut → bump**. #11225 is in no tag *because it isn't merged* (`merged=false`); latest version releases `v2026.14.1` 07-30 / `v2026.14` 07-24 / `v2026.12.0.1` 07-16 all predate it. Separate PR. (Fixer correction 08-03 08:46Z — my earlier "waits for a release tag" skipped the merge gate.)
- **GUARDRAIL TENSION — human call.** Drafts-only vs. must-merge-to-unblock cannot both hold. Triager correctly framed it as a decision request instead of self-promoting. No maintainer has asked for a PR here — contrast the #12289/#1083 precedent where jkwak-work explicitly did (= sanctioned non-draft exception).
- **Urgency calibration (Main-verified):** #11225 is `mergeable=true` / `mergeable_state=blocked` with **zero human approvals** — only bot COMMENTED reviews (coderabbitai 05-21, github-actions 05-21 + 08-03) — and `bmillsNV` still on requested-reviewers. The guard is **necessary but not sufficient**; nothing is racing a ready-to-merge PR, so promotion isn't urgent.

## Approach recommendation (triager memo → `/workspace/inbox/a2a-1785745829195-r0j9rq/triage-1087.md`)

Verified at slangpy `main` @ `086ca32f8db4c3b4d71ca8c43206e17e0d3481f2` (== origin/main == REST remote main). **Approach A (recommended):** wrap `shader.cpp:404-408` in `if (SGL_HAS_NVAPI && device_type == DeviceType::d3d12)` — `device_type` local already in scope at `:307`, in-function d3d12-gated-block precedent at `:381`, and `:503-506` already branches on that exact predicate **in the same function** ⇒ the fix is *consistency*, not novelty. **B** = target-format conditional (`format == SLANG_DXIL`, must move after the `:464` target switch) — semantically honest (E36121 is about the *target*, not the device) but diverges from the 3 existing sites and needs a code move. **C** = act on the `:409-413` TODO / full capability audit — **do not bundle**, unbounded, would block a cross-repo unblock behind open-ended work.

**Natural experiment — the LOAD-BEARING evidence, unaffected by the 09:36Z retraction:** linux-gcc configures `SGL_HAS_NVAPI: OFF` (module never built, capability still requested) while windows-msvc is `ON`. `SGL_HAS_NVAPI` alone insufficient; the d3d12 check alone insufficient. `SGL_HAS_NVAPI` is set in `external/CMakeLists.txt:251-259` iff target `slang-rhi-nvapi` exists (build-time, not runtime — Main-verified).

**❌ RETRACTED (09:36Z, triager-initiated, Main-reproduced) — "d3d12 subcases ran and passed, therefore decisive."** I had this in my own records and repeated it back to the triager at 09:31Z as *confirmed*. It is an **inference, not an observation**, and it is withdrawn:
- Main reproduced on the real windows job log (`actions/jobs/91619771336/logs`): **no device-creation line exists** — `grep -aoiE "creating device|device type|adapter|L40S"` returns **nothing**. Every `d3d12` string is a build artifact (`d3d12\d3d12-buffer.cpp.obj`, `d3d12SDKLayers.dll`, …).
- **The grep was vacuous.** `DEEPEST SUBCASE: ` returns **0 in both logs** — doctest prints a multi-line `DEEPEST SUBCASE STACK REACHED (DIFFERENT FROM THE CURRENT ONE):` header with the subcase name on the *next* indented line. Main confirmed: colon-form count **0**, header-form count **28**. The pattern would have "confirmed" the claim whether or not d3d12 failed ⇒ unfalsifiable.
- **Second trap:** windows.log is **CRLF** — Main confirmed **4856 of 4856 lines carry `\r`** (linux 0), so `$`-anchored patterns silently match nothing.
- **Correct extraction** (Main-reproduced): `tr -d '\r' | grep -A1 "DEEPEST SUBCASE STACK REACHED" | sed 's/^[0-9T:.Z-]* *//' | sort | uniq -c` → **28 `vulkan`, 0 `d3d12`**, header count 28 ⇒ enumeration complete. Conclusion **survives**; only the evidence quality was bad.
- **Honest published version, weakened AGAIN at 09:39Z (codex-prompted, Main-reproduced):** the assertion-gap fallback has a **live confound**. Both platforms report **identical case counts** — Main-verified `200 | 172 passed | 28 failed | 3 skipped` on *both* — with only assertions differing (win 18535 / lin 15593). Equally consistent with **Windows-only or D3D12-only assertions inside otherwise-shared cases** as with a second device iterating. Narrowing (only `testing.cpp` carries platform guards; no test sources platform-gated in cmake) reduces but doesn't eliminate it. Published texts now **name the confound** and say D3D12 CI on the PR is what would settle it.
- **⚠️ THE REAL FINDING: the d3d12 `true` arm is NOT locally verifiable, full stop.** Same claim weakened **twice** in one chain (`passed` → `no observed failure` → `consistent with, plus the alternative explanation`). **Rule: when a claim needs weakening twice, stop hedging and state that the property is unverifiable in your environment.** It rests on Windows CI where d3d12 passed unguarded — and must keep passing.
- **All three published texts corrected in place** (Main-verified: `5164041512` and #1087 body each carry an explicit retraction paragraph + the publishable extraction command; `5164070567` clean; no duplicate comments). Diagnosis and Approach A **unaffected** — nothing in the fix changes.

**⚠️ RULE (4th instance of this session's failure class, and the sharpest): a zero-count grep is only evidence if the same pattern returns non-zero for a case you know exists. Pair every absence claim with a positive control.** Re-deriving from primary source is *not sufficient* if the derivation itself cannot fail. Also: **check line endings before `$`-anchoring**, and treat "no positive marker anywhere in the log" as the first thing to test when claiming something ran.

**Scope caveat, correctly labeled as inference and kept out of the public comment as verified fact:** only vulkan/spirv is *observed* affected — the `build-pr` matrix is windows-msvc + linux-gcc only, **no metal/CUDA/CPU job** (Main-verified L80-82). The guard covers those by construction.

## 08-03 08:46Z — fixer strengthened the triage on 3 points (all Main-verified)

The `slangpy-fixer` fed back findings that the triager verified against primary sources and folded into the memo (credited). All three are real improvements, not churn:

1. **Capability *uniqueness* — the missing evidence that makes one site SUFFICIENT.** `grep -o … | sort | uniq -c` over both job logs returns exactly **one** distinct (capability, target) pair — `hlsl_nvapi` → `spirv`, 28× per platform, nothing else. The original memo recommended a one-site fix and ruled Approach C out of scope but never stated *why* one site is complete rather than merely first. Consistency with `:250/:656/:503-506` shows the fix is **idiomatic**; the enumeration is what shows it's **complete**. Had a second capability appeared, C would have been forced and the memo would have been wrong in a way its own cited evidence could not catch. **Reusable rule: when scoping a single-site fix for a diagnostic that fires N times, enumerate the distinct (subject, context) pairs — "all N are the same pair" is the sufficiency proof.**
2. **Sequencing is `merge → tag → bump` — TWO gates, not one.** My Stage-2 note said the pin bump "waits for a release tag." Incomplete: #11225 is in no tag **because it is not merged** (Main-verified: `state=open`, `merged=false`, `merged_at=null`). Latest version releases are `v2026.14.1` (07-30), `v2026.14` (07-24), `v2026.12.0.1` (07-16), `v2026.13.1`, `v2026.13` — all `target=master`, all predate any #11225 merge. So the full chain is **slangpy guard merged → #11225 reviewed+merged → next slang release tag cut → slangpy `SGL_SLANG_VERSION` bump**.
3. **Codex must-fix endorsed — a pinned-Slang build proves nothing about the bug.** Because `SGL_SLANG_VERSION 2026.12` predates #11225, a green build on the pin demonstrates *no-regression only*. The `SGL_LOCAL_SLANG=ON` A/B against #11225's head is the only thing that closes it — and **the *without-guard* arm is the load-bearing half**, since it proves the harness can reproduce E36121 at all. A with-guard-only green is indistinguishable from a setup that never exercised the code path. **Reusable rule: when validating a fix against an unreleased upstream change, the negative arm (reproduce the failure) is what makes the positive arm meaningful.**

Triager also cautioned the fixer that the **PR body must not imply urgency** — consistent with the zero-human-approvals finding. Good propagation of the calibration into the public artifact.

## 08-03 09:04Z — DRAFT PR slangpy#1088 OPEN (Main-verified at head; fix is correct, verification INCOMPLETE)

`dev/slangpy-fixer/1087` → `main`, head `998aeb236dfb0ee68ab808a0e85e6b4f970194f9`, **`draft=true`**, `nv-slang-bot[bot]`, 0 requested reviewers, **1 file / +8 −4**, `Fixes #1087`. Main read the actual patch — it **is** Approach A verbatim:

```cpp
// Add hlsl_nvapi capability.
// Must match the guard on linking the NVAPI Slang module below: requesting a capability whose
// module is absent is rejected outright for targets that cannot satisfy it.
if (SGL_HAS_NVAPI && device_type == DeviceType::d3d12) {
    session_options.add(slang::CompilerOptionName::Capability,
        int(m_device->global_session()->findCapability("hlsl_nvapi")));
}
```

Comment explains *why* (must-match-the-link-guard) rather than restating the code — correct comment discipline. Uses the `device_type` local from `:307`; `:250`/`:660` use `m_device->type()` because they're outside this function. `SGL_HAS_NVAPI` compiles in an `if` at all three sites, so it's a 0/1 define, not conditionally-undefined.

**Line-number citations Main-verified at `998aeb2`** (triager flagged the divergence from its own memo and was right to check): fixer's `:660` = the NVAPI module-link guard ✅, `:470` = `case DeviceType::d3d12: target_desc.format = SLANG_DXIL` ✅. The +4 shift is the patch's own; citing **post-patch** numbers in a PR body read at that commit is correct. Triager's pre-patch `:656`/`:468` were also right *for `086ca32`*. Both correct at their respective commits — a good reminder that file:line claims are commit-relative.

**⚠️ NOT READY — verification gate open.** All testing so far is against **pinned Slang 2026.12**, which predates #11225 ⇒ E36121 is unreachable there ⇒ proves **no-regression only, nothing about the bug**. `unit-test-cpp` 195/200, **15529/15529 assertions 0 failed**, zero nvapi errors, real `NVIDIA L40S` devices (not GPU-skipped); `test_shader_cursor.py`/`test_shader.py` 18 passed; `pre-commit` exit 0. The 5 failures are **Git LFS pointer files** unmaterialized in the container (`data/test_images/*.dds` are ASCII `version https://git-lfs.github.com/spec/v1`) — environmental, though PR body honestly notes the base commit wasn't built so their baseline is unverified.

The `SGL_LOCAL_SLANG=ON` A/B against `db61cec` is **still running** (a `--depth 1` submodule trap cost time; submodules repaired full-depth). **Gate: the without-guard arm must reproduce E36121 verbatim before the with-guard clean arm means anything.** Fixer committed to reporting *"locally unproven — rests on CI plus code inspection"* rather than letting the pinned-Slang pass stand in. Caveats correctly carried into the public PR body: `SGL_HAS_D3D12: OFF` locally ⇒ the guard's **`true` arm is unexercised**, resting on Windows CI where d3d12 passed unguarded; only spirv *observed*, metal/CUDA/CPU covered by construction and **not claimed verified**.

- **`[Fix Review Request]` → slangpy-reviewer, no verdict yet.**
- **Issue comment `5164070567` refreshed in place** (Main-verified `updated_at=09:29:22Z` vs `created_at=08:31:39Z`) with the tempo corrected — no urgency implied. Edit-in-place discipline held; no duplicate comment.
- **PR stays draft.** The promote decision is now *real* (a draft exists) but **not yet ripe** — escalating it before the A/B closes would repeat my 08:38Z error one step later.

### 09:43Z — slangpy-reviewer verdict on #1088: **APPROVE_WITH_NITS, explicitly NOT a merge gate** (the A/B is)

0 bugs, 2 gaps (both low, 1 out-of-scope), 2 open questions, 2 clarity nits. Verified independently: fresh worktree at `998aeb2`, raw CI logs re-grepped itself, read #11225's body. **Posted nothing** — no `<github-post-authorized />` in its dispatch; `send_file` only. Review returned to the fixer.

- **Reviewer's own re-derivation caught the same vacuous grep** and reached 28/28 vulkan a valid way. Its findings did not move when the fixer retracted three figures mid-review — good sign the review didn't rest on relayed prose.
- **No test gaps recommended, and the reasoning is right:** a test against pinned 2026.12 **cannot discriminate patched from unpatched**. The 28 failing vulkan subcases across 4 files already *are* the coverage, effective whenever run against affected Slang.
- **⚠️ Reviewer corrected the fixer's risk framing, and Main agrees on inspection: the PR's "unverified arm" caveat points at the wrong arm.** The guard's **`true` arm is inert by construction** — it restores the pre-patch code path verbatim, so it cannot regress. The **`false` arm is the changed behavior** (capability no longer requested); the open question is whether anything on non-d3d12 depended on the capability leaking in. Locally the false arm *did* run (`SGL_HAS_NVAPI: OFF` ⇒ predicate always false) but against a pin where E36121 is unreachable, so it couldn't discriminate. Reviewer also had no d3d12 device and **said so rather than implying coverage**.
- **Ruled out a second fix site — Main-verified at source.** `slangpy/slang/atomics.slang:57` carries an in-source `[__requiresNVAPI]` on `extension half2 : IAtomicAddable`. Not a second site, because #11225's `TargetRequest::checkCapabilities()` iterates **`targetOptionSet.getArray(CompilerOptionName::Capability)`** — i.e. E36121 fires only for **explicitly requested** capabilities, not in-source `[__requiresNVAPI]` attributes. Verified in the PR's own patch.
- **Substrate control verified (fixer's, triager-checked, Main-confirmed):** the E36121 string is *introduced by #11225's own diff* — `slang-diagnostics.lua` **+7/−1** adds `err("requested-capability-incompatible-with-target", 36121, "requested capability '~requestedCap' is incompatible with compilation target '~target'")`; `slang-target.cpp` +79/−3 adds the raise. So `strings <binary> | grep -c` is a **direct test that the build contains the change** — it can't be present otherwise. This closes a real gap in the original handoff: "the without-guard arm must reproduce E36121" never said *how you'd know the toolchain could emit it*. **Self-concealing trap:** a downloaded `2026.14.1` looks *newer* than the pinned `2026.12` while being on the wrong side of an unmerged change.
- **⚠️ HANDOFF CAVEAT for any future approver:** reviewer's container has **unauthenticated `gh` (HTTP 401)**, so its `diff_hash` is `sha256(git diff <merge-base> <head>)`, **not** of `gh pr diff` output. A downstream approver must **regenerate rather than assume**. Cf. [[project_approver_reviewer_handoff_contract_block_gap]].
- Codex OUTPUT_REVIEW: 3 rounds → `approve`, attested hash `ca36b9c1…` matches delivered file; caught 2 overclaims **of the reviewer's own** (one retracted outright). Adversarial pass earned its keep on the reviewer, not just the fixer.
- **NO approver dispatch yet** — verdict is explicitly not a merge gate, #1088 is a draft, and the A/B gate is open. Dispatching now would repeat the premature-escalation error at a new tier.

### 09:48Z — triager narrowed its OWN completeness claim; Main confirmed the limit AND supplied the mechanism it had guessed

Triager found that its "one site is a complete fix" enumeration covers the **C++ `sgl_tests` surface only, not the whole product**: `unit-test-python` = **0** and `atomics.slang` = **0** in both logs, so `atomics.slang` never compiled in that run and the enumeration *could not* have found a second capability there. Same shape as everything else today — a signal that couldn't distinguish the states in question. Conclusion still holds, on **two legs**, and the stronger one is the **reviewer's semantic argument** (E36121 fires only on explicitly *requested* capabilities), not the log count. Corrected in `5164070567` + memo. **The 56-count must not be cited as whole-product completeness.**

**Main-verified, with positive controls (the control the triager itself articulated):**
- `unit-test-python` 0 / `atomics.slang` 0 in both logs ✅ — and the patterns are **not** vacuous: `unit-test-cpp`=3, `sgl_tests`=51/39, `unit-test`=220, `pytest`=22/24, and other `*.slang` names DO appear (`neural.slang`, `meta.slang`, `nvapi.slang`, …). So the zeros are real absences, not broken patterns.
- **⚠️ But the triager's stated CAUSE was a guess that log-absence can't support.** It said the Python stage "was skipped once `sgl_tests` failed." Log-absence cannot distinguish *"ran and failed early"* from *"never a step"* from *"conditionally excluded."* **Main resolved it at the definition** (`.github/actions/build-and-test-with-slang/action.yml`): the `Unit Tests (Python)` step at `:162-166` is gated only on `if: contains(inputs.flags, 'unit-test')` — which **is** satisfied (matrix `flags: "unit-test,test-examples,crashpad"`) — and it sits **immediately after** `Unit Tests (C++)` at `:156-159` with **no `continue-on-error`**. Job stages actually invoked (Main-extracted): `setup` → `configure` → `build` → `install-slangpy-torch` → `typing-check-python` → `unit-test-cpp`, then nothing. ⇒ the mechanism is **default step-failure short-circuit**: `unit-test-cpp` failed, so the Python step never ran. Cause now **verified**, not inferred. Same conclusion, sound derivation — which is the exact distinction this session keeps teaching.
- Also confirms the earlier `pytest` count of 22/24 is *dependency-install chatter*, not a test run — another signal that would mislead if counted naively.

**Triager declined to patch a 4th time** on the d3d12 `true`-arm wording, folding it into the resolution instead — correct, and consistent with the hedge-ratchet flag. It also self-corrected that its own flat "unverifiable, weight it accordingly" **over-weights a non-risk**: an inert arm cannot behave differently from shipped code, so the precise statement is *the `true` arm needs no verification (byte-equivalent to pre-patch); only the `false` arm carries a delta, and that is what the A/B tests.*

### ✅ 09:52Z — A/B WITHOUT-GUARD ARM **REPRODUCED**; verification gate MET (with-guard arm outstanding)

**Triager reports the load-bearing half closed: 28× E36121 reproduced against local slang#11225, `33 = 28 + 5` failures (28 real + 5 LFS-environmental), 0 failed assertions.** This is the arm that mattered — it proves the harness *can* emit the diagnostic, so a subsequent clean with-guard arm is meaningful rather than vacuous. **Not yet resolved:** the with-guard arm is still outstanding. ⚠️ Do NOT treat "gate met" as "fix verified" — only the negative control landed.

**Also settled at 09:52Z — the `true`-arm framing corrected a 3rd time, but on a TECHNICAL basis (not another hedge):** E36121 is raised in `TargetRequest::checkCapabilities()` keyed on the **target**, with **no device term** ⇒ the `dxil + hlsl_nvapi` pairing **IS verifiable locally with no D3D12 device**, and compiles cleanly. So more was verified than any prior framing implied. Correct split:
- **Verified locally (no device needed):** the capability/target pairing.
- **Needs real D3D12 CI:** device creation, runtime NVAPI linkage, Windows subcase execution, the `true` branch through `create_session`.

⚠️ **Lesson on my own over-correction:** I pushed the triager to state "unverifiable, weight it accordingly." That **over-weighted a non-risk** (an inert arm can't diverge from shipped code) *and* was factually too broad. The arc `passed → no observed failure → unverifiable → partly verifiable, here's the split` is a claim drifting because each pass **restated the hedge instead of re-deriving what the code keys on**. `"can't test configuration X"` is usually too coarse — separate what needs the hardware from what only looked like it did.

**⚠️ Reviewer's per-clause attribution limit (for whenever the with-guard arm lands):** the predicate `SGL_HAS_NVAPI && type == d3d12` **short-circuits on Linux** (`SGL_HAS_NVAPI: OFF`), so a Linux A/B can confirm the guard's *effect* but **cannot attribute it to either clause**. Per-clause attribution needs a host where `SGL_HAS_NVAPI` is ON. Not a gap in the fix — a limit on what a green Linux run licenses anyone to claim.

**Unauthenticated-REST workaround (reviewer's, Main-verified):** `curl -s https://api.github.com/repos/shader-slang/slang/pulls/11225/files` returns **200 with full patch bodies** (7 `"patch"` fields) with **no auth**. Directly useful during the standing GraphQL/401 outage — a relayed figure never has to be taken on trust, even from a 401'd container.

### 09:56Z — triager SHARPENED the Linux bound; Main verified + found the G1 upgrade is only PARTLY right

**Bound confirmed, and it is stronger than "can't attribute per-clause."** Main-verified `src/sgl/CMakeLists.txt:392`: `#define SGL_HAS_NVAPI $<BOOL:${SGL_HAS_NVAPI}>` ⇒ on Linux it expands to a **literal `0`**, so `SGL_HAS_NVAPI && device_type == DeviceType::d3d12` short-circuits at the **first** clause and the d3d12 comparison is **never evaluated**. Consequences on Linux: the guard is behaviourally identical to `if (false)`, so a green with-guard arm **cannot distinguish the patch from (a) deleting the line outright or (b) guarding on `SGL_HAS_NVAPI` alone** — all three byte-identical there. ⇒ the Linux arm establishes the **mechanism** (not requesting `hlsl_nvapi` is what fixes the spirv failures) but **not the choice of predicate**. Triager sent it to the fixer pre-publication, framed affirmatively rather than as a caveat — right call, it doesn't undersell a real result.

**⚠️ Main's check on the G1 escalation — the reasoning is sound but the cited fact is half-wrong. `:507-514` does NOT "miss the device term."** Verified at `998aeb2`:
- `:507-510` — `add_macro_define("SGL_ENABLE_NVAPI", (SGL_HAS_NVAPI && m_device->type() == DeviceType::d3d12) ? "1" : "0")` ⇒ **carries the full two-clause predicate, device term included.** This is the site the PR body cites as precedent, and it is a genuine 4th consistent site.
- `:511-518` — a **separate** `#if SGL_HAS_NVAPI` preprocessor block (`NV_SHADER_EXTN_SLOT`, dxc `-I` include path) which *is* device-term-free. But it **cannot** carry one: `#if` is preprocessor-time and `m_device->type()` is a runtime call. Not an inconsistency — a different mechanism with no available device term. Also inert-by-design: it only adds a **dxc** downstream arg + a define, and dxc is the d3d12/HLSL path.
⇒ The triager conflated a runtime `? :` guard (correct, complete) with an adjacent `#if` block (structurally cannot take a device term). **G1 should stay a low/tidiness note, NOT be upgraded to "a live inconsistency in the argument the PR rests on."** The consistency argument is *unharmed* — `:250`, `:660`, and `:507-510` all carry both clauses.

Its *premise* is still right though: if the Linux arm can't discriminate the predicate, sibling-consistency carries more of the justification than before — which raises the value of the consistency argument, and makes it more important that it be stated **accurately**.

### 10:00Z — reviewer's STATIC finding (silent-drop) verified; but Main CLOSED its stated bound and it **partly refutes** "both arms inert"

**Reviewer's core finding — Main-verified at master.** `TargetRequest::getTargetCaps()` has *always* ended its requested-capability walk with `if (!targetCap.isIncompatibleWith(toAdd)) targetCap.join(toAdd);` (`slang-target.cpp:231-232`) ⇒ incompatible capabilities **fall through silently, no join, no diagnostic**. `CapabilitySet::isIncompatibleWith` (`slang-capability.cpp:587`) is true when **zero** abstract nodes intersect. So **#11225 adds no restriction** — `checkCapabilities()` is a *second walk over the same array* that merely **reports what the first was already discarding.** `hlsl_nvapi` is `hlsl`-family only, and only d3d12 cooks to `hlsl` (vulkan→spirv, metal→metal, wgpu→wgsl, cuda→cuda, cpu→cpp/llvm) ⇒ the guard's `false` arm yields a **byte-identical cooked capability set** to pre-patch. That is a genuinely stronger statement than "low risk," and it **statically closes the reviewer's own original open question** ("did anything non-d3d12 depend on the capability leaking in?" — it couldn't have).

**⚠️ Main CLOSED the bound the reviewer explicitly left open — and it does NOT fully close.** Reviewer verified only the *cooked-capability* consumer and offered to `grep` the raw-array readers. Main ran it (unauth code-search + raw.githubusercontent): **5 files read `getArray(CompilerOptionName::Capability)` directly**, i.e. bypassing `getTargetCaps()`:
- `slang-target.cpp:~215` — the cooking walk itself (the one analysed).
- `slang-check-shader.cpp:2485` — #11225's own new `checkCapabilities()` (the reporter).
- `slang-options.cpp:4515, 4582` — front-end option processing.
- **`slang-type-layout.cpp:3549`** — computes `specificCapabilityRequested`; if **no** profile *and* **no** capability was requested, it adds `CapabilityName::descriptor_handle` to the caps. **⇒ removing the array entry can flip this boolean**, which changes whether `descriptor_handle` gets added. On slangpy's non-d3d12 sessions this is exactly the arm the guard now takes.
- **`slang-ir-layout.cpp:449`** — scans the raw array for `spvBindlessTextureNV` to size `DescriptorHandle<T>` as 8/8. Keyed on a *different* atom, so `hlsl_nvapi`'s removal doesn't hit this path — but it proves the raw array is read for **layout-affecting** decisions, not just diagnostics.

⇒ **"both arms are inert for capability resolution" is true for the COOKED set but NOT unconditionally true for the raw array.** `slang-type-layout.cpp:3549` is a live mechanism by which the `false` arm could differ from pre-patch. **Likely benign for slangpy** (it passes an explicit `Profile`? — unverified; and `descriptor_handle` addition may be inert on spirv), **but it is not statically closed** and must not be published as such. This is the *fifth* time in this chain that a claim held for the surface examined and not for the surface adjacent to it.

**Also verified:** the #1088 comment's "the guard on linking the NVAPI Slang module **below**" reads correctly against the real file — link guard at `:660` (post-patch) is below the capability add at `:407`. Reviewer had initially mis-flagged and retracted this; the retraction was correct.

**Method win — `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>` fetches whole source files UNAUTHENTICATED.** Combined with the unauth `api.github.com/.../pulls/N/files`, that's a full read surface during the standing 401 outage with no checkout. Main used both this turn.

### 10:00Z — triager's G1 retraction: correct, and it retracted to the fixer FIRST

Read at `998aeb2`, agreed with Main's correction, **retracted with the fixer before replying upward** ("do not publish, pull it if it's in the body") — right ordering, since the fixer may have been drafting on it. Confirms the fourth consistent site list: `:250`, `:407`, `:660`, `:507-510` all carry the full two-clause predicate; `:511-518` is a `#if` block that structurally cannot. **G1 stays a low/tidiness note. Net effect on #1088 is STRONGER, not weaker.**

Its filed lesson is the durable one: **a line range needs the same discrimination test as a grep pattern** — "does `:507-514` carry the device term?" has different answers depending on where you cut, and that cut couldn't distinguish *inconsistent guard* from *construct that can't take one*. **Compile-time vs runtime is a real category boundary**: `#if FOO` and `if (FOO && runtime_call())` look alike in a diff and are not peers. Plus: **where a claim sits in the argument determines how much accuracy it owes** — its own Linux bound had just shifted weight onto sibling-consistency, so an overstated inconsistency would have landed in the load-bearing leg. Read from **primary source**; provenance didn't help, only method would have.

### ✅ 10:07Z — RAW-ARRAY BOUND NARROWED (both tiers converged independently; Main verified) — but ⚠️ WRONG BASELINE in the benign-ness argument

Triager (traced slang @ `db61cec`) and reviewer (retracted its overclaim, filed the correction) landed on the **same** narrowing from different directions. Main verified the decisive facts:

- **`slang-type-layout.cpp:3545-3547`** needs `hasOption(Profile) && getIntOption(Profile) != SLANG_PROFILE_UNKNOWN`. **`setProfile` is called for EVERY target** (`slang-session.cpp:176` → `slang-compiler-options.cpp:548` `set(CompilerOptionName::Profile, …)`) ⇒ `hasOption` is **unconditionally true**, so the test reduces to the *value*. `TargetDesc.profile` defaults to `SLANG_PROFILE_UNKNOWN` (`include/slang.h:4367`).
- **Main-verified in slangpy** `shader.cpp:453-456`: a real profile is set **only** for `d3d12 || vulkan` (`findProfile("sm_X_Y")`, `SGL_CHECK`ed non-UNKNOWN); TODO at `:452` explains CUDA's exclusion.
- ⇒ On **vulkan** (all 28 reproduced failures) `specificProfileRequested` is **true**, `!specificProfileRequested` short-circuits at `:3559`, capability term **never consulted** ⇒ the `slang-type-layout` mechanism is **unreachable on the failing path**. **d3d12** retains the request. **Exposure confined to `metal / cuda / wgpu / cpu`** — Main-verified all four are real slangpy targets (`shader.cpp:478-493` → METAL_LIB / WGSL / HOST_CALLABLE / PTX), merely absent from the 2-job matrix.
- `descriptor_handle` is **not** an abstract spirv no-op — `capdef:1474` `alias descriptor_handle = glsl_spirv | _sm_6_6 | cpp | cuda | metal | wgsl;` — but the profile short-circuit makes that moot for vulkan. Fires only if a `DescriptorHandle<T>` is actually laid out (`typelayout.cpp:5685, 6383`); slangpy **does** have first-class support (`slangpy_ext/utils/slangpyresources.cpp`, `device/cursor_utils.h:692`) ⇒ not hypothetical.
- Reaches the option set at all because `Capability` ∈ `CompilerOptionSet::allowDuplicate` (`slang-compiler-options.cpp:431+`) ⇒ `inheritFrom` merges **additively** session→target.

**Delta direction on the 4 exposed targets:** pre-patch the stray `hlsl_nvapi` made `specificCapabilityRequested` true and **suppressed** `descriptor_handle` auto-promotion; post-patch it is **promoted**. Reviewer notes the helper's comment says promotion applies "when no specific profile or capability was requested," so the guard *arguably* fixes a latent suppression bug — correctly flagged as **a hypothesis about intent, not verified equivalence.**

**⚠️ MAIN'S CATCH — the benign-ness argument uses the WRONG BASELINE.** Triager wrote "probably benign since those targets were erroring under #11225 anyway." That compares against a **post-#11225** world. But Stage 1 is **deliberately pin-independent**: the guard lands on slangpy `main` against **pinned 2026.12 (pre-#11225)** and ships to users **long before** #11225 merges (which needs `bmillsNV` review + a release tag after that). In that window metal/cuda/wgpu/cpu are **NOT erroring** — they work today with promotion suppressed, and the guard flips them to promoted. Correct question: ***"does `descriptor_handle` auto-promotion change behaviour on metal/cuda/wgpu/cpu under Slang 2026.12?"*** — not "were they broken under #11225 anyway." Sent to both tiers. **General rule: when a fix is deliberately pin-independent, its risk baseline is the PINNED dependency, not the unreleased upstream change that motivated it.**

**⚠️ With-guard arm now also wants a non-vulkan, non-d3d12 case (metal or cuda)** — vulkan CI **cannot** see the `descriptor_handle` flip. Reviewer flagged independently.

**Two new method lessons (both genuinely new shapes):**
1. **An inertness claim is a claim about ALL readers ⇒ the enumeration grep belongs BEFORE the conclusion, not as a bound after it.** Reviewer's own diagnosis: the analysis was right, the *order* was wrong. What made it recoverable was **naming the exact unrun command** rather than hedging vaguely — Main ran it and found the counterexample.
2. **Closing a two-clause bound may require the clause you didn't suspect, and the satisfying code may live in the OTHER repo.** Grepping *slangpy* for `CompilerOptionName::Profile` returns **nothing** (slangpy sets the `TargetDesc` **field**; slang writes the option internally) ⇒ a downstream grep would have "confirmed" no profile is ever requested — **exactly backwards**. Required following `setProfile` into its implementation to learn `hasOption(Profile)` is unconditionally true, which **inverts** the naive reading of `:3545-3547`.

### ⚠️ 10:10Z — BASELINE CORRECTION SURVIVED TESTING AT THE PIN. The `descriptor_handle` flip is LIVE in the shipping window and NOT gated on #11225.

Reviewer tested Main's baseline correction rather than accepting it. **Main independently re-verified at the `v2026.12` tag:**

- `maybePromoteDescriptorHandleCapability` at **`slang-type-layout.cpp:3519-3545` @ `v2026.12`** is **byte-identical** to master's `:3539+` — same `specificProfileRequested` term, same raw-array scan, same `if (!specificProfileRequested && !specificCapabilityRequested) { getTargetCaps(); addUnexpandedCapabilites(CapabilityName::descriptor_handle); setTargetCaps(); }`. Pure line shift, zero semantic difference.
- Reviewer also confirmed both call sites present at the pin (`:5665`, `:6363`), `capdef:1441` identical alias, `def hlsl_nvapi : hlsl;` at `:229`.
- **Pin path confirmed on BOTH legs:** slangpy's own `external/CMakeLists.txt:85` `SGL_SLANG_VERSION "2026.12"`, *and* `slang-rhi/CMakeLists.txt:148` `SLANG_RHI_FETCH_SLANG_VERSION "2026.12"` (submodule @ `1a97687`, consumed `:304-305`). Main verified the slang-rhi leg via `raw.githubusercontent.com/shader-slang/slang-rhi/1a97687/CMakeLists.txt`.

⇒ **The behaviour change is real, present-tense, and independent of #11225 ever merging.** On metal/cuda/wgpu/cpu against pinned 2026.12 — with **no E36121 anywhere in the picture** — the `hlsl_nvapi` entry currently makes `specificCapabilityRequested` true and **suppresses** the promotion; post-guard the array is empty and `descriptor_handle` is **promoted**.

**Reviewer DOWNGRADED its own "arguably fixes a latent bug" hypothesis on this basis, and the reasoning is right:** at the pin there is **no error to be traded off against**, so the flip is a **pure unforced change on four targets**, not the lesser of two evils. ⇒ *"those targets were erroring anyway"* must **not** be used to justify shipping without the metal/cuda case — that justification evaluates the wrong world.

**⚠️ NEW: the draft-promotion decision now has a second dimension.** It is no longer only "promote to unblock #11225." Stage 1 carries an **unforced, present-tense behaviour change on metal/cuda/wgpu/cpu** that ships the moment the guard lands on `main` — before #11225, independent of it. **Still NOT escalating** (would be the 3rd premature escalation today): the fixer has an open, well-specified action — a metal-or-cuda case — and the with-guard arm is outstanding. Escalate when that closes or the fixer reports it can't.

**RULE (now empirically confirmed, not just argued): when a fix is deliberately pin-independent, its risk baseline is the PINNED dependency, not the unreleased upstream change that motivated it.** Test the mechanism's presence *at the pinned tag* (`raw.githubusercontent.com/<owner>/<repo>/<tag>/<path>`) — if it's byte-identical there, the risk ships with Stage 1.

**Reviewer's refinement of the named-command rule, which is the better articulation:** *"name the specific command you didn't run"* beats *"state your limits"* because **a named command is falsifiable by anyone who reads it, so it transfers the check to whoever has the cheaper path to running it.** Here: reviewer named the grep, Main ran it in one command instead of the reviewer paying a rebuild. **A vague hedge cannot be delegated, because nobody knows what would discharge it.**

### ⚠️ 10:11Z — Main correction: `areResourceTypesBindlessOnTarget` does NOT corroborate, and the promotion does NOT drive the layout branch

Triager cited `areResourceTypesBindlessOnTarget` (`slang-type-layout.cpp:3511-3513` @ `v2026.12` = `isCPUTarget || isCUDATarget || isMetalTarget`) as "the same exposed set, corroborating the analysis." **Main-verified — two problems:**

1. **It is not the same set.** It is `cpu | cuda | metal` — **wgpu is absent**, while the exposed set (targets slangpy leaves at `SLANG_PROFILE_UNKNOWN`) is `metal | cuda | wgpu | cpu`, and `capdef` `descriptor_handle` includes `wgsl`. Overlapping ≠ identical.
2. **It is an independent predicate that never reads the promoted capability**, so it cannot corroborate anything about the promotion. Verified at the call site: `:5663` `as<DescriptorHandleType>` → `:5665` `maybePromoteDescriptorHandleCapability(...)`, then the layout is chosen by `:5669` `implies(CapabilityAtom::spvBindlessTextureNV)` → uint64, else **`:5676` `areResourceTypesBindlessOnTarget(...)`** → layout of `T`, else `:5679-5683` → `uint2`. **None of those branches consult `descriptor_handle`.** ⇒ *the promotion does not change `DescriptorHandle<T>`'s layout.* Two adjacent mechanisms sharing a call site got read as one.

⇒ **The residual risk is NARROWER than either tier stated, and lives somewhere else.** The promotion mutates the **target capability set** (`addUnexpandedCapabilites` + `setTargetCaps`), so its observable effect is on **capability checking/diagnostics** — whether using `DescriptorHandle`-related features is accepted or rejected — **not** on layout/sizing. So the fixer's cuda A/B should look for **capability-validation differences (accept/reject, diagnostics)**, not for layout or size changes; a layout-identical result would be **expected either way** and must not be read as "no flip." Same non-discriminating-signal trap, pre-empted.

**Method lesson (new shape, 8th instance): two mechanisms at the same call site are not one mechanism, and a predicate whose *set* overlaps your exposed set is not evidence about your mechanism.** Corroboration requires a **causal** path from your mechanism to the observed value, not a coincident set membership. Check what the branch actually reads.

Triager's other narrowing **is** sound and Main confirms it: promotion fires **only** inside `as<DescriptorHandleType>` branches (`:5665`, `:6363` @ pin) ⇒ no `DescriptorHandle` in a shader means no change either way; and it is **not** vacuous, since slangpy has a real marshall (`slangpyresources.cpp:74`) reachable from Python. Its doc comment at `:3516-3518` confirms "auto-promotion mode … only when no specific profile or capability was requested" ⇒ the stray `hlsl_nvapi` has been **silently suppressing** auto-promotion on every non-d3d12/vulkan target all along. Also correct process: it sent the fixer a replacement rationale + a cheap concrete ask (its Stage 1 log showed a **real cuda device**, so one `DescriptorHandle` compile ± guard settles it) and **explicitly told them not to hold the PR on it**.

## ✅✅ 10:35Z — CHAIN COMPLETE ON THE COWORKER SIDE: fix VERIFIED against affected Slang. Terminal state = maintainer-owned.

**Main-verified at head:** #1088 `1dc014be3029b3f20a7f0e58c3f99b1b44befa28` (moved from `998aeb2`), **`draft=true`**, `+8/−5`, 1 file, **0 requested reviewers**, `mergeable_state=blocked`, `Fixes #1087`. Triager re-read the diff at the new head — still Approach A, comment reworded, **no scope creep**.

**A/B RESULT (comment `5164941137`, Main-read): 28 × E36121 WITHOUT the guard, 0 WITH it; 28 failing cases recover; `33 = 28 + 5` closes against the LFS-pointer failures.** Three `slangc` arms isolate causation independently.

**The fixer's provenance control is exemplary and is the model to reuse** — it did *not* infer from a version string:
- Local slang built from `pull/11225/head`: `git describe --tags` → `v2026.14.1-24-gdb61cec`; diagnostic-adding commit `cf54d67` identified in the ancestry.
- **Binary positive control:** `strings … | grep -c 'is incompatible with compilation target'` = **2** on the source-built `libslang.so` vs **0** on the downloaded `slang-2026.14.1` release. ⇒ proves the diagnostic is *compiled into the library under test*, and directly defeats the release-artifact-looks-newer trap from earlier in this chain.
- Head-move handled honestly: A/B ran at `998aeb2`; `git diff 998aeb2 1dc014b` = **0 changed non-comment lines**, so the result carries over — stated rather than assumed.

**Bound correctly published, not hidden:** `SGL_HAS_NVAPI` is `0` on Linux ⇒ predicate short-circuits ⇒ the A/B validates the **mechanism**, not the **choice of predicate**.

**Issue comment `5164070567` refreshed in place** — Main-verified: `1dc014b` present; **zero** occurrences of `998aeb2` / `15733` / "subcases passed" / "did execute". Still one comment, no duplicates. Triager correctly did **not** suppress the issue post: the workflow's exemption requires a **non-draft** PR carrying the trail, and this is a draft (matches the drafts-held-still-need-an-issue-footprint rule).

**Maintainer-owned residuals, all recorded publicly on the PR:** (1) promotion out of draft, (2) the merge-order call — guard must reach slangpy `main` before #11225 can go green, (3) D3D12 CI for the `true` branch, (4) broader `descriptor_handle` coverage on metal/cuda/wgpu/cpu. **No urgency** — #11225 unmerged, **0 human approvals**, `bmillsNV` outstanding.

## ✅✅✅ 15:14Z — MAINTAINER-APPROVED + CI GREEN + the `true`-arm caveat CLOSED BY EVIDENCE. Promote decision fully ripe.

**Main-verified via REST (approval binds to current head — the check that GraphQL's `reviewDecision` can't make):**
- **`skallweitNV` [MEMBER] `APPROVED`, `commit_id=1dc014b` == PR head `1dc014b`**, submitted 15:14:36Z, **empty body** (= wordless go-ahead, per [[feedback_empty_body_review_not_an_inbound]], not an edit list).
- `draft=true`, `merged=false`, `mergeable_state=blocked`, **0 requested reviewers**. **The fixer flipped nothing** — correct; an approval is not authorization to promote.
- Check-runs at `1dc014b`: **`total_count=14`, 13 success / 1 skipped (`Claude Code Assistant`) / 0 failures.** Reconciled against `total_count` per [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].
- Issue comment `5164070567` refreshed in place: `skallweitNV` + `20238` present; `awaiting maintainer review` / `SGL_HAS_D3D12: OFF` / `would establish it` all **absent** (0 hits). Still one comment. Correctly **not** suppressed — exemption needs a non-draft PR.

**⭐ The `true`-arm caveat — the one gap flagged all day as not-locally-verifiable — is now CLOSED BY EVIDENCE.** The Windows CI job configures `SGL_HAS_NVAPI: ON` + `SGL_HAS_D3D12: ON`, i.e. exactly the configuration where the guard **keeps** the request, and passes 200/200 cases / 20238 assertions / zero `E36121`. **Main verified the load-bearing structural claim at source rather than trusting the tally:** `tests/sgl/testing.cpp:72-83` @ `1dc014b` — `#if SGL_WINDOWS` → `device_types{d3d12, vulkan}` and `for (DeviceType device_type : device_types) { SUBCASE(enum_to_string(device_type)...) }` ⇒ **d3d12 genuinely EXECUTES as its own subcase, not merely "enabled."** Three skips reconcile exactly (two `TEST_CASE_GPU(… * doctest::skip())` at `test_profiler.cpp:598` / `test_hot_reload.cpp:470`, plus one non-GPU skip at `test_profiler.cpp:332`).

**⚠️ FIXER'S NEAR-MISS — the session's pattern with the SIGN INVERTED, and this is the best single argument for the control we converged on.** It almost cited *"zero `DEEPEST SUBCASE: d3d12` failures"* as proof the d3d12 arm was clean. But doctest emits that block **only while logging failures** ⇒ in a 0-failure run its absence is **structurally guaranteed regardless of truth**. This morning the same string was a vacuous **negative** (0 because the pattern was wrong); here it would have been a guaranteed **positive**. Fixer caught it itself and downgraded the +3070 assertion delta to *consistent with* rather than proof — correct handling.

⇒ **This is why the control must be "could this have come out differently if I were wrong?" and NOT any list of known-bad patterns.** The same token flipped sign within one day; a pattern blocklist would have missed the second instance entirely. **Nine instances in one chain.**

**Terminal state — maintainer-owned, nothing pending on any coworker:** promotion out of draft, then merge. Merge order unchanged (guard must reach slangpy `main` before `SlangPy Tests` on #11225 can go green). Only open follow-up = the `descriptor_handle` capability-set question on metal/cuda/wgpu/cpu — **not a gate**, unaffected by the approval.

### ❌ MY OWN ERROR — "`#if` structurally cannot take a device term" is FALSE (fixer caught it; Main-verified the refutation)

I wrote that at 10:00Z and the triager relayed it into its memo. **Wrong.** `#if` is preprocessor-time, but **its body can nest a runtime `if`.** In-repo precedent Main-verified at `1dc014b`: `src/sgl/device/helpers.cpp:64` `#if SGL_HAS_D3D12` with a runtime `if (!dxgiDebug)` at `:67` inside it.

**The conclusion survives on different grounds:** G1 stays a low note because the `:511-518` block would be **inert** (dxc-scoped downstream arg + an unconsumed define), **not** because a guard is impossible there.

**⚠️ THIS IS THE SHARPEST LESSON OF THE SESSION (8th instance): a WRONG PREMISE supporting a RIGHT CONCLUSION is the hardest error to catch, because nothing downstream looks wrong.** The triager passed it through explicitly because the conclusion matched what it already believed — and I generated it the same way. Note the compounding: I was *correcting* the triager's G1 overclaim at the time, and reached for an absolute ("structurally cannot") to make the correction land. The fixer independently hit the **mirror image** — correcting an overclaim by asserting its negation, which is itself an overclaim. **Corollary: when correcting someone, the correction needs the same evidentiary standard as the claim it replaces; "impossible" and "always" are the words to distrust in your own output.**

### Shared-KB hygiene — 09:52Z pass (Main; `/workspace/shared` is Main-write-only)

Reviewer filed 3 learnings; Main repaired and extended rather than duplicating:
- `1785750665244-which-arm-…` — killed a duplicated H1; replaced a **dangling wikilink**; appended the *don't-over-weight-the-inert-arm* + device-vs-non-device split.
- `1785750713482-the-unifying-diagnosis-…` — killed a duplicated H1; replaced the same **dangling wikilink** (`[[a-grep-returning-0-is-only-evidence-if-the-positive-control-returns-non-zero]]` resolved to **no file**); added *log-absence tells WHAT not WHY*, the *topically-right-semantically-empty* count (`pytest` 22 → **1** after filtering pip chatter — triager reproduced), and *run the discrimination test on the causal story, not just the conclusion*.
- `1785750679044-slang-e36121-fires-only-…` — the semantic-scope leg; left as filed.
- Earlier: merged the triager's two near-identical `grep-returning-0` files into `1785749557692-…`, later a pointer.

**⚠️ Watch for dangling wikilinks in coworker-filed learnings** — coworkers can't verify link targets resolve (read-only mount), and both of the reviewer's pointed at a filename that never existed. Also watch **duplicated H1s** (two `# …` lines) from template composition.

### ⚠️ SESSION THEME — three tiers hit the same failure class in one chain: relayed prose treated as evidence

1. **Fixer** — codex caught 3 published-text errors (assertion count 15733→15529, LFS-pointer failures misdiagnosed as "missing files", unsupported figures in a peer dispatch); self-identified root cause = **relayed subagent prose treated as evidence**. Corrected on #1088's live body, reviewer notified mid-review.
2. **Babysitter** — recorded my "draft-held" claim as fact when its own probe was hook-denied ⇒ [[project_github_actions_graphql_401_outage]]-adjacent learning `1785746988001-…`.
3. **Me** — escalated a decision whose presupposition my own verified finding disproved (below).

4. **Triager (09:36Z)** — published an **inference as decisive evidence** in three places off a **vacuous grep**. This one is the sharpest because it defeats the control the other three needed: the triager *did* re-derive from primary source, but the derivation couldn't fail. **Re-deriving from primary source is necessary, not sufficient — the derivation must be falsifiable.** Positive control required for every absence claim.

**No tier escaped clean.** I also propagated the triager's overclaim upward by repeating it back as "confirmed" at 09:31Z — a verification that re-stated a relayed framing instead of testing it, which is the same defect at one remove. Even the reviewer's own codex gate caught 2 overclaims in *its* output.

**COMPOSITE LESSON — the unifying diagnosis (triager's framing, 09:43Z, and it's the best one):** every failure in this chain is **a signal that cannot distinguish the states you care about**. Four instances: the **vacuous grep** (returns 0 whether or not d3d12 failed); the **release artifact** (a clean without-guard arm from a 2026.x download is indistinguishable from one from a correct build — and `2026.14.1` *looks newer* than the pinned `2026.12` while being on the wrong side of an unmerged PR); the **stale-symlink monitor**; and **`--depth 1` masking a fetch failure**. Add my own: an escalation whose presupposition can't be false because I never re-read it against my finding.

⇒ **Provenance discipline and method discipline are SEPARATE checks and you need both.** "Is this primary source?" catches none of the four — the vacuous grep *was* run against primary source. The second question is: **could this command/signal have returned a different answer if my hypothesis were false?** Two learnings cover the pair: `1785746988001-…` (provenance / denied-probe laundering) and `1785749557692-…` (method / positive control, dedup-merged by Main).

## ❌ MY OWN ERROR 08-03 08:38Z — escalated a decision whose premise I had already disproved (WITHDRAWN 08:5xZ)

I verified via REST that **no `1087` branch and no PR existed** — then escalated to the dashboard asking the operator whether to **promote the guard out of draft**. That question presupposes a draft. Same turn, contradicting my own finding. The babysitter relayed my framing into its memory (its probe was hook-denied), so the bad premise propagated one tier down before either of us caught it.

**Root cause is NOT a missing verification** — I had the right facts. It's that I wrote a **forward-looking framing** for the decision the chain would *eventually* need, and that framing smuggled an unverified presupposition into a human's queue. Worse than a stale log entry: a human can act on it.

**Rule:** when escalating a decision, re-read the question against the state just verified and confirm its **presupposition holds right now** — not that it will hold once in-flight work lands. Same defect class as [[feedback_authorize_comment_matches_memo_hedging]] (phrasing outran the evidence while every underlying fact was correct). Recorded in the shared learning `1785746988001-…` as a postscript, since the babysitter's file documents the downstream half.

**Verified state 08-03 08:5xZ (Main, primary source, after the babysitter's independent confirmation):** `git/matching-refs/heads/1087` empty; **0** open slangpy PRs matching `1087|nvapi` in head-ref or `nvapi|capabilit` in title (of 25 open); slangpy#1087 is an **open issue** (`state=open`, 1 comment, `pull_request=null`), not a PR. Fixer is **mid-flight**, not awaiting a human. Dashboard escalation **restated** from "promote the draft?" to "awaiting the fixer's PR; the decision arrives when it does."

**Shared-KB layout for this chain (deduped 08-03 08:5xZ).** The triager filed a standalone learning that overlapped what I'd just appended to the prerequisite learning. Resolved by **splitting along the natural seam and cross-linking**, not by deleting either:
- `1785478041840-…-prerequisi.md` = **sequencing / merge-ordering** (guard is prerequisite; draft can't flip the check; Stage-1 vs Stage-2; configure-output diff → predicate shape; `merge → tag → bump`; drafts-only tension; urgency calibration).
- `1785746886431-verifying-a-guard-fix-…d.md` = **verification** (enumerate the diagnostic's distinct pairs *before* recommending a single-site fix; `SGL_LOCAL_SLANG=ON` A/B with the without-guard arm load-bearing; declare unexercisable arms; opening a draft ≠ promoting it).
- Removed my duplicated evidence-rules block from the first file, replaced with a pointer. Both files now cross-reference each other. Third file `1785744645210-…` (babysitter) stays the CI-triage/classification entry.

**Prior art — this is the SECOND occurrence of the shape.** slang#12289 → slangpy#1083 (Jul 2026) was the same cross-repo-prerequisite pattern; I extended that shared learning (`1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md`) rather than filing a new one — key generalization: the offending code need **not** be a test fixture (here it was production source), and diffing the two jobs' *configure output* is what reveals the guard predicate.

## Auth caveat observed this session (08-03 ~08:2xZ)

GraphQL `{viewer{login}}` still **401 "Bad credentials"** (~44h, since 08-01 12:05Z per [[project_github_actions_graphql_401_outage]]); REST single-page healthy. Additionally `gh api repos/shader-slang/slang --jq .permissions` now returns **all-false** (admin/maintain/push/triage/pull) and `branches/master/protection` = 403 "Resource not accessible by integration" — matching the babysitter's identical all-false observation on slangpy, while **log/metadata reads still succeed**. Not re-escalated (already escalated 08-03 ~05:00Z; state unchanged since, per the no-reflexive-re-ping rule).

## Session theme — the one transferable control

**All 4 tiers failed the same way this session: each accepted "a signal that cannot distinguish the states it is being used to distinguish."** Instances: a vacuous grep (matches whether or not the condition holds) · a release artifact that merely *looks* newer · a stale symlink · `--depth 1` masking a fetch failure · my own unfalsifiable presupposition (assumed a branch/PR I had already disproved).

**Control: provenance AND method are two SEPARATE checks.** Confirming where a signal came from (provenance) says nothing about whether the signal could have come out differently (method). Before treating any check as evidence, ask: *if the claim were false, would this output differ?* If no, it is not evidence regardless of how trustworthy its source is. Applies to my own reasoning as much as to relayed reports — re-derive load-bearing digest claims from primary source.

Related: [[project_slang_rhi_800_metal_dispatch_indirect]] (capability/target class), [[feedback_triage_github_posting]], [[project_github_actions_graphql_401_outage]], [[feedback_never_relay_a_verdict_not_in_hand]].
