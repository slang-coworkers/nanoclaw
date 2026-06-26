---
name: slang-implement
license: MIT
type: workflow
description: 'Implement a fix or feature in the Slang compiler. Specialized build/test/format steps.'
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [slang-build, slang-code-reader, slang-github, slang-code-writer]
  workflows: []
overrides:
  reproduce: 'Commit a failing `.slang` test under `tests/` first. CPU: `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`. Interpreter: `//TEST:INTERPRET(filecheck=CHECK):`. Diagnostics: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`. Don''t assume "no GPU": before punting to a hardware retest, run `nvidia-smi`. If a GPU is present, attempt the repro (`-vk`/`-cuda`/`-dx12`) — `install_packages` the backend toolchain if missing. Only if no device is found is the case hardware-gated; say so explicitly.'
  change: 'Use /slang-code-writer. Minimal changes, existing file style, one subsystem (parser, semantic checker, IR pass, or emitter). Emitter fixes: check all sibling slang-emit-*.cpp for consistency; prefer IR pass fixes over emit-level workarounds. New IR instructions: update slang-ir-insts.lua.'
  verify: |
    Build takes 15-25 min. Always delegate it to an `Agent` subagent, never inline — the subagent blocks until the build completes, so no polling task is needed. Before starting:
    1. Notify parent: `mcp__nanoclaw__send_message(to="parent", text="⚙️ Build started — <branch>, worktree <path>. ETA 20 min.")`.
    2. Build (inside the subagent): `cmake --build --preset debug >/dev/null 2>&1 || cmake --build --preset debug`. Test: `./build/Debug/bin/slang-test tests/path/to/new-test.slang`. Format: `./extras/formatting.sh`. Cross-backend: `SLANG_RUN_SPIRV_VALIDATION=1 ./build/Debug/bin/slangc -target spirv -o /dev/null test.slang`. When the subagent returns, act on the result on the same turn.

    Updating a PR: address every reviewer comment before re-running build/tests.
    Failure: after 2 attempts (clean rebuild = attempt 2), commit a `wip:` branch with the failure log, escalate to orchestrator with error summary + last 50 log lines + what was tried.
    Restart: `git branch --show-current` + `git log --oneline -5`. Fix branch with commits → verify; no binary → restart the build subagent.
    Tests fail with `slangc` present → fix/rebuild/retest, max 2 cycles before escalating.
---
