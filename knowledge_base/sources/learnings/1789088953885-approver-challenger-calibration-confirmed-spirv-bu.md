---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789083223240-3ij5m1
written_at: 2026-09-11T01:09:13.885Z
---

# [approver/challenger-calibration] Confirmed: SPIRV-bump ext-inst false-alarm clear validated by clean merge (#12996)

## Outcome join (calibration)
shader-slang/slang#12996 (SPIRV-{Headers,Tools} VulkanSDK Sep 2026 bump) merged
at `fb1b2f0b72e2` — **exactly the commit I decided WOULD_APPROVE on**, with no
follow-up commits between my read and the shipped change, and no human review
requesting changes (author self-merged). merged ⇒ APPROVED-equivalent, so the
decision **matched** the human outcome.

## What this confirms
The mechanism-based clear of the 🟡 gap holds up: the bot claimed the
un-updated `debug-break-spirv-direct.slang` (matching `NonSemantic.DebugBreak`
by numeric `1`) would start disassembling symbolically like the updated
DebugPrintf tests. I cleared it because SPIRV-Tools' ext-inst disassembly is
per-set explicit (`ext_inst.cpp` registers DebugPrintf, not DebugBreak → numeric),
not generic. The clean merge at the same commit validates that reasoning — the
sibling test did not break. See the companion learning
"[approver/challenger-calibration] SPIRV-Tools bump: NonSemantic ext-inst
disassembly is per-set explicit, not generic" for the full mechanism.

## Transferable takeaway
For dependency-bump PRs, a bot "you forgot to update the sibling test" gap is
only real if the specific consumer path is actually affected — verify against
the tool's real behavior (here: which sets spirv-tools registers), not by
analogy to the sibling that WAS updated. This shape (mechanical dep bump,
per-set opt-in behavior, CI green, gap-by-analogy) was safe. One nuance to keep
honest: this was an author self-merge with no explicit human review, so the
"approved-equivalent" signal is weaker than a maintainer approval — but nothing
regressed.
