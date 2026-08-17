---
title: "[approver/challenger-miss] The pre-existing/attribution test cuts BOTH ways — a fix-commit can newly introduce a gap; and enumerated-exception invariants must be completeness-checked against every scope"
type: learning
topic: review-approval
source: learnings/1784011508988-approver-challenger-miss-the-pre-existing-attribut.md
---

# [approver/challenger-miss] The pre-existing/attribution test cuts BOTH ways — a fix-commit can newly introduce a gap; and enumerated-exception invariants must be completeness-checked against every scope

## Symptom
slang#12082 ran 4 revisions. Rev2/rev3 I cleared 🟡s as pre-existing (WOULD_APPROVE). Rev4's push was a clean +2/-2 fix of my own rev3 advisory — the pattern-match said "another cosmetic fold-in, WOULD_APPROVE carries." But the fresh production review surfaced a DIFFERENT, PR-introduced 🟡, and the honest call was ABSTAIN_POLICY/OPEN_GAP — breaking a 2-revision approve streak.

## Root cause / two transferable lessons
1. **Attribution cuts both ways.** My prior learning ([[on-a-reformatting-pr-always-base-diff-a-flagged-gap]], [[re-decide-a-synchronize-by-diffing-vs-last-approved-sha]]) said "pre-existing + untouched ⇒ non-blocking." The same base-diff test, applied honestly, can just as easily show a finding is PR-INTRODUCED ⇒ blocking. Here the "leaf Scope wraps exactly ONE public API call" timer-contract comment was ENTIRELY new in this PR (grep of base master api-driver.cpp: no such text). A commit whose message is "Address review: fix X" still introduces the rest of the file's claims — don't let "it's just a fix-up push" or a WOULD_APPROVE streak lull you into skipping the fresh review's new findings. Every revision gets a full fresh challenger; the decision for Rn cites only Rn.

2. **Enumerated-exception invariants are a completeness trap.** The PR's invariant was "leaf timers wrap exactly ONE API call; the composites are {apiTotal, apiReflection, apiCreateSession}." That FORM — a universal claim + a closed list of exceptions — is only true if the exception list is COMPLETE. It wasn't: apiWriteModule (loops getLoadedModuleCount/getLoadedModule/getName/writeToFile per module, api-driver.cpp:636) and rt-composite apiFindEntryPoint (loops findEntryPointByName ×3, :889) are also multi-call/loop timers absent from the list. When you see "X holds for all Y except {A,B,C}", enumerate ALL the Y yourself (here: grep every Scope(timers,"…") site and inspect its body) and check each against the exceptions — don't trust the list is exhaustive.

## How to catch it
- On a fix-commit revision, still re-harvest + read the fresh review; a targeted fix does not immunize the rest of the diff/file. Base-diff each NEW finding to attribute it (pre-existing ⇒ advisory; PR-introduced ⇒ judge on the OPEN_GAP bar).
- For "one call each / composites are {…}" style contracts, list every scope and open each body; a scope wrapping a `for` loop or >1 `x->method()` is a counterexample.
- Devin repeatedly asserted "glossary complete and accurate" across ALL 4 revisions and never caught any of these — it echoes the PR narrative. Zero weight for completeness (see [[devin-narrative-echoes-pr-description]]).

## Fix / rule
Don't round up to preserve a cross-revision WOULD_APPROVE streak. The streak is not evidence. A confirmed PR-introduced contradiction in the contract the PR exists to establish is OPEN_GAP even when the specific push that triggered the re-review was itself a clean fix. Zero code risk ⇒ not BLOCK; human-must-look ⇒ ABSTAIN_POLICY/OPEN_GAP.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784011508988-approver-challenger-miss-the-pre-existing-attribut.md`_
