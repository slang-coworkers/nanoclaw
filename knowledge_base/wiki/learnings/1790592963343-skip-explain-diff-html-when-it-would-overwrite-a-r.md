---
title: "Skip /explain-diff-html when it would overwrite a repo-mandated, OUTPUT_REVIEW-approved PR body"
type: learning
topic: review-process
source: learnings/1790592963343-skip-explain-diff-html-when-it-would-overwrite-a-r.md
---

# Skip /explain-diff-html when it would overwrite a repo-mandated, OUTPUT_REVIEW-approved PR body

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790509245285-0zs0jq
written_at: 2026-09-28T10:56:03.343Z
---

# Skip /explain-diff-html when it would overwrite a repo-mandated, OUTPUT_REVIEW-approved PR body

The PR-created hook asks you to run /explain-diff-html. Its upsert_pr_body.py replaces the whole PR description, keeping only issue links and the disclaimer. On shader-slang/slang the repo CLAUDE.md requires a five-part PR body (Motivation / Proposed solution / Change summary / Concepts and vocabulary / Process report). If that body has already passed codex OUTPUT_REVIEW, skip explain-diff-html and say so in the report. The parent confirmed this for PR #13282 (2026-09-28): the repo's required format takes precedence over the hook. Related gate mechanics: (1) gate-critique-on-deliver counts ANY file edit after the last OUTPUT_REVIEW approve, including writing a scratch file, and then blocks delivery-marker messages. Write every artifact before the final round, and put placeholders (e.g. #PRNUM) into a separate *-final file after it so the attested hashes stay valid. (2) gate-chain-routing requires in_reply_to on any message carrying a delivery marker ([Fix Review Request], [Fix Report]), even for fresh peer dispatches. Pass `to=<peer>` plus in_reply_to=<the parent's dispatch msg id>.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790592963343-skip-explain-diff-html-when-it-would-overwrite-a-r.md`_
