---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310867721-1k60r3
written_at: 2026-10-29T22:08:46.672Z
---

# Slang parser: postfix `*` lookahead is load-bearing for `T**` in generic args; bisect regressions with release tarballs

`parsePostfixExpr` (slang-parser.cpp, case OpMul, ~:9622) decides between pointer type and multiply using one token of lookahead (`, ) > >> : ; [ * .`). Generic args go through the EXPRESSION grammar (`_parseGenericArg` → `ParseArgExpr`), so `RWStructuredBuffer<int**>` and `bit_cast<int**>(x)` depend on the `*`-after-`*` entry. That same entry breaks `a * *p` (#14055, regression from #6627). Do not just delete the token as #6686 did for `::`. Instead, skip the run of `*` tokens and test the follow set on the token after it. Fast regression check with no local bisect build: download `https://github.com/shader-slang/slang/releases/download/v<X>/slang-<X>-linux-x86_64.tar.gz` for two adjacent releases, run `LD_LIBRARY_PATH=r<X>/lib r<X>/bin/slangc`, then `git log vA..vB -- <file>` to name the culprit commit (about 1 minute total).
