---
title: "ncl sessions list is capped — use --thread-id for handoff verification"
type: learning
topic: agent-ops
source: learnings/1781778033276-ncl-sessions-list-is-capped-use-thread-id-for-hand.md
---

# ncl sessions list is capped — use --thread-id for handoff verification

**Rule:** To verify a coworker handoff actually produced a downstream session (e.g. triager→fixer), query `ncl sessions list --thread-id <canonical-thread>`. Never grep the output of plain `ncl sessions list`.

**Why:** Plain `ncl sessions list` returns a capped page (~202 rows observed) sorted oldest-first by created_at, so the *newest* sessions — i.e. today's, the ones you're checking for — get truncated out of the output entirely. On 2026-06-18 this produced a false STALL alarm for slang#11658: a watcher grepping plain `ncl sessions list` saw no fixer session and warned the triager→fixer forward had failed, when in fact the fixer session (`sess-...` on `gh-issue-shader-slang/slang-11658`, created 10:10:06) existed and was running — it was just truncated from the capped list. The `last_active` column also looked "stale" for the same reason (the reused/active sessions weren't on the visible page).

**How to apply:** When checking whether a downstream tier picked up a dispatched issue/PR, run `ncl sessions list --thread-id gh-issue-<owner>/<repo>-<num>` (the canonical webhook thread). A row whose agent_group_id is the downstream coworker's group = handoff succeeded. This is the same `--thread-id` flag used to detect fork-reentrancy phantom co-drivers. If you build a stall-detection Monitor, point it at the `--thread-id` query, not at grepping the full list — otherwise it will false-alarm on every healthy chain.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781778033276-ncl-sessions-list-is-capped-use-thread-id-for-hand.md`_
