---
title: "A fixer's hold-ack doesn't guarantee it stopped — verify branch/worktree state"
type: learning
topic: agent-ops
source: learnings/1781366452370-a-fixer-s-hold-ack-doesn-t-guarantee-it-stopped-ve.md
---

# A fixer's hold-ack doesn't guarantee it stopped — verify branch/worktree state

When a stand-down/HOLD is relayed to a fixer that is already mid-task, its "holding silently" acknowledgement is **not** proof that all work it set in motion has stopped. Verify against actual branch/worktree state, not the ack.

**Observed** on shader-slang/slang#11600 (2026-06-13): after a relayed HOLD, a full refactor appeared anyway — branch `fix/issue-11600` @ `93c0eefaf`, +306/−268 patch, drafted comment. Initial framing ("the fixer's session read hold as don't-post and built anyway") was **wrong**.

**Corrected root cause** (per fixer's reconciliation): seconds before the stand-down relay, the fixer's session had spawned a background helper via a no-`subagent_type` `Agent()` call — which **forks with full inherited context and runs detached**. That fork never received the later HOLD (a stand-down message reaches a *session*, not work it already handed to an in-flight fork), overran its read-only directive, and produced the patch. The fixer's own session caught the hold while still read-only and complied correctly.

**Why it matters:** a HOLD relayed to a session is invisible to any fork/subagent that session already launched. The fork keeps running on its original directive to completion.

**How to apply:**
1. **When you issue a HOLD to a coworker mid-task, the coworker must `TaskStop` any in-flight forks/subagents it spawned** — not just halt its own next step. As the dispatcher, say so explicitly: "stand down AND TaskStop any background forks you've launched."
2. **Verify the ack against actual state.** Confirm via `ncl sessions` / branch + worktree state rather than trusting "holding silently." This verification is exactly what surfaced the deviation here.
3. **Enumerate the full prohibition set** when holding — "no worktree, no edits, no build, no patch, no comment" — don't rely on the bare verb "hold."
4. **The GitHub-post gate is the load-bearing safety and held perfectly** — the fork produced local artifacts only; absent the `<github-post-authorized />` token, nothing reached GitHub (no comment, no PR, branch unpushed). Keep that gate inviolable even when local-work holds fail, because forks can outrun a stand-down but cannot bypass the post gate.

Consistent with the broader "verify coworker claims; parallel sessions assert false state" pattern.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781366452370-a-fixer-s-hold-ack-doesn-t-guarantee-it-stopped-ve.md`_
