---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786476334407-jr9efu
written_at: 2026-08-11T19:59:55.503Z
---

# [approver/human-disagreement] slang-rhi#830 — ABSTAIN(OPEN_GAP) on missing Vulkan-RT nonzero-offset test vs author self-merge-as-is

## Case
shader-slang/slang-rhi#830 "Fix shader table base address alignment" @472804df2f7f. Fallback tier (no production Claude bot on slang-rhi; CodeRabbit + Devin). Author skallweitNV (MEMBER).

**My decision:** ABSTAIN_POLICY / OPEN_GAP. Sole finding = CodeRabbit's Minor "add a deterministic Vulkan dispatch regression test for nonzero `tableOffset` before merge." PR body CLAIMED a test was added; `changedFiles=4` are all `src/` — none landed. No 🔴; offset arithmetic internally consistent (all 4 SBT regions + buffer-write + upload use the same `tableOffset`).

**Human outcome:** MERGED at my exact head 19:38Z, as-is, no test added, no further commits. Merged ⇒ APPROVED-equivalent ⇒ DISAGREES with my ABSTAIN.

## Both rationales (record honestly — do not frame the abstain so it can never disagree)
- My hold: first-ever nonzero-offset caller of `uploadBufferInitData` (prior sole caller offset=0); nonzero offset is the COMMON production case; known silent-miscompile class (slang#11231); unverifiable here (no GPU); fallback tier. I initially tried to CLEAR it ("branch-free arithmetic, write==read verified") — codex DECISION_REVIEW overruled that as too aggressive, correctly.
- The refutation: a trusted maintainer shipped it as-is without the test, so "material enough not to merge as-is" was refuted for THIS PR.

## Transferable discriminant (the actual lesson)
When the SOLE blocker is a missing regression test, the OPEN_GAP-vs-clear-as-nit discriminant is NOT "is the arithmetic statically consistent" (you can always convince yourself of that — it's the trap codex caught). It is: **is the untested behavior a new code BRANCH, or is it device/driver behavior that green CI on a GPU-less runner cannot execute?**
- Vulkan RT SBT dispatch with nonzero base offset is the #802 EXEC-COVERAGE shape: `vkCmdUpdateBuffer` dstOffset alignment + actual GPU SBT dispatch are driver-dependent and NOT covered by a green build on a runner without a GPU. Static "same instructions +constant" does not substitute for execution ⇒ OPEN_GAP holds regardless of static consistency.

## Guard against n=1 over-correction (memory rule: a single outcome pointing one way is dangerous)
Do NOT swing toward WOULD_APPROVE on this shape next time on the strength of this merge:
1. It was an **author SELF-MERGE** (skallweitNV authored AND the PR merged with only the requested reviewer bmillsNV still pending) — weak, non-independent approval evidence; not an independent human REQUEST_CHANGES/APPROVE.
2. An author merging does not prove the nonzero path executes correctly on all devices — merge/green ≠ execution proof (#802).
3. Shadow-mode ABSTAIN costs zero friction (no post, no block), so "over-conservative" carries little real cost here. Handing a genuinely-unverifiable-by-me device path to a human is the process working, not a miss.
Net: keep OPEN_GAP for this shape; log the disagreement without rounding the next one up.
