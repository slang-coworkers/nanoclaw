---
type: chain
title: slang#13635 cluster — WGSL NaN/Inf const-expressions Tint rejects
description: Human-filed #13635 (asfloat of constant NaN/Inf bits) fixed by reporter PR #13645; bot follow-ups #13657/#13658/#13672 each have a bot draft PR; #13671 parked on a maintainer design choice.
tags: [wgsl, emit, tint, nan, community-pr]
---

# slang#13635 cluster — WGSL NaN/Inf const-expressions that Tint rejects

**Root fact:** WGSL §15.7 makes any NaN/Inf const-expression (or override-expression) a
shader/pipeline-creation error. Tint enforces it, Naga does not. A `@const` builtin such as
`bitcast` or `unpack2x16float` applied to a literal becomes a const-expression. Module-scope
initializers can't call user functions, so a `_slang_getNan()` helper call doesn't work there either.

| issue | filed by | fix | state (2026-10-15 22:50Z — all fixer chains closed, watch-only) |
|---|---|---|---|
| #13635 `asfloat(<const NaN bits>)` | albertrodriguezclo 13:15Z | **reporter PR #13645** (14:02Z, emit-side `_slang_nonConstU32`) | bot stood down; triage cmt 6194445036 corrected 15:02Z |
| #13657 `f16tof32(<const Inf>)` | bot (triager) 15:01Z | bot draft #13670 `410a1b3d1b` | R1+R2 REQUEST_CHANGES, all applied; resolved 22:48Z (cmt 6199231398). Held for operator un-draft + maintainer design call (per-intrinsic vs general `@const` rule) |
| #13658 runtime-indexed static-const NaN table | bot 15:01Z | bot draft #13669 `5b4f26a5a2` | R1 APPROVE_WITH_NITS, nits applied 20:29Z; held for operator un-draft. Resolved 20:31Z (cmt 6199105712). Perf follow-up #13682 (loop rebuild) |
| #13671 spec-constant with NaN default | bot 18:17Z | none — maintainer picks (a) drop default / (b) diagnose | design Q cmt 6199222995; one-shot `rechase-13671-override-d-c939` 10-17 15:00Z |
| #13672 `half` NaN/Inf as bare `infh` | bot 18:17Z | bot draft #13680 `48f0b26dcb` (needs #13669 for tables) | R1 APPROVE_WITH_NITS applied; resolved 21:36Z (cmt 6200880363). Held for operator un-draft |

Shepherd: jkwak-work. Un-drafting any of #13669/#13670/#13680 is operator-gated.

## Lessons from this chain

- **This reporter opens their own fix PR ~45 min after filing** (#13635→#13645, #13636→#13644,
  #13639→#13646, #13634→#13647…). The triager missed #13645 because it didn't re-read the timeline
  right before posting. Now standing: check the timeline before the handoff and again before
  opening a PR.
- **The triager's approach A (wrap every literal in a user-fn helper) broke `[SpecializationConstant]`
  initializers.** An `override` initializer can't call a user function. The working shape gates the
  helper on the literal being non-finite.
- **Duplicate bot status comments on all three follow-ups:** the fixer posts a fresh status comment
  instead of editing the triager's. I proposed a fixer `instructions.prepend.md` rule to the operator
  (19:48Z); no answer yet.
- Open on the operator (another chain): #13636 has bot draft #13650 and reporter PR #13644 at once.

## Operator decisions outstanding (asked 2026-10-15, unanswered at 22:50Z)

1. Un-draft #13669, #13670, #13680 (operator-gated `gh pr ready`).
2. `perf` label on #13682.
3. Fixer `instructions.prepend.md` rule: edit an existing bot status comment instead of posting a new one.
   (On #13657 R2 the fixer DID edit in place — the pattern may be self-correcting.)
4. #13636 duplicate: bot draft #13650 vs reporter PR #13644 (another chain).
