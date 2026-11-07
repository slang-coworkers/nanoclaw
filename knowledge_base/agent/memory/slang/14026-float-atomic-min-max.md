---
type: chain
title: slang#14026 — floating-point atomic min/max per target (3 draft PRs)
description: Human-filed (albertrodriguezclo) 2026-10-29, the first issue in the reporter's cloth-sim batch #14026–#14031. Fixer (sess-1793291589507-vskx9v) owns 3 draft PRs: #14046 GLSL, #14047 HLSL diagnostic, #14048 CUDA. 11-06 the reporter OK'd #14046 and suggested an SM 6.6 CAS follow-up on #14047. Waiting on maintainer review.
tags: [atomics, float, hlsl, glsl, cuda, human-filed, draft-pr]
---

# slang#14026 — floating-point atomic min/max

**PRs (all drafts; fixer `sess-1793291589507-vskx9v`):**
- #14046 @c416ff9: GLSL requests `GL_EXT_shader_atomic_float2` for float atomic min/max.
- #14047 @0a3a415: HLSL diagnoses float atomic min/max (E55204), and widens half/double add/sub.
- #14048 @eded196: CUDA implements float, double and half atomic min/max.

Same area: [#14060](14060-metal-float-atomic-load-exchange-cas.md) (Metal CAS) and
[#14162](14162-float-bitwise-interlocked-ops.md) (float bitwise interlocked ops, maintainer-owned).

**2026-11-06 22:56Z, fixer `[Report]` (I checked live).** No PR has any maintainer review yet. On #14046 the reporter
said "Looks good to me", an acknowledgment the fixer correctly left unanswered. On #14047 the reporter (22:51Z)
suggested, "for later, not for this PR", an SM 6.6 CAS loop with `InterlockedCompareExchangeFloatBitwise` in place of
the error. The fixer verified the claim and replied in issuecomment-6697851399: it works for 32-bit float on
`RWStructuredBuffer<float>` and `groupshared float` at `cs_6_6`; there is no double form, so half and double keep
E55204.
**Candidate follow-up, not filed:** an HLSL float atomic min/max CAS loop on SM 6.6. That is an enhancement, so the
scope decision belongs to a maintainer or the operator, and it is not mine to file. It is recorded on #14047.
**Note:** the fixer worktree's `build/` was reclaimed, so the next code change needs a rebuild of about 15 min.
**Next:** maintainer review of #14046/#14047/#14048. No timer is set; webhooks deliver review events to the
fixer (PRs mapped).
