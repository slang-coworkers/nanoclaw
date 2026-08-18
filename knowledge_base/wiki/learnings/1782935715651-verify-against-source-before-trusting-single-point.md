---
title: "Verify against source before trusting single-point triage OR contradictory reviewer invariants"
type: learning
topic: review-process
source: learnings/1782935715651-verify-against-source-before-trusting-single-point.md
---

# Verify against source before trusting single-point triage OR contradictory reviewer invariants

Two reinforcing lessons from slang#11860 (vk::input_attachment_index falsely reserving descriptor set 0; PR #11871, MERGED).

**1. A triage "recommended fix" naming ONE code point is a hypothesis, not a diagnosis — prove it with a local RED→GREEN + ablation before shipping.** Triage recommended a single-point fix (skip `markSpaceUsed` for `InputAttachmentIndex` at one call site). Building with just that guard left the bug live: a SECOND, independent space-occupancy consumer (`doesEntryPointParameterResourceNeedDefaultSpace` → default-space allocation) also reserved set 0. Only an instrumented build (printing the actual `markSpaceUsed`/`allocateUnusedSpaces` calls) surfaced the cascade. Ablation matrix (hunk1-only → still broken; hunk2-only → still broken; both → fixed) is what proved both were load-bearing. If you can't name a test that goes RED without a given hunk, you don't yet understand the fix. Don't let a confident triage memo substitute for your own verification.

**2. When two reviewers assert CONTRADICTORY invariants, read the source and settle it yourself — never encode a reviewer's claim as a code comment on faith.** On the same PR, reviewer A said "VaryingInput/VaryingOutput/SpecializationConstant DO reach the guarded branch with placeholder space==0 via the GLSL binding path"; reviewer C said the opposite ("those kinds are never fed to that function"). Both were advisory-only (0 correctness bugs), asking me to document an invariant at the guard. Reading `addExplicitParameterBindings_GLSL` resolved it: A was right (the `info[]` loop feeds each entry, including varying/spec-constant with explicit `[[vk::location]]`/`[[vk::constant_id]]`, to the guarded function with space==0). Had I trusted C's framing, I'd have committed a comment asserting a FALSE invariant ("InputAttachmentIndex is the only kind reaching here") — worse than no comment, because future readers trust it. The honest note was "narrow guard by design; siblings share the latent pattern but are higher-blast-radius/out-of-scope," which matched the actual control flow.

General rule: comments (and PR-body claims) about control-flow invariants must be verified against the code at HEAD, not lifted from a triage memo or a reviewer assertion — especially when sources disagree. Cheap to verify; expensive to ship a confidently-wrong invariant.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782935715651-verify-against-source-before-trusting-single-point.md`_
