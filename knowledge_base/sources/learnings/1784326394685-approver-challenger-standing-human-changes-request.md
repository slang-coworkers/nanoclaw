# [approver/challenger] standing human CHANGES_REQUESTED vetoes WOULD_APPROVE regardless of clean doc

# [approver/challenger] A standing, unresolved human CHANGES_REQUESTED caps the decision at ABSTAIN — never round up

**PR:** shader-slang/slang#11136 @bcb552353da9 (mode=live_late). Decision: ABSTAIN_POLICY (CHALLENGER_CONCERN). Fixer PR (nv-slang-bot, fix/gh-8455), Devin-only tier.

## Symptom
The review doc verdict was APPROVE with 0 bugs (Devin ran clean and independently *confirmed* the fix), all 6 eligibility clauses passed, and the code change was verified correct & principled in source (`break;`→`return typeLayout;` in `_unwrapParameterGroups`, tools/gfx/renderer-shared.h — the old `break` exited only the `switch`, not the enclosing `for(;;)`, hanging on non-StructuredBuffer resources). By clauses+doc+challenger-code-read alone this looks like a WOULD_APPROVE. It is NOT.

## Root cause / the rule
`eval-clauses.py` has NO clause for human-review-state. `reviewDecision == CHANGES_REQUESTED` with an unresolved maintainer review standing on the current head is invisible to Steps 1–2 — it only surfaces if the challenger explicitly checks for it. A clean investigation confirms a fix but **cannot dismiss a live human "changes requested"**: only the requesting maintainer can clear their own request. Shadow mode's core invariant ("never round up to approve") means a standing human CHANGES_REQUESTED caps the decision at ABSTAIN_POLICY.

## How to catch it
On EVERY decision (especially mode=live_late), the challenger MUST run:
`gh pr view <pr> --repo <repo> --json reviewDecision,reviews`
- If `reviewDecision == CHANGES_REQUESTED` and no dismissal/re-review clears it → the ceiling is ABSTAIN, not WOULD_APPROVE, no matter how clean the doc.
- A verified 🔴 still escalates to BLOCK; absent a 🔴, it's ABSTAIN_POLICY:CHALLENGER_CONCERN (there is no scripted clause to FAIL, so it lands as a challenger concern, not CLAUSE_FAIL).
- Beware framing drift: the orchestrator described the fixer as "disputing rather than complying." The thread actually showed a comment-clarification request that the fixer *complied with* (comment-only update). Decide from harvested state, not the dispatch framing — but the verdict was unchanged either way, because the maintainer still had not cleared CHANGES_REQUESTED. The comply-vs-dispute distinction changes the *join expectation* (likely to clear soon vs. contentious), not the *current* decision.

## Fix / expected join
Recorded ABSTAIN_POLICY:CHALLENGER_CONCERN. Scoreable row. Expected AGREEMENT if the PR stays in changes-requested or the maintainer clears it after further work; a merge byte-identical over the standing request without the maintainer clearing it would be the signal to re-examine. Record human verdict on the next pr_review / merge / close join against @bcb552353da9.
