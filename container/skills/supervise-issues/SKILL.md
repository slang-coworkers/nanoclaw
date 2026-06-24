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

**[MUST] A chain is trackable whether or not it produced a PR of ours.** Not every routed issue yields a draft PR — many resolve at triage: we post a triage report and the issue is then driven by an **external contributor**, a **maintainer**, an ongoing **human design debate**, or we **self-close** it (e.g. an audit that concludes "no change needed"). These chains have **no PR of ours**, but they DO have a GitHub artifact — **our triage / review / audit comment** — and they are exactly as real as PR-bearing chains. The old failure mode was equating "trackable" with "has a `fix/issue-<num>` PR": a triaged-then-handed-off chain then silently vanished from the board AND from `supervisor-state.json` (neither in-flight nor journaled), so if the external/maintainer PR later stalled, nobody resurfaced it (observed: `#11441` triaged → external `romeoahmed` owns the PR → dropped off entirely; `#11349` live maintainer debate → invisible; `rhi#767` audited-and-self-closed → no record). **Build the table from the routed/triaged universe, not just from chains with a PR.** For a no-PR chain, the GitHub artifact is its **triage comment URL** and its disposition lives in the `next` field (see §1a).

**[MUST] `thread_id` names the chain, not the work product.** A coworker session is sometimes reused across issues — a session threaded `gh-issue-…-N` may have shipped the PR for a *different* issue M. So `thread_id` is reliable for "which chain is this," but **never** infer a chain's PR (or which issue a PR fixes) from `thread_id` alone.

**Resolve a chain's real PR with `gh`** (the fixer branches as `fix/issue-<num>`):
- Find the chain's PR by head branch: `gh pr list --repo <owner>/<repo> --head fix/issue-<num> --state all --json number,isDraft,state,title,headRefName`.
- Confirm which issue it actually fixes from the **PR body**: `gh pr view <pr> --repo <owner>/<repo> --json body --jq '.body' | grep -ioE '(fixes|closes|resolves) #[0-9]+'`.
- The PR body's `Fixes #N` is the authoritative PR↔issue link. When it names a different issue than the `thread_id` suggests, trust the PR body, record the chain under the issue the PR actually fixes, and flag the mismatch in your report.

## The prime directive — a resumable GitHub artifact for every chain

**[MUST] Every in-flight chain must, at all times, have a GitHub artifact a human can land on and resume from:** an open PR, a comment on the PR, or a comment on the issue. This applies whether the chain is **still in progress** or **parked** — the test is not "is it done?" but "if a human opened the issue/PR right now, would they see where it stands and be able to pick it up?" An in-progress chain satisfies it with a comment stating what's underway and what's next; a parked chain with a comment naming the blocker; a shipped chain with the PR itself. GitHub — not the dashboard, not chat, not the session DB — is the durable human-observability surface.

This directive subsumes step 5 (comment verification): the superseded-PR postmortem (§7) keeps that artifact *honest* when our work is overtaken, and the worktree GC sweep (§8) keeps the workspace clean. If a chain has no artifact and you cannot produce one, that is the single most important thing to surface in your report — louder than any silent/stuck classification.

## Procedure

### 1. Build the status table

**[MUST] DISCOVER the chain universe live, every tick — never inherit it from the tracker.** The set of chains to report is `ncl sessions list --thread-prefix "gh-issue-"` (the live, authoritative session list) **unioned with** the journaled chains in `supervisor-state.json`. The tracker and state JSON are the *prior snapshot* — they exist to compute deltas (§1) and to gate §7 idempotency, **not** to define which chains exist. Enumerate sessions FIRST, then reconcile: any `gh-issue-` session not already in the state JSON is a **🆕 NEW** chain that must be journaled and added this tick (§1a). A cron prompt that says "source of truth = tracker, refresh changed rows" means *refresh the prior snapshot's values*, **not** *limit the universe to the tracker's existing rows* — the universe is always rediscovered live.

> **Why this is a [MUST], not a nicety (observed failure, 2026-06-05):** a tick read the tracker + state JSON and only "refreshed the rows it already had" via `gh` — and silently dropped **~16 newly-minted chains** (incl. slang#11472 / #11473 / #11474 / #11479 / #11482 / #11483, slangpy#977 / #1014). Each had a live `gh-issue-` session but was never in the tracker, so refreshing-known-rows never saw it. Inheriting the universe from the tracker is the bug; live session enumeration (this step) is the fix. `new_session: true` is correct and is *not* the cause — it merely exposes a discovery step that was skipped.

**[MUST] Dedup the live session list against journal KEYS only — never against narrative prose.** "Already journaled" means there is a **top-level `gh-issue-<owner>/<repo>-<num>` key** in `supervisor-state.json` (or a key under `_archived`). It does **NOT** mean the issue number appears *somewhere* in the file. A `gh-issue-…-N` session with no matching top-level/`_archived` **key** is **🆕 NEW** and must be journaled this tick — even if `N` shows up inside a `_meta.tickNN` narrative, a "Watch"/"awareness" line, or any other free text. Compute the diff as a set operation on keys: `NEW = {live gh-issue threads} − {top-level keys} − {_archived keys}`. Do **not** `grep`/substring-match the state file for the issue number to decide noveltly — that is exactly the bug below.

> **Why this is a [MUST] (observed failure, 2026-06-15 → silent 2 days):** slang#11613 was first seen at tick41 in the repo-wide `gh updated>=` *awareness* scan **~17 min before its session existed**, so the tick correctly-for-the-moment wrote `"#11613 … no sessions, not chains"` into the `_meta.tick41` narrative. Its triager + orchestrator sessions (`thread_id = gh-issue-shader-slang/slang-11613`) were then born minutes later — fully discoverable via `ncl sessions list --thread-prefix`. But ticks 42–45 each asserted *"all journaled, 0 NEW"*: the substring `11613` was present in the file (in the tick41 prose), so a narrative-level dedup treated it as known. It was **never given a top-level key, never artifact-checked, never nudged** — the triage 5-bullet sat undelivered while the issue aged. Key-based dedup (this rule) + awareness re-promotion (next rule) close the hole.

**[MUST] An "awareness" note is not a journaling decision — re-check it every tick.** When the repo-wide scan surfaces an issue that has **no session yet** (pre-dispatch, or a webhook still in flight), you may mention it as awareness, but you MUST NOT let that mention suppress later discovery. Two hard rules: (1) never write *"not a chain"* / *"no session"* as if it were terminal — phrase it as **`awareness: session pending`** and re-evaluate next tick; (2) on **every** subsequent tick, the live `ncl sessions list` enumeration is authoritative — the instant a `gh-issue-…-N` session exists, **promote `N` to a tracked 🆕 chain and journal it with a top-level key**, regardless of any prior awareness note. The awareness line lives only in narrative; it never becomes a key and therefore never satisfies the dedup.

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

Build a table of: `repo` / `issue` (the issue the PR actually fixes) / `thread_id` / `pr` / `last_activity_at` / `state` (one of `dispatched` / `triaging` / `fixing` / `reviewing` / `pr_open` / `awaiting_human` / `awaiting_us` / `silent` / `closing` / `closed_no_github_comment`). Track `last_activity_at` as **`last_activity_by_us`** (our outbound / our commit / our bot comment) — not the chain's last touch of any kind (see §2).

**Compute a delta vs. the last tick (cost-considerate reporting).** `supervisor-state.json` holds each chain's last-seen snapshot (`lastState`, `lastActivityAt`, `lastPrState`, and the last comment id/timestamp seen on the issue/PR). For each chain this tick, fetch the latest comment via `ncl sessions messages --id <sess> --limit 1` (and/or `gh issue view <num> --json comments --jq '.comments[-1]'` for the GitHub side) and compare to the stored snapshot. Tag each row:
- **🆕 NEW** — a chain not present last tick.
- **🔼 UPDATED** — state changed, or a new comment/activity since the stored snapshot (cite what changed: "reviewer posted APPROVE", "CI went red", "human replied").
- **• same** — no change since last tick.

Write the fresh snapshots back to `supervisor-state.json` at the end. The report (§6) leads with NEW + UPDATED and collapses the `same` rows — the operator scans only what moved.

### 1a. No-PR chains — the artifact is the comment, the `next` field carries the disposition

A chain with no `fix/issue-<num>` PR is **not** dropped — it is journaled like any other, with two differences: its **GitHub cell links the triage/review comment** (resolve via the bot's most recent comment on the issue — see §5's comment-fetch), and its **`next` field states the disposition** so the operator can see at a glance whether it's live or parked-and-why. Use this disposition vocabulary for the `next`/state cell:

| Disposition | Meaning | `next` field shows | Board behavior |
|---|---|---|---|
| `active: human-debate` | maintainers/reporters actively discussing our triage | "live debate — @user1/@user2, watching" | **lead row (never collapse)** — a live chain must be visible |
| `stood-down: external-PR` | we triaged; an external contributor owns the implementation | "external @author writing PR — watch for it" | tracked-parked; surface if their PR stalls > N days |
| `advisory: maintainer-driving` | we advised; a maintainer is driving their own fix | "maintainer @user on #M — no action" | tracked-parked |
| `triaged: awaiting-pickup` | triage posted, nobody has picked it up yet | "triaged <date>; no owner yet" | tracked-parked; nudge-worthy if very old |
| `closed-by-us` | we self-resolved (audit "no change", wontfix-after-analysis) | "audit/analysis terminal — closed by us" | **terminal → `_archived`** |

The artifact + disposition together satisfy the **prime directive**: a no-PR chain is "parked WITH a resumable GitHub artifact" exactly when its triage comment is journaled and its `next` says why it's parked. A chain you can neither give an artifact nor a disposition is the real leak — surface it loudly (per the prime directive).

**[MUST] Journal every no-PR chain too.** Persist it in `supervisor-state.json` under its `gh-issue-…` key with `{disposition, githubArtifactUrl, lastObservedActivity}` — terminal ones (`closed-by-us`) move to `_archived` with a one-line reason + the comment URL, exactly like superseded/closed PR chains. The invariant: **every routed+triaged issue appears either in the in-flight set or in `_archived` — never absent from both.** On each tick, reconcile: any `gh-issue-` session whose issue you triaged but which is in neither set is a journaling miss — add it.

### 2. Classify each row

**[MUST] "Activity" for every stuck/silent clock means activity BY US — never any activity.** A coworker chain is stuck when *we* have gone quiet, regardless of how loud the humans are. Define `last_activity_by_us` = the most recent of: our outbound on the session, our commit/push on the PR branch, or a comment/review **authored by the bot** on the issue/PR. A human comment, a maintainer review, or a CI event **starts** our responsiveness clock — it does **not** reset it. Computing "silent" off the chain's *last touch of any kind* is the bug that let #11594 hide: every time the maintainer asked "why no progress?", a last-touch clock got pushed forward and the chain looked freshly active while our owning session was dead.

**[MUST] Before the silence checks, compute the direction of the ball.** Fetch the most recent issue/PR comment + review (`gh issue view <n> --json comments --jq '.comments[-1]'`, `gh pr view <pr> --json reviews,comments`). If the **latest** actor is a **non-bot** (human/maintainer/external) AND there is **no** bot reply, commit, or push *after* it → **the ball is ours**. Cross-check the owning session: `ncl sessions list` → is its `container_status` `stopped`, or has it produced no outbound since that human comment? If the ball is ours AND our session is not actively working it → state = **`awaiting_us`** (see below). This is **orthogonal** to artifact existence and to the ≥3-day stale window: a chain can have a fresh non-draft PR, same-day human activity, and still be completely dark on our side.

- **`dispatched` < 5 min ago** → fresh, leave alone.
- **`triaging` / `fixing` / `reviewing` / `pr_open` < 60 min since `last_activity_by_us`** → working, leave alone.
- **`awaiting_human`** (a pending `ask_user_question` exists for this thread, OR the latest actor is the bot and we are genuinely waiting on a human reply) → leave alone, it's blocked on the operator/maintainer. **Do not confuse this with `awaiting_us`** — the discriminator is *who spoke last*: bot-last = `awaiting_human`; human-last-unanswered = `awaiting_us`.
- **`awaiting_us`** (latest actor is a non-bot, unanswered by us; ball is in our court) → **STUCK regardless of how recent that human comment is.** Re-wake the owning tier immediately via a thread-keyed nudge (§3) naming what's unanswered (e.g. "jkwak asked for a `[1/4]` rename + review replies on #11594; your session is stopped — resume and respond"). **Never** treat a `pr_open` chain with a trailing unanswered human comment as watch-only. If the owning session is `stopped`, the nudge wakes it; if it's running but silent ≥60 min, the nudge prompts it. This trigger does NOT wait for the ≥3-day stale window.
- **`silent` ≥ 60 min** (no `last_activity_by_us`, and the ball is NOT cleanly on a human) → stuck. Investigate: is the assigned coworker's container running? Did the last message they sent get a response? Did they emit a [Refusal] or [not actionable] outcome? If the chain was dropped without a closing report, that's the bug — re-prompt the deepest tier with a soft nudge.
- **`silent` ≥ 4 hours** → escalate to operator via `ask_user_question` with options: "extend deadline" / "re-dispatch from triage" / "close chain (out of scope)" / "abandon (won't fix)". Use `timeout: 0` — there is no good fallback.
- **`closing`** (final `[Report]` emitted, PR opened, or refusal landed) → run **step 5: GitHub-comment verification** before letting the chain drop off the table.
- **`closed_no_github_comment`** (state from step 5) → nudge the responsible coworker to post; if unmet after 2 nudges, escalate.

> **Why `awaiting_us` is a [MUST] (observed failure, #11594, 2026-06-16→17):** the slices fixer received full operator authorization to post a consolidated review reply + answer a `[1/4]` rename, then *batched all GitHub output behind a local build that never reported back*. Its inbound queue drained, the container idled ~3h, and the host reaped it on `absolute-ceiling`. The chain was journaled, had a fresh non-draft PR (#11594), and showed same-day activity — so artifact-existence passed, `pr_open` read as healthy, and the ≥3-day stale clock kept being reset by the maintainer's own "why no progress?" comments. **Nothing re-woke it.** The maintainer poked it daily for days while our session stayed dark. `awaiting_us` + the BY-US activity clock is the trigger that would have caught it on the next tick.

### 3. Nudges

A nudge is a message back into the assigned coworker's session, not a fresh dispatch.

**[MUST] Route the nudge by `thread_id`, NOT by `in_reply_to`.** Set `thread_id="gh-issue-<owner>/<repo>-<num>"` (the chain's canonical key) and let the runtime resolve to the recipient's session for *that issue*. Do **not** reach for `in_reply_to` of the coworker's last inbound: a coworker session is sometimes reused across issues (see the `[MUST]` under "What in-flight means"), so its most recent inbound may belong to a *different* issue's thread. `in_reply_to` (routing Layer 1) **overrides** `thread_id`, so using it sends your nudge for issue N into whatever session the coworker last spoke from — which then does N's work under the wrong thread and stamps any resulting PR with the wrong issue (a real mis-attribution: a nudge routed via `in_reply_to` into a reused fixer session for a *different* issue produced a duplicate, wrong-threaded draft PR). Thread-keyed routing finds/mints the correct per-issue session every time, matching the base-spine invariant in `agents.md` ("a fresh delegation needing its own sub-session must carry an explicit `thread_id`").

Body shape:

> [Supervisor nudge — gh-issue-X/Y-N] No outbound for {duration}. Are you blocked? Reply with: status, blocker, ETA. If your container restarted and you lost context, re-read your task memory and resume.

```
<message to="<coworker>" thread_id="gh-issue-<owner>/<repo>-<num>">[Supervisor nudge …]</message>   ✓ thread-keyed
<message in_reply_to="<their-last-msg-id>">[Supervisor nudge …]</message>                            ✗ may hit a reused session
```

Don't open new threads. Don't escalate to the operator without first nudging — most "silent" cases are containers that exited mid-task and need a wake.

**[MUST]** **One `<message>` per chain, keyed on that chain's canonical `thread_id`.** Set `thread_id="gh-issue-<owner>/<repo>-<num>"` on each block (and do NOT add `in_reply_to` — per the routing `[MUST]` above, it overrides `thread_id` and can land the message in a reused session). Never roll N chains into one consolidated dump from a thread-less chat session — thread-less status falls through to the recipient's catch-all and breaks per-tile observability. See `chain-reporting.md` per-issue routing rule.

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

For chains in `pr_open` state, the PR description IS the comment — verify the PR exists and links back to the issue (`gh pr view <pr> --repo <owner>/<repo> --json body` contains `Fixes #N`/`Closes #N`). If the PR exists but the issue link is missing, nudge the fixer to amend the PR body, not to add a separate issue comment. (If review comments are reaching the chain's session, the PR→session mapping is healthy; if they are NOT, nudge the fixer to call `report_pr_created`.)

### 6. Output

**[MUST] Deliver the board to the operator channel `to="orchestrator"` — exactly once, from one session, verbatim from the on-disk tracker.** Three failure modes have all happened and this section prevents each:

1. **Missing `to=` → silent non-delivery.** The supervisor has **multiple destinations**, so a bare `send_message`/`send_file` (no `to=`) errors with *"You have multiple destinations — specify 'to'"* and the board never lands. **The main operator destination is the channel named `orchestrator`** (the `#cw/orchestrator` dashboard view, messaging-group `mg-…rc9cak`). Use it literally:
   - **`send_message(to="orchestrator", text=<the board>)`** — `to="orchestrator"` is REQUIRED and is the correct literal value for the top-of-chain supervisor. (A *delegated* supervisor that is not the orchestrator uses `to="parent"` instead.) Do NOT pick `orchestrator-dashboard`, `agent-mg-a2a-*`, or any other group's destination — those are wrong and 404/misroute.
2. **Re-deriving the table in-context → incomplete/stale board.** Do **not** hand-build the table from memory or a partial scan — that produces a board missing chains or mixing stale issue numbers. **Post the COMPLETE board from the on-disk tracker you just wrote** (`reports/issue-chain-tracker.md`): read it back and send its content as the message body (or `send_file(to="orchestrator", path="reports/issue-chain-tracker.md", text=<one-line digest>)`). The tracker is the single source of truth for "all chains"; the chat post must equal it, not a re-derivation.
3. **Fan-out → many partial boards.** Run the whole tick in **one** session (`new_session: true`, but do not spawn parallel supervise work or sub-sessions). One session → one complete board → one delivery. Posting the board is the LAST step; do it once and end the turn.

The inline `send_message(to="orchestrator", …)` board is the **primary deliverable**; the on-disk tracker is the backup. If you also `send_file`, post the inline board FIRST so an attachment failure can never swallow it.

After processing all chains, send a single status report to your `<report-dest>` (the operator channel if you are top-of-chain) using the standard 5-bullet shape:

- **Status:** {n} chains in flight, {nudged} nudged, {escalated} escalated to operator
- **Link:** dashboard timeline filtered to gh-issue-\* threads
- **Verdict:** healthy / degraded / blocked
- **Next-action:** wait for cron / await operator decisions / re-dispatch chain X
- **Blocker:** {threads with no clear path forward, list 3 max with one-line reason each}

**Lead the chat reply with an inline markdown table** of the per-chain status before the 5-bullet summary, so the operator gets the at-a-glance view without opening the attachment.

**[MUST] The board is the canonical 10-column table — the same schema the scheduled-task prompt pins. Render all 10 columns, in this order, every tick:**

`Issue#(link) | Title (short) | Orch | Triage | Fixer | Rev | Github | Status | State/Disposition | Next`

- **Orch / Triage / Fixer / Rev** are clickable session deep-links (`…/#/cw/<folder>/s/<sessionId>`; `—` if no session for that tier). Do not drop these columns to save space — they are how the operator jumps to the stuck tier.
- The 6-column `# | repo | tier | github | state | next` shorthand some past ticks emitted is **non-conformant** — it hides which tier owns the chain and is the reason boards "didn't print 10 columns." Do not use it.

One row per chain, **prefixed with its delta tag (🆕 / 🔼 / •) from §1** — sort 🆕 and 🔼 rows to the top.

**Collapsing is a DELTA-display convenience, never a coverage reduction.** On a low-delta tick you may collapse the unchanged `•` rows into a single trailing line (`• 7 chains unchanged since last tick: #1372, #1380, …`) **only after** the full 10-column tracker file has been written and synced with every chain as a real row — the inline collapse summarizes; the on-disk board never omits. **Every live chain must appear as a full 10-column row in `reports/issue-chain-tracker.md` each tick** (collapse it in chat, never in the file). 🆕 NEW rows and `active: human-debate` rows are NEVER collapsed in either place.

**[MUST] The `github` cell is always a live hyperlink to the chain's artifact** — the PR for PR-bearing chains, or the **triage/review comment URL** for no-PR chains (§1a). Never show a bare count or "—" when an artifact exists; the operator must be one click from the actual GitHub surface. **No-PR chains with `active: human-debate` (§1a) sort to the top alongside 🔼 rows and are NEVER collapsed** — a live discussion of our triage is exactly what must stay visible. `stood-down` / `advisory` / `triaged` no-PR chains may collapse into the `•` line like any other unchanged row, but their disposition (not a bare "•") rides in the trailing summary so a parked-handed-off chain reads as parked-with-reason, not vanished. The full narrative still goes in a file via `send_file(to="orchestrator", …)` (`to=` REQUIRED — see the `[MUST]` at the top of §6) — the inline table is a digest, not a replacement. **Post the inline table FIRST, then the file** — so an attachment failure can never swallow the board. **If nothing changed since the last tick, say so in one line and skip the table** — don't spend tokens re-rendering a static board. After the table, add a one-liner pointing at the full board (the on-disk tracker / dashboard) so the operator can drill down without you re-posting every row.

**[MUST] Build tier deep-links from the session's REAL folder — never assume it from the coworker-type name.** A coworker's dashboard link is `<dashboard-base>/#/cw/<folder>/s/<sessionId>`, and `<folder>` must be the **actual `agent_groups.folder`** for that session, resolved live (`ncl sessions list` exposes it, or `ncl groups get --id <agentGroupId>`). Do **not** derive the folder from the logical type — folders and type names can diverge (e.g. a group whose type/local-name is `slangpy-triage` may have been created with the folder `slangy-triage`). A link built from the assumed name 404s; a link built from the resolved folder always works, whatever the folder happens to be called.

```
| #    | repo        | tier       | github                | state            | last-active  | next                              |
| ---- | ----------- | ---------- | --------------------- | ---------------- | ------------ | --------------------------------- |
| 1349 | acme/widget | triage     | [triage cmt][c1349]   | active:debate    | 1.2h         | 🔼 live — @userA/@userB, watching |
| 1367 | acme/widget | fixer      | [PR #1386][p1386]     | pr_open          | 5m           | • watch CI                        |
| 1441 | acme/widget | triage     | [triage cmt][c1441]   | stood-down:ext   | 6h           | • external @author writing PR     |
| 1339 | acme/widget | maintainer | [proposal cmt][c1339] | advisory:maint   | 3.5d         | • maintainer @user on #1355       |

[c1349]: https://github.com/acme/widget/issues/1349#issuecomment-...
[p1386]: https://github.com/acme/widget/pull/1386
[c1441]: https://github.com/acme/widget/issues/1441#issuecomment-...
[c1339]: https://github.com/acme/widget/issues/1339#issuecomment-...
```

Note every `github` cell is a link (PR *or* triage comment), and the no-PR chains (#1349, #1441, #1339) carry an explicit disposition in `next` — the live-debate one (#1349) is a 🔼 lead row, the parked ones collapse but keep their reason.

Per-chain status messages land on each chain's canonical `thread_id` (per the `[MUST]` rule above) — the inline table is the supervisor's own consolidated digest in the supervisor's session.

### 7. Superseded-PR postmortem — learn when our work is overtaken

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

### 8. Worktree GC sweep — reclaim abandoned fixer worktrees

The fixer workflow GCs its own worktree when a `CLOSED`/`MERGED` webhook arrives — but only while its container is alive. The dominant leak is **terminal-PR orphans on dead sessions**: the PR merged/closed *after* the fixer went idle, so the self-clean never fired and its multi-GB `wt-*` / `active-work/` dirs sit on the worktree volume forever. (Abandoned / draft-forever / silently-superseded PRs leak the same way.) The supervisor is the recurring cron that owns this backstop — it reaps by waking the owning session, since a dead container is one inbound away from respawning.

**[MUST NOT] Never `git worktree remove` from the supervisor session.** Worktrees live in each *fixer's* filesystem (RO-mounted into yours), not yours, and cross-deletes have killed active builds. You *decide and dispatch*; the **owning fixer executes** in its own namespace — and a `stopped` session is reachable: writing it a GC inbound wakes a fresh container (host sweep) with the same workspace, so don't escalate "container gone" — wake it. Reap signal is **`gh` PR state, never git-prunable** (from your RO mount `git worktree list` marks nearly all `prunable` — a wrong-namespace artifact, the admin records the container path `/workspace/agent/wt-*`; meaningless to you).

**[MUST] Disk-pressure check — EVERY tick, BEFORE the per-chain GC pass below.** The worktree volume is mounted read-only into your container at `/workspace/extra/ephemeral` (host `/ephemeral`, where every fixer's `wt-*` lives). **Do NOT trust `df -h /workspace`** — your own `/workspace` is on a separate small disk (`/dev/vda1`) that always looks healthy; the fixers' worktree volume (`/dev/vdb`) is the one that fills and blocks every fixer. Read the real one:
```bash
df -BG --output=avail /workspace/extra/ephemeral | tail -1 | tr -dc '0-9'   # GB free on the worktree volume
```
- **Always** surface `worktree-vol: <N>GB free` in the board rollup (one number, every tick).
- **When free < 10 GB → DISK PRESSURE:** escalate to the operator now (`to="orchestrator-dashboard"`: `⚠️ worktree vol <N>GB free (<10GB) — reaping terminal worktrees`) AND run the GC pass below immediately (don't wait for the next tick), dispatching to every owning session at once. You still never delete yourself — the owning fixer executes.

Once per tick, discover the reap set **from disk, not the chain list** (orphan worktrees outlive their session — the bulk of the leak): `du -sh /workspace/extra/ephemeral/prod-groups/*/wt-* | sort -rh`, then resolve each `wt-<slug>` to a PR via `gh pr list --head fix/issue-<num>` (slang) or the dir's branch `dev/<coworker>/<slug>` (slangpy). **REAP** = PR `MERGED`/`CLOSED`; **KEEP** = PR `OPEN` or a `running` session for it (`ncl sessions list`); **NO-PR** = wake to confirm, never blind-delete. For each REAP/NO-PR worktree, dispatch ONE a2a to its owning session (wakes it if stopped) on its canonical thread:
> [Supervisor — worktree GC — gh-issue-X/Y-N] PR #<pr> is `<state>`; reclaim `wt-<slug>` (~<size>G). **Save-then-remove:** `cd /workspace/agent/wt-<slug>`; if `git status --porcelain` non-empty or ahead of upstream → `git add -A && git commit -m "wip(reap): <branch> @ <sha>" && git push -u origin HEAD:wip/reap/<branch>` (resume later via `git worktree add wt-<slug> wip/reap/<branch>`). THEN `git -C /workspace/agent/slang worktree remove --force /workspace/agent/wt-<slug> && rm -rf /workspace/agent/active-work/<slug>`. Reply 'gc done <freed>G', or 'active' to keep it.

Save-then-remove is mandatory: even *merged*-PR worktrees often hold untracked files (observed: 9) that `remove --force` would destroy. The `wip/reap/<branch>` namespace never collides with live `fix/issue-*` nor the `gh --head` lookups. Track `gcRequestedAt` per worktree in `supervisor-state.json`; if still on disk after 2 dispatches with no `gc done`, escalate to the operator with the `du`/`df` numbers + the `wt-*` list for host-side reclaim. Never escalate disk pressure silently — a filling volume blocks every fixer.

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
2. **`new_session: true`** — each tick starts clean. The supervisor needs **no** conversation memory; everything it must remember (nudge counts, `postmortem.done`, last-tick snapshots) is persisted in `supervisor-state.json`. Without this, the session transcript grows every 6h forever and each tick costs more than the last. **Because the tick has no memory, it MUST rediscover the chain universe live every time (§1) — `new_session: true` makes live `ncl sessions list` discovery mandatory, not optional.**
3. **Wake gate** — when nothing is stuck, the tick is a no-op (zero model tokens).
4. **Delta reporting** (§1, §6) — a tick that does wake reports only what changed, so even active periods stay cheap.

**[MUST] The cron prompt must mandate live discovery and must NOT frame the tracker as the universe.** Any custom prompt attached to the scheduled task (delivery/format directives etc.) must keep a `DISCOVER` step ahead of the refresh step. Use this skeleton — note `DISCOVER` precedes `SOURCE OF TRUTH`, and `SOURCE OF TRUTH` is explicitly scoped to "prior snapshot for deltas," never "the list of chains":

```
/supervise-issues

DISCOVER (do this FIRST, every tick): `ncl sessions list --thread-prefix "gh-issue-"` to enumerate ALL live chains, then UNION with supervisor-state.json. Any gh-issue session not already journaled is a 🆕 NEW chain — add + journal it this tick. NEVER take the chain universe from the tracker's existing rows; the tracker is the prior snapshot, not the chain list.

SOURCE OF TRUTH (for DELTAS only, not for the universe): read reports/issue-chain-tracker.md + memory/supervisor-state.json to compute what changed; refresh each discovered chain's row via live gh. If another session is mid-write, reconcile, don't clobber.

DELIVERY: post the board with send_message(to="orchestrator", text=<board>) or an inline <message to="orchestrator">…</message> block in the FINAL response. NEVER omit to=. NO send_file. Retry to="orchestrator" on "multiple destinations".

FINAL FORMAT … <the operator-locked 10-column sectioned board; see §6>
```

## Anti-patterns

- **Don't summarize history.** The supervisor reports CURRENT state. Past activity is in the dashboard / JSONLs.
- **Don't open new chains.** You only nudge existing ones. New chains come from webhooks.
- **Don't escalate before nudging.** Most stuck chains resume from a single nudge; escalation costs the operator's attention.
- **Don't route a nudge by `in_reply_to`.** It overrides `thread_id` and can land in a reused session for a different issue, mis-attributing any resulting PR. Always key nudges/dispatches by `thread_id`. (§3)
- **Don't multi-cast.** A nudge goes to one coworker (the one currently expected to respond), not the whole chain.
- **Don't loop.** If a chain has been nudged twice with no response, escalate — don't keep nudging.
- **Don't post the GitHub comment on a coworker's behalf.** Closest-to-the-state principle: the coworker holding the verdict authors the post. Supervisor enforces, doesn't substitute. (See step 5.)
- **Don't call `send_message`/`send_file` without `to=`.** The supervisor has multiple destinations; a bare call errors with *"specify 'to'"* and the board is silently never delivered. Always pass `to="orchestrator"` (the operator `#cw/orchestrator` channel; a delegated supervisor uses `to="parent"`), post the inline table before any attachment, and never let a `send_file` failure swallow the board. (§6)
- **Don't re-derive the board in-context or fan out across sessions.** Post the COMPLETE board verbatim from the on-disk `reports/issue-chain-tracker.md` (re-deriving yields incomplete/stale lists), in ONE session (no parallel supervise sub-sessions — fan-out produces many partial boards), exactly once, as the last step. (§6)
- **Don't postmortem twice, or for our own merged PRs / `not_planned` closes.** The postmortem fires once per chain, only when a *different* PR resolved the issue. (§7)
- **Don't `git worktree remove` from the supervisor session, and don't reap on git-prunable.** Worktrees belong to the fixers; dispatch the GC to the owning fixer (a `stopped` one wakes on the inbound) and let it save-then-delete its own. Reap by `gh` PR state, never the bogus `prunable` flag your RO mount shows. (§8)
- **Don't build the chain universe from the tracker — discover it live.** The tracker/state JSON is the *prior snapshot* for delta computation, not the list of chains that exist. Every tick must `ncl sessions list --thread-prefix "gh-issue-"` and union with the state JSON; "refresh changed rows via live gh" means refresh the snapshot's values, NOT limit the universe to rows already in the tracker. Skipping live discovery is what silently dropped ~16 minted chains on 2026-06-05 (§1). This is independent of `new_session: true` (which is correct).
- **Don't drop a chain just because it has no PR.** A triaged-then-handed-off issue (external contributor, maintainer-driving, live human debate, self-closed audit) is a real chain — journal it with its triage-comment artifact + disposition (§1a). Equating "trackable" with "has a `fix/issue-<num>` PR" is what made #11441 / #11349 / rhi#767 silently vanish from both the board and `supervisor-state.json`.
- **Don't show a bare count or "—" in the `github` cell when an artifact exists.** Always link the actual PR or triage comment — the operator must be one click from GitHub. (§6)
- **Don't collapse an `active: human-debate` no-PR chain.** A live discussion of our triage is a lead row, never folded into the `•` summary. (§1a, §6)

## State

Track which chains you've nudged and how many times in `/workspace/agent/memory/supervisor-state.json` (load at start, save at end). Per chain (`threadId` key), persist:
- `nudgedAt: [iso, ...]`, `escalatedAt: iso`, `lastObservedActivity: iso` — nudge/escalation bookkeeping.
- `githubCommentRequestedAt`, `githubCommentUrl` — step 5 observability enforcement.
- `postmortem: {done, supersededByPr, learningTitle, at}` — §7, fires once per chain.
- `disposition`, `githubArtifactUrl` — §1a, for **no-PR chains**: the disposition (`active:human-debate` / `stood-down:external-PR` / `advisory:maintainer-driving` / `triaged:awaiting-pickup` / `closed-by-us`) and the triage/review comment URL that serves as the chain's GitHub artifact. Terminal (`closed-by-us`) chains move to `_archived` with the URL + reason. **Invariant: every routed+triaged `gh-issue-` chain is in the in-flight set OR `_archived`, never absent from both** (§1a reconciliation).

**[MUST] One canonical path: `/workspace/agent/memory/supervisor-state.json`.** Do not also write a copy at the workspace root (`/workspace/agent/supervisor-state.json`) — a stale duplicate there caused a tick to nearly reconcile against day-old state (2026-06-05). If a root-level copy exists from an older tick, ignore it and treat `memory/supervisor-state.json` as authoritative; the human-facing board file stays at `reports/issue-chain-tracker.md`.

Load this file at the start of every tick and write it back at the end; the §7 idempotency (one postmortem per chain) depends entirely on it surviving across ticks. **Writing it back is not optional and is not enough on its own — it must contain the live-discovered universe (§1), not just the rows you inherited.** A faithfully-written state file that was never expanded with live session discovery is exactly the 2026-06-05 failure.

## When called manually

If invoked outside the cron (operator typed `/supervise-issues`), do the same scan but report ALL chains regardless of staleness — operator wants the full picture.
