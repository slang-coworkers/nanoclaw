I have completed my verification. Here is the review.

### Verdict
must-fix

### Requirements
- none

### Must-fix (blocks merge)
- MF-1. `source/slang/slang-ir-reconstruct-short-circuit.cpp:337` — the fold guarantee is verified only on the memory read's *immediate* use-site edge (`canFoldIntoUseSite(inst, inst->firstUse)` inside `tryCollectArmChain`), not transitively along the single-use chain to the root. If any *interior* chain inst on the path from the read to the `And`/`Or` fails the emitter's own fold decision, the emitter prints that interior inst as a statement in the block before the `if`, and the folded memory-read text lands inside that statement — evaluated unconditionally. That is exactly the changed evaluation order the task invariant forbids. Concrete failing shape (same feature as the authors' own multiref test, one level deeper):
  ```slang
  __target_intrinsic(cuda, "(($0) + ($0))")
  [__readNone]
  float twice(float v);
  if (tid.x < count && twice(buf[tid.x] + 1.0f) > 0.5) { ... }
  ```
  Chain in the arm: `StructuredBufferLoad → Add → call twice → cmp`. The pass checks only the load's edge (user is the `Add` — no veto) and hoists. At emit, `shouldFoldInstIntoUseSites(Add)` declines (its user is a multi-referenced intrinsic, the check the pass itself mirrors), so the add becomes `float _S1 = buf_0[i] + 1.0f;` before the `if`, with the load folded into it — `buf[i]` is read even when `i >= count`. The same hole exists for interior `FoldPolicy::Never` ops (`MakeStruct`/`MakeArray`/`UpdateElement`/`DefaultConstruct`, e.g. `twice(S(buf[i]).x)` surviving the `FieldExtract(MakeStruct)` peephole when the struct feeds a call) and for interior vector-typed insts covered by the *second* switch of `CPPSourceEmitter::shouldFoldInstIntoUseSites` (`source/slang/slang-emit-cpp.cpp:2000`, vector reshape/cast as the inst itself — currently not mirrored at all).
  FIX: propagate the fold requirement up the single-use path from every memory read to the chain root, and mirror the two missing emitter classifications. Applicable as written:
  ```diff
  --- a/source/slang/slang-ir-reconstruct-short-circuit.cpp
  +++ b/source/slang/slang-ir-reconstruct-short-circuit.cpp
  @@ -74,9 +74,10 @@
       // Mirror of the user-side fold vetoes in
       // `CLikeSourceEmitter::shouldFoldInstIntoUseSites` and
       // `CPPSourceEmitter::shouldFoldInstIntoUseSites` (which CUDA inherits):
  -    // returns whether `inst`, known to be single-use and pure, will actually
  -    // be folded into the text of its use site by the emitter. Only
  -    // memory-reading instructions need this guarantee (see the file comment).
  +    // returns whether `inst`, known to be single-use and pure, will actually
  +    // be folded into the text of its use site by the emitter. Every
  +    // instruction on the path from a memory read to the chain root needs
  +    // this guarantee (see the file comment).
       bool canFoldIntoUseSite(IRInst* inst, IRUse* use)
       {
  @@ -145,6 +146,49 @@
                   if (swizzle->getBase() == inst && swizzle->getElementCount() > 1)
                       return false;
               }
  +
  +            // The second switch in `CPPSourceEmitter::shouldFoldInstIntoUseSites`:
  +            // a vector- or matrix-typed reshape/cast instruction is itself
  +            // never folded, regardless of its user.
  +            switch (inst->getOp())
  +            {
  +            case kIROp_MatrixReshape:
  +            case kIROp_VectorReshape:
  +            case kIROp_IntCast:
  +            case kIROp_FloatCast:
  +            case kIROp_CastIntToFloat:
  +            case kIROp_CastFloatToInt:
  +                return false;
  +            default:
  +                break;
  +            }
  +        }
  +
  +        return true;
  +    }
  +
  +    // Mirror of the `FoldPolicy::Never` opcodes in
  +    // `CLikeSourceEmitter::getFoldPolicy` that can appear inside an
  +    // expression chain (declaration-like ops such as `Var`/`Param` cannot).
  +    // The `Make*` entries are `Never` only for function-local values
  +    // (`isInnerGlobalAggregate`), and chain instructions are always
  +    // function-local.
  +    bool isNeverFoldedOnCLikeTargets(IRInst* inst)
  +    {
  +        switch (inst->getOp())
  +        {
  +        case kIROp_MakeStruct:
  +        case kIROp_MakeArray:
  +        case kIROp_SwizzleSet:
  +        case kIROp_MakeArrayFromElement:
  +        case kIROp_MakeCoopVector:
  +        case kIROp_UpdateElement:
  +        case kIROp_DefaultConstruct:
  +        case kIROp_MetalCastToDepthTexture:
  +        case kIROp_CoopMatMulAdd:
  +        case kIROp_CoopVecMatMulAdd:
  +        case kIROp_CoopVecOuterProductAccumulate:
  +        case kIROp_CoopVecReduceSumAccumulate:
  +            return true;
  +        default:
  +            return false;
           }
  -
  -        return true;
       }
  @@ -318,6 +362,7 @@
           // Verify every instruction of the arm.
  -        List<IRInst*> armInsts;
  +        HashSet<IRInst*> foldPathInsts;
           for (auto inst = armBlock->getFirstInst(); inst; inst = inst->getNextInst())
           {
  @@ -334,10 +379,27 @@
                       auto user = inst->firstUse->getUser();
                       if (!inChain.contains(user) && user != armBlock->getTerminator())
                           return false;
  -                    if (isMemoryReadingInst(inst) && !isReadNoneCall(inst))
  +                    // A memory read only stays conditionally evaluated if its
  +                    // text lands inside the emitted `&&`/`||` operand, so every
  +                    // instruction on the single-use path from the read to the
  +                    // chain root must fold into its own use site. The emitter
  +                    // prints a non-folded instruction as a statement in the
  +                    // block before the `if`, and anything folded into that
  +                    // statement is then evaluated unconditionally. Arm order
  +                    // is def-before-use, so operands are visited first.
  +                    bool onFoldPath = isMemoryReadingInst(inst) && !isReadNoneCall(inst);
  +                    for (UInt i = 0; i < inst->getOperandCount() && !onFoldPath; i++)
  +                        onFoldPath = foldPathInsts.contains(inst->getOperand(i));
  +                    if (onFoldPath)
                       {
  +                        if (isNeverFoldedOnCLikeTargets(inst))
  +                            return false;
                           if (!canFoldIntoUseSite(inst, inst->firstUse))
                               return false;
  +                        foldPathInsts.add(inst);
                       }
                   }
  ```
  RE-CHECK: add `tests/cuda/short-circuit-intrinsic-multiref-indirect.slang`:
  ```slang
  //TEST:SIMPLE(filecheck=CHECK): -stage compute -entry computeMain -target cuda
  //TEST_INPUT:ubuffer(data=[0 0 0 0], stride=4):out,name=output
  RWStructuredBuffer<uint> output;
  StructuredBuffer<float> buf;
  __target_intrinsic(cuda, "(($0) + ($0))")
  [__readNone]
  float twice(float v);
  [shader("compute")]
  [numthreads(4, 1, 1)]
  void computeMain(uint3 tid : SV_DispatchThreadID)
  {
      uint count = output[0];
      if (tid.x < count && twice(buf[tid.x] + 1.0f) > 0.5)
          output[tid.x] = 1;
      else
          output[tid.x] = 0;
      // The `+ 1.0f` between the load and the multi-referenced intrinsic does
      // not fold into the call text, so the chain must keep its diamond.
      //CHECK-NOT: &&
  }
  ```
  then `build/Release/bin/slang-test tests/cuda/short-circuit-` → all 6 tests pass; the fixed pass bails on this diamond (before the fix the emitted `.cu` contains `float _S… = buf_0[…] + 1.0f;` ahead of an `&&`).

### Advisory
- `source/slang/slang-ir-reconstruct-short-circuit.cpp:611` — the gate comment claims "WGSL's `&&`/`||` do not short-circuit". Current WGSL `&&`/`||` *are* short-circuiting per the spec; the exclusion is fine (the mirrored fold vetoes are C-family/CPP-emitter-specific and the WGSL emitter's decisions are not mirrored), but the stated reason is wrong and could mislead a future extension. Suggest: "WGSL and the GLSL/HLSL/Metal emitters are not covered by the mirrored fold decisions yet."
- `source/slang/slang-ir-reconstruct-short-circuit.cpp:404` — `tryReconstructDiamond` never checks `block != afterBlock`. A degenerate `ifElse` whose `afterBlock` is its own parent block (representable only on the entry block, given the predecessor-count checks) would pass every gate and be rewritten into an unconditional self-branch. No known producer creates that shape at this stage, but a one-line `if (block == afterBlock) return false;` is cheap hardening consistent with the pass's check-rather-than-assume style.
- `source/slang/slang-ir-reconstruct-short-circuit.cpp:319` — `List<IRInst*> armInsts;` is declared and never used; remove (the fix hunk above replaces it).

### Notes
- Explanation-doc claims verified against code: 4 commits and +813/−4 over 10 files (`git diff --stat`), hook strictly before `eliminatePhis` after `cleanUpVoidType` (`source/slang/slang-emit.cpp:2844`), multiref mirror is char-for-char the emitter's counting loop with an identical capability set (`CodeGenContext::getTargetCaps()` forwards `getTargetReq()->getTargetCaps()`), resource first-param veto identical, vector/reshape/multi-swizzle veto identical, descriptor-heap bail matches the C-family `FoldPolicy::Never` table, flatness fixpoint and debug/`[precise]` gates present. Two doc inaccuracies: the side-effect test is described as `CHECK-NOT: ||` but is `CHECK-NOT: &&`; the SASS counts and suite numbers (5/5, 154/154, 12321/12324) are unverifiable here — the only build in this environment is a Nov 2 master build without the pass, and I did not build the branch.
- Verified sound, no action needed: `kIROp_CUDALDG` and debug instructions hit the conservative `default:` in `IRInst::mightHaveSideEffects`, so arms containing them keep their diamonds; post-pass phases cannot invalidate the fold guarantee (`isMovableInst` excludes ordinary loads, so `removeRedundancy` cannot add cross-block uses to a hoisted load; `simplifyForEmit::processLoad` only defers loads within the same block; `eliminatePhis` inserts no instructions into the reconstructed block since it branches without arguments); `mergeTrivialBlocks`'s use-count check correctly handles non-edge block references such as `ifElse` `afterBlock` operands; unused pure loads deleted with an arm are DCE-equivalent and only remove potential faults; the `canFoldIntoUseSite` `SLANG_ASSERT(paramIndex >= 0 …)` matches the emitter's identical assert-and-proceed behavior even for the exotic callee-operand edge.
- No LATE items (round 1).

### Attested
- 37aa2d0716ebdd4a73eb5ceaf2d8fcfae91519b7f11149f6838991d3ab9c6d20 source/slang/slang-ir-reconstruct-short-circuit.cpp (blob @1321a9a9fb)
- ed1c723283b6317a96e558c0009046a503853ed20da3b167dbc9bfadb2015f96 source/slang/slang-ir-reconstruct-short-circuit.h (blob @1321a9a9fb)
- 4fd805126c89e5e348fe3845cd18885747321dba4521ba77792b57f0f379d311 source/slang/slang-emit.cpp (blob @1321a9a9fb)
- a8d4f93910b397d14f97cf4a548b47ce44960fcd8cf8129b29bf1cca61f48c73 source/slang/slang-ir-cuda-immutable-load.cpp (blob @1321a9a9fb)
- ddf6c3dd5634f2d931ac350e80e440ecc6e948e77269fb65a939dd52a9a12e15 tests/cuda/short-circuit-or-chain.slang (blob @1321a9a9fb)
- 65f023c8c4c81cf7290237ce970c2c3eb155503e8b962aaa812ae9dae73d873a tests/cuda/short-circuit-and-guard.slang (blob @1321a9a9fb)
- aef63bcf2166a13f3093bd17639af4a8e7c596039f42a28b217750045cbf7304 tests/cuda/short-circuit-nested-chain.slang (blob @1321a9a9fb)
- 91da00c4e382089b485898b61683b5ed40857e33bab3327d0fc5651195f8bd1e tests/cuda/short-circuit-side-effect.slang (blob @1321a9a9fb)
- 33ac98d9586c12605493bf04e89589d02b63094d09f8d0e99efde884091ba1e7 tests/cuda/short-circuit-intrinsic-multiref.slang (blob @1321a9a9fb)
- e3abc76296f1c9d78a5e6e2e865668fa01505bfd27491634001a95b8cf3ee9f6 tests/bugs/metal-return-value-lost.slang (blob @1321a9a9fb)
- 25681d3d890974812899121aea6fdd8cacc82acd75a9a6ced489d2d0a8bc2ec9 source/slang/slang-emit-c-like.cpp (worktree @cdca151fb)
- dfed88a7159de9016c3929a6edaa1500347e9bfc794af6b5b4221e1563f35182 source/slang/slang-emit-cpp.cpp (worktree @cdca151fb)
- 0cfc0a4c9f1aba13b3f33577d5689e1f7ec3fa1ba03c04b17e71e1a46484b5a1 source/slang/slang-ir.cpp (worktree @cdca151fb)
- 7f5d19d4fbed140fc1832b7d99f01b9da0426ddab0786b4a3a3090bba09fef8c source/slang/slang-ir-util.cpp (worktree @cdca151fb)
- c97892d842f245df0af2ef70f1905a8e83cb99c82adec04cb5a315a1c6101cb2 source/slang/slang-ir-redundancy-removal.cpp (worktree @cdca151fb)
- 7814294355442a4acae5c4235b72b27a2ce235c1f270186ed1d768de62c21657 source/slang/slang-ir-simplify-for-emit.cpp (worktree @cdca151fb)
- 8d78f554ae1af8f4aaaf767d21f64f129cb5d3b986189c0a67a2e69626f40b1d /workspace/inbox/a2a-1794851587562-av5orr/2026-11-16-shader-slang-slang-pr14506-cuda-short-circuit.html
