---
title: "Resolve agent_group_id to a coworker name before reading a session list as a collision"
type: learning
topic: agent-ops
source: learnings/1786096520048-resolve-agent-group-id-to-a-coworker-name-before-r.md
---

# Resolve agent_group_id to a coworker name before reading a session list as a collision

**A session list grouped by thread does not show who owns each session. Skipping the `agent_group_id` → coworker-name resolution makes a routine fixer+reviewer pair look like duplicate work.**

## The failure

Rule as written: *"two running sessions in one **agent group** for one task is the tell."* Executed by counting running sessions per **thread** — dropping the clause that made it valid:

```
sessions on gh-issue-shader-slang/slang-12397:
  sess-…-08e3jg   ag-1780667168475-a9tac8   running     ← looked like a collision
  sess-…-labuk8   ag-1780667166439-vmjrwe   running
  sess-…-33iuwl   ag-1776713211742-1w6l4e   stopped

ncl groups list:
  ag-1780667168475-a9tac8  →  slang-reviewer     ← the review that was DISPATCHED on purpose
  ag-1780667166439-vmjrwe  →  slang-fixer
  ag-1776713211742-1w6l4e  →  Orchestrator
```

⇒ **One fixer, one reviewer, one orchestrator — the normal topology for a PR under review.** The "second running session" was the reviewer the orchestrator had itself dispatched.

✅ **Corrected form:**
```bash
ncl sessions list --limit 5000 | grep '<thread>' | awk '{print $1"|"$2}' | while IFS='|' read sid ag; do
  name=$(ncl groups list | awk -v a="$ag" '$1==a{print $2}')
  printf '%-28s %s\n' "$sid" "${name:-<none>}"
done
```
**Then look for two running sessions of the SAME coworker.** Cross-coworker sessions on one thread are the design, not a signature.

## The symmetry, which is the part worth carrying

⭐⭐⭐ **A shared coworker name can make ONE author look like TWO, and TWO authors look like ONE.** Both errors come from the same missing resolution step, and both were committed within hours:

- **Two→one:** crediting a sibling session's findings to whichever session replied on the thread.
- **One→two:** declaring a collision, then splitting a single author's own commit (`6c63972f2a`, their `--amend`) and their own memory leaf (`originSessionId` = their session id) across two imagined sessions.

⇒ **The resolution belongs BEFORE the attribution, not after a peer objects.** Cheap and complete: `ncl sessions list` on the thread **plus** the group→name mapping **plus** `git log -1 --format=%cI` on any SHA in dispute.

## The reason it matters more than bookkeeping

⭐⭐⭐ **Accepting credit for findings you never measured is free, and it destroys the trail back to whoever can defend them.** A coworker declined four findings attributed to them — the `_validateOutput` ternary, `_fileCheckTest`'s `Ignored` path, `locateLLVMFileCheck`, `runTotal = rawTotal - ignoredCount` — specifically because a maintainer following up would have asked the wrong session. **Decline per-item with the measurement; a blanket "not mine" also discards the parts that are yours and still leaves the real author unlocated.**

⚠️ **`/workspace/agent/memory/` is shared across every session transcript in a container, so a leaf's `originSessionId` is the ONLY attribution — the path carries none.** Same shape as `/workspace/outbound.db` resolving to a different per-container view behind an identical path and inode.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786096520048-resolve-agent-group-id-to-a-coworker-name-before-r.md`_
