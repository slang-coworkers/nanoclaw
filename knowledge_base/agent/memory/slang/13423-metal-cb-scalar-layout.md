---
type: chain
title: slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout / -fvk-use-scalar-layout
description: Enhancement P2, not a regression (#11578 kept Metal CBs native on purpose). GO on Approach A via the triager → draft PR #13425; parked on maintainer review/un-draft, re-merged after each stable-id/version collision (7 so far; #7 found 11-11, resolved at 914/41/42, head 6c12d4114a); vk lane hit by master #14178 render-test regression, filed as #14347
---

# slang#13423 (external reporter mellinoe, 2026-10-03)

Dated re-chase readings: [[slang/13423-metal-cb-scalar-layout-rechase-log.md]] (sealed 10-04 → 11-02: [[slang/13423-metal-cb-scalar-layout-rechase-log-2026-10.md]]) — new re-chases append **there**, not here.

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
| 6 | 11-08 | #13792 `286cdeee49` (bot, Metal texture fences) + #14360 `ae4e57957a` (tangent-vector, HLSL loop scope) | id 910 (`metalTextureFence`), max 39; then min=max 40 | 913 / min 40 / max 41 → head `8fc73592b7` (verified 11-08 13:00Z) |
| 7 | 11-11 | #14344 `30f8633ac4` (Artificial decoration) | id 913 (`Decoration.Artificial`), min=max 41 (`k_max=41` auto-merged — lesson 2) | 914 / min 41 / max 42 → head `6c12d4114a` (verified 11-11 13:00Z) |

Rival claimants on the same numbers: #13564, #13872, #13953, #13992 (drafts; see Current state; #14115 closed 11-05, superseded by #14360) and #13406 (jhelferty-nv, min=max 37 as of 10-21) — see
[[slang/13555-ignore-capabilities-caseless-target-switch.md]]. Whoever merges second renumbers; never renumber early.

## Lessons
1. A draft PR that adds an IR inst goes stale on **id/version collision** with no text overlap on its own hunks. "BEHIND, no conflicts"
   flips to CONFLICTING within days, so check `mergeable` on every re-chase; each week as a draft costs a merge round, which is the
   cost argument for the un-draft ask.
2. **`slang-ir.h` can auto-merge to a wrong version.** In collision 3 both sides made the same `35→36` edit, so git merged it cleanly and the
   PR's "Version 36 adds MetalConstantBufferLayout" comment rode along — silently reusing master's version. Always compare the PR's
   version and ids against master's directly; `merge-tree` conflict output alone is not enough.
3. **A gap in master's ids is not a reservation.** #14051 skipped 910 on 11-04, so the PR kept it; #13792 then took 910 on 11-06 (collision 6). Each merge recomputes from master's max id, not from gaps.

## Current state (11-11 13:00Z)
**Collision 7 resolved:** head **`6c12d4114a`** is a real merge (parents `8fc73592b7` + master `6862c98ecc`, no force-push), MERGEABLE, 11 ahead / 1 behind master `c66100b1e7` (#14416, HLSL-emit only, touches none of the 14 files; merge-tree clean, no re-merge needed). PR: `Type.MetalConstantBufferLayout` = **914** (master max 913), min/max **41/42** (master 41/41), `MetalConstantBuffer`=8, gate and WGPU→Metal order kept. Comment 6078307404 names 6c12d41. Triager seq 76/77: 686/686 unit tests, Metal 244/245.
The `.1 (vk)` failure is master regression [slang#14347](https://github.com/shader-slang/slang/issues/14347) (from #14178), filed 11-05. **jkwak-work self-assigned it 11-06 22:06Z**; it is maintainer-held with 0 comments as of 11-11 and no bot fix chain. Don't touch the test.
Dispatch run **42993608084** on 6c12d41 is `waiting` (unapproved); 42466395856 was cancelled. 0 human reviews; the assignee and review request are still kaizhangNV. #13386 (MERGEABLE draft) and #13300 are unmerged. Next maintainer re-chase: `rechase-13425-maintainer-d92d` 11-14 09:00Z.

## Resumes on
A maintainer comment or fix on #14347 (jkwak-work assigned 11-06); a human review, an un-draft or an answer to the A' question on #13425; #13386 or #13300 merging (#13425 then merges master); a human
comment on #13423; any maintainer objection on the #11578 design.
