### Verdict
approve

### Requirements
- none

### Must-fix (blocks merge)
- none

**Focus (1) — propagation guarantees whole-path foldability.** Verified in `source/slang/slang-ir-reconstruct-short-circuit.cpp:374-408` (branch `18e9dd763`). The arm scan iterates the block in order; intra-block SSA is def-before-use, so `foldPathInsts` is complete for each inst when checked (comment at :370-373 states this invariant). Path taint is by operand membership (:400-401), which correctly handles multi-operand joins and the `[__readNone]`-call-above-a-load case: the call doesn't start a path (`isMemoryReadingInst && !isReadNoneCall` false) but is tainted via its load operand and then fold-checked — the new test exercises exactly this (`Load → Mul → twiceX()`). Chain single-use means exactly one path from each read to the root, so checking each on-path inst's own edge suffices. The root is checked against the arm-branch use; post-rewrite its user becomes the `And`/`Or` — veto-equivalent (root is Bool-typed, so the vector/matrix vetoes are N/A; neither a branch nor `And`/`Or` is a multi-ref intrinsic call or `SwizzledStore`).

**Focus (2) — `isNeverFoldedOnCLikeTargets` mirrors the C-family Never set.** Checked clause-by-clause against `CLikeSourceEmitter::getFoldPolicy` (slang-emit-c-like.cpp:1503). All chain-reachable `Never` ops are present (UpdateElement, DefaultConstruct, MetalCastToDepthTexture, four Coop ops, five Make\* ops). Declaration-group exclusions are sound: `Var` has no operands (can't sit downstream of a read); `Alloca`/`Store` are impure by `mightHaveSideEffects`' default (slang-ir.cpp:9492) so `canHoistArmInst` already rejects them; globals have module parents so never enter the chain; arm `Param`s are explicitly rejected. The two descriptor-heap loads are bailed in `canHoistArmInst` (pass :279-292) as the comment cross-references. `Make*` are `Never` for function-local values — confirmed `isInnerGlobalAggregate` (slang-emit-c-like.cpp:1469) requires a module parent. No `CPPSourceEmitter`/`CUDASourceEmitter` override of `getFoldPolicy` exists, and `CUDASourceEmitter : public CPPSourceEmitter` (slang-emit-cuda.h:44), so the pass's target gate (CUDA + non-LLVM CPU) covers exactly the mirrored classification.

**Focus (3) — CPP second-switch mirror.** Pass :153-167 matches `CPPSourceEmitter::shouldFoldInstIntoUseSites` (slang-emit-cpp.cpp:2003-2011): same six reshape/cast ops, same `IRVectorType||IRMatrixType` gate, positioned after the user-side vetoes (order irrelevant — all are pure vetoes). The multi-ref intrinsic scan (pass :92-122) is textually identical to slang-emit-c-like.cpp:1790-1830, and both sides resolve definitions via the same 4-arg `findTargetIntrinsicDefinition` with `targetReq->getTargetCaps()` (the emitter's 3-arg member forwards with `getTargetCaps()`, slang-emit-c-like.cpp:2387-2392).

**Focus (4) — no new hole from propagation.** Post-pass pipeline audit (slang-emit.cpp:2849 onward): `eliminatePhis` has no remaining params in the diamond's merge block; `simplifyNonSSAIR`'s `removeRedundancy` dedups only `isMovableInst` insts — for `Load` that is ConstantBuffer/ParameterBlock/UniformConstant-GEP only (slang-ir.cpp:10278-10309), exactly the speculatable class the new file comment claims, and dedup of a non-load movable on a path requires its load operand to dedup first (same class); `hoistLoopInvariantInsts` is `false` in this pipeline (slang-ir-ssa-simplification.h:23); peephole rewrites preserve or remove folds; `applyVariableScopeCorrection` never touches same-block uses. `armInsts` was dead at base — removal clean. Test discriminates the bug: pre-fix the interior `Mul` was unchecked, post-fix it's vetoed, and `CHECK-NOT: &&` distinguishes hoisted-chain output from kept-diamond output. Comment hygiene: all new comments state invariants/rationale or mirror provenance (the file's established idiom); no restatements or change-history narration.

### Advisory
- `source/slang/slang-ir-reconstruct-short-circuit.cpp:226` (branch) — pre-existing, untouched by this delta: `isMemoryReadingInst` omits `kIROp_LoadReverseGradient`, which `mightHaveSideEffects` classifies pure (slang-ir.cpp:9652) and which observes memory like `Load`. Unreachable here in practice (consumed by autodiff lowering long before emit prep), but if the list is meant to be exhaustive over pure memory-observing ops, adding it future-proofs the classification.
- `source/slang/slang-ir-reconstruct-short-circuit.cpp:85` (branch) — the `canFoldIntoUseSite`/`isNeverFoldedOnCLikeTargets` mirrors duplicate emitter logic with no compile-time coupling; a future CPP/CUDA fold veto (new clause in `shouldFoldInstIntoUseSites` or `getFoldPolicy`) would silently invalidate the pass's guarantee. The provenance comments naming the mirrored functions mitigate; a cross-reference comment at the emitter sites would close the loop.

### Notes
- The new file-comment claim about `removeRedundancy` was verified end-to-end: dedup is gated on `isMovableInst` (slang-ir-redundancy-removal.cpp:82), movable loads are only the constant-storage classes, and loop-invariant hoisting of that class exists (`hoistLoopInvariantInsts=true` in slang-ir-autodiff-fwd.cpp:2464) — so "Slang's speculatable class" is accurate.
- The `block == afterBlock` guard (:481-486) silently returns for a shape the comment says no known producer creates; AGENTS.md's self-review prefers assertions for out-of-contract shapes, but this matches the pass's deliberate "check rather than assume" idiom and only forgoes an optimization — acceptable as-is.
- Read-only constraint honored: no build or test run; all claims verified against branch blobs and worktree sources.

### Attested
- d460e1a56920434b68d5a0633f01b1dad455d36b50292689815f89231f49deed  source/slang/slang-ir-reconstruct-short-circuit.cpp @18e9dd763 (via `git show`)
- cb05314d8d0a6b3c643b027c3c0396618d0488faefd0927a0e962c3f83cfa7ec  tests/cuda/short-circuit-intrinsic-multiref-indirect.slang @18e9dd763 (via `git show`)
- 4fd805126c89e5e348fe3845cd18885747321dba4521ba77792b57f0f379d311  source/slang/slang-emit.cpp @18e9dd763 (via `git show`)
- 25681d3d890974812899121aea6fdd8cacc82acd75a9a6ced489d2d0a8bc2ec9  source/slang/slang-emit-c-like.cpp
- dfed88a7159de9016c3929a6edaa1500347e9bfc794af6b5b4221e1563f35182  source/slang/slang-emit-cpp.cpp
- cdd1bef22a9d594d5d96d3be64e0baa6ad0ef68990d37de8a8b59bf1133f9382  source/slang/slang-emit-c-like.h
- 87d63ebe489a2b2ecd935b7bfaa2533d6fdddce36514e60626f109424b7672f6  source/slang/slang-emit-cuda.h
- 0cfc0a4c9f1aba13b3f33577d5689e1f7ec3fa1ba03c04b17e71e1a46484b5a1  source/slang/slang-ir.cpp
- f7f29b21227441fa6344062f97eed09b8efd090e120ef5ad697c4fdc53fbeb4f  source/slang/slang-ir-ssa-simplification.cpp
- 8b90be446ab8ac1f178f6157d311db7c5a5aa240b79f03cc0b92efc9953eb0f5  source/slang/slang-ir-ssa-simplification.h
- c97892d842f245df0af2ef70f1905a8e83cb99c82adec04cb5a315a1c6101cb2  source/slang/slang-ir-redundancy-removal.cpp
- 30d9677dbad8c03c4f51ed4285615418779e2c9b3b79a53310f7ee32d54478f2  source/slang/slang-ir-peephole.cpp
- adeff2abf415ec3730f48126a16b1a1a8f55f86ec33dba9e7c8b0be6c221130d  source/slang/slang-ir-variable-scope-correction.cpp
