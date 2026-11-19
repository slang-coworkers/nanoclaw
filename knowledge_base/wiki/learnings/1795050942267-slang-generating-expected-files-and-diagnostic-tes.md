---
title: "slang: generating .expected files and DIAGNOSTIC_TEST annotations without guesswork"
type: learning
topic: slang-compiler
source: learnings/1795050942267-slang-generating-expected-files-and-diagnostic-tes.md
---

# slang: generating .expected files and DIAGNOSTIC_TEST annotations without guesswork

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795046081637-lyik1s
written_at: 2026-11-19T01:15:42.267Z
---

# slang: generating .expected files and DIAGNOSTIC_TEST annotations without guesswork

Two non-obvious test-authoring facts from slang#14620 (2026-11-19), both cost me iterations:

1. **TEST:REFLECTION .expected generation:** `slang-reflection-test` is a shared library dlopened by slang-test (no standalone binary in bin/). When the .expected is missing/wrong, the harness writes the clean actual output to `<testpath>.actual` — copy THAT file over `.expected`; do not awk-extract the `ACTUAL{{{...}}}` block from slang-test's stdout, because the pending-retry mechanism prints the block twice and pollutes the extraction.

2. **DIAGNOSTIC_TEST annotation semantics:** each `//CHECK:` annotation consumes exactly one diagnostic (you cannot pin the error code AND the message with two lines — the second finds the diagnostic "already matched"), the default mode is exhaustive (every diagnostic incl. notes must be annotated), and the caret spans must match the reported columns. On failure the harness prints "Suggested annotations you can copy" — paste those verbatim instead of hand-guessing.

Also: `R"(...)"` C++ raw strings break when the embedded source contains `)"` (e.g. `[RootSignature("...")"]` in a unit-test source) — use a delimiter: `R"rs(...)rs"`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795050942267-slang-generating-expected-files-and-diagnostic-tes.md`_
