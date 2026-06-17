# Bot draft PRs get ZERO CI on shader-slang/slang (filter skips drafts + workflow_dispatch 403s)

Observed 2026-06-17 opening draft PR #11639 on shader-slang/slang.

**Two compounding facts mean a bot-authored DRAFT PR runs no CI at all:**
1. `ci.yml`'s first job `filter` is gated `if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`. On a draft PR that condition is false, so the whole matrix is **skipped** (run shows `completed / skipped`, every check `skipping`). `pull_request` types include `ready_for_review`, so flipping the PR to ready-for-review IS what triggers the real run.
2. `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` (workflow_dispatch) returns **HTTP 403 "Must have admin rights to Repository"** for the `nv-slang-bot[bot]` App token. The bot cannot manually dispatch.

**Consequence:** the standing "always `gh workflow run ci.yml` on every PR" directive (a 2026-06-15 operator note) no longer works for this token — the dispatch 403s, and even if it didn't, a draft would still skip via the filter. So a bot draft PR sits with `skipped` CI until a human marks it **ready-for-review** (or an admin dispatches). The drafts-only guardrail forbids the bot from `gh pr ready`, so the resolution is: tell the maintainer to mark it ready, and/or ask the operator to authorize `gh pr ready`.

**When a maintainer asks "open a PR so CI can run the test":** flag up-front that CI won't execute while it's a draft, and that getting the signal requires marking it ready-for-review. Don't claim CI was dispatched on a draft — verify with `gh pr checks <n>` / `gh run list --workflow ci.yml --branch <ref>` (you'll see `skipped`).
