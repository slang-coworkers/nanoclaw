---
type: chain
title: slang#13654 — Metal StructuredBuffer<S> with a Texture2D field aborts slangc
description: "albertrodriguezclo, human-filed Metal bug: texture method on a StructuredBuffer element field aborts slangc (intrinsic-expand assert). Triaged 10-15 15:03Z (cmt 6195242328) P2: Metal wrongly skips E38204 and legalizeResourceTypes leaves SB<tuple> simple; DRAFT PR #13681 @87c393db2e (legalizer reports E38204; pr: non-breaking), jkwak-work assigned. Triage resolved 10-16 07:48Z; PARKED on maintainer + operator (asked twice, final), re-check 11-02 08:00Z."
---

# slang#13654

Live state only. The full triage → fix → review → GPU history is in
[[13654-history-triage-fix-gpu.md]] (split out 2026-10-16 by okf-synthesis).

## Bug and fix (one paragraph)

On Metal, a texture method on a field of a `StructuredBuffer<S>` element (`S` has a `Texture2D`) hits the
release assert at `slang-intrinsic-expand.cpp:406`: the call reaches emit with its texture operand dropped.
Two gaps combine. Metal is in `areResourceTypesBindlessOnTarget`, so the E38204 validator skips it, but unlike
CPU/CUDA it still runs `legalizeResourceTypes`, whose SB-type `default:` arm (`slang-legalize-types.cpp:1416`)
returns the split-element buffer `simple`. **PR #13681 fixes it at the producer:** the legalizer reports E38204
for an un-legalizable SB element and the pass fails; the validator stays as on master; the SB-load case in
`slang-ir-legalize-types.cpp` becomes a `SLANG_RELEASE_ASSERT` that holds by construction. Every newly rejected
shape produced invalid output or an ICE on master, so the label is `pr: non-breaking` (maintainer-overrulable).
#12529 shares only the assert site.

## Current state (verified live 10-16 09:2xZ)

- **PR #13681**: DRAFT, head **87c393db2e**, `Fixes #13654`, `pr: non-breaking`, jkwak-work assigned, 0 GitHub
  reviews. CI run **38866727586** `waiting` (approval gate). `pr-mappings` → fixer `sess-1792076538832-j7oqw9`.
- Artifacts: issue status comment **6201285206** ("held pending maintainer review", current); explain comment
  **6201118996** (rewritten 09:22:32Z with the GPU numbers); triage comment 6195242328 (superseded).
- Internal reviews: R1 REQUEST_CHANGES applied, R2 APPROVE_WITH_NITS applied. Triager side closed
  ([Triage Resolution] 10-16 07:48Z).
- Testing: full `slang-test` A/B on the L40S (vk + cuda), master vs 87c393d — **no fix-only failures** (fixer's
  09:22Z report; I did not re-run). No native Metal run (Linux only).
- Open technical note: Devin still flags the `:2197` SB-load assert; the fixer argues it is unreachable via the hook.

## PARKED (since 10-16 07:5xZ)

Waiting on:
1. maintainer review of #13681;
2. operator `gh pr ready` + CI approval (run 38866727586);
3. operator file-or-leave call on two **unfiled** follow-ups:
   - `uniform Material* p` / `ConstBufferPointer<Material>` → assert `fieldLayout || !typeLayout` at
     `slang-ir-legalize-types.cpp:3504`, Metal + SPIR-V (repro at the triager's `/tmp/t13654/ptr.slang`);
   - the validator reports a struct-field E38204 at the struct's location, not the field's.

Asked on orchestrator-dashboard (thread `gh-issue-shader-slang/slang-13654`) at 10-16 07:49Z and again,
as the final ask, at 10-18 08:0xZ. **Do not re-ask; list as pending.** Re-checks 10-18 08:00Z and
10-21 08:0xZ: GitHub unchanged (draft, 87c393d, 0 reviews, no human comments, CI still `waiting`); the only
event is jkwak-work milestoning #13654 **Q4 2026 (Fall)** on 10-19 15:54Z (no comment). No operator answer in the
dashboard session through seq 506566 (10-21 08:01Z); Main session `sess-1792074637049-flailg` has had no rows
since 10-16 10:39Z. 10-21 status line: dashboard msg 19. Re-check 10-24 08:0xZ: still unchanged (no timeline
events since 10-21 08:00Z; CI still `waiting`); no operator answer in the dashboard session through seq 507812
(10-24 07:30Z). 10-24 status line: dashboard msg 9. Re-check 10-27 08:0xZ: still unchanged (no timeline
events since 10-24 08:00Z; CI still `waiting`); no operator answer in the dashboard session through seq 508302
(10-27 07:48Z). 10-27 status line: dashboard msg 11. Re-check 10-30 08:0xZ: still unchanged (CI still `waiting`).
The only event is a 10-29 09:28Z cross-reference from #14006 (EiffelOberon). Its body says "probably related to #13654",
but the #14006 triager found a different root cause (ParameterBlock nested layout). The
[#14007 chain](14007-metal-parameterblock-combined-sampler-texture-only-ops.md) owns #14006, so I routed nothing. No operator
answer in the dashboard session through seq 509351 (10-30 07:31Z). 10-30 status line: dashboard msg 7. Timer: one-shot
`rechase-13654-pr13681-2299` (2026-11-02 08:00Z).

**Resumes on:** a human comment/review on #13654 or #13681, a CI webhook (owned by the fixer), the operator's
answer, or the re-check.
