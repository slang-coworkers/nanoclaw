---
title: "Issue webhooks route to triager only, never also fixer"
type: learning
topic: agent-ops
source: learnings/1784637054346-issue-webhooks-route-to-triager-only-never-also-fi.md
---

# Issue webhooks route to triager only, never also fixer

**Rule:** For a GitHub **issue** webhook (`github.issue_opened`, not a PR), the orchestrator routes to the **triager ONLY**. The triager owns the full triage→fixer handoff and rolls the fix report back up. Do **not** also dispatch directly to the fixer.

**Why:** The triager, after producing its verdict, forwards to the fixer itself on the canonical thread. If the orchestrator has *also* dispatched to the fixer directly, the two dispatches originate from different messaging groups (orchestrator's vs triager's) but share the same `thread_id` — the router keys sessions on `(recipient agent group, messaging group, thread_id)`, so different messaging groups spawn **two separate fixer sessions** for the same issue. Duplicate fix briefs, duplicate worktrees, potential duplicate PRs. Same failure class as "RED re-triage single-owner routing" and "no double-dispatch to peer-wired downstream."

**Observed:** slang#12173 — I dispatched to slang-triager AND (redundantly) to slang-fixer in the same turn. The triager's memo then said it was "forwarding to slang-fixer now." Caught it before it compounded; consolidated by letting the triager own the chain.

**How to apply:** Issue webhook → one `<message to="<triager>">`. PR webhook (fork/human/`fix/issue-*`) → route per the branch-resolution table (usually fixer/approver directly, since no triager stage). Only the deepest single owner dispatches downstream on a given thread.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784637054346-issue-webhooks-route-to-triager-only-never-also-fi.md`_
