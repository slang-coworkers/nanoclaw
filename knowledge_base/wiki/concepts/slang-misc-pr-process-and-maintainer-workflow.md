---
title: "Slang PR Process, Maintainer Workflow, and Issue Lifecycle"
type: concept
group: slang-grab-bag
tags: [maintainer, PR-process, merge-queue, CI, GitHub-Actions, issue-lifecycle, bot-permissions, regression-verification, declined-issues, superseded-PRs]
source_count: 21
---

# Slang PR Process, Maintainer Workflow, and Issue Lifecycle

This page covers the operational side of working with the Slang project: verifying PR and issue state, the rotating maintainer assignment, merge queue mechanics, bot write access, regression verification discipline, and issue lifecycle patterns (declined, superseded, reversed decisions).

## Maintainer Identity and Rotation

The on-call Slang duty maintainer rotates on a roughly two-week cadence and can be reassigned ad hoc. Any routing, @-mention, or escalation must use a **live lookup** via the Slang Maintainer agent — never hardcode a name ([Current Slang maintainer is dynamic — ask the Slang Maintainer agent, never hardcode](wiki/learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)). The developer tagged as `tfoley` in Slang TODO comments is Theresa Foley (often goes by "Tess"), not "Tim Foley", as confirmed in the repo's `.mailmap` ([Slang compiler: tfoley real name](wiki/learnings/1777487718343-slang-compiler-tess-foley-name.md)).

## Maintainer Handoff: Reconcile Live PR State

An internal "APPROVE-clean" verdict from a reviewer is **not** visible on GitHub. Before treating a maintainer handoff as merge-ready, always reconcile against the live PR state: draft status, CI, review decision, and unresolved threads ([slang maintainer handoff — verify on-PR state against internal verdicts](wiki/learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)).

## Required Status Check Names

Required status check names in `shader-slang/slang` equal the **job key** (kebab-case, no separate `name:` field). Renaming job keys requires updating branch protection rules. Workflow file changes require a patch-handoff since the bot lacks `workflows` permission ([Slang required-status-check name = job key (kebab-case convention)](wiki/learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)).

## Merge Queue Evictions

How to investigate PR evictions: use `merge_group` event workflow run queries. Key facts: merge_group runs age out quickly, a batch failure evicts all PRs in the batch, and most evictions in practice are caused by Falcor timeout flakes rather than code regressions ([Investigating merge-queue evictions in shader-slang (merge_group runs)](wiki/learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)). A missing-default-constructor build break is all-platform (not MSVC-only) and causes merge queue evictions for unrelated PRs ([shader-coverage vkdemo::Context break is all-platform and blocks the merge queue (not MSVC-only)](wiki/learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)).

## Bot Write Access: push:false Is Not a Denial

`nv-slang-bot` can push branches and open PRs on `shader-slang/slang-rhi`. `gh api` returning `push:false` in `.permissions` is the normal shape of a GitHub App installation token and does **not** indicate write access is denied — the only authoritative test is an actual `git push` ([CONSOLIDATED: shader-slang/slang-rhi (and all shader-slang repos) are bot-writable — push:false probes are false-positives](wiki/learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)).

## Regression Verification Discipline

Verifying against `build/Release/bin/slangc` is **not** the same as verifying against checkout HEAD. Both the binary version string and the checkout ancestry must be confirmed before claiming a bug reproduces on current code ([CORRECTION: slang#11483 crash was a stale pre-#11211 build, not master](wiki/learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)). A commit's author-date being inside a [good, bad] window does not mean it's in a specific release — always verify with `git merge-base --is-ancestor` ([Slang: precompiled .slang-module import triggers location-less diagnostics; verify commit-vs-tag ancestry before attributing a regression](wiki/learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)).

The reporter of slang#11483 was already on a release containing the #11211 crash fix. The crash and wrong-data symptom are **distinct defects**; a GPU-free spirv-val pass cannot refute a runtime-only/driver symptom — the issue must remain open pending hardware retest ([slang#11483: reporter's release already had #11211 — wrong-data is a distinct OPEN defect, not the fixed crash](wiki/learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)).

For coverage-manifest bugs, always read both the association-copy sites and consumer validity guards before accepting a reported root cause — the "not propagated" root cause may already be fixed at HEAD ([slang #11629 — reporter's root cause contradicted by HEAD; verify propagation before fixing coverage-manifest gaps](wiki/learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)).

## Declined Issues and Reversed Decisions

- **#11568 (ResourceDescriptorHeap)**: Initially declined by maintainer jkwak-work in favor of `DescriptorHandle<T>`. Later **reversed**: maintainer team now implementing via `UntypedResourceHandle`/`UntypedSamplerHandle` proxy types that implicit-cast to resource types ([RESOLVED/DECLINED: slang#11568 ResourceDescriptorHeap/SamplerDescriptorHeap input syntax — maintainer says DescriptorHandle supersedes](wiki/learnings/1781312606061-resolved-declined-slang-11568-resourcedescriptorhe.md), [UPDATE slang#11568: maintainer team now implementing via csyonghe's UntypedResourceHandle proxy design (supersedes 'declined')](wiki/learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)). PR #11723 (unified descriptor-heap stride) only changes SPIR-V emit/CLI/diagnostics — it does **not** remove the E39999 front-end blocker ([slang#11568 corollary: #11718 unified descriptor-heap stride is BACKEND-only — does NOT remove the E39999 front-end blocker](wiki/learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)).

- **#11599 (clip-space Z-remap)**: Declined as outside Slang's scope. Later the maintainer opened a GLSL-only scope but reviewed with `CHANGES_REQUESTED` meaning "won't merge to ToT" — a cherry-pickable reference PR, not a full acceptance ([slang #11599 clip-space Z-remap option — DECLINED by maintainer (out of scope)](wiki/learnings/1782171440977-slang-11599-clip-space-z-remap-option-declined-by-.md), [slang#11599 clip-space-Z remap DECLINED by maintainer](wiki/learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md), [slang #11599 — feature delivered as a cherry-pickable reference PR maintainer won't merge to ToT (CHANGES_REQUESTED = no-merge signal)](wiki/learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)).

## Superseded PRs and Postmortems

- **#11681 (DescriptorHandle _coerce guard)**: Maintainer preferred removing the dubious `ParameterGroupType` guard entirely over a DescriptorHandle carve-out ([ADDENDUM (slang #11681): maintainer preferred REMOVING the dubious _coerce guard over a DescriptorHandle carve-out](wiki/learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)).

## Falcor YML CI Refactor Gotchas

The 3-file YML refactor (dispatcher + build + test reusable workflows) has non-obvious implementation details: artifact download path differences per test type, `merge_group` trigger requirements, and job key naming for required status checks ([slang 11600 falcor 3-file YML refactor implementation gotchas](wiki/learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)). `FALCOR_LOCAL_SLANG` build directory is relative and per-config (not absolute), and building Falcor from source requires Slang built with GFX enabled ([Correction: FALCOR_LOCAL_SLANG usage details (verified in PR #11602)](wiki/learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)).

## Discord Support Channel Bot Routing

The `slang-discord-support` bot has write access only to summon threads in #slang-support/#slang-support-bot. Source channels like #slang-discussion are read-only for the bot — answers to questions in source channels must be posted by a human or via a summon thread ([slang-discord-support posts only to summon threads, not source channels](wiki/learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)).

---
**Source learnings (22):**
- [tfoley is Theresa Foley](wiki/learnings/1777487718343-slang-compiler-tess-foley-name.md)
- [maintainer handoff verify live PR state](wiki/learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)
- [verify commit-vs-tag ancestry before attributing regression](wiki/learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)
- [crash was stale build not master](wiki/learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)
- [reporter's release already had fix, wrong-data is distinct defect](wiki/learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)
- [slang-rhi is bot-writable](wiki/learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)

- [Discord support bot routing](wiki/learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)
- [build break is all-platform](wiki/learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)
- [required status check name = job key](wiki/learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)
- [#11568 initially declined](wiki/learnings/1781312606061-resolved-declined-slang-11568-resourcedescriptorhe.md)
- [Falcor YML refactor gotchas](wiki/learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)
- [Falcor local slang usage details](wiki/learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)
- [root cause contradicted at HEAD](wiki/learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)
- [maintainer is dynamic](wiki/learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)
- [maintainer preferred removing guard](wiki/learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)
- [#11599 Z-remap declined](wiki/learnings/1782171440977-slang-11599-clip-space-z-remap-option-declined-by-.md)
- [#11599 Z-remap declined (companion)](wiki/learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md)
- [#11718 backend-only does not remove E39999 blocker](wiki/learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)
- [merge queue evictions investigation](wiki/learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)
- [#11568 reversed, implementing via UntypedResourceHandle](wiki/learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)
- [#11599 feature cherry-pickable reference PR](wiki/learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)

_Catalog: [[wiki/index.md]]_
