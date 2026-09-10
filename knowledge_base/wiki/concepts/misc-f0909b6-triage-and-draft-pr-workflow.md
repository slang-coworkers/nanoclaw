---
title: Triage Discipline, Regression Classification, and the Draft-PR Workflow
type: concept
group: misc
tags: [triage, regression, runtime-bisect, draft-pr, structural-ray-tracing, fork-pr, workaround, docs-site]
source_count: 12
---

## TL;DR

How to triage a Slang issue correctly: don't classify from a hypothesis, verify a workaround before
posting it, and — the dominant theme here — recognize when a reported bug lives on a core-team
member's own active draft PR and is already fixed on-branch.

- **A "regression" is a claim about TWO versions — run the actual old binary.** A code+git-history
  bisect is a hypothesis generator, not confirmation. Prebuilt release tarballs make a zero-build
  runtime bisect cheap (minutes); a function byte-identical across the claimed window falsifies the
  bisect on its own. Reproducing on ToT proves the bug is real, not that it's a regression.
- **A workaround you post publicly must compile AND preserve semantics** — "it compiles" can mask a
  variant that silently dropped/hard-coded parameters. Test the EXACT restructure, not an easier
  lookalike; retract a wrong workaround in a fresh @mention (GitHub edits don't notify).
- **A `Dev Opened` tracking issue on a core-team member's own draft PR is almost always already fixed
  on that PR's branch** (Operator correction 2026-09-09: this is the narrow "a human PR already carries the fix" case, not a general `Dev Opened` skip; every other `Dev Opened` issue is triaged and dispatched normally, see [Correction (operator 2026-09-09): Dev Opened and core-team tracking issues ARE in scope](../learnings/1788958700000-correction-dev-opened-and-core-team-tracking-issues-are-in-scope.md)) — often within minutes of filing. Verify-and-bounce; never open a competing
  master PR. The feature doesn't exist on master, so `reproduced`/`regression` labels don't apply.
- **Fetch a fork-based WIP PR checkpoint via `refs/pull/N/head`**, not the branch name; check the
  branch head hasn't been rewritten (`merge-base --is-ancestor`) and grep for an existing `Fix #N`
  before building — a stale base manufactures phantom cascading bugs.
- **A stale `docs.shader-slang.org/.../external/slang/…` page is a submodule-pin lag, not a source
  bug** — the fix is bumping the submodule pin in the superproject, a cross-repo action.
- **RT crashes on the draft #12691 API keep tracing to front-end structural-RT checker exemptions
  that are too broad** (a marker interface not `[sealed]`; a stage-input exemption ignoring param
  direction) — fix the producer/checker with a front-end diagnostic, not an emit-side guard.
- **A closed fix PR you cited by number is a stale public fact you must correct** even on a chain you
  "closed."

## Classify from evidence, not a plausible story

Applying the `regression` label is a public assertion that shapes maintainer priority and reporter
expectations, so it needs a runtime bisect showing pass→fail, not a compelling git-history story.
On slang#12725 research agents built an internally-consistent bisect pinning #11368 (a fixpoint-solver
rewrite) as the regressor — right file, right window, right mechanism — and the label + "fix incoming"
was posted; a zero-build runtime bisect over 8 prebuilt release tarballs then showed the repro failed
identically back to v2025.6.3, with only the diagnostic wording changing (E30075→E30441). It was
never a regression, just an unimplemented enhancement. Prebuilt release binaries are a free runtime
bisect (each ~200-270MB, testing 8 releases took minutes), and a suspect function byte-identical
across the claimed regression window falsifies the bisect on its own ([prebuilt release binaries are
a free runtime bisect — falsify a regression before reworking a perf
commit](../learnings/1787635116151-prebuilt-release-binaries-are-a-free-runtime-bisec.md),
[don't apply the regression label from a code-history hypothesis — runtime-bisect
first](../learnings/1787635407452-don-t-apply-the-regression-label-from-a-code-histo.md)). The
same issue burned a second correction: a workaround posted to the reporter compiled but silently
dropped two generic parameters (a redesign, not a reorder), and the "genuine reorder" was in fact
impossible (`E30117 forward reference in generic constraint`) — compile a workaround AND diff its
semantics against what the user needs, test the EXACT restructure, and retract a wrong notifying
comment with a fresh @mention ([verify a suggested workaround compiles AND preserves semantics before
posting it](../learnings/1787636240819-verify-a-suggested-workaround-compiles-and-preserv.md)).

Two more triage-routing facts. A stale `docs.shader-slang.org/.../external/slang/…` page whose GitHub
`master` version is correct is almost always a stale git-submodule pin in the
`shader-slang.github.io` superproject (RTD renders whatever commit the `docs/external/slang` submodule
is pinned at) — the `external/slang/` URL segment is the tell, and the fix (bump the pin) is a
cross-repo action, not a slang code change ([docs.shader-slang.org is a submodule-pinned superproject
— "stale docs page" ≠ source bug](../learnings/1787667923317-docs-shader-slang-org-is-a-submodule-pinned-superp.md)).
And when your own fix PR is closed in favour of a fork that absorbed it, the closed PR number you
cited earlier is a stale public fact you must correct even on a chain you "closed"; verify PR state
from GitHub (`gh pr view <n> --json state,closedAt` + read the closing comment for who/why) before
routing a "PR-changed" nudge, and brief the fixer that the work landed under a different number
([reconcile when your fix PR is closed in favour of a
fork](../learnings/1787558759338-reconcile-when-your-fix-pr-is-closed-in-favour-of-.md)).

## The structural-RT draft PR #12691 pattern

A recurring cluster (#12718, #12728, #12740, #12742, #12743, #12744, #12745, #12747) — all authored by
kaizhangNV (core team) against their own WIP draft PR #12691 — established a triage pattern: a
`Dev Opened` self-tracking issue whose feature exists ONLY on the referenced draft branch is almost
always already fixed on that same branch, often within a minute of filing (e.g. #12744 filed
14:39:19Z; commit "Seal structural group list markers" landed 14:40:38Z). The routing consequence is
load-bearing: resolution is an author/operator call, the feature doesn't exist on master (so
`reproduced`/`regression` don't apply), and you hand the fixer a verify-and-bounce, never a competing
master PR ([Dev-Opened issues on PR #12691 are author self-fixes — verify-and-bounce, don't
re-fix](../learnings/1787670623857-structural-rt-dev-opened-issues-on-pr-12691-are-au.md),
[dev-opened tracking issue for own draft PR is often already
fixed](../learnings/1787669427541-dev-opened-tracking-issue-for-own-draft-pr-is-ofte.md)). The
mechanics of working with such a branch: fetch a fork-based checkpoint via `git fetch origin
pull/N/head` (the branch lives on the author's fork, so `fetch origin <branchname>` fails), then
`git worktree add --detach <sha>` to read the real WIP code — never triage against master
([fetch a fork-based WIP PR checkpoint via
pull/N/head](../learnings/1787668787779-fetch-a-fork-based-wip-pr-checkpoint-via-pull-n-he.md)).
Before building any fix, check the branch head hasn't been rewritten (`merge-base --is-ancestor
<mybase> <head>`) and grep the branch log for `Fix #<n>` — a stale base wastes a full build cycle AND
manufactures phantom cascading bugs (an `unresolved external symbol` that vanished on the real head).
An active draft branch moves fast (three commits in 17 minutes observed), so anchor a report on the
durable fact + timestamp, not a "current head" SHA; don't claim an issue "auto-closes when the PR
lands" without a `Fixes/Closes #N` keyword ([check the draft-PR branch hasn't been rewritten (and
isn't already fixed) before fixing its
bug](../learnings/1787652624718-check-the-draft-pr-branch-hasn-t-been-rewritten-an.md),
[on an active draft PR, the reported bug is often already fixed
on-branch](../learnings/1787671408861-on-an-active-draft-pr-the-reported-bug-is-often-al.md)).

## RT root causes: fix the front-end checker, not the emit consumer

Two #12691-family bugs share a principled-fix shape: the RT codegen crash traces to a front-end
structural-RT checker exemption that is too broad, and the fix is a front-end diagnostic (surviving
`-ignore-capabilities`), never a silent emit-side guard. A writable `out`/`inout`/`ref` parameter of
a stage-input view type (`rt::ClosestHitInput<T>`) passes checking but SIGSEGVs in HLSL codegen
because `diagnoseInvalidStructuralRayTracingVariableType` exempts ANY `ParamDecl` without checking
direction — narrow the exemption to value params (`!hasModifier<OutModifier>()` covers `out`+`inout`;
`&& !hasModifier<RefModifier>()`) so writable params emit diagnostic 20024 at the front end
([structural stage-input param exemption ignores
direction](../learnings/1787669466981-structural-stage-input-param-exemption-ignores-dir.md)). And a
compiler-owned marker interface (`rt::IIntersectionPrimitive`) left plain `public` lets a user struct
conform and fall into an open `Custom` catch-all arm that target lowering treats as procedural
geometry needing an intersection shader it can never have → SIGSEGV. Two general lessons: an "open
catch-all enum arm" (`Custom`/`Default`/`Other`) for a conceptually closed set is a crash trap when
consumers assume more structure than the fallback carries, and a marker interface users must not
implement should be `[sealed]` (stdlib interfaces default to `[open]`; cross-module conformance to a
`[sealed]` base is rejected with E30830, while same-module builtins still conform)
([structural RT primitive markers must be sealed — open marker + open Custom bucket = target-lowering
SIGSEGV](../learnings/1787669679140-structural-rt-primitive-markers-must-be-sealed-ope.md)).

**Source learnings (12):**
- [Reconcile when your fix PR is closed in favour of a fork](../learnings/1787558759338-reconcile-when-your-fix-pr-is-closed-in-favour-of-.md) — a closed PR number you cited is a stale public fact; verify state from GitHub before nudging.
- [Prebuilt release binaries are a free runtime bisect](../learnings/1787635116151-prebuilt-release-binaries-are-a-free-runtime-bisec.md) — a byte-identical function across the window falsifies a bisect hypothesis on its own.
- [Don't apply the regression label from a code-history hypothesis — runtime-bisect first](../learnings/1787635407452-don-t-apply-the-regression-label-from-a-code-histo.md) — ToT-repro proves the bug is real, not that it regressed; the label shapes priority.
- [Verify a suggested workaround compiles AND preserves semantics before posting](../learnings/1787636240819-verify-a-suggested-workaround-compiles-and-preserv.md) — test the exact restructure; a compiling lookalike can silently drop parameters.
- [docs.shader-slang.org is a submodule-pinned superproject — "stale docs page" ≠ source bug](../learnings/1787667923317-docs-shader-slang-org-is-a-submodule-pinned-superp.md) — bump the docs/external/slang submodule pin; a cross-repo action.
- [Check the draft-PR branch hasn't been rewritten before fixing its bug](../learnings/1787652624718-check-the-draft-pr-branch-hasn-t-been-rewritten-an.md) — grep for `Fix #<n>`; a stale base manufactures phantom cascading bugs.
- [Fetch a fork-based WIP PR checkpoint via pull/N/head, not the branch name](../learnings/1787668787779-fetch-a-fork-based-wip-pr-checkpoint-via-pull-n-he.md) — the branch lives on the author's fork; worktree add --detach to read WIP code.
- [Dev-opened tracking issue for own draft PR is often already fixed](../learnings/1787669427541-dev-opened-tracking-issue-for-own-draft-pr-is-ofte.md) — stdlib interfaces default to [open]; seal compiler-owned markers.
- [Structural stage-input param exemption ignores direction (PR 12691 family)](../learnings/1787669466981-structural-stage-input-param-exemption-ignores-dir.md) — narrow the exemption to value params so writable params emit diagnostic 20024.
- [Structural RT primitive markers must be sealed — open marker + open Custom bucket = SIGSEGV](../learnings/1787669679140-structural-rt-primitive-markers-must-be-sealed-ope.md) — an open catch-all arm for a closed set is a crash trap; fix at the front end.
- [Structural-RT Dev-Opened issues on PR #12691 are author self-fixes — verify-and-bounce](../learnings/1787670623857-structural-rt-dev-opened-issues-on-pr-12691-are-au.md) — resolution is an author/operator call; runtime-use fixes must survive -ignore-capabilities.
- [On an active draft PR, the reported bug is often already fixed on-branch — verify before building](../learnings/1787671408861-on-an-active-draft-pr-the-reported-bug-is-often-al.md) — anchor reports on durable fact + timestamp, not a fast-moving head SHA.
