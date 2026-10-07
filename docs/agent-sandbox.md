# NVIDIA agent sandbox VMs

NanoClaw installs on an NVIDIA agent sandbox VM (Colossus KubeVirt "AI Sandbox"
on corpnet, reached through Teleport) from the same branch and with the same
commands as on any other host:

```bash
git clone -b nv-coworkers https://gitlab-master.nvidia.com/haaggarwal/nanoclaw.git ~/workdir/nanoclaw
cd ~/workdir/nanoclaw && bash nanoclaw.sh
```

Clone from the GitLab mirror — github.com is not reachable from the sandbox.

## What happens differently

`setup.sh` recognises the VM (DMI vendor `KubeVirt` plus the sandbox's egress CA
at `/usr/local/share/ca-certificates/nvidia/sandbox-egress-ca.crt`) and runs
[`setup/host-profiles/agent-sandbox/prep.sh`](../setup/host-profiles/agent-sandbox/prep.sh)
before installing dependencies. It is idempotent and needs passwordless sudo.

| Sandbox constraint | What the profile does |
|---|---|
| Forwarded traffic is dropped, so Docker bridge networks have no egress | Agents run under podman's Docker-compatible API with slirp4netns (`NANOCLAW_AGENT_DOCKER_HOST`, `NANOCLAW_AGENT_NETWORK`); images build on the host network (`NANOCLAW_BUILD_NETWORK`) and are copied into podman after each build |
| Outbound HTTPS is re-signed by an inspecting proxy | The image build trusts the sandbox's CAs (`NANOCLAW_EXTRA_CA_DIR`); agents already trust them at runtime through the gateway's bundle, which is built from the host's store |
| github.com, cli.github.com, apt.llvm.org and Docker Hub's layer CDN are blocked | Release downloads and base images go through Artifactory (`NANOCLAW_GITHUB_RELEASES_MIRROR`, `NANOCLAW_DOCKERHUB_MIRROR`, `NANOCLAW_GHCR_MIRROR`); the LLVM repo is skipped |
| The image lacks `libpam-systemd`; Teleport opens no login session | Installs it, enables lingering, and setup finds `/run/user/<uid>` itself |
| Docker's default MTU stalls TLS on the VM's 1440-byte NIC | Sets Docker's MTU to the NIC's |
| `onecli.sh` cannot install here | Runs OneCLI from [`onecli-compose.yml`](../setup/host-profiles/agent-sandbox/onecli-compose.yml) (host network, no login) at the version setup pins; setup's gateway step reuses it |

The settings land in `.env` (existing values win). Everything else — the image,
OneCLI provider wiring, the service, the first agent — is the standard flow.

## Overrides

- `NANOCLAW_HOST_PROFILE=none bash nanoclaw.sh` — skip the profile.
- `NANOCLAW_HOST_PROFILE=agent-sandbox` — apply it where detection does not.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `onecli` answers `AUTH_REQUIRED` | `NEXTAUTH_SECRET` is set in OneCLI's `.env` → remove it and re-run `bash setup.sh` |
| Agents get 401 from the inference API | The vault secret's host pattern must be `inference-api.nvidia.com` exactly |
| `Image not found` after a manual rebuild | Rebuild with `./container/build.sh` (it copies the image into podman), not plain `docker build` |
| Agent containers have no network | Check `.env` has `NANOCLAW_AGENT_NETWORK=slirp4netns` and `NANOCLAW_AGENT_DOCKER_HOST`, then restart the service |
| `docker ps` shows no agents | They run under podman: `DOCKER_HOST=unix:///run/podman/podman.sock docker ps` |
