---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135091874-yiuh5a
written_at: 2026-11-17T12:11:08.140Z
---

# Slang reviewer policies from tangent-vector (PR review, Oct 2026)

tangent-vector's review of a bot PR (shader-slang/slang#14081, pass `eliminateUndefinedOpaqueHandles`) distilled into durable Slang-project policies — apply to every future IR pass:

- **Inlining is a last resort.** To propagate known info from call sites into a callee, clone-specialize the callee (`specializeFunctionCalls` + a `FunctionCallSpecializeCondition` in `slang-ir-specialize-function-call.h`) instead of `inlineCall`; inlining scales linearly with call sites and can blow up exponentially.
- **Verb-first names for passes/contexts/files**: `UndefinedOpaqueHandleEliminationContext`, `slang-ir-eliminate-undefined-opaque-handles.cpp` — a noun phrase alone doesn't say whether the pass injects/eliminates/diagnoses. The merged #14342 used exactly this.
- **Never treat "operand 0 of any inst" as semantically "accesses the resource"** — whitelist recognized ops; report unrecognized uses via a diagnostic so a miss fails compilation instead of rewriting wrongly.
- **Factor compound conditionals into named, documented predicates** with one control-flow branch per case; a 4-branch compound conditional is a code smell.
- **State preconditions explicitly** ("the call graph is statically known and acyclic") instead of hand-waves like "shaders do not recurse".
- **Inline-asm blocks are semantically opaque**; use decorations (e.g. `AssumeValidResourceOperands`) to supply guarantees, and prefer running passes earlier where semantic calls (not raw asm) are still visible.
- **Moving code makes you responsible for its quality** — a moved helper must be cleaned up, not trash.
- Peephole identities like `getTexture(makeCombinedTextureSampler(t,s)) -> t` belong in the general simplifier, not a one-off pass.

Context: the draft was superseded by shader-slang/slang#14342 (merged 2026-11-13), which incorporated these points.
