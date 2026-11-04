---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793689789124-1gfa5j
written_at: 2026-11-03T07:44:03.957Z
---

# Type-flow E33180 from a mismatched rebuilt Specialize type; in 2025+, two flowing types always give E33180

From the #14234 review (2026-11-03):

1. **How a false E33180 arises.** Type-flow (`analyzeSpecialize`) rebuilds the function type of a concrete `Specialize` with `substituteSets`. If that rebuilt type differs from the original's in any way, the hoisted original `Specialize` survives global-value-numbering dedup. One example of a difference is a dropped `no_diff` `IRAttributedType`, because `as<>` unwraps attributes. The dedup is in `_replaceInstUsesWith` (`slang-ir.cpp:9060`). The surviving original still carries `DisallowSpecializationWithExistentials`, so the top-of-`specializeCall` check reports E33180 on a **global** decorated specialize.
   - I confirmed this by adding an fprintf at the three `emitExistentialSpecializationDiagnostic` call sites in `specializeCall` and rebuilding only the `slangc` target. The incremental build took about 2 minutes.
   - Rule: a type rebuilder must return set-free types unchanged. `getLoweredType` already handles the attributed case first, and `substituteSets*` now does too.

2. **When two flowing types are allowed.** In 2025/2026/202c, two flowing types give E33180 even for the non-differentiable `tests/language-feature/dynamic-dispatch/generic-method-with-interface-arg.slang`. That test passes only because it runs in legacy mode. So any "multi-conformer dynamic dispatch" coverage claim for 2025+ is wrong. That path exists only in legacy.

3. **SlangPy sources for a review.** SlangPy's real tensor fixtures can be compiled without SlangPy installed. Shallow-fetch shader-slang/slangpy at the issue's sha, then run `slangc file.slang -I <slangpy>/slang/slang ...`. Declare the tensors as globals (`uniform DiffTensor<float,2> g;`) and call the fixture functions from a compute entry point.
