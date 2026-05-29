---
name: supervise-issues
license: MIT
description: Periodic supervisor for in-flight GitHub issue chains. Lists active issue sessions, computes stuck-time, nudges silent chains, surfaces blockers to operator via ask_user_question. Designed to be self-scheduled via schedule_task on a 30-minute cron.
---

# /supervise-issues — Issue chain supervisor

You are the orchestrator (or a coworker the orchestrator delegated supervision to). Walk all in-flight issue chains, identify stuck ones, and nudge or escalate as appropriate. Designed to run on a recurring `schedule_task` (suggested cron: `*/30 * * * *` — every 30 minutes during work hours).

## What "in-flight" means

An issue chain is in-flight if you (the orchestrator) have a session whose `thread_id` matches `gh-issue-<owner>/<repo>-<num>` and the issue is still open on GitHub with no merged PR.

## Procedure

### 1. Build the status table

Query your inbound for every active issue thread:

```bash
ncl sessions list --thread-prefix "gh-issue-" --json
```

For each session, also pull the most recent activity (last inbound + last outbound timestamp). The session DBs have these directly; ask via `ncl sessions messages --id <sess> --limit 1` if needed.

Build a table of: `repo` / `issue` / `thread_id` / `last_activity_at` / `state` (one of `dispatched` / `triaging` / `fixing` / `reviewing` / `pr_open` / `awaiting_human` / `silent`).

### 2. Classify each row

- **`dispatched` < 5 min ago** → fresh, leave alone.
- **`triaging` / `fixing` / `reviewing` / `pr_open` < 60 min since last activity** → working, leave alone.
- **`awaiting_human`** (a pending `ask_user_question` exists for this thread) → leave alone, it's blocked on the operator.
- **`silent` ≥ 60 min** → stuck. Investigate: is the assigned coworker's container running? Did the last message they sent get a response? Did they emit a [Refusal] or [not actionable] outcome? If the chain was dropped without a closing report, that's the bug — re-prompt the deepest tier with a soft nudge.
- **`silent` ≥ 4 hours** → escalate to operator via `ask_user_question` with options: "extend deadline" / "re-dispatch from triage" / "close chain (out of scope)" / "abandon (won't fix)". Use `timeout: 0` — there is no good fallback.

### 3. Nudges

A nudge is a message back into the assigned coworker's session, not a fresh dispatch. Use `in_reply_to` of the LAST inbound the coworker received. Body shape:

> [Supervisor nudge — gh-issue-X/Y-N] No outbound for {duration}. Are you blocked? Reply with: status, blocker, ETA. If your container restarted and you lost context, re-read your `/workspace/agent/memory/triage-{N}.md` (or analogous) and resume.

Don't open new threads. Don't escalate to the operator without first nudging — most "silent" cases are containers that exited mid-task and need a wake.

### 4. Closing-report enforcement

If you find a chain whose deepest tier emitted `[Resolution] / [Report]` more than 30 min ago but no upstream tier rolled it up, send a peer message to the missing tier asking them to roll up. Do not roll up on their behalf.

### 5. Output

After processing all chains, send a single status report to your parent (the operator if you are top-of-chain) using the standard 5-bullet shape:

- **Status:** {n} chains in flight, {nudged} nudged, {escalated} escalated to operator
- **Link:** dashboard timeline filtered to gh-issue-* threads
- **Verdict:** healthy / degraded / blocked
- **Next-action:** wait for cron / await operator decisions / re-dispatch chain X
- **Blocker:** {threads with no clear path forward, list 3 max with one-line reason each}

The narrative table goes in a file via `send_file(to="parent")` — do not embed in the chat bubble. The dashboard renders the file as an attachment.

## Scheduling

On first run, schedule yourself:

```js
schedule_task({
  prompt: "/supervise-issues",
  cron: "*/30 9-21 * * *",       // every 30 min, 9am-9pm local
  script: `node --input-type=module -e "
    // Skip the wake when no thread_id starting with gh-issue-* has activity
    // older than 60 min. Cheap heuristic — full scan happens in the prompt.
    const r = await fetch('http://172.17.0.1:3000/api/sessions/in-flight', {
      headers: { 'X-Internal': '1' },
    }).catch(() => null);
    if (!r || !r.ok) { console.log(JSON.stringify({wakeAgent: true})); process.exit(0); }
    const sessions = await r.json();
    const now = Date.now();
    const stale = sessions.filter(s =>
      s.threadId?.startsWith('gh-issue-') &&
      now - new Date(s.lastActiveAt || 0).getTime() > 60 * 60 * 1000
    );
    console.log(JSON.stringify({ wakeAgent: stale.length > 0, data: { stale: stale.length } }));
  "`,
});
```

The script gates the wake — when no chains are stuck, the cron tick is a no-op (no API credits burned).

## Anti-patterns

- **Don't summarize history.** The supervisor reports CURRENT state. Past activity is in the dashboard / JSONLs.
- **Don't open new chains.** You only nudge existing ones. New chains come from webhooks.
- **Don't escalate before nudging.** Most stuck chains resume from a single nudge; escalation costs the operator's attention.
- **Don't multi-cast.** A nudge goes to one coworker (the one currently expected to respond), not the whole chain.
- **Don't loop.** If a chain has been nudged twice with no response, escalate — don't keep nudging.

## State

Track which chains you've nudged and how many times in `/workspace/agent/memory/supervisor-state.json` (load at start, save at end). Same key per chain: `{threadId: {nudgedAt: [iso, iso, ...], escalatedAt: iso, lastObservedActivity: iso}}`.

## When called manually

If invoked outside the cron (operator typed `/supervise-issues`), do the same scan but report ALL chains regardless of staleness — operator wants the full picture.
