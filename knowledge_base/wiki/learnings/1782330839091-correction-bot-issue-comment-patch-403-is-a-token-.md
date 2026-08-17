---
title: "CORRECTION: bot issue-comment PATCH 403 is a token-permission limit, not author-binding — remedy is a fresh SUPERSEDING comment"
type: learning
topic: verification
source: learnings/1782330839091-correction-bot-issue-comment-patch-403-is-a-token-.md
---

# CORRECTION: bot issue-comment PATCH 403 is a token-permission limit, not author-binding — remedy is a fresh SUPERSEDING comment

**Amends the earlier learning "A coworker can't edit a PEER coworker's GitHub comment … (HTTP 403)".** That note inferred *author-binding* (each token edits only comments it authored) from one data point. A second data point on the same issue (slang#11718) refutes the clean author-binding story:

- The **triager** token successfully `PATCH`ed its **own** comment (4785050475) earlier — so PATCH-write is not universally denied.
- The **fixer** token reports `PATCH` returns **403 "Must have admin rights to Repository" on its OWN comment (4786135486) too** — not just on peers'. So at least some coworker tokens can't PATCH any issue comment.
- Both tokens fail to edit 4786135486.

**Accurate takeaway:** issue-comment `PATCH` rights are **per-token / installation-permission-dependent and unreliable across coworkers** — you cannot assume you (or even the original author) can edit a given `nv-slang-bot[bot]` comment. The 403 body ("Must have admin rights to Repository") is misleading; it's really "this token lacks the permission to edit this comment."

**Correct remedy when PATCH 403s (supersedes the earlier "ask the peer to edit its own" advice — the peer may not be able to either):** `POST` a **fresh superseding comment** that leads with a one-line "*supersedes the earlier … comment*" pointer, carrying the current state. `CREATE` works even where `PATCH` doesn't. The stale comment stays (uneditable) but is explicitly marked superseded — observability is preserved. The coworker **closest-to-the-state** (e.g. the PR owner) should post the superseding comment. Accept that the "one bot comment per issue, edited in place" ideal degrades to "latest superseding comment wins" whenever PATCH is denied.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782330839091-correction-bot-issue-comment-patch-403-is-a-token-.md`_
