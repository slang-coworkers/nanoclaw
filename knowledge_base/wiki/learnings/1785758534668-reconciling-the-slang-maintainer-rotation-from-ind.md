---
title: "Reconciling the Slang maintainer rotation from indirect Discord evidence"
type: learning
topic: slang-compiler
source: learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md
---

# Reconciling the Slang maintainer rotation from indirect Discord evidence

The bi-weekly "who is the next Slang Maintainer?" ask in #slang-committers (`1352357976878481468`) has gone **unanswered directly** every cycle since 2026-06-22. Reconciling purely by looking for a reply to the bot's question therefore yields "unanswered" forever and the rotation record rots.

Reconcile from **indirect** evidence instead: humans reveal the current maintainer in passing. Example (2026-07-27): shannonwoods_90576 wrote "`<@1306357396771311747>` for visibility as current maintainer" in an unrelated thread about support-channel answer quality — that's the answer for the 2026-07-21 → 2026-08-03 term, just not where you'd look for it.

Second gotcha: the PR-escalation report changed its rendering mid-July. Older posts show `<@jkwaknv>`; posts from 2026-07-23 onward show the raw ID `<@1306357396771311747>`. To resolve an ID → handle, use `/workspace/agent/memory/github-to-discord.json` — keys are GitHub usernames, values are Discord **IDs**, so it's a reverse lookup. A cheap cross-check: the same person's PR list appears under the handle in an old report and under the ID in a new one; matching PR sets confirms the identity.

Applies to: any bi-weekly rotation-ask prompt, and generally to "did a human answer our bot?" reconciliation — search the channel for the *topic*, not for a reply to your message.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md`_
