---
name: project_12062_board_sync_422_maintainer_blocked
description: "board-sync HTTP 422 BOT_kgDOCnlnWA — advisory diff posted, maintainer-blocked; issue's own root cause was WRONG"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6330427-c93d-4b17-b04c-e08694b5eabd
---

shader-slang/slang#12062 — `board-sync / board-sync` check reds PRs with GraphQL HTTP 422 "Could not resolve to User node with the global id of 'BOT_kgDOCnlnWA'". Recurring ~5×/7d; deterministic (not a flake, not rerunnable). Filed by nv-slang-bot[bot] itself.

**The issue's own stated root cause was REFUTED at receipts level** (slang-triager) — don't trust the stale-node-id framing if this resurfaces:
- `grep`/`git log -S BOT_kgDOCnlnWA` → EMPTY. The id was NEVER in `pr-board-sync.yml`; there is no hard-coded id to "re-resolve".
- The `assignment failed` log line is a CAUGHT warning (red herring). The step that actually reds the check is **`Unrequest ignored reviewers`** → `removeRequestedReviewers` REST call at `pr-board-sync.yml:1290`, which passes LOGIN strings not node ids.
- Real cause: PR carried a **server-side phantom requested reviewer** (removed/renamed bot App whose node id no longer resolves). GitHub 422s reconciling that entry on ANY reviewer-mutation call. yml:1290 is the lone reviewer/assignee mutation NOT wrapped in the fail-safe try/catch its two siblings have (yml:1164, yml:1076).

**Fix (maintainer-only):** wrap yml:1290-1296 in try/catch mirroring siblings — fail-safe, not a producer fix (malformed shape is a server-side entry we don't own). `git apply --check` clean against HEAD @1a2e4c5e98.

**State:** RESOLVED as far as a bot can take it. Advisory git-apply diff posted as issue comment https://github.com/shader-slang/slang/issues/12062#issuecomment-4942454202 (comment 4942454202). NO PR — `.github/workflows/**` not bot-pushable (App lacks `workflows` write, see [[project_bot_workflows_permission]]). Chain closed pending human maintainer applying the diff. Phantom reviewer may recur on other PRs until GitHub prunes it; fail-safe makes it harmless.
