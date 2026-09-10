# slang-coworkers-prod host move: everything that is NOT in the git tree

The 2026-08-31 move (brev `2sl8wvgfr` to `brev-m94ubmtdb`, `nv-coworkers-936a96`) carried the
repo, `data/`, the groups tree and the docker graph, and still lost things: the signed approver
policy on `/ephemeral/approver-policy` (nine days of every Verity decision silently falling back
to the bundled narrow `v0-shadow`, approver agreement 36% to 3%), three cron lines
(sprint-triage, kb-health, kb-doctor), and Grafana's `root_url`. None of those failures went red.
This checklist is the inventory of state that lives outside `git clone` plus the checks that
turn "it came up" into "it is the same install". `ops/launchable/` (bootstrap, restore-state,
sync-prod; kept install-local) automates most of the copying; this file is what the automation
must cover and what a human verifies afterwards.

Conventions: `REPO` = `/home/ubuntu/slang-coworkers-prod/nanoclaw` (the path is load-bearing:
the systemd unit name, the image tag and the OneCLI agent identifiers derive from
`slug = sha1(REPO)[:8]` = `41b9e3fd`). `OLD` / `NEW` = the two boxes. Everything below is
`ubuntu`-owned unless stated.

## 1. Inventory: carry, in this order

| # | What | Where (OLD) | Why it is easy to lose | Carry | Verify on NEW |
|---|---|---|---|---|---|
| 1 | **Approver policy of record** | `/ephemeral/approver-policy/APPROVAL_POLICY.json` | A one-file directory on the data disk, referenced only by two groups' `additional_mounts`. When the host path is missing `validateAdditionalMounts` drops the mount with one WARN and the container starts without it; inside, `eval-clauses.py` falls back to the bundled `v0-shadow` and prints nothing red. Lost in the 2026-08 move. | `mkdir -p /ephemeral/approver-policy && cp ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json /ephemeral/approver-policy/` (git copy is the policy of record since #1500; the box copy must match it byte for byte) | `md5sum /ephemeral/approver-policy/APPROVAL_POLICY.json ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json` identical; section 3 items 3 and 4 |
| 2 | **`.env`** | `REPO/.env` | gitignored; holds ports, `CONTAINER_IMAGE`, `ONECLI_PG_CONTAINER`, prompt-cache flags, `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | copy, then diff against `.env.example` for keys the new code added | `grep -c . .env`; host starts; `ncl groups list` answers |
| 3 | **`data/`** (central DB + sessions + shared KB) | `REPO/data/` (~46 G): `v2.db`, `v2-sessions/`, `shared/` (learnings, wiki, `reports/`, `.learnings_wiki.py`, `.wiki-config.json`, `.mine_select.py`), `cost-thresholds.json` | SQLite: copy COLD (host stopped) or the WAL/`.bak` mix corrupts silently; the dotfiles at the `shared/` root are skipped by casual `cp *` | cold `rsync -a` with `--delete`, source-non-empty guarded; drop `v2.db.bak-*` and `v2-sessions/**/*.bak-*` first (29 GB of them filled the old root to 96%) | `pnpm exec tsx scripts/q.ts data/v2.db "select count(*) from sessions"` matches OLD; `ls -la data/shared/` shows the dotfiles |
| 4 | **`groups/`** | `REPO/groups/` (symlink into `/ephemeral/prod-groups`, ~670 G with worktrees) | The symlink target is on the data disk; `rsync` of the repo copies the link, not the tree | rsync `/data/prod-groups` once (never `/ephemeral`, it is a bind of `/data`); recreate `groups` symlink; exclude `build/ node_modules .pnpm-store .venv` if time-bound | `readlink REPO/groups`; `ls groups/main/CLAUDE.md groups/*/container.json | wc -l` matches OLD |
| 5 | **`/ephemeral` bind + docker data-root** | fstab `/data /ephemeral none bind 0 0`; `/etc/docker/daemon.json` `data-root=/data/docker` | If dockerd starts before `/data` is mounted it creates `/data/docker` on the root disk and fills it. Order: fstab, `mount -a`, then dockerd | fstab line + daemon.json before the first `docker` start | `findmnt /ephemeral`; `docker info --format '{{.DockerRootDir}}'` = `/data/docker` |
| 6 | **OneCLI, both stacks** | `~/.onecli/` (`docker-compose.yml`, `gateway-ca.pem`, env), `~/.onecli-sprint/`, docker volumes `onecli_pgdata`, `onecli_app-data`, `onecli-sprint_pgdata`, `onecli-sprint_app-data`, image `onecli-cost:v2` | Secrets live in Postgres volumes under `/data/docker/volumes`, not in any file; `pg_dumpall` across versions has bitten before, copy the volumes cold; the compose file points at the patched `onecli-cost:v2` image and carries `ONECLI_CAPTURE_*` env; the container tenant (`172.17.0.1:10254`) is a different secret set from loopback | cold rsync of `/data/docker` (graph incl. volumes and images) + both `~/.onecli*` dirs; `docker compose up -d --wait` in both dirs | `ONECLI_API_HOST=http://172.17.0.1:10254 onecli agents list` shows every `ag-*`; `onecli secrets list` count matches OLD; one proxied probe from inside a coworker container returns 200 (`curl -o /dev/null -w '%{http_code}' https://github.com/slang-coworkers/nanoclaw.git/info/refs?service=git-receive-pack`) |
| 7 | **`~/.config/nanoclaw/`** | `gh-app-token.py`, `github-app.pem` (App 3311378, unregenerable), `refresh-gh-tokens.sh`, `refresh-transcripts.sh`, `refresh-claude-trace-www.sh`, `sprint-triage.sh`, `mount-allowlist.json`, `registry-auth.json`, `*.log` | Home-dir tree, outside `data/` and `/data`, so no state rsync catches it; the funnel producers (`funnel.ts`, `bot-contributions.ts`, `review-rounds.py`, `scripts/lib/gh-token.sh`) all mint tokens through `gh-app-token.py` | rsync the directory (no `--delete`), mode 0600 on the pem | `python3 ~/.config/nanoclaw/gh-app-token.py --install-id <id>` prints a token; `cat ~/.config/nanoclaw/mount-allowlist.json` lists `/ephemeral` |
| 8 | **User crontab** | `crontab -l` (managed block `# >>> nanoclaw-managed >>>` plus lines outside it) | A fresh managed block regenerates only what the bootstrap knows; the 2026-08 move dropped sprint-triage, kb-health and kb-doctor | capture `crontab -l` on OLD before teardown; install verbatim on NEW; then diff against the list below | `crontab -l | grep -vcE '^#|^$'` = 11 (as of 2026-09-09); every script path exists |
| 9 | **systemd user units** | `~/.config/systemd/user/`: `nanoclaw.service` (`node dist/index.js`, `WorkingDirectory=REPO`), `nanoclaw-dashboard.service`, `nanoclaw-coworker-mcp.service`, `nanoclaw-prod-discord-feedback.service`, gc/funnel timers; `loginctl enable-linger ubuntu` | The unit is named `nanoclaw.service`, not the slug name `setup.sh --step service` would create: running that step makes a second unit and double-processes every message | rsync the dir; `systemctl --user daemon-reload`; enable linger; never run `--step service` | `systemctl --user list-units 'nanoclaw*'` shows exactly one host unit active |
| 10 | **System-level config** | `/etc/grafana/grafana.ini` (`root_url = https://grafana-<box>.brevlab.com/metrics/`, `serve_from_sub_path`), `/var/lib/grafana/dashboards/nanoclaw-coworkers.json`, `/usr/local/bin/nanoclaw-metrics.py` + `.service`, InfluxDB `lp` database, cloudflared config + tunnel credentials, `/etc/docker/daemon.json`, nvidia runtime `mode="legacy"` | `/etc` and `/usr/local/bin` are root-owned and outside every user rsync; Grafana's `root_url` was wrong for a day after the 2026-08 move | copy from `ops/metrics/`, `ops/grafana/` and OLD `/etc`; the hostname inside `root_url` and the tunnel are NEW-specific | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:13000/metrics/api/health` = 200; `influx -database lp -execute 'show measurements'` non-empty |
| 11 | **Home-dir operator files** | `~/onecli.md` (credential map cheat-sheet), `~/MIGRATION.md`, `~/transcripts-worker.sh`, `~/.local/share/claude-trace-www/`, `~/.local/bin/gh` (load-bearing for the token cron), `~/.gitconfig` | Loose files nobody lists; `.bash_history` is NOT carried (raw tokens were typed into shells) | copy the named files only | `~/.local/bin/gh --version`; `ls ~/.local/share/claude-trace-www | head` |
| 12 | **Network re-point** | GitHub App webhook URL (`webhook-<box>.brevlab.com`, host port 3841), Pomerium allowlists for `3737-<box>`, lego `.env INTERNAL_REGISTER_URL` + `groups/orchestrator/sprint-triage/send.py BRIDGE`, coworker-MCP tunnel | The new box has a new cloudflared hostname; every external reference is a hand edit | `ops/launchable/repoint.md` | webhook delivery log shows `github-webhook: delivered`; `gh api /app/hook/deliveries` (App JWT) shows `status: OK` for the newest items |
| 13 | **Upgrade tripwire** | `scripts/upgrade-state.ts` marker in `data/` | Restoring `data/` from a different HEAD makes `src/index.ts` refuse to boot (crash loop, seen 2026-08-31 12:47) | stamp AFTER the restore: `pnpm exec tsx scripts/upgrade-state.ts set` | host starts once, no `upgrade-tripwire` lines in `logs/nanoclaw.error.log` |

### The crontab, line by line (prod, 2026-09-09)

Every one of these is a producer somebody reads; a missing line publishes a stale number
without an error.

```
*/30 * * * *  REPO/scripts/funnel-cron.sh                               funnel + regression-quality + bot-contributions + review-rounds -> reports/*.json, shared copy
37 * * * *    REPO/scripts/refresh-skills-cron.sh                       external skills into container/skills + every group's mirror
30 4 * * *    cd REPO && python3 scripts/claude-trace-gc.py --days 7 --max-gb 25
*/30 * * * *  ~/.config/nanoclaw/refresh-gh-tokens.sh                   GitHub App installation tokens into the OneCLI vault (1 h TTL; user PATs are not in it)
0 */6 * * *   ~/.config/nanoclaw/refresh-transcripts.sh                 transcript archive
*/15 * * * *  ~/.config/nanoclaw/refresh-claude-trace-www.sh            claude-trace viewer refresh
@reboot       python3 -m http.server 8081 in ~/.local/share/claude-trace-www
30 11 * * 4   ~/.config/nanoclaw/sprint-triage.sh                       weekly sprint triage (dropped in the 2026-08 move)
45 5 * * *    cd REPO && python3 scripts/kb-health.py --json-only       (dropped in the 2026-08 move)
50 5 * * *    cd REPO && python3 scripts/kb-doctor.py --quiet           (dropped in the 2026-08 move)
@reboot       ~/.config/nanoclaw/refresh-transcripts.sh
```

Cron on the box has a minimal environment: the managed block sets `PATH=/home/ubuntu/.local/bin:/usr/local/bin:/usr/bin:/bin` so `gh` at `~/.local/bin` resolves. Carry that line too.

## 2. Order of operations (cold barrier)

1. On OLD, capture read-only before anything stops: `crontab -l`, `systemctl --user list-units`,
   `docker volume ls`, `ONECLI_API_HOST=http://172.17.0.1:10254 onecli secrets list | wc -l`,
   `md5sum /ephemeral/approver-policy/APPROVAL_POLICY.json`, `grep -c 'Additional mount REJECTED' REPO/logs/nanoclaw.error.log`, `ls REPO/data/shared/`.
2. Warm pre-sync of `/data/prod-groups` and `REPO/data/` while OLD is live (additive, no `--delete`) to bound downtime.
3. Cold barrier on OLD: stop `nanoclaw`, `nanoclaw-dashboard`, `nanoclaw-coworker-mcp`, discord-feedback, timers, cron, then `docker compose down` in both OneCLI dirs, then dockerd. Assert inactive.
4. Cold delta with `--delete`: `REPO/data/`, `/data/prod-groups`, `/data/docker` (graph incl. volumes), then the config bundle (items 2, 6, 7, 9, 11) and item 1.
5. On NEW: fstab bind, daemon.json, start dockerd, `docker compose up -d --wait` for both OneCLI stacks, restore crontab, `daemon-reload`, stamp the tripwire, start `nanoclaw.service`, dashboard, MCP.
6. Re-point the network (item 12), redeliver the GitHub webhook backlog (`POST /app/hook/deliveries/{id}/attempts` for every failed delivery in the downtime window; the host dedups by guid).
7. Run section 3. Keep OLD stopped, not destroyed, until every check passes (rollback = start OLD).

## 3. Post-move verification (run all; each has an expected value)

```bash
[ "$(hostname)" = brev-m94ubmtdb ] || { echo "wrong host: $(hostname)"; exit 1; }   # adjust to the NEW box
cd ~/slang-coworkers-prod/nanoclaw
```

1. **Services**: `systemctl --user is-active nanoclaw nanoclaw-dashboard nanoclaw-coworker-mcp` all `active`; `docker ps --format '{{.Names}}' | grep -c '^ncl-41b9e3fd-'` > 0 within a few minutes of the first webhook.
2. **Cost cap is live** (the runner and the policy table came across): `./bin/ncl cost-cap get` prints the fleet ceiling and per-group overrides that OLD had; `./bin/ncl cost-cap status --session <a running session id>` returns `ok`/`warn`/`escalated`/`stopped`, not `unknown` for every session (all-unknown means the runner did not upgrade or `outbound.db` is not being written).
3. **Approver policy is mounted**: `grep -c 'Additional mount REJECTED' logs/nanoclaw.error.log` must equal the count captured on OLD in step 2.1 (that is, **zero new lines**; on a fresh log file the expected value is 0), and for a running approver container `docker inspect -f '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}){{println}}{{end}}' <name> | grep approver-policy` shows `/ephemeral/approver-policy -> /workspace/extra/approver-policy (ro)`.
4. **Approver ledger policy_version**: after the first post-move decision, `pnpm exec tsx scripts/q.ts data/v2.db "select policy_version, count(*) from approval_decisions where decided_at >= '<move time>' group by 1"` shows only the version in `ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json` (`v0-shadow-wide-r2` today). A `v0-shadow` row means the mount is missing again; the dashboard's Verity panel and its infrastructure check will show the same thing, but do not wait for them.
5. **Cron producers**: `crontab -l | grep -vcE '^#|^$'` = 11; after the first half hour `ls -la reports/ data/shared/reports/` shows fresh mtimes for `funnel.json`, `regression-quality.json`, `bot-contributions.json`, `review-rounds.json` (both copies) and `logs/funnel-cron.log` has no `FAILED`.
6. **OneCLI**: `ONECLI_API_HOST=http://172.17.0.1:10254 onecli agents list` lists every agent group; `onecli secrets list | wc -l` matches OLD; `~/.config/nanoclaw/refresh.log` gains a new line at the next :00/:30.
7. **Scheduled tasks**: `./bin/ncl tasks list` shows the same series as OLD (33 on 2026-09-09) with `next run` in the future, none paused by failure backoff; the learnings-wiki fold (`0 6 * * *`) and review-cycle mining (`20 5 * * *`) report one line each on their destinations on the first morning.
8. **Webhooks**: `logs/nanoclaw.log` shows `GitHub webhook server listening` on 3841 and `github-webhook: delivered` for a fresh event; App deliveries API shows no `status_code: 0` since the cutover.
9. **Disk layout**: `findmnt /ephemeral` is a bind of `/data`; `docker info --format '{{.DockerRootDir}}'` = `/data/docker`; `df -h / /data` both under 80%.
10. **Dashboard**: `env -u http_proxy -u https_proxy curl -s http://127.0.0.1:3737/api/review-rounds | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["schema"],d["complete"],d["generatedAt"])'` prints `3 True <recent>`; `/api/funnel` and `/api/regression-quality` return 200.
11. **Grafana/metrics**: `/metrics/api/health` 200; the `heartbeat_unixtime` field in InfluxDB `lp` advances (a collector that stopped must look different from a zero).
12. **Memory**: one coworker container's `/home/node/.claude/settings.json` has `autoMemoryEnabled: false` and the group's `memory/index.md` is under 16 k (the OKF migration state, not a fresh default).

Write the observed values next to each item in the move's runbook (`~/MIGRATION.md` on the box). A check that cannot be run is a finding, not a skip.

## 4. What this file does not cover

Building the new environment (packages, node, docker, GPU runtime, cloudflared): that is
`ops/launchable/bootstrap.sh`, validated separately. Secrets values: never in git; the vault
volumes and the App private key are copied, not re-created. The lego box
(`slang-cpu-coworkers`) has its own `~/haaggarwal/lego-nanoclaw` checkout and units and is not
part of a prod move except for the cross-links in item 12.
