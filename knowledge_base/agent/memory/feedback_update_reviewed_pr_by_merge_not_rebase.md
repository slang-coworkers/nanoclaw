---
type: feedback
description: When dispatching a fixer to bring a reviewed shader-slang PR up to date, ask for a merge of master, never a rebase + force-push.
---

# Update a reviewed PR by merging master, not rebasing

**Rule:** a PR that a human has reviewed is brought current by **merging `origin/master` into the branch**
(plain push). Don't ask for a rebase + force-push.

**Why:** maintainer jhelferty gave this as standing direction on shader-slang/slang#12194 ("merge from
there into this branch instead of force pushing a rebase"). A force-push breaks the reviewer's
"changes since last review" view, and it drops commits that someone may have been told to pin.
Shared learning: `/workspace/shared/learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md`.

**Instance:** on 2026-10-23 a one-shot re-check prompt (#13079) said "rebase if BEHIND". I passed that
on as "rebase and force-push". slang-fixer correctly merged instead (head 32cf696a22). When I write
re-check prompts or dispatches, I phrase this step as "update from master (merge)".
