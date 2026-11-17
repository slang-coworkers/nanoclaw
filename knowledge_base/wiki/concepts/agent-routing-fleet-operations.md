---
title: "Agent Routing: Bot Fleet Operations"
type: concept
group: agent-routing
tags: [fleet, maintenance-freeze, brownout, ci, startup-failure, github-actions, subagent-sweeps]
source_count: 2
---

# Agent Routing: Bot Fleet Operations

How bot-fleet and GitHub-Actions operational events (maintenance freezes, scheduled brownouts, queue pileups) look from the outside, and how to classify them during sweeps and maintainer scans without minting false incidents. Slang CI verdict-currency mechanics live in [Holds, Authorization, Gates](agent-routing-holds-authorization-gates.md).

## TL;DR

- A Discord-announced bot-fleet maintenance window shows on GitHub as bot DRAFT PRs frozen mid-pipeline (created, then no push/review/CI for days) and zero Claude PR Review workflow runs; the weekly PR report posting is the visible return signal. Don't flag frozen bot drafts as dropped deliverables during the window — re-check ~24 h after the fleet returns.
- Scheduled `pull_request_target` brownouts appear as `startup_failure` runs grouped by `event=pull_request_target` and resume green on their own — spot them with `gh api "…/actions/runs?status=startup_failure"`, group by event.
- A queue burst of >150 jobs with jobs_running full at 60/60 is a pileup, not a runner outage — it drains in under an hour and needs no incident.
- For long multi-step sweeps, pre-collect raw data to JSON files via scripts and analyze in the parent turn; the Task/subagent tool can return instant "completed" with empty results on long sweeps.

## Bot-Fleet Maintenance Freeze: What It Looks Like on GitHub

When a bot-fleet maintenance window is announced on Discord (e.g. sirspate 2026-11-11: "nv-slang-bot + SlangMaintainerBot + PR Reviewer down for several days"), expect on GitHub: (1) bot DRAFT PRs frozen mid-pipeline — created, then no push/review/CI for days (#14442, #14446, #14450, #14452, #14114); (2) the Claude PR Review workflow with zero runs from the announcement until the fleet returns — verify a run actually fires after the fleet is "back"; the weekly PR report posting is the visible return signal; (3) do NOT flag frozen bot DRAFTs as dropped deliverables (🔶) during the window — it is a known external freeze, not a dead chain; re-check ~24 h after the fleet returns. Also: a queue burst of >150 jobs queued with jobs_running full at 60/60 is a pileup, not a runner outage — it drains in under an hour and needs no incident. From the same run: the Task/subagent infrastructure returned instant "completed" with empty results for long multi-step sweeps (twice; short tasks worked) — the durable pattern is to pre-collect raw data to JSON files via scripts and analyze directly in the parent turn, keeping per-sweep scratch files as the method chain for the next run ([bot-fleet maintenance freeze: GitHub appearance + subagent-sweep fallback](../learnings/1794822624497-bot-fleet-maintenance-freeze-what-it-looks-like-on.md)).

## pull_request_target Brownouts: Confirm from Actions History

The scheduled 2026-11-16 pull_request_target brownout (16:00–18:00 UTC) is CONFIRMED in shader-slang/slang Actions history: 11 `startup_failure` runs on `event=pull_request_target` between 16:31–17:52 UTC (PR Maintenance x7, CI SlangPy Trigger Test x4), resuming green after ~18:27 UTC. Spot the pattern with `gh api "repos/shader-slang/slang/actions/runs?status=startup_failure"`, grouped by event. Triage of #14427 (2026-11-17): exactly 4 pull_request_target workflows exist (ci-slangpy-trigger-test, claude-pr-review, pr-maintenance, slash-cleanup; pr-board-sync is workflow_call-only) and all four are metadata-only with no PR-head checkout — the classic fork-checkout RCE vector is absent, which is why the scoped-exception option is low-risk. In-tree relay exemplars for any migration: pr-review-fork-bridge.yml → pr-review-fork-apply.yml, pr-ci-complete.yml, check-ir-version.yml ([brownout 2 confirmed; #14427 triaged — 4 metadata-only workflows](../learnings/1794885408927-brownout-2-confirmed-11-16-14427-triaged-4-metadat.md)).

**Source learnings (2):**

- [Fleet maintenance freeze: GitHub appearance + sweep fallback](../learnings/1794822624497-bot-fleet-maintenance-freeze-what-it-looks-like-on.md)
- [Brownout 2 confirmed; 4 metadata-only pull_request_target workflows](../learnings/1794885408927-brownout-2-confirmed-11-16-14427-triaged-4-metadat.md)

_Catalog: [[wiki/index.md]]_
