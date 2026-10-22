---
type: chain
title: slang#13642 — slang-wasm createSession: macros, search paths, compiler options
description: "albertrodriguezclo, human-filed feature request: slang-wasm GlobalSession.createSession(target) takes only a target; asks for SessionDesc-like macros/searchPaths/compilerOptionEntries. Triaged 10-15 (cmt 6193362000), Feature/P2; jkwak-work (assignee) asked 10-21 for a JS-vs-C++ API table; triager answering."
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

**2026-10-21 15:39Z, maintainer comment** ([6319967924](https://github.com/shader-slang/slang/issues/13642#issuecomment-6319967924),
jkwak-work, a real `@nv-slang-bot` mention, checked live). jkwak-work is now assigned and the `WebGPU` label is on. They
did not pick A/B/C. They asked that the API follow the C++ signatures, for a JS-vs-C++ comparison table (names +
signatures), and for the minimal change toward C++-like signatures. Forwarded verbatim to slang-triager on
`gh-issue-shader-slang/slang-13642` (msg 55, in_reply_to 14, `<github-post-authorized />`). The owner session
`sess-1792070232255-unt8z9` woke and is running. I updated the re-check `rechase-13642-wasm-sessi-cbbe` (10-22 16:00Z) to
verify the bot answered.
**Resumes on:** the triager's reply/report, a jkwak-work follow-up, or the re-check.

**17:2xZ update (from the #13662 triage, verified live by me):** the reporter opened **PR #13651** @96d2f9f6 at
14:22:59Z (OPEN, non-draft, `Fixes #13642`, shape A). This was after our triage comment, and there are no new issue
comments since 13:35Z. Its `CI` is `action_required` (fork approval), with no labels or reviews. It textually conflicts
with #13663 in `tests/wasm/smoke/smoke-test.js`. The chain is now effectively watch-on-PR; the API-shape decision
moves to the maintainer's review of #13651. Step (2) of `rechase-13642-wasm-sessi-cbbe` covers this.

**15:5xZ addendum.** PR #13651 is now at head 9c056c8d0a, labelled `pr: breaking change`, assigned to
jkwak-work and albertrodriguezclo, with dshreiner-nv requested. At 15:40Z jkwak-work commented on it (6320008034)
that review "will take some time" because of the API-side considerations. I sent the triager this context (msg 65):
compare #13651 against the C++ API and answer on the issue, not on the PR.

**2026-10-21 16:08Z, triager answered** ([6320607407](https://github.com/shader-slang/slang/issues/13642#issuecomment-6320607407),
checked live: nv-slang-bot posted it on the issue, with nothing new on #13651; master `a801f26`, TS from the `v2026.20` `interface.d.ts`). The triager reports:
- **No C++ divergence.** `searchPaths`/`preprocessorMacros`/`compilerOptionEntries`/`findProfile` predate slang-wasm
  (#5237); the JS binding never mirrored them. Since then C++ added `SlangGlobalSessionDesc` (#6152) and
  `skipSPIRVValidation` (#6893), and this issue needs neither.
- **#13651 matches C++ on** the field names (`preprocessorMacros`, `searchPaths`, `profile`, `defaultMatrixLayoutMode`,
  `intValue0/1`/`stringValue0/1`).
- **#13651 differs on** `profile` (a name, not an ID), a single `target` instead of `targets[]`, a flat `compilerOptions`
  whose entry kind is guessed, raw ints where C++ has enums, and an `any` TS type.
- **Proposed minimum:** (1) rename to `compilerOptionEntries` with the nested `{name, value:{kind,…}}` shape,
  (2) keep the number form, (3) keep `profile` as a name, (4) a typed param via `EMSCRIPTEN_DECLARE_VAL_TYPE`/`register_type`.
- **Open for jkwak-work:** a single `target` or `targets[]`, and whether to bind the enums now.
The reporter owns the PR, so there's no fixer handoff and no bot PR. The triager's re-check `t-03894d` moved to 10-28 15:00Z.
My backstop `rechase-13642-wasm-sessi-cbbe` moved to 10-28 16:00Z.
**Resumes on:** a jkwak-work comment on the issue, a review of #13651, or the 10-28 re-checks.

**2026-10-21 18:15Z, reporter comment** (6323221270, albertrodriguezclo, addressed to @jkwak-work; checked live).
It doesn't mention `@nv-slang-bot` (the event arrived as `pr_mention` anyway). The reporter says that once jkwak-work
picks between `target` and `targets[]`, they'll update #13651 to match the bot's comparison: C++-shaped
`compilerOptionEntries`, a named TS type, and the number form kept. The webhook payload ended with a bracketed
"[Optional preference line, if Albert has one: …]" placeholder; the reporter removed it 6 s later, so don't quote it.
No question for the bot, so I dispatched nothing, to avoid a self-echo reply. It's still parked on jkwak-work's choice, and the
10-28 re-checks cover it.

**2026-10-21 20:36Z, jkwak-work decided** ([6325983474](https://github.com/shader-slang/slang/issues/13642#issuecomment-6325983474),
checked live, no `@nv-slang-bot` mention). Their reasons, quoted: "match to C++ API as much as we can in order to avoid unforeseen problems",
"we should go with \"targets\"". `createSession` takes a `SessionDesc` mirror. Most fields can be skipped for now, but
"the ones we add should mirror the shape on C++ API as much as possible", with `targets` of `TargetDesc` (they
quoted both C++ structs). The comment is framed as "Note for my self". The open decision is resolved; the next move is the
reporter updating #13651 (head still 9c056c8d0a). I dispatched nothing: no bot question, and the reporter owns the PR.
I updated the backstop `rechase-13642-wasm-sessi-cbbe` (10-28 16:00Z) to watch for #13651's new head.

**2026-10-21 22:21Z, reporter updated #13651** (cmt 6327839880, checked live, no bot mention; PR head 9c056c8d0a →
c0df7e87cf, 6 checks green / 1 pending at 22:2xZ). Per the reporter: `SessionDesc` with `targets[]`, `defaultMatrixLayoutMode`,
`searchPaths`, `preprocessorMacros`, `compilerOptionEntries`; `TargetDesc` with the C++ field names and
`profile` as a `SlangProfileID`, plus a new `GlobalSession.findProfile(name)`. `CompilerOptionEntry` requires
`kind`. An HLSL target with no profile still gets `sm_6_6`. `createSession(number)` is kept. `interface.d.ts` has named
types (`SessionDesc | number`). Skipped: `flags`, `fileSystem`, `enableEffectAnnotations`, `allowGLSLSyntax`,
`skipSPIRVValidation`, and enum export (raw ints). I dispatched nothing. The next move is jkwak-work's review of #13651.
