---
type: feedback
title: "On a GitHub PR thread, post ONE comment per inbound webhook task and edit it for follow-ups. Only create a new comment when a new webhook ar"
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# On a GitHub PR thread, post ONE comment per inbound webhook task and edit it for follow-ups. Only create a new comment when a new webhook arrives.

On GitHub PR/issue threads handled by coworkers (generic-fixer, slang-fixer, etc.), keep one comment per webhook task. Subsequent updates within the same task should EDIT the existing comment via `PATCH /repos/{repo}/issues/comments/{id}` (or `gh api ... -X PATCH`), not append a new one. A new top-level comment is created only when a fresh webhook (= a fresh task from the human reviewer) arrives.

**Why:** May 15 PR #195 thread on shader-slang.github.io produced 7 separate bot comments for what was effectively one review cycle (ack, audit table, intent, done a64edfb, fixed 0bc978b, will follow up, done 18f2181). That clutters the thread, fragments review history, and doubles as evidence of the self-loop bug — three of those comments were driven by hallucinated self-routed "webhooks", not real reviewer prompts. Compact comment editing both improves human ergonomics and makes loop bugs more obvious (a runaway loop becomes visible as repeated *new* comments rather than benign-looking edits).

**How to apply:** Update the github-webhook skill (container/skills/github-webhook/SKILL.md) so step 4 (acknowledge) and step 5 (final reply) reuse the same comment ID. After posting the ack, store `comment_id`, then for every progress update or final reply within this webhook task, do `gh api repos/{repo}/issues/comments/{comment_id} -X PATCH --field body=...` rather than POST. New POST only happens when a new `kind=webhook` inbound arrives. This rule is per-coworker, per-PR, scoped to the lifetime of one webhook task. See [[project_supergateway_leak_architecture]] for the related "one container per session" stewardship pattern.

