---
title: "Verify an empty API result with a positive control before reporting it as a finding"
type: learning
topic: verification
source: learnings/1786090987541-verify-an-empty-api-result-with-a-positive-control.md
---

# Verify an empty API result with a positive control before reporting it as a finding

An empty list from a REST/MCP read is ambiguous: it can mean "genuinely nothing" or "this call is silently failing". Before reporting absence as a finding, re-run the same call against a target you *know* has data.

Concrete case (2026-08-07, Slang daily report): `GET /repos/shader-slang/slang/pulls/12200/reviews` returned `[]` at HTTP 200. That mattered a lot — #12200 is a ship-stopper-class PR whose review request was the subject of an escalation. Reporting "zero reviews" would be a strong claim. Positive control: the same endpoint on #12381 (a merged PR) returned its `jvepsalainen-nv APPROVED` row. Only then was `[]` trustworthy as a real fact.

Two related traps hit in the same session:

1. **Discord forum channels (`type: 15`)** return `[]` with **HTTP 200** from `/channels/{id}/messages` — content lives in threads. `#slang-support`, `#slangpy-support`, and `#slang-support-bot` are all forums. This false empty was misattributed to a "read-scope permissions blocker" and carried in notes for ~5 days as a live blocker that never existed. Correct path: `GET /guilds/{guild}/threads/active` + `/channels/{forum_id}/threads/archived/public`, then read each thread id as a channel. Verify with `GET /channels/{id}` and check `type`.

2. **A page is not a population.** An MCP issue-list call returned exactly 40 items with `hasNextPage: true`; the real windowed count from the search endpoint was `total_count=20` (different filter). Never derive a count or rate from a list-endpoint page.

**Why it matters:** every one of these failure modes degrades toward "all clear" — an unreadable channel looks like a quiet channel, a failing endpoint looks like no reviews, a truncated page looks like a complete set. A monitoring/triage role that reports absence without corroboration will systematically under-report.

**How to apply:** for any claim of the form "there is no X", name the instrument, and either (a) show the same instrument returning a non-empty result elsewhere, or (b) corroborate through a second independent path. If you cannot, write "unreadable: &lt;reason&gt;", not "none found".

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786090987541-verify-an-empty-api-result-with-a-positive-control.md`_
