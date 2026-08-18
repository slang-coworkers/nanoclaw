---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786966663639-3y1j9a
written_at: 2026-08-17T15:06:20.337Z
---

# [approver/challenger-calibration] A RELEASE-fatal assert on a layout-transparent property is OPEN_GAP not BLOCK when unreachable-by-current-producers but fatal-by-construction + reviewer-flagged

## Case
shader-slang/slang#12539 @ `d9ce4ff5` (Fix #12535, unorm/snorm layout-transparency). The PR replaced a debug-only `SLANG_ASSERT(attr==NoDiffAttr)` in the IR natural-layout engine (`slang-ir-layout.cpp`) with a loop-over-all-operands `SLANG_RELEASE_ASSERT(attr==NoDiff||UNorm||SNorm)`. `SLANG_RELEASE_ASSERT` FIRES IN RELEASE (`slang-common.h:374`) — so any attributed type outside that set reaching `calcSizeAndAlignment` is a hard abort in optimized builds, on a property (layout-transparency) whose whole premise is "harmless."

## The decision (why OPEN_GAP, not BLOCK, not WOULD_APPROVE)
- **Not BLOCK.** Traced NOT-reachable by current producers via a **complete enumeration** of all attr-kind SOURCES: the 3 frontend modifier→attr handlers in `visitModifiedType` (`slang-lower-to-ir.cpp:3006-3039`, yields ONLY UNorm/SNorm/NoDiff) + all 14 `getAttributedType` call sites (the rest only copy existing attrs forward; `NonUniformAttr` is a specialization-cache-key token in `slang-ir-specialize-function-call.cpp:618-624`, never a value/field type). A BLOCK needs a VERIFIED reachable 🔴; this is verified-unreachable.
- **Also not a clean success→abort regression vs master.** Pre-PR the site used `SLANG_ASSERT` → in release that is `SLANG_ASSUME`/`__builtin_assume` (`slang-common.h:371`). On a false condition `__builtin_assume` is UB, not a clean compile. So the PR trades silent UB for a defined abort — arguably a hardening for reachable cases.
- **Not WOULD_APPROVE.** Fatal-by-construction, safe ONLY by "no producer does this today" (static enumeration, not exhaustive pass execution — the reviewer's own stated caveat); the PR's OWN process report argues a whitelist is WRONG (would reject NonUniformAttr, inspects only first attr) and then the code IMPLEMENTS a whitelist (rationale-of-record contradicts the code); and TWO independent reviewers (a prior DECISION_REVIEW codex critique + Devin) converged on the exact same site. Real blast radius (release abort) + reasoning-vs-code contradiction ⇒ a human must decide if release-fatal is the right severity. Any doubt ⇒ ABSTAIN.

## Transferable probe
For a diff that changes a `SLANG_ASSERT`→`SLANG_RELEASE_ASSERT` (or otherwise makes a guard fire in release): (1) ask what the RELEASE behaviour was BEFORE (SLANG_ASSERT→SLANG_ASSUME=UB, not success — don't call it a clean regression); (2) enumerate the guarded value's PRODUCERS to test reachability, not just its consumers; (3) if unreachable-today but fatal-by-construction on a "harmless" property AND the PR's own narrative contradicts the guard, that is OPEN_GAP (human severity call), between the false-safe of approving a latent release-abort and the false-BLOCK of an unreachable one.

## Also reinforced (already-known class, applied here)
Devin's `devin-flags.md` said "(none reported)" while the raw page showed 1 Bug + 5 Flags with bodies behind an accordion — the empty derived artifact was a claim about the extractor, not the source (prior art `1785847130778`, `1785935705009`). Recovery: drive agent-browser to expand each finding row; NEVER clear OR block on an unread finding. And: a `synchronize` the orchestrator called a "likely duplicate" was a REAL new commit that moved the head 0600d26e→d9ce4ff5 — re-gate on the actual `headRefOid`, never trust an upstream "duplicate" characterization.
