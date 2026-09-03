# ops/launchable — Brev launchable + host-move automation for slang-coworkers-prod

Turns the painful, prose-only prod host move (see the `slang-coworkers-cli` skill's
migration runbook) into executable, codex-validated artifacts. Brev has **no reattachable
volumes**, so the move splits into two halves:

- **Half A — environment (reproducible):** `bootstrap.sh` — the setup script for a Brev
  **Launchable** (VM Mode). Reproduces the entire host config from a git clone: disks +
  `/ephemeral` bind, docker + GPU (nvidia-ctk legacy, `data-root=/data/docker`), host
  toolchain (`gh`/`bun`/`uv`), repo build via `setup.sh`, agent image (fresh only), mounts,
  cron, ports/network, systemd prereqs. **No secrets, no state.**
- **Half B — state + secrets (a full cold rsync):** `restore-state.sh` — run on the NEW box;
  pulls a full cold copy of `data/` + the whole `/data` (docker graph = images **and** the
  OneCLI vault volumes, + prod-groups) from the OLD box, restores the config bundle, stamps
  the upgrade tripwire, and starts the restored `nanoclaw.service`. `repoint.md` — the
  irreducibly-manual network re-point (new cloudflared hostname → GitHub App webhook URL +
  Pomerium allowlists + lego cross-links).

`inventory.txt` is the ground-truth host snapshot the scripts were built + validated against
(captured read-only 2026-08-26 from `brev-2sl8wvgfr`).

## How to use

1. **Build the Launchable** (one time): iterate `bootstrap.sh` on a throwaway box —
   `brev create test --type L40S --startup-script @bootstrap.sh` — then paste the setup
   script into the Brev **Console** → Launchable builder → **VM Mode**.
   (Launchables are console-only; there is no `brev` CLI to create one — the CLI
   `--startup-script` is only the test harness.)
   - **Setup-script field has a 16 KiB paste limit.** `bootstrap.sh` (~21 KiB, commented) is
     the source of truth; **paste `bootstrap.min.sh`** (~15.9 KiB — same code, comments
     stripped, `bash -n` clean). Regenerate it after any edit:
     `sed '1!{/^[[:space:]]*#/d;}' bootstrap.sh | sed '/^[[:space:]]*$/d' | sed -E 's/  +# .*$//' > bootstrap.min.sh`
     If a future edit pushes `.min.sh` over 16 KiB, switch the field to a curl-stub that
     fetches `bootstrap.sh` from the repo (needs it committed/pushed).
   - **Image ID:** leave blank (default machine image per compute).
2. **Migrate:** deploy a NEW box from the Launchable (Half A runs automatically), then on it:
   `OLD_SSH=ubuntu@<old> SSH_KEY=/path/to/key DRY_RUN=1 ./restore-state.sh` (preview),
   then `DRY_RUN=0` to execute. Finally work through `repoint.md`.

## Key invariants (do not break)

- **`REPO_DIR` must be identical to prod** (`/home/ubuntu/slang-coworkers-prod/nanoclaw`) — the
  systemd unit + image names derive from `slug = sha1(REPO_DIR)[:8]` (prod = `41b9e3fd`);
  a different path breaks the restored `image_tag` / `.env CONTAINER_IMAGE`.
- **Cold copy only:** `restore-state.sh` stops services + cron + dockerd on **both** boxes and
  asserts them inactive before any rsync; the docker graph is copied with `-aHAX -H` (overlay2
  hardlinks) and requires the **same docker major** both ends.
- **`/ephemeral` is a bind of `/data`** — recreated via fstab, never rsync'd separately.
- **Migration leaves docker stopped** in Half A; Half B rsyncs the graph store, then starts it.
- **Tripwire is stamped AFTER restore** (`scripts/upgrade-state.ts set`) or the host crash-loops
  (`src/index.ts` refuses to boot on a version/marker mismatch).

## Validation status

Both scripts were hardened through repeated `codex exec` adversarial review to a **SHIP**
verdict (no P0/P1): `bootstrap.sh` over 5 passes, `restore-state.sh` over 4. Bugs codex
caught and we fixed: `set -e` crontab wipe, `/data`→root-disk exhaustion, token-in-URL leak,
privileged-rsync running `ssh` as root (no brev key → SSH 255), cold-barrier not asserted,
missing `--delete` (stale-WAL corruption), two competing host units, OneCLI readiness races,
and the capacity gate re-triggering after restore.

> ⚠️ `inventory.txt` and `repoint.md` contain **install-specific infra details** (box ids,
> hostnames, port map, GitHub App id). No secret values, but review before committing to a
> public branch — consider keeping them install-local.
