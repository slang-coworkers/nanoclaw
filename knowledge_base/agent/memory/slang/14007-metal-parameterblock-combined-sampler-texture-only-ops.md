---
type: chain
title: slang#14007 (+ #14006) — Metal ParameterBlock combined Sampler2D: Load/GetDimensions abort or emit invalid MSL
description: Human-filed (EiffelOberon) 10-29, same root cause as sibling #14006; one fixer chain for both; DRAFT PR #14017 stacked on #13741, parked on falcor-ci, the ready flip, the #14042-fold decision and maintainer review (jkwak-work self-assigned 11-02); owns bot-filed #14041/#14042; never push to #13741
---

# slang#14007 (+ sibling #14006): Metal `ParameterBlock<Sampler2D>` texture-only ops

Texture-only ops (`Load`, subscript, `GetDimensions`) on a combined `Sampler2D` inside a `ParameterBlock` abort or
emit invalid MSL. Dated history (dispatch → triage → PR → R1/R2 → follow-ups → re-checks, with SHAs and msg ids):
[[slang/14007-metal-parameterblock-history.md]] — **new dated entries append there**, not here.

## Current state (11-05 08:0xZ re-check #1 — no change since 10-29 17:50Z)

| | |
|---|---|
| Issues | #14007 (my Main `sess-1793266099686-h31wzw`) + #14006 (sibling Main `sess-1793266097711-jwo51v`), both filed 10-29 by EiffelOberon (external). **jkwak-work self-assigned #14006/#14007/#14041/#14042 on 11-02** and milestoned #14006/#14007 "Q4 2026 (Fall)" (no comment). Artifacts: fixer cmts 6497487123 (#14007), 6497487552 (#14006); triage cmts 6493217346 / 6493299044 link #14017 |
| PR | **#14017 DRAFT @`c1dfa2cae3`**, `fix/issue-14007`, **base `fix/issue-13737`** (stacked on #13741), `Fixes #14006` + `Fixes #14007` + `Fixes #13272`, mentions #10607, `pr: non-breaking` |
| Owner | slang-fixer `sess-1793266674350-hgic9q` (`pr-mappings` → #14017); triager `sess-1793266192659-3hlxu4` (thread 14007) |
| Reviews | R1 REQUEST_CHANGES (B1 shared-`IRVarLayout` SIGSEGV) · **R2 APPROVE_WITH_NITS @015c90b**; nits applied, N3 filed as #14041 |
| CI | `workflow_dispatch` **40924685979** @c1dfa2c `waiting` on the `falcor-ci` gate (approval window ends ~11-28) |
| Timer | one-shot **`rechase-14007-pr14017-76c3`**, 2026-11-12T08:00Z (a jkwak-work comment or review counts as case (c)) |

**Parked only on humans:** (1) `falcor-ci` approval for 40924685979 and (2) the #14017 ready flip after #13741 lands
(operator); (3) the #14042-fold decision (operator, asked 10-29 18:1xZ, unanswered); maintainer review.
**Open agent-side:** nothing. **Resumes on:** webhooks (#14017 → fixer via mapping; issue comments → Main), the one-shot,
or an operator answer.

## The bug and the fix

- **Root cause (triager, 10-29):** the Metal texture-only intrinsic strings use `$0` as the texture. A ParameterBlock
  keeps the lowered `{texture, sampler}` struct whole, so `Load`/subscript hit E99997 at `$z`
  (`slang-intrinsic-expand.cpp:681`) and `GetDimensions` emits `.get_width` on the struct pointer. A Load-only
  ParameterBlock also drops the sampler, so the MSL and the reflection disagree.
- **Fix (A):** on `case metal:`, forward through `__getTexture()` with #13741's trampolines and register every combined type.
- **Nested-layout commit `ca41b168a`** (pass + `combined-texture-sampler-nested.slang`): the combined-type lowering reaches
  `cbuffer`/`ConstantBuffer<S>`/`uniform S` fields, where `lowerCombinedTextureSamplers` never rebuilt the nested layout
  (assert at `slang-ir-legalize-types.cpp:3504`; pre-existing on master). Cherry-picked into #13741. Its B1 (freeing an
  `IRVarLayout` shared with a top-level `Sampler2D`) was fixed by `c1b407836` (remove only the decoration;
  `combined-texture-sampler-shared-layout.slang`), cherry-picked into #13741 as `93c3b0499c`.
- R2 G4 added `combined-texture-sampler-nested-array.slang`. Reported runs: full suite 10975/10978 (3 known fp8 CUDA).

## Owned follow-ups (their `issue_opened` webhooks need no dispatch)

- **#14041** (bot-filed 10-29 for R2 N3): WGSL `Sample` on a bindless `Sampler2D.Handle` aborts in `legalizeInst`; also
  #13741 follow-up 7. Linked from the WGSL `$q` comment.
- **#14042** (bot-filed 10-29 for (c)): Metal, an unused PB `Sampler2D` field drops its sampler (offset 8 vs 16). Triage
  (`reports/triage/triage-14042.md`, cmt 6504637257): bug/high/P2, sibling of #13272. `mapTypeToLoweredInfo` is filled only
  from top-level params and use sites, so an unused PB field's combined type is never lowered. A 3-line discovery fix
  (patch A, in triager worktree `/workspace/agent/wt-14042-verify`) asserts alone on master but is clean on #14017's pass.
  **Before any fold**, owner `…hgic9q` must reconcile this with its own `memory/fix-14007.md`, which tried eager
  registration (= patch A) and dropped it because it lowers unused HLSL/WGSL fields (they gain `register(t0)/(s0)`). A
  Metal-scoped discovery may be the answer. Folding moves the head: falcor-ci re-approval + a review delta. A fold goes to
  `…hgic9q` (pinned), never to the stood-down fixer `…l446dg`.
- (b) was not filed: it did not reproduce in 4 variants.

## Constraints and lessons

- **Never push to `fix/issue-13737`/#13741** — it is owned by `sess-1792252474641-muhgh6`
  ([13737](13737-hlsl-combined-sampler-texture-only-ops.md)). Fixes it needs go there as standalone commits for
  muhgh6 to cherry-pick (never a fast-forward), relayed with pin + `in_reply_to=2`. #13741 goes first; #14017 inherits its park.
- #13741's operator reporting belongs to its owning Main session `kd4ktm`; from this side, relay to the owner and let it
  report up (my 10-29 dashboard msg 73 duplicated `kd4ktm`'s notice).
- A pinned cross-chain send needs `in_reply_to=<own webhook row>` as well as `target_session_id`
  ([feedback](../imported/feedback_in_reply_to_beats_target_session_id_pin.md)); my msg 27 was misrouted without it.
- Read this record before dispatching any #14041/#14042 webhook: on 10-29 a Main session mis-dispatched #14042 and minted a
  duplicate triager + fixer.
- Filing a verified issue is not an operator gate ([policy](../imported/feedback_github_writes_operator_authorized.md)); N3
  was authorized by Main.
- The triager says #13272's supervisor entry ("held on #10607 decision") is stale, because #14017 carries `Fixes #13272`.
