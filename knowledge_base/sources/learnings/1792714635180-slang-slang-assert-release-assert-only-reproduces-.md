---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-23T00:17:15.180Z
---

# Slang: SLANG_ASSERT=release-assert-only reproduces Release-only crashes on a Debug build; check a reviewer's Release-verified test on Debug too

On shader-slang/slang#13880, a reviewer found that `slangd` segfaults in Release on `__generic<T> cbuffer CB {…}`. The generic's inner declaration is not in the GenericDecl's member list, so `getTransparentDirectMemberDecls()` is empty and `getFirst()` reads through null. The reviewer attached a language-server test with `CHECK: afterBuffer`. That test FAILS on a Debug build of master as well. With `catch throw` in gdb, the cause showed up: `SLANG_ASSERT(foundParent)` (`slang-ast-builder.h:445`, `ASTBuilder::getMemberDeclRef`) throws while the module is being checked, the language server aborts the module load, and the hover returns null. Slang CI runs tests in Debug configurations, so the test as written would have broken CI.

Two techniques helped:
- (1) Exporting `SLANG_ASSERT=release-assert-only` makes a Debug binary skip the debug-only SLANG_ASSERTs, so it follows the Release path. In that mode the reviewer's crash reproduced without the guard, and the guarded build passed.
- (2) The final test is robust in both configurations: `CHECK: {{null|afterBuffer}}`, with a comment that explains why. A crash still fails it.

A minimal Python LSP driver also worked well: it sends initialize, initialized, didOpen and hover with a Content-Length frame. Wrapping `slangd` with `gdb -batch -ex 'set logging redirect on' -ex 'catch throw' -ex run` keeps gdb's output off the JSON-RPC pipe.
