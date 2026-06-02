---
name: supervise-issues
license: MIT
description: Periodic supervisor for in-flight GitHub issue chains. Lists active issue sessions, computes stuck-time, nudges silent chains, verifies the human-observability loop (5-bullet GitHub comment present before chain closes), surfaces blockers to operator via ask_user_question. Designed to be self-scheduled via schedule_task on a 30-minute cron.
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

Build a table of: `repo` / `issue` / `thread_id` / `last_activity_at` / `state` (one of `dispatched` / `triaging` / `fixing` / `reviewing` / `pr_open` / `awaiting_human` / `silent` / `closing` / `closed_no_github_comment`).

### 2. Classify each row

- **`dispatched` < 5 min ago** → fresh, leave alone.
- **`triaging` / `fixing` / `reviewing` / `pr_open` < 60 min since last activity** → working, leave alone.
- **`awaiting_human`** (a pending `ask_user_question` exists for this thread) → leave alone, it's blocked on the operator.
- **`silent` ≥ 60 min** → stuck. Investigate: is the assigned coworker's container running? Did the last message they sent get a response? Did they emit a [Refusal] or [not actionable] outcome? If the chain was dropped without a closing report, that's the bug — re-prompt the deepest tier with a soft nudge.
- **`silent` ≥ 4 hours** → escalate to operator via `ask_user_question` with options: "extend deadline" / "re-dispatch from triage" / "close chain (out of scope)" / "abandon (won't fix)". Use `timeout: 0` — there is no good fallback.
- **`closing`** (final `[Report]` emitted, PR opened, or refusal landed) → run **step 5: GitHub-comment verification** before letting the chain drop off the table.
- **`closed_no_github_comment`** (state from step 5) → nudge the responsible coworker to post; if unmet after 2 nudges, escalate.

### 3. Nudges

A nudge is a message back into the assigned coworker's session, not a fresh dispatch. Use `in_reply_to` of the LAST inbound the coworker received. Body shape:

> [Supervisor nudge — gh-issue-X/Y-N] No outbound for {duration}. Are you blocked? Reply with: status, blocker, ETA. If your container restarted and you lost context, re-read your `/workspace/agent/memory/triage-{N}.md` (or analogous) and resume.

Don't open new threads. Don't escalate to the operator without first nudging — most "silent" cases are containers that exited mid-task and need a wake.

**[MUST]** **One `<message>` per chain, on that chain's canonical thread.** Set `thread_id="gh-issue-<owner>/<repo>-<num>"` and `in_reply_to=<latest>` on each block. Never roll N chains into one consolidated dump from a thread-less chat session — thread-less status falls through to the recipient's catch-all and breaks per-tile observability. See `chain-reporting.md` per-issue routing rule.

### 4. Closing-report enforcement

If you find a chain whose deepest tier emitted `[Resolution] / [Report]` more than 30 min ago but no upstream tier rolled it up, send a peer message to the missing tier asking them to roll up. Do not roll up on their behalf.

### 5. GitHub-comment verification (closing the human-observability loop)

Per the `[MUST]` rule in `chain-reporting.md` ("GitHub is the primary human-observability surface"), every chain that reaches a human-visible state — completed, blocked-on-human, refused, handed off — **must** have a 5-bullet markdown comment posted on the originating issue/PR before the chain is treated as closed. The supervisor enforces this.

For each chain you would otherwise classify as `closing` (final `[Report]` emitted, PR opened, refusal, or handoff), check GitHub for the comment **before** allowing the chain to drop off the in-flight table:

```bash
# Pull recent comments on the originating issue/PR via the gh-app token
# (use the per-project *-github skill's posting helper if available;
# otherwise hit the REST API via OneCLI):
curl -sS -H "Authorization: token $GH_APP_TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/issues/<num>/comments?per_page=20" \
  | jq -r '.[] | select(.body | startswith("- **Status:**") or contains("[Report]")) | .id'
```

The existence test: a comment authored by the install's bot account (or the maintainer account the chain is using) whose body starts with the 5-bullet shape (`- **Status:**` … `- **Blocker:**`) OR contains a linked PR (`Fixes #N` / `Closes #N`) that itself carries the rolled-up summary in its description.

**If absent**, the chain is `closed_no_github_comment` — a bug. Take the smaller action first:

1. **Identify the responsible coworker.** Per the closest-to-the-state principle: reviewer for verdicts, fixer for "PR opened", triage for out-of-scope refusal, the deepest tier that produced the verdict otherwise.
2. **Send a nudge to that coworker** (not orchestrator, not parent — the one who holds the state) asking them to post the GitHub comment now. Body shape:

   > [Supervisor — gh-issue-X/Y-N] Chain reached `<state>` but no GitHub comment found on issue/PR. Per the GitHub-as-primary observability rule, post the 5-bullet (status / link / verdict / next-action / blocker) on https://github.com/X/Y/issues/N before this chain closes. Use your `<project>-github` skill or the gh-app token via OneCLI proxy. Reply with the comment URL once posted.

3. **Track in `supervisor-state.json`** under `{threadId: {githubCommentRequestedAt: iso, githubCommentUrl: null}}`. On the next cron tick, re-check; if still missing after 2 nudges, escalate to operator via `ask_user_question(timeout: 0)` with options: "post on coworker's behalf (orchestrator-level retry)" / "close chain anyway (suppress observability)" / "investigate (pause chain)".

**Do NOT post the comment yourself.** The closest-to-the-state principle means the coworker who holds the verdict authors the post — relaying second-hand drops fidelity and recipient ambiguity ("did the supervisor read the actual code, or just the [Report]?"). Supervisor enforces, doesn't substitute.

For chains in `pr_open` state, the PR description IS the comment — verify the PR exists, links back to the issue (`gh pr view <num>` body contains `Fixes #N`/`Closes #N`), and `report_pr_created` was called (check `pr_session_mappings`). If the PR exists but the issue link is missing, nudge the fixer to amend the PR body, not to add a separate issue comment.

### 6. Output

After processing all chains, send a single status report to your parent (the operator if you are top-of-chain) using the standard 5-bullet shape:

- **Status:** {n} chains in flight, {nudged} nudged, {escalated} escalated to operator
- **Link:** dashboard timeline filtered to gh-issue-\* threads
- **Verdict:** healthy / degraded / blocked
- **Next-action:** wait for cron / await operator decisions / re-dispatch chain X
- **Blocker:** {threads with no clear path forward, list 3 max with one-line reason each}

**Lead the chat reply with an inline markdown table** of the per-chain status before the 5-bullet summary, so the operator gets the at-a-glance view without opening the attachment. Columns: `# | repo | issue | tier | github | state | last-active | next`. One row per chain. The full narrative still goes in a file via `send_file(to="parent")` — the inline table is a digest, not a replacement.

```
| #   | repo                       | tier      | github         | state         | last-active   | next                |
| --- | -------------------------- | --------- | -------------- | ------------- | ------------- | ------------------- |
| 11339 | shader-slang/slang       | maintainer | 2 cmts (old)   | awaiting-input | 3.5d silent  | escalate to operator |
| 11367 | shader-slang/slang       | fixer     | 0              | pr_open       | 5m            | watch CI            |
| 11372 | shader-slang/slang       | maintainer | 2 cmts         | design-decide | 4.8h          | maintainer signoff  |
```

Per-chain status messages land on each chain's canonical `thread_id` (per the `[MUST]` rule above) — the inline table is the supervisor's own consolidated digest in the supervisor's session.

## Scheduling

On first run, schedule yourself:

```js
schedule_task({
  prompt: '/supervise-issues',
  cron: '*/30 9-21 * * *', // every 30 min, 9am-9pm local
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
- **Don't post the GitHub comment on a coworker's behalf.** Closest-to-the-state principle: the coworker holding the verdict authors the post. Supervisor enforces, doesn't substitute. (See step 5.)

## State

Track which chains you've nudged and how many times in `/workspace/agent/memory/supervisor-state.json` (load at start, save at end). Same key per chain: `{threadId: {nudgedAt: [iso, iso, ...], escalatedAt: iso, lastObservedActivity: iso}}`.

## When called manually

If invoked outside the cron (operator typed `/supervise-issues`), do the same scan but report ALL chains regardless of staleness — operator wants the full picture.
