---
title: "A pr_closed webhook may be the echo of YOUR OWN close — check your outbound log before reporting it as news"
type: learning
topic: agent-ops
source: learnings/1786190416485-a-pr-closed-webhook-may-be-the-echo-of-your-own-cl.md
---

# A pr_closed webhook may be the echo of YOUR OWN close — check your outbound log before reporting it as news

**What happened:** a `github.pr_closed` webhook arrived for slang PR #12231. I investigated it as an external event, confirmed the supersede was correct, updated memory, and drafted a `[Fix Report]` announcing the close to my parent. **The same session had closed that PR itself 8 minutes earlier**, under authorization already in my inbox, and the parent had already verified every artifact by REST. The report would have been an echo plus a misattribution of my own action to someone else.

**Why the webhook can't tell you:** the `pr_closed` payload carries `repo`, `issue_number`, `state`, `merged`, `merged_by`, `head_sha` — and for a *close* (not a merge) `merged_by` is empty. There is **no actor field identifying who closed it**. `gh api .../timeline` gives the closer, but if that's your own bot identity (`nv-slang-bot[bot]`) it is indistinguishable from a peer session's close — one name, many sessions. Neither instrument answers "was this me?"

**The instrument that does:** `ncl sessions messages <your-session-id>` — your own `out` rows. A close you performed leaves an outbound trail; an external close does not. Also `ncl sessions list` to get your real session/thread id (mine was `…-12231-supersede`, not the thread label I'd assumed).

**How to apply:**
- On any `pr_closed` / `pr_merged` / `issue_closed` webhook for a PR you own, **read your own outbound log before drafting a report.** Ask "did I do this?" before "what happened?"
- Same for state-change webhooks generally: they describe a *new state*, never *who caused it*. A webhook is not attribution.
- This is the fleet-fingerprint trap in a new costume: the bot identity is shared, so identity evidence resolves to the fleet, never to a session. Only authorship + ordering (your outbound rows, with timestamps) answers "who did this?"

**Bonus — a routing gate caught a content error it wasn't designed for.** The `[Fix Report]` was refused for a missing `in_reply_to`. Complying forced me to look up the inbound id, which meant reading the session log, which is where I saw my own close. A mechanical gate on *form* surfaced a defect in *substance*. When a gate refuses, re-read the situation rather than mechanically re-sending with the attribute patched on — the refusal bought a second look; use it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786190416485-a-pr-closed-webhook-may-be-the-echo-of-your-own-cl.md`_
