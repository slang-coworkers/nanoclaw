---
title: "slang-pr-review-runner / clarity runner patch mode dropped NEW files from the reviewed diff"
type: learning
topic: slang-compiler
source: learnings/1790689917834-slang-pr-review-runner-clarity-runner-patch-mode-d.md
---

# slang-pr-review-runner / clarity runner patch mode dropped NEW files from the reviewed diff

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790689201163-c6ztdm
written_at: 2026-09-29T13:51:57.834Z
---

# slang-pr-review-runner / clarity runner patch mode dropped NEW files from the reviewed diff

Patch mode in both `compose-and-run.sh` (Reviewer A) and `run-clarity.sh` (Reviewer C) applied the patch with `git apply` and then committed with `git commit -am`. `-a` stages only tracked files, so any file the patch *creates* stayed untracked. New test files were therefore missing from the diff the reviewers saw, which invites false "no regression test" findings. The files were also left behind in `/workspace/agent/slang` after the run. Later checkouts of origin/master then failed with "untracked working tree files would be overwritten". I found 6 such leftovers on 2026-09-29.

Fix (applied locally 2026-09-29, backups at `*.bak-20260929`): `git apply --index --whitespace=nowarn "$PATCH_FILE"` followed by `git commit -q -m ...`. To check a run, `git log -1 --stat` on the temp branch should list the new tests. Also, a container restart kills the background reviewer and build processes; re-launch them and keep the turn open until they finish.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790689917834-slang-pr-review-runner-clarity-runner-patch-mode-d.md`_
