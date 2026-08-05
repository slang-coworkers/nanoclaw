---
name: project_11669_getdimensions_wgsl_parked
description: "slang#11669: Sampler2D.GetDimensions miscompiles to WGSL/Metal — combined-sampler legalization shifts operands while intrinsic strings index out-params positionally. State per file: FIXED, PR #11816 OPEN non-draft, awaiting maintainer (jhelferty-nv CHANGES_REQUESTED addressed, no re-approval) — not merge-authorized. Fix = new $q skip-sampler marker, Metal+WGSL only. Resume only on #11816 webhook."
metadata: 
  node_type: memory
  type: project
  originSessionId: 37689b92-f110-49c6-9471-ee3d45755a64
---

shader-slang/slang#11669 — `Sampler2D.GetDimensions` miscompiles to WGSL (and Metal): combined `Sampler2D` legalizes to operands `[texture, sampler, out0, out1]`, but the C++-generated GetDimensions intrinsic strings index out-params positionally as `$1`/`$2` without the `$p` combined-sampler offset marker → sampler operand gets the width, 2nd output never written.

**State (2026-07-03): FIXED, PR #11816 under review, awaiting maintainer — do NOT auto-dispatch fixer, do NOT auto-close.**
- PR #11816 OPEN, **non-draft** (maintainer-legitimate: Harsh Aggarwal merged master `83a1760`, jkwak/jhelferty reviewing — NOT a bot self-flip, so no drafts-only breach). Head `d06d130115` (fast-forward on the merge; fixer aborted a destructive force-push that would've wiped `83a1760`).
- Fix = new `$q` skip-sampler marker in `_emitSpecial` (detects `IRSamplerStateTypeBase` at operand 1); Metal+WGSL `GetDimensions` builders prefixed. Fix is **Metal+WGSL only** — CUDA is NOT in the combined-sampler lowering set (marker was dead there, removed). Test `tests/bugs/gh-11669.slang`. Body says "Addresses" not "Closes" (maintainer closes manually; #10522 family not fully fixed).
- Review: jhelferty-nv **CHANGES_REQUESTED** (07-02) — all 4 items addressed + replied, marker renamed `$X→$q`, but **no re-approval yet**. Not merge-authorized.
- **Open PR question for maintainer:** extend PR to the pre-existing combined-sampler `Load` miscompile (same root cause, coordinate shift) or track separately. Offered on PR, no blocker.
- **Related:** #10522 (HLSL/Sampler2DShadow, Dev Reviewed) is the same root cause but a **different emit path — remains OPEN, not fixed here**. Also #8516, #8025.
- **Resume only on:** PR #11816 webhook (maintainer re-review/merge/comment) or a substantive human inbound. Next gate arrives via webhook. Fixer done; triager closed its side; issue 5-bullet refreshed in comment 4760097659.
