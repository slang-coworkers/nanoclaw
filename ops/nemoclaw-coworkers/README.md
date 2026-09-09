# nemoclaw-coworkers — box-side operations

Scripts for the `nemoclaw-coworkers` NanoClaw instance on the box `slang-cpu-coworkers`
(checkout `~/haaggarwal/nemoclaw-coworkers`, host unit `nanoclaw-v2-604122f6.service`,
dashboard `nanoclaw-v2-604122f6-dashboard.service`, chat API on loopback `:3937`, artifact
viewer `python3 -m http.server 8091` rooted at `~/.local/share/nemo-www`).

Every script starts with a hostname guard and exits on any other machine. The same box also runs
the lego instance (`nanoclaw-haaggarwal-lego*`) and a third install (`nanoclaw-v2-97ab67ad*`);
never grep-pick "the first nanoclaw unit".

| Script | What it does | When |
|---|---|---|
| `deploy.sh` | Merge `origin/nv-hermes` into the box's local `nv-coworkers` branch, install, build, validate templates, recompose, **stamp the upgrade marker**, restart the host and dashboard units. Backs up `data/v2.db`, stashes hand-copied tracked files (kept, not dropped). Kills running coworker containers; they resume from the session DBs on the next wake. | After a merge to `nv-hermes` that touches host code. Skill/spine/workflow-only changes need no restart (mirrors refresh at the next container spawn). |
| `refresh-viewers.sh` | Publishes coworker artifacts under the 8091 root: `/explanations/` (every group's `reports/pr-explanations/` plus a newest-first index), `/status/latest.html` (the Orchestrator's daily report), `/test-reports/` (the tester's `test-report-<sha7>.md` and scenario screenshots). | Cron `*/15 * * * *` as `~/.config/nanoclaw/refresh-nemo-explanations.sh`. Idempotent. |
| `dispatch-rows.sh` | Sends one gap-matrix row per message to the Orchestrator through the chat API, `thread_id = hermes-<ROW-ID>`, so every requirement runs in its own thread. Default rows = batch 1a. | Only on an explicit go from the human, per `data/shared/hermes/dispatch-plan.md`. Superseded for routine dispatch by the autopilot below; still the hand-dispatch path. |
| `autopilot/install.sh` | Mirrors `autopilot/` into `data/shared/hermes/autopilot/` (keeps the live `config.json`), creates or updates the gated Orchestrator series `hermes-ap-supervise` (`47 */2 * * *`, idempotent by name slug), installs the dispatch tick as one host crontab line (`17 */2 * * *` running `dispatch-cron.sh`, replacing any earlier line) and cancels a leftover `hermes-ap-dispatch` series. | Once, then after any change to the prompt, the gate or the cron script. |
| `autopilot/dispatch-cron.sh` | The dispatch tick, on the host from the crontab: runs the queue on host paths, raises its alerts, POSTs each eligible row to the Orchestrator through the chat API on `thread_id = hermes-<ROW-ID>` (the `dispatch-rows.sh` shape) and records each send. `--dry-run` prints the bodies and writes nothing. Log: `data/shared/hermes/autopilot/dispatch.log`. | Cron `17 */2 * * *`, installed by `autopilot/install.sh`. |
| `hermes-check.sh` | **Mac-side** (refuses to run on the box). Pulls the ledger, `status/alerts.md` and the last tick's `state.json` over rsync, lists fork PRs with `gh`, prints the scorecard and the three interventions as paste-ready commands. Read-only, exit 0. | Every 6 hours from the human's Claude session. |

## Autopilot

The 61-row port runs unattended through a host cron (dispatch), one recurring Orchestrator task
(supervise) and one Mac-side check. The dispatch tick is deliberately not a task: a dispatch sent from a
task session homes the chain's replies in that session instead of the row's dashboard thread `hermes-<ID>`.
Design, state machine, SLOs, delegated authority and the human's decisions: `docs/hermes-port/autopilot.md`.
Everything under `autopilot/` is mirrored to `data/shared/hermes/autopilot/` (container:
`/workspace/shared/hermes/autopilot/`) by `deploy.sh` and by `autopilot/install.sh`.

| Piece | What |
|---|---|
| `autopilot/hermes_queue.py` | the queue: plan + matrix + ledger → in flight, free WIP slots, `eligible_next` with the dispatch text per row (autopilot.md §4) |
| `autopilot/hermes_supervise.py` | the supervisor: row threads + fork PRs + nudge ledger → stage per row, SLO check, bounded `nudge` / `alert` / `gate` / `hold` actions (§2, §3, §5) |
| `autopilot/collect_threads.py` | inside the container: the role sessions on each `hermes-<ID>` thread via `ncl sessions list/messages` + `ncl cost-cap status`; the dashboard API is not reachable from a container |
| `autopilot/pull-state.sh` | inside the container: runs the collector, `gh pr list`, the queue and the supervisor; writes `state.json`, `threads.json`, `prs.json`; a failed source is a `collector_errors` entry, never a silent gap |
| `autopilot/record.py` | the bookkeeping after each send (`nudged`, `alerted`, `dispatched`), atomic, called by the Orchestrator (supervise tick) and by the cron (dispatch tick); `alerted` also inserts the line newest-first into `groups/orchestrator/reports/status/alerts.md` |
| `autopilot/dispatch-cron.sh` | the dispatch tick on the host: queue → alerts → at most `wip.free` POSTs to the chat API on `hermes-<ID>` → `record.py dispatched` per HTTP 200; a failed POST records nothing and the row is eligible again next fire |
| `autopilot/gate-supervise.sh` | the supervise series' `--script` gate: runs the pull under `timeout 22`, wakes the agent only when there is an action to take |
| `autopilot/supervise-tick.md` | the supervise task prompt, passed verbatim to `ncl tasks create --prompt` |
| `autopilot/scorecard.py` | renders the human's scorecard from the pulled files (used by `hermes-check.sh`) |
| `autopilot/config.json` | the human's knobs, live copy on the box: `wip` (default 3), `paused`, `paused_rows`, `authorize_round`, `plan_sha256` / `matrix_sha256` (pin to stop dispatch on a silent plan edit), `podman_box`, `waive`, `core_change_ok` |

Escalations that need a human land in two places: the Orchestrator's status thread (`hermes-status` on the
dashboard channel) and `groups/orchestrator/reports/status/alerts.md` (append-only, newest first). The
6-hourly check reads that file: `ops/nemoclaw-coworkers/hermes-check.sh [/tmp/hermes-check]`.

Tests: `python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'` (includes an offline run of
`dispatch-cron.sh` against a fake `hostname`, `curl` and `ncl`); lint: `uvx ruff@0.16.2 check ops/nemoclaw-coworkers/autopilot`.

## Gotchas learned the hard way

- **Upgrade tripwire.** After any git update the host exits at startup when `data/upgrade-state.json` names another commit, and the circuit breaker then delays restarts by 300 s. `pnpm exec tsx scripts/upgrade-state.ts set` is the sanctioned stamp; `deploy.sh` runs it before the restart.
- `systemctl is-active` reports `activating` for a few seconds after a restart; do not treat that as failure.
- `ncl groups restart --message` with no running container spawns nothing. To wake a coworker use the chat API (`dispatch-rows.sh` shows the call).
- Matrix ids can carry a digit in the family (`A2A-F18`); match them with `[A-Z0-9]+-F[0-9]+`.
- From a laptop, `ssh` and `brev exec` to this box are unreliable; `rsync -e "ssh -i ~/.brev/brev.pem"` works both ways, and a `brev shell` tmux pane is the dependable way to run anything long.
