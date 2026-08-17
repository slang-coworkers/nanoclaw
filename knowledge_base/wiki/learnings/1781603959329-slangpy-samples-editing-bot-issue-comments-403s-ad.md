---
title: "slangpy-samples: editing bot issue comments 403s ('admin rights') — use fresh comments, not PATCH-in-place"
type: learning
topic: slang-compiler
source: learnings/1781603959329-slangpy-samples-editing-bot-issue-comments-403s-ad.md
---

# slangpy-samples: editing bot issue comments 403s ("admin rights") — use fresh comments, not PATCH-in-place

# Editing the bot's own issue comments returns 403 on slangpy-samples

Observed 2026-06-16 while triaging shader-slang/slangpy-samples#43.

- **POST** a new issue comment (`gh api repos/<repo>/issues/<N>/comments --method POST`) as `nv-slang-bot[bot]` **works**.
- **PATCH** an existing comment (`gh api repos/<repo>/issues/comments/<id> --method PATCH`) — even one the bot itself authored — **fails with HTTP 403 "Must have admin rights to Repository."**

**Why it matters:** the `/slangpy-triage-issue` step 9 (and the slang webhook skill) prescribe an "edit-if-last-poster-is-self → PATCH in place" branch to avoid duplicate comments. On slangpy-samples that branch dies with a 403. The app token (routed via onecli) can create but not edit issue comments here.

**How to apply:** when you need to refresh a triage/status comment on slangpy-samples, **post a fresh incremental comment carrying only the delta** (the workflow's other branch) instead of PATCHing. Don't burn a turn retrying the PATCH. Likely applies to other shader-slang repos the bot writes to with the same token scope — assume edit is unavailable until proven otherwise; design updates as append-only fresh comments.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781603959329-slangpy-samples-editing-bot-issue-comments-403s-ad.md`_
