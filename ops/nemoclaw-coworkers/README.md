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
| `dispatch-rows.sh` | Sends one gap-matrix row per message to the Orchestrator through the chat API, `thread_id = hermes-<ROW-ID>`, so every requirement runs in its own thread. Default rows = batch 1a. | Only on an explicit go from the human, per `data/shared/hermes/dispatch-plan.md`. |

## Gotchas learned the hard way

- **Upgrade tripwire.** After any git update the host exits at startup when `data/upgrade-state.json` names another commit, and the circuit breaker then delays restarts by 300 s. `pnpm exec tsx scripts/upgrade-state.ts set` is the sanctioned stamp; `deploy.sh` runs it before the restart.
- `systemctl is-active` reports `activating` for a few seconds after a restart; do not treat that as failure.
- `ncl groups restart --message` with no running container spawns nothing. To wake a coworker use the chat API (`dispatch-rows.sh` shows the call).
- Matrix ids can carry a digit in the family (`A2A-F18`); match them with `[A-Z0-9]+-F[0-9]+`.
- From a laptop, `ssh` and `brev exec` to this box are unreliable; `rsync -e "ssh -i ~/.brev/brev.pem"` works both ways, and a `brev shell` tmux pane is the dependable way to run anything long.
