---
title: "[approver/infra-abstain] slangpy PRs can have ZERO review sources: Claude skipped + CodeRabbit path-excludes external/** + Devin auth-fails"
type: learning
topic: slang-compiler
source: learnings/1786117872301-approver-infra-abstain-slangpy-prs-can-have-zero-r.md
---

# [approver/infra-abstain] slangpy PRs can have ZERO review sources: Claude skipped + CodeRabbit path-excludes external/** + Devin auth-fails

## Symptom

slangpy#1095 (`Forward CUDA downstream compiler arguments`) reached the approver
with **no usable review signal at all**, and each of the three sources failed for
a *different, individually-plausible* reason — so no single check would have
caught it:

1. `github-actions[bot]` production Claude review: check-run
   `Claude Code Assistant` = `completed/skipped` on the pinned head. Genuine
   skip. `collect-reviews.sh` exit 20.
2. `coderabbitai[bot]`: no formal review at all (`pulls/N/reviews` = `[]`), only
   a summary *comment* saying "No actionable comments were generated" — which
   explicitly listed `external/slang-rhi` under "Files ignored due to path
   filters" (`!external/**` in `.coderabbit.yaml`).
3. Devin: `devin-fetch.sh` exit 0 with an empty `## Flags` section — a
   false-clean (see the sibling `[approver/infra-abstain]` learning on the
   checks-panel done-guard).

Net: the largest semantic component of the PR — an `external/slang-rhi` submodule
bump of 11 upstream commits — was reviewed by **nobody**, while the PR presented
as a clean 26-line change.

## Root cause

The three sources have **non-overlapping blind spots that happen to align** on
submodule-bump PRs:

- CodeRabbit's `!external/**` path filter is exactly where submodule pointers
  live, so CodeRabbit structurally cannot review a submodule bump.
- The production Claude review skips some PR classes entirely.
- Devin is the only head-current source that *would* cover `external/`, so a
  Devin failure on a submodule-bump PR silently drops coverage to zero.

Worse, the submodule range was far wider than the PR's framing: the body said
"expose modern CUDA device capabilities", but `1a97687...8ffe21c` also carried
`src/vulkan/vk-pipeline.cpp` (+75/−21), Metal native buffer import, Metal
`dispatchComputeIndirect`, and pipeline-cache blob-length validation. A
CUDA-titled PR was the delivery vehicle for unreviewed Vulkan and Metal changes.

## How to catch it

- **Treat a `external/**` / submodule pointer line in the diff as a coverage
  question, not a one-line change.** `git diff` shows `-Subproject commit X` /
  `+Subproject commit Y` — that is 1 diff line and can be hundreds of real ones.
  Always expand it:
  `gh api repos/<owner>/<sub>/compare/<old>...<new> --jq '{ahead: .ahead_by, behind: .behind_by, files: [.files[]?.filename]}'`
- **Check the bump against the PR's stated scope.** Ahead-by-N with a clean
  fast-forward (`behind_by: 0`, and `compare <new>...main` = `identical`) is
  good hygiene, but it says nothing about whether the N commits match what the
  PR claims to do. List the changed subsystems and compare them to the title.
- **Read CodeRabbit's own "Files ignored due to path filters" block** in its
  summary comment. Its "No actionable comments" is scoped to what it actually
  looked at; on slangpy that never includes `external/**`. A clean CodeRabbit on
  a submodule-bump PR is near-vacuous for the bump itself.
- When the pinned head's review sources are all absent/failed, that is
  `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` — record the per-source inventory (which
  source, which state, which evidence) so the human knows *which* coverage is
  missing rather than just "no signal".

## Fix

Recorded ABSTAIN_INFRA / NO_REVIEW_SIGNAL for #1095@0370e7cb59c7 with a
per-source signal inventory. Suggested durable improvements:

- The synthesis step should treat "diff touches a submodule pointer" +
  "CodeRabbit path-excludes it" as an explicit coverage hole to name in the
  review doc, even when other sources succeed.
- Consider expanding submodule ranges into the review doc automatically, so the
  bump's real subsystem footprint is visible to whichever source *is* working.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786117872301-approver-infra-abstain-slangpy-prs-can-have-zero-r.md`_
