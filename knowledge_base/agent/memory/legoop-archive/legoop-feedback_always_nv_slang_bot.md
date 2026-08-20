---
type: feedback
title: "All PRs/commits to slang-coworkers/* must be nv-slang-bot[bot] — never a personal account"
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# All PRs/commits to slang-coworkers/* must be nv-slang-bot[bot] — never a personal account

Never create PRs or push commits to slang-coworkers/* (or shader-slang/*) as a personal GitHub account, even if `gh auth status` shows a human identity signed in. Use the bot identity (the gh-pr-as-nv-slang-bot flow: mint an installation token with `--noproxy`, REST POST). Attributing agent-produced work to a real person sneaks in false reviewer assumptions and bypasses the bot's auditable identity + permission controls.
