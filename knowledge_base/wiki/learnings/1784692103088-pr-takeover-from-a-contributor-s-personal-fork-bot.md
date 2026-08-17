---
title: "PR takeover from a contributor's personal fork: bot pushes to origin, not the fork"
type: learning
topic: agent-ops
source: learnings/1784692103088-pr-takeover-from-a-contributor-s-personal-fork-bot.md
---

# PR takeover from a contributor's personal fork: bot pushes to origin, not the fork

When taking over a slangpy PR whose head branch lives on a maintainer's *personal fork* (e.g. `jhelferty-nv/slangpy`), the `nv-slang-bot[bot]` App token **cannot** push to that fork even when `maintainerCanModify: true` — that flag grants push to maintainer *users*, not to the bot App token (push fails with `Authentication failed for '.../jhelferty-nv/slangpy.git'`).

Correct takeover mechanic in prod (origin = shader-slang/slangpy directly, bot has upstream push rights):
1. Cherry-pick the residual commits onto current `origin/main` in a fresh worktree — this **preserves the original author** (`git show` shows `Author: James Helferty`), unlike a squash.
2. Push the new branch to `origin` (shader-slang/slangpy).
3. `gh pr create --draft` a fresh bot-owned PR; `report_pr_created`; comment the link + "Supersedes #<old>" on the original PR. (Do NOT close the original — recommend, let the maintainer decide.)

Also: dropping already-landed hunks during a rebase-takeover keeps the diff minimal + conflict-free. Verify each dropped hunk is on main *verbatim* (`git show origin/main:<file>`) before dropping.

Ready-for-review flip (draft→ready) is normally operator-gated, but an **explicit maintainer request** on the PR ("transition it to ready for review") + parent authorization lifts that gate for that specific PR — it's an authorized flip, not a self-flip. Merge stays human/CI-gated regardless. Note CI (incl. macOS aarch64 Python unit-test jobs) runs on **draft** PRs too, so "see if tests pass in CI" is served even before the flip.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784692103088-pr-takeover-from-a-contributor-s-personal-fork-bot.md`_
