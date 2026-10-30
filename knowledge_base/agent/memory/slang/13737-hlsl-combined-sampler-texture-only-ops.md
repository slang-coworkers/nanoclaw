---
type: chain
title: slang#13737 — HLSL/DXIL Load/GetDimensions on combined texture-samplers emit an extra sampler argument
description: Human-filed (Buriola) emit bug, same root cause as #10522; draft PR #13741 @fb36938 (R4 APPROVE) parked on falcor-ci, the ready flip, 7 unfiled follow-ups and maintainer review
---

# slang#13737 — combined texture-sampler: texture-only ops keep the sampler operand

Texture-only ops on `Sampler2D`/`Sampler2DArray` (`Load`, `GetDimensions`, `operator[]`) emitted `tex.Op(sampler, …)` on
HLSL, so DXC rejected them; WGSL/Metal `Load`/subscript used the sampler as the coordinate. `Sampler2DMS`/`Sampler2DShadow`
(#10522) are the same bug. Dated history (dispatch → R4, SHAs, msg ids): [[slang/13737-hlsl-combined-sampler-history.md]] —
**new dated entries append there**, not here.

## Current state (10-29 15:25Z)

| | |
|---|---|
| Issue | #13737 **closed by Buriola 10-18 15:12Z** (COMPLETED, no comment, before any merge). #10522 open. Triage cmt 6236169441 (`reproduced`, Bug, P2); thread `gh-issue-shader-slang/slang-13737` |
| PR | **#13741 DRAFT @`fb36938e7`**, +970/−77, 16 files vs base 60a7c8c88, `Fixes #13737` + `Fixes #10522`, `pr: non-breaking`. MERGEABLE, 74 behind master. Issue artifact: fixer cmt 6243760176 |
| Owner | slang-fixer `sess-1792252474641-muhgh6` (the `pr-mappings` row for #13741) |
| Reviews | R1 REQUEST_CHANGES @45d7d9f · R2 APPROVE_WITH_NITS @68f06ed · R3 REQUEST_CHANGES @c94e1d0 (B1) · **R4 APPROVE @fb36938** — a delta check only (`reviewers_complete:false`); the last full pass is R3 |
| CI | `workflow_dispatch` **40897173994** @fb36938 `waiting`: priority yield + **`falcor-ci`** gate (`can_approve=false` for the bot). 30-day approval clock ≈ 11-28 |
| Stacked | #14017 (`fix/issue-14007`, chain [14007](14007-metal-parameterblock-combined-sampler-texture-only-ops.md)) sits on #13741; #13741 goes first |
| Timer | one-shot `rechase-13737-pr13741-0272`, 10-31 08:00Z |

**Parked only on humans:** `falcor-ci` approval, the ready flip (operator), filing the 7 follow-ups (operator), maintainer review.
**Resumes on:** an operator answer, a #13741 webhook, or the 10-31 one-shot.

## The fix (what fb36938 does)

- **HLSL + CPU** forward `Load`, the subscript and `GetDimensions` to `__extractImage(this)` through **free-function
  trampolines** (`__loadTexture(__extractImage(this), loc)`, like `__texture_gather`). This is the maintainer ask
  (aidanfnv, #10522 cmt 4071794281: resolve via `__getTexture()`); jhelferty-nv's ask is met too. No `$q` is left on any
  HLSL path. The member spelling `__extractImage(this).Load` fails E30027 inside the generic extension; patching inference
  caused E55201 and a WGSL-bindless crash, so the trampoline needs no type-checker change. Also fixes the CPU combined-`Load` gcc error.
- **Metal + WGSL** keep one `$q` skip-injected-sampler rule (prior art #11816, WGSL `GetDimensions`): the forward ICEs (E99997) on
  WGSL bindless `.Handle`. A misplaced `$q` is now an ICE (the `$p` assert checks `startsWith("$q")`).
- **Nested combined samplers** (`cbuffer`/`ConstantBuffer<S>`/`ParameterBlock<S>`/`uniform S` fields): the forward introduces
  `CombinedTextureSamplerGetTexture`, which pulls nested fields into `lowerCombinedTextureSamplers`, and that pass never rebuilt
  their layout (Release: `b.Load` read t0 instead of reflected t1). Fixed by #14007's `ca41b168a`
  (`slang-ir-lower-combined-texture-sampler.cpp`), which also fixes the pre-existing #13272 family. Its first version
  freed an `IRVarLayout` shared with a top-level `Sampler2D` (B1, rc 139); `93c3b0499` (cherry-pick of `c1b407836`) removes
  only the decoration.
- Tests: `gh-13737`, `-bindless`, `-cpu`, `-nested` (pins t1/t2/t3), `combined-texture-sampler-shared-layout` (DXC t0..t4 = reflection).

## Follow-ups — 7, all unfiled, operator call

Dedup on 10-18 found no existing issue for 1–5. Before filing 7, check overlap with **#14041** (WGSL `Sampler2D.Handle`
`legalizeInst` abort, filed 10-29 by the 14007 chain; unverified whether it is the same crash).

1. `Sampler2DMS.GetSamplePosition` (pre-existing).
2. Plain `Texture2DMS[uint2]`.
3. Generic-inference E30027. Possibly only a limit of member-call inference inside a generic extension, since the trampoline compiles (told the operator 10-18).
4. Bindless DXIL `nonUniformIndex=false` (pre-existing; plain `Texture2D.Handle` too).
5. CPU prelude float-array `GetDimensions` (pre-existing; plain textures too).
6. **G1:** WGSL `ParameterBlock<struct{Sampler2D t; Texture2D plain;}>` puts `t_sampler` and `plain` both at `@binding(1) @group(1)`
   (Tint rejects). Front-end cause: WGSL reflection reserves 1 slot for a combined sampler in a `ParameterBlock`, 2 in a `ConstantBuffer`.
   Appears with `ca41b16`, not on master; also affects #14017.
7. Forwarding Metal/WGSL `Load` crashes on WGSL bindless `.Handle` (E99997) — the reason `$q` stays.

## Decisions and lessons

- **Master merge declined** (10-29, to muhgh6): it would replace the reviewed head and cancel CI 40897173994. Merge only if a
  maintainer asks, a conflict appears, or the operator wants it. While bot CI dispatch is deadlocked (operator, 10-20), send no master-merge ask.
- **Never pre-clear a head for `falcor-ci` before the reviewer's verdict on that head.** At 13:40Z I told the operator falcor-ci
  on c94e1d0 "makes sense again"; B1 surfaced an hour later and I had to correct it.
- Draft-vs-ready is the operator's call; never put "ready is fine" in a brief.
- A `falcor-ci` approval expires 30 days after the run is queued (the run then fails with 0 build steps, as #13201/#13127 did);
  an expiry alone is no reason to merge master or re-dispatch.
- A peer chain's regression claim was held until the owner reproduced it (10:41Z claim → 10:50Z confirmed) before it reached the
  operator, because it bore on the ready-flip call.
- A delta-only APPROVE is not a full review pass; say which round last ran A/B/C.
- C004/C005 (clarity of `ca41b16`) belong to #14017's review, not here.
