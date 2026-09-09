---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786557673652-u9x19x
written_at: 2026-08-13T09:23:45.265Z
---

# [approver/human-agreement] WOULD_APPROVE joined to a merge — confirmed-safe unorm/snorm float-opcode fix

**Outcome (calibration join).** shader-slang/slang#12468 revision 2 (head 1d763afe00df): decided WOULD_APPROVE; PR MERGED at that exact head by jvepsalainen-nv 08:58:10Z, and jkiviluoto-nv had APPROVED that exact head at 08:42:03Z (before the decision). Decision AGREES with the human outcome. Confirmed-safe.

**Confirmed: this shape was safe for reason Z.** A 1-line "unwrap-before-classify" fix in a SPIR-V type classifier (`basicType = as<IRType>(unwrapAttributedType(basicType));` at the top of `_arithmeticOpCodeConvert`) is safe when the *monotonicity* property holds: pre-fix, every flag the classifier derives (isFloatingPoint, isBool, isSigned) is uniformly the SAFE/default value for the wrapper type, so unwrapping can only move a flag toward the value correct for the genuine underlying type. There is no "correct non-default that unwrap disturbs." This is the reusable clear for the whole class of unwrap-in-classifier fixes — verify each derived flag hits its default on the wrapper, then the change is monotonic and needs no exhaustive shape enumeration.

**Transferable Step-0 signal for the NEXT review of similar code:** when a fix adds an unwrap/normalize at the top of a multi-flag classifier, DON'T stop at the flag the PR advertises (here: float). Enumerate EVERY flag the classifier derives downstream (grep the switch for each bool the arms read) and confirm each is monotonic. Codex's DECISION_REVIEW caught exactly this — I'd cleared "signedness" rigorously but only hand-waved "bool"; the complete trace (isBool gates Eql/Neq/BitAnd/BitOr/BitXor/Not) was needed and confirmed the same monotonic property. The lesson: "the fix changes more flags than advertised" is the reviewer's first question on any unwrap-in-classifier change; have the per-flag monotonicity table ready.

**Two mechanical facts re-confirmed (already in prior learnings, held here):**
- `record_human_verdict` is NOT a callable tool — host stamps the join automatically from the merge webhook (`/app/src/mcp-tools/core.ts:608`). Don't try to call it; don't claim "I recorded the verdict" — say "the host joins it."
- DISMISSED on the prior head (74b0423f) was branch-protection stale-dismissal from the master-merge, not a human retraction; the live same-head approval (jkiviluoto-nv) is what counts for this revision.

**Infra-gap confirmation:** the identical change abstained NO_REVIEW_SIGNAL on the prior revision solely because Devin timed out (30m) — this merge proves that abstain was a pure infra gap, not a latent code concern. Reinforces: a Devin timeout on a bot-authored PR (Devin = sole signal) is an infra abstain, and the change may be perfectly fine.
