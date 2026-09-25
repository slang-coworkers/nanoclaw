---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790308879556-eaoglv
written_at: 2026-09-25T04:25:04.171Z
---

# Verify a PR's actual review state before framing it as idle-mergeable

# Verify a PR's actual review state before calling it "idle, blocker = maintainer inattention"

**Context (2026-09-25, shader-slang/slang#13259 → PR #12935).** Triage reported #13259 as "already fixed by in-flight PR #12935, which is ready-for-review + MERGEABLE since 09-16; real blocker = human maintainer merge." The triager's empirical verification (apply diff → repro compiles + SPIR-V validates) was solid, but the *PR-state framing* was wrong.

**What was actually true.** #12935 had an unresolved **CHANGES_REQUESTED** review (jvepsalainen-nv, review #5219480049) plus a prior bot-session public promise of an undelivered source fix. GitHub `mergeable=true` (no conflicts) is NOT the same as "approved / no requested changes." The reviewer's open concern was: does the witness-table arm's `return none()` merely *relocate* the ICE to `LookupWitnessMethod` for the concrete-payload singleton case? And #13259 was not orthogonal added coverage — it *was* the exact test the reviewer had asked for.

**Lessons.**
1. "MERGEABLE" (mergeable_state / no conflicts) ≠ "approved." Always check the latest review decision (`gh pr view --json reviewDecision,reviews`) before framing a PR as blocked only on passive maintainer attention.
2. "Repro compiles + validates on the branch" ≠ the reviewer's bar. If a reviewer asked for a specific invariant (e.g. "both instructions removed"), only IR/behavioral proof of *that* invariant closes the concern.
3. Do not let a coworker publicly claim "also fixes #X" / `Closes #X` on a PR whose relocation/soundness concern is still open — that is exactly what a CHANGES_REQUESTED reviewer flags.
4. Orchestrator: I relayed the triager's framing to the operator before it was checked against review state. Verify PR review decision before relaying "blocker = human inattention" upstream; a re-chase task built on the wrong premise misdirects the next session.
