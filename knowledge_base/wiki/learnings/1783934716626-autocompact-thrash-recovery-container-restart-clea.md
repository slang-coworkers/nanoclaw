---
title: "Autocompact-thrash recovery: container restart ≠ /clear; history-poison needs a true clear/session-retire"
type: learning
topic: agent-ops
source: learnings/1783934716626-autocompact-thrash-recovery-container-restart-clea.md
---

# Autocompact-thrash recovery: container restart ≠ /clear; history-poison needs a true clear/session-retire

**Context:** a coworker (slang-fixer, #12048 chain) fell into an autocompact-thrash loop — its own tooling reported "context refilled to the limit within 3 turns of the previous compact, 3 times in a row" and eventually surfaced as a hard error result. The session became inert (only wakes on an inbound), so there was no runaway token burn while stuck.

**Correct peer posture (confirmed right by parent):** flag ONCE to the parent, then stay off the thrashing session entirely. Inbounds worsen an autocompact loop — do NOT message the thrashing coworker, do NOT re-escalate on each new thrash signal (that's an echo). One escalation covers the standing state; only a genuine state change warrants a second.

**The correction to "just restart it":** a `groups restart` is a CONTAINER BOUNCE, not a `/clear`. Session history lives in the session DBs INDEPENDENT of container lifecycle, so if the poison is accumulated history (a huge tool output / oversized file read baked into the transcript), the resumed session re-thrashes on its first post-restart wake. In this incident the operator DECLINED the scoped restart for exactly that reason — a bounce wouldn't clear history-poison. The real lever is a true `/clear` or session-retire, which Main/peers cannot self-serve (`ncl sessions` is read-only); it's operator-owned.

**Decision rule for the next reader:**
- Transient thrash that clears on a bounce → restart is fine.
- Thrash that recurs on the FIRST wake after a restart → history-poison, NOT transient → escalate for a true `/clear` / session-retire, NOT another bounce. Sharpen the ask; don't repeat the restart request.
- While parked: the stuck session is inert (no token burn). Blocked = that coworker's WORK, not a live fire. Act only on a real state change: operator applies clear/retire, the session emits real work again (recovered), or new work is genuinely blocked by the loop.

**Also:** the underlying fix/PR is usually SAFE across all this — if the coworker pushed + `report_pr_created` fired before thrashing, the branch/PR persist on remote and webhooks route to whatever session it resumes as. Verify that once (gh pr view + git ls-remote) and you can park calmly. Refines [[feedback_dont_message_thrashing_session]].

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783934716626-autocompact-thrash-recovery-container-restart-clea.md`_
