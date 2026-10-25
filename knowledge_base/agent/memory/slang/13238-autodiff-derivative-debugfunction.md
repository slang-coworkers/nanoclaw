---
type: chain
title: slang#13238 — each generated derivative gets its own DebugFunction record
description: "Bot draft PR #13239 @803151ff9 (assignee and requested reviewer jkwak-work, 0 reviews since 09-24). 10-24: Falcor-gate 30-day expiry webhook, and the PR was CONFLICTING with master's #13219 (lexical debug scopes). The fixer's local merge 45061546b showed a semantic gap: the s_apply_f body scopes still point at f's now-dangling record. I authorized option A (remap body scopes at the clone point, then peer review, then one push, then a no-ping status comment, no CI dispatch)."
tags: [slang, autodiff, debug-info, spirv]
---

# slang#13238 — per-derivative DebugFunction

**10-24 04:08Z, fixer report.** Merging master `#13219` (lexical debug scopes) into #13239 was textually mechanical
(local `45061546b`; PR tests pass 2/2, 1/1, 1/1), but not semantically complete. `s_apply_f`'s body keeps
`DebugScope`/`DebugLocalVariable`/`DebugLexicalBlock` pointing at the original `f` record, which now has 0
`DebugFunctionDefinition`s. `s_bwdProp_f` is coherent because address-space specialization re-clones its scopes. Master's
updated `-shared.slang` fails under the fix. Nothing was pushed, and the PR has no bot status comment.

**Decision (Main, 10-24 ~04:12Z): A.** Remap the derivative body's debug-scope references to the derivative's own record
where the apply body is cloned (the producer-side fix in `slang-ir-autodiff-rev.cpp` / `copyDebugInfo`), and adopt
master's `-shared` scenario as a body-scope coherence test. I see this as completing the original fix on current master,
not as new scope. Then slang-reviewer R1, one plain push, and one 5-bullet PR status comment with no @-mention. No CI
dispatch (Falcor-gate deadlock, see the shared learning). Real CI needs jkwak-work to mark the PR ready or approve the gate.
**10-24 05:03Z:** A1′ is implemented locally. The multi-root shape is reproduced and tested: an `[__unsafeForceInlineEarly]` callee in a ternary branch aborted the old single-root assert, and that body is now left unchanged. codex CODE_REVIEW approved, and slang-reviewer R1 is pending. Not pushed. A3 (the inliner always attaching `inlinedAt`) goes to the maintainer as an open question.
**10-24 06:31–06:46Z:** R1 returned REQUEST_CHANGES but said A1′ is not masking. It identified the producer: forward mode inherits the primal clone's record, and reverse mode inherits the unzipped fwd derivative's record (agrees with the body walk 1125/1125). The fixer applied the explicit-inherited-root remedy plus nits, giving local head `11a9df921`: autodiff 1025, spirv 722, -g 118, language-feature 2661, all green. R2 is pending. The inliner `inlinedAt` gap is NOT to be filed by the bot; it's listed as a follow-up. Filing is an operator decision, to be asked after the chain reports.

**10-24 08:40Z, Fix Report (verified live 08:45Z).** Draft #13239 is at `6850aac48`, MERGEABLE, `pr: non-breaking`. Explanation cmt 6381940232 and status cmt 6382077491 are bot-posted with no @-mention. Only push/`pull_request` runs, no dispatch. R2 returned APPROVE_WITH_NITS (applied). No triager session exists on this thread, so the chain reports to me. PARKED on jkwak-work's review. Two follow-ups are unfiled, and filing is the operator's call: (1) the inliner drops `inlinedAt` when there's no preceding DebugLine; (2) 4 derivatives have no DebugFunction record (same on master).
