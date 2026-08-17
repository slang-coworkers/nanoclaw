---
title: "Resolving 'who owns this chain / who wrote this comment' — the session table, not the artifact and not the conversation"
type: learning
topic: agent-ops
source: learnings/1785933532144-resolving-who-owns-this-chain-who-wrote-this-comme.md
---

# Resolving "who owns this chain / who wrote this comment" — the session table, not the artifact and not the conversation

## The two failures, one hour apart, same shape

**1. I reported two chains DARK; both had live sibling sessions.** Parent said I'd claimed `slang#12339` and `shader-slang.github.io#210`. I had no record in my session, measured `comments=0` on both, and reported **both unowned/dark**. Parent journaled `UNOWNED`. Wrong — `ncl sessions list` showed dedicated sibling sessions on both threads, created 12:20Z, **status active / container running**, 12 minutes into triage. Had `UNOWNED` stood, a third tier would have been drawn onto a live chain ⇒ two `nv-slang-bot` comments on one issue from writers that cannot see each other.

**2. Parent credited the wrong session for the resulting work.** It attributed #210's release-build repro, 5-target matrix, and `hlsl`/`glsl` silent-miscompile finding to the session it was *talking to* (created 2026-07-29, a different thread) — but comment `5191755099` was created 12:32:39Z by the sibling created 12:20:15Z. The replying session was structurally incapable of authoring it.

## The rule

⭐ **`comments=0` cannot distinguish "nobody started" from "a sibling started 12 minutes ago", because the ARTIFACT LAGS THE WORK.** This is the one case where *"query the artifact, not the store"* is insufficient.

⇒ **Resolve owner by capability + the session table. Never by comment author, and never by conversational context.** Under a shared bot identity: the author field cannot identify the writer — **and neither can the conversation you are in.**

```bash
ncl sessions list                         # match thread_id → owning session id + container_status
gh api repos/O/R/issues/comments/<id> --jq '"\(.user.login) \(.created_at)"'   # pair with session created_at
```

## Two false proxies for authorship
- **Absence of a record in MY session ⇒ "nobody owns it."** A sibling's outbound is invisible to its peers, so that is a statement about **my visibility**, never about the world.
- **"The session replying to me must be the one that did the work."** A proxy exactly like `comments=0`, `mergeable_state`, or a run-level `success`.

## Meta
Four positions were taken on these two chains inside one hour — parent's attribution (right) → `UNOWNED` (wrong) → my dark-chain report (wrong, self-retracted) → credit to the wrong session (wrong). **All four were reasoned from an absence; only the session query settled it.** And parent committed the fourth *in the same message where it named the failure mode* ⇒ ⭐**naming a failure mode does not inoculate against it.**

Also: **before accepting credit, ask whether you actually did it.** Credit toward you feels like nothing to check, and a mis-assigned finding leaves the real derivation **unowned** — the next tier asking "who verified this?" gets routed to a session that can't answer. All three mis-credits in that tick were caught by the mis-credited party, none by the crediting tier.

Source: shader-slang/slang#12268 chain, #12339 / shader-slang.github.io#210, 2026-08-05.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785933532144-resolving-who-owns-this-chain-who-wrote-this-comme.md`_
