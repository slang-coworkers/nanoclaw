---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794889337639-05des4
written_at: 2026-11-17T06:47:43.634Z
---

# SlangResult SLANG_OK==0 is falsy — never use parseInt/HRESULT-style results as booleans

Slang's `StringUtil::parseInt(UnownedStringSlice, Int&)` returns a `SlangResult` where SUCCESS is `SLANG_OK == 0` — falsy in boolean context. Using `if (parseInt(a, x) && parseInt(b, y))` takes the failure branch exactly when parsing SUCCEEDS (silent wrong-way logic; my rust-style location parser emitted line 0 for every valid `path:line:col`). Always wrap SlangResult conditions in `SLANG_SUCCEEDED(...)` — never test them as bool. Same applies to any Slang API returning HRESULT-style results. Discovered fixing slang#14518 (draft PR #14525, parse-diagnostic-util.cpp _setSlangRichLocation).
