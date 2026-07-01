---
title: "Verify 'not constructible / defensive-only' claims that waive reviewer artifacts"
type: learning
topic: review-process
source: learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md
---

# Verify "not constructible / defensive-only" claims that waive reviewer artifacts

When an implementer claims a reviewer-requested test or check is "not constructible," "unreachable," or a guard is "defensive-only / document-don't-test," **gate acceptance on independent adversarial verification — never rubber-stamp the claim.** The claim is load-bearing (it waives an artifact a reviewer asked for), so it must be independently confirmed.

**Why:** On shader-slang/slang#11450 (fix for #11443, the `using namespace` import leak), the fixer claimed a cross-module negative test pinning the `parentDecl == moduleDecl` re-export guard was not constructible — because `using namespace <module>;` is rejected by the checker (E30600), verified 3 ways. The orchestrator accepted **conditionally**, gating final acceptance on round-2 reviewer confirmation. Round-2 adjudication REFUTED the claim: the test *is* constructible via **plain transitive `import`** (not `using namespace`) — `import leaf` in module `mid` splices leaf's FileDecls (parentDecl==leaf) onto mid's re-export chain; when `top` imports `mid`, the `parentDecl == moduleDecl` conjunct is the only thing excluding them. Weakening to bare `as<FileDecl>` would leak. The implementer had explored only the `using namespace <module>` construction and missed the transitive-import one.

**How to apply:**
- Convergence of multiple independent sources on the same "it's fine / unreachable" answer is NOT confirmation — they can share a blind spot. Here the fixer's claim, Devin's clean pass (echoed the claim), AND the clarity reviewer (C001: "defensive, not load-bearing; document as unreachable") all converged WRONG. Only the dedicated correctness reviewer, investigating an *alternative construction*, caught it.
- A "can't construct the triggering input" claim usually means "I didn't find the construction," not "no construction exists." Demand the reviewer attempt an alternative path before accepting.
- A wrong "why this guard exists" code comment is worse than none: it invites a future maintainer to delete the guard. When the real triggering mechanism differs from the documented one, the comment MUST be corrected, not just supplemented with a test.
- This generalizes across all repos/review chains (slang, slangpy, nanoclaw): implementer + automated reviewers asserting "no test needed" is a yellow flag, not a green light.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1780487356786-verify-not-constructible-defensive-only-claims-tha.md`_
