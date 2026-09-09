---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787867970491-5ou9sf
written_at: 2026-08-27T22:22:25.423Z
---

# [approver/critique-mustfix] Regression-test comment narrating the prior bug trips the comment-hygiene gate; and re-cite line numbers at the PINNED head after a mid-flight comment-only push

## Context
shader-slang/slang PR #12537 (Fix #12532, stop double-reading OptiX payload registers on inout legalization), 2026-08-27. Bot-authored ⇒ Devin-only tier, Devin clean, 6/6 clauses pass, functional challenger CLEAN. Drafted WOULD_APPROVE, but DECISION_REVIEW (codex) held must-fix through 3 rounds ⇒ recorded ABSTAIN_POLICY / CRITIQUE_MUSTFIX.

## Two transferable lessons

### 1. The comment-hygiene rubric has no regression-test exception — and the approver can't fix it
Symptom: A new regression test (`tests/optix/optix-payload-duplicate-reads.slang:9`) had a comment stating the enduring invariant ("4 gets / 4 sets") AND a sentence narrating the prior bug ("Previously the register path emitted the readback on BOTH passes… 8 reads"). The mandatory comment-hygiene rubric classifies change-history / "Previously…" narration as must-fix, with NO carve-out for regression tests — even though "Previously X was broken" is pervasive and accepted in slang's `tests/` tree.
Root cause: For code diffs, the critique gate enforces "only non-obvious *why*, no change-history." A regression test's *why* IS the past bug, so the author (and much existing precedent) writes it in — but the rubric reads the past-tense sentence as prohibited narration regardless. codex explicitly noted precedent does not override the explicit criterion, and a maintainer's silence on the line is not an affirmative pass.
How to catch it: Before drafting WOULD_APPROVE on a PR that ADDS tests, scan every new test comment for past-tense "Previously / used to / was broken / the bug produced" narration. It will trip DECISION_REVIEW even when functionally irrelevant.
Fix / disposition: The approver never edits the PR, so a held must-fix leaves only revise-or-ABSTAIN ⇒ ABSTAIN_POLICY/CRITIQUE_MUSTFIX (a human looks; a new head reframing the comment re-gates). Don't force an approve past the gate. If the fleet decides regression-test history should be exempt, that's a rubric change to raise with the operator — not something to override case-by-case.

### 2. After a mid-flight comment-only push, RE-CITE line numbers at the pinned head
Symptom: I staged first on head `d7d4ae11`, read the source there, then the author pushed two comment-only cleanups → settled head `67f05607`. My challenger/decision cited `:2347/:1151/:2398/:2033` — but those were the OLD head's lines; the cleanup removed ~20 comment lines and shifted everything up. DECISION_REVIEW caught the citations as stale (true lines `:2327/:1138/:2378/:2020`).
Root cause: A comment-only interval changes NO logic but DOES move line numbers. Reusing citations read from a superseded head silently produces wrong file:line evidence in the decision artifact — an auditability defect even when the code is byte-identical logic.
How to catch it: When the head moves mid-flight (even comment-only), re-fetch the changed file at the PINNED commit and re-derive every file:line you cite. `gh api repos/O/N/compare/OLD...NEW` tells you it's comment-only; it does NOT tell you the citations still line up — they don't.
Fix: Re-cite at the pinned head, always. Cheap, and it's exactly what the critique gate audits.
