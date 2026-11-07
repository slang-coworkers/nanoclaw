---
type: chain
description: "Bot-filed 11-05 22:47Z by slang-fixer (#14334 chain) at pdeayton-nv's request on PR #14335: [[vk::location]] on a patch-constant field is ignored by the hull and struct-relative in the domain. DECIDED 11-06 22:39Z (pdeayton-nv defers to tangent-vector): struct-relative stays; the hull must consume the front-end layout, which is #14335's scope. Resolved when #14335 lands; no PR from this chain. Open: keep the E39034 overlap diagnostic as a separate PR? issue_opened needs no dispatch."
resource: raw/triage-14366.md
tags: [spirv, tessellation, hull, domain, varying-location, follow-up]
---

# shader-slang/slang#14366 — explicit `[[vk::location]]` on patch-constant fields

Owned by the [#14334 chain](14334-hull-domain-patch-location-mismatch.md). Dated history (origin, the absolute-Location detour,
the split with #14335, the maintainer disagreement and decision): [[slang/14366-patch-field-explicit-vk-location-history.md]].
New dated entries go to the history file, not here. Triage memo: [raw/triage-14366.md](raw/triage-14366.md).

**The behaviour.** The hull ignores the annotation (`n` 0 / `color` 1); the domain treats it as struct-relative (`PatchData` first:
`n` 6 / `color` 5; `OutputPatch` first: `n` 0 / `color` 6). Code: `createPatchConstantFuncResultTypeLayout`
(slang-ir-glsl-legalize.cpp:1198) and `SimpleScopeLayoutBuilder::endLayout` (slang-parameter-binding.cpp:3225).

## Current state (11-06 22:55Z)

| item | state |
|---|---|
| #14366 | OPEN, P2 Bug, `reproduced`, assigned to pdeayton-nv (jkwak-work, 11-06 22:07Z). **Decision** [6697597760](https://github.com/shader-slang/slang/issues/14366#issuecomment-6697597760): keep struct-relative; "the hull should use the same front-end layout rules as the domain". Re-scope reply [6697746321](https://github.com/shader-slang/slang/issues/14366#issuecomment-6697746321). |
| resolution | Resolved when #14335 lands (#14335 is blocked on #14375). No closing keyword and no PR from this chain. |
| open question | To pdeayton-nv: keep **E39034** (overlap diagnostic) as a separate PR, or drop it? Under struct-relative it still catches a silent bug: on master `B b[2]` with fields at 5 and 6 gives 6/7, overlapping (VUID-08721), with no error. Keep → triager hands to the fixer (a new chain: report to the operator); drop → final [Resolution]. |
| local branches | Not pushed, not deleted. `fix/issue-14366` @6c2199458a keeps only E39034 (`reserveExplicitVaryingRange`, `overlapping-varying-locations`, tests/diagnostics/vk-location-overlap.slang) plus an unshipped E39023 mixing test. `wip/issue-14366-hull-consumption` @bd243df21 is the reference hull patch, sent to the #14334 triager. |
| sessions | triager `sess-1793986986720-2tz45p`, fixer `sess-1793989933374-lesjfp` (stood down 11-06 22:55Z). No re-check task: webhooks plus the supervisor register. |

**Caveat** (the triager's reading, not measured): hull and domain agree only when the patch struct starts at the same Location in
both stages, which is [#14376](14334-hull-domain-patch-location-mismatch.md) (hull `color` expected at 6, matching an
OutputPatch-first domain but not a PatchData-first one).

## Lessons

- **When two maintainers disagree, pause with no push and post one delta quoting both positions**, asking them to agree. Here
  pdeayton-nv's absolute spec (6692175660) contradicted tangent-vector (6695608888), and pdeayton-nv deferred within ~90 minutes.
- **Never ship a "Known gap" that regresses a shader valid on master** (the global-`in` case, 11-06 20:37Z).
- When work moves to another PR, park the pre-split code as a reference patch and relay it to the owning chain.
- The last full run (11-06) had 26 unexplained CUDA failures against the usual 3 fp8 ones; possibly GPU contention. Nothing
  shipped, so it was not raised as an infra alert.
