---
type: chain-record
title: "slang#14730 — explicit -bindless-space-index 0 preempted by auto-allocated ParameterBlock (E39012)"
description: Bug chain 11-26; fix implemented+verified but draft PR HELD on a maintainer decision (conflicts with tangent-vector's #8937 stance); recheck recheck-14730-maintainer-6c32.
---

# slang#14730 — bindless-space-index preemption

**Opened 11-26** by aka0353 (no labels). Webhook → triaged same day.

**Issue:** With `-bindless-space-index 0`, `generateParameterBindings()` picks the
`__slang_resource_heap` space only AFTER the default space ($Globals) and auto
ParameterBlocks claim space 0, so an explicit request for 0 is bumped to set 1 with
warning E39012. Ordering bug, not zero-vs-unset (`-bindless-space-index 2` honored).
Key files: `source/slang/layout-and-binding/slang-parameter-binding.cpp:4712` (default
space), `:4811-4841` (bindless placement + E39012).

**Triage (11-26):** bug / P2 / frontend (layout-and-binding). Reproduced on master by
slang-triager; `reproduced` + Bug type labels applied; comment 7186878955. Related (not
dup): #13099.

**Fix (11-26, slang-fixer, HELD — not pushed):** 3 commits on master f666576d6, head
91e07e87e, patch sha f7a3ffa18def (`/workspace/agent/patches/fix-14730.patch`, worktree
`/workspace/agent/wt-slang-14730`). Pre-reserve the requested space before
default-space/auto allocation; default-space block allocates a fresh space when 0 is
reserved; E39012 kept only for genuine explicit-binding conflicts. Reviewer verdict
APPROVE_WITH_NITS (10:22), nits applied without round 2: gh-14730.slang now 4 variants
(added `-bindless-space-index 1` two-block steering + HLSL ps_6_6 `register(s0, space1)`
pin), gh-8937.slang 3 variants pinning both heap variables. Wide regression 2957/2957
(tests/bugs 1577/1577, tests/spirv 1246/1246, descriptor-handle 134/134); no-option and
index-2 outputs byte-identical to master, re-confirmed after nits. Critique gates all
approve (one round-3 must-fix challenging the hold was downgraded to Advisory after a
successful challenge); status note cmt 7189279999.

**⚠️ Why HELD:** tangent-vector (MEMBER) endorsed the bump+warn E39012 resolution on
linked #8937 (issuecomment-3499304751) — this fix reverses that for auto-allocated
occupants. Fixer asked the maintainers (verbatim quote + both options) at
<https://github.com/shader-slang/slang/issues/14730#issuecomment-7187704180>; on "go"
deletes tmp-out, pushes branch + opens draft PR (`pr: non-breaking`; diagnostics-narrowing
note + docs/generated pipeline row 7 regen, explain-diff), on "no" reverts the gh-8937.slang
pin and closes per their guidance. No PR action before the answer.

**State (11-26 09:28):** parked on maintainer decision. One-shot recheck
`recheck-14730-maintainer-6c32` fires 11-29 10:00Z (3 rechecks max, then parked no-timer).
Fixer owner session: sess-1795682415563-tk56no. Reopen: wake fixer with maintainer answer
verbatim (target_session_id + thread `gh-issue-shader-slang/slang-14730`).
