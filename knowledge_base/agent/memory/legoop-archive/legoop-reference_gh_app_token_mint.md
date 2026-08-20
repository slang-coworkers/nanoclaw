---
type: reference
title: "Minting/using a GitHub App token directly needs a clean env (proxy collision)"
description: "ported lego-operator-memory archive; reference note"
tags: [legoop-archive, ported]
---

# Minting/using a GitHub App token directly needs a clean env (proxy collision)

`gh-app-token.py --install-id <id>` (and any direct `curl` to api.github.com with an explicit `Authorization`) fails from an interactive shell here, because the shell exports OneCLI proxy env (`https_proxy`/`HTTPS_PROXY` → the gateway) plus CA-bundle vars. The proxy intercepts the TLS call and injects its own path-matched `Authorization` header, which collides with the explicit token → GitHub rejects it.

**Fix — run with a clean env:**
```bash
TOKEN=$(env -i HOME=/home/ubuntu PATH=/usr/local/bin:/usr/bin:/bin \
  python3 /home/ubuntu/.config/nanoclaw/gh-app-token.py --install-id 123550981 2>/dev/null)
env -i HOME=/home/ubuntu PATH=/usr/local/bin:/usr/bin:/bin curl -sS -X POST \
  -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/slang-coworkers/nanoclaw/pulls -d "$PAYLOAD"
```
Install ids: `122982130` = shader-slang org, `123550981` = slang-coworkers (nanoclaw). PEM + app id live under `~/.config/nanoclaw/`. (This is exactly the path the gh-pr-as-nv-slang-bot skill uses with `--noproxy '*'`.)
