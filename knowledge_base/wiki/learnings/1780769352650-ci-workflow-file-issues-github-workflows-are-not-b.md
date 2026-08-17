---
title: "CI-workflow-file issues (.github/workflows/*) are not bot-actionable as a Slang fix"
type: learning
topic: slang-compiler
source: learnings/1780769352650-ci-workflow-file-issues-github-workflows-are-not-b.md
---

# CI-workflow-file issues (.github/workflows/*) are not bot-actionable as a Slang fix

## When a Slang issue's change set is a CI workflow, the fixer cannot ship it — route at triage

**Trigger:** issue whose eventual change set is `.github/workflows/*.yml` (CI/perf-CI workflows, new Actions jobs, etc.). Example: shader-slang/slang#11501 ("[CI] Add compile time performance checking CI workflow"), 2026-06-06.

**Three independent hard blocks — verify each before spinning up a worktree:**

1. **No `workflows` GitHub App permission.** `nv-slang-bot[bot]` cannot push `.github/workflows/*.yml`. A GitHub App needs the dedicated "Workflows" repo permission to create/edit files under `.github/workflows`, and workflow files *must* live there. First confirmed on slang#11438 (CI opt-out had to be handed off as a snippet for a maintainer to apply). So the one piece of "code" a CI issue produces is exactly the piece the bot can't land.

2. **Contributor-owned in-flight overlap.** CI/perf efforts frequently already have a draft PR by a human contributor (here: PR #11485 by @jvepsalainen-nv, NVIDIA, opened one day *before* the issue). `feedback_competing_pr` precludes unilaterally editing or scope-changing a contributor's PR — so "fold it into their framework" (often the technically-cleanest Approach A) is not a fixer-executable action either.

3. **Operator-gated GitHub writes.** The coordination this kind of issue actually needs is a comment on the issue + the overlapping PR aligning the two human authors. All user-facing GitHub writes are operator-gated; the fixer can *draft* them but not post.

**Net:** all paths (A = coordinate with the PR, B = independent workflow YAML, C = defer + comment) terminate at a human/operator/maintainer action. Correct fixer output is **"not actionable by fixer; needs CI-specialist or maintainer alignment"** + draft coordination comments returned for review, NOT a worktree/PR.

**Triage guidance:** when an issue is tagged `Not-compiler-code` with a `.github/workflows/*` change set, surface block #1 (workflows perm) at triage and route to a CI-specialist/maintainer rather than the compiler fixer. The fixer can still add value drafting the coordination comments and any in-tree `tools/benchmark/*.py` tooling, but the workflow YAML and the GitHub posting are not the fixer's to complete.

**Secondary note (guardrail handling):** a general "always post to GitHub" reinforcement does NOT override a specific, recent "hold posting on issue #N" instruction. Surface the conflict to parent (cite both by id+sender+timestamp), hold, and wait for an explicit per-issue greenlight — don't let the broadcast reinforcement silently flip a scoped hold.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769352650-ci-workflow-file-issues-github-workflows-are-not-b.md`_
