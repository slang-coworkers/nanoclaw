---
title: "Remove the constraint, don't detect violations of it: isInlinableGlobalInst beat 4 emit-time guards (slang#12186)"
type: learning
topic: slang-compiler
source: learnings/1785783085348-remove-the-constraint-don-t-detect-violations-of-i.md
---

# Remove the constraint, don't detect violations of it: isInlinableGlobalInst beat 4 emit-time guards (slang#12186)

The strongest technique lesson I've had in a while, plus two review-discipline ones.

## The design lesson
Problem: under a kind-dependent representation, a `DescriptorHandle` global constant could be built at one integer width and read at the other. That wrong-width value survived to **module scope**, producing invalid SPIR-V two ways (a `%v2uint` operand to `OpIAdd %ulong`, spirv-val reject; and `OpCompositeExtract` on a scalar in the descriptor-heap path → spirv-opt assert `const_folding_rules.cpp:129`).

I wrote **four** successive emit-time guards to *detect* it (SLANG_UNIMPLEMENTED → representation-mismatch diagnostic → operand-type diagnostic → operand-type + wrap-chain walk). Each caught a different subset; #4 needed operand-graph walking, which slang's CLAUDE.md flags as downstream repair.

The maintainer's one-line suggestion instead **removed the constraint**: add the four representation casts (+ `kIROp_Select`) to `GlobalInstInliningContextGeneric::isInlinableGlobalInst` in `slang-ir-legalize-global-values.cpp`, beside the `kIROp_BitCast` already listed. The whole initializer chain then sinks into the consuming function, where the width is reconciled — and it turned out **no bitcast is even needed**: ordinary folding produces `OpConstant %ulong` feeding `OpIAdd %ulong`, and the heap index folds to `%uint_3`. Result: 17/17 exit-code-clean, all four of my guards deleted, and −100 lines of my own machinery in the emitter.

**Generalizable heuristic:** "module scope is the only place X is illegal" ⇒ ask whether the value can be *moved into a block* before writing anything that detects/rejects/repairs it at module scope. `isInlinableGlobalInst` is the lever for that in slang. And when your 2nd guard for one logical defect misses a case, stop guarding — either fix the producer or remove the constraint.

## Review-discipline lessons (both cost me public corrections)
1. **Cite the spec, not a summarizer.** I claimed a `uint2` operand to `OpConvertUToSamplerNV` was invalid (from a DeepWiki answer that *caveated itself*), and on that basis edited a legitimately-passing repo test. The actual SPV_NV_bindless_texture text: with `OpSamplerImageAddressingModeNV 64` the operand may be a 64-bit scalar **or** a 2×uint32 vector. Fetch `raw.githubusercontent.com/KhronosGroup/SPIRV-Registry/main/extensions/<VENDOR>/<EXT>.asciidoc`. Also: spirv-val silence proves nothing — there is no operand-type rule for these ops in `external/spirv-tools/source/val/`.
2. **A harness that greps stderr is not a pass.** My "16/16 green" script only matched error strings and ignored exit codes; codex flagged it and I re-ran with explicit `rc` checks (it held — 17/17 — but the claim had been unevidenced). Same round: I said "gh-9916 untouched" when it *was* modified branch-wide by an earlier commit — always distinguish "unchanged by this commit" from "unchanged vs origin/master" (`git log origin/master..HEAD -- <file>` settles it), and get line counts from `git show --numstat`, not memory.
3. **Negative-control every regression test.** My first version only asserted `OpIAdd %ulong` existed — vacuous. Rewrote to bind IDs (`%[[BITS]]` / `%[[INDEX]]`) and require them as *operands*, then compiled the same file with a pre-fix binary: both patterns → 0 matches pre-fix, 1 post-fix. That's the proof a test isn't inert.

## Escalation note that worked
Before all this I escalated an (a) producer-side-gating vs (b) narrow-diagnostic choice to the maintainer rather than self-directing a 5th guard — and he replied with a third, better mechanism neither option contained. Escalating a design fork with evidence beats picking one when you've already misjudged the design twice. Keep the layers distinct when you do: *representation survival* (what reaches module scope) ≠ *expressibility* (what a user can write) — the inlining fix makes the mismatch defined behavior; it does NOT stop a user writing it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785783085348-remove-the-constraint-don-t-detect-violations-of-i.md`_
