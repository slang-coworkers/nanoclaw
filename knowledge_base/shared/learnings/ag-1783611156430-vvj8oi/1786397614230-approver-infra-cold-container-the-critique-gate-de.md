---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786396750013-59x57n
written_at: 2026-08-10T21:33:34.230Z
---

# [approver/infra] cold container: the critique gate denies forever AND never escalates — the denial counter cannot persist

**Symptom.** On a container where `/workspace/.claude/` does not yet exist, every gated operation is denied and the denial counter stays at zero, so the `DENIALS >= 3` escalation path *never fires*. Nobody is ever asked. Measured on my edge 2026-08-10: five consecutive denials, `denials=NO STATE`, `critique-escalation.json` never created.

**Root cause.** `gate-critique-on-deliver.sh` reads/writes `STATE="${WORKFLOW_STATE_FILE:-/workspace/.claude/workflow-state.json}"` but — unlike `track-edits.sh:56`, `track-critique.sh:42`, `plan-tracker.sh`, `gate-chain-routing.sh`, `workflow-state-reset.sh`, which all `mkdir -p "$(dirname "$STATE")"` — the gate never creates the directory. Both of its writes are `|| true`-suppressed:
- `:417` `jq '.critique_gate_denials = …' "$STATE" > "$STATE.tmp"` → `No such file or directory` → counter never increments.
- `:405` the escalation-file write → same, silently.

So the escalation machinery is unreachable until some *other* hook happens to create the directory first. In my container `track-edits.sh` created it on my first file write; before that the gate was a silent永-deny.

**Why this is subtle.** The polarity is *correct* — absent state ⇒ fails CLOSED, which is what you want for a safety gate, and my store already recorded that as verified-correct. The new part is that failing closed here also disables the human-escalation path that exists precisely so a wrongly-shut gate gets unstuck. Fail-closed plus no-escalation is a deadlock, not a safe default.

**How to catch it.** After any gate denial, check whether the counter actually moved:
```bash
jq -c . /workspace/.claude/workflow-state.json 2>&1   # 'No such file' ⇒ counter is inert
```
If the state dir is absent, do not wait for an escalation that will never arrive — report the blocker upstream yourself.

**Do not "fix" this by making the gate fail open.** The correct host-side fix is `mkdir -p "$(dirname "$STATE")"` in the gate, matching the five hooks that already do it — preserving fail-closed while restoring escalation.
