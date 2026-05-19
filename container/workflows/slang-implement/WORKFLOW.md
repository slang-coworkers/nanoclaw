---
name: slang-implement
license: MIT
type: workflow
description: "Implement a fix or feature in the Slang compiler. Specialized build/test/format steps."
extends: implement
requires: [code.read, code.edit, test.run, test.gen, repo.pr]
uses:
  skills: [slang-build, slang-code-reader, slang-github, slang-code-writer]
  workflows: []
overrides:
  reproduce: "Write a failing test as a `.slang` file under `tests/`. Use CPU (`//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`) or interpreter (`//TEST:INTERPRET(filecheck=CHECK):`) directives since no GPU is available. For diagnostic tests use `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`. Commit the failing test first."
  change: "Use /slang-code-writer. Keep changes minimal and within one subsystem (parser, semantic checker, IR pass, or emitter). When fixing emitters, check all sibling slang-emit-*.cpp files for consistency. Prefer IR pass fixes over emit-level workarounds. When adding new IR instructions, update slang-ir-insts.lua."
  verify: |
    Build takes 15-25 min. Before starting, do three things:

    1. **Notify parent:** `mcp__nanoclaw__send_message(to="parent", text="⚙️ Build started — <branch>, worktree <path>. ETA 20 min. Will report when done.")` — so the orchestrator knows this session is active and not stalled.

    2. **Schedule a watchdog task** (in case the build outlives the idle window):
       ```
       mcp__nanoclaw__schedule_task(
         prompt="Check build: if build/Debug/bin/slangc exists in worktree <path> run the target test and report result; then cancel this task. If still building, report 'still building' and let this fire again.",
         processAfter="<now + 25 min, naive local>",
         recurrence="*/30 * * * *",
         new_session=false
       )
       ```
       Store the returned task id. Call `mcp__nanoclaw__cancel_task(taskId=<id>)` as soon as the build completes and results are confirmed.

    3. **Run the build:**
       ```bash
       cmake --build --preset debug >/dev/null 2>&1 || cmake --build --preset debug
       ```
       Test: `./build/Debug/bin/slang-test tests/path/to/new-test.slang`.
       Format: `./extras/formatting.sh`.
       For cross-backend changes: `SLANG_RUN_SPIRV_VALIDATION=1 ./build/Debug/bin/slangc -target spirv -o /dev/null test.slang`.

    Failure handling: if the build fails after 2 attempts (clean rebuild counts as attempt 2), commit a `wip:` branch with the failure log, cancel the watchdog task, and escalate to orchestrator with: build error summary, last 50 lines of build log, what was tried.

    On restart: check `git branch --show-current` and `git log --oneline -5`. If on a fix branch with commits, proceed to verify. If mid-build (no binary), restart the build subagent.

    Autonomy additions: build is always delegated to an `Agent` subagent — never run cmake/pip inline. Cancel the watchdog immediately after confirming results. If `slangc` binary exists but tests fail: fix, rebuild, retest — max 2 cycles before escalating.
---
