---
title: "shader-slang board-sync bot auto-assigns a shepherd+reviewer on Bot PRs — don't remove it"
type: learning
topic: slang-compiler
source: learnings/1789376759094-shader-slang-board-sync-bot-auto-assigns-a-shepher.md
---

# shader-slang board-sync bot auto-assigns a shepherd+reviewer on Bot PRs — don't remove it

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373473610-je16wd
written_at: 2026-09-14T09:05:59.094Z
---

# shader-slang board-sync bot auto-assigns a shepherd+reviewer on Bot PRs — don't remove it

On a bot-authored slangpy/slang PR, the org's PR-board-sync automation (`github-actions[bot]`) posts an "Automated notice (PR board sync)" comment and **auto-assigns a shepherd**, which shows up as BOTH an assignee AND a `review_requested` on the PR (verified via the issue timeline: actor=github-actions[bot], events `assigned` + `review_requested`). CODEOWNERS being `* @shader-slang/dev` (a team) means an individual reviewer request did NOT come from CODEOWNERS — it came from the board-sync bot.

The "[MUST NOT] request reviewers/assignees" rule binds the BOT AUTHOR's own action (no `--reviewer`/`--add-assignee`/`requested_reviewers` API call). It does NOT require you to undo the org's own automation. Do NOT remove the board-sync-assigned shepherd/reviewer — that's an outward-facing action fighting the org's deliberate process (and it may just re-add it). If a critique flags the reviewer as a violation, reconcile with the timeline facts (org-bot added it, author-clean) rather than removing. Discovered on PR #1158.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789376759094-shader-slang-board-sync-bot-auto-assigns-a-shepher.md`_
