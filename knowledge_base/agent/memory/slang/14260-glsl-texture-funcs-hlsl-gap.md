---
type: chain
title: slang#14260 — GLSL texture functions do not all compile for HLSL (intrinsic-texture.slang HLSL lines disabled)
description: Human bug (jkwak-work, self-filed + self-assigned) 11-03 21:46Z, from the #14215 work. 11-04 re-ask answered by a delta reply (cmt 6636414885: test shape + bot-PR question); idle on jkwak-work. TRIAGED 22:2xZ (cmt 6616981515; bug/medium/P2, Type=Bug). Idle on the assignee; fixer NO-GO. Split-offs #14271 (4-offset Gather) and #14272 (SM floors) are FILED-ONLY.
tags: [glsl-module, texture, shadow-sampler, hlsl, capability-gate, test-infra, self-assigned]
---

# slang#14260 — GLSL texture functions → HLSL gap

**11-03 21:46:35Z, `issue_opened`.** Live read: OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 2 s after filing, 0 labels, 0 comments, no PR.

**Ask.** `tests/glsl-intrinsic/intrinsic-texture.slang` (`-lang glsl -target hlsl -DHLSL`) never compiled; its HLSL
lines matched only `void TEST_main(` inside the error text. Author's per-clause inventory: (1) E36108, 29 clauses —
shadow `textureGrad*`/`textureProjGrad*` and `shadow1D/2D*` are `[require(glsl_spirv, texture_shadowlod)]`, no hlsl
arm; (2) E36104, 12 clauses — shadow `texture*` with `bias` need `sm_6_8` vs `sm_5_1`; (3) E41400 ~12 clauses —
`textureQueryLod` static-asserts in compute (fragment not checked). HLSL lines disabled with a TODO naming #14260.

**Related.** #9085 (merged 10-01, GLSL SampleCmpBias/Grad) and its bot draft follow-up **#13333**
(`tests/glsl-intrinsic/texture-shadow-bias-hlsl.slang`, parked on ready-flip; [record](../imported/project_9085_glsl_samplecmp_takeover.md));
#12244 (closed, capability naming). Siblings from the same #14215 work: [#14249](14249-glsl-subgroup-hlsl-cuda-gap.md),
[#14257](14257-glsl-matrix-mul-metal-dup-13350.md), [#14248](14248-glsl-inverse-hlsl-other-targets.md) (held).

**Disposition (Orchestrator 11-03 ~21:5xZ).** Bug class, same shape as #14249 -> slang-triager on
`gh-issue-shader-slang/slang-14260`: verify the three classes on master, find HLSL equivalents (SampleCmpGrad sm_6_8,
SampleCmpLevel sm_6_7, CalculateLevelOfDetail + compute derivatives), dedupe, post ONE triage comment (may offer a
bot draft PR). No fixer: reporter self-assigned. Self-assignment precedent conflict still unresolved by the operator
(see #14248 record).

**Dispatched 11-03 21:52Z** as send_message id 3; triager session sess-1793742766161-gwve3b on the canonical thread.

**Triaged 11-03 22:25Z** (triager comment on #14260): Bug; rows 1a/1b need compiler changes (widen `shadow*` gates;
add HLSL `SampleCmpGrad` sm_6_8 to `textureGrad*`), rows 2/3 are test changes (SM 6.8); offers a draft PR on top of
jkwak-work's PR #14269 if asked. Filed two bot follow-ups, **both owned by this chain (no dispatch on their webhooks)**:
- **#14271** (22:24:43Z, `reproduced`) — HLSL four-offset `Gather`/`GatherCmp` emitted under names HLSL lacks
  (component 0 must be `GatherRed`/`GatherCmpRed`; `hlsl.meta.slang` ~5110-5152). issue_opened webhook 11-03: no dispatch.
- **#14272** (22:24:55Z, `reproduced`) — `SampleCmpLevel` / `CalculateLevelOfDetail` on a comparison sampler accepted
  below the SM DXC needs.

**Resume on:** triager `[Report]`; a human comment asking for a bot PR (-> slang-fixer, canonical thread).

## 11-03 22:25Z — triager posted; bot-filed follow-ups #14271 / #14272 (no dispatch)

The triager posted ONE triage comment on #14260 at 22:25:27Z: Bug; rows 1a/1b (shadow `shadow*` gates, shadow
`textureGrad*` needs an HLSL `SampleCmpGrad` case) need compiler changes; rows 2/3 are test changes (HLSL lines at
SM 6.8). It offers a draft PR for rows 1a, 1b, 2, 3 on top of **#14269** (the PR that disables the two HLSL lines), only if
the assignee asks. It also filed two `reproduced` follow-ups 22:24Z, both bot-authored, unassigned, 0 comments:

- **#14271**: HLSL `Gather`/`GatherCmp` with four offsets emit an overload that HLSL does not have (row 5).
- **#14272**: HLSL `SampleCmpLevel` (SM 6.7) and `CalculateLevelOfDetail*` on a comparison sampler (SM 6.8) are
  accepted from SM 4.1 (row 6). Proposes new HLSL-only atoms, the way `texture_shadowgrad` does it, and leaves
  `texture_shadowlod` alone (#12244 pattern). Also covers the GLSL wrappers' `[require]`.

**Both `issue_opened` webhooks need no dispatch.** They are this chain's own artifacts. A fixer for either is a NEW
fixer chain, which goes to the operator or a human ask, not a Main dispatch. #14272 reached Main 11-03 ~22:25Z and I made no dispatch.

**Resume on:** triager `[Report]` (still running at 22:25Z); a human comment on #14260/#14271/#14272 asking for a bot PR
(-> slang-fixer, that issue's canonical thread).

**11-03 22:26Z — triaged ([Report] msg 6, notes `/workspace/inbox/a2a-1793744815213-q45oo8/triage-14260.md`).**
Comment 6616981515 (codex OUTPUT_REVIEW APPROVE r4); Type set to Bug, labels/assignee untouched. Verified on master
f1cd35ff8 + DXC 1.9, 294 clauses x 2 stages. Rows: 1a 12 `shadow*` -> widen gate (callees already have hlsl);
1b 17 shadow `textureGrad*` -> hlsl `SampleCmpGrad` arm, sm_6_8; 2 bias forms -> real sm_6_8 need (test change);
3 `textureQueryLod` compute -> not a bug (passes at sm_6_6). Fragment stage: no E41400. Unfiled extra in the
comment: shadow `textureLodOffset` drops `lod` on HLSL. Comment offers a bot draft PR (1a/1b + re-enable HLSL lines at
sm_6_8, on top of jkwak-work's #14269 which adds the TODO). DXC also rejects 46 combined GetDimensions/Load clauses
(dup #13737/#10522, our draft **#13741**).

**Split-offs (bot-filed, this chain owns them; their `issue_opened` webhooks need no dispatch):**
- **#14271** — HLSL 4-offset `Gather`/`GatherCmp` component 0 emitted under the plain name (DXC rejects; fix: `GatherRed`/`GatherCmpRed`, hlsl.meta.slang ~5110/5136). Triager recommended GO. **Orchestrator: FILED-ONLY** (11-03 22:3xZ) — low severity (downstream compile error, not silent), 8 slang-fixer sessions running; policy holds low-severity fan-out when shepherds are loaded. Dispatch when load drops or on a human ask.
- **#14272** — `SampleCmpLevel` (needs SM 6.7) and comparison `CalculateLevelOfDetail` (6.8) accepted from SM 4.1. NO-GO: raising floors on public intrinsics is a behavior change; needs maintainer direction. FILED-ONLY.

**Resume on:** jkwak-work asking for the offered bot PR (-> slang-fixer, canonical thread, base on #14269); a human
comment on #14271/#14272; fixer capacity for #14271.

**11-04 16:36Z — jkwak-work: "@nv-slang-bot can you triage?"** (cmt 6636197710). Our triage 6616981515 is still
there and not minimized. They posted the same ask on #14295/#14296/#14297 within 4 min, so it is probably a batch ask.
Relayed verbatim to the triager owner session sess-1793742766161-gwve3b (msg 23; pinned + in_reply_to=18 = my
webhook row; it woke and there is no second session). Suggested a short delta reply: link the existing triage,
re-check any row that moved, ask about the test shape / the offered bot PR. #14271/#14272 stay FILED-ONLY.
**Resume on:** triager [Report]; a bot-PR go-ahead -> slang-fixer, canonical thread.

**11-04 16:46Z — triager delta reply posted** (cmt 6636414885, codex APPROVE r8; [Report] msg 28). Re-checked
master 3da6f63c0: no row changed. The reply asks jkwak-work (1) test shape: (a) HLSL lines at sm_6_8 or (b) keep
sm_5_1 and exclude the SM 6.x clauses, and (2) whether they want the bot draft PR. It also corrects the 11-03
comment: option (b) must also exclude row 1b and the 4 `bias` forms of row 1a. **Idle on jkwak-work**; no timer
(replies arrive as webhooks). Bot-PR go-ahead -> slang-fixer on the canonical thread, based on #14269.

## 11-05 11:36Z — dashboard "New issue to triage" for #14271 (answered from live state, no dispatch)

Live: OPEN, 0 comments, `reproduced`, **self-assigned by jkwak-work 11-04 17:35Z, milestone Q1 2027 (Winter)**, no PR.
Cause re-verified on master `04d2726db0`: `componentFuncString[0] == ""` (`hlsl.meta.slang:4990`), so the four-offset
overloads' `case hlsl: ".Gather$(compareFunc)$(componentFunc)"` (:5125, :5152) emit `Gather`/`GatherCmp` for component 0.
Verdict to operator: Bug, core-module HLSL intrinsic mapping, low severity (DXC hard error, not a miscompile;
`GatherRed` workaround), P3. Sent nothing to triager/fixer/GitHub (#13757 / #13729 rule: maintainer owns it, body is the
triage). **Resume on:** an @nv-slang-bot ask on #14271 or an operator GO for a bot PR (-> slang-fixer, thread
`gh-issue-shader-slang/slang-14271`).

**11-05 ~11:40Z — dashboard asked Main to triage #14272 (msg 20).** Live: jkwak-work **self-assigned 11-04 17:30Z**
and set milestone **Q1 2027**. No comments, labels `reproduced`, Type Bug, no PR. I re-ran the repro myself: a local Release
slangc (11-02 build) gives exit 0 at `-profile sm_5_0` and emits `SampleCmpLevel` plus comparison `CalculateLevelOfDetail`.
DXC 1.9 rejects it at sm_6_7 and accepts it at sm_6_8. The atoms on master 04d2726db are unchanged (`texture_shadowlod = texture_sm_4_1`, capdef:2463;
`texture_querylod`, capdef:2451). **Verdict:** capability system / core-module HLSL gates; severity low (DXC fails loudly; this
is not silent wrong code and not a regression). **Held: maintainer-owned (rung 4).** No triager, no fixer, no GitHub post, because
the body is already the triage. Bot fix only if jkwak-work asks (it raises public floors).
