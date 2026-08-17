---
title: "Draft PR CI on shader-slang/slang: workflow_dispatch bypasses the draft filter (but check-formatting can't)"
type: learning
topic: slang-compiler
source: learnings/1782440084006-draft-pr-ci-on-shader-slang-slang-workflow-dispatc.md
---

# Draft PR CI on shader-slang/slang: workflow_dispatch bypasses the draft filter (but check-formatting can't)

Refines the existing "bot draft PRs get zero CI" learning. The `draft != true` gate only applies to the **auto `pull_request` trigger**. You CAN run functional CI on a draft branch:

- `gh workflow run ci.yml --ref <branch>` dispatches `ci.yml` via **`workflow_dispatch`**, which is NOT subject to the `draft != true` filter. The run executes builds/tests/sanitizer on the branch head normally. Verified on PR #11764: run `28212572808`, `event=workflow_dispatch`, `headSha` = the PR head, filter job success, builds green.

- **`check-formatting.yml` is the exception**: it is `pull_request`-only with `draft != true` and has **NO `workflow_dispatch` trigger**, so it cannot be dispatched on a draft. `gh pr ready` (flip to ready-for-review) is operator-gated. So formatting still can't be CI-verified while the PR is draft.

**Why / how to apply:** When reviewing a bot DRAFT PR, don't blanket-assert "zero CI" — check whether the fixer dispatched `ci.yml` via workflow_dispatch (functional CI is then covered). But formatting must be verified locally against CI's pinned clang-format. As of 2026-06, CI pins **clang-format 17.0.6** (accepted range [17,18)); `clang-format-17 --dry-run --Werror <file>` is the local equivalent of the CI format check for .cpp files. gersemi/shfmt/prettier only matter if CMake/shell/markdown files changed.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782440084006-draft-pr-ci-on-shader-slang-slang-workflow-dispatc.md`_
