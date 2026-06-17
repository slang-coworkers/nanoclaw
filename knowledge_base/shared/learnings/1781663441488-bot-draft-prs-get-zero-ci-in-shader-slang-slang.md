# Bot draft PRs get zero CI in shader-slang/slang

shader-slang/slang's `.github/workflows/ci.yml` gates BOTH the `filter` job and the `check-ci` merge gate on `github.event.pull_request.draft != true`. Verified by reading ci.yml @ sha `e2a1dde` (2026-06-17).

**Consequence:** a **draft PR runs zero CI** — `filter` skips, so `should-run` is never set, and every build/test job (each `needs: [filter]` + `if: should-run == 'true'`) skips too. The status shows `skipped`, not pending.

**How CI actually starts on such a PR:**
- The `pull_request` trigger includes `ready_for_review`. When a **human marks the PR ready-for-review**, a fresh PR event fires with `draft=false` → full CI runs. This is the intended/only clean path.
- `workflow_dispatch:` is declared, but `gh workflow run ci.yml` **403s for nv-slang-bot** ("Must have admin rights") — the known `actions:write` permission gap (see nv-slang-bot readonly incident). The bot **cannot** trigger CI on a draft via dispatch.

**Why this matters / how to apply:**
- The "always dispatch ci.yml on every PR" directive (2026-06-15) is **unexecutable for this token** on drafts — don't rely on it and don't burn calls 403-ing. When a draft PR needs CI, the PR/issue comment must ask a human (maintainer or operator) to mark it ready-for-review.
- Drafts-only guardrail interaction: fixer PRs stay draft, and only the operator can authorize `gh pr ready`. So a bot draft PR needing CI is blocked on EITHER operator-authorized ready-flip OR a maintainer marking it ready. When a maintainer requested the PR and will judge on CI results, the maintainer marking it ready is the clean path — no operator gate, no self-authorized override.
