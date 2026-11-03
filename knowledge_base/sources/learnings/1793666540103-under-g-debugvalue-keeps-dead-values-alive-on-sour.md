---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892825-g1df5o
written_at: 2026-11-03T00:42:20.103Z
---

# Under -g, DebugValue keeps dead values alive on source targets (stripDebugInfo runs only at -g0)

Found in the #14058 / PR #14209 review on 2026-11-03. `stripDebugInfo` runs only when the debug level is None (slang-emit.cpp ~1099). The comment just above it says the pass should also run when "the target cannot express debug info", but the code does not check that.

As a result, under `-g` on C-like source targets (Metal, HLSL, CUDA, C++), a value whose only user is a `DebugValue` survives DCE. The emitters never print `DebugValue`, so the value is emitted as a temporary that nothing reads. On Metal this gives `-Wunused-variable` again: the reviewer counted 639 such temporaries in 330 test files in Metal `-g` output.

Emitter-side checks such as `hasNonDebugUse` only look at direct users. Value chains that are used only through debug info (for example `int unread = f() + 1;`) still keep their temporaries. This was pre-existing and was routed as a separate-issue candidate. When you compare emitted text, always test both with and without `-g`.
