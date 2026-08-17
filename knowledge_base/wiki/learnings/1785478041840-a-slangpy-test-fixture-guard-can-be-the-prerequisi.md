---
title: "A slangpy test-fixture guard can be the PREREQUISITE that unblocks an upstream slang PR's required check — not a follow-up"
type: learning
topic: slang-compiler
source: learnings/1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md
---

# A slangpy test-fixture guard can be the PREREQUISITE that unblocks an upstream slang PR's required check — not a follow-up

**Counterintuitive gate ordering (observed on slang#12289 → slangpy#1083, Jul 2026):** When an upstream slang PR adds a diagnostic that will break a slangpy test module, the instinct is "wait for the slang PR to merge, then fix slangpy." That can be a **deadlock**. If `SlangPy Tests` is a **required=True** check on the slang PR (verify via GraphQL `isRequired` on the PR's status checks), and the slang PR's CI dispatch (`slangpy/.github/workflows/ci-latest-slang.yml`) checks out slangpy's test fixtures from **slangpy main** while building slang from the PR ref, then the slang PR **cannot merge until the slangpy-side fix is already on slangpy main**. The slangpy fix is the *prerequisite*, not the follow-up.

**How it played out:** slang#12289's new E36107 rejects typed `Buffer<uint>` on CUDA; slangpy's `test_buffer.slang` had that entry point in a shared 3-EP module → whole-module-load failure sank 2 CUDA-clean siblings (4 collateral failures) → reddened #12289's required SlangPy Tests check → #12289 BLOCKED. The unblock = land the `#ifndef __TARGET_CUDA__` guard on slangpy main first. Once merged (by the maintainer who requested it), the dispatch re-fired green and #12289 unblocked.

**Practical sequencing that worked (two independent stages, NOT coupled):**
- **Stage 1** — the guard edit itself is **pin-independent and safe to land immediately** on the current slang pin: the guard-PR's own CI builds slang from master (no E36107 yet) and the offending variant is already `pytest.skip`ped on CUDA, so the guard is a behavioral **no-op today** → green. Land it as soon as the fix mechanism is confirmed; it future-proofs and unblocks the upstream PR.
- **Stage 2** — the `SGL_SLANG_VERSION` pin bump (`external/CMakeLists.txt:85`) must wait for the slang fix to ship in a **release TAG** (slangpy pulls a prebuilt release tarball `releases/download/v${VER}/…`, not a commit SHA). Bumping before the tag exists = failed download = red CI. This stage is genuinely gated; the guard stage is not.

**Also:** a maintainer explicitly asking "make a PR" (jkwak-work comment) is a sanctioned exception to a drafts-by-default guardrail — open non-draft. But "must merge to unblock" still ≠ "bot self-merges"; the human who requested it merges. And pair a target-guard with a why-comment cross-referencing the paired `pytest.skip` ("must be removed together") so the skip doesn't later read as stale.

---

## SECOND OCCURRENCE — 2026-08-03, slang#11225 → slangpy#1087. Generalize past "test fixture."

Same shape, **but the offending code was production source, not a test fixture** — so read this pattern as *any* slangpy-side code that trips a new slang diagnostic, not just test `.slang` modules.

slang#11225 (E36121, capability-incompatible-with-target, zangold-nv, `pr: breaking change`) went red **only** on cross-repo `SlangPy Tests`. Root cause: `slangpy/src/sgl/device/shader.cpp:404-408` requests the `hlsl_nvapi` capability **unconditionally**, while the NVAPI module it backs is gated on `SGL_HAS_NVAPI && DeviceType::d3d12` at `:250` (create) and `:656` (link) — and `:503-506` already branches on that exact predicate **in the same function**. The request was strictly broader than the link; old slang tolerated it silently. 28 failures, `0 of 18535 assertions failed` — every one a thrown `Failed to load slang module`, all in the `vulkan` subcase, **zero d3d12**.

Mechanism confirmations that hold from the first occurrence:
- **`build-pr` in `ci-latest-slang.yml` runs `actions/checkout@v6` with no `ref:`** — slangpy always builds its **default branch**; `client_payload` controls only the *slang* ref. So the slangpy fix must be **merged to main**; an open or draft PR does not flip the check. (Verified again directly in the workflow this time, not just inferred from behavior.)
- **Stage 1 / Stage 2 split holds.** `external/CMakeLists.txt:85` still pins `SGL_SLANG_VERSION "2026.12"` (pre-#11225), and slangpy downloads a **release tarball** (`releases/download/v${VER}/…`), not a SHA — so the guard is a green no-op today and lands independently; the pin bump waits for a release *tag* containing the slang fix. Separate PR.

**New, load-bearing addition — a natural experiment that tells you the predicate shape.** The two failing platforms fail for *different reasons*, which proves both halves of the guard are needed: linux configures `SGL_HAS_NVAPI: OFF` (module never built, capability still requested) while windows is `ON` (d3d12 subcases **pass** — capability genuinely backed — only vulkan fails). Neither `SGL_HAS_NVAPI` alone nor the d3d12 check alone suffices. When triaging this class, diff the two jobs' **configure output**, not just their failures; if they diverge you may be looking at two mechanisms behind one error code, and that tells you the guard predicate.

**Also worth checking before you treat the unblock as urgent:** confirm the upstream PR is otherwise merge-ready. #11225 sat at `mergeable_state=blocked` with **zero human approvals** and `bmillsNV` still on requested-reviewers — so the downstream guard was **necessary but not sufficient**, and there was no deadlock racing a ready-to-merge PR. Cheap check (`pulls/N --jq '.requested_reviewers'` + `pulls/N/reviews`) that calibrates how hard to push on the draft-promotion decision.

**How to VERIFY the guard once you've scoped it → see [`1785746886431-verifying-a-guard-fix-enumerate-the-diagnostic-s-d.md`](1785746886431-verifying-a-guard-fix-enumerate-the-diagnostic-s-d.md).** That's the sibling concept, kept separate deliberately: *this* file is about merge-ordering and cross-repo sequencing; that one is about proving a guard fix is complete and actually exercised (enumerate the diagnostic's distinct pairs before recommending a single-site fix; the `SGL_LOCAL_SLANG=ON` A/B where the **without-guard** arm is the load-bearing half). Don't re-derive them here.

**Sequencing has THREE gates, not two — `merge → tag → bump`.** "The pin bump waits for a release tag" is incomplete: the upstream change is in no tag *because it isn't merged yet*. Check `pulls/N --jq '.merged'` and `releases?per_page=6` together — on 2026-08-03, slang#11225 was `merged=false` while the latest releases (`v2026.14.1` 07-30, `v2026.14` 07-24, `v2026.12.0.1` 07-16) all predated it. Full chain: downstream guard merged → upstream PR reviewed+merged → next release tag cut → pin bump.

**The guardrail tension is real and is a human call — surface it, don't resolve it.** Draft-only vs. must-be-merged-to-unblock cannot both hold. Absent a maintainer explicitly asking for a PR (the sanctioned exception above), the triaging tier should state the tension as a decision request and escalate; it should not self-promote. Also note `SlangPy Tests` is **not bot-rerunnable** — after the merge a human must re-dispatch.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785478041840-a-slangpy-test-fixture-guard-can-be-the-prerequisi.md`_
