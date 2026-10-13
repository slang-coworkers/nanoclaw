---
name: slangpy-implement
license: MIT
type: workflow
description: 'Implement a fix or feature in SlangPy: build/test/format, draft PR with explanation comment, peer review.'
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [slangpy-build, slangpy-code-reader, slangpy-github, slangpy-code-writer]
  workflows: []
overrides:
  reproduce: 'Write a failing test in `slangpy/tests/`. Functional API: minimal .slang shader + Python test exercising the call path. Type marshalling: test with the specific Python-to-Slang type combo. Set `SLANGPY_PRINT_GENERATED_SHADERS=1` to capture the generated kernel. Commit the failing test first.'
  change: 'Use /slangpy-code-writer. Keep changes minimal, match file style, stay within one layer (Python API, bindings, C++ native, or core SGL). New functional-API types: 3-step pattern — create Marshall, register in typeregistry.py, optionally add native signature handler. C++: ensure nanobind ownership is correct. All Python function args must have type annotations.'
  verify: |
    Build: delegate to an `Agent` subagent using `/slangpy-build` commands (never run cmake/pip inline; the subagent blocks until completion — no polling task). Test: `pytest slangpy/tests -v`. Full suite: `pytest slangpy/tests -v && pytest samples/tests -vra && python tools/ci.py unit-test-cpp`. Format: `pre-commit run --all-files` (re-run if it modifies files). Verify type annotations with pyright if available.

    Updating an existing PR: address every reviewer comment before re-running build/tests, so the run reflects the resolved state.

    Builds over ~5 min (full rebuild after a dep change): notify parent via `send_message` with `⚙️ Build started — <branch>, ETA <minutes>` before delegating.

    Autonomy: check prerequisites (libgl-dev etc.) before the first build subagent call — if missing, file one `install_packages` request with ALL missing packages first. On restart: if `/workspace/agent/slangpy/` exists with build artifacts, skip Clone → Verify; if tests already passed, go to Ship. If pytest fails after 2 fix cycles, commit a `wip:` branch and escalate.
  ship: |
    Descriptive commit linking the issue, push the branch, and open a **draft PR** via `/slangpy-github`: `gh pr create --draft` (every bot-authored PR is a draft, whatever it contains). Don't wait for human confirmation. Hard limits: never merge, never mark ready-for-review (`gh pr ready`), never push to protected branches — promotion to ready is a human decision. A/B-test mode (the dispatch names it): no push, no PR — attach the diff to the report instead.

    Keep the description **concise** (`### Code-comment discipline` says why). Write it to a file and pass `--body-file` (single-line `--body` strips badly) with four labeled sections, **each at most 2 lines**: **Summary** (the bug and the fix), **Root cause** (`file:line`), **Tests** (repro + broader suite), **Risk** (blast radius), then `Fixes shader-slang/slangpy#<n>` so GitHub back-links the issue and the supervisor's check (`supervise-issues` §5) passes. The whole description stays under 1,000 characters and has no tables; a hook refuses `gh pr create` / `gh pr edit` otherwise and names what is over. A question that blocks merge is one line: `Open question (blocks merge): <the question> — details in the explanation comment.` Approach, rejected alternatives, design rationale, per-case tables and long risk lists go in the explanation comment, not here.

    Run `/explain-diff-html` right after `gh pr create` and after **every** later push, so the PR's explanation comment (one comment, edited in place) explains the current head. While a push is unexplained the turn cannot end and `[Fix Review Request]` is refused.

    **Immediately after the PR exists, call `report_pr_created(repo="shader-slang/slangpy", pr_number=<n>)`** so `pr_session_mappings` routes later webhook events (review comments, CI results) back to this session.

    Then notify parent: 'PR opened: <url>'. Continue to **Peer review** and **PR follow-up** below.
---

## PR-review-fix mode

Inbound carries `MODE=pr-review-fix`, `PR=<n>` — a human asked the bot to fix a finding on a PR it didn't create. Same steps, three deltas:
- **In Setup:** `report_pr_created({repo, pr_number})` to claim it, then branch off the **PR head** (`git fetch origin pull/<n>/head`, worktree on `FETCH_HEAD`), not `main`.
- **In Ship:** deliver the fix as a **reviewable draft PR into the author's branch** (the slangbot model — never push onto their branch unsolicited). Push the branch to the `slang-coworkers/slangpy` fork, then open a PR **into the author's branch** using the **`nv-slang-bot` user PAT** (a *user* token — the GitHub App cannot open a PR into a contributor fork): `gh api -X POST repos/<author-owner>/slangpy/pulls -f head="slang-coworkers:fix/issue-<n>" -f base="<author-head-ref>" -f title="..." -f body="..." -F draft=true`. Use the REST API, **not** `gh pr create` — the latter routes via GraphQL, which gets the App token (403 cross-fork); REST `/repos/*/pulls` gets the user PAT that can open it. The author reviews and one-click merges; `report_pr_created` the new PR, comment its link on the original. (Same-repo PR → push to `origin` and use `gh pr create --draft --repo shader-slang/slangpy --base <author-head-ref> --head fix/issue-<n>` — REST is only for the cross-fork case.) Until the `nv-slang-bot` user PAT is live, or if the PR open is rejected, fall back to a **patch-comment** (diff + `git apply` one-liner) — do not push to the author's branch or open a carrier PR.
- Post back on the review thread once verified at HEAD.

**What to fix** is whatever the request names — CI failures, a reviewer's finding, or open bot review threads. Reuse `/slang-github-webhook`'s "CI failure" and "Review verdict / inline comment" handling. Unscoped ("help with this PR") → fix failing CI first, then sweep open bot review threads.

## Peer review

When `slangpy-reviewer` is in your destinations, dispatch the artifact for review and end your turn:

```
send_message(to="slangpy-reviewer", text="[Fix Review Request] shader-slang/slangpy#<number>: <title>\n\nMode: pr (or patch)\nPR / Patch: <url-or-path>\nTests added: slangpy/tests/<test>\nTest results: <PASS / X failures>")
```

Don't reply to status echoes. On the reviewer's substantive reply: APPROVE / 0 critical-high → report. REQUEST_CHANGES → apply edits, re-run Verify, re-push, re-send — **max 2 rounds**, then take the better diff and note unresolved feedback. If `slangpy-reviewer` isn't in destinations, skip.

## PR follow-up is webhook-driven [MUST]

Do **not** poll. Once the PR is open, review comments / verdicts / CI results arrive as inbound `kind: webhook` messages routed here via `pr_session_mappings`. On any inbound whose `content.event` starts `github.pr_review`, `github.ci_failed`, or `github.pr_mention`, **run `/slang-github-webhook`** (the generic handler — it routes by repo, so it treats slangpy correctly). Apply its per-event handling, then end the turn. On PR `CLOSED`/`MERGED`, clean up the worktree and report to parent.

**[MUST] Never gate a human-facing reply on a build.** When a maintainer asks a question or requests a rename/label, reply **on the same turn**, before any build/CI work — a one-liner is fine ("on it — addressing your review; full follow-up once the build lands"). A build that hangs otherwise leaves the maintainer in silence until the session is reaped on `absolute-ceiling`.
