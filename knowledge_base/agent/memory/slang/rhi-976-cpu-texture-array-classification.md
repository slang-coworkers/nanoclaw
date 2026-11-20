---
type: chain
title: "slang-rhi#976 — CPU texture classification uses `arrayLength > 1` (cube array arrayLength=1 reads face 0)"
description: Bot-filed 11-18 17:12Z by the #14593 side-find triage; maintainer jhelferty-nv asked for a PR 18:47Z — fixer chain on canonical thread gh-issue-shader-slang/slang-rhi-976
tags: [slang-rhi, cpu-backend, texture, cube-array, filed-by-bot, fixer-chain]
---

# slang-rhi#976 — CPU backend arrayLength>1 texture misclassification

**Lineage.** Side-find of the slang#14593 chain (render-test `isArray = arrayLength > 1`,
PR slang#14596): the slang-rhi CPU backend has the same threshold. Routed to the triager
17:0xZ (thread `triage-14593-sidefind-rhi-cpu-arraylength`); verified + deduped, FILED
17:12:35Z by nv-slang-bot (body carries master sha `4b4067d`, headless `TextureImpl`/
`TextureViewImpl` repro, root cause). FILED-ONLY until the maintainer ask (below).

**The bug (filer-verified).** `src/cpu/cpu-texture.cpp:328` (`SampleLevel`) and `:380`
(`_getTexelPtr`, used by `Load`/`refAt`) classify arrays via `arrayLength > 1` instead of
`desc.type`, unlike every other backend (vk-texture.cpp:45, d3d12-texture.cpp:150,
cuda-texture.cpp:430, debug-device.cpp:213). `TextureCubeArray` with `arrayLength=1` drops
the array classification → the face-selecting coordinate is never consumed → always reads
face 0 (5/6 faces wrong; plain TextureCube identical allocation is correct). At
`arrayLength>=2` the cube index is never honored at ANY length (only `coords[2]` consumed
as elementIndex; cube index that follows unread). 1D/2D arrays @1 are misclassified but
coincidentally correct. Latent in-tree: no slang-rhi cube tests; CPU not in test masks
(tests/test-texture-types.cpp:478 has TextureCube commented out).

**Maintainer ask 18:47:14Z — fixer chain GO.** jhelferty-nv (self-assigned on the issue),
comment 6988209443: "@nv-slang-bot Can you create a PR for your suggested direction?"
Real @nv-slang-bot mention → `<github-post-authorized />`. Fixer chain dispatched to
slang-fixer on canonical thread `gh-issue-shader-slang/slang-rhi-976` at ~18:5xZ from the
rhi-976 webhook session (Main sess syo52i, created 17:12Z off the filing's own webhook).

**Fix direction (issue body, not prescriptive).** Derive array-ness from `desc.type`
(consistent with other backends + debug-layer), keep cube faces as the implicit array the
shape table describes (`implicitArrayElementCount = 6`, cpu-texture.h:22) — e.g. classify
via `implicitArrayElementCount > 1` or "type is one of the `*Array` kinds". For
`TextureCubeArray` consume both extra coordinates: `face + 6 * cubeIndex`.

**Acceptance (from the issue).** Cube array `arrayLength=1` returns the requested face for
`Sample`/`SampleLevel`/`Load`; plain `TextureCube` unchanged; one-element 1D/2D arrays
unchanged.

**Scope guards.** Related-but-separate open rhi#960 (CPU `Load` ignores mip-level
coordinate, #14121 chain side-find) — do NOT scope-creep into it. NOT part of PR
slang#14596 (render-test-only). Branch convention `fix/issue-976`, PR to
shader-slang/slang-rhi; `report_pr_created` after `gh pr create`. Fixer cannot request
reviewers or flip draft — ready-flip goes on the weekly list unless a human does it.

**Chain state.** Fixer session hgjixd: PLAN_REVIEW approved, failing-repro test written
(tests/test-cpu-texture-cube-array.cpp), slang-rhi-tests built in worktree. **Draft PR
#977** "CPU: classify textures as arrays by type, not arrayLength" @ head `57c3f50`
(branch fix/issue-976, base main@`7aead62`, 2 commits: failing repro → fix; opened
19:32:42Z by nv-slang-bot; pr-mapping wired 19:32:52Z — verified). Explanation comment
6990281105 posted (explain-diff-html); HTML copy in inbox a2a-1795032744480-g96yu9.
Issue thread reply 6990284089 posted 20:12:07Z (verified live).

**[Fix Report] received 20:12Z (Main-verified).** Fix: array-ness from `desc.type` (the
four *Array kinds, matching the debug layer), cube face kept as the implicit array
(`implicitArrayElementCount = 6`), `TextureCubeArray` consumes both extra coordinates
(`face + 6 * cubeIndex`). All three critique stages approve (PLAN/CODE/OUTPUT); #960
scope guard honored. Tests: repro fails on main per issue; 5/5 new cases pass (56/56
assertions); texture suite 263/263 on Vulkan/CUDA/WebGPU (L40S). slang-rhi ci.yml does
NOT run on PRs — PR CI is the pre-commit workflow (see CI delta below). **Next: slang-reviewer verdict
([Fix Review Request] dispatched ~20:12Z); draft stays until a human flips it**
(ready-flip → weekly list).

**CI (20:24Z delta).** PR CI DOES exist on slang-rhi via the pre-commit workflow (29
checks) — the earlier "ci.yml does not run on PRs" note meant only that ci.yml itself
isn't the PR pipeline. One transient failure (build windows-x86_64-clang-Release,
`STL1000: Unexpected compiler version, expected Clang 22 or newer` in untouched files —
runner-image glitch; same job green on main 2h earlier) fixed by one `gh run rerun
--failed` (1 of 3 allowed) → **29/29 green** (two benign skips: main-only
deploy-examples, CodeRabbit bot-skip). Diff never implicated. kaizhangNV auto-assigned
as shepherd by repo board-sync (no reviewer requested by us — FYI). Reviewer verdict
still pending.

History: filed 11-18 17:12Z (FILED-ONLY); maintainer go 18:47Z; fixer chain started same
evening; draft PR #977 up 19:32Z; fix report 20:12Z; CI green 20:24Z; **round 1 of
review applied at head `af6e69e` (Main-verified, 3 commits): reviewer's one real bug —
int32 overflow in the cube-index multiply, shader-controlled UB — fixed by clamping face
and cube index against their own dimensions before combining; two gaps covered
(Texture2DMSArray slot-order tests + end-to-end test compiling a slang shader and
sampling the cube array through a real CPU device); 3 clarity items declined with
justification. Tests now 8/8 cpu-texture cases (96/96 assertions incl. end-to-end),
266/266 texture suite (L40S) — fixer-verified. Round 2 requested (two rounds max);
next verdict decides: APPROVE* → final [Fix Report]; REQUEST_CHANGES → one more apply.**
**Round 3: findings applied at head `4330c53` (Main-verified, 6 commits) — shared
`_combineCubeArrayElementIndex` helper, raw-coordinate clamp tests, refAt write-through
case, end-to-end compiled-shader sampling; explanation comment 6990281105 refreshed.
Final [Fix Report] pending.**

**TERMINAL-on-our-side 22:34Z: review converged.** Round 2 verdict APPROVE_WITH_NITS
(0 bugs; 2 test-side gaps + 3 clarity clusters all applied; 2 declines justified:
contract prose move C002, `mip` rename = #960's territory). Final diff 3 files
+408/−4, 6 commits @ head `4330c53`: array-ness from `desc.type` (four *Array kinds),
cube faces stay the implicit array, cube arrays consume face then cube index
(`face + 6*cubeIndex`), each clamped per dimension before combining. Tests:
repro fails on main per issue; 9/9 cpu-texture cases (102/102 assertions) incl.
end-to-end compiled-shader sampling through a real CPU device and a refAt write-through
case; texture suite 267/267 (vk/cuda/wgpu, L40S); CI green (one transient STL1000
runner rerun). Codex PLAN/CODE/OUTPUT_REVIEW approve at every round. **Draft PR #977
awaits human review — ready-flip on the weekly list** (asker jhelferty-nv is issue
assignee; kaizhangNV auto-shepherd). #960 stays separate. Worktree
`/workspace/agent/wt-slang-rhi-976` retained until the PR closes. Resume on a human
review/comment or the PR's merge/close webhook.

**STL1000 runner glitch — RECURRED (22:43Z fixer report).** Same transient
windows-clang-Release `STL1000: expected Clang 22 or newer` hit the final head
`4330c53` too (failing file aftermath.cpp builds before our sources, byte-identical to
main; one `gh run rerun --failed` → fully green at the final head; Main-verified
mergeable_state `blocked` only on review). Two hits on one PR in one evening ⇒ flaky
runner pool, not a one-off. No open slang-rhi issue mentions STL1000/Clang 22
(Main-searched 22:4xZ, zero dupes). Flagged to the operator with the recommendation
(bot files a small infra issue, or operator mentions it in their maintainer channel);
awaiting their word — do not file unilaterally: intermittent runner-infra, not a
deterministic master repro, so it sits outside the file-without-asking lane.
