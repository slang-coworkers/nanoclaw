---
type: chain
title: slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout / -fvk-use-scalar-layout
description: Enhancement P2, not a regression (#11578 kept Metal CBs native on purpose). GO on Approach A via the triager → draft PR #13425; parked on maintainer review/un-draft, re-merged after each stable-id/version collision (5 so far; #5 merged e855bd5db0 11-05); vk lane hit by master #14178 render-test regression, filed as #14347
---

# slang#13423 (external reporter mellinoe, 2026-10-03)

Dated re-chase readings: [[slang/13423-metal-cb-scalar-layout-rechase-log.md]] — new re-chases append **there**, not here.

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
  reflection together, plus a regression test. Default CB/cbuffer/PB/EP uniforms stay byte-identical.
  **A' (`-fvk-use-scalar-layout` changing the default Metal CB) is NOT implemented**; it is a maintainer design question in the
  PR body (cbuffer-vector-native-layout.slang pins native). Approach B (diagnostic) is out of scope.
- 10-03 23:00Z, triager amendment, accepted and verified at `6ba151dcfc`: (1) **Tier-2 :2869 dropped** —
  `MetalArgumentBufferTier2LayoutRulesFamilyImpl::getConstantBufferRules` is reachable only from :3076 with `containerType=nullptr`;
  all `kMetalTier2*LayoutRulesImpl_` point at `kMetalLayoutRulesFamilyImpl` (:2765), so nested CBs route through Tier-1 :2799 via :4328.
  Tier-2 is covered by a `getTypeLayout(…, MetalArgumentBufferTier2)` unit test instead. (2) `MetalConstantBuffer` gets real Metal-native
  IR rules with the "natural" name hint, so default MSL stays byte-identical. (3) The Metal-only EP-uniforms guard stays: without it
  `-fvk-use-scalar-layout` would pack IR while reflection stays native — a miscompile.
- **Overlaps, my order decision (10-04):** #13386 (older, reviewed, closes #13379 + #13385) **lands first**; both rewrite the store-path
  hunks at master ~:1923/~:2105 of lower-buffer-element-type.cpp. #13425 keeps its `canCopyStorageValueDirectly` copy gate (which also
  fixes #13379) so it stands alone; if #13386 lands first, #13425 merges master, drops the gate and keeps its tests. Draft bot PR #13300
  (`feat/layout-rules-version`) touches the same files: don't touch its branch, whichever lands second rebases. The PR body carries a
  "Related to #13379 / overlaps #13386" note.

## PR #13425 (draft, nv-slang-bot, `fix/issue-13423` → master)
Label `pr: non-breaking`, closes #13423, 14 files +541/−24. New `MetalConstantBuffer` IR rule name (appended + stable name), reflection
honours `ScalarDataLayoutType`, Metal-only EP-uniforms guard, copy gate, docs line, test `tests/metal/constant-buffer-scalar-layout.slang`
and unit test `unit-test-metal-scalar-constant-buffer-tier-2-reflection.cpp`. slang-reviewer r2 APPROVE_WITH_NITS (0 bugs); Codex CODE +
OUTPUT approve. The fixer merges master (never force-pushes — not authorized); worktree `wt-slang-13423`.
**No GPU CI has ever run:** the dispatch run 404'd by 10-12 and pull_request CI skips drafts, so macOS `metallib`/vk/mtl run only on un-draft.

**Stable-id / module-version collisions** (master keeps taking the PR's numbers; each one costs a merge round):

| # | found | master PR | master took | PR moved to |
|---|---|---|---|---|
| 1 | 10-09 | #13445 `e2e217dd24` | id 907, min=max 34 | 908 / max 35 → head `465250e5ac` |
| 2 | 10-15 | #13116 `c538debef6` | id 908, max 35 | 909 / max 36 → head `c994d094e1` |
| 3 | 10-21 | #13078 `9e17a9e850` | id 909 (`glslPatch`), max 36 | 910 / max 37 → head `3a41ab51a0` (verified 10-21 13:00Z) |
| 4 | 10-24 | #13406 `0bd71cd709` (+ #13706 code conflict in entry-point-uniforms.cpp) | min=max 37 | 910 / min 37 / max 38 → head `4b7541ad55` (verified 10-24 13:00Z) |
| 5 | 11-05 | #14051 `c8bd944484` (kaizhangNV, portable RT API) | ids 911/912 (skipped 910), min=max 38 | 910 (kept, unused on master) / min 38 / max 39 → head `e855bd5db0` (verified 11-05 13:00Z) |

Rival claimants on the same numbers: #13564, #13872, #13953, #13992, #14115 (drafts; see Current state) and #13406 (jhelferty-nv, min=max 37 as of 10-21) — see
[[slang/13555-ignore-capabilities-caseless-target-switch.md]]. Whoever merges second renumbers; never renumber early.

## Lessons
1. A draft PR that adds an IR inst goes stale on **id/version collision** with no text overlap on its own hunks. "BEHIND, no conflicts"
   flips to CONFLICTING within days, so check `mergeable` on every re-chase; each week as a draft costs a merge round, which is the
   cost argument for the un-draft ask.
2. **`slang-ir.h` can auto-merge to a wrong version.** In collision 3 both sides made the same `35→36` edit, so git merged it cleanly and the
   PR's "Version 36 adds MetalConstantBufferLayout" comment rode along — silently reusing master's version. Always compare the PR's
   version and ids against master's directly; `merge-tree` conflict output alone is not enough.

## Current state (11-05 13:00Z)
Head **`e855bd5db0`** (a merge of master `04d2726db0`, no force-push), draft, MERGEABLE, 9 ahead / 0 behind. Verified directly: 910 / min 38 / max 39, `MetalConstantBuffer`=8, the gate is kept and so is the WGPU→Metal order. Comment 6078307404 names the head.
**One vk failure comes from master:** `constant-buffer-scalar-layout-compute.slang` `.1 (vk)` hits slang-rhi's `m_data.size() <= destSize` because #14178 (`48802eb480`) made render-test create untyped object inputs with `createShaderObject(session, type)`, which drops `ScalarDataLayout`.
The triager's 09:39Z GO request reached no Main session, so I answered it at 13:07Z (triager seq 64): **GO (a)**. The triager reproduces on pure master, files a shader-slang/slang issue (no @-mentions, no fix chain, no expected-failure entry), keeps the test unchanged, links the issue in 6078307404 and reports the number. **Filed 11-05 13:11:57Z as [slang#14347](https://github.com/shader-slang/slang/issues/14347)** (triager seq 67/69; bot-filed, `regression` + `reproduced`, no assignee, no @-mentions; repro'd on pure master 04d2726db0, Std140 control passes; fix options A = slang-rhi session+layout entry point, B = render-test-only fallback). **Its issue_opened needs no dispatch** (Main, 11-05): GO (a) said no fix chain, and option A overlaps maintainer-owned slang-rhi#965 (jkwak-work). A fixer chain needs the operator.
CI run 42002753764 is `waiting`. 0 human reviews; the assignee and review request are still kaizhangNV. #13386 and #13300 are unmerged. Next: `rechase-13425-maintainer-37f9` 11-08 09:00Z, which also checks that the issue was filed.

## Resumes on
A maintainer comment or assignment on #14347 (filed); a human review, an un-draft or an answer to the A' question on #13425; #13386 or #13300 merging (#13425 then merges master); a human
comment on #13423; any maintainer objection on the #11578 design.
