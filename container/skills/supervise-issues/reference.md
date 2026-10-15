# supervise-issues — reference

Lookup tables, command snippets, and rationale for `/supervise-issues`. The SKILL.md body
states the rules and the procedure; this file holds the detail each step points to.

## Live discovery + the scan script

**`ncl` silently ignores unknown flags** — there is **no** `--thread-prefix`; passing it returns
*all* sessions, unfiltered. List with `--json` and filter the `gh-issue-` prefix **client-side**:

```bash
ncl sessions list --limit 10000 --json \
  | python3 -c 'import json,sys; print(json.dumps([s for s in json.load(sys.stdin)["data"] if (s.get("thread_id") or "").startswith("gh-issue-")]))'
```

**`--limit 10000` is mandatory** — the default is 200, which silently truncates and drops chains
from the universe (the #11802 incident: invisible for days because its session was beyond the
200-row default window).

`ncl sessions list --json` returns `{"id":…,"ok":true,"data":[…]}`; each session row has `id`,
`thread_id`, `container_status`, `last_active`, `agent_group_id`. Exact-column filters DO work
(`--container_status running`); only prefix matching is unsupported. Per-session last activity:
`ncl sessions messages --id <sess> --limit 1 --json`.

**Exhaustive pull (preferred).** Instead of assembling the chains payload by hand, pipe through the
bundled `scripts/pull-universe.sh` which calls `ncl` + `gh` for every chain deterministically:

```bash
bash scripts/pull-universe.sh --state memory/supervisor-state.json \
  | python3 scripts/scan.py > scan-out.json
```

This eliminates the sampling gap — every `gh-issue-*` session is fetched and classified. Closed
issues are filtered out automatically (the script reads `issue_open` from `gh issue view`). Use
this as the default path; fall back to manual assembly only if the script fails (e.g. `gh` auth).

**Enrichment is partial-tolerant (why the board no longer collapses to "N/M PRs").** The batched
GraphQL resolver uses `issueOrPullRequest(number:)`, not `issue(number:)` — a chain can be keyed on
a number that is actually a **PR** (a large fraction of active chains are), and `issue(number:)` is
strict-typed so it 404s on those. A PR-keyed chain's own PR becomes its artifact (`self_pr` →
`chain["pr"]`), which also stops `scan.py::we_owe_next_step` from false-flipping it to
`awaiting_us`. And `gh api graphql` returns **partial success** (HTTP 200 with a valid `data` object
*and* an `errors` array, exiting non-zero) whenever a few aliased numbers miss; `gh_graphql` now
**salvages** that data instead of discarding the whole batch — one unresolved number no longer wipes
PR discovery for the other 49. If you see a data-quality note about low PR-enrichment, the fix path
is here, not a blind re-run.

**Deterministic classification → `scripts/scan.py`.** Don't re-derive the set math and the activity
clock by hand each tick (that re-derivation is what produced the documented silent-2-days,
dark-for-days, and ~16-dropped-chains failures — see *Why these rules exist*). Assemble one JSON
payload and pipe it through the bundled script:

```bash
python3 scripts/scan.py < payload.json > scan-out.json   # python3 scripts/test_scan.py to validate
```

`scan.py` is **pure** (no network/subprocess; an `--now` override exists for tests). Input (stdin) —
its module docstring carries the full contract:

| field | what |
| --- | --- |
| `now` | ISO-8601 (with `Z`) tick time |
| `bot_logins` | optional; default `["nv-slang-bot[bot]", "nv-slang-bot"]` (App + user PAT — both are "us") |
| `state` | prior `supervisor-state.json` (`{}` on first run) |
| `sessions` | the `gh-issue-`-filtered `ncl sessions list` rows, each also stamped with `cost_status` (`'ok'`\|`'warn'`\|`'escalated'`\|`'stopped'`\|`'unknown'`) via `ncl cost-cap status --session <id>` |
| `chains` | per `gh-issue-…` thread: `{repo, issue, sessions[], our_last_outbound, our_last_push, pr:{number,state,isDraft,fixes_issue}, comments:[{author,at,is_bot,kind}], pending_ask_user, disposition?}` |

Output: `{rows, summary, state}`. Each row → `state` (`awaiting_us`/`awaiting_human`/`silent`/
`pr_open`/`cost_stopped`/…), `ball` (`ours`/`human`/`none`), `delta` (`new`/`updated`/`same`),
`last_activity_by_us`, `needs_nudge` + `nudge_reason`, `escalate` + `escalate_reason`,
`github_artifact`, `disposition_expired`, `mis_threaded`, `needs_cost_notice`. Write `state` back to
`supervisor-state.json`. The script decides
*which* rows need a nudge and *why* — **you** still compose and thread-key each nudge (Step 3) and
make every judgment call (substantive-comment decisions, escalation wording). `needs_cost_notice` is
the one exception where the script also decides *when to post*, not just *whether* — see *Cost-stopped
chains* below — because that dedup has to be exact, not judgment-called.

## Resolving a chain's real PR

The fixer branches as `fix/issue-<num>`. Find the PR by head branch, then confirm which issue it
actually fixes from the PR body — the body's `Fixes #N` is the authoritative PR↔issue link, not
the `thread_id`.

```bash
gh pr list --repo <owner>/<repo> --head fix/issue-<num> --state all \
  --json number,isDraft,state,title,headRefName
gh pr view <pr> --repo <owner>/<repo> --json body --jq '.body' \
  | grep -ioE '(fixes|closes|resolves) #[0-9]+'
```

- Body names a *different* issue than the `thread_id` → mis-threaded (reused session). Record the
  chain under the issue the PR actually fixes and flag it.
- `gh pr list --head` returns nothing → the chain has no PR yet (normal pre-PR state, not a
  mismatch). Treat it as a no-PR chain (see disposition table below).

Pull last activity per session with `ncl sessions messages --id <sess> --limit 1`.

## No-PR chain dispositions

A chain with no `fix/issue-<num>` PR is journaled like any other; its GitHub artifact is its
triage/review comment URL, and its `next` field carries the disposition so the operator sees at a
glance whether it is live or parked-and-why.

| Disposition | Meaning | `next` shows | Board behavior |
|---|---|---|---|
| `active: human-debate` | maintainers/reporters discussing our triage | "live debate — maintainers, watching" | lead row — never collapse |
| `stood-down: external-PR` | we triaged; an external contributor owns the impl | "external contributor writing PR — watch for it" | tracked-parked; surface if their PR stalls |
| `advisory: maintainer-driving` | we advised; a maintainer is driving their own fix | "maintainer on #M — no action" | tracked-parked |
| `triaged: awaiting-pickup` | triage posted, nobody has picked it up | "triaged <date>; no owner yet" | tracked-parked; nudge if very old |
| `closed-by-us` | we self-resolved (audit "no change", wontfix-after-analysis) | "audit/analysis terminal — closed by us" | terminal → `_archived` |

Persist each no-PR chain under its `gh-issue-…` key with `{disposition, githubArtifactUrl,
lastObservedActivity}`. Terminal (`closed-by-us`) chains move to `_archived` with a one-line
reason + the comment URL. Invariant: every routed+triaged issue is in the in-flight set OR
`_archived`, never absent from both.

**Self-stop dispositions expire.** `scan.py` stamps each disposition with `dispositionAt` (kept
while the text is unchanged; a new, changed or legacy unstamped one is stamped at that tick). A
disposition that records *our own* stop — token `stood-down`, `closed-by-us` or `awaiting-pickup`,
and none of `human-debate` / `external-pr` / `maintainer-driving` / `advisory` — **expires once
`last_activity_by_us` is later than its stamp**: it is treated as absent, dropped from the next state,
and the row carries `disposition_expired: <old text>` (`scan.py::disposition_expired`). Do not re-add
an expired disposition; record a new one only for a new stop decision. Human-owner dispositions never
expire. Root of #13073: a 09-14 NO-GO kept the chain parked through the fixer's resumed work and five
silent days.

## Classification states + thresholds

`last_activity_by_us` = the most recent of our outbound on the session, our commit/push on the PR
branch, or a comment/review authored by the bot. Direction of the ball: fetch the latest
issue/PR comment + review; if the latest actor is a non-bot with no bot reply/commit/push after
it, the ball is ours.

```bash
gh issue view <n> --repo <owner>/<repo> --json comments --jq '.comments[-1]'
gh pr view <pr> --repo <owner>/<repo> --json reviews,comments
```

| State | Condition | Action |
|---|---|---|
| `cost_stopped` | any session on the chain has `cost_status == 'stopped'` — checked BEFORE every other rule below, regardless of ball direction or staleness | never nudge/escalate; post one factual notice on the tick it (re-)enters this state (Step 3) |
| `dispatched` | < 5 min ago | fresh — leave alone |
| `triaging`/`fixing`/`reviewing`/`pr_open` | < 60 min since `last_activity_by_us` | working — leave alone |
| `awaiting_human` | pending `ask_user_question`, OR bot spoke last and we await a human — **except** the fixer-owned carve-out below | leave alone — blocked on operator/maintainer |
| `awaiting_us` | latest actor is a non-bot, unanswered by us; ball in our court | STUCK regardless of how recent — nudge owning tier now (Step 3); does not wait for any stale window |
| `silent` ≥ 60 min | no `last_activity_by_us`, ball not cleanly on a human | stuck — investigate (container running? last msg answered? `[Refusal]`/`[not actionable]`?) then soft-nudge deepest tier |
| `silent` ≥ 4 h | as above, escalated | escalate via `ask_user_question(timeout: 0)`: extend / re-dispatch from triage / close (out of scope) / abandon |
| nudged, no progress ≥ 24 h | still needs a nudge but held by the nudge cooldown (already nudged, nothing external since) and the newest `nudgedAt` is ≥ 24 h old | `escalate=true` + `escalate_reason` — escalate as above and record `escalatedAt` (fires once per episode) |
| `closing` | final `[Report]`, PR opened, or refusal landed | run Step 5 comment-verification before dropping off the table |
| `closed_no_github_comment` | Step 5 found no comment | nudge responsible coworker; escalate if unmet after 2 nudges |

Discriminator for `awaiting_human` vs `awaiting_us`: **who spoke last.** Bot-last =
`awaiting_human`; human-last-unanswered = `awaiting_us`. A `pr_open` chain with a trailing
unanswered human comment is `awaiting_us`, never watch-only.

**Fixer-owned carve-out (bot-last is ambiguous).** Bot-last is not automatically "leave alone."
A bot's last word is either a genuine handoff to a human *or a promise we still owe* ("Will update
here when the PR is up"). So a bot-last chain flips to `awaiting_us` (nudge the fixer) when **all**
hold: a **fixer-role session** owns the thread, **no live PR** exists (no owed artifact — only an
`OPEN` or `MERGED` PR counts; a `CLOSED`-unmerged one does not), **no human-owned disposition** says
a human is driving, and it has been **silent ≥ 60 min by us**. This
is computed deterministically in `scan.py::we_owe_next_step` and was the root cause of slang#12002
(fixer edited code, said "waiting on the build monitor", idle-exited, and was never woken because
bot-last read as `awaiting_human` forever). Human-owned dispositions that keep a bot-last chain
parked: `active:human-debate`, `stood-down:external-PR`, `advisory:maintainer-driving`,
`triaged:awaiting-pickup`, `closed-by-us` (matched on the tokens `human-debate`, `external-pr`,
`maintainer-driving`, `awaiting-pickup`, `closed-by-us`, `stood-down`, `advisory`). These
dispositions are **rehydrated by `pull-universe.sh` from the prior tick's state** before
classification — without that, the gate saw `None` every tick and over-flagged (the Tick-86 105→1
reconciliation noise). The self-stop ones (`stood-down` / `closed-by-us` / `awaiting-pickup`) expire
on our own later activity — see *No-PR chain dispositions*.

**Bounce limb (additive to the carve-out).** The silence-clock condition is *relaxed* when the
owning container is `stopped` **and** its last outbound classed as an error
(`last_outbound_error_class` ∈ `transient`|`unknown`, set by `pull-universe.sh` from the newest
outbound text, mirroring the container's `transient-error.ts`). Such a chain has *bounced* — an a2a
handoff that errored on a transient auth/provider outage (the #12097 shape) — and will not
self-recover, so it flips to `awaiting_us` even inside the fresh window. This is belt-and-suspenders
with the **host-side a2a redrive** (once that ships): the host re-drives bounced handoffs directly in
the session layer; the supervisor is the fallback for bounces that surface as issue chains. `scan.py`
emits the per-row decision as `action` (`nudge` iff `needs_nudge`, else `none`) with an enum
`non_nudge_reason` (`human-owned:<disp>` | `pr-open` | `running` | `fresh-dispatch` |
`awaiting-human` | `cost-stopped` | `terminal`); Step 3 acts on `action`, and `summary.must_nudge` is
the fails-loudly reconciliation target.

**Cost-stopped chains (highest priority — evaluated before the carve-out and the bounce limb).** A
session that hit its Tier-2 cost ceiling is hard-blocked pending a human Continue/Stop decision on the
dashboard's cost-approval card — it will not process another turn no matter who spoke last on GitHub
or how long it's been quiet, so `scan.py::any_session_cost_stopped` short-circuits `classify()` before
any of the ball-direction branches run. This is a **policy/runtime** stop, orthogonal to both existing
liveness signals: `container_status` (from `ncl sessions list`) only tracks whether the container
*process* exited — a cost-stopped session commonly still reads `running`, since the runner ends the
in-flight turn and refuses to spend further without necessarily exiting — and
`last_outbound_error_class` infers a *bounced handoff* from outbound text, a different failure mode
entirely. Neither one would have caught this case, which is exactly why `cost_status` is its own field
(`pull-universe.sh` stamps it per session via `ncl cost-cap status --session <id>`, sourced from the
same `outbound.db` `session_state.cost_cap` row the dashboard's cost-approval card reads) rather than
overloading either existing signal.

The row's `needs_cost_notice` field is the dedup gate for the one-line comment Step 3 posts — `true`
only on the tick the chain's `state` transitions into (or changes within) `cost_stopped`, reusing the
same `delta`/`lastState` tracking `scan.py` already computes for the board's 🆕/🔼/• tags rather than
adding a second clock. `escalate` is always `false` for a `cost_stopped` row (it's gated on
`state == 'silent'`, which this never is) — the dashboard card already owns escalating this to a
human; `ask_user_question` would just duplicate it.

## GitHub-comment existence test (Step 5)

A chain is observably closed when the originating issue/PR carries a 5-bullet markdown comment
authored by the install's bot (or the maintainer account the chain uses), OR a linked PR
(`Fixes #N` / `Closes #N`) whose description carries the rolled-up summary.

```bash
curl -sS -H "Authorization: token $GH_APP_TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/issues/<num>/comments?per_page=20" \
  | jq -r '.[] | select(.body | startswith("- **Status:**") or contains("[Report]")) | .id'
```

For `pr_open`, the PR description IS the comment — verify it exists and contains `Fixes #N` /
`Closes #N`. If the PR exists but the issue link is missing, nudge the fixer to amend the PR
body, not to add a separate issue comment.

Nudge body when absent (send to the responsible coworker, not orchestrator):

> [Supervisor — gh-issue-X/Y-N] Chain reached `<state>` but no GitHub comment found. Post the
> 5-bullet (status / link / verdict / next-action / blocker) on
> https://github.com/X/Y/issues/N before this chain closes. Reply with the comment URL once posted.

Track `{githubCommentRequestedAt, githubCommentUrl}`; if still missing after 2 nudges, escalate
via `ask_user_question(timeout: 0)`: post on coworker's behalf / close anyway / investigate.

## Superseded-PR postmortem (Step 7)

Detect: an issue closed by a PR that is **not** our chain's PR (or our PR closed un-merged while a
sibling merged). `closedByPullRequestsReferences` is the container-proven field (`timelineItems`
is NOT a valid `gh issue view` field).

```bash
gh issue view <num> --repo <owner>/<repo> \
  --json state,stateReason,closedByPullRequestsReferences \
  --jq '{state, stateReason, closers: [.closedByPullRequestsReferences[].number]}'
# closers contains a PR != ours, OR ours CLOSED-unmerged while another merged → postmortem.
# closers == [ours] or empty → no postmortem.
```

Fires once per chain (gate on `supervisor-state.json` `postmortem.done`). Skip for our own merged
PRs and for `not_planned` closes without a PR (maintainer wontfix — note and close normally).

1. **Analyze the gap.** Compare diffs (`gh pr diff <ours>` vs `gh pr diff <theirs>`); be specific
   about what the merged fix did that ours didn't (root-cause, smaller patch, a test we missed).
   If the merged PR overlaps ours heavily, @-mention the author on their PR to ask what gap ours
   would have had — capture the reply into the takeaway.
2. **`append_learning`** titled `postmortem: <repo>#<num> superseded by PR #<theirs>` — issue, both
   approaches + links, the concrete delta, author feedback, and an actionable transferable rule.
3. **Close our draft with a pointer** linking the learning + superseding PR:
   `gh pr close <ours> --repo <owner>/<repo> --comment "Superseded by #<theirs> … Postmortem captured as <title>."`
4. **Record** `postmortem = {done, supersededByPr, learningTitle, at}` and drop the chain.

## Worktree GC (Step 8)

Every tier (slang-fixer, slang-reviewer, slang-triager, slangpy-fixer, slangpy-reviewer,
slangpy-triager) runs `scripts/worktree-gc-run.sh` as the pre-task gate of an hourly task inside
its own container, where its group directory is writable. The script discovers the tier's
worktrees, measures idleness, resolves issue/PR state with `gh`, classifies with
`scripts/worktree-gc.py`, acts within the gate's time box, and writes
`/workspace/agent/.worktree-gc/last-run.json` plus a line in `history.log`. It wakes the agent
only when an action errored or less than 10% of the volume is free.

Tiers (thresholds live in `worktree-gc.py`; reference them by name):

| Tier | What | Action |
|---|---|---|
| REAP | primary fix tree whose PR is MERGED/CLOSED or whose issue is CLOSED with no PR; primary tree with no PR idle > `NOPR_IDLE_DAYS`; scratch tree (`wt-<n>-verify`, `-master`, `-revA`, `wt-clarity-*`, any non-primary name) whose PR is final or that is idle > `SCRATCH_IDLE_DAYS` | uncommitted work committed to a local `wip/reap/<name>` branch, then `git worktree remove --force`; `active-work/<slug>` removed |
| STALE-OPEN | primary tree, PR OPEN but idle > `STALE_OPEN_IDLE_DAYS` | `rm -rf <worktree>/build` only; tree, branch and PR stay |
| KEEP | running session, anything touched within `MIN_IDLE_DAYS`, active open PR, scratch in use | nothing; when free space is below `PRESSURE_GATE_PCT` of the volume, builds of KEEP trees whose PR is idle > `PRESSURE_IDLE_DAYS` are reclaimed too, until `TARGET_FREE_PCT` is free |
| NO-PR | primary tree, issue open, no PR yet | nothing until idle > `NOPR_IDLE_DAYS` |

Resume a reaped tree with `git worktree add <dir> wip/reap/<dir>` from the base clone.

Create or repair a tier's task (host shell):

```bash
./bin/ncl tasks create --group <ag-id> --name worktree-gc --recurrence "7 * * * *" \
  --script 'exec bash /app/skills/supervise-issues/scripts/worktree-gc-run.sh --gate' \
  --prompt 'The worktree GC gate woke you: data.errors > 0 or less than 10% of the volume is free. Read /workspace/agent/.worktree-gc/last-run.json; fix what blocks a removal (a locked worktree, a failed commit) or, below 10% free, report disk pressure to the orchestrator with the free figure.'
```

One-time catch-up on a tier (host shell, runs the same script without the time box):

```bash
docker run --rm --entrypoint bash -e GH_TOKEN="$(gh auth token)" \
  -v /ephemeral/prod-groups/<folder>:/workspace/agent -v "$PWD/container/skills:/app/skills:ro" \
  nanoclaw-agent:prod /app/skills/supervise-issues/scripts/worktree-gc-run.sh --sweep
```

### Operator-only reclaim (escalate, never attempt)

The worktree GC is the only disk lever available from inside a container. The docker data-root at
`/ephemeral/docker` (image layers + build cache) is `drwx--x--- root`: a container cannot list or
prune it. A daily host timer (`nanoclaw-docker-gc.timer`, `~/.config/nanoclaw/docker-gc.sh`) prunes
dangling images and build cache; tagged-but-unused images need an operator's deliberate
`docker image prune -a`. When less than 10% of the volume is free and the tiers' reports show nothing left
to reclaim, say so explicitly:

> Disk pressure: `worktree-vol` NN GB free; the tiers' GC reports show MM GB left to reclaim. The
> remaining lever is docker images/build-cache under `/ephemeral/docker`, which needs a host-side
> `docker image prune -a` (operator-only; verify no idle group needs its `ag-*` image first).

## CI status + rebase nudge

The orchestrator reads CI from its own container — `gh` works there with the injected token, so
there is no dependency on the babysitter (which runs its own separate rerun/eviction job). Our PRs
sit in **draft** and drive CI by **`workflow_dispatch`**, so the signal is the *latest run for the
`fix/issue-<num>` branch*, considering **both events but ignoring `skipped`** (a draft PR's
auto `pull_request` run is often `skipped` and would otherwise mask the real dispatch result).

```bash
# 1) latest non-skipped CI run for the branch (both events)
run=$(gh run list --repo <owner>/<repo> --branch fix/issue-<num> --workflow ci.yml --limit 20 \
  --json databaseId,event,status,conclusion,createdAt \
  --jq '[.[] | select(.conclusion != "skipped")] | sort_by(.createdAt) | last')
# 2) only when that run is a failure, is the failing job the yield gate?
gh run view <databaseId> --repo <owner>/<repo> --json jobs \
  --jq 'any(.jobs[]; .name == "wait-for-human-priority" and .conclusion == "failure")'
# 3) is the green PR behind main?
gh pr view <pr> --repo <owner>/<repo> --json mergeStateStatus --jq .mergeStateStatus
```

### The yield mechanism

The bot throttles its own draft CI: a `wait-for-human-priority` gate job runs first, and when a
human PR's CI (or an older bot run) is active it **yields** — the run ends with
`conclusion: failure` on purpose (a "Stop yielded bot CI" step does `exit 1` and annotates
`priority-gate-yielded`). There is no `yielded` conclusion; a yield is a `failure` whose failing
job is the gate. The gate only applies to the bot's own `workflow_dispatch` runs — a
`pull_request` run or a ready-for-review PR is treated as human and never yields. A dedicated
`retry-yielded-bot-ci.yml` (hourly, ages out at 12h) reruns yielded runs automatically, so the
supervisor must **show but never act** on a yield.

### CI cell legend + nudge decision

| Latest run / signal | How to tell | CI cell | Nudge? |
|---|---|---|---|
| yielded | latest run `failure` AND failing job is `wait-for-human-priority` | ⏸️ yielded | no — auto-retry owns it |
| running | latest run `in_progress`/`queued` | ⏳ running | no — wait |
| green | latest run `success`, `mergeStateStatus` not `BEHIND` | ✅ green | no |
| green but behind | `success` AND `mergeStateStatus=BEHIND` | ✅⤵️ behind | yes → rebase |
| failed/cancelled, stale | latest run `failure` (non-gate) or `cancelled`, AND same `databaseId` as last tick | ❌ stale | yes → rebase |
| failed/cancelled, fresh | bad conclusion but a newer `databaseId` than last tick | ❌ (recheck) | no — already re-dispatched |
| no run / only skipped | nothing dispatched yet | ⚪ — | no |

Store the latest run `databaseId` per chain in `supervisor-state.json`; "stale" = the bad run is
the *same id* we saw last tick (nobody re-dispatched). The rebase nudge body is in SKILL.md Step 3.
The remedy is always rebase/merge master — never `gh run rerun` from the supervisor (R9).

## 11-column board spec

Canonical schema, rendered every tick — the same the scheduled-task prompt pins:

```
Issue#(link) | Title (short) | Orch | Triage | Fixer | Rev | Github | CI | Status | State/Disposition | Next
```

- **Orch / Triage / Fixer / Rev** are clickable session deep-links
  (`<dashboard-base>/#/cw/<folder>/s/<sessionId>`; `—` if no session for that tier). Build
  `<folder>` from the session's real `agent_groups.folder` (resolve live via `ncl sessions list`
  or `ncl groups get`), never from the coworker-type name — folders and type names can diverge and
  a guessed folder 404s.
- **Github** is always a live hyperlink to the artifact — the PR for PR-bearing chains, or the
  triage/review comment URL for no-PR chains. Never a bare count or `—` when an artifact exists.
- **CI** is the cell from the legend above (✅ / ✅⤵️ / ❌ / ⏳ / ⏸️ / ⚪); `—` for no-PR chains.
- **Status** and **State/Disposition** are distinct columns — do not duplicate one into the other:
  - **Status** = the *latest observed signal*, free-text with **actor-role + what + time** — e.g.
    "maintainer APPROVED 17:08Z", "non-draft; reviewer round-trip 11:16Z→bot 11:19Z (bot-last)". It
    is the human-readable "what just happened." (Use role words — maintainer / reviewer / external /
    bot — in the spec; live ticks may name the real GitHub login.)
  - **State/Disposition** = the *canonical state value* the row classifies to — `pr_open`,
    `awaiting_us`, `in review`, `APPROVED`, `silent`, or a no-PR disposition (`active:human-debate`,
    `stood-down:external-PR`, `advisory:maintainer-driving`, …). It is the machine-comparable state
    the delta and the nudge logic key on.
  - If a row has the *same* token in both cells (e.g. both `pr_open`), the Status cell is unfilled —
    replace it with the real latest signal (actor + timestamp), never echo the state.
- One row per chain, prefixed with its delta tag (🆕 / 🔼 / •); sort 🆕 and 🔼 to the top.
- The 6-column `# | repo | tier | github | state | next` shorthand is non-conformant — it hides
  which tier owns the chain. Do not use it.

Worked example:

```
| #    | Title        | Orch | Triage | Fixer | Rev | Github              | CI    | Status                              | State/Disposition  | Next                              |
| ---- | ------------ | ---- | ------ | ----- | --- | ------------------- | ----- | ----------------------------------- | ------------------ | --------------------------------- |
| 1349 | parser crash | [o]  | [t]    | —     | —   | [triage cmt][c1349] | —     | maintainer design proposal 21:16Z   | active:human-debate| 🔼 live debate — watching         |
| 1367 | bad codegen  | [o]  | [t]    | [f]   | [r] | [PR #1386][p1386]   | ✅⤵️  | green but BEHIND main 14:02Z        | awaiting_us        | 🔼 nudged fixer: rebase master    |
| 1372 | wrong types  | [o]  | [t]    | [f]   | —   | [PR #1390][p1390]   | ❌    | CI failed 12:52Z, same run 2 ticks  | awaiting_us        | 🔼 nudged fixer: CI stale, rebase |
| 1380 | infer fixity | [o]  | [t]    | [f]   | —   | [PR #1393][p1393]   | ⏸️    | yielded to human CI 11:19Z          | pr_open            | • auto-retry owns it, watch       |
| 1441 | doc typo     | [o]  | [t]    | —     | —   | [triage cmt][c1441] | —     | external contributor opening PR     | stood-down:ext     | • external PR incoming             |

[c1349]: https://github.com/acme/widget/issues/1349#issuecomment-...
[p1386]: https://github.com/acme/widget/pull/1386
[p1390]: https://github.com/acme/widget/pull/1390
[p1393]: https://github.com/acme/widget/pull/1393
[c1441]: https://github.com/acme/widget/issues/1441#issuecomment-...
```

**Collapsing is a delta-display convenience in chat only, never a coverage reduction in the
file.** Every live chain appears as a full 11-column row in `reports/issue-chain-tracker.md` each
tick; the inline chat board may fold unchanged `•` rows into one trailing line
(`• 7 chains unchanged: #1372, #1380, …`) after the file is written. 🆕 NEW rows and
`active: human-debate` rows are never collapsed in either place; parked dispositions
(`stood-down`/`advisory`/`triaged`) may fold but ride their disposition (not a bare `•`) in the
summary.

## Delivery (Step 6)

The main operator destination is the channel named `orchestrator-dashboard` (the operator's
dashboard view). A delegated supervisor that is not the orchestrator uses `to="parent"` instead.

- `send_message(to="orchestrator-dashboard", text=<the board>)` — inline board is the primary
  deliverable.
- The on-disk `reports/issue-chain-tracker.md` is the backup; optionally
  `send_file(to="orchestrator-dashboard", path="reports/issue-chain-tracker.md", text=<one-line digest>)`.
- Post the inline board FIRST, then the file, so an attachment failure can never swallow the
  board. Retry `to="orchestrator-dashboard"` on a "multiple destinations" error.
- Run the whole tick in one session — one session → one complete board → one delivery.

5-bullet summary that follows the inline table:

- **Status:** {n} chains in flight, {nudged} nudged, {escalated} escalated, {cost_stopped} cost-stopped
  (from `summary.cost_stopped`); `worktree-vol: <N>GB free`
- **Link:** dashboard timeline filtered to `gh-issue-*` threads
- **Verdict:** healthy / degraded / blocked
- **Next-action:** wait for cron / await operator decisions / re-dispatch chain X
- **Blocker:** threads with no clear path forward (list 3 max, one line each)

If nothing changed since the last tick, say so in one line and skip the table.

## Why these rules exist (de-identified rationale)

Each rule traces to a recurring failure pattern. The pattern is what matters; the specific
incidents live in operator memory.

- **R1 — live discovery.** A tick that "refreshed only the rows it already had" from the tracker
  silently dropped a batch of newly-minted chains: each had a live `gh-issue-` session but was
  never in the tracker, so refreshing-known-rows never saw it. Inheriting the universe from the
  tracker is the bug; live session enumeration unioned with the state keys is the fix. This is
  independent of `new_session: true` (which is correct) — the fresh session is exactly why live
  rediscovery is mandatory.
- **R2 — key-based dedup.** A chain mentioned in a narrative/awareness note before its session
  existed had its issue number present as a substring in the state file; a later tick treated the
  substring as "already journaled" and never gave the chain a top-level key, so it was never
  artifact-checked or nudged while it aged. Dedup is a set operation on keys, never a substring
  scan of prose. An "awareness: session pending" note is re-evaluated every tick and is promoted
  to a tracked chain the instant a session exists.
- **R3 — resumable artifact / no-PR chains.** Equating "trackable" with "has a `fix/issue-<num>`
  PR" made triaged-then-handed-off chains (external contributor, maintainer-driving, live human
  debate, self-closed audit) vanish from both the board and the state file — so when a handoff
  later stalled, nobody resurfaced it. Every routed+triaged issue has a GitHub artifact (its
  triage comment) and belongs on the board with a disposition.
- **R4 — activity by us.** Computing "silent" off the chain's last touch of any kind let a dark
  chain look freshly active: every time a maintainer asked "why no progress?", a last-touch clock
  was pushed forward while our owning session was dead. The clock only resets on our own output.
  A fresh non-draft PR with same-day human activity can still be fully dark on our side —
  `awaiting_us` catches it without waiting for any stale window.
- **R5 — thread-keyed routing.** `in_reply_to` (routing Layer 1) overrides `thread_id`, and
  coworker sessions are reused across issues — so a nudge for issue N routed by the coworker's
  last inbound landed in a different issue's session, which then did N's work under the wrong
  thread and stamped a resulting PR with the wrong issue. Always key by the chain's canonical
  `thread_id`; never add `in_reply_to`.
- **R6 — closest-to-the-state authorship.** Relaying a comment second-hand drops fidelity and
  creates recipient ambiguity ("did the supervisor read the code or just the `[Report]`?"). The
  coworker holding the verdict authors the post; the supervisor enforces, never substitutes.
- **R7 — single delivery.** A bare `send_message`/`send_file` with no `to=` errors on "multiple
  destinations" and the board silently never lands. Re-deriving the table in-context yields an
  incomplete/stale board; fanning out across sessions yields many partial boards. Deliver once,
  `to="orchestrator-dashboard"`, verbatim from the on-disk tracker, from one session.
- **R8 — worktree ownership.** Worktrees live in each fixer's filesystem (read-only-mounted into
  the supervisor); a cross-namespace `git worktree remove` has killed active builds. From the RO
  mount nearly every worktree shows `prunable` — a wrong-namespace artifact, not a reap signal.
  Decide and dispatch to the owning fixer (a `stopped` session wakes on the inbound); reap by `gh`
  issue state + PR state (issue CLOSED → reap regardless of PR state).
- **R11 — re-chase cap.** A parked chain's one-shot re-chase scheduled its successor on every
  fire, and nothing cancelled it when the issue closed: on 2026-10-15 the orchestrator held ~110
  live re-chases (several for closed #13230/#13338/#13306) and chains on their 4th/7th/15th
  round. A chain re-chased three times without movement needs a human decision, not a fourth
  ping — hence the weekly parked-chains digest.

## Re-chase hygiene (R11)

`scripts/task-hygiene.py` is the gate of the orchestrator's hourly `task-hygiene` task (creation
command in SKILL.md → *Re-chase one-shots*). Constants live in the script: `MAX_RECHASES` (3;
env `TASK_HYGIENE_MAX_RECHASES` or `--cap N`), `DIGEST_EVERY_DAYS` (7), `GATE_BUDGET_S` (240 —
the task script carries `# nanoclaw-task-timeout: 300`).

| Step | Rule |
|---|---|
| Allow | name slug `rechase*` / `re-chase*` / `recheck*` / `re-check*`, `watch-<n>*`, `i<n>-*` / `issue<n>-*` / `pr<n>-*`, or a prompt opening "Re-chase"/"Re-check". `CORE_GUARD` (supervise, okf, synthesis, worktree, nightly, kb-sync, release, report, heartbeat, watchdog, hygiene, memory, digest, babysit, scan) vetoes on top — anywhere in the name, or as a whole word in the prompt's first line (so keep those words out of a re-chase's opening line). A one-shot is a `rechase`; a recurring match is a `watch` (closed-GC only, no cap). |
| Prompt | `ncl tasks list` truncates prompts at 120 chars; full prompts come from `ncl tasks get`, cached in state by series id + listed prefix. Fetches past the time budget defer to the next fire. |
| Targets | Structured refs: `gh-issue-<owner>/<repo>-<n>`, `gh-pr-…`, `owner/repo#n`, github.com issue/pull URLs, `owner/repo [draft] PR #n`, and the shader-slang short forms `slang#n` / `slangpy#n` / `slang-rhi#n` (also `slangpy PR #n`). The first shader-slang ref is the **primary** (chain key); every shader-slang ref is a target; other orgs (llvm/…, KhronosGroup/…) are informational — never targets, never ambiguity. Bare `#n` (3–6 digits) join the primary's repo when every shader-slang ref is in that repo and no other shader-slang repo is named in words; otherwise the task is ambiguous and kept. Ranges (`#901-#906`) and short numbers (`#4`, `#77`) are context and ignored. No structured ref: bare refs (the name's number first) against the one repo the text names, else `shader-slang/slang`. Measured on the 73 prod prompts the first release left unresolved: 65 now resolve (`scripts/fixtures/`). |
| Ordinal names | A name ordinal counts only as the LAST slug segment (`rechase-…-r4`) and not when the prompt carries a capital `R<k>` label — `rechase-13596-r6-gate` is rule R6, not round 6. |
| Closed | One GraphQL `issueOrPullRequest` batch per 40 refs. Cancel only when every target is CLOSED/MERGED; any OPEN keeps it; unknown state with none OPEN is reported `unresolved` and kept. |
| Cap | Ordinal per re-chase series, assigned on first sight and never lowered: declared (`-r<k>` in the name; `(r<k>)`, "<k>th re-chase", "re-chase #k" in the prompt) else chain max + 1. Ordinal − chain `base` > `MAX_RECHASES` → cancel + park. `unpark` sets `base` to the current max (a fresh allowance; names keep counting). |
| Digest | Parked chains whose targets close drop out. With parked chains present and the last digest ≥ 7 days old, the gate wakes the agent with `data.digest`; `reports/parked-chains.md` is rewritten every fire either way. |

The orchestrator's side (R11): `task-hygiene.py next <ref>` prints `{allowed, count, name,
prompt_prefix, thread_id}` and exits 3 at the cap, parking the chain on the spot. An allowed
answer **reserves** the ordinal in the state file at once, so call `next` only when about to
schedule and reuse the returned name if the create must be retried. The gate is the backstop for
re-chases scheduled without `next`; a one-shot that fires within the hour it was created is never
seen by the gate, so `next` is what keeps the count exact.

Fail-safe behaviour: cached prompts only plan — a cancel re-fetches the full prompt first and
defers if its targets changed; GitHub lookups, prompt fetches and cancels are admitted only while
one more 40 s call fits the budget (the rest retries next fire); a corrupt state file is never
reset — the gate wakes the agent with `state unreadable` and does nothing until it is fixed.

Operator commands (inside the orchestrator container): `task-hygiene.py --dry-run` (plan only),
`task-hygiene.py unpark <ref>`; `/workspace/agent/.task-hygiene/history.log` lists every
cancellation with its reason.
