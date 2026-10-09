---
type: chain
title: slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`
description: Maintainer-authored feature (step 1 of 2). Triaged and reproduced; fixer HELD on the author's open HLSL choice (reject vs lower with loss)
tags: [slang, core-module, textures, spirv, deprecation, feature, parked]
resource: /workspace/inbox/a2a-1791500132544-x8avim/triage-13536.md
---

# slang#13536 — `RTexture*` + deprecate `readonly`/`writeonly` on `RWTexture*` (parked on author)

Author and self-assignee: **jhelferty-nv** (MEMBER), label Office-Tess, Type=Bug (human-set, left alone).
The author **edited the issue at 22:04Z on 2026-10-08, after the opened webhook**. The edit renamed
`ROTexture*` to `RTexture*` and added a matching warning for `writeonly RWTexture*` that points to
`WTexture*`. My dispatch quoted the pre-edit body. The triager triaged the edited text, which is correct.
⇒ Before quoting an issue body in a dispatch, re-read it live when the webhook is more than a few minutes old.

**Triage (slang-triager, master f6238cee3, Release, GPU-free):** feature, P2, low-medium. It touches the
core module, every texture emitter and reflection. Reproduced: a store through `readonly RWTexture2D`
emits `NonWritable` together with `OpImageWrite`, and a load through `writeonly` emits `NonReadable`
together with `OpImageRead`. On HLSL, Metal and WGSL the qualifiers do nothing. The comment carries
three implementation notes:
- New access code 5 (and public 8). Today an unhandled access value silently becomes a sampled texture
  on GLSL/WGSL.
- GLSL `image2D` is the same `_Texture` type, so the warning has to key on the alias as written.
- The 2DMS alias filter at hlsl.meta.slang:6130 compares an access value against a shape constant.

Related, not duplicates: #8768 (skiminki-nv `RTexture` proposal, open), PR #13406 (the author calls
#13536 its later step).

**Comment:** [6070650634](https://github.com/shader-slang/slang/issues/13536#issuecomment-6070650634)
(bot, 3035 chars; I verified it live). It asks one question, the author's own open HLSL choice: reject,
or lower with explicit loss. Kept out of the public comment and left for the PR discussion: the
`readonly RWBuffer`/`RWStructuredBuffer` warning scope, and #8768's Texture*/t-register lowering.

**State (2026-10-08 23:00Z): HELD.** The fixer briefing is warm but there is no GO, because the
maintainer self-assigned and the design choice is open. Re-chase task `rechase-13536-hlsl-choic-afe9`
fires 2026-10-11T22:00Z.

**Resume:**
- The author answers and asks for a bot PR → the triager releases the fixer (Approach A plus the
  chosen HLSL lowering, GPU-free FileCheck tests, a DIAGNOSTIC_TEST that includes silence for
  `readonly image2D`, draft PR `Fixes #13536`).
- The author implements it → stand down.
