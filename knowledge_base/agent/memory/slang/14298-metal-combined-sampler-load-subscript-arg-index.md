---
type: chain
title: slang#14298 — Metal combined sampler Load()/operator[] pass the sampler as the texel coordinate
description: External (kovidgoyal) 2026-11-04 04:49Z. TRIAGED 05:18Z (cmt 6623234116, reproduced + Type=Bug): duplicate of #10522/#13737, fixed by draft #13741. Only open item is the #13741 owner adding Fixes #14298. No new fixer chain; resumes on a human comment.
tags: [metal, combined-texture-sampler, intrinsic, texture-read, external]
---

# slang#14298 — Metal `Sampler2D.Load()` / `operator[]` emit `read(sampler.xy, …)`

**11-04 04:49Z, `issue_opened`.** Live read 04:50Z: OPEN, author **kovidgoyal** (external), unassigned,
0 labels, 0 comments. `gh search` found no duplicate. Memory grep for 14298: no hits.

**Ask.** On Metal, combined samplers split into texture + sampler params. For `Load()` and `operator[]`
on `Sampler2D` / `Sampler2DArray`, the emitted MSL passes the **sampler** as the coordinate to
`texture.read()`; the reporter thinks the intrinsic's argument indices are off by one. Separate
`Texture2D` and SPIR-V are fine. `GetDimensions()` had the same bug in 2026.14.1 and is fixed in 2026.21.
Seen on 2026.21 and 2026.14.1.

**Related, not the same:** [#13823](../imported/project_13823_metal_combined_sampler_handle_anyvalue.md)
(Metal combined sampler handle packed in an AnyValue; parked on maintainer).

## Log
- 11-04 04:51Z — dispatched slang-triager (thread `gh-issue-shader-slang/slang-14298`).
- 11-04 04:51Z — triager ack: recall suggests possible existing family #13737 / #10522 (Metal fix PR #14017); unverified, triager checking + reproducing on master.
- 11-04 04:52Z — triager: reproduced on master 139f09f59 (Load / tex[] / arr[]; Texture2D + SPIR-V controls fine). Same family as #13737/#10522 → owned by [13737 chain](13737-hlsl-combined-sampler-texture-only-ops.md) (draft #13741 @fb36938e73, Metal/WGSL `$q` rule; stacked #14017). Triager building the PR head. Main told it: no new fixer chain, duplicate-and-point if the head fixes it.
- 11-04 05:03Z — triager [Report] (msg 16, memo `/workspace/inbox/a2a-1793768611378-0uiln7/triage-14298.md`): bug / medium / P2,
  target-emit Metal (also WGSL/HLSL) + core module. Triager's finding: Metal `Load`/subscript strings
  (`hlsl.meta.slang:5226-5282`, `:5780-5835`) use `$1` without `$q`; `$q` (#11816, 0b78add93, v2026.16) covered `GetDimensions` only.
  Both #13741 @fb36938e7 and #14017 @c1dfa2cae3 fix the repro + Sampler2DArray.Load + WGSL + HLSL; (the ParameterBlock claim was later retracted, see 05:18Z).
  Comment drafted (dup of #10522, fixed by open #13741, interim workaround / `tex.__getTexture().Load`) + `reproduced` + Type=Bug;
  **posting waits on the installation REST rate limit (0/6000, reset ~05:16Z)** — transient, not escalated (GraphQL still worked 05:04Z).
- 11-04 05:04Z — Main pinned-woke #13741 owner `sess-1792252474641-muhgh6` (seq 66, verified): add `Fixes #14298` to the PR body only;
  no push (would stale falcor-ci run 40897173994).
- 11-04 05:06Z — the #13741 owner reported done (its [Report] landed in the #13737 Main session `kd4ktm`, msg 282). I checked: the PR body's
  `Fixes` lines are #13737/#10522/#14298; the head is still `fb36938e7`, still a draft, with no push, so falcor-ci run 40897173994 stays valid.
  The fixer did not re-run #14298's repro, because its build dir is gone; it relies on `gh-13737.slang`'s METAL checks plus the triager's run.
  Open: the triager's #14298 comment (after the REST reset).
- 11-04 05:18Z — triager posted https://github.com/shader-slang/slang/issues/14298#issuecomment-6623234116, applied `reproduced` + Type=Bug.
  Master re-confirmed broken on a fresh 139f09f59 build. **Correction:** the ParameterBlock variant is NOT broken on master
  (texture-only use drops the sampler) — not evidence for #14017; removed from the comment. Worktree `/workspace/agent/wt-14298-pr14017`
  kept until #13741 merges/closes. Triage chain closed. Open: `Fixes #14298` edit by the #13741 owner (its reply goes to that session's parent edge, not necessarily here).
