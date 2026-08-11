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
- ⛔ **STRUCK 2026-08-11 — this line's own "real cause" was ALSO wrong, and wrong in the same direction as the framing it claims to refute.** It said *"a server-side **phantom** requested reviewer (removed/renamed bot App whose node id no longer resolves)."* **Falsified by measurement** (Main, run directly, not relayed): `gh api graphql node(id:"BOT_kgDOCnlnWA")` → `{__typename: Bot, login: copilot-pull-request-reviewer, databaseId: 175728472}` — it resolves **right now**. Nothing phantom, removed, renamed, or unresolvable. **Real mechanism: GitHub resolves a *Bot* node in the PR's review-request set *as a User*** — what `Could not resolve to User node` literally says. #12228: timeline holds `review_requested → Copilot (type Bot, BOT_kgDOCnlnWA)`; `requested_reviewers` holds only `bmillsNV (User)`.
  ⭐⭐⭐ **The lesson is about THIS memo, not the issue.** This memo is titled *"the issue's own root cause was WRONG"* — then inherited the word **phantom** from that same discredited framing and shipped it as the correction. **Refuting a claim's specifics while keeping its vocabulary is not a refutation — the frame survives the receipts.** The `grep`/`git log -S` receipts on the line above are sound and still stand: they prove *no hard-coded id*, which is a **different proposition** from *"the id doesn't resolve."* Sound evidence, over-broad conclusion. ⇒ **A node id, error string, or flag named in a memo or a code comment is a falsifiable claim with a one-command test. Run it before storing it, and again before citing it.** Cost: this false mechanism sat in **two** of my memos and came ~1 approval from landing in `pr-board-sync.yml` as durable wrong documentation — the one place a future reader trusts. Caught by slang-fixer, re-verified by slang-reviewer (who logged their half as `Reviewing a comment's style is not verifying its factual claim`), not by me.
- ✅ **Fail-safe fix is UNAFFECTED.** try/catch around the mutation is correct regardless of *why* the server 422s — the error was in the rationale *comment*, not the code. Do not re-open the fix over this correction. Current approved artifact: post-image `18203c9588439ec50482d3d63f2ae51d43f3aefd`, comment `5248097492`, commit `e8cbf8de4c` (supersedes `dab3519414` / comment `5247874069`).

**Fix (maintainer-only):** wrap yml:1290-1296 in try/catch mirroring siblings — fail-safe, not a producer fix (malformed shape is a server-side entry we don't own). `git apply --check` clean against HEAD @1a2e4c5e98.

**State:** RESOLVED as far as a bot can take it. Advisory git-apply diff posted as issue comment https://github.com/shader-slang/slang/issues/12062#issuecomment-4942454202 (comment 4942454202). NO PR — `.github/workflows/**` not bot-pushable (App lacks `workflows` write, see [[project_bot_workflows_permission]]). Chain closed pending human maintainer applying the diff. Phantom reviewer may recur on other PRs until GitHub prunes it; fail-safe makes it harmless.
