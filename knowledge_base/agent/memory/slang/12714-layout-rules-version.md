---
type: chain
title: slang#12714 — default layout docs (#12716) + `-layout-rules-version 202c` (draft #13300)
description: Docs scrub PR #12716 (open) and draft feature PR #13300 (202c rounds scalar-layout aggregate sizes like DXC #7996). Parked since 10-01 on jkwak-work's GLSL option pick, then @tangent-vector's concurrence. Next free enum 165 (11-09). Re-chase task series rechase-12714-layout-rul-*; 11-16 run (33f8) parks if still quiet.
tags: [layout, spirv, scalar-layout, dxc, maintainer-decision]
---

# slang#12714 — layout rules

**Sessions (verified 10-29 with `ncl groups list` + `ncl sessions get`).**
- slang-triager **owner** `sess-1787600718585-1053r5` on the canonical thread `gh-issue-shader-slang/slang-12714`. On 10-29 its cost was escalated: $95.44 spent against a $111.77 ceiling.
- slang-fixer `sess-1789421080649-zjzu07` and slang-reviewer `sess-1790635558704-nog1nl` are on the sub-thread `…/layout-rules-version`.
- ⚠️ On 10-29 the re-chase prompt listed zjzu07 as the triager. A `slang-triager` send pinned to it was **refused** (system notice id 218, one owner per item). The prompt is now corrected.
- Relay recipe: pin `1053r5` + `in_reply_to=<my webhook row>` + the canonical thread.

**#13300 state (GitHub, 11-02).**
- Draft at `a6272bb8d5`, CONFLICTING. No push since 09-30.
- On master, `include/slang.h` is taken up to `EnableExtendedHLSLBackwardsCompatibility = 163`, so the next free slot is **164**. The triager's "162" in its 10-30 report is stale.
- Gate:
  1. jkwak picks a GLSL+202c option (cmt 5940330895): (1) accept 202c on GLSL unrounded, or (2) add tail-padding members.
  2. @tangent-vector concurs on record before #13300 leaves draft or merges.
- The operator was asked 4 times, 10-05 to 10-26 (re-ping / rebase / both / wait), and never answered.
- **11-02: I withdrew that ask as over-gated.** It never offered the no-ping default, the same pattern as #13206, #13343 and #12674 ([feedback_github_writes_operator_authorized](../imported/feedback_github_writes_operator_authorized.md)). I sent the triager owner (its seq 156) to post one no-ping status nudge on #13300. The @-mention ping is opt-in only ("ping 12714").
- I deferred the master merge to the push that implements jkwak's pick (shared learning "Falcor-gate 30-day expiry on a bot draft"). Enum: still 163 on master `8229f27423` (11-02), so the next free value is 164.
- 11-02: the nudge was posted as cmt 6581930877 (16:07:50Z). I checked it: no @-mentions, AI disclosure present, enum 164; the claim "unrounded, as HLSL and CUDA already do" matches the PR body's "accepted, no effect" partition. Next one-shot re-chase: `rechase-12714-layout-rul-864c`, 11-09 16:00Z. It stays silent if nothing changed, and parks the chain with no timer from the 11-16 run onward.
- 11-02 triager budget: $101.85 before the nudge and $105.28 after, of $111.77 (escalated). If it trips, ask the operator to raise it; never open a second session.

**10-29 outside input.** albertrodriguezclo (cloth-sim port, CONTRIBUTOR), cmt 6509185481, no bot mention.
- Problem: SPIR-V default and scalar layout put a field in a nested 8-aligned struct's tail padding (offset 20, stride 24). CUDA/Metal use C layout (24, stride 32).
- Asks: (1) C layout for pointer data, (2) a warning, (3) a docs note on `-fvk-use-c-layout`.
- The triager reproduced it on master 977df1246. 202c was not run; the rule predicts 24/32.
- Reply posted: cmt 6511815556, which I verified (bot author, disclaimer, no #14032 reference). Asks (1) and (2) are framed as maintainer calls; (3) is suggested for #12716.
- Triager's view: this case doesn't justify re-pinging jkwak on its own merits. Cite it as user demand if the operator picks "both".

**11-02 weekly re-chase.**
- The sibling task session `36mllv` had the triager post a status comment on #13300 with no pings: cmt 6581930877, which I verified (bot author, 0 `@`, disclaimer, no #14032 reference). The comment restates GLSL options (1)/(2), says the next push uses a plain merge with the enum moved to 164, and cites the #12714 user case.
- The triager's [Report] came to my #12714 session, not to `36mllv`. That session re-armed **`rechase-12714-layout-rul-864c` (11-09 16:00Z)** but sent nothing to the dashboard, so I sent the rollup.
- `62da` was still `pending` after its run, so I cancelled it to stop a re-fire.

**11-09 re-chase (`864c`), verified on GitHub ~16:05Z: no gate movement, so nothing sent.**
- #13300 is unchanged: draft at `a6272bb8d5`, CONFLICTING/DIRTY, CI 6 success / 57 skipped, 0 reviews, 0 inline comments. No comments since the 11-02 nudge 6581930877, and none on #12714 since 10-30.
- The only timeline event: a #14311 cross-reference (tdavidovicNV, 11-04 17:32Z) on both items. That issue is a separate, already-triaged chain ([record](14311-d3d-nested-struct-structured-vs-raw-layout.md)) whose options A4 and B4 tie into 202c. It is not a gate here.
- ⚠️ **Enum moved:** master `ae4e57957a` (11-06) now has `HLSLMethodsMutatingByDefault = 164`, so the **next free value is 165**. The "164" in nudge 6581930877 is stale. I did not correct it (that would cost a triager turn, $105.28 of $111.77); the fixer's push takes the current next-free value.
- Dashboard, 11-02 16:00Z to 11-09 15:30Z (seq 512012): no "ping 12714" and no operator text on 12714 or 13300.
- Next: one-shot **`rechase-12714-layout-rul-33f8`, 11-16 16:00Z**. If nothing has changed by then, that run parks the chain (awaiting_human, no timer, one dashboard line).
