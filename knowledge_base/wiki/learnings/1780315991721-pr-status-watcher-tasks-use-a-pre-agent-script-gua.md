---
title: "PR/status watcher tasks: use a pre-agent script guard with a state file, not a per-fire agent poll"
type: learning
topic: misc
source: learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md
---

# PR/status watcher tasks: use a pre-agent script guard with a state file, not a per-fire agent poll

**Problem:** A `schedule_task` PR-watcher whose *agent prompt* does "poll → compare → end turn silently if unchanged" still **wakes a full agent session on every fire**, and any stray scratchpad/ack output leaks toward wired peers, waking *their* sessions too. Witnessed on shader-slang/slang #11379 (2026-06-01): a 30-min watcher emitted "(holding)"/"(no message)"/"no-change" pings into the triage agent's session for ~2 hours. Conversation-level correctives don't stick because each fire (esp. with `new_session=true`) is a fresh session that never saw the correction.

**Fix:** Put the change-detection in the task's `script` parameter (the pre-agent guard), not the prompt. The script polls, compares against a state file on disk, and emits `{"wakeAgent": false}` when unchanged — the agent never runs on a no-op fire. Only a real delta sets `{"wakeAgent": true, "data": {...}}`.

```bash
CUR=$(gh pr view <N> --repo <owner/repo> --json state,isDraft,reviewDecision,reviews,comments,statusCheckRollup 2>/dev/null \
  | jq -c '{state,isDraft,reviewDecision,nReviews:((.reviews//[])|length),nComments:((.comments//[])|length),ciFailed:([.statusCheckRollup[]?.conclusion]|map(select(.=="FAILURE" or .=="CANCELLED" or .=="TIMED_OUT" or .=="ACTION_REQUIRED" or .=="STARTUP_FAILURE"))|length>0)}' 2>/dev/null)
[ -z "$CUR" ] && { echo '{"wakeAgent": false}'; exit 0; }   # transient gh/jq error → no wake
PREV=$(cat /workspace/agent/pr-watch-<N>.state 2>/dev/null || echo "")
if [ "$CUR" = "$PREV" ]; then echo '{"wakeAgent": false}';
else printf '%s' "$CUR" > /workspace/agent/pr-watch-<N>.state; echo "{\"wakeAgent\": true, \"data\": {\"prev\": ${PREV:-null}, \"cur\": $CUR}}"; fi
```

**Gotchas learned the hard way:**
- **Do NOT include `mergeStateStatus` in the comparison key.** GitHub computes mergeability lazily; back-to-back polls flap `UNKNOWN`→`BEHIND`→`CLEAN` with no real change, re-introducing the spurious-wake loop. The substantive signals are fully covered by state / isDraft / reviewDecision / review+comment counts / a `ciFailed` boolean.
- **Pre-seed the state file** with current state right after creating the task, so the very first scheduled fire doesn't wake on `prev=null`.
- **Treat empty `gh` output (API blip) as no-wake**, never as a change — otherwise a transient failure fires the agent.
- **`new_session=true`** is correct here: each fire is cheap and all state lives in the file, so no cross-fire memory is needed.
- The agent prompt then only handles the woken case (report the substantive one-liner to parent, or run the REQUEST_CHANGES edit→verify→push path, or GC on close/merge). It must NEVER emit "no change"/"holding"/heartbeat text.

This is the general pattern for any recurring watcher (PR review, CI, issue activity): detection in the script guard, action in the prompt.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md`_
