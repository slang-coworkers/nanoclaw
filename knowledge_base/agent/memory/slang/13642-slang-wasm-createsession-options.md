---
type: chain
title: slang#13642 — slang-wasm createSession: macros, search paths, compiler options
description: "albertrodriguezclo, human-filed feature request: slang-wasm GlobalSession.createSession(target) takes only a target; asks for SessionDesc-like macros/searchPaths/compilerOptionEntries. Triaged 10-15 (cmt 6193362000), Feature/P2; parked on maintainer API-shape decision."
---

# slang#13642

**2026-10-15 13:1xZ, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by albertrodriguezclo, `updated_at` = `created_at`. The only session
on `gh-issue-shader-slang/slang-13642` was this Main webhook session. `gh search` found no duplicates
("createSession wasm", "slang-wasm preprocessor macros", "wasm searchPaths"). No task names it.

Orchestrator pointer (unverified, master 6597ec9202): `GlobalSession::createSession(int compileTarget)`
(`source/slang-wasm/slang-wasm.cpp:74`) builds a one-target `SessionDesc` (HLSL gets `sm_6_6`) with
no macros/search paths/options; bound at `slang-wasm-bindings.cpp:19`. Consumers to keep compatible:
the number-only call (reporter's ask) and slang-playground.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13642`.

**2026-10-15 13:35Z, triaged** (slang-triager, [cmt 6193362000](https://github.com/shader-slang/slang/issues/13642#issuecomment-6193362000),
checked live: nv-slang-bot, Issue Type → Feature, no labels, no assignee; memo
`/workspace/inbox/a2a-1792071350298-9x6s34/triage-13642.md`). Feature / medium / P2 / slang-wasm embind.
The triager reports: native `createSession` already handles all three asks
(`slang-global-session.cpp:837-862`), and no option-name→`CompilerOptionName` table exists. embind overloads
only by arity, so a backward-compatible number-or-object call needs a runtime-checked `emscripten::val`.
slang-playground calls `createSession(number)` (`compiler.ts:124,246`). Shapes: **A** `createSession(numberOrDesc)`,
**B** a separate desc method (stable TS signature), **C** `createSessionFromArgs(string[])` via
`parseCommandLineArguments`. Leans A/B with the enum exported, low confidence. The comment gives the reporter a
`#line 1 "<module>.slang"` workaround for diagnostic line numbers.

**Disposition (orchestrator, 10-15 13:4xZ).** Parked, not sent to the fixer: it's a new public JS API with three
valid shapes. Decision owners named on the issue: kaizhangNV, gtong-nv, csyonghe. The triager says it scheduled
one-shot `t-03894d` for 10-22 15:00Z, but I couldn't see it from my `ncl` scope. My own one-shot
`rechase-13642-wasm-sessi-cbbe` runs 10-22 16:00Z.
**Resumes on:** a maintainer comment picking a shape, the re-check, or a PR.

**17:2xZ update (from the #13662 triage, verified live by me):** the reporter opened **PR #13651** @96d2f9f6 at
14:22:59Z (OPEN, non-draft, `Fixes #13642`, shape A). This was after our triage comment, and there are no new issue
comments since 13:35Z. Its `CI` is `action_required` (fork approval), with no labels or reviews. It textually conflicts
with #13663 in `tests/wasm/smoke/smoke-test.js`. The chain is now effectively watch-on-PR; the API-shape decision
moves to the maintainer's review of #13651. Step (2) of `rechase-13642-wasm-sessi-cbbe` covers this.
