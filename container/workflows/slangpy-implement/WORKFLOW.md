---
name: slangpy-implement
license: MIT
type: workflow
description: "Implement a fix or feature in SlangPy. Specialized build/test/format steps."
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [slangpy-build, slangpy-code-reader, slangpy-github, slangpy-code-writer]
  workflows: []
overrides:
  reproduce: "Write a failing test in `slangpy/tests/`. For functional API issues, write a minimal .slang shader and Python test that exercises the call path. For type marshalling issues, create a test with the specific Python-to-Slang type combination. Set `SLANGPY_PRINT_GENERATED_SHADERS=1` to capture the generated kernel. Commit the failing test first."
  change: "Use /slangpy-code-writer. Keep changes minimal, follow existing style in the file, and stay within one layer (Python API, bindings, C++ native, or core SGL). For new types in the functional API, follow the 3-step pattern: create Marshall, register in typeregistry.py, optionally add native signature handler. For C++ changes, ensure nanobind ownership is correct. All Python function arguments must have type annotations."
  verify: |
    Build: delegate to an `Agent` subagent using `/slangpy-build` commands (never run cmake/pip inline). Test: `pytest slangpy/tests -v`. Full suite: `pytest slangpy/tests -v && pytest samples/tests -vra && python tools/ci.py unit-test-cpp`. Format: `pre-commit run --all-files` (re-run if it modifies files). Verify type annotations with pyright if available.

    If updating an existing PR: address every reviewer comment before re-running build/tests, so the next run reflects the resolved state.

    For builds that exceed ~5 min (full-rebuild after dep change): notify parent via `send_message` with `⚙️ Build started — <branch>, ETA <minutes>` and schedule a `*/30 * * * *` watchdog that cancels itself when the build finishes.

    Autonomy additions: check prerequisites (libgl-dev etc.) before the first build subagent call — if missing, file one `install_packages` request with ALL missing packages before proceeding. On restart: check if `/workspace/agent/slangpy/` exists — if build artifacts exist, skip Clone and go to Verify; if tests were already passing, go to Ship. If pytest fails after 2 fix cycles, commit `wip:` branch and escalate.
---
