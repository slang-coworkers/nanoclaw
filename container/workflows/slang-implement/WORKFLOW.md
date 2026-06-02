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
  reproduce: 'Commit a failing `.slang` test under `tests/` first. CPU: `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`. Interpreter: `//TEST:INTERPRET(filecheck=CHECK):`. Diagnostics: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`. No GPU available.'
  change: 'Use /slang-code-writer. Minimal changes, existing file style, one subsystem (parser, semantic checker, IR pass, or emitter). Emitter fixes: check all sibling slang-emit-*.cpp for consistency; prefer IR pass fixes over emit-level workarounds. New IR instructions: update slang-ir-insts.lua.'
  verify: |
    Build takes 15-25 min. Always delegate it to an `Agent` subagent, never inline. Before starting:
    1. Notify parent: `mcp__nanoclaw__send_message(to="parent", text="⚙️ Build started — <branch>, worktree <path>. ETA 20 min.")`.
    2. Schedule a watchdog (build may outlive the idle window): `mcp__nanoclaw__schedule_task(prompt="If build/Debug/bin/slangc exists in worktree <path>, run target test, report, cancel this task; else report 'still building' and refire.", processAfter="<now + 25 min, naive local>", recurrence="*/30 * * * *", new_session=false)`. Store the id; `mcp__nanoclaw__cancel_task(taskId=<id>)` as soon as results are confirmed.
    3. Build: `cmake --build --preset debug >/dev/null 2>&1 || cmake --build --preset debug`. Test: `./build/Debug/bin/slang-test tests/path/to/new-test.slang`. Format: `./extras/formatting.sh`. Cross-backend: `SLANG_RUN_SPIRV_VALIDATION=1 ./build/Debug/bin/slangc -target spirv -o /dev/null test.slang`.

    Updating a PR: address every reviewer comment before re-running build/tests.
    Failure: after 2 attempts (clean rebuild = attempt 2), commit a `wip:` branch with the failure log, cancel the watchdog, escalate to orchestrator with error summary + last 50 log lines + what was tried.
    Restart: `git branch --show-current` + `git log --oneline -5`. Fix branch with commits → verify; no binary → restart the build subagent.
    Tests fail with `slangc` present → fix/rebuild/retest, max 2 cycles before escalating.
---
