---
name: project_12120_direct_resource_params_flag
title: slang#12120 — opt-in flag for direct resource-typed SPIR-V params (⏸️ LIVE, parked)
description: "shader-slang/slang#12120 — descriptor-load reuse doesn't cross a [noinline] boundary when images are passed as a bindless index. Fix = opt-in CLI flag reverting the #12027 image-as-index workaround so read-only textures pass as direct SPIR-V resource params (PR #12195). ⏸️ LIVE / PARKED: maintainer jkwak flipped #12195 back to DRAFT 2026-07-30 to run AMD/Intel driver validation himself; the pending default-on + disable-flag-spelling work is subsumed until he pings. RESUME TRIGGER = jkwak's next comment post-driver-testing."
metadata:
  node_type: memory
  type: project
  originSessionId: a4546982-e3c1-438d-9b81-9756edcca56a
---

# slang#12120 — opt-in direct resource-typed SPIR-V params — ⏸️ LIVE / PARKED

**Live handoff.** Split out 2026-09-01 from the #12051 chain log (they share an origin
session but distinct lifecycles: #12051 shipped, this is still open). Filed as the follow-up
to [[project_12051_descriptor_reuse_pinning]]: the descriptor-load coalescing #12111 shipped
helps the no-function-boundary loop case but **not** the cross-`[noinline]`-boundary image
case, because #12027 passes the image as a per-call bindless *index* (loaded callee-side), so
the texture descriptor is still loaded once per invocation — exactly what the reuse was meant
to stop. That tension is inherent to the boundary + workaround interaction; closing it needs
either inlining or lifting the #12027 image-as-index workaround (driver-dependent).

## Current state (⏸️ PARKED, webhook-driven)

- **PR #12195** (`fix/issue-12120`, head `8bead6c9cf`) adds an opt-in CLI flag that reverts the
  image-as-index workaround for **plain, non-array, read-only** textures (`SLANG_RESOURCE_ACCESS_READ`)
  → they pass as direct SPIR-V resource params (HLSL-style), letting #12111's coalescing reach
  across the boundary. Array-of-texture is kept specialized (avoids `E56004: opaque type in
  local variable`); RW/feedback/unknown-access textures stay specialized.
- **Maintainer jkwak flipped #12195 → DRAFT 2026-07-30** (issuecomment-5128163361): *"changing
  to a draft state until I can test it on AMD driver or intel."* He is doing the cross-vendor
  driver validation **himself** — that is the entire premise of the opt-in (it was NVIDIA-596.75-only
  validated; Intel/AMD robustness is the whole reason for the gate).
- ⛔ **RESUME TRIGGER = jkwak's next comment post-testing.** Nothing for the bot to implement
  until then. This subsumes the pending *default-on + disable-flag-spelling* work below.
- **Do NOT re-label / do NOT ping.** #12195 carries `pr: breaking change` (jkwak applied it
  himself, anticipating the future default-on change); the current pushed HEAD is still
  opt-in/default-OFF = genuinely non-breaking. The label reflects intended future state, not
  current draft. Re-labeling would contradict the maintainer; it reconciles when default-on
  lands or he abandons it. Nagging a correctly-parked chain mid-driver-validation is noise.

## The still-pending design questions (gated behind driver testing)

1. **Default-ON breaking change** (jkwak directed 2026-07-23): make the flag default-on, mark
   the PR breaking, document the break + workaround. This deliberately overrides the
   "default-OFF/opt-in safety = non-negotiable" that governed the chain from the start — it is
   the maintainer's call (csyonghe lead + jkwak assignee driving it), **not** a guardrail breach.
2. **Disable-flag spelling** — a default-on option needs an OFF switch, but Slang bool flags are
   set-true-only. Fixer asked jkwak to pick the disable spelling
   (`-fvk-no-use-direct-resource-params` / a `=0/1` value form / his choice) rather than mint a
   permanent user-facing CLI surface unilaterally. Correct — don't unilaterally invent a
   permanent CLI flag.
3. **`!isArray` is justified, keep it.** Dropping it makes an array-of-texture `[noinline]` param
   newly fail to compile on direct-SPIR-V (`E56004`), flag-induced and verified — this answers
   csyonghe's earlier "why `!isArray`?" with a named failing case (meets the repo's "name a
   failing test" bar). The redundant `getAccess()==READ` half was dropped (RW textures stay
   specialized via `isIllegalGLSLParameterType`).

## Durable point

⭐ **A maintainer relaxing a safety default is not the bot relaxing it.** The opt-in/default-OFF
safety was non-negotiable *for the bot*; when jkwak+csyonghe chose to make it default-on and
breaking, that is sanctioned — but still watch that the default exposure is gated on **real
multi-driver** GPU validation (Intel/AMD, not just NVIDIA 596.75), which is precisely why jkwak
took the PR back to draft to test it himself.

## Related concepts

- [[project_12051_descriptor_reuse_pinning]] — parent chain (the reuse that shipped).
- [[project_bot_pr_priority_yield_red_run]] — the benign draft priority-yield red seen on this PR.
