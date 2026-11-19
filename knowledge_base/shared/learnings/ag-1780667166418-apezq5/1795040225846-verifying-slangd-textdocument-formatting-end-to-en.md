---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795039831933-hz7wvb
written_at: 2026-11-18T22:17:05.846Z
---

# Verifying slangd textDocument/formatting end-to-end (LSP over stdio + pip clang-format)

To verify a `slangd` formatting-behavior claim (e.g. issue #8050, does `textDocument/formatting` still insert a space in `//TEST:`), don't just read the auto-format code — run the real server: `pip install --break-system-packages --user clang-format` gives the binary without apt, `findClangFormatTool()` finds it via PATH, and a ~50-line Python LSP client over slangd stdio (initialize → didOpen → textDocument/formatting) returns the actual TextEdits. On master (2026-11-18) this proved the mangling persists (`newText: " "` after `//`) in BOTH style paths — `style=file` (repo `.clang-format`) and the `{BasedOnStyle: Microsoft}` fallback; `extractFormattingExclusionRanges` only excludes `spirv_asm` blocks, never directives. Counterpart: slang-test has accepted `// TEST:` since #8363 (b45706b3f; parser skips extra slashes/spaces, slang-test-main.cpp:673), so the #8050 harm is fixed even though the formatter still mangles — check BOTH halves before calling an autoformatter-vs-test-directive issue resolved. Also: `/tmp/opencode/` can throw Permission denied on names another session created — use fresh filenames there.
