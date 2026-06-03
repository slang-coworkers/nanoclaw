---
name: supervise-issues
license: MIT
description: Periodic supervisor for in-flight GitHub issue chains. Lists active issue sessions, computes stuck-time, nudges silent chains, verifies the human-observability loop (5-bullet GitHub comment present before chain closes), surfaces blockers to operator via ask_user_question. Designed to be self-scheduled via schedule_task on a 6-hour cron.
---

# /supervise-issues — Issue chain supervisor

You are the orchestrator (or a coworker the orchestrator delegated supervision to). Walk all in-flight issue chains, identify stuck ones, and nudge or escalate as appropriate. Designed to run on a recurring `schedule_task` (suggested cron: `0 */6 * * *` — every 6 hours).

**Be cost-considerate.** Each tick costs tokens. Keep ticks cheap: run on a 6-hour cadence (not every 30 min), start each tick in a fresh session (`new_session: true`) so context doesn't accumulate across ticks, gate the wake so a tick with nothing stuck is a no-op, and in the report **highlight only what changed since the last tick** — don't re-narrate chains whose state is identical (see §1 delta detection and §6).

## What "in-flight" means

An issue chain is in-flight if you (the orchestrator) have a session whose `thread_id` matches `gh-issue-<owner>/<repo>-<num>` and the issue is still open on GitHub with no merged PR.

**[MUST] `thread_id` names the chain, not the work product.** A coworker session is sometimes reused across issues — a session threaded `gh-issue-…-N` may have shipped the PR for a *different* issue M. So `thread_id` is reliable for "which chain is this," but **never** infer a chain's PR (or which issue a PR fixes) from `thread_id` alone.

**Resolve a chain's real PR with `gh`** (the fixer branches as `fix/issue-<num>`):
- Find the chain's PR by head branch: `gh pr list --repo <owner>/<repo> --head fix/issue-<num> --state all --json number,isDraft,state,title,headRefName`.
- Confirm which issue it actually fixes from the **PR body**: `gh pr view <pr> --repo <owner>/<repo> --json body --jq '.body' | grep -ioE '(fixes|closes|resolves) #[0-9]+'`.
- The PR body's `Fixes #N` is the authoritative PR↔issue link. When it names a different issue than the `thread_id` suggests, trust the PR body, record the chain under the issue the PR actually fixes, and flag the mismatch in your report.

## The prime directive — a resumable GitHub artifact for every chain

**[MUST] Every in-flight chain must, at all times, have a GitHub artifact a human can land on and resume from:** an open PR, a comment on the PR, or a comment on the issue. This applies whether the chain is **still in progress** or **parked** — the test is not "is it done?" but "if a human opened the issue/PR right now, would they see where it stands and be able to pick it up?" An in-progress chain satisfies it with a comment stating what's underway and what's next; a parked chain with a comment naming the blocker; a shipped chain with the PR itself. GitHub — not the dashboard, not chat, not the session DB — is the durable human-observability surface.

This directive subsumes step 5 (comment verification) and drives the behaviors below: the weekend CI window (§7) keeps that artifact *progressing*, and the superseded-PR postmortem (§8) keeps it *honest* when our work is overtaken. If a chain has no artifact and you cannot produce one, that is the single most important thing to surface in your report — louder than any silent/stuck classification.

## Procedure

### 1. Build the status table

Query your inbound for every active issue thread:

```bash
ncl sessions list --thread-prefix "gh-issue-" --json
```

For each session, also pull the most recent activity (last inbound + last outbound timestamp). The session DBs have these directly; ask via `ncl sessions messages --id <sess> --limit 1` if needed.

**Resolve each chain's PR with `gh`** (see the `[MUST]` above). Find its PR by the fixer branch convention and confirm the target issue from the PR body:

```bash
gh pr list --repo <owner>/<repo> --head fix/issue-<num> --state all \
  --json number,isDraft,state,title,headRefName
gh pr view <pr> --repo <owner>/<repo> --json body --jq '.body' \
  | grep -ioE '(fixes|closes|resolves) #[0-9]+'
```

If a chain's PR `Fixes` a *different* issue than its `thread_id` suggests, the chain is **mis-threaded** (a reused session). Record it under the issue the PR actually fixes and flag it. (If `gh pr list --head` returns nothing, the chain has no PR yet — normal pre-PR state, not a mismatch.)

Build a table of: `repo` / `issue` (the issue the PR actually fixes) / `thread_id` / `pr` / `last_activity_at` / `state` (one of `dispatched` / `triaging` / `fixing` / `reviewing` / `pr_open` / `awaiting_human` / `silent` / `closing` / `closed_no_github_comment`).

**Compute a delta vs. the last tick (cost-considerate reporting).** `supervisor-state.json` holds each chain's last-seen snapshot (`lastState`, `lastActivityAt`, `lastPrState`, and the last comment id/timestamp seen on the issue/PR). For each chain this tick, fetch the latest comment via `ncl sessions messages --id <sess> --limit 1` (and/or `gh issue view <num> --json comments --jq '.comments[-1]'` for the GitHub side) and compare to the stored snapshot. Tag each row:
- **🆕 NEW** — a chain not present last tick.
- **🔼 UPDATED** — state changed, or a new comment/activity since the stored snapshot (cite what changed: "reviewer posted APPROVE", "CI went red", "human replied").
- **• same** — no change since last tick.

Write the fresh snapshots back to `supervisor-state.json` at the end. The report (§6) leads with NEW + UPDATED and collapses the `same` rows — the operator scans only what moved.

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

For chains in `pr_open` state, the PR description IS the comment — verify the PR exists and links back to the issue (`gh pr view <pr> --repo <owner>/<repo> --json body` contains `Fixes #N`/`Closes #N`). If the PR exists but the issue link is missing, nudge the fixer to amend the PR body, not to add a separate issue comment. (You can't read `pr_session_mappings` from the container to confirm `report_pr_created` ran — but a PR discoverable via `gh pr list --head fix/issue-<num>` that webhooks route back to the chain is sufficient evidence the mapping exists; if review comments are NOT reaching the chain's session, that's the signal `report_pr_created` was missed — nudge the fixer to call it.)

### 6. Output

After processing all chains, send a single status report to your parent (the operator if you are top-of-chain) using the standard 5-bullet shape:

- **Status:** {n} chains in flight, {nudged} nudged, {escalated} escalated to operator
- **Link:** dashboard timeline filtered to gh-issue-\* threads
- **Verdict:** healthy / degraded / blocked
- **Next-action:** wait for cron / await operator decisions / re-dispatch chain X
- **Blocker:** {threads with no clear path forward, list 3 max with one-line reason each}

**Lead the chat reply with an inline markdown table** of the per-chain status before the 5-bullet summary, so the operator gets the at-a-glance view without opening the attachment. Columns: `# | repo | issue | tier | github | state | last-active | next`. One row per chain, **prefixed with its delta tag (🆕 / 🔼 / •) from §1** — sort 🆕 and 🔼 rows to the top, and collapse the unchanged `•` rows into a single trailing line (`• 7 chains unchanged since last tick: #1372, #1380, …`) unless the operator invoked the skill manually. The full narrative still goes in a file via `send_file(to="parent")` — the inline table is a digest, not a replacement. **If nothing changed since the last tick, say so in one line and skip the table** — don't spend tokens re-rendering a static board.

```
| #   | repo                       | tier      | github         | state         | last-active   | next                |
| --- | -------------------------- | --------- | -------------- | ------------- | ------------- | ------------------- |
| 1339 | acme/widget   | maintainer | 2 cmts (old)   | awaiting-input | 3.5d silent  | 🔼 escalate to operator |
| 1367 | acme/widget   | fixer      | 0              | pr_open        | 5m           | • watch CI              |
| 1372 | acme/widget   | maintainer | 2 cmts         | design-decide  | 4.8h         | • maintainer signoff    |
```

Per-chain status messages land on each chain's canonical `thread_id` (per the `[MUST]` rule above) — the inline table is the supervisor's own consolidated digest in the supervisor's session.

### 7. Weekend CI window — exercise draft PRs to catch failures early

Our fixers open PRs as **draft**. A draft PR runs a reduced (or zero) CI set on most repos, so latent build/test failures sit undiscovered until a human flips it. The weekend is the cheap window to surface them: flip our draft PRs to **ready-for-review** so full CI runs, capture the result, revive the pipeline on failure, then flip back. Three rules govern this, and they are stateful — **track everything in `supervisor-state.json` under the chain's `prCi` key** (shape below).

**[MUST] Only ever revert a flip *we* performed.** The whole window is gated on a `flippedByUs` flag we set when (and only when) we do the flip. If a PR was already `ready` when we found it (a human or another process flipped it), we touch nothing — no flip, no CI revive on our initiative beyond normal webhook handling, and **never** a flip back to draft. Reverting someone else's deliberate ready-state would silently undo human intent. This is the single most important guard in this section.

Per chain with a draft PR (resolve the PR via `gh pr list --head fix/issue-<num>`, never the thread — see the `[MUST]` at the top):

**a. Saturday / Sunday — flip to ready (once per PR).**
   - Skip unless today is Sat or Sun (`date +%u` → 6 or 7) in the orchestrator's local TZ.
   - Skip if `prCi.flippedByUs` is already set for this PR (one flip per PR, ever — idempotent across ticks and across weekends).
   - Confirm the PR is currently `isDraft: true`: `gh pr view <pr> --repo <owner>/<repo> --json isDraft,state,mergeable,mergeStateStatus`. If it is **not** a draft, it was flipped by someone else → record `prCi.alreadyReady=true` and **do not touch it**.
   - **Rebase to pristine first (so CI is meaningful).** A draft branch can be stale or conflicting with `main`; flipping it ready as-is makes CI fail on the merge state, not the fix. Before flipping, check `mergeable`/`mergeStateStatus` — if `CONFLICTING`/`DIRTY` (or `BEHIND`), this is **fixer work, not supervisor work**: do NOT rebase from the supervisor session (you don't hold the worktree). Instead send ONE a2a to the chain's **fixer** on its canonical thread: *"[Supervisor — weekend CI prep — gh-issue-X/Y-N] Draft PR #<pr> is `<mergeStateStatus>` against main. Rebase your worktree onto `origin/main`, resolve conflicts, force-push so the branch is pristine, then reply 'rebased'. I'll flip it to ready for full CI once clean."* Set `prCi.rebaseRequestedAt=<iso>` and skip the flip this tick; re-evaluate next tick once the branch is `MERGEABLE`/`CLEAN`. (Per [no-restart-to-refresh], rebasing happens in the live fixer session — never reconstruct the worktree from the supervisor.)
   - Flip once mergeable: `gh pr ready <pr> --repo <owner>/<repo>`. On success, set `prCi = {flippedByUs: true, flippedAt: <iso>, prNumber: <n>, repo: <r>, ciObserved: false}`.

**b. Next tick(s) — capture CI and revive the pipeline.**
   - For any PR with `prCi.flippedByUs && !prCi.ciObserved`, read CI: `gh pr checks <pr> --repo <owner>/<repo> --json name,bucket,state,link`.
   - While any check is `pending`, leave it — re-check next tick.
   - Once all checks are terminal, set `prCi.ciObserved=true`, `prCi.ciBucket=<pass|fail|...>`, `prCi.ciCapturedAt=<iso>`, and:
     - **All `pass`** → record it; the chain is healthier than we knew. No revive needed.
     - **Any `fail`** → **revive the pipeline**: send ONE a2a message to **triage** on the chain's canonical `thread_id` (closest-to-the-entry tier; triage re-dispatches to fixer per the normal chain). Include the failing check names + their `link` URLs and the PR number. Body shape:
       > [Supervisor — CI revive — gh-issue-X/Y-N] Weekend CI on draft PR #<pr> (flipped to ready to exercise full CI) reports failures: `<check>` → <link>; `<check>` → <link>. Re-engage the chain: triage → fixer to address, re-verify, re-push. The PR stays ready until CI is green or the window closes.
     - Record `prCi.revivedAt=<iso>` so we don't double-dispatch on the next tick.

**c. After the weekend (Mon, or >2 days since flip) — flip back, but ONLY if we flipped it.**
   - For any PR with `prCi.flippedByUs === true`: if today is Monday (or `now - prCi.flippedAt > 48h`), flip back to draft: `gh pr ready <pr> --repo <owner>/<repo> --undo`. Then clear the flip: set `prCi.flippedByUs=false`, `prCi.revertedAt=<iso>` (keep the captured `ciBucket` for history).
   - **Exception — don't revert if the chain is mid-revive.** If CI failed and the revive is in progress (`prCi.revivedAt` set but the fixer hasn't re-pushed / chain not back to green), leave it ready so the fixer's CI keeps running; revert on a later tick once the chain settles. A failing chain forced back to draft would re-hide the very failure we surfaced.
   - **Never** `--undo` a PR where `prCi.flippedByUs` is not `true` (covers `alreadyReady` PRs and anything a human readied). When in doubt, leave it ready and note it in the report.

`prCi` state shape (per chain in `supervisor-state.json`):
```json
"gh-issue-acme/widget-1367": {
  "prCi": { "prNumber": 1386, "repo": "acme/widget",
            "flippedByUs": true, "flippedAt": "2026-06-06T09:30:00Z",
            "ciObserved": true, "ciBucket": "fail", "ciCapturedAt": "...",
            "revivedAt": "2026-06-06T10:00:00Z", "revertedAt": null,
            "alreadyReady": false }
}
```

### 8. Superseded-PR postmortem — learn when our work is overtaken

A chain can be resolved by a PR that **isn't ours** — a maintainer or contributor opens and merges a different fix, or merges a different PR that `Closes #N`. When that happens our draft is dead weight, but more importantly it's a **learning signal**: someone solved what we were working on, possibly better or faster. Capture it.

Detect it: for each chain with an open PR of ours, check whether the issue is being closed by some *other* PR. The container-proven field is `closedByPullRequestsReferences` (lists the PRs GitHub links as closing the issue — `timelineItems` is NOT a valid `gh issue view` field, don't use it):
```bash
gh issue view <num> --repo <owner>/<repo> \
  --json state,stateReason,closedByPullRequestsReferences \
  --jq '{state, stateReason, closers: [.closedByPullRequestsReferences[].number]}'
# Compare .closers against OUR PR number (from `gh pr list --head fix/issue-<num>`):
#   - closers contains a PR != ours, OR our PR is CLOSED-unmerged while another merged → postmortem.
#   - closers == [ours] or empty → no postmortem.
```
If the issue is **closed by a PR that is not our chain's PR** (the one on `fix/issue-<num>`) — or our PR was closed un-merged while a sibling PR merged — trigger the postmortem — **once per chain**, gated on `supervisor-state.json` `postmortem.done`:

1. **Analyze the gap.** Pull both diffs/approaches: our draft PR (`gh pr diff <ours>`) and the merged PR (`gh pr view <theirs> --json title,body,files` / `gh pr diff <theirs>`). Ask: what did the merged fix do that ours didn't — different root-cause, smaller/cleaner patch, a test we missed, a faster turnaround, a constraint we got wrong? Be specific and honest; "they were faster" is not a learning, "they fixed it at the IR level where we patched the parser, avoiding the regression in X" is.
   - **If the merged PR looks very similar to ours (same root-cause / overlapping diff), engage the author** rather than guessing the delta in private. Post a brief, respectful comment on *their* PR @-mentioning the author: *"@<author> we'd independently drafted a similar fix in #<ours> (auto-generated by our agent pipeline). Yours merged — nice. Quick question for our own learning: was there a gap or rough edge in what we'd have shipped (test coverage, an edge case, the approach itself)? Trying to improve the pipeline."* Capture their reply (next tick / webhook) into the learning's takeaway. If the approaches genuinely **don't** overlap, skip the @-mention — just write the learning from the diff comparison.
2. **`append_learning`.** Write a learning so future chains improve. Title: `postmortem: <repo>#<num> superseded by PR #<theirs>`. Content (markdown): the issue, our approach + PR link, their merged approach + PR link, the concrete delta, the author's feedback if you asked, and the **actionable takeaway** for triage/fixer next time (a specific, transferable rule — not "they were faster"). This goes to `/workspace/shared/learnings/` for all coworkers.
3. **Close our draft with a pointer.** Comment on our draft PR linking the learning and the superseding PR, then close it:
   > Superseded by #<theirs>, which merged and resolves #<num>. Closing this draft. Postmortem captured as a shared learning (`postmortem: <repo>#<num>`) so we improve next time. Approach delta: <one line>.

   `gh pr close <ours> --repo <owner>/<repo> --comment "<above>"`. (Use the `<project>-github` skill's posting helper if available; otherwise the gh-app token via OneCLI.) This keeps the **resumable-artifact** directive satisfied — anyone landing on our PR sees why it closed and where the resolution lives.
4. **Record** `postmortem = {done: true, supersededByPr: <theirs>, learningTitle: "...", at: <iso>}` and drop the chain from the in-flight table (it's genuinely closed).

Do **not** run the postmortem for our own merged PRs, for issues closed as `not_planned` without a PR (that's a maintainer wontfix — note it and close normally), or more than once per chain.

### 9. Worktree GC sweep — reclaim abandoned fixer worktrees

The fixer workflow GCs its worktree when a `CLOSED`/`MERGED` webhook arrives. But a PR that never reaches a terminal state — abandoned, draft-forever, or silently superseded without a close event — leaks its `wt-*` / `active-work/` dirs on the shared `/workspace` indefinitely (there is no other reaper). The supervisor is the recurring cron that now owns this backstop.

**[MUST NOT] Never `git worktree remove` from the supervisor session.** Worktrees live in each *fixer's* filesystem, not yours, and cross-deletes have killed active builds. The supervisor *detects and dispatches*, it does not delete.

Once per tick, for each in-flight chain whose PR (resolved via `gh pr list --head fix/issue-<num>`) is in a terminal-but-uncleaned state — `MERGED`/`CLOSED` for > 24h, or no PR activity for > 10 days while the chain still shows a `wt-` worktree — send ONE a2a to that chain's **fixer** on its canonical thread:
> [Supervisor — worktree GC — gh-issue-X/Y-N] PR #<pr> is `<state>` (<age>); your worktree `wt-<slug>` looks abandoned. If you're done, GC it (remove the worktree + its `active-work/<slug>` dir per your workflow), then reply 'gc done'. If you're still working it, reply 'active' and I'll leave it.

Track `gcRequestedAt` per chain in `supervisor-state.json`; if a chain is still flagged after 2 GC nudges with no `gc done`/`active` reply, escalate to the operator with `df -h /workspace` so they can decide (the fixer's container may be permanently gone, in which case the operator reclaims). Do not escalate disk pressure silently — a filling `/workspace` blocks every fixer.

## Scheduling

On first run, schedule yourself:

```js
schedule_task({
  prompt: '/supervise-issues',
  cron: '0 */6 * * *',   // every 6 hours — cost-considerate cadence
  new_session: true,     // fresh context each tick; all durable state is in supervisor-state.json
  script: `node --input-type=module -e "
    // Gate the wake: only run a full tick when something is actually stuck.
    // All real state lives in supervisor-state.json — the prompt reads it.
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

Three cost levers, all already wired above:
1. **6-hour cadence** (`0 */6 * * *`) — not every 30 min. Issue chains move on the scale of hours, not minutes.
2. **`new_session: true`** — each tick starts clean. The supervisor needs **no** conversation memory; everything it must remember (nudge counts, `flippedByUs`, `postmortem.done`, last-tick snapshots) is persisted in `supervisor-state.json`. Without this, the session transcript grows every 6h forever and each tick costs more than the last.
3. **Wake gate** — when nothing is stuck, the tick is a no-op (zero model tokens).
4. **Delta reporting** (§1, §6) — a tick that does wake reports only what changed, so even active periods stay cheap.

## Anti-patterns

- **Don't summarize history.** The supervisor reports CURRENT state. Past activity is in the dashboard / JSONLs.
- **Don't open new chains.** You only nudge existing ones. New chains come from webhooks.
- **Don't escalate before nudging.** Most stuck chains resume from a single nudge; escalation costs the operator's attention.
- **Don't multi-cast.** A nudge goes to one coworker (the one currently expected to respond), not the whole chain.
- **Don't loop.** If a chain has been nudged twice with no response, escalate — don't keep nudging.
- **Don't post the GitHub comment on a coworker's behalf.** Closest-to-the-state principle: the coworker holding the verdict authors the post. Supervisor enforces, doesn't substitute. (See step 5.)
- **Don't flip a PR back to draft unless `prCi.flippedByUs === true`.** Reverting a ready-state a human set silently undoes their intent. (§7c)
- **Don't rebase a conflicting branch from the supervisor session.** You don't hold the fixer's worktree; dispatch the rebase to the fixer and wait. (§7a)
- **Don't force a mid-revive PR back to draft on Monday.** A chain whose CI failed and is being re-fixed stays ready until it settles — flipping it back re-hides the failure. (§7c exception)
- **Don't postmortem twice, or for our own merged PRs / `not_planned` closes.** The postmortem fires once per chain, only when a *different* PR resolved the issue. (§8)
- **Don't `git worktree remove` from the supervisor session.** Worktrees belong to the fixers; dispatch the GC to the owning fixer and let it delete its own. (§9)

## State

Track which chains you've nudged and how many times in `/workspace/agent/memory/supervisor-state.json` (load at start, save at end). Per chain (`threadId` key), persist:
- `nudgedAt: [iso, ...]`, `escalatedAt: iso`, `lastObservedActivity: iso` — nudge/escalation bookkeeping.
- `githubCommentRequestedAt`, `githubCommentUrl` — step 5 observability enforcement.
- `prCi: {...}` — the weekend CI window (§7): `flippedByUs`, `flippedAt`, `prNumber`, `repo`, `ciObserved`, `ciBucket`, `ciCapturedAt`, `revivedAt`, `revertedAt`, `alreadyReady`, `rebaseRequestedAt`. **`flippedByUs` is the gate for the Monday revert — never `--undo` without it.**
- `postmortem: {done, supersededByPr, learningTitle, at}` — §8, fires once per chain.

Load this file at the start of every tick and write it back at the end; the §7/§8 idempotency (one flip per PR, one postmortem per chain, no double-revive) depends entirely on it surviving across ticks.

## When called manually

If invoked outside the cron (operator typed `/supervise-issues`), do the same scan but report ALL chains regardless of staleness — operator wants the full picture.
