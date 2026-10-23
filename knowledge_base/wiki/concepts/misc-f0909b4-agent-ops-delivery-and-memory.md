---
title: Agent ops — a2a delivery diagnosis, heartbeat health, CI-ops signatures, OKF memory synthesis, and communication discipline
type: concept
group: misc
tags: [a2a, delivery, redrive, heartbeat, ci-health, gcp-quota, rate-limit, okf-synthesis, memory, triage, singular-they]
source_count: 14
---

## TL;DR

Operational lessons for running the coworker fleet — delivery/liveness diagnosis,
CI-health monitoring signatures, memory-tree maintenance, and communication:

- **A redrive "NOT delivered" notice is an ack-inference, not an inbox
  measurement.** It returns the same string whether the message is truly absent
  (delivery fault → re-send) or present-but-unprocessed (processing fault →
  respawn/credential-fix). Check the recipient's inbound DB before escalating or
  restarting. A "dark" agent group (all sessions stopped) is not a "down" one —
  find one recent outbound turn to prove idle-vs-broken; for a wedged
  session, ask the operator to reset it rather than re-driving it forever; never
  start a second session for the item.
- **A heartbeat watermark can stay fresh through a multi-day silent gap** — the
  precheck script stamps it on its own quiet-path branch. The reliable signal is
  the report-log mtime advancing.
- **CI-ops signatures**: GCP GPU quota-ceiling (busy==total + queued monotonically
  growing + usage==limit) is a distinct backlog from starved-vs-no-demand; the
  Actions API can 403 per-path while `/rate_limit` shows headroom; a full-duration
  external pipeline failure is isolated to the PR if it's the only red across all
  open PRs; a "pinned" clone that isn't must use the fetch-by-SHA idiom (and the
  bot cannot push `.github/workflows/*`).
- **GitHub App quota is installation-wide.** A babysitter payload of only `{driftCheck,
  error: "GitHub API 403 ..."}` means the shared 6000/h was spent at fire time: read
  `X-Ratelimit-Reset` via `gh api -i`, wait, rebuild by hand. A counter rise during one
  agent's activity is not its usage. Mid-sweep exhaustion turns a 403 `_err` into a false
  `[]` ("0 labels"): treat it as a gap, re-check `X-Ratelimit-Remaining`, finish on GraphQL.
- **Multi-day catch-up sweeps eat the budget.** For gaps over ~3 days, have each
  subagent sample (counts + top-N + watch-list state changes, ≤25 lines) and reserve
  reconciliation budget before starting.
- **OKF synthesis**: verify *distillation completeness* (a dropped live chain
  pointer), key a dossier's sub-entries by their `t<N>` tag and reconcile against
  live GitHub before writing pages, and exclude groups that use `memory/` as
  documented operational storage from the DOSSIER heuristic. The skill-embedded
  `okf_synth.py` has no `okf_synth: exempt` handling, so merge a group's exempt logic
  into a new copy rather than overwriting it.
- **Communication**: singular "they" for named humans; defer to a member's
  self-assigned issue rather than racing a PR; a cleaner reframing can silently
  discard richer prior analysis.

## Delivery and liveness diagnosis

Two atoms describe the same trap from different chains. [A redrive "NOT delivered"
notice is an ack-inference](../learnings/1787049737895-a-redrive-not-delivered-notice-is-an-ack-inference.md)
(slangpy#1062): the host bounce notice fires on a *missing ack/outbound*, so the
message can be physically present in the recipient's inbound DB while the notice
says "NOT delivered" — the recipient's processing turn errored on wake. Distinguish
(a) message absent (true delivery fault → re-send) from (b) present-but-unacked
(processing fault → respawn/credential-fix); a re-send does nothing for (b).
[The a2a-redrive send-side signal](../learnings/1787048754843-a2a-redrive-bounced-2-not-delivered-is-a-send-side.md)
(slang#12587) adds the operational rules: treat "bounced 2×/NOT delivered" as
UNRELIABLE; verify against the recipient's ground truth (inbound DB, session
status, remote branch, open PR) before restarting (restarting a working fixer kills
its worktree and risks a duplicate PR); a triager can't self-verify a fixer's
inbound (`ncl` scope=group), so escalate the cross-group check to the parent;
re-drive at most once, then escalate up with the safety net (the GitHub verdict
comment carries the full spec). [A dark agent group is not a down one](../learnings/1787117195283-a-dark-agent-group-is-not-a-down-agent-group-disam.md)
(slangpy#1062): "every session stopped" is ambiguous between idle and broken —
before claiming a group is down, find one recent *outbound* row (a real turn proves
the agent/image/credentials are fine; `last_active` is a wake signal, not a success
signal). Remedy for a single wedged session (poisoned/oversized resume context):
ask the operator to reset that session. Re-dispatching on a fresh sub-thread used to
work (a clean session ACK'd in 3 min where the wedged one bounced 4+ times over 24h),
but since 2026-10-13 the router refuses a second session for an item that already
has one ([One owner per work item: never start a second session to reset a budget](../learnings/1791903600000-one-owner-per-work-item-never-start-a-second-session.md)).

A different delivery-side failure is a *legitimate refusal*, not a bounce: a bare `send_message(to="orchestrator")` from a recurring heartbeat session was rejected with `Refusing to send to thread "…" without in_reply_to: 678 unresponded inbound rows exist on this peer thread`. The session's default outgoing thread_id auto-propagates to a peer thread that had accumulated hundreds of unanswered inbound rows over the life of the ~5-min-cadence heartbeat (~56h of backlog), and the routing layer refuses a bare send into a thread with that much unaddressed backlog rather than let it silently vanish. The correct response is NOT to guess an `in_reply_to` from the huge unrelated backlog (picking a wrong ancestor mis-threads the reply, violating "route on edges, never guess" — and a `<task>`-block wake carries no message id to legitimately reply to): route the same status to a distinct, non-backlogged destination and explicitly note that the `orchestrator` delivery failed for this reason, rather than dropping it or force-guessing. The open pipeline question worth surfacing: a heartbeat whose periodic trigger mints an inbound row each cycle that is never explicitly acked will keep tripping the backlog-refusal threshold every wake — fix by auto-acking heartbeat trigger rows, raising the threshold, or having the heartbeat rely purely on its memory files instead of `send_message(to="orchestrator")` ([heartbeat reports to orchestrator blocked by a 678-row unresponded backlog on the peer thread](../learnings/1789645494994-heartbeat-reports-to-orchestrator-blocked-by-678-r.md)).

## Heartbeat health — the watermark lies

[A reporting gap can last days with the watermark staying fresh](../learnings/1786996231168-reporting-gap-can-last-days-with-the-watermark-sta.md):
the Slang Discord heartbeat produced zero outbound for ~4d10h across ~1,300 wakes,
all counted "completed," because the precheck *script* stamps `.heartbeat-last-ts`
unconditionally on its `wake=false` quiet-path branch — a silent agent and a
healthy one are indistinguishable via the watermark. The only reliable signal was
`heartbeat-log.md` mtime advancing (it didn't). Scheduler-level tooling gives zero
visibility into "delivered but the session did nothing with it"; root cause needs
operator-level session-internals or a `request_restart`.

The Slang Discord-support heartbeat has two adjacent precheck false-signals to know before acting on a summon. First, `pending_summons_stale` (age > `summon_grace_min` since the `summon_requests.jsonl` timestamp) has NO visibility into whether the per-thread Discord wiring's own session already engaged the thread — that session claims reservations in `thread_state.jsonl` (`reply_pending`/`reply_accepted`) and posts via SlangMaintainerBot directly without writing `summon_handled.jsonl`, so a hard question whose summon+research+reply cycle naturally exceeds ~20min reads as "stale" while it is being (successfully) handled live (confirmed twice: both "stale" summons had a substantive bot reply within ~2-3 min). So before answering ANY summon flagged stale, `discord_read_messages` the thread first to check for an existing SlangMaintainerBot substantive reply (not just the "click below" prompt); if one exists, don't reply — append a post-hoc `summon_handled.jsonl` entry so future wakes don't re-flag it. Never treat `pending_summons_stale > 0` alone as grounds to act ([pending_summons_stale by age alone misses live per-thread wiring activity](../learnings/1789671138823-discord-heartbeat-pending-summons-stale-by-age-alo.md)). Second, the per-thread wiring auto-processes new user messages in already-summoned threads without a fresh summon click — and this can genuinely FAIL (`reply_failed` in `thread_state.jsonl`), not just succeed silently. A `reply_failed` for a thread with no corresponding `summon_requests.jsonl` entry is a real coverage gap (the user got no answer) but is OUT of the heartbeat's scope to fix — the "never reply without a summon request" rule is about `summon_requests.jsonl` clicks, and inventing a reply risks racing the wiring's own retry; the correct heartbeat action is to flag it prominently as a maintainer/pipeline bug. Distinguish it from the stale-summon-already-answered-live false positive by checking the thread's last `thread_state.jsonl` event (`reply_accepted` = handled live; `reply_failed` = genuine failure) ([Discord per-thread bot pipeline can fail on follow-up replies, not just fresh summons](../learnings/1789714845243-discord-per-thread-bot-pipeline-can-fail-on-follow.md)).

## CI-health operational signatures

[GCP GPU quota-ceiling is a distinct queue-growth signature](../learnings/1787153458385-gcp-gpu-quota-ceiling-is-a-distinct-queue-growth-s.md):
saturation (busy==total) + queued MONOTONICALLY GROWING across ≥3 fresh frames +
GPU quota usage==limit ⇒ a real backlog worth a WARNING; saturation + queued
flat/zero ⇒ starved-vs-no-demand, not an alarm. The status page reports "All
Systems Operational" through a quota ceiling — it only catches outages.
[GitHub Actions API can hit a sustained per-path 403](../learnings/1787153471734-github-actions-api-can-hit-a-sustained-per-path-40.md):
`actions/runs?status=failure` and `.../jobs` 403'd for ~15 min while `/rate_limit`
showed 60/60 and other endpoints (workflow list, runs-by-ID, the MCP search tool)
succeeded — the OneCLI gateway injects credentials per-path and the limited pool
can be scoped to specific Actions sub-paths. Workaround: WebFetch the run's HTML
page directly; do NOT strip `HTTP_PROXY` (going anonymous is worse, 60/hr).
[A Falcor full-duration failure is isolated by cross-PR corroboration](../learnings/1786998078325-falcor-full-duration-external-pipeline-failure-iso.md):
when a `Test (Falcor)` job runs to completion and the external GitLab pipeline
reports `failed`, check ALL other open PRs' Falcor status in the same window — if
it's the only red out of ~17, it's author-owned, not a shared outage (a cheap,
decisive discriminator that beats "corroborating window overlap" from memory).
[Pinning an unpinned dxvk-remix clone in a GHA workflow](../learnings/1787133418793-pinning-an-unpinned-dxvk-remix-clone-in-a-gha-work.md)
(slang#12617): a clone commented "pinned" that actually fetched HEAD went red when
an upstream commit swapped a USD *package identity* (falling through to an
internal remote). The fetch-by-SHA idiom (`git init` + `remote add` +
`fetch --depth 1 <full-SHA>` + `checkout FETCH_HEAD` + full-depth submodule init)
pins correctly on GitHub-hosted public repos. Load-bearing: `nv-slang-bot` CANNOT
push `.github/workflows/*` (server-rejected without `workflows` permission) — route
the verified patch UP to the orchestrator (which holds a `workflow`-scope PAT).

**The GitHub App's 6000/h REST quota is shared by every agent and session on the installation**, which produces three traps. First, a CI-babysitter wake payload carrying only `{driftCheck, error: "GitHub API 403 ..."}` (no `prs`/`evicted`) means the quota was exhausted at fire time. `gh api -i <repo path>` shows `X-Ratelimit-Remaining: 0` and the `X-Ratelimit-Reset` epoch, while `gh api rate_limit` and `/user` are useless here (both return the cosmetic `app_not_connected` 401). Wait for the reset, rebuild the payload with `GH_TOKEN=placeholder node /workspace/agent/memory/ci-babysitter/sweep-script-v2.mjs > /tmp/out.json` (the gateway injects the real token; about 90 API calls), and run the normal gates on it; the 2026-10-15 10:00Z fire recovered this way with no data loss ([babysitter 403 wake: wait for reset, rerun the sweep script](../learnings/1792058825118-ci-babysitter-wake-with-github-403-payload-wait-fo.md)). Second, a counter rise that coincides with one agent's activity says nothing about that agent's share. In the same incident Orchestrator sampled ~100–140 calls a minute during the babysitter's manual sweep and called it "very likely" the big user; the babysitter's own count was 335 calls per run, ~440 in the sampled window, and 0 after 10:07Z, while the counter rose 338 more in those idle minutes and was already exhausted before its wake. Pair counter samples with per-consumer counts (scripts should log their own), treat the window delta as an upper bound on any one consumer, report an unattributed rise as "installation-wide", and ask the suspect what it measured before naming it ([a shared quota counter can't attribute usage by timing](../learnings/1792060076093-a-shared-quota-counter-can-t-attribute-usage-by-ti.md)). Third, the quota can run out in the middle of your own sweep, and the scripts then report false empties. On 2026-10-22 the maintainer sweep hit 0 at about 08:27Z while other sessions' scripts were running, and the CI-health sweep hit 0 about 30 minutes in, because a full ubuntu-latest log-header scan (`img_all.py`, one Range log request per job, ~2,700 jobs) ran alongside the jobs fetch (~2,200 run-jobs calls). After that every REST call returned a 403 `{'_err':403}` ("API rate limit exceeded for installation ID"), and helpers that stop on a non-list result turned it into `[]`: `/labels` would have been reported as "0 labels" and a PR listing printed "open PRs 0". Treat any `_err` or that 403 as a gap, never as zero. Print `X-Ratelimit-Remaining` (and `-Reset`) from a real REST response at the start of a sweep and again before the late follow-up scripts (`/rate_limit` shows a false 60). GraphQL has its own bucket (5149 left in that window), so switch late reads to it: labels via `repository{labels(first:1){totalCount}}`, timelines via `timelineItems`, and PR, issue and merge-queue lookups. Order the cheap state scripts (fork approvals, PR state) BEFORE any header scan, and sample the scan (all failures plus every 4th success) unless the full count matters. Size page caps from the data too: on a busy triage day (45 assignments plus bots) `issues/events` needs about 30 pages, and a 7-page cap covered only 6 of the 24 hours ([shared REST quota runs out mid-sweep and fails silently as empty lists](../learnings/1792658279840-shared-github-rest-quota-can-run-out-mid-sweep-and.md), [a full log-header scan exhausts the shared REST budget](../learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md)).

**A multi-day catch-up sweep needs a scope cap on each subagent.** A 7-day daily-report catch-up (GitHub, CI and Discord as parallel Sonnet subagents) spent about $10 of a $12 session budget, each subagent ran 25–43 minutes, the GitHub sweep exhausted the REST quota and forced a switch to GraphQL, and the watch-list reconciliation finished only after a container restart. For gaps over ~3 days, tell each subagent to sample: counts plus the top-N notable items, only state *changes* on watch-list entries, a returned summary of about 25 lines, and leave reconciliation budget before launching the sweeps ([multi-day maintainer catch-up sweeps: cap subagent scope](../learnings/1792062546507-multi-day-maintainer-catch-up-sweeps-cap-subagent-.md)).

## OKF memory-tree synthesis

[OKF migration: verify distillation completeness, not just thinness](../learnings/1787038292328-okf-migration-of-always-injected-dossier-verify-di.md):
migrating an always-injected `CLAUDE.local.md` dossier into the OKF `memory/` tree
risks silently *dropping an active chain* while reducing — cross-check every
dossier `## heading` issue-number against the produced chains pages
(`grep` + `comm -23`). Note `okf_synth.py finalize` measures the WHOLE `memory/`
tree (not `CLAUDE.local.md` at the group root), so it can escalate on pre-existing
legacy memos; the real success metric is the always-loaded surface under budget.
For a large dossier, split on `## ` headers plus the dated `**[…]**` / `  - **[…]**`
sub-entries and key each sub-entry by its trailing `t<N>` chain tag, not the H2 it
sits under: a 558 KB triager dossier filed #13017 entries under #13061, #13491 under
#13465 and #13556 under #13617. Reconcile every key against live GitHub in one
batched GraphQL query (`issueOrPullRequest` per number, 35–60 aliases per request)
before writing pages; about 25% of "held" chains had moved (the assignee's own PR,
unrecorded bot PRs, a human comment after ours). `okf_synth.py` now also scans the
group-root `CLAUDE.local.md`, so the first finalize after that upgrade compares
against history from the old tool and can print a false ESCALATE ("500 → 13315");
read it as a re-baseline ([key dossier sub-entries by their t<N> tag](../learnings/1792061945660-migrating-a-claude-local-md-dossier-key-sub-entrie.md)).
Two paired atoms fix a scanner false-positive: [the DOSSIER heuristic
false-positives](../learnings/1787116181098-okf-synthesis-dossier-heuristic-false-positives-on.md)
on a group (Slang Discord bot) whose `memory/` is documented operational scratch
storage with a separate OKF store elsewhere — the tell is `memory/index.md`
disclaiming itself; read a group's CLAUDE.md + index.md before folding, and
escalate rather than mechanically deleting actively-used history. [The scoped fix](../learnings/1787116919680-okf-synthesis-scoped-fix-exclude-documented-operat.md)
keeps the always-loaded budget check active but excludes the documented
operational-file set (parsed from index.md's "actually holds" table, with a
hardcoded fallback so a docs edit degrades to last-known-good, never "treat
everything as a dossier again") from DOSSIER/OVERSIZE/NO-FRONTMATTER/INDEX-STALE/
DANGLING-LINK checks.

**Refinement — the per-file `okf_synth: exempt` flag, not hardcoded names (2026-08-22 tool change).** Parsing an index.md "operational-files" table (above) is superseded by a per-file mechanism: add `okf_synth: exempt` at **column 0** (top-level, never nested under `metadata:`; matched `^okf_synth:[ \t]*exempt\b` so a block-scalar body line can't silence a file) of each operational file's frontmatter. The scanner records those on informational EXEMPT lines (`exempt_bytes` still tracks a ballooning exempt file) and drops them from `offenders`/`backlog`, so they can't become "top offender" or trip a stall — and the owning group makes the edit itself, no tool change, no cross-group propagation (the `_is_exempt` invariant is "one source of truth, no hardcoded names in the tool"; `okf_synth.py` is embedded per-group inside each SKILL.md, so a hardcoded name list forks the shared tool). Two bounding facts: (a) exempt clears only the size/synthesis classes (DOSSIER/OVERSIZE/NO-FRONTMATTER); the integrity classes (INDEX-STALE, DANGLING-LINK) still apply, so an INDEX-STALE residual is a real defect to fix, not silence. (b) **Exempt the WHOLE operational set, not just the loudest file** — `_escalation` has two independent STALL_RUNS(3) triggers, trigger-2 (top offender path+size unchanged) AND trigger-1 (backlog non-decreasing AND > GATE_MIN_BACKLOG 2000), plus a daily `cmd_gate` that wakes on `backlog >= 2000 OR defects > 0`; exempting only the biggest file fixes trigger-2 but leaves a stable residual backlog from the smaller operational files that trips trigger-1 ~1-2 runs later, and un-exempted NO-FRONTMATTER operational files keep `defects > 0` so the cron burns a daily wake with zero fold work. Only exempt genuinely-live state, never an unfolded dossier ([exempt flag, not hardcoded names](../learnings/1789101995712-okf-synth-exempt-flag-not-hardcoded-names-for-oper.md), [exempt the whole operational set, not just the loudest](../learnings/1789102408104-okf-synth-exempt-the-whole-operational-set-not-jus.md)). The flag lives only in the per-group tool copies that merged it: the okf-synthesis skill's embedded `okf_synth.py` has no `okf_synth: exempt` handling and no nested `type:` detection. Writing the skill copy verbatim over a group's `tools/okf_synth.py` turns every exempt operational file (heartbeat archives, `issues-to-file/*`) into a DOSSIER/NO-FRONTMATTER offender; one group went from backlog 0 to 167,500 with 56 phantom offenders, and the daily gate would wake forever. Diff against the previous tool before overwriting, merge the exempt logic (`_is_exempt`, the exempt/review lists in `scan`, the report lines) into the new copy, keep a backup, and never "fix" it by folding the exempt state files ([embedded tool lacks the exempt flag; verbatim overwrite fakes a huge backlog](../learnings/1792067719087-okf-synthesis-embedded-tool-lacks-exempt-flag-verb.md)).

## Communication and triage discipline

[Use singular "they" for human GitHub/Discord users](../learnings/1787041557418-use-singular-they-for-human-github-discord-users-i.md):
never infer gender from a username/display name/avatar in any generated prose — a
maintainer explicitly flagged being misgendered; wrong pronouns cost trust.
[Defer, don't race a member's self-assigned issue](../learnings/1787062663706-defer-don-t-race-member-self-assigned-issue-no-com.md)
(slang#12603): when an issue is self-assigned to a core-team member, verify the
assign on the issue itself (cheap GraphQL) — if genuine, DEFER (post the 5-bullet,
offer approach analysis, open NO non-draft PR) rather than racing their work; the
hold supersedes the workflow's default "always forward to fixer." [A cleaner
reframing can discard your own prior analysis](../learnings/1787163810101-a-cleaner-reframing-can-discard-your-own-prior-ana.md)
(slangpy#1091): re-presenting a maintainer's binary simplification *feels
confirmatory* while quietly dropping richer analysis you already recorded (here, a
decision-independent path + a bounded failure band). Before answering a question as
asked, check whether your own prior record frames it differently; and when citing
your own prior artifact publicly, read it at source first — option labels drift
("Approach A" in notes ≠ "Option A" in the public comment).

## Source learnings (14):

- [a2a-redrive "bounced 2×/NOT delivered" is a send-side signal — verify inbound first](../learnings/1787048754843-a2a-redrive-bounced-2-not-delivered-is-a-send-side.md) — treat the bounce as unreliable; verify recipient ground truth; re-drive once then escalate up with the GitHub verdict as safety net.
- [A redrive "NOT delivered" notice is an ack-inference, not an inbox measurement](../learnings/1787049737895-a-redrive-not-delivered-notice-is-an-ack-inference.md) — the same string covers a true delivery fault (re-send) and a processing fault (respawn); check the recipient's inbound DB before escalating.
- [A dark agent group is not a down agent group — disambiguate idle from broken](../learnings/1787117195283-a-dark-agent-group-is-not-a-down-agent-group-disam.md) — find one recent outbound turn to prove health; `last_active` is a wake signal; a wedged session is reset by the operator, never replaced.
- [Reporting gap can last days with the watermark staying fresh](../learnings/1786996231168-reporting-gap-can-last-days-with-the-watermark-sta.md) — the precheck script stamps the watermark on its quiet-path branch; report-log mtime is the only reliable liveness signal.
- [GCP GPU quota-ceiling is a distinct queue-growth signature from starved-vs-no-demand](../learnings/1787153458385-gcp-gpu-quota-ceiling-is-a-distinct-queue-growth-s.md) — busy==total + queued monotonically growing + quota usage==limit ⇒ real backlog; the status page won't catch a quota ceiling.
- [GitHub Actions API can hit a sustained per-path 403 even while /rate_limit shows headroom](../learnings/1787153471734-github-actions-api-can-hit-a-sustained-per-path-40.md) — the gateway injects credentials per-path; WebFetch the run's HTML page as a fallback; don't strip the proxy (anonymous is worse).
- [Falcor full-duration external pipeline failure isolated by cross-PR corroboration](../learnings/1786998078325-falcor-full-duration-external-pipeline-failure-iso.md) — only-red-among-all-open-PRs ⇒ author-owned, not infra; a cheap decisive discriminator beating window-overlap reasoning.
- [Pinning an unpinned dxvk-remix clone in a GHA workflow — fetch-by-SHA idiom](../learnings/1787133418793-pinning-an-unpinned-dxvk-remix-clone-in-a-gha-work.md) — `git fetch --depth 1 <full-SHA>` + `checkout FETCH_HEAD`; a package-identity change falls through to an internal remote; the bot can't push workflows — route up.
- [OKF migration of always-injected dossier: verify distillation completeness, not thinness](../learnings/1787038292328-okf-migration-of-always-injected-dossier-verify-di.md) — cross-check dossier `##` issue-numbers against chains pages so a live chain pointer isn't dropped; finalize measures the whole tree, not `CLAUDE.local.md`.
- [okf-synthesis DOSSIER heuristic false-positives on groups using memory/ as operational storage](../learnings/1787116181098-okf-synthesis-dossier-heuristic-false-positives-on.md) — read the group's CLAUDE.md + index.md first; escalate rather than fold actively-used operational history to fix a metric.
- [okf-synthesis scoped fix: exclude documented operational files, source list from index.md](../learnings/1787116919680-okf-synthesis-scoped-fix-exclude-documented-operat.md) — parse the "actually holds" table with a hardcoded fallback; keep the always-loaded budget check active while excluding operational files from dossier/stale checks.
- [Use singular they for human GitHub/Discord users in bot prose](../learnings/1787041557418-use-singular-they-for-human-github-discord-users-i.md) — default to they/them for named humans across all generated prose; never infer gender from handle/avatar.
- [Defer, don't race: member self-assigned issue → no competing non-draft PR](../learnings/1787062663706-defer-don-t-race-member-self-assigned-issue-no-com.md) — verify the self-assign on the issue itself; if genuine, DEFER with a 5-bullet + approach offer; the hold supersedes the default forward-to-fixer.
- [A cleaner reframing can discard your own prior analysis](../learnings/1787163810101-a-cleaner-reframing-can-discard-your-own-prior-ana.md) — check whether your own prior record frames the question richer before echoing a simplification; cite the public artifact's labels, not your notes'.
- [the per-file `okf_synth: exempt` (col-0) flag replaces hardcoded names in the shared per-group tool; clears size/synthesis classes but not integrity classes.](../learnings/1789101995712-okf-synth-exempt-flag-not-hardcoded-names-for-oper.md)
- [exempt the whole operational set, not just the loudest, or trigger-1 (backlog) and the daily gate fire on the residual permanent state.](../learnings/1789102408104-okf-synth-exempt-the-whole-operational-set-not-jus.md)
- [CI babysitter wake with GitHub 403 payload: wait for reset, rerun sweep script by hand](../learnings/1792058825118-ci-babysitter-wake-with-github-403-payload-wait-fo.md) — read `X-Ratelimit-Reset` via `gh api -i`; rebuild the payload with the sweep script; `rate_limit`//user are useless
- [A shared quota counter can't attribute usage by timing: measure the suspect's own call count](../learnings/1792060076093-a-shared-quota-counter-can-t-attribute-usage-by-ti.md) — installation-wide counter; window delta is only an upper bound; ask what the suspect measured
- [Multi-day maintainer catch-up sweeps: cap subagent scope or they eat the budget](../learnings/1792062546507-multi-day-maintainer-catch-up-sweeps-cap-subagent-.md) — sample counts + top-N + state changes, ≤25 lines; reserve reconciliation budget
- [Migrating a CLAUDE.local.md dossier: key sub-entries by their trailing t<N> tag](../learnings/1792061945660-migrating-a-claude-local-md-dossier-key-sub-entrie.md) — misfiled sub-entries; batched GraphQL reconcile; first finalize after the upgrade is a re-baseline
- [okf-synthesis: embedded tool lacks exempt flag; verbatim overwrite fakes a huge backlog](../learnings/1792067719087-okf-synthesis-embedded-tool-lacks-exempt-flag-verb.md) — diff before overwriting; merge `_is_exempt` into the new copy; don't fold exempt state files
- [heartbeat reports to orchestrator blocked by a 678-row unresponded backlog on the peer thread](../learnings/1789645494994-heartbeat-reports-to-orchestrator-blocked-by-678-r.md) — routing refuses a bare send into a high-backlog thread; don't guess in_reply_to; route to a non-backlogged destination and note the failure; auto-ack heartbeat trigger rows.
- [Discord heartbeat: pending_summons_stale by age alone misses live per-thread wiring activity](../learnings/1789671138823-discord-heartbeat-pending-summons-stale-by-age-alo.md) — read the thread before answering a "stale" summon; a live SlangMaintainerBot reply doesn't write summon_handled.jsonl; append a post-hoc entry.
- [Discord per-thread bot pipeline can fail on follow-up replies, not just fresh summons](../learnings/1789714845243-discord-per-thread-bot-pipeline-can-fail-on-follow.md) — a `reply_failed` with no summon_requests entry is a real coverage gap but out of heartbeat scope; flag as a pipeline bug; distinguish via thread_state.jsonl's last event.
- [Shared GitHub REST quota can run out mid-sweep and fails silently as empty lists](../learnings/1792658279840-shared-github-rest-quota-can-run-out-mid-sweep-and.md) — 403 `_err` → `[]` = false "0 labels"; GraphQL fallbacks for labels/timelines; `issues/events` needs ~30 pages on a busy day
- [CI sweep: full ubuntu-latest log-header scan exhausts the shared 6000/hr REST budget](../learnings/1792660471559-ci-sweep-full-ubuntu-latest-log-header-scan-exhaus.md) — ~2,700 Range log GETs + ~2,200 run-jobs calls; run state scripts first, sample the scan; bot CMake Options dispatches fill the hosted cap

