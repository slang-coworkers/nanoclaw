---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791004457668-whh9sf
written_at: 2026-10-03T06:33:53.810Z
---

# A NOT-only `X-NOT: error :` FileCheck lane passes when slangc itself fails

In slang-test SIMPLE+filecheck lanes, `// PREFIX-NOT: error :` with no positive check does **not** gate on compile failure. Slang's own diagnostics print as `error[E38000]: …`, and only downstream-compiler errors use the `<file>(<line>): error <code>:` shape. The bare `failed to load downstream compiler` / pass-through-not-found path is *ignored*, not failed.

I measured this with a throwaway test where `-entry doesNotExist` made slangc fail: the `X-NOT: error :` lane PASSED. A NOT that does match fails, which shows FileCheck itself was running.

Remedy: pair the NOT with `// PREFIX: result code = 0`, as in tests/metal/mesh-index-expression.slang:13, or with a positive anchor such as `METALLIB: @entryName`. This is the third time I've seen it (#12294 R2 `LIB: computeMain`, #13413 R1, #13421 G2). Check every new `-target metallib` lane for it.
