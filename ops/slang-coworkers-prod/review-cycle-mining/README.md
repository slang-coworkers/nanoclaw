# review-cycle mining daily task, slang-coworkers-prod

Companion to the review-cycles v2 snapshot (`scripts/review-rounds.py`, run by
`scripts/funnel-cron.sh` every 30 minutes, copied to `data/shared/reports/review-rounds.json`).
The snapshot says *how many* valid human review rounds and comments each PR took across the
seven shader-slang repos; this task has the Orchestrator read the tail (rounds > 5 or comments
> 15) and write *why* into `data/shared/reports/review-cycles-why.json`, which the dashboard's
"PRs with > 5 rounds" table joins by `repo` + `number`. Same shape as the learnings-wiki daily
fold: a script gate that wakes the agent only when there is work, a bounded run, one report line.

- `gate.sh`: the task's `--script`. Runs inside the Orchestrator's container; calls
  `python3 /workspace/shared/.mine_select.py gate` and prints the scheduler JSON. Wakes with
  `data.error` (never a silent `false`) when the helper is missing, the snapshot is missing,
  stale (> 36 h) or still on the pre-v2 shape (`schema` < 3, no `perPR`), or the why file is
  corrupt. A snapshot the producer marked `complete: false` gates quietly (it is rewritten
  within 30 minutes).
- `prompt.md`: the task prompt. Points at the `/review-cycle-mining` container skill
  (`container/skills/review-cycle-mining/SKILL.md`) and fixes the run's bounds and report line.
- `scripts/mine_select.py` (repo root): the deterministic part. `select` (which PRs, in which
  order, skipping ones already explained), `gate` (same selection as one JSON line), `merge`
  (validate the agent's records: caps, categories, quotes, URL; newest first; keep 200;
  atomic replace). Unit tests: `python3 -m unittest scripts/test_mine_select.py`.

## Install (once per deploy that touches the helper)

The container cannot see the repo's `scripts/`, so the helper is copied to the KB root the
Orchestrator mounts read-write at `/workspace/shared` (same pattern as the learnings-wiki
builder at `.learnings_wiki.py`):

```bash
cd ~/slang-coworkers-prod/nanoclaw
cp scripts/mine_select.py data/shared/.mine_select.py
python3 data/shared/.mine_select.py gate --rounds data/shared/reports/review-rounds.json --why data/shared/reports/review-cycles-why.json
```

The last line prints what the gate would say right now. `data.error` mentioning `schema 2`
means the v2 producer is not deployed yet; the task can be created anyway and will report that
line until it is. A stale copy of the helper is the one drift this layout allows, so redo the
`cp` whenever `scripts/mine_select.py` changes (or add it to the deploy script).

## Create the task (once, on the box; operator decision)

The Orchestrator is `ag-1776713211742-1w6l4e` on prod (the group that owns the learnings-wiki
fold, `task-1782828347850-4m9u23`). `20 5 * * *` sits after the 05:00 funnel-cron run has
written and copied the snapshot and before the 06:00 wiki fold.

```bash
cd ~/slang-coworkers-prod/nanoclaw
./bin/ncl tasks create --group ag-1776713211742-1w6l4e \
  --name "review-cycle mining" --recurrence "20 5 * * *" \
  --script "$(cat ops/slang-coworkers-prod/review-cycle-mining/gate.sh)" \
  --prompt "$(cat ops/slang-coworkers-prod/review-cycle-mining/prompt.md)"
```

Test the gate the way `ncl tasks help` asks before scheduling, from inside a running
Orchestrator container: `bash -c "$(cat ops/slang-coworkers-prod/review-cycle-mining/gate.sh)"`
(on the host, substitute `/workspace/shared` with `data/shared` in the paths).

Preconditions: review-cycles v2 deployed (`data/shared/reports/review-rounds.json` has
`"schema": 3` and a `perPR` list), the helper installed as above, the
`review-cycle-mining` skill mirrored into the Orchestrator group (it is in
`MIRROR_FLOOR_SKILLS`, so any group-init refresh does it; `ls
data/v2-sessions/ag-1776713211742-1w6l4e/.claude-shared/skills/review-cycle-mining/`), the
Orchestrator read-write on `/workspace/shared` (it is the admin group), and `gh` reaching
GitHub read-only through the gateway.

## Output and how to read it

`data/shared/reports/review-cycles-why.json`:

```
{ schema: 1, updatedAt, count, records: [ {repo, number, url, rounds, comments, minedAt,
  whyShort (<= 240), whyLong (<= 1200), categories[] (subset of understanding,
  design_disagreement, scope_creep, ci_flakiness, style_nits, missing_tests, slow_reviewer,
  author_churn, automation_noise), quotes[] (<= 3: author, date, text <= 160),
  suggestedRule (one sentence), optional title/authorClass/state} ] }
```

Newest `minedAt` first, at most 200 records. A PR is mined once; to have it re-explained,
delete its record and the next gate picks it up again. The daily report line on the task's
destination reads `review-cycle-mining: mined k/N (...); left for tomorrow; why-file M
records`; a `gate error:` line is the pipeline alert and repeats daily until fixed.

Bounds per run: 10 PRs, ~150 comments read per PR, read-only `gh` (view, api GET), no
GitHub writes of any kind, no git. The agent is the LLM; there is no LLM code in the helper.

## Why the failure posture is loud

The 2026-09-09 audit found 209 "Additional mount REJECTED" warnings that sat unread for nine
days because the approver's fallback looked like caution. A gate that answered
`{"wakeAgent": false}` on a missing snapshot would be the same defect: a chart slot that
quietly never fills. So every state the helper cannot act on wakes the agent to say so, and
the one-line report is the alarm. If that line appears, fix the pipeline (funnel-cron copy,
helper install, producer version), not the task.
