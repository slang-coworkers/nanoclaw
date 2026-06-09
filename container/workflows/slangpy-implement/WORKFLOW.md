---
name: slangpy-implement
license: MIT
type: workflow
description: 'Implement a fix or feature in SlangPy. Specialized build/test/format steps.'
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [slangpy-build, slangpy-code-reader, slangpy-github, slangpy-code-writer]
  workflows: []
overrides:
  reproduce: 'Write a failing test in `slangpy/tests/`. Functional API: minimal .slang shader + Python test exercising the call path. Type marshalling: test with the specific Python-to-Slang type combo. Set `SLANGPY_PRINT_GENERATED_SHADERS=1` to capture the generated kernel. Commit the failing test first.'
  change: 'Use /slangpy-code-writer. Keep changes minimal, match file style, stay within one layer (Python API, bindings, C++ native, or core SGL). New functional-API types: 3-step pattern — create Marshall, register in typeregistry.py, optionally add native signature handler. C++: ensure nanobind ownership is correct. All Python function args must have type annotations.'
  verify: |
    Build: delegate to an `Agent` subagent using `/slangpy-build` commands (never run cmake/pip inline). Test: `pytest slangpy/tests -v`. Full suite: `pytest slangpy/tests -v && pytest samples/tests -vra && python tools/ci.py unit-test-cpp`. Format: `pre-commit run --all-files` (re-run if it modifies files). Verify type annotations with pyright if available.

    Updating an existing PR: address every reviewer comment before re-running build/tests, so the run reflects the resolved state.

    Builds over ~5 min (full-rebuild after dep change): notify parent via `send_message` with `⚙️ Build started — <branch>, ETA <minutes>` and delegate the build to an `Agent` subagent (it blocks until completion — no polling task).

    Autonomy: check prerequisites (libgl-dev etc.) before the first build subagent call — if missing, file one `install_packages` request with ALL missing packages first. On restart: if `/workspace/agent/slangpy/` exists with build artifacts, skip Clone → Verify; if tests already passed, go to Ship. If pytest fails after 2 fix cycles, commit `wip:` branch and escalate.
  ship: |
    Descriptive commit linking the issue, push the branch, open/update the PR via `/slangpy-github` (`gh pr create`). Don't wait for human confirmation.

    **The PR body is the chain's GitHub observability artifact** (spine `### GitHub as primary observability`), so it MUST carry:
    - the rolled-up 5-bullet summary (Status / Link / Verdict / Next-action / Blocker), and
    - a `Fixes shader-slang/slangpy#<number>` (or `Closes #<number>`) line so GitHub back-links the PR to the issue and the supervisor's comment-verification (`supervise-issues` §5) passes.

    **Immediately after the PR exists, call `report_pr_created(repo="shader-slang/slangpy", pr_number=<n>)`** — this registers the `pr_session_mappings` row so future webhook events (review comments, CI results) route back to your session instead of orphaning. Without it, every follow-up review comment looks orphaned.

    Then notify parent: 'PR opened: <url>'.
---
