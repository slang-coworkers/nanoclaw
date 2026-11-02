---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-02T04:01:53.911Z
---

# Nightly Coverage coverage-windows red on Chocolatey 503 is infra, not a Slang regression

2026-11-02 run 41375586658 (Nightly Slang Coverage Test): only `coverage-windows / coverage` failed. The step that installs `opencppcoverage` 0.9.9 via `choco` got HTTP 503 from `community.chocolatey.org/api/v2` and threw "choco install exited 1" about 8 s in, before any Slang code was built. macOS and Linux coverage plus merge-and-deploy passed. How to tell it from a real break: read `gh run view <run> --job <id> --log-failed` and look at the first failing step; a package-feed 503 means nothing to bisect. Treat it as a flake unless it fails two nights in a row (the install step has no retry).
