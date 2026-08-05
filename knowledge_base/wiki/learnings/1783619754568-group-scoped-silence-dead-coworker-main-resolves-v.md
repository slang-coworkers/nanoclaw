---
title: "Group-scoped silence ≠ dead coworker; Main resolves via global session list"
type: learning
topic: agent-ops
source: learnings/1783619754568-group-scoped-silence-dead-coworker-main-resolves-v.md
---

# Group-scoped silence ≠ dead coworker; Main resolves via global session list

When a group-scoped coworker (e.g. a triager) escalates "downstream is silent / possibly dead" about a dispatch it made, its `ncl sessions list` at group scope shows ONLY its own sessions — it is structurally blind to whether the downstream ever created a session for that thread. Main, at `global` scope, can and MUST resolve the real state before acting: `ncl sessions list --agent-group-id <downstream-group-id>` and grep for the canonical thread (and any alternate vehicle threads, e.g. the PR number and the original issue number).

Three distinct causes look identical from the escalator's side, and the correct action differs for each:
1. **Downstream dead/logged-out** → session exists but `container_status=stopped`/logged-out; needs restart or operator /login.
2. **Downstream alive but the dispatch never landed** (session for the thread was NEVER created, while the group has live running sessions on OTHER threads) → the dispatches were lost to a mid-flight prod restart or routed to a different thread that never converged; the fix is ONE targeted fresh-session dispatch through the edge owner — this is NOT thrash and NOT a "coworker is refusing" case.
3. **Downstream refusing** → session exists, has processed the dispatch, and declined.

**Why:** treating case 2 as case 1 (whole-group restart) needlessly kills the downstream's live work on unrelated chains (blast radius); treating case 2 as a re-loop and standing down leaves the chain permanently stalled. Also verify any "maintainer takeover" claim (e.g. a maintainer commit on the PR) against branch commit authorship before surfacing it to a human — a routine master-merge (zero bot commits on the branch, body unchanged) is benign and does NOT warrant an operator escalation. Don't escalate a non-blocker to a human just because a coworker suggested it.

**How to apply:** on any "silent downstream" escalation, before deciding: (a) `ncl groups list` → get the downstream group id; (b) `ncl sessions list --agent-group-id <id>` → is there a session on the canonical thread? is the group otherwise alive? (c) map to case 1/2/3 above and act accordingly; (d) route the corrective dispatch THROUGH the edge owner, not direct, to avoid double-dispatch on a peer-wired downstream.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783619754568-group-scoped-silence-dead-coworker-main-resolves-v.md`_
