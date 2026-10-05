---
type: chain
title: slang#13424 — Missing constant folding for loops (constant trip count not folded at -O3)
description: Triaged + reproduced P3 enhancement; SPIR-V-only gap. Option A (1-line BlockMerge before spirv-opt LoopUnroll) awaiting operator go/no-go, defaulted HOLD on timeout
tags: [slang, spirv, optimization, loop-unroll, spirv-opt, held]
resource: /workspace/inbox/a2a-1791074879332-d9xk98/triage-13424.md
---

# slang#13424 — loops with a constant trip count are not folded (held on operator go/no-go)

Reporter juliusikkala (MEMBER), unassigned. Opened 2026-10-04 ~00:04Z. Labels: reproduced, SPIR-V,
Dev Opened; Type=Performance. Use case: a spherical-harmonics library calls pure functions with
constant args (`shNormalizationConstant(L,M)`), and the user wants them to fold.

**Mechanism (the triager's finding at master 6ba151dcf):**
- Slang IR unrolls only `[ForceUnroll]` loops (loop-unroll.cpp:60-67). SCCP sends loop phis to Any.
- `[ForceUnroll]` with a parameter bound gives E40020 even with `[ForceInline]`, because unroll runs
  in specializeModule before performForceInlining.
- `[unroll]` is only a LoopControl hint. spirv-opt LoopUnroll declines it because a trampoline block
  sits between the condition and the merge.
- spirv-opt has no SAbs fold rule.
- The triager says DXIL and PTX already fold all three shapes, so the gap is SPIR-V only.

**Verified by Orchestrator:** the triage comment and its labels on GitHub. The -O2/-O3 preset has
`CreateLoopUnrollPass(true)` right after CCP/ADCE with no BlockMerge in between (slang-glslang.cpp
~493). The O1 preset has LoopUnroll commented out.

**Options:**
- A: add `CreateBlockMergePass()` before LoopUnroll in the -O2/-O3 preset, as "Related to", not
  Fixes. The reverted prototype folds `[unroll]` loops; tests pass 169/169 (-O2/-O3) and 1457/1457
  (subsets). Cost: `[unroll]` code size changes at -O2/-O3.
- A': emit loops without the trampoline block (producer side, larger change).
- B: ForceUnroll after inlining. Needs a maintainer decision.
- C: automatic IR unroll at -O (the issue's preferred ask). Needs a maintainer decision.
- D: IR folding of integer abs/min/max. Separable; needs a folding-hook design.
- Workaround already posted on the issue: generic `let` params + ForceUnroll + ternary abs.

**State 2026-10-04T01:00Z:** triage comment
[5975118294](https://github.com/shader-slang/slang/issues/13424#issuecomment-5975118294)
(nv-slang-bot, 3974 chars). The operator go/no-go on A (`ask_user_question`, 600s) **timed out, so
the chain defaulted to HOLD**. slang-triager holds the fixer briefing, marked HELD/context-only.

**2026-10-04T20:33Z — reporter comment
[5984117113](https://github.com/shader-slang/slang/issues/13424#issuecomment-5984117113)** (juliusikkala,
MEMBER). Their workaround is `[unroll]` plus `-Xspirv-opt... --loop-unroll --merge-blocks --ccp
--eliminate-dead-code-aggressive -Xspirv-opt.`. That independently corroborates the A mechanism
(BlockMerge is what lets LoopUnroll fire). They call it "very fiddly" and still prefer that Slang do
this natively (option C). It is **not** a request for a bot PR, and the HOLD stands. I routed it to
slang-triager on the canonical thread for the reply, and noted the new evidence to the operator.

**2026-10-04T20:45Z — triager reply
[5984211477](https://github.com/shader-slang/slang/issues/13424#issuecomment-5984211477)** (nv-slang-bot,
1338 chars; Orchestrator checked it live; the issue now has 3 comments). I verified in source that
`-Xspirv-opt` passes are additive and run after the whole preset, including its final BlockMerge
(slang-glslang.cpp ~516, ~528-540). So the reporter's workaround does corroborate A. The reply
corrects the closing `-Xspirv-opt.` → `-X.` and notes that `abs` still blocks the SH fold. C is left
to maintainers, with no PR promised. Still HOLD.

**Resume on:** an operator GO/no-go reply, maintainer design input on B/C/D, an assignee, or closure.
A GO goes through slang-triager on `gh-issue-shader-slang/slang-13424` and releases option A only.
Re-chase task `rechase-13424-golive-cff4` (2026-10-05T09:00Z).
