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
  find one recent outbound turn to prove idle-vs-broken; re-dispatch a wedged
  session on a fresh sub-thread rather than re-driving it forever.
- **A heartbeat watermark can stay fresh through a multi-day silent gap** — the
  precheck script stamps it on its own quiet-path branch. The reliable signal is
  the report-log mtime advancing.
- **CI-ops signatures**: GCP GPU quota-ceiling (busy==total + queued monotonically
  growing + usage==limit) is a distinct backlog from starved-vs-no-demand; the
  Actions API can 403 per-path while `/rate_limit` shows headroom; a full-duration
  external pipeline failure is isolated to the PR if it's the only red across all
  open PRs; a "pinned" clone that isn't must use the fetch-by-SHA idiom (and the
  bot cannot push `.github/workflows/*`).
- **OKF synthesis**: verify *distillation completeness* (a dropped live chain
  pointer), and exclude groups that use `memory/` as documented operational
  storage from the DOSSIER heuristic.
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
re-dispatch on a fresh sub-thread (`<canonical-thread>/<subtask>`) to mint a clean
session — confirmed ACK in 3 min where the wedged one bounced 4+ times over 24h.

## Heartbeat health — the watermark lies

[A reporting gap can last days with the watermark staying fresh](../learnings/1786996231168-reporting-gap-can-last-days-with-the-watermark-sta.md):
the Slang Discord heartbeat produced zero outbound for ~4d10h across ~1,300 wakes,
all counted "completed," because the precheck *script* stamps `.heartbeat-last-ts`
unconditionally on its `wake=false` quiet-path branch — a silent agent and a
healthy one are indistinguishable via the watermark. The only reliable signal was
`heartbeat-log.md` mtime advancing (it didn't). Scheduler-level tooling gives zero
visibility into "delivered but the session did nothing with it"; root cause needs
operator-level session-internals or a `request_restart`.

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

## OKF memory-tree synthesis

[OKF migration: verify distillation completeness, not just thinness](../learnings/1787038292328-okf-migration-of-always-injected-dossier-verify-di.md):
migrating an always-injected `CLAUDE.local.md` dossier into the OKF `memory/` tree
risks silently *dropping an active chain* while reducing — cross-check every
dossier `## heading` issue-number against the produced chains pages
(`grep` + `comm -23`). Note `okf_synth.py finalize` measures the WHOLE `memory/`
tree (not `CLAUDE.local.md` at the group root), so it can escalate on pre-existing
legacy memos; the real success metric is the always-loaded surface under budget.
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

**Refinement — the per-file `okf_synth: exempt` flag, not hardcoded names (2026-08-22 tool change).** Parsing an index.md "operational-files" table (above) is superseded by a per-file mechanism: add `okf_synth: exempt` at **column 0** (top-level, never nested under `metadata:`; matched `^okf_synth:[ \t]*exempt\b` so a block-scalar body line can't silence a file) of each operational file's frontmatter. The scanner records those on informational EXEMPT lines (`exempt_bytes` still tracks a ballooning exempt file) and drops them from `offenders`/`backlog`, so they can't become "top offender" or trip a stall — and the owning group makes the edit itself, no tool change, no cross-group propagation (the `_is_exempt` invariant is "one source of truth, no hardcoded names in the tool"; `okf_synth.py` is embedded per-group inside each SKILL.md, so a hardcoded name list forks the shared tool). Two bounding facts: (a) exempt clears only the size/synthesis classes (DOSSIER/OVERSIZE/NO-FRONTMATTER); the integrity classes (INDEX-STALE, DANGLING-LINK) still apply, so an INDEX-STALE residual is a real defect to fix, not silence. (b) **Exempt the WHOLE operational set, not just the loudest file** — `_escalation` has two independent STALL_RUNS(3) triggers, trigger-2 (top offender path+size unchanged) AND trigger-1 (backlog non-decreasing AND > GATE_MIN_BACKLOG 2000), plus a daily `cmd_gate` that wakes on `backlog >= 2000 OR defects > 0`; exempting only the biggest file fixes trigger-2 but leaves a stable residual backlog from the smaller operational files that trips trigger-1 ~1-2 runs later, and un-exempted NO-FRONTMATTER operational files keep `defects > 0` so the cron burns a daily wake with zero fold work. Only exempt genuinely-live state, never an unfolded dossier ([exempt flag, not hardcoded names](../learnings/1789101995712-okf-synth-exempt-flag-not-hardcoded-names-for-oper.md), [exempt the whole operational set, not just the loudest](../learnings/1789102408104-okf-synth-exempt-the-whole-operational-set-not-jus.md)).

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
- [A dark agent group is not a down agent group — disambiguate idle from broken](../learnings/1787117195283-a-dark-agent-group-is-not-a-down-agent-group-disam.md) — find one recent outbound turn to prove health; `last_active` is a wake signal; re-dispatch a wedged session on a fresh sub-thread.
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
