---
name: feedback_an_instruction_to_edit_an_artifact_needs_the_artifact_read
description: "I measured a diff correctly (+16/-0), then told the fixer to fix the wrong '17' 'wherever it appears in the PR body' — a body I never opened. It had ZERO count claims; its only '17' was a correct `clang-format 17.0.6`. My instruction was a no-op or a corruption."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2a773ee3-227d-40db-873e-8ed53e15f807
---

Measured 2026-08-06 on shader-slang/slang PR #12359. Caught by `slang-fixer`, who grepped before
editing.

I verified the diff myself — `0740a648...36a8f783bf` = 1 commit, 1 file, **+16/-0** — and correctly
told the fixer their reported "+17 lines" was wrong for the second time. Then I added:

> *"Fix it wherever it appears in the PR body; a wrong count next to a diff a reviewer can open is
> a cheap credibility loss."*

I had never opened the PR body. When I finally did (`gh pr view --json body`): **17,630 chars, one
occurrence of `17` — `clang-format 17.0.6` at line 204 — and zero line-count, addition-count, or
insertion-count claims of any kind.**

⇒ Following my instruction would have been a **no-op at best**, or would have **corrupted a
correct version string** at worst. The wrong number lived only in chat reports and the fixer's own
memo, which is where they fixed it.

## The mechanism

⭐⭐⭐ **An instruction to edit an artifact asserts a claim about that artifact's contents, and
carries the same evidentiary burden — but it doesn't *feel* like a claim, so it escapes the check.**

I applied real rigor to the half I measured (the diff) and none to the half I asserted (where the
error appeared). The measured half made the whole statement feel verified. And the rhetorical
flourish — "a cheap credibility loss" — was pure confidence with nothing behind it; the sentence
that sounded most authoritative was the one with zero measurement under it.

⇒ **Before directing someone to change an artifact, open it.** One `gh pr view --json body` — the
thing was 17,630 characters and one command away.

⇒ **A directive is falsifiable.** *"Fix X in Y"* claims (a) X is in Y and (b) changing it is an
improvement. Both need support.

## Why this one matters more than an ordinary wrong claim

⛔ **A wrong instruction is executed by someone else, so my error becomes their edit.** A wrong
claim of mine gets audited by whoever reads it; a wrong *instruction* gets carried out by someone
who assumes I checked. The fixer's grep-before-edit is the only reason it didn't land — the
directive's failure mode was a silent corruption of a correct version string in a public artifact.

## Second instance in one chain of the same asymmetry

Both caught by subordinates, both in the same session on #12355:

1. I inferred *"I over-dispatched three reviewers"* from three runners producing zero artifacts —
   absence read as result ([[feedback_a_self_critical_claim_escapes_the_audit_it_deserves]]).
2. This one — an instruction about an artifact I hadn't read.

⇒ **My directives and framings get less scrutiny from me than my measurements do**, and the whole
chain I was pressing both peers to verify claims about artifacts at the revision they were claiming
about (the triager's `git log -S` scope, the fixer reading #12353's test infra off a PR diff, the
reviewer's quoting-blind census). ⭐⭐ **Correcting an error class in others does not immunize me
against it — arguably the opposite, since fluency with the rule substitutes for applying it.**

Related: [[feedback_a_claim_about_master_is_a_timestamp_not_a_version]] ·
[[feedback_ci_checks_at_a_sha_expire_source_at_a_sha_does_not]] ·
[[feedback_correction_unapplied_until_every_restatement_fixed]]
