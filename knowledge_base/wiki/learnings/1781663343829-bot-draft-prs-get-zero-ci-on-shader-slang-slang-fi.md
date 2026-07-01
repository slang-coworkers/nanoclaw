---
title: "Bot draft PRs get ZERO CI on shader-slang/slang (filter job skips drafts)"
type: learning
topic: slang-compiler
source: learnings/1781663343829-bot-draft-prs-get-zero-ci-on-shader-slang-slang-fi.md
---

# Bot draft PRs get ZERO CI on shader-slang/slang (filter job skips drafts)

Observed 2026-06-17 opening draft PRs #11639 / #11640; ci.yml verified @ sha `e2a1dde` (2026-06-17).

**Why a bot-authored DRAFT PR runs no CI at all:** `ci.yml`'s first job `filter` is gated `if: github.event_name != 'pull_request' || github.event.pull_request.draft != true`, and the `check-ci` merge gate is gated the same way. On a draft PR that condition is false, so `filter` skips, `should-run` is never set, and every build/test job (each `needs: [filter]` + `if: should-run == 'true'`) skips too. The run shows `completed / skipped`, every check `skipping` (not pending). `pull_request` event types include `ready_for_review`, so a human flipping the PR to ready-for-review fires a fresh `draft=false` event → full CI runs. **That is the only clean path to CI on a bot draft.**

**workflow_dispatch note (corrected 2026-06-21):** `gh workflow run ci.yml` once returned HTTP 403 for nv-slang-bot, and older notes blamed an `actions:write` / admin-rights gap. That 403 was actually a OneCLI gateway PAT-routing collision (a read-only user PAT shadowing the App token), **resolved 2026-06-17 ~07:48Z** — dispatch/rerun now work. BUT this does not change the conclusion: even a successful dispatch of `ci.yml` would still hit the `filter` draft-gate and skip on a draft PR. Dispatch is not a way to get CI on a draft.

**How to apply:**
- A bot draft PR sits with `skipped` CI until a human marks it ready-for-review. The "always dispatch ci.yml on every PR" directive (2026-06-15) does not produce CI on drafts — don't rely on it for drafts.
- Drafts-only guardrail interaction: fixer PRs stay draft, and only the operator can authorize `gh pr ready`. So a bot draft PR needing CI is blocked on EITHER an operator-authorized ready-flip OR a maintainer marking it ready. When a maintainer requested the PR and will judge on CI results, the maintainer marking it ready is the clean path — no operator gate, no self-authorized override.
- When a maintainer asks "open a PR so CI can run the test," flag up-front that CI won't execute while it's a draft. Don't claim CI was dispatched on a draft — verify with `gh pr checks <n>` / `gh run list --workflow ci.yml --branch <ref>` (you'll see `skipped`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781663343829-bot-draft-prs-get-zero-ci-on-shader-slang-slang-fi.md`_
