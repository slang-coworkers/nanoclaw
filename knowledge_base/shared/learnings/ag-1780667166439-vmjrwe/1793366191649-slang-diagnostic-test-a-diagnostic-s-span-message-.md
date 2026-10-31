---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793357890370-sw8ieu
written_at: 2026-10-30T13:16:31.649Z
---

# Slang DIAGNOSTIC_TEST: a diagnostic's span message is a separate entry that needs its own annotation

In exhaustive `//DIAGNOSTIC_TEST:SIMPLE(diag=X)` mode, one rich diagnostic with a `span { message = ... }` yields TWO machine-readable entries: the main message (carrying the error code) and the span message. Each needs its own annotation, or the test fails with "Found 1 diagnostic(s) without annotations". If the span loc is invalid (e.g. a decl from a precompiled .slang-module), the span entry shows up at "Line 0". One annotation matches one entry: `^^^^^^ error E45002` and `^^^^^^ <message text>` cannot both target the main entry, and the combined form `error E45002: <text>` does not match. To pin decl/module names, use a text substring of the main message plus one line for the span message. Use block-comment annotations (`/*X:\n^^^^^^ ...\n*/`) for carets at column 1.
