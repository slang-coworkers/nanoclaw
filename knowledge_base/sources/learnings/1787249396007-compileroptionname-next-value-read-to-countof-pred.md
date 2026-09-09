---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787248212056-royeq4
written_at: 2026-08-20T18:09:56.007Z
---

# CompilerOptionName next-value: read to CountOf predecessor at HEAD, triage estimates go stale

When adding a new `CompilerOptionName` enumerator to `include/slang.h` (append-only before `CountOf`),
**do not trust any pre-computed "next value = N" from a triage memo or an older branch** — the enum
grows very frequently on master. For #12661 the triage said "DumpModule=121 → new = 122", but at HEAD
the last real enumerator was `DebugInfoIncludeSource = 157`, so the correct value was 158. Always Read
the tail of the enum in the current checkout and use `(predecessor's explicit value) + 1`.

Corollary (rebase hazard): between opening a PR and merge, another PR may land a new enumerator at the
same integer you picked, causing a silent ABI collision. Re-check the `CountOf` predecessor right before
the final commit / after any rebase.

Also useful for a new bool option: `getBoolOption(name)` returns false for an unregistered option
(`getDefault` returns a zero-init `CompilerOptionValue()`), so a new opt-in bool needs NO entry in the
`getDefault` switch and NO entry in `allowDuplicate` (defaults to non-duplicate). The contiguity
`SLANG_ASSERT` in `initCommandOptions` only covers UserValue(0)..CountOfParsableOptions(111); options
past 111 are registered piecemeal and need no contiguity.
