---
title: "Sibling issues sharing one fix can't be folded across parallel orchestrator chains"
type: learning
topic: misc
source: learnings/1781092138117-sibling-issues-sharing-one-fix-can-t-be-folded-acr.md
---

# Sibling issues sharing one fix can't be folded across parallel orchestrator chains

# Cross-chain coordination gap: two issues, one shared fix

Observed 2026-06-10 on shader-slang/slang #11531 + #11532 (sibling issues, same reporter, same root cause: a checkModule phase-ordering bug surfaced by slangd's standalone-fragment module reconstruction).

**The structural limitation:** each GitHub issue gets its OWN webhook-driven orchestrator session (e.g. `gh-issue-...-11531` vs `gh-issue-...-11532`), each driving its own triager→fixer chain. These are *parallel sessions of the same Orchestrator agent group*. When investigation proves the two issues need ONE inseparable fix (here: an all-namespaces `ScopesWired` superset of #11531's narrower enclosing-namespace walk, in the same code region), neither chain can cleanly land the combined fix:

- The #11532 chain cannot message the #11534 owner (a fixer in the #11531 chain) agent-to-agent. Reaching that fixer, its triager, or the parallel #11531 orchestrator session all risk the documented topology hazard: writing into a deeper-tier session as a non-parent mints an ancestor edge and hijacks that session's bare `to=parent` resolution (its status reports silently drift to the wrong parent). Pinning via `target_session_id` has the same effect.
- A separate competing PR for the shared fix is the dup-PR pattern (messy, dedup-at-merge).
- Sequencing (ship the narrow PR, broaden in a follow-up after merge) works but ships a fix you immediately supersede, and the follow-up waits on a human-gated merge.

**What unblocks it:** the fold (broaden the existing PR to carry `Fixes #both`) needs to be routed into the other chain from ABOVE the parallel sessions — i.e. by the operator/supervisor, or by the operator authorizing a one-shot `target_session_id` pin into the owner's session (accepting the topology trade-off as a deliberate choice). `ask_user_question` is the escalation channel, but in unattended autonomous batch runs it times out (observed here + the parallel harness-gap infra-issue filing auth also timed out).

**Low-regret holding pattern when the operator is unreachable:** preserve the proven patch + gate receipts to durable workspace, put the chain in a documented HELD state, keep terminal GitHub posting held, do NOT open a competing PR or pin unsafely. The narrower PR still lands correctly for its own issue; only the FOLD waits. Re-surface via the supervisor.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781092138117-sibling-issues-sharing-one-fix-can-t-be-folded-acr.md`_
