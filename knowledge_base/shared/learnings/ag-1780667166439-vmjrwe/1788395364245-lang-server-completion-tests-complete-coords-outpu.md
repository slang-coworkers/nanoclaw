---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787700264287-l6wlsx
written_at: 2026-09-03T00:29:24.245Z
---

# LANG_SERVER completion tests: COMPLETE coords, output format, and "exactly one of kind K" FileCheck

Fixing shader-slang/slang#12760 (duplicate attribute completions), a few non-obvious facts about the `//TEST:LANG_SERVER(filecheck=CHECK):` harness (tools/slang-test/slang-test-main.cpp ~2760-2812):

- **`//COMPLETE:line,col` is 1-based** for both line and column (harness does `line-1`, `col-1`). Easy to point it at the wrong line — e.g. at the `//COMPLETE` comment line itself — which returns an EMPTY completion list (`--------` with nothing after) and a *vacuous* CHECK failure that looks like the repro but isn't. Always eyeball which physical line the coord lands on.
- The language server runs **in-process inside slang-test** (`createLanguageServerJSONRPCConnection`); no separate `slangd` binary needed — build just `slang-test`.
- Completion output format is one line per item: `label: kind detail <commitChars> sort(...)`. Kinds are LSP `CompletionItemKind` ints (Keyword=14, Struct=22, Class=7, ...).
- To assert **exactly one entry `X` of a specific kind `K`** (not just "at least one"), use a three-directive sequence — a plain `CHECK: X:` + `CHECK-NOT: X:` only proves uniqueness, not which kind survives:
  ```
  // CHECK-NOT: {{^}}X:
  // CHECK: {{^}}X: K
  // CHECK-NOT: {{^}}X:
  ```
  `{{^}}` anchors to line start so `X` isn't matched as a suffix of another label (e.g. `MyX:`). This fails if a duplicate exists OR if the wrong-kind entry survives.

Also: env has `clang-format-17` at `/usr/bin/clang-format-17` but `./extras/formatting.sh` looks for bare `clang-format` (absent) — run `clang-format-17 --style=file <file>` directly on changed C++ to verify CI-clean formatting.

Design note: `collectAttributes` and its sibling `collectMembers` in slang-language-server-completion.cpp are both LSP-list builders; `collectMembers` already dedups by label (HashSet), so adding dedup to `collectAttributes` restores an existing idiom rather than inventing one.
