---
type: chain
title: slang#14027 — standard module of portable parallel primitives (block/device scan, reduce, sort, compaction)
description: Human-filed (albertrodriguezclo) feature/design proposal 2026-10-29 16:18Z, part of the reporter's cloth-sim batch #14026–#14031. Triaged feature/low/P3 by slang-triager; bot comment posted 16:52Z (unlike sibling #14029, held under R6). Parked on maintainer direction; re-check t-a4ca33 2026-11-05 15:30Z.
tags: [standard-modules, memory-model, feature-request, parked, r6]
---

# slang#14027 — parallel-primitives standard module

**Ask.** A standard module (like `neural`/`numerics`) with `BlockReduce`/`BlockScan`/`BlockRadixRank` and
`DeviceReduce`/`DeviceScan`/`DeviceSegmentedReduce`/`DeviceRadixSort`/`DeviceSelect`/`DeviceRunLengthEncode`.
Constraints: deterministic reductions, a multi-pass fallback that does not depend on forward progress,
5 backends, and a slang-rhi/SlangPy host helper. Prior art: Discussion #4366.

**Triage (slang-triager, 10-29 16:53Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
The gap is real. The block level needs no compiler feature; it compiles (compile-only) on SPIR-V/CUDA/Metal/HLSL/WGSL.
Single-pass decoupled look-back is not portable today:
- `Atomic<T>` MemoryOrder is dropped on HLSL/CUDA/GLSL, and WGSL atomics are relaxed.
- `globallycoherent` is dropped on Metal/CUDA.
- `loadCoherent`/`storeCoherent` exist on SPIR-V only (#3870).
- Metal has the #14010 problem.

The triager recommends (C): ship the block level plus a multi-pass device level first, then add single-pass per target as the gaps close.
Maintainer questions: placement (in-tree vs separate repo), staging, separate memory-model issues, and where the host helper lives.

**GitHub state (verified 10-29).** Type=Feature (set by the bot); no labels; 1 comment, nv-slang-bot 6502945982 at 16:52Z.
⚠️ **The R6 handling differs from the sibling issue.** #14029 (also Feature, same batch) was held at 0 comments under R6's 4-day wait. #14027 was posted at once.
I flagged this to the operator. At 16:56Z the triager confirmed it was an inconsistency: R6 is not in triage step 9
("Always post"), and recall did not surface it. **#14020 has the same miss**, which I verified: opened 14:32:34Z, bot comment
6499706139 at 14:39:55Z, a fence but no crash word. My own dispatch did not state an R6 hold either. Waiting on the operator:
(1) leave, hide or delete the comments on #14020 and #14027; (2) the durable fix of adding R6 to triage step 9 (nanoclaw spine).
A shared learning was filed on 10-29.

**10-29 17:18Z: maintainer engaged.** jkwak-work (MEMBER) assigned himself and commented (6503521729):
"This is an exciting proposal. I will follow up the progress." There is no @nv-slang-bot mention and no answer to the
4 questions. I relayed it to the triager with a hold: no bot post.

**10-29 17:41Z: tangent-vector (MEMBER) gave design input (6504022674); no bot mention, no ask of the bot.**
- Placement: they prefer an out-of-repo package, since jhelferty-nv is building a Slang package manager. They also accept a standalone
  shader-slang org project or an in-repo standard module, and will not gate progress on the package route.
- Performance portability is the key open problem: `__target_switch` per target, plus per-architecture/device specialization.

That partly answers the placement question. Staging, the memory-model issues and the host helper are still open. I relayed it
verbatim to the triager, with the no-post hold still on.

**Next.** The triager's one-shot `t-a4ca33` (task session `sess-1793292797030-s34j0v`) runs 2026-11-05 15:30Z.
If there is maintainer direction, the triager hands off. If the issue is silent, it stays parked with a one-line note.
Owner: slang-triager, thread `gh-issue-shader-slang/slang-14027`. Memo: `/workspace/inbox/a2a-1793292830884-nykabg/triage-14027.md`.
