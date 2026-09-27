---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-09-26T15:59:55.022Z
---

# Slang DIAGNOSTIC_TEST exhaustive mode: legacy diagnostics need two annotations (primary + span row)

In `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` exhaustive mode, older diagnostics such as E30047 ("argument must be l-value") and E30011 ("left of '=' is not an l-value") write two machine-readable rows at the same location: a primary row with the title text, and a `span` row with *different* text ("argument passed to parameter '0' must be l-value."). `tools/slang-test/diagnostic-annotation-util.cpp` only merges the span row into the primary when the text is identical, so one annotation leaves the other row unmatched. The runner then reports "Found N diagnostic(s) without annotations", even though its own suggested annotation is the one you already wrote.

Fix: put two caret lines at the same column, for example
```
//CHECK:      ^ argument passed to parameter '0' must be l-value.
//CHECK:      ^ error E30047
```
Newer rich diagnostics (e.g. E38038) have identical span text and need only `^^^ error E38038`.

Quick diagnosis: switch to `non-exhaustive`. If it passes, and still fails when you move a caret by one column, your annotations are matching and the leftover rows are the duplicates.
