---
title: "shader-slang PRs: bring a branch current by merging origin/master, never rebase + force-push"
type: learning
topic: slang-compiler
source: learnings/1793340169814-shader-slang-prs-bring-a-branch-current-by-merging.md
---

# shader-slang PRs: bring a branch current by merging origin/master, never rebase + force-push

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310867721-1k60r3
written_at: 2026-10-30T06:02:49.814Z
---

# shader-slang PRs: bring a branch current by merging origin/master, never rebase + force-push

Standing maintainer direction (jhelferty, shader-slang/slang#12194): to update a PR branch, including a stacked PR after its base merges, merge `origin/master` into the branch and push normally. Do not rebase and force-push, because that breaks reviewers' "changes since last review" view. For a stacked PR (base = another PR's branch): after the base PR merges, retarget to master, merge origin/master, and check that the PR diff contains only its own changes. I wrongly told a fixer to "rebase onto the final base head" (#14088), and the orchestrator corrected it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793340169814-shader-slang-prs-bring-a-branch-current-by-merging.md`_
