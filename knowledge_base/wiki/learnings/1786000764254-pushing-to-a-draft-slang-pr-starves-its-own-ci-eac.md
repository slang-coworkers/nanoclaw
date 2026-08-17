---
title: "Pushing to a draft slang PR starves its own CI — each dispatch disqualifies the previous yielded run from retry"
type: learning
topic: slang-compiler
source: learnings/1786000764254-pushing-to-a-draft-slang-pr-starves-its-own-ci-eac.md
---

# Pushing to a draft slang PR starves its own CI — each dispatch disqualifies the previous yielded run from retry

**Rule:** On a **draft** shader-slang/slang PR, iterating quickly can mean CI *never* runs a single build or test job. If you need real CI signal, stop pushing and let one dispatch sit — including no amends and no byte-identical re-pushes.

**Mechanism, verified at source (2026-08-06, PR #12382):**
1. **A draft PR gets no `pull_request` CI at all, by design.** `.github/workflows/ci.yml`'s `filter` job is gated on `github.event_name != 'pull_request' || github.event.pull_request.draft != true`, and the build/test jobs require `filter`. So `gh workflow run ci.yml --ref <branch>` (a `workflow_dispatch`) is the only way to get CI on a draft — which is why the drafts-only manual-dispatch rule exists.
2. **A manually dispatched bot run yields to human CI.** `wait-for-human-priority` fails with `::error::priority-gate-yielded: higher-priority CI is active; ci-retry-yielded-bot will rerun this bot CI when quiet`, and every `build-*`/`test-*` job is **skipped**. `check-ci` just aggregates that, so you see 2 failures / N skipped / 0 real failures.
3. ⭐ **The retry never fires if you keep pushing.** `extras/ci/retry-yielded-bot-ci.py` → `has_newer_run_for_branch()` returns true when another run on the same branch has a higher `run_number`, and the candidate loop `continue`s past it. **Each new dispatch disqualifies every earlier yielded run on that branch.** Push every ~20 min and only the newest is ever eligible — while the priority gate's own aging terminator is on a ~12h horizon and `--lookback-hours` defaults to 16.

**Net: on #12382, five distinct heads over ~1 hour produced ZERO build/test jobs.** Every run yielded. The last push was a commit-message amend — **byte-identical trees** (`git diff` empty, same tree hash) — and it still reset the window.

**How to apply:**
- After the final substantive push to a draft, **go quiet**. Quiescence removes the newer-run exclusion; the run then becomes eligible *once the retry workflow's other conditions also pass* (no active CI, within lookback, bot-authored, under the attempt cap, rerunnable conclusion, failed only via the priority gate). Note `created_at < cutoff` is a **maximum** age bound — there is no minimum-age rule, so a fresh dispatch can be picked up as soon as CI is quiet.
- **Prefer PR-description edits to commits** while waiting. `gh pr edit --body-file` changes no ref and resets nothing.
- Batch review responses into one push instead of one push per item. Responding promptly to review is what starves the CI you're waiting for — the incentives point the wrong way.
- The fast exit is the draft→ready flip, which releases the gate — but that is **operator/human-gated**; don't push to work around it.

⚠️ **Enumeration trap when counting heads:** `gh run list --branch <b>` misses SHAs that were **amended away** — they are no longer on the branch, so a branch-scoped query cannot see them, and it returns a plausible smaller number with no error. It gave me 4 heads when there were 5. Use `gh api repos/<o>/<r>/commits/<sha>/check-runs` per SHA from your reflog/push history.

**And read CI via `commits/<sha>/check-runs`, never `statusCheckRollup`** — the rollup dedupes by job name and can report 0 failing while check-runs reports 2 (see the separate note on that).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786000764254-pushing-to-a-draft-slang-pr-starves-its-own-ci-eac.md`_
