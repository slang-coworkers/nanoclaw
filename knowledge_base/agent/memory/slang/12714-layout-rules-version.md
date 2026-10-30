---
type: chain
title: slang#12714 — default layout docs (#12716) + `-layout-rules-version 202c` (draft #13300)
description: Docs scrub PR #12716 (open) and draft feature PR #13300 (202c rounds scalar-layout aggregate sizes like DXC #7996). Parked since 10-01 on jkwak-work's GLSL option pick, then @tangent-vector's concurrence. Re-chase task series rechase-12714-layout-rul-*.
tags: [layout, spirv, scalar-layout, dxc, maintainer-decision]
---

# slang#12714 — layout rules

**Sessions (verified 10-29 with `ncl groups list` + `ncl sessions get`).**
- slang-triager **owner** `sess-1787600718585-1053r5` on the canonical thread `gh-issue-shader-slang/slang-12714`. On 10-29 its cost was escalated: $95.44 spent against a $111.77 ceiling.
- slang-fixer `sess-1789421080649-zjzu07` and slang-reviewer `sess-1790635558704-nog1nl` are on the sub-thread `…/layout-rules-version`.
- ⚠️ On 10-29 the re-chase prompt listed zjzu07 as the triager. A `slang-triager` send pinned to it was **refused** (system notice id 218, one owner per item). The prompt is now corrected.
- Relay recipe: pin `1053r5` + `in_reply_to=<my webhook row>` + the canonical thread.

**#13300 state (GitHub, 10-30).**
- Draft at `a6272bb8d5`, CONFLICTING. No push since 09-30.
- On master, `include/slang.h` is taken up to `EnableExtendedHLSLBackwardsCompatibility = 163`, so the next free slot is **164**. The triager's "162" in its 10-30 report is stale.
- Gate:
  1. jkwak picks a GLSL+202c option (cmt 5940330895): (1) accept 202c on GLSL unrounded, or (2) add tail-padding members.
  2. @tangent-vector concurs on record before #13300 leaves draft or merges.
- The operator has been asked weekly since 10-05 (re-ping / rebase / both / wait). No answer yet.

**10-29 outside input.** albertrodriguezclo (cloth-sim port, CONTRIBUTOR), cmt 6509185481, no bot mention.
- Problem: SPIR-V default and scalar layout put a field in a nested 8-aligned struct's tail padding (offset 20, stride 24). CUDA/Metal use C layout (24, stride 32).
- Asks: (1) C layout for pointer data, (2) a warning, (3) a docs note on `-fvk-use-c-layout`.
- The triager reproduced it on master 977df1246. 202c was not run; the rule predicts 24/32.
- Reply posted: cmt 6511815556, which I verified (bot author, disclaimer, no #14032 reference). Asks (1) and (2) are framed as maintainer calls; (3) is suggested for #12716.
- Triager's view: this case doesn't justify re-pinging jkwak on its own merits. Cite it as user demand if the operator picks "both".
