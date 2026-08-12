---
title: "11917 in-pass-scan: #11987 template does NOT transfer to shared-legalizeTypes passes; verify driver hint vs pass's own trigger"
type: learning
topic: verification
source: learnings/1785373772506-11917-in-pass-scan-11987-template-does-not-transfe.md
---

# 11917 in-pass-scan: #11987 template does NOT transfer to shared-legalizeTypes passes; verify driver hint vs pass's own trigger

**Context:** #11917 batch-3 asked to apply the #11987 "in-pass shallow scan at pass entry" early-out (shipped for `legalizeMatrixTypes`) to `legalizeEmptyTypes` and `legalizeResourceTypes`. Driver (pdeayton-nv) gave tentative structural predicates ("resource-typed struct fields + uniform param groups"; "zero-field global struct / array-of-void"). Traced at HEAD 7c58a326b.

**Finding 1 — the #11987 safety proof does NOT transfer to shared-framework passes.** `legalizeMatrixTypes` is a STANDALONE pass with its own worklist and its own `addToWorkList` IRGeneric parent-walk bail (slang-ir-legalize-matrix-types.cpp:50-63); its early-out is safe *because* the scan's blind spot (matrix nested in an unspecialized generic, not hoisted to global scope) exactly matches the pass's own bail — shared blindness. But `legalizeEmptyTypes`/`legalizeResourceTypes` are thin wrappers over the SHARED `legalizeTypes()` / `IRTypeLegalizationPass::processModule` framework (slang-ir-legalize-types.cpp:4020/4161), whose base worklist has **no** IRGeneric bail. So you cannot copy #11987's "scan blind-spot == pass blind-spot" argument. The correct substitute is a **conservative force-run whenever any unspecialized IRGeneric remains** (which pdeayton independently suggested). Also: the shared framework backs 3-4 legalize invocations per compile (#12040) — the early-out must be added **per-context** (guard only the target invocation), never in the shared `processModule`.

**Finding 2 — verify a driver's structural hint against the pass's OWN trigger predicate.** `legalizeResourceTypes`' real trigger is its `isSpecialType(t) == isResourceType(t)` override (matches Texture/Buffer/ConstantBuffer/ParameterBlock/Sampler/SubpassInput/UntypedBuffer after array-strip). That fires on resources in bare function params, locals, resource arrays, and return slots — strictly MORE positions than "struct fields + uniform param groups". Gating the early-out on the narrow structural hint = **stale-FALSE miscompile**. The provably-safe formulation keys the scan on the pass's own `isSpecialType`/`isSimpleType()==false` predicate (a `hasAnyXToLegalize()` mirroring `hasAnyMatrixToLegalize`) — which subsumes the hint by construction. Resource/empty TYPES are hoisted/interned globals, so a globals-scope scan is plausibly a safe superset (same hoisting argument #11987 uses), with a whole-module scan as the safe fallback.

**Takeaway:** For any #11917 gating slice, the load-bearing check is "is the gate/scan predicate a safe SUPERSET of everything the pass mutates?" — derived from the pass's own match condition, not from an approximate structural description. And confirm whether the pass is standalone (copy #11987 directly) or a shared-legalizeTypes wrapper (per-context guard + conservative generic force-run; #11987 proof does not apply).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785373772506-11917-in-pass-scan-11987-template-does-not-transfe.md`_
