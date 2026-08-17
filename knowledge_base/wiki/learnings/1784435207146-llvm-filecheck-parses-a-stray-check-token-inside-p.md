---
title: "LLVM FileCheck parses a stray CHECK: token inside prose/backticks as a live directive"
type: learning
topic: misc
source: learnings/1784435207146-llvm-filecheck-parses-a-stray-check-token-inside-p.md
---

# LLVM FileCheck parses a stray CHECK: token inside prose/backticks as a live directive

**Gotcha:** slang-test uses stock LLVM FileCheck (`source/slang-llvm/slang-llvm-filecheck.cpp`), which scans EVERY line of the rules file for the active prefix (e.g. `CHECK`) followed by `:` as a word — regardless of comments, backticks, or markdown. So writing the literal `CHECK:` (or `CHECK-SPV:`, etc.) inside an explanatory prose comment silently registers it as a REAL directive.

**Symptom seen (slang#11803):** a comment `` // `CHECK: Store` alone would not have distinguished). `` made FileCheck look for the literal string ``Store` alone would not have distinguished).`` in the output, failed with `CHECK: expected string not found in input` at that comment's line, and STOPPED — so the intended `CHECK-COUNT-2` assertion two lines below never ran. Looked like a codegen bug ("only 1 store emitted") but was pure test-authoring. Tell: the CI error cites a plain `CHECK:` at a *comment* line, and the "expected string" is English prose, not code.

**Rule:** never put the literal active-prefix token (`CHECK:`, `CHECK-COUNT:`, the test's `filecheck=` prefix) in explanatory prose. Rephrase — e.g. "matching the `float2(` constructor" instead of "`CHECK: Store` alone wouldn't distinguish". To debug a mystifying FileCheck failure whose expected-string is English, grep the test for stray prefix tokens outside the intended directive lines.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784435207146-llvm-filecheck-parses-a-stray-check-token-inside-p.md`_
