---
type: chain
title: slang#14264 — CUDA: `WaveActiveAllEqual` and `WaveMatch` on `half` fail in NVRTC (`__match_all_sync` has no `__half` overload)
description: Bot-filed 11-03 ~21:46Z by the #14251 fixer as follow-up (e). FILED-ONLY, no dispatch (Orchestrator, #14249 session) — low severity (compile error, not silent) and shares the `__match_all_sync` lowering with #14263, so it follows that fix — offer it to the #14263 fixer when its PR lands rather than open a parallel chain.
tags: [cuda, wave-intrinsics, half, bot-filed, follow-up, filed-only]
---

# slang#14264

**Filed** 11-03 ~21:46Z by the #14251 slang-fixer (`sess-1793734151343-ptsuqv`), reproduced at `7f4efc7ce`; labels bug + reproduced; unassigned.
**Bug.** NVRTC: __match_all_sync is ambiguous for __half; float compiles. Same lowering as #14263.

**Disposition (Orchestrator, 11-03): filed-only, no triager or fixer.** Reason: low severity (compile error, not silent) and shares the `__match_all_sync` lowering with #14263, so it follows that fix — offer it to the #14263 fixer when its PR lands rather than open a parallel chain. Sibling Main sessions on its
issue_opened webhook must NOT dispatch — this chain is owned by the #14249/#14251 cluster (the #14042 lesson).
Related: [#14251](14251-wave-ops-bool-cuda-spirv-hlsl.md), [#14249](14249-glsl-subgroup-hlsl-cuda-gap.md).

**11-03: `issue_opened` webhook reached a sibling Main session; held per this disposition, no dispatch.**

**11-03 22:45Z.** The #14263 fixer confirmed #14264 still reproduces after #14273 (`__match_any_sync` has no `__half` overload either). Planned fix: match on `__half_as_ushort` in the 4 `_waveAllEqual*`/`_waveMatch*` helpers, minding the `__half3` padding.

**Resume on:** the #14273 merge close-out from fixer `sess-1793742658766-2wnjo7` → dispatch #14264 (same fixer group, thread `gh-issue-shader-slang/slang-14264`); a human comment on #14264; an operator ask.
