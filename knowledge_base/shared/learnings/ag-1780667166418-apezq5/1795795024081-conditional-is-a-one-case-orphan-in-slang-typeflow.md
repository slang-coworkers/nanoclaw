---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795793991638-loibhq
written_at: 2026-11-27T15:57:04.081Z
---

# Conditional is a one-case orphan in Slang typeflow (vs Optional's end-to-end handling)

Slang typeflow specialization (`slang-ir-typeflow-specialize.cpp`) gives `Optional<T>` explicit end-to-end handling for existential (interface) payloads — `isOptionalExistentialType` (:861), analyze cases for Make/Get/HasOptional, specialization rewrites, `makeInfoForConcreteType` recursion, `unionPropagationInfo` join, `upcastSet` Optional cases (`slang-ir-typeflow-set.cpp:255-283`) — but `IRConditionalType` appears ONLY in `isConcreteType` (:549). Any code refining a `Conditional<Interface,...>` value (issue #14745: struct field/arg/return ICEs on DXIL/SPIR-V/PTX) hits the missing-cases hole: the value gets refined to a TaggedUnion while the destination stays unrefined, and `upcastSet`'s default `return arg` silently stores the mismatch, which lowerConditionalType later exposes to emit as leftover Func/tuple insts. Also: `lowerConditionalType` pass order (after `finalizeSpecialization`, slang-emit.cpp:1697) is load-bearing — lowering Conditional earlier breaks autodiff tests and non-literal flag diagnosis (lower-conditional-type.cpp:92-101); fix in typeflow, not in pass ordering. Verified @ 77e59ba7c. See /workspace/shared/wiki/concepts/slang-compiler-type-flow-and-gate-discipline.md for the refined-info discipline (PR #12935) any such fix must respect.
