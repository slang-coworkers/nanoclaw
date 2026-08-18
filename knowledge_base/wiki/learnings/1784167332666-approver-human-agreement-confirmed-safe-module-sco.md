---
title: "[approver/human-agreement] CONFIRMED-SAFE: module-scoped SharedSemanticsContext seeding (extension-visibility fix) merged byte-identical to the approved diff"
type: learning
topic: review-approval
source: learnings/1784167332666-approver-human-agreement-confirmed-safe-module-sco.md
---

# [approver/human-agreement] CONFIRMED-SAFE: module-scoped SharedSemanticsContext seeding (extension-visibility fix) merged byte-identical to the approved diff

**Outcome (terminal join):** shader-slang/slang#12052 MERGED by jkwak-work (reviewDecision APPROVED, mergeCommit 89443da3, 2026-07-16). My R0/standing decision was **WOULD_APPROVE (CLEAN)** at cd2530568bc2. Merged ⇒ APPROVED-equivalent → **agreement, no false-safe. Confirmed-safe.**

**What humans did between my decided commit and merge:** nothing to the code. The only commits added after cd253056 were two more `Merge branch 'master'` commits (base churn from merge-queue re-queues). The fix's own files (`source/slang/slang-check-shader.cpp` + the regression test) merged **byte-identical** to what I approved (PR-diff hash held at `ef2f5cf7…` end to end). The 2 🟡 advisory gaps and 2 🔵 clarity nits I noted were NOT addressed pre-merge — confirming they were correctly judged non-blocking, not deferred blockers.

**The class of change this confirms is safe (sharpens Step-0 recall for similar R0s):** A fix that constructs a *fresh, single-use* `SharedSemanticsContext` (or similar checking context) and *seeds* a list like `importedModulesList` from a dependency closure, to make a checking boundary adopt the same point-of-view an in-body call has. Why this shape is low-risk when it clears the checks:
- **Blast radius is enumerable and small.** The seeded list has a countable set of readers (here exactly 2 on this path: `getCandidateExtensionsForTypeDecl` — the fix's target, adds once — and `getAssociatedDeclsForDecl` — a benign double-add off the path, idempotent consumers). Grep every reader of the seeded member; if each is either the target or provably idempotent/off-path, a "double-add"-style finding is benign.
- **The dependency closure self-includes the owning module** (`Module::Module` → `addModuleDependency(this)`), so seeding from `getModuleDependencies()` yields a *superset* of the genuinely-visible extensions — it can't drop a legitimately-visible conformance; it can only add the previously-missing primary module. That makes it a correct *tightening*, not a behavior loss.
- **The null-owner fallback preserves prior behavior** (empty dependency list → guarded loop is a no-op), so API/reflection entry points are untouched.

**Transferable probe for the NEXT similar R0:** for a context-construction/seeding fix at a checking boundary, the decision hinges on (1) enumerate every reader of the seeded structure and classify each target-vs-idempotent-vs-off-path; (2) confirm the seed is a superset (self-including closure) so nothing visible is dropped; (3) confirm the no-owner fallback preserves old behavior; (4) if a test drops `-skip-spirv-validation`, close SPIR-V validation empirically. When all four hold and the reviewer is clean, WOULD_APPROVE is well-calibrated — this PR is the confirming data point. Belongs to the primary-file/extension-visibility class: [[slang-11531-root-cause-extension-headers-resolve-n]]. Churn-handling discipline that got here: [[master-merge-churn-approver-discipline]].

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784167332666-approver-human-agreement-confirmed-safe-module-sco.md`_
