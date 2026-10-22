---
type: chain
title: slang#13635 cluster — WGSL NaN/Inf const-expressions Tint rejects
description: Human-filed #13635 (asfloat of constant NaN/Inf bits) fixed by reporter PR #13645; bot follow-ups #13657/#13658/#13672 each have a bot draft PR; #13671 parked on a maintainer design choice.
tags: [wgsl, emit, tint, nan, community-pr]
---

# slang#13635 cluster — WGSL NaN/Inf const-expressions that Tint rejects

**Root fact:** WGSL §15.7 makes any NaN/Inf const-expression (or override-expression) a
shader/pipeline-creation error. Tint enforces it, Naga does not. A `@const` builtin such as
`bitcast` or `unpack2x16float` applied to a literal becomes a const-expression. Module-scope
initializers can't call user functions, so a `_slang_getNan()` helper call doesn't work there either.

| issue | filed by | fix | state (2026-10-16 11:37Z — all fixer chains closed, watch-only) |
|---|---|---|---|
| #13635 `asfloat(<const NaN bits>)` | albertrodriguezclo 13:15Z | ~~reporter PR #13645~~ closed unmerged 10-21 by jkwak-work ("complete hack"). **Bot draft #13816 @ `1c4a1531ed`** (stacked on #13669, base `fix/issue-13658`): IR-visible `bit_cast` + WGSL-only min-opt peephole + `_slang_getNan(bits)` + spec-const-rate non-const; no string matching | **RESOLVED 10-21 15:44Z**: R1 REQUEST_CHANGES (2 WGSL regressions, fixed) → R2 APPROVE_WITH_NITS (A/C not re-run in R2, for budget). Reporter Tint check ran at R1 head `2624613`, not the final head. cmt 6194445036 edited 15:44Z. Assignee/reviewer now **kaizhangNV**. Doc-regen follow-up #13821 (unlabelled). Held for operator un-draft |
| #13657 `f16tof32(<const Inf>)` | bot (triager) 15:01Z | bot draft #13670 `410a1b3d1b` | R1+R2 REQUEST_CHANGES, all applied; resolved 22:48Z (cmt 6199231398). Held for operator un-draft + maintainer design call (per-intrinsic vs general `@const` rule) |
| #13658 runtime-indexed static-const NaN table | bot 15:01Z | bot draft #13669 `f70ea437da` | RESOLVED 10-16 11:37Z: G3 driver crash fixed via bit-pattern helper bodies (GPU-verified L40S), delta R2 APPROVE_WITH_NITS, G4 anchors applied. cmt 6199105712 edited 11:36Z (⚠️ dropped). Held for operator un-draft. Perf follow-up #13682 |
| #13671 spec-constant with NaN default | bot 18:17Z | none — maintainer picks (a) drop default / (b) diagnose | design Q cmt 6199222995; one-shot `rechase-13671-override-d-c939` 10-17 15:00Z |
| #13672 `half` NaN/Inf as bare `infh` | bot 18:17Z | bot draft #13680 `c77365d9be` (needs #13669 for tables) | RESOLVED 10-16 11:37Z: f16+f32 bit-pattern helpers, delta R2 APPROVE_WITH_NITS, G1 per-helper prefixes applied; f16 Tint-only (no `shader-f16` on Dawn Vulkan). cmt 6200880363 edited 11:36Z. Held for operator un-draft; merge-conflict on shared helper comment → keep #13680 wording |

Shepherd: jkwak-work. Un-drafting any of #13669/#13670/#13680 is operator-gated.

## 2026-10-21 maintainer reversal

jkwak-work closed #13645 and asked the bot for a proper PR. The objection was aimed at matching on the intrinsic **string** in the emitter. **Bot draft #13670 uses the same pattern** (`intrinsicDefinition.startsWith("unpack2x16float")`), so it is probably exposed to the same objection. I flagged that to the triager as my inference, not as the maintainer's words. #13669 and #13680 change helper bodies and legalization instead, which is a different layer.

**10-21 07:41Z re-triage (after a ~7 h triager stall, session at $57.54 of $60):** cmt 6194445036 edited 07:40:41Z (#13645 closed by the maintainer, bot draft coming). Recommended **R**: WGSL `asfloat` lowers to the IR BitCast op (visible to SCCP), plus one bit-exact WGSL emit rule for non-finite f32 FloatLits keyed on IR op + value, building on #13669's helper bodies. R must prove the NaN payload survives (`asfloat(0x7FC00001u)` through IRFloatLit's double). Handed to fixer gj2lyx (row 64, now running; $115/$180). #13670's string match is to be raised in the new PR, not changed silently. The reporter offered Tint runs (cmt 6310655076).

**10-21 22:38Z: #13816 parked on reporter PR #13846** (fixes #13845, base master; assignees jkwak-work + reporter). #13846 adds `DoubleToFloatBits`/`FloatBitsToDouble` so constant bit-cast folds keep signaling-NaN bits. That quieting is **not WGSL-only**: SPIR-V quiets sNaNs on master too (fixer confirmed `0x7F800001` → `0x7FC00001`), so #13816's "WGSL only" caveat was wrong. Fixer agreed publicly (PR cmt 6328093368) to merge master once #13846 lands, make the one-line `DoubleToFloatBits` change at `slang-emit-wgsl.cpp:1226`, and take the reporter's `asfloat-signaling-nan.slang`. The fixer's one-shot re-check is 10-23 16:00Z. Merge order is now #13669 → #13846 → #13816 (+ #13680).

## Lessons from this chain

- **This reporter opens their own fix PR ~45 min after filing** (#13635→#13645, #13636→#13644,
  #13639→#13646, #13634→#13647…). The triager missed #13645 because it didn't re-read the timeline
  right before posting. Now standing: check the timeline before the handoff and again before
  opening a PR.
- **The triager's approach A (wrap every literal in a user-fn helper) broke `[SpecializationConstant]`
  initializers.** An `override` initializer can't call a user function. The working shape gates the
  helper on the literal being non-finite.
- **Duplicate bot status comments on all three follow-ups:** the fixer posts a fresh status comment
  instead of editing the triager's. I proposed a fixer `instructions.prepend.md` rule to the operator
  (19:48Z); no answer yet.
- Open on the operator (another chain): #13636 has bot draft #13650 and reporter PR #13644 at once.

## GPU re-verify 2026-10-16 (after GPU passthrough restored)

Dawn `backend=null` = Tint front-end only — NOT a hardware check. Dawn `backend=vulkan` on the L40S: #13645 ✅ exact bits; #13670 ✅; #13669 ⚠️ driver crash on flat f32 tables (**settled 10-16 09:16Z on option 1**: fixer changes the WGSL prelude bodies `_slang_getNan()` → `let bits = 0x7fc00000u; return bitcast<f32>(bits);` and `_slang_getInfinity` → `select(0xff800000u, 0x7f800000u, p)` bitcast, so it touches EVERY WGSL shader, replacing #5489's `0/0` bodies; triager verified it on the L40S. #13680's f16 helpers use the same `0/0` shape, a consistency follow-up); #13680 f16 not runnable (Dawn exposes no `shader-f16` on Vulkan) — Tint-only.
Triager memo `memory/issues/gpu-reverify-2026-10-16-wgsl-nonfinite.md`; fixer repro `/workspace/agent/tools/tint-13635/gpu/c6.wgsl`.

**Reviewer G3 (09:33Z, `gpu-reverify-13669.md`):** reproduced the crash with Dawn 138, the CI pin (`slang-test -wgpu`, built `-DSLANG_EXCLUDE_DAWN=OFF`). Minimized trigger: an `array<f32,N>(…)` constructor taking a `_slang_getNan()`/`_slang_getInfinity()` call (vec4/scalar don't crash); master crashes the same way for ordinary local arrays. CI can't see it (wgpu rows only on the Windows T4, and the PR had no `-wgpu` runtime row). Reviewer offered (a) entry-point init or (b) document it. Fixer took (c), the helper-body bit patterns above. **10:19Z `[Fix Report]`: #13669 → `a5a20b80ca`, #13680 → `ed7512c640` (same f32 bodies + f16 bit patterns); `-wgpu`/`-vk` runtime rows added; CODE_REVIEW approved, slang-reviewer delta review pending.** Triager edits cmts 6199105712 / 6200880363 after the delta review passes. Verdict for Slang correctness stays APPROVE_WITH_NITS.

## Operator decisions outstanding (asked 2026-10-15, unanswered at 22:50Z)

1. Un-draft #13669 (`f70ea437da`), #13680 (`c77365d9be`), #13816 (`1c4a1531ed`, after #13669). #13670 HOLD: same string-match shape jkwak-work rejected on #13645.
1b. File the NVIDIA/Dawn Vulkan pipeline crash upstream? (operator call)
2. `perf` label on #13682.
3. Fixer `instructions.prepend.md` rule: edit an existing bot status comment instead of posting a new one.
   (On #13657 R2 the fixer DID edit in place — the pattern may be self-correcting.)
4. #13636 duplicate: bot draft #13650 vs reporter PR #13644 (another chain).
