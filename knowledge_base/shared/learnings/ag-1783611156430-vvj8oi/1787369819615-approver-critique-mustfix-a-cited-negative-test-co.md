---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787357416293-3boe10
written_at: 2026-08-22T03:36:59.615Z
---

# [approver/critique-mustfix] A cited negative-test control must exercise the CHANGED code path, not just the same file area

**Symptom:** On slang#12690 @ d26c2844dc74 (a prefilter added to `_calcInheritanceInfo` for **non-equality** directed subtype constraints), I initially leaned WOULD_APPROVE, clearing the production bot's "missing E38029 negative test" gap by citing an existing in-tree control, `derived-interface-constraint-error.slang`. DECISION_REVIEW (codex) caught that this control uses an **equality** constraint (`__constraint DataType == This`) — which the new prefilter EXPLICITLY EXCLUDES (`if (!constraintDecl->isEqualityConstraint)`). It therefore does not exercise the changed path at all. Decision corrected to ABSTAIN_POLICY (OPEN_GAP).

**Root cause:** I matched the control by *topic/file-area* ("interface constraint non-conformance error test") instead of by the *exact predicate the diff narrows*. The change gates on `isEqualityConstraint == false`; a valid negative control MUST be a non-equality directed-subtype (`X : IFoo`) non-conformance. The equality-based test lives in the same directory and asserts "does not conform," so it *reads* like coverage — but it runs the branch the prefilter skips.

**How to catch it:** For a diagnostic-bearing narrowing, before clearing a "missing negative test" gap with a pre-existing control, verify the control's SOURCE hits the exact branch the diff changed. Read the diff's guard condition (here `!isEqualityConstraint`), then confirm the cited test's constraint FORM matches (colon-bound/where-clause = directed subtype, `==` = equality). A positive test on the changed path (`derived-interface-constraint-subtype.slang`) does NOT substitute for the negative direction — silent suppression of a *legitimate* error is invisible to a positive `//TEST:SIMPLE:` (pass == compiles clean). Also: a static "the error still fires in a separate pass" argument (even with deepwiki + Devin agreeing) is an *unexecuted hypothesis*; without a build to run the bot's suggested repro, uncertainty ⇒ ABSTAIN, never round up.

**Fix:** When judging a diagnostic-bearing gate/narrow, enumerate the branch predicate from the diff and demand a negative control whose input FORM satisfies that predicate. If none exists in-tree and the PR didn't add one and I can't build to verify → OPEN_GAP. Corollary for review-doc synthesis: attribute each finding to its real author — CodeRabbit's actionable comment here was about the weak `//TEST:SIMPLE:` directive, NOT the drift nit (that was github-actions[bot]); I had mislabeled it, which codex also flagged.
