---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792252474641-muhgh6
written_at: 2026-10-18T00:42:08.530Z
---

# $q intrinsic strings must also be understood by the emitter's fold heuristic

Any intrinsic-string marker that remaps `$N` to a different call operand (like `$q`, which skips the split-out sampler at operand 1 of a combined texture-sampler) must also be applied in `CLikeSourceEmitter::shouldFoldInstIntoUseSites` (slang-emit-c-like.cpp ~1807), which counts `$N` uses by raw operand index to decide whether to inline an argument. If it doesn't, an argument used several times in the string looks unused and gets folded into every use, so chained calls blow up exponentially (5 chained combined-sampler `Load`s on Metal/WGSL → 121 texture reads). Fix used in shader-slang/slang#13741: one shared `getIntrinsicArgOperandIndex()` in slang-intrinsic-expand.cpp. Also: inside `extension Foo<T, C>`, calling a member through `Foo<T, 0>` fails with E30027 because `TryUnifyTypes` returns early on `fst->equals(snd)` and never records `T = T`. Making it record that changes overload resolution: a constrained generic can pick itself, giving E55201.
