---
type: chain
title: Nightly agentic-tests red — stale docs/generated fixtures (#13810, #13887)
description: Nightly-only docs/generated/tests fixtures broken by intended compiler changes. Two tests-only draft PRs refresh them, and both wait on a maintainer merge.
---

# Nightly agentic-tests: stale docs/generated fixtures

PR CI never runs `docs/generated/tests`, so an intended emit or diagnostic change breaks these fixtures
silently. The fix is a tests-only refresh PR (precedents #13454, #13731). I have told the operator
three times that this keeps recurring.

- **#13810** (draft, head `f04766a8`): line-directive (#13724), plus push-constant ×2 (#13646), plus the PR-CI test `tests/hlsl/split-sampler-globals-keep-user-line.slang`. Thread `nightly-agentic-fixture-hlsl-line-directive-13724`.
- **#13887** (draft, head `3986f5d` on 10-29): alias-inout/out-in (#13406), descriptorhandle/untypedhandle (#13708), compound-alias-wave-index WGSL `num_subgroups` (#13911), HLSL and Metal byte-address `CHECK-DAG` (#13764). slang-reviewer APPROVE. Thread `nightly-agentic-fixtures-13406-13708`.
- **10-31:** an 11th fixture is stale after #14097 (merged 10-30 22:05Z, `e8adec89`, WGSL now maps `SV_ClipDistance` to `clip_distances`): `coverage/legalize/wgsl-unsupported-system-value-diag.slang` expects E55202 for `SV_ClipDistance`. Main verified it in nightly 41167278425 (11 FAILED) and sent it to the fixer to fold into #13887, keeping the fixture's purpose (an unsupported WGSL semantic → E55202).
- **Open with the operator:** the spec UB question C7 (`basics-memory-model-special-topics.md:22-23`, in+out aliasing), deliberately kept out of #13887.
- **Timer:** `rechase-fixture-prs-1381-3683` (11-05 08:30Z). It expects 11 fixtures and re-arms weekly by itself.
- **10-31 08:52Z R3 [Fix Report]:** #13887 at head `c5621493d` (10 files, +81/−54, MERGEABLE). The fixture now uses `SV_CullDistance` (unconditionally `isUnsupported` on WGSL). slang-reviewer delta APPROVE_WITH_NITS, with the nits applied. CI 41183800764 and 41185858848 are queued or pending (bot-CI backlog). Side finds sent to the triager under the 10-31 filing rule: the user guide `a2-03-wgsl-target-specific.md:20` still says `SV_ClipDistance<N>` is not supported (stale after #14097), and the scalar `SV_ClipDistance` arm has no test (the vector case is in draft #13939).
- **10-31 08:57Z:** reviewer APPROVE at `c562149`. A comment-rewrap commit after that moved the head to `10a4af8`; CI 41186663692 is dispatched. Waiting on a maintainer.
- **Docs follow-up filed:** #14130 (10-31 09:01Z, WebGPU/document/reproduced): stale guide row plus untested scalar `SV_ClipDistance` E55202. No fixer chain.
- **11-01 08:0xZ:** nightly 41271892704 has 13 FAILED. 2 new, stale after #14132 (merged 10-31 17:23Z, `6815ed82`, WGSL static const arrays no longer get a `var<private>` fallback): `design/target-pipelines/wgsl/static-const-array-emits-var-private.slang` and `static-const-nested-array-inline-fold.slang`. Main verified them and sent them to the fixer for #13887. The re-check prompt now expects 13.
- **11-01 09:01Z R4 [Fix Report]:** #13887 at `64a525adf` (GitHub shows 14 files, +142/−101, counting the rename as delete+add). The `static-const-array-emits-var-private` fixture was renamed to `static-const-array-emits-module-const` (`3503623`). Both static-const fixtures now pin `{{^}}const …` plus `CHECK-NOT: var<private>`. A drift-from-source doc-gap row covers `design/target-pipelines/wgsl.md:1202-1224` (option A). Reviewer APPROVE_WITH_NITS; CI 41288192383 and 41290894000 succeeded. The stale `wgsl.md` section is NOT filed, because the doc-gap row is the regeneration's tracking mechanism.
- **11-01 ~09:15Z side find filed: #14134** (`extras/formatting.sh:276` unquoted `git ls-files $@`; CI check-formatting skips nested `.md`/`.json`/most `CMakeLists.txt`; quoting it exposes 444 files of prettier/gersemi debt). Found by slang-reviewer during #13887, reproduced by the fixer, filed by slang-triager on a sibling Main dispatch (thread `formatting-sh-ls-files-unquoted-glob`, "Don't start a fixer chain"). Parked filed-only on a **maintainer decision** (land fix + reformat together / reformat first / exclude `docs/generated/**`). The `issue_opened` webhook (Main session thread `gh-issue-shader-slang/slang-14134`) needed no dispatch.
- **Side find filed:** #14134 (11-01 09:20Z, Infra/reproduced/regression): `extras/formatting.sh:276` has an unquoted `git ls-files $@`, a regression from #6153. CI format checks cover 6 of 594 md files and 22 of 59 CMake files. Fixing it exposes 444 files of formatting debt. A maintainer decides how to land it; no fixer chain.
