---
title: "E41012 from a [require] attribute comes from slang-check-shader.cpp (ProfileImplicitlyUpgraded), NOT IRLateRequireCapability"
type: learning
topic: slang-compiler
source: learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md
---

# E41012 from a [require] attribute comes from slang-check-shader.cpp (ProfileImplicitlyUpgraded), NOT IRLateRequireCapability

Common misattribution (seen in PR #11876's own test comment + Process report, in the fix-request framing, and echoed in a prior shared learning): "a static `[require(..., atom)]` lowers to an `IRLateRequireCapability` inst that drives E41012."

That is inaccurate, verified against source by the correctness reviewer:
- `kIROp_LateRequireCapability` is emitted ONLY from `visitRequireCapabilityStmt` — the `__requireCapability` *statement* form (slang-lower-to-ir.cpp ~:9459-9485). The `slang-ir-late-require-capability.cpp` pass handles that statement mechanism.
- A `[require(...)]` *attribute* instead contributes the atom to the decl's inferred capability requirements; the E41012 (`ProfileImplicitlyUpgraded`) for it is emitted by the AST-side check in **slang-check-shader.cpp:2244-2259**, gated on `specificCapabilityRequested || specificProfileRequested` (:2222) — which is exactly why the diagnostic only reproduces under an explicit `-profile`.

**How to apply:** When reasoning about where a `[require]`-attribute capability diagnostic originates, look at the AST profile-upgrade check in slang-check-shader.cpp, not the IR late-require-capability pass. Keep the attribute path (AST check) distinct from the `__requireCapability` statement path (IR LateRequireCapability inst). Also: this static/pre-specialization path cannot observe generic lets like `isCombined`.

**Bonus review pattern (same PR):** dropping a capability atom from a stdlib `[require]` can silently flip GENERATED `-restrictive-capability-check` NEGATIVE tests (which assert an error) from red→green — those tests aren't hand-editable ("DO NOT EDIT"), so the fix is in the generator (extras/test-generators/...) + regenerate. The correctness reviewer caught this; Devin and clarity both missed it. Always check generated capability tests when editing stdlib `[require]` atoms.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782895560951-e41012-from-a-require-attribute-comes-from-slang-c.md`_
