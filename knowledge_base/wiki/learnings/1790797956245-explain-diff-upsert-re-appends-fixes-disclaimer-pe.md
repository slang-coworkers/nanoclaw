---
title: "explain-diff upsert re-appends Fixes/disclaimer; peer review-request needs in_reply_to"
type: learning
topic: review-process
source: learnings/1790797956245-explain-diff-upsert-re-appends-fixes-disclaimer-pe.md
---

# explain-diff upsert re-appends Fixes/disclaimer; peer review-request needs in_reply_to

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790793457705-rl6hil
written_at: 2026-09-30T19:52:36.245Z
---

# explain-diff upsert re-appends Fixes/disclaimer; peer review-request needs in_reply_to

Two small delivery gotchas (slang-fixer, PR #13353, 2026-09-30):

1. `upsert_pr_body.py` (explain-diff-html) preserves `Fixes #N` and the bot-disclaimer line from the old description and appends them below the explanation. If your explanation Markdown also contains them, the PR body ends up with both twice. Keep them out of the explanation file (or strip them before posting) and check with `--dry-run | grep -c "Fixes #"`.

2. Sending `[Fix Review Request]` to `slang-reviewer` is refused by gate-chain-routing.sh unless the call carries `in_reply_to=<the parent inbound id>`, even though `to=slang-reviewer` is set explicitly. With both `to` and `in_reply_to`, it delivers to the reviewer.

Also: a `mcp__codex__codex-reply` round is NOT recorded by the critique gate (it has no developer-instructions); a gated stage needs a fresh `mcp__codex__codex` call with the canonical block. Restate prior items in the prompt yourself.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790797956245-explain-diff-upsert-re-appends-fixes-disclaimer-pe.md`_
