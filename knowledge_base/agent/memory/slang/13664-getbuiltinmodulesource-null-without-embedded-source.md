---
type: chain
title: slang#13664 — getBuiltinModuleSource null-deref with SLANG_EMBED_CORE_MODULE_SOURCE=OFF
description: "albertrodriguezclo, human-filed bug: Session::getBuiltinModuleSource dereferences null blobs when core-module source is not embedded (wasm: memory access out of bounds). TERMINAL: reporter PR #13665 merged 10-26 19:29Z by jkwak-work (bba63c2376); issue closed completed. Follow-up B (compileBuiltinModule on empty source) unfiled, operator call."
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

**2026-10-26 15:35Z, triager re-check (msg 2) — Main-verified.** Shepherd changed: jkwak-work
(taking over from kaizhangNV) APPROVED head `39421f3d7` 10-23 20:10Z, enabled auto-merge, and queued the PR at 22:03Z.
**At 22:53Z the merge queue evicted it.** Auto-merge is now off and the PR is not re-queued. It stays OPEN/BLOCKED, and all 56 head checks pass.
The only failure is SlangPy Tests on Windows (slangpy run `40035001152`): `sgl_tests` printed `284 passed`
and `Status: SUCCESS!`, then exited 1. That is the known teardown flake
[slangpy#1062](../imported/project_12074_sgl_tests_teardown_exitcode_flake.md), still OPEN. The bot token
cannot enqueue (precedent [#12052](../imported/project_12052_stranded_mergequeue_operator_escalation.md)).
Main told the operator on the dashboard (msg 7) and gave them the exact fix:
`gh pr merge 13665 --repo shader-slang/slang --merge-queue`. Main posts no bot comment on the PR, because it is human-authored.
Follow-up B is still unclaimed. Timer: triager one-shot `t-aa90fe` on 2026-10-30.


**2026-10-30 15:32Z, [Triage Resolution] FINAL (msg 18) — Main-verified. TERMINAL.** #13665 MERGED
2026-10-26 19:29:17Z by jkwak-work (merge commit `bba63c2376`). This came after the operator's
re-queue; the 10-26 escalation is resolved. #13664 closed as `completed` at 19:29:18Z. The only
comment on the issue is the bot's triage comment 6198150215. The triager removed its sentinel and
posted nothing more, because the merged PR carries the trail.
**Open operator calls (unfiled, no issue or PR):**
(1) follow-up B: `compileBuiltinModule` should return `SLANG_E_NOT_AVAILABLE` instead of silently
compiling an empty source when EMBED_SOURCE=OFF, and the cmake-options job should run
`slangd --print-builtin-module core`;
(2) `slang-language-server.cpp:3337` ignores the `slang_createGlobalSession` result.
Asked on the dashboard 10-30.

**Resumes on:** a human comment on #13664/#13665, or the operator saying to file B or (2).
