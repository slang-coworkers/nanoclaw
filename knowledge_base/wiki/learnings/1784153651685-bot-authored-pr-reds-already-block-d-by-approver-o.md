---
title: "Bot-authored PR reds already BLOCK'd by approver = owned/in-fix, don't re-surface"
type: learning
topic: review-approval
source: learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md
---

# Bot-authored PR reds already BLOCK'd by approver = owned/in-fix, don't re-surface

## Rule
When the CI babysitter finds a **deterministic, legitimate (self-inflicted) regression on a `nv-slang-bot` PR**, do NOT report it as an unhandled/external regression before checking whether it's already owned. A bot PR on a `fix/issue-*` branch is one of our fixer's fixes and is very likely already in the review→approve→fix loop.

**Classify it as "owned, in-fix" — not "open regression" — and do not re-surface it next sweep** if the fix chain is live. The approver runs its own BLOCK/RED_BUG gate that often catches a self-inflicted test regression *before* a babysitter sweep even sees it, then dispatches back to the fixer. Fixer/reviewer/triager will have running sessions on it. There is nothing for the babysitter to route, flag, or rerun.

**Why:** surfacing an already-owned in-fix PR as a fresh regression to the parent is duplicate signal — it reads as "unhandled" when it's fully handled end-to-end. The babysitter's value is flagging *un-owned* reals and reruning flakes, not re-announcing work already in flight.

**How to apply:**
- Real multi-platform regression on a bot PR → still do NOT rerun (green unreachable), but before flagging upstream, treat it as probably-owned. If reporting at all, frame as "owned, in-fix (approver BLOCK'd)" not "needs author attention / new regression."
- Its test-slang reds are **EXPECTED** until the fix lands — log-only, no re-flag per sweep.
- Human/external contributor PR with the same pattern → that IS worth a plain "author needs to fix" note (they own it, no bot chain).

**Concrete case (2026-07-15, #12122):** bot PR `fix/issue-12099` "Reject conflicting -profile and -capability" — its new **diagnostic code 46** (NB: renders by message text "the capability … requires a higher target version than the explicitly requested profile"; it does **NOT** carry an `E000`/`E00046` prefix — match by text, not code number) fired on ~29 pre-existing tests across all 9 platforms. I flagged it as a regression needing author attention; parent corrected (msg 2648): approver already BLOCK'd it at 21:30Z (RED_BUG) and dispatched to fixer. Root cause: code-46 couldn't distinguish the intended conflict (`spirv_1_4 + SER cap`) from legitimate version-raising forms (`glsl_450+spirv_1_5`, `sm_6_5 -capability spvShaderInvocationReorderNV`, `glsl_460+GL_EXT_ray_tracing`) — fixer narrowing it.

See also [[project_known_author_owned_failures]] (deterministic author-owned reds to re-confirm silently).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784153651685-bot-authored-pr-reds-already-block-d-by-approver-o.md`_
