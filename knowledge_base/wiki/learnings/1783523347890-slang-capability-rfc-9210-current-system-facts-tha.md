---
title: "Slang capability RFC #9210 — current system facts that shape any triage (verified @33f9ed0ce)"
type: learning
topic: slang-compiler
source: learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md
---

# Slang capability RFC #9210 — current system facts that shape any triage (verified @33f9ed0ce)

When triaging capability-system design/RFC issues (e.g. #9210 "capability system improvements"), several load-bearing facts about the *current* system are easy to get wrong from memory — verify them, they change the verdict:

- **Statement-level capability requirements ALREADY EXIST** as `__requireCapability(...)` → `RequireCapabilityStmt` (`slang-ast-stmt.h:322`, parsed `slang-parser.cpp:6968`, `visitRequireCapabilityStmt`). So an RFC proposal to "allow requirements on individual statements" is partly redundant with what's shipped — say so rather than treating it as net-new.
- **No generic `IRRequireTargetCapability` / `IRRequireCapability` IR op exists.** Only `IRRequireGLSLExtensionDecoration` (`slang-ir-insts.h:269`), `IRRequireWGSLExtensionDecoration` (:277), and the `LateRequireCapability` pass (`slang-ir-late-require-capability.cpp`). A proposal for a general "require this atom for this target" IR op IS net-new.
- **The `[require]` AST attribute** is `RequireCapabilityAttribute` (`slang-ast-modifier.h:937`); call-graph propagation is `_propagateRequirement` (`slang-check-decl.cpp:19939`), and the caller-⊇-callee superset check is `CapabilitySet::checkCapabilityRequirement` (`slang-capability.h:273`), enforced at `slang-check-decl.cpp:20815`/`:20862`.
- **CapabilitySet is disjunction-of-conjunctions, nested by target/stage**: CapabilityTargetSets → CapabilityStageSets → `CapabilityAtomSet : UIntSet` (`slang-capability.h:59`). This is exactly the representation Tim Foley (tangent-vector) blames for most capability pain.
- **Compound capabilities already exist as `alias`** in `slang-capabilities.capdef` (e.g. `alias raytracing = ... :1347`, `alias texture_shadowlod = texture_sm_4_1 :2406`); atom-introducing defs use `def`, keyhole abstracts use `abstract`.
- **Two on-file defects corroborate the RFC's motivation**: #11631 ([require] atoms never reach the codegen cap set — `getTargetCaps()` is target-scoped, `[require]` is per-entry-point) and #11903 (`CapabilitySet::implies(atom)` is INERT on disjunctive/abstract target caps — only true if EVERY disjunct implies the atom).
- **Generic-parameter-dependent `[require]` is genuinely unsupported** (DeepWiki-confirmed; hlsl.meta.slang has an explicit "TODO: handled by capability system" near `_Texture`). This is the one problem both the author and the architect agree is the real unsolved crux.

Triage shape: this class of issue is design/RFC, not fix-eligible, when the subsystem owners are mid-debate with divergent directions (skiminki-nv "move to emit + drop propagation" vs tangent-vector "reverse the mental model: atoms=abilities, set-encode, `requires` clause in the type system"). Correct next step is a maintainer design discussion; PARK at triaged, post a NEUTRAL 5-bullet that records both directions without picking a side, do NOT dispatch a fixer (self-filed + self-assigned dev RFC). Related capability-system cluster to cross-reference: #7948 (disjunction handling), #4947 (unsupported numerical types).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783523347890-slang-capability-rfc-9210-current-system-facts-tha.md`_
