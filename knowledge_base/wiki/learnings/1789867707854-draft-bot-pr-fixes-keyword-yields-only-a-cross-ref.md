---
title: "Draft bot PR + Fixes keyword yields only a cross-referenced (not connected) issue link — trips supervisor 'no PR' checks"
type: learning
topic: agent-ops
source: learnings/1789867707854-draft-bot-pr-fixes-keyword-yields-only-a-cross-ref.md
---

# Draft bot PR + Fixes keyword yields only a cross-referenced (not connected) issue link — trips supervisor "no PR" checks

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789820746824-hsf7fr
written_at: 2026-09-20T01:28:27.854Z
---

# Draft bot PR + Fixes keyword yields only a cross-referenced (not connected) issue link — trips supervisor "no PR" checks

## Symptom
A supervisor/R3 nudge claims "issue #N is still OPEN with no PR and no resumable GitHub artifact linked" even though you opened a PR that references the issue with a closing keyword.

## What actually happens (verified on shader-slang/slangpy #1173 → draft PR #1174)
- The PR was OPEN (draft), base `main`, body contained plain-text `Fixes shader-slang/slangpy#1173` (closes on merge).
- The issue's timeline (`gh api repos/OWNER/REPO/issues/N/timeline`) showed only a **`cross-referenced`** event from the PR — **no `connected` event**.
- GitHub's `connected` event (the "linked PR that will close this issue" shown in the issue's Development sidebar) did NOT fire for the **draft** PR's `Fixes` keyword; you get a mention-style `cross-referenced` instead.

## Consequence
An automated closure-detection check that greps the timeline for `connected` (or that ignores draft PRs) will report "no linked PR" and nudge you to resume a task that is actually complete.

## What to do
1. Don't resume blindly on the nudge — verify live: `gh pr view <pr> --json state,isDraft,url` and `gh api .../issues/<n>/timeline` for `cross-referenced`/`connected`.
2. The draft PR IS a human-resumable artifact; the `Fixes` keyword still auto-closes the issue on merge. Reply to the supervisor with the PR link + the `cross-referenced` evidence rather than re-doing work.
3. Belt-and-suspenders (already standard here): post an explicit 5-bullet comment on the issue linking the PR ("Fix opened as draft PR #N") — that comment is a human-resumable landing point regardless of how GitHub classifies the timeline event.
4. Bot PRs stay draft (promotion to ready + merge is a human decision), so expect this `cross-referenced`-only state to persist until a human marks the PR ready — the check should treat a draft PR with a closing keyword as "linked", not "missing".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789867707854-draft-bot-pr-fixes-keyword-yields-only-a-cross-ref.md`_
