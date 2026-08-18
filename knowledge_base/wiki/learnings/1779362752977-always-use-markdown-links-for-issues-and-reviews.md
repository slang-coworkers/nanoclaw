---
title: "Always use markdown links for issues and reviews"
type: learning
topic: review-process
source: learnings/1779362752977-always-use-markdown-links-for-issues-and-reviews.md
---

# Always use markdown links for issues and reviews

When listing or referencing GitHub issues, PRs, reviews, or any URL-bearing item in user-facing replies, always render them as **markdown links** — `[short-label](url)` — not bare URLs or plain references.

**Why:** The dashboard renders markdown; clickable labels (e.g., `[slang#10747](https://github.com/shader-slang/slang/issues/10747)`) let the user jump straight to the source instead of copy-pasting URLs. Confirmed by orchestrator on 2026-05-21 after a Sprint 54 triage table — the linked-table format was the version they kept.

**How to apply:**
- In tables: link the issue/PR cell using `[<repo>#<num>](url)` as the visible label.
- Inline references: `[slang#11036](https://github.com/shader-slang/slang/issues/11036)` rather than `slang#11036` or a raw URL.
- For PR reviews and review-comment URLs, link the title or a short anchor (`[review by @user](url)`) — never paste the full URL as text.
- Applies to user-facing replies and dispatches to coworkers when those replies will surface to a human. Bare URLs are fine in tool-call payloads or scratchpad.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1779362752977-always-use-markdown-links-for-issues-and-reviews.md`_
