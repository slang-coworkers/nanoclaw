---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787141961922-ezvw6x
written_at: 2026-09-01T16:29:25.772Z
---

# [approver/human-disagreement] a missing regression test on a PROVEN-correct reachable path is advisory (ships), not OPEN_GAP — #12616 merged as-is over my abstain

**Event:** On shader-slang/slang#12616 (type-flow set-merge perf refactor) @ 4804035e6cdc I recorded **ABSTAIN_POLICY(OPEN_GAP)** — the head-current production review found 0 bugs but flagged "no regression test for the new interleaved multi×multi merge," the branch is reachable, and its only release-build ordering guard is compiled out (#ifdef _DEBUG), so I judged a mis-order could silently miscompile in release ⇒ OPEN_GAP. **Outcome: maintainer `expipiplus1` APPROVED at my exact decision head and the PR merged AS-IS — no test added, no follow-up commit.** My abstain was overruled; the merge refutes its "material enough not to merge as-is" claim.

**What I got right (don't lose these):** HOLDING the two earlier heads over a codex comment-hygiene must-fix instead of self-defaulting to ABSTAIN was vindicated (the author fixed those comments). And codex's DECISION_REVIEW refutation of my "Devin n=800 byte-identity = differential test of the interleave" claim was CORRECT — that argument was bad (the n=800 workload grows one-element-at-a-time = multi×singleton, never exercises the interleave). So the self-correction was epistemically right.

**What I got wrong — the calibration miss:** after the n=800 claim collapsed, I was left with "correct by a sound from-source PROOF, but the exact interleaved branch is untested," and I converted that into a *blocking* OPEN_GAP. The maintainer's approve-and-merge shows that is over-conservative.

**The rule (for Step-0 recall on future PRs of this shape):** When a change's correctness is established by a **sound from-source proof** (a textbook algorithm over verified invariants — here a two-pointer merge over a proven 1:1 monotone `getUniqueID`), AND the production review independently found **0 bugs with correctness traced**, AND **CI is fully green**, a **missing regression test for a specific reachable input sub-shape is ADVISORY (it ships) — not OPEN_GAP** — *even if* that sub-shape's runtime guard is debug-only. The OPEN_GAP/ABSTAIN bar is for **uncertainty about correctness**, not for forward-regression-test hygiene on code you have already PROVEN correct. "Silent-miscompile-if-the-code-were-wrong + debug-only-guard" is a real note to PASS TO THE HUMAN as advisory; by itself it must NOT convert a proven-correct-path coverage gap into a block. Precedents now agree: #12105 (vindicated WOULD_APPROVE, test-gap-only) and #12616 (I abstained on this exact shape; maintainer approved+merged as-is).

**The trap to avoid next time:** don't let a correctly-refuted *coverage* argument (n=800) collapse into an abstain when a *proof* still stands. Losing the empirical leg lowered my confidence in COVERAGE, but the PROOF-of-correctness was untouched — and the proof, not the test, is what a maintainer accepts in lieu of a branch-level regression test. Separate "is it correct?" (proof: yes) from "is the branch tested?" (no) and weight a missing test on proven-correct code as advisory.
