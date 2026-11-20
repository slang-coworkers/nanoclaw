---
type: chain
title: slang#13931 — clip/cull distance array params across targets (PR #13939, REQUEST_CHANGES redesign)
description: slang-fixer chain. PR #13939 got tangent-vector REQUEST_CHANGES 11-13 — redesign to target-independent post-legalization pass (ordinary varying legalization emits distinct float arrays, follow-up pass concatenates + rewrites use sites) across ALL targets. Redesign in progress locally; push/reply blocked by the GitHub-auth outage.
tags: [glsl, spirv, hlsl, clip-distance, cull-distance, varying-legalization, review-rounds]
---

# slang#13931 — SV_ClipDistance/SV_CullDistance varying params (PR #13939)

**Fixer chain owned by slang-fixer** on `gh-issue-shader-slang/slang-13931`.
PR #13939, worktree `wt-slang-13931`.

**2026-11-13 — maintainer REQUEST_CHANGES** (tangent-vector,
[pullrequestreview-5897967130](https://github.com/shader-slang/slang/pull/13939#pullrequestreview-5897967130)):
substantive design change, not nits. His option 2: ordinary varying legalization emits each
SV_ClipDistance/SV_CullDistance varying parameter as a distinct float array, then a discrete
follow-up pass concatenates them and rewrites use sites — applied across ALL targets, not just
GLSL/SPIR-V. The GLSL pre-pass must move **out of slang-ir-glsl-legalize.cpp** into a
target-independent post-legalization pass. Plus 10 inline comments: terminology ("never use
'arrayed'"), diagnostic tone (suggestions not commands), honest narrative comments, doc rewrites.

Fixer's verbatim requirements log: `/workspace/agent/reports/slang-13931.md` (in the fixer's
group workspace, not Main's).

**2026-11-16 07:13Z — fixer [Report]:** redesign in progress locally (~2-3 sessions of work);
plan is fresh-context design pass → implement in wt-slang-13931 → build+verify → push + reply on
review threads, with PLAN_REVIEW/CODE_REVIEW/OUTPUT_REVIEW critique rounds before any push.
Worktree clean at `a650d9bb4`.

**2026-11-16 07:33Z — fixer progress note:** subagent + first codex design attempt
rate-limited/cut off → design done in-session (deviation noted, mitigated by codex PLAN_REVIEW
before implementation). Architecture mapped: per-target varying legalization at
slang-emit.cpp:2478 (GLSL) / :2496 (Metal) / :2506 (CPU) / :2516 (CUDA) / :2526 (WGSL); current
GLSL clip/cull machinery slang-ir-glsl-legalize.cpp:344-737, :828-864; WGSL clip_distances
(#14097) at slang-ir-legalize-varying-params.cpp:5206; Metal at :4420. Design doc:
scratch-13931/redesign-r3.md — new shared pass, two phases (lower each clip/cull varying leaf to
distinct float[N]; merge non-per-element leaves of one signature into one dense float[total],
DXC-comparable packing, supports a[1]:0+b[1]:1). No new blockers.

**2026-11-16 08:07Z — redesign R3, first two commits (local-only, not pushed):** codex PLAN_REVIEW
approved round 1 (advisories folded in). `1dc104dcb` adds tests/bugs/sv-clip-distance-merge.slang
(split arrays a[1]:0+b[1]:1, dense gap packing, lone-scalar float[1], over-8 diagnostic; 6/7 fail
on old head). `d581587b7` adds shared pass slang-ir-legalize-clip-cull-distances.{cpp,h}, registered
ONCE for ALL targets in slang-emit.cpp before the per-target varying-legalization switch (walk-only
inventory, no rewrites yet). Incremental build green; focused clip/cull + mesh/GS/WGSL 42/42.
Notable: no HLSL/DXIL case exists in the per-target switch, so per-target lowering could never
give all-target uniformity — fixer deviates accordingly and will call it out in the PR description.
Next: pass-1 rewrites (scalar→float[1], vector→float[N] w/ gather-scatter, struct retyping + layout
rebuilds), pass-2 merge + over-8 diagnostic, GLSL machinery deletion, E55224 reword, docs — then
CODE_REVIEW/OUTPUT_REVIEW, full suites + L40S GPU verify, push+replies when creds restore.
Design: scratch-13931/redesign-r3.md; journal: reports/slang-13931.md + memory/fix-13931.md.

**2026-11-16 09:21Z — auth restored; push still parked by design.** Fixer's credential probe
green (gh api 200, ls-remote OK; Main independently verified 200). It PATCHed the PR's TODO
comment with redesign progress (no maintainer activity newer than the 11-13 review — requirements
list current). Push deliberately held until implementation is verified (unfinished rewrite on a
watched review); per-thread replies land with the push. Critique-ledger gotcha noted: it resets
per inbound task, so fresh CODE_REVIEW/OUTPUT_REVIEW rounds will run near delivery.

**2026-11-16 09:23Z — rewrite mechanics recorded** (redesign-r3.md REWRITE MECHANICS section:
use-shape inventory, per-pass rewrite table — scatter on IRStore, gather at r-value uses,
dynamic index → base+i, whole-array passthrough via temp copy; struct rebuild via
IRStructTypeLayout::Builder per the :3428-3470 precedent; 55225 reused for over-8). Key decision:
pass-1+pass-2 rewrites land as ONE behavior commit — partial rewrites are not behavior-neutral on
mixed signatures (standalone scalar → float[1] would trip old E55225 on working shaders).
Next: behavior commit → GLSL deletion/E55224 reword/docs commits → fresh CODE_REVIEW/OUTPUT_REVIEW
→ full suites + L40S GPU → push + per-thread replies. Branch fix/issue-13931 @ d581587b7.

**Blocker:** none. (The 11-16 GitHub-auth outage that previously blocked push/reply resolved
~09:2xZ — Main verified and closed the loop with the operator dashboard, msg id 113.)

**Resume on:** credential restore (fixer pushes + replies on review threads); maintainer
follow-up on #13939; fixer's next report.

**Credential restored + resume sent 11-16 09:19Z** (verified 200 @6000 tier 09:18Z): unpark
notice delivered on this thread to the fixer's session `sess-1792917125438-utji1s` (verified,
seq 92 in) — push + review-thread replies unblocked, probe-once-before-push, park after one
attempt if 401 returns. Closes the 07:07Z outage addendum entry for #13939. Fixer also received
fresh tangent-vector pr_mention webhooks 08:47-08:48Z (cmts 4568574042/4568585853) via the host.
