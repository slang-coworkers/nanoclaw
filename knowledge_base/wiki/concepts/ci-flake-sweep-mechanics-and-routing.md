---
title: "CI Flake — Sweep Mechanics & Routing/Board Forensics"
type: concept
group: ci-tooling
tags: [ci, sweep, ranking, xargs, rest-fallback, codeowners, board-sync, supervise-issues, routing, slang]
source_count: 5
---

# CI Flake — Sweep Mechanics & Routing/Board Forensics

Two families of "the tooling itself is the story" learnings: how to *run* a flake sweep so its numbers and its throughput are trustworthy (rank by distinct entities, not by a self-authored action field; parallelize the REST fallback), and the routing/board-classification machinery that a maintainer keeps mistaking for a bot misfire (CODEOWNERS auto-request on `ready_for_review`, the board-sync "Source" derivation, and the supervise-issues quoting bug that silently aborts a tick).

## TL;DR

- **Never rank flake signatures by an `action` field you also write on non-actions.** Reserve `action:"rerun"` for reruns actually fired; a re-confirmation, a GitHub refusal ("already running"), or a dropped deferral is `action:"none"` even when the subject is a rerun. Rank from **reason-text across all records** and by **DISTINCT ENTITIES affected** (distinct PRs), not record count — record count rewards the most *stalled* item, not the most *costly* one.
- **General form:** if a field means "what I did" but gets written on rows where you did nothing, every aggregate over it silently inflates — sanity-check any log-derived count against "how many of these were real?" before it ships.
- **Parallelize the REST-fallback sweep.** A serial 8×-retry loop covered only 22 of 74 PRs in 10 minutes; fan out with `xargs -P 10 -n 4`, drop to 5 retries, give **each worker its own output file**, and use absolute output paths (a `cd` inside the pipeline resets cwd).
- **`@shader-slang/dev` added as reviewer on a bot PR at `ready_for_review` is CODEOWNERS, not the agent.** The `review_requested (team=dev)` event carries the SAME actor + timestamp as `ready_for_review` (the human who flipped ready). Verify before relaying; do NOT remove the team reviewer.
- **The board-sync "Source" (Internal/Community/Bot) field is derived in `pr-board-sync.yml` at two push-access sites** — a team-membership reclassifier needs no new PAT scope (`listTeamMembers` + org-members:read already cover it) but is a bot-unpushable `.github/workflows/*` change.
- **A bash-quoting bug in `pull-universe.sh` aborts the supervise-issues tick** (`syntax error near unexpected token '('` ~line 145, then `stdin is not a tty` from scan.py) — a sibling to the earlier argv-overflow issue.

## Sweep Mechanics: Rank by Distinct Entities, and Parallelize the REST Fallback

The flake-evidence dedup rule (dedup by `run_id`) has a companion defect one level up: **don't rank flake signatures by an action field you also write on non-actions.** `memory/rerun-log.jsonl` has `action` (`rerun` | `requeue` | `none`), and the reporting rule derives the "top infra signature" by grouping the last ~7 days on `check`/`reason`. Measured: of **143 records with `action:"rerun"` in 7 days, only 5 were actually fired reruns** — the other 138 were idempotent re-confirmations, GitHub refusals (`"cannot be rerun; This workflow is already running"`), and moot deferrals, all written with `action:"rerun"` because they were *about* a rerun. The resulting ranking is actively misleading: naive grouping put `check-formatting` at #1 with 31 hits, all 31 re-confirmations of two author-owned PRs that were **never rerun and must never be** (formatting is deterministic; rerunning it is against policy) — reporting it as the top flake bucket points a maintainer at a non-problem. The true dominant flake, ranked by **distinct-PR spread**, was #12145 `GBufferRTTexGrads_d3d12` (16 distinct PRs on all 7 days).

Rules: reserve the action field for **actions actually taken** (a re-confirmation, refusal, or dropped deferral is `action:"none"` even when the subject is a rerun); rank from **reason-text matching across all records** and by **distinct entities affected**, not raw record count — record count rewards whichever item got re-observed most often, which is usually the most *stalled* item, not the most *costly* one. General form: **if a field means "what I did" but gets written on rows where you did nothing, every aggregate over it silently inflates** — sanity-check any log-derived count against "how many of these were real?" before it goes in a report ([don't rank flake signatures by an action field you also use for non-actions](../learnings/1785780857080-don-t-rank-flake-signatures-by-an-action-field-you.md)).

**Parallelize the REST-fallback sweep.** When GraphQL is down and every open PR must be swept via REST `commits/<sha>/check-runs` + `statuses`, a **serial** loop with a retry wrapper does not scale: on 74 non-draft open slang PRs, a serial loop with an 8×-retry/1s-sleep wrapper got through only **22 PRs in 10 minutes** and hit the Bash timeout — the cost is dominated by per-call latency plus inter-retry sleep, not by rate limits. Fix: make the per-PR probe a standalone script and fan it out with `xargs -P 10`, each worker writing its own result file; the remaining 52 PRs finished comfortably inside one call.

```bash
# /tmp/one.sh takes: num sha author repo ; writes /tmp/out/red-<n>.txt or green-<n>.txt
cat /tmp/prs-remaining.tsv | while IFS=$'\t' read -r n s a r m; do echo "$n $s $a $r"; done \
  | xargs -P 10 -n 4 /tmp/one.sh 2>/dev/null
cat /tmp/out/red-*.txt >> /tmp/reds.txt
```

Details that mattered: drop the retry count in parallel workers (5 is plenty — with 10 in flight a transient failure is cheap to re-observe); give each worker a **separate output file** (appending to one shared file from 10 processes interleaves lines); emit fields space-separated for `xargs -n 4` and keep the TSV read separate so tabs don't confuse `xargs`; `-P 10` did not trigger secondary rate limits for ~150 calls over a couple of minutes; and note that `cd` inside an `xargs` pipeline resets the shell's cwd for later calls in that Bash session — use absolute paths for the output dir ([parallelize the REST-fallback CI sweep — serial retry-wrapper sweeps time out at scale](../learnings/1785752832168-parallelize-the-rest-fallback-ci-sweep-serial-retr.md)).

## CODEOWNERS auto-routes @shader-slang/dev on ready_for_review — not a bot misfire

When a maintainer sees `@shader-slang/dev` (the team) added as a reviewer on a bot-authored PR and suspects the agent is adding reviewers, it is GitHub CODEOWNERS auto-requesting review from the owning team on the `ready_for_review` transition. In the timeline the `review_requested (team=dev)` event carries the SAME actor and SAME timestamp as `ready_for_review` — the human who flipped ready, not `nv-slang-bot[bot]`. Verify before relaying (reputationally sensitive): `gh api repos/<o>/<r>/issues/<pr>/timeline --paginate --jq '.[] | select(.event=="review_requested" or .event=="ready_for_review") | {event, actor:.actor.login, ...}'` and check the actor — the bot only ever authors `committed` events. Do NOT remove the team reviewer; a maintainer flipping ready is not a drafts-only breach ([CODEOWNERS auto-routes @shader-slang/dev on ready_for_review — not bot misfire](../learnings/1783531331428-codeowners-auto-routes-shader-slang-dev-on-ready-f.md)).

## Board-Sync "Source" (Internal/Community) Derivation Lives in pr-board-sync.yml

Extending the #12062 board-sync forensics (see the receipts-level verify case): the board-sync **"Source"** single-select field (Internal / Community / Bot) that drives shader-slang Issue/PR assignment is classified entirely in `.github/workflows/pr-board-sync.yml`, at **two** sites both keyed on repo **push access** (`getCollaboratorPermissionLevel(...).permissions.push === true`) — the event/onboarding path "Classify PR Source" (~L234-253) and the sweep helper `classifySource(info)` (~L1170-1189); both fail safe to Community on read error and short-circuit to Bot for bot authors. Reusable machinery already in the same file: `listTeamMembers("org/slug")` (~L962-978) paginates `teams.listMembersInOrg` (includes nested-team members by default), and the `SLANG_PR_BOT_TOKEN` PAT already carries **org Members: read**, so a team-membership classifier needs no new scope. Context (#12259, jhelferty-nv): moving Internal-vs-Community derivation from write-access to membership in a fixed `source-internal` org team = one `isInternal(login)` helper over `listTeamMembers` routing BOTH classify sites — but it's a `.github/workflows/*` change the nv-slang-bot App **cannot push** (no `workflows` scope) with no local CI validation → human-apply, and it depends on the org team being provisioned first (else everyone fails safe to Community) ([Source-field Internal/Community derivation lives in pr-board-sync.yml (two sites)](../learnings/1785290345255-source-field-internal-community-derivation-lives-i.md)).

## supervise-issues pull-universe.sh bash-quoting bug

`bash scripts/pull-universe.sh … | python3 scripts/scan.py` exits 1 with `syntax error near unexpected token '('` at ~line 145, and scan.py then reports `stdin is not a tty` — a bash-quoting bug in pull-universe.sh (a sibling to the earlier argv-overflow issue) that aborts the supervise tick ([supervise-issues pull-universe.sh bash-quoting bug (syntax error ~line 145)](../learnings/1782995331984-supervise-issues-pull-universe-sh-bash-quoting-bug.md)).

**Source learnings (5):**
- [don't rank flake signatures by an action field you also write on non-actions — rank by distinct entities affected](../learnings/1785780857080-don-t-rank-flake-signatures-by-an-action-field-you.md)
- [parallelize the REST-fallback CI sweep with `xargs -P 10` — serial retry-wrapper sweeps time out at scale](../learnings/1785752832168-parallelize-the-rest-fallback-ci-sweep-serial-retr.md)
- [CODEOWNERS auto-routes @shader-slang/dev on ready_for_review — not bot misfire](../learnings/1783531331428-codeowners-auto-routes-shader-slang-dev-on-ready-f.md)
- [board-sync "Source" (Internal/Community/Bot) is classified in pr-board-sync.yml at two push-access sites; `listTeamMembers` + the PAT's org-members:read already support a team-membership classifier, but it's a bot-unpushable workflows change (#12259)](../learnings/1785290345255-source-field-internal-community-derivation-lives-i.md)
- [supervise-issues pull-universe.sh bash-quoting bug (syntax error ~line 145)](../learnings/1782995331984-supervise-issues-pull-universe-sh-bash-quoting-bug.md)
