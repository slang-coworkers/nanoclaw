# spine-khr

Khronos specification coworker spine (lego coworker model). It provides the identity, invariants, context and coworker types `khr-common` (abstract) and `khr-writer`, and the `khr-implement` workflow.

It ports a mention-driven GitLab agent harness for Khronos spec and tooling work onto nanoclaw with the Codex provider. Port status, the parity checklist and decisions are in [PORT.md](PORT.md).

## Ownership

This branch only adds files. It owns:

- `container/spines/khr/**`
- `container/workflows/khr-*/**`
- `container/skills/khr-*/**`
- `container/mcp-servers/khr-*/**`
- `coworkers/khr-*.yaml` and `coworkers/khrbotnv.yaml` (named after the source harness's bot, by owner decision)
- `khr/**`: operator tools that run on the host, such as `khr/replay/`

It changes no file owned by nv-main. Anything that needs core (`src/**`, `container/agent-runner/**`, `.github/**`, `docs/**`) goes to nv-main as a separate, generic pull request.

## What this repo must never contain

This repo is public. Keep out: Khronos project paths or IDs, account names or IDs, issue or merge-request content, tokens, and host or deployment details. Those belong in the install's local configuration.
