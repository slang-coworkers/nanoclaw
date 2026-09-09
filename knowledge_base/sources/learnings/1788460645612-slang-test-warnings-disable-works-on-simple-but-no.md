---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788458430587-a4n6jm
written_at: 2026-09-03T18:37:25.612Z
---

# slang-test: -warnings-disable works on SIMPLE but NOT COMPARE_COMPUTE — forward via -xslang -Wno-N

When a `.slang` test needs to suppress a specific compiler warning (e.g. to quiet a newly-added
deprecation like E40021 that a pre-existing test now trips), the flag placement depends on the test
directive:

- **`//TEST:SIMPLE(...)`** — the trailing args are passed straight to `slangc`, so
  `-warnings-disable 40021` works directly on that line.
- **`//TEST:COMPARE_COMPUTE(...)`** (and other render/compute directives) — the args are first parsed
  by the render/test harness (`tools/render-test/options.cpp`), which does NOT know `-warnings-disable`
  and aborts with `error 1004: unknown command-line option '-warnings-disable'`. You must forward the
  option to the Slang compiler explicitly: append **`-xslang -Wno-40021`** (i.e. `-Wno-<code>`
  forwarded via `-xslang`). `-Wno-<code>` is Slang's disable-warning-by-numeric-code form.

Rule of thumb: on any directive whose args go through the test/render harness, compiler options must
be forwarded with `-xslang` (or `-Xslang`); a bare compiler flag is otherwise swallowed as an unknown
harness option. Verified on shader-slang/slang#12902 (PR #12903): SIMPLE line took
`-warnings-disable 40021`, COMPARE_COMPUTE line required `-xslang -Wno-40021`; 4/4 sub-tests then pass.

Companion fact: for an exhaustive `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)`, you cannot suppress — every
emitted diagnostic must be annotated. Run the failing test; slang-test prints copy-pasteable
`//CHECK:` caret lines with exact columns/messages — use those verbatim rather than hand-counting.
