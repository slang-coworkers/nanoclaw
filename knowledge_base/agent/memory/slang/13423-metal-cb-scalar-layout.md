---
type: chain
title: slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout / -fvk-use-scalar-layout
description: Triaged + reproduced, enhancement P2, not a regression (#11578 kept Metal CBs native on purpose). GO on Approach A (explicit ScalarDataLayout only) via the triager 2026-10-03
---

# slang#13423 (external reporter mellinoe, 2026-10-03)

**Triage (slang-triager, comment 5972827172, master `6ba151dcf`):** on Metal,
`getTypeLayoutRuleNameForBuffer` returns `Natural` (lower-buffer-element-type.cpp:2416-2417) before it reads
the CB's `L` operand. `usesPackedVectorStorage` (:2991-3003) packs only StorageBuffer/UserPointer.
Reflection `MetalLayoutRulesFamilyImpl::getConstantBufferRules` (type-layout.cpp:2799) ignores both.
Emitted MSL and reflection agree (`cb.B`@16, `sb.B`@12), so this is an ignored request, not a miscompile.
The origin is #11578 (fknfilewalker, merged 2026-06-13), which deliberately kept CBs, argument buffers and PBs native.
Sampled v2025.17 through v2026.19: all emit `float3`.

## Decision (mine)
- 10-03 ~19:50Z: **GO on Approach A, through the triager** (precedent #13409: external reporter, no assignee,
  no maintainer routing). Scope: honor an explicit `ConstantBuffer<T, ScalarDataLayout>` on Metal in IR and
  reflection together, Tier-2 argument-buffer rules included, plus a regression test. Default CB/cbuffer/PB/EP
  uniforms stay byte-identical. **A' (`-fvk-use-scalar-layout` changing the default Metal CB) is NOT implemented**; it goes in the
  PR as a design question for maintainers (cbuffer-vector-native-layout.slang pins native). Approach B (diagnostic) is
  out of scope.
- Overlap: draft bot PR #13300 (`feat/layout-rules-version`, last updated 10-01) touches
  lower-buffer-element-type.cpp, type-layout.cpp, ir-layout. Instruction: don't touch #13300's branch, keep the
  shared-file diff minimal, and whichever PR lands second rebases.
- 10-03 23:00Z: the triager amended the GO, and I accept the amendment. (1) **Tier-2 :2869 is dropped.**
  `MetalArgumentBufferTier2LayoutRulesFamilyImpl::getConstantBufferRules` is reachable only from :3076, which
  passes `containerType=nullptr`. All `kMetalTier2*LayoutRulesImpl_` point at `kMetalLayoutRulesFamilyImpl`
  (:2765 etc.), so nested CBs route through Tier-1 :2799 via :4328. **I verified this at `6ba151dcfc`.** Tier-2 is covered by a
  `getTypeLayout(…, MetalArgumentBufferTier2)` unit test instead. (2) `MetalConstantBuffer` gets real Metal-native IR
  rules and keeps the "natural" name hint, so default MSL stays byte-identical. (3) The Metal-only EP-uniforms guard
  stays, because without it `-fvk-use-scalar-layout` would pack IR while reflection stays native, which is a miscompile.
  The fixer is building in `wt-slang-13423`; nothing is pushed yet.

## PR #13425 (draft, opened 10-04, head `ac70249886`, nv-slang-bot)
`fix/issue-13423` → master. Label `pr: non-breaking`, closes #13423, 10 files +275/−15. **I checked all of this live on 10-04.**
New `MetalConstantBuffer` IR rule name (appended + stable name), reflection honours `ScalarDataLayoutType`,
Metal-only EP-uniforms guard, test `tests/metal/constant-buffer-scalar-layout.slang`, and the Tier-2 unit test
`unit-test-metal-scalar-constant-buffer-tier-2-reflection.cpp`. CI on the draft: 4 pass, 56 skipping; macOS
`metallib` only runs once it's un-drafted. A' is raised in the PR body as a maintainer question. The triager reported
byte-identity 25/25 and slang-test 4268/4269 (gfx-smoke fails on master too).

## 10-04 17:07Z — Triage Resolution (head `278cdfaa01`)
I checked live: draft, 14 files +540/−24, 4 incremental commits, closes #13423. slang-reviewer r2 APPROVE_WITH_NITS (0 bugs). The r1 🔴
(copying a scalar CB into an RWStructuredBuffer let `IRCopyLogical` reach a non-SPIR-V emitter, an ICE) was fixed at the producer with
`canCopyStorageValueDirectly`. Codex CODE and OUTPUT approve. Adds a docs line and bumps `k_maxSupportedModuleVersion` from 33 to 34.
The dispatch run 37218415580 is `waiting`, and pull_request CI is skipped because the PR is a draft.
**Overlap with #13386, which I verified:** both PRs rewrite the store-path hunks at master ~:1923 and ~:2105 of
lower-buffer-element-type.cpp. #13425's copy gate also fixes #13379, which #13386 fixes more broadly (`storeLogicalValue`).
**My order decision: #13386 lands first** (it is older, already reviewed, and closes #13379 + #13385). #13425 keeps its gate so it stands
alone and does not depend on an unmerged draft. If #13386 lands first, #13425 rebases and drops the gate, and keeps its tests as regression coverage.
The PR body gets a "Related to #13379 / overlaps #13386" note with no code change. Re-chase `rechase-13425-maintainer-540f` (2026-10-06 09:00Z, done).

## 10-06 09:00Z re-chase: no change on the PR
Still a draft at `278cdfaa01`, now `BEHIND` master with no conflicts. 0 human reviews and 0 human comments on #13425/#13423. Run 37218415580 is still
`waiting`. #13386 (`8d509354cd`, no commits since 10-02) and #13300 are both still unmerged drafts. The PR body already carries the #13386 overlap note.
**New owner:** on 10-05 jhelferty-nv reassigned #13423, #13379 and #13386 to **jkwak-work** (milestone Q4 2026 Fall). The #13425 assignee and review
request are still kaizhangNV, which doesn't match. I sent a reminder to the dashboard (msg 7). Next: `rechase-13425-maintainer-c1f3`, 10-09 09:00Z.

## Resumes on
A human review, an un-draft or an answer to the A' question on #13425; #13386 or #13300 merging (#13425 then rebases); a human comment on #13423; any maintainer objection on the #11578 design.
