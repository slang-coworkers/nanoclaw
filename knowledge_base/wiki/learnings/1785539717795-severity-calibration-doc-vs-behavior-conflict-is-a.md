---
title: "Severity calibration: doc-vs-behavior conflict is a QUESTION/GAP for maintainer intent, not an autonomous BLOCK"
type: learning
topic: review-approval
source: learnings/1785539717795-severity-calibration-doc-vs-behavior-conflict-is-a.md
---

# Severity calibration: doc-vs-behavior conflict is a QUESTION/GAP for maintainer intent, not an autonomous BLOCK

**Calibration from shader-slang/slang#12304 (maintainer-resolved).** I reviewed a PR that removes IRPublicDecoration at the producer, making plain-`public` CPU/CUDA functions emit `static` (host findFuncByName fails) — contradicting docs/cpu-target.md:210 ("`public` makes the variable/function visible outside the module"). I rated it BLOCKING/REQUEST_CHANGES on the strength of the documented-contract conflict. jkwak then APPROVED and flipped the PR ready himself: "This is a fix @csyonghe suggested in the Code Review meeting. The idea was that `public` keyword doesn't do anything; or it is supposed to do nothing." So the behavior change was INTENDED — the doc is the stale artifact, not the fix.

**The rule:** When a change's behavior contradicts CURRENT documentation, that is NOT automatically a blocking defect. The maintainer may be deliberately changing the contract, and the doc may be what's now stale. Treat a documented-contract conflict as a **high-signal QUESTION/GAP surfaced for maintainer intent**, not an autonomous BLOCK — unless you have independent evidence the change is unintended (crash/UB, silent data corruption with no design rationale, an explicit spec/ABI-stability guarantee the PR itself claims to preserve).

**What was RIGHT (keep doing):** the technical analysis — empirical before/after with the pre-PR binary (`public int addTwo`→non-static, after→static), the predicate trace (isPublicOrExportedFunc/_isExported/_getExportStyle key on Public||HLSLExport not plain Export), the doc citation, codex cross-check — was all accurate and load-bearing. That rigor turned a green local sweep into a real finding and is exactly what's wanted. Only the SEVERITY was one notch too hard.

**Heuristic for future doc-vs-behavior calls:** ask "could a maintainer have intended this contract change?" If yes (a keyword's meaning, an emit convention, a target-visibility policy — things owned by design decisions) → QUESTION/GAP with the doc conflict as the evidence, verdict deferred to maintainer. If no (memory safety, ABI break the PR claims not to make, silent miscompile) → BLOCK. When jkwak/csyonghe DICTATED the approach (as here — noted in the PR thread), lean even harder toward surfacing-for-intent over blocking; the layer choice was already a maintainer decision.

Bot reviews are advisory and must not gate human merges anyway (COMMENT-state only) — so "BLOCK" is really shorthand for "I'd strongly push back"; reserve that strength for cases where the change is wrong regardless of intent, not where it merely conflicts with a doc the maintainer may be updating.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785539717795-severity-calibration-doc-vs-behavior-conflict-is-a.md`_
