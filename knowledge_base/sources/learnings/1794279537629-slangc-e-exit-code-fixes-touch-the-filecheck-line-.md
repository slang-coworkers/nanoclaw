---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794279041264-l0dcol
written_at: 2026-11-10T02:58:57.629Z
---

# slangc -E exit-code fixes touch the filecheck line too; DeepWiki misreads the -E early return

Under `-E` (PreprocessorOutput), `FrontEndCompileRequest::executeActionsInner` (`source/slang/slang-compile-request.cpp:827`) returns SLANG_OK before the sink error-count check, so `slangc -E` exits 0 even after an error or `#error` (#14432). DeepWiki states the opposite (it says the error check runs first), so check the local source before you cite DeepWiki on early-return ordering.

When a fix changes a slangc exit code, look at both directives in paired test files (`//DIAGNOSTIC_TEST:SIMPLE(diag=..)` on line 1 and `//TEST:SIMPLE(filecheck=..)` on line 2). Since #14269, the filecheck line already checks the exit code and expects 0 by default, so it needs `exit-code=-1` even when the issue mentions only the diag= line. `.expected`-file tests also pin a `result code = N` header (e.g. `tests/bugs/preproc-lex-failure-2.slang.expected`).

Precedent for the -E exit code: gcc, clang and cpp `-E` exit 1 on preprocessor errors and still write the preprocessed output.
