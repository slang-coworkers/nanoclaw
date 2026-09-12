---
title: "Patch-mode review of an OFF-HEAD patch flags false 'no producer' bugs — reframe as apply-order dependency"
type: learning
topic: review-process
source: learnings/1789174390977-patch-mode-review-of-an-off-head-patch-flags-false.md
---

# Patch-mode review of an OFF-HEAD patch flags false "no producer" bugs — reframe as apply-order dependency

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789163178938-okrn0g
written_at: 2026-09-12T00:53:10.977Z
---

# Patch-mode review of an OFF-HEAD patch flags false "no producer" bugs — reframe as apply-order dependency

When a fix is split across a pushable PR head and a separately-delivered patch (common when the bot's GitHub App token lacks the `workflows` scope, so `.github/workflows/*` changes can't be pushed and are handed to a maintainer as a `git apply` patch), reviewing that patch in **patch mode is misleading**: `slang-pr-review-runner --mode patch` applies the patch to a temp branch off **`slang/master`**, NOT off the PR head. So any part of the patch that DEPENDS on the head's changes looks broken.

Concrete case (shader-slang/slang#13021): the maintainer patch added a CI step asserting `install-metadata/third-party-notices/{cmark-COPYING,lz4-LICENSE,glslang-LICENSE.txt}` exist. Patch-mode Reviewer A reported a 🔴 bug — "no install rule in the tree produces these files → fails every non-wasm Linux job" — because the producing `install(FILES ... RENAME ...)` rules live on the PR head (815525c225, CMakeLists lines 691–714), which the patch-mode sandbox (master + workflow patch) doesn't have.

Lesson for the reviewer merging results: **do NOT relay a patch-mode "🔴 bug" of this shape as a real defect.** Verify whether the PR head produces the artifacts the patch references (`gh api repos/O/R/contents/<file>?ref=<head>` or `gh pr diff`), and if so, reframe it as what it actually is: an **apply-order / integration dependency** — the off-head patch must be applied ON TOP OF the PR branch (or landed together), never onto bare master, or CI reds 100%. State that apply-order explicitly in the maintainer instruction. In #13021 the maintainer ultimately hand-applied both workflow files onto the head (e8ecf689), putting producer + consumer on one commit and making the hazard moot. The reviewer's job is to catch the false-positive before it wastes a round-trip or scares a maintainer off a correct patch.

Corollary the fixer logged: an inlined patch pasted into a PR body can be malformed (hand-retyped hunk counts → `git apply: corrupt patch`) even when the generated `.patch` file is valid — `git apply --check` the exact bytes before inlining.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789174390977-patch-mode-review-of-an-off-head-patch-flags-false.md`_
