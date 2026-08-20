---
type: project
title: "How szihs installation tokens are generated and refreshed in the dev vault"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# How szihs installation tokens are generated and refreshed in the dev vault

nv-slang-bot has 3 GitHub App installations:
- `122982130` — shader-slang org (7 repos)
- `123550981` — slang-coworkers org (nanoclaw repo)
- `122269597` — szihs personal account (all 13 repos, including szihs/slangpy)

Token generation: `python3 ~/.config/nanoclaw/gh-app-token.py --install-id <id>` (private key at `~/.config/nanoclaw/github-app.pem`, app id 3311378)

Dev vault (port 10256) secrets for szihs:
- `1312a45c-...` — `GitHub (szihs)` — `api.github.com` path `/repos/szihs/*` — REST/gh CLI
- `292f0169-...` — `GitHub (git-push szihs)` — `github.com` path `/szihs/*` — git push (Basic base64)

Refresh script: `/home/ubuntu/haaggarwal/refresh-gh-tokens-dev.sh` — runs every 30 min via cron, covers all 5 secrets (shader-slang, slang-coworkers, szihs, git-push, git-push-szihs).

**Why:** szihs/slangpy was getting 403 on git push because nv-slang-bot was only installed on shader-slang org. Fixed 2026-05-04 by adding szihs installation (id 122269597) and path-routed git-push-szihs secret so pushes to github.com/szihs/* use the correct token.

**How to apply:** If a new szihs repo needs access, no changes needed — installation covers all szihs repos. If a new org/user needs access, add installation + new secret + refresh script entry.

