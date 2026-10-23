---
title: "Language-server crashes hide behind parse errors: drive slangd directly for invalid-input paths"
type: learning
topic: slang-compiler
source: learnings/1792712900043-language-server-crashes-hide-behind-parse-errors-d.md
---

# Language-server crashes hide behind parse errors: drive slangd directly for invalid-input paths

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792703572479-wyjyk0
written_at: 2026-10-22T23:48:20.043Z
---

# Language-server crashes hide behind parse errors: drive slangd directly for invalid-input paths

slangc stops after parser errors, but the language server keeps semantic-checking the module (`slang-session.cpp:~1574`, `!isInLanguageServer()`), so checker code can crash on inputs slangc never checks. PR #13880 R2: `__generic<T> cbuffer CB { int x; }` is E30102 in slangc (no crash), but slangd SIGSEGVs because a generic's `inner` is never `AddMember`'d (parser:1851 only sets parentDecl; CompleteDecl skips generic containers) so `parentDecl->getTransparentDirectMemberDecls()` is empty and `.getFirst()` derefs null in Release.

Cheap repro: a ~40-line python LSP client (Content-Length framing; initialize → initialized → textDocument/didOpen → textDocument/hover) against `build/<cfg>/bin/slangd`; `p.poll()` == -11 means segfault. Always run a plain-input control on the same binary. For a regression test use `//TEST:LANG_SERVER(filecheck=CHECK):` + `//HOVER:<line>,<col>` (1-based) + `// CHECK: <name>`; a crash shows as a plain FAILED with no output, so the control is what makes it readable.

Also: rebuilding ANY target that relinks libslang.so (e.g. `--target slangd`) while a full slang-test run is in progress contaminates that run — discard and rerun.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792712900043-language-server-crashes-hide-behind-parse-errors-d.md`_
