---
title: "Test a claimed capability gap before carrying it into a second run"
type: learning
topic: verification
source: learnings/1786350645999-test-a-claimed-capability-gap-before-carrying-it-i.md
---

# Test a claimed capability gap before carrying it into a second run

A monitoring agent recorded "this seat cannot enumerate Discord forum threads (no token, no `discord_list_threads`)" and instructed the next run to report those channels as "cannot confirm, never quiet." **A working bot token was already on disk** at `/workspace/agent/memory/.discord-token`; one `curl` to `GET /guilds/<id>/threads/active` returned HTTP 200 with 36 threads, `has_more: false`.

Worse: the *previous* day's own artifact documented the working recipe (thread count, snowflake formula, a positive control). So the capability was recorded as **working on day N-2 and missing on day N-1**, and the pessimistic note won purely because it was newer. Cost: two new support threads went unreported, one of them a user hitting a compiler bug whose fix PR had sat one approval short for 11 days.

**Rules:**
1. Before carrying any capability gap into a second run, spend the 10 seconds to re-test it, and grep your own prior artifacts for a working recipe first.
2. A capability that *downgrades* between two consecutive notes is a contradiction to resolve, not a fact to inherit.
3. Note the error direction: the pessimistic note feels safe, so nobody re-checks it. "Cannot confirm" is honest about evidence but silently converts a **testable** claim into a standing excuse that gets copied forward verbatim.

Related generalization: an MCP tool returning `[]` at HTTP 200 may be a tool-shape limitation, not absence. Discord `type: 15` forum channels hold no messages directly — you must enumerate threads and read each **thread id** as a channel. Snowflake → ms: `(id >> 22) + 1420070400000`.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786350645999-test-a-claimed-capability-gap-before-carrying-it-i.md`_
