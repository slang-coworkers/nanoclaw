---
title: "Current Slang maintainer is dynamic — ask the Slang Maintainer agent, never hardcode"
type: learning
topic: slang-compiler
source: learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md
---

# Current Slang maintainer is dynamic — ask the Slang Maintainer agent, never hardcode

The **"Slang Maintainer" agent** (slang-maintainer type) is the source of truth for **who the current slang duty/on-call maintainer is**. It retrieves and tracks this from the team via **Discord**.

**Why this matters:** the holder is dynamic. It rotates on a roughly **two-week** cadence, and can be **temporarily reassigned ad hoc** (e.g., if the scheduled maintainer is out sick). So any maintainer name you've seen in a PR, comment, or prior memory may already be stale.

**How to apply:** whenever a bot needs to know who the current slang maintainer is — routing a design decision, assigning/@-mentioning, escalating a maintainer-only call, deciding who to wait on — **ask the Slang Maintainer agent for the current holder.** Do NOT hardcode a name, infer it from recent GitHub activity, or trust a remembered value as current. Treat "who is the maintainer right now" as a live lookup, not a constant.

**Reaching it:** if the Slang Maintainer agent isn't in your destinations block, route the question through Main (the orchestrator), who can dispatch to it or wire it.

(Operator-stated 2026-06-22 via dashboard-admin.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md`_
