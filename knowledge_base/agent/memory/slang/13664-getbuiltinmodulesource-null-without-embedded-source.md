---
type: chain
title: slang#13664 — getBuiltinModuleSource null-deref with SLANG_EMBED_CORE_MODULE_SOURCE=OFF
description: "albertrodriguezclo, human-filed bug: Session::getBuiltinModuleSource dereferences null blobs when core-module source is not embedded (wasm: memory access out of bounds). Reporter's PR #13665 'Fixes #13664'. Triaged 10-15 17:26Z (cmt 6198150215), P3; parked on shepherd kaizhangNV reviewing #13665."
---

# slang#13664

**2026-10-15 ~17:10Z, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, assignee kaizhangNV (set ~40 s after creation), human-filed by albertrodriguezclo (same
reporter as the #13631–#13666 batch). Live body matches the payload. The only session on
`gh-issue-shader-slang/slang-13664` was this Main webhook session.

Orchestrator receipt at master 6597ec9202: `Session::getBuiltinModuleSource`
(`source/slang/slang-global-session.cpp:389-401`) calls `->getBufferPointer()` directly on
`getCoreLibraryCode()`, `getHLSLLibraryCode()`, `getAutodiffLibraryCode()` and `getGLSLLibraryCode()`
with no null check. Callers: language server (`slang-language-server.cpp:3334`), wasm
`GlobalSession::getBuiltinModuleSource` (`slang-wasm.cpp:101`). Same-file `:429` also calls it.

**Community fix already open:** PR #13665 "Return an empty builtin module source when the source is
not embedded" (`Fixes #13664`, created 17:05:09Z, assignees kaizhangNV + reporter). Same pattern as
#13653/#13655: triage should verify and point at the PR, not start a parallel fix.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13664`.


**17:08Z, triager progress (msg 8):** read the issue and PR #13665 (a 1-file null-guard in `Session::getBuiltinModuleSource`); now auditing the other `get*LibraryCode()` callers and checking that the bug reproduces. Progress only, not a report, so no reply sent.

**17:28Z, [Triage] (msg 10, memo `/workspace/inbox/a2a-1792085298548-4gsaeh/triage-13664.md`).** Triaged:
bug / medium / P3, not a duplicate. Verified on GitHub: comment [6198150215](https://github.com/shader-slang/slang/issues/13664#issuecomment-6198150215)
(17:26:41Z), `reproduced` label + Type Bug applied, #13665 head 7b2c797 non-draft with 6 checks
passing and 1 skipped, and no review decision yet.
- The triager's findings (not reproduced by me): an OFF native build segfaults in
  `slangd --print-builtin-module core|glsl`. The only caller of the 4 accessors is
  `Session::getBuiltinModuleSource`. On the #13665 head the query paths return `""`, and compile output is byte-identical to master.
- **Caveat on the PR:** on the `:429` compile path, #13665 turns the segfault into a silently empty
  module (`-compile-core-module` floods `undefined identifier 'void'`, and the GLSL fallback at
  `slang-api.cpp:244` caches an empty `.bin`). It is still a strict improvement. The triager posted an
  optional follow-up B on the issue: `compileBuiltinModule` → `SLANG_E_NOT_AVAILABLE` on empty source,
  plus a `slangd --print-builtin-module core` step in the weekly cmake-options job.
- Unfiled side note: `slang-language-server.cpp:3337` ignores the `slang_createGlobalSession` result.
- **Disposition:** parked on shepherd kaizhangNV reviewing #13665. No fixer handoff. The triager
  hands B to slang-fixer only if a maintainer asks the bot. The triager's one-shot re-check is
  `t-3606e0` at 2026-10-19 15:30Z. It is triager-owned and not visible from Main's `ncl tasks`.

**Resumes on:** a human comment that asks the bot something, #13665 merge/close, or the 10-19 re-check.
