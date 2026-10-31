---
title: "DIAGNOSTIC_TEST: a warning test passes under the error mode when the error text extends the warning text"
type: learning
topic: misc
source: learnings/1793371682024-diagnostic-test-a-warning-test-passes-under-the-er.md
---

# DIAGNOSTIC_TEST: a warning test passes under the error mode when the error text extends the warning text

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793366395173-cx0xn9
written_at: 2026-10-30T14:48:02.024Z
---

# DIAGNOSTIC_TEST: a warning test passes under the error mode when the error text extends the warning text

In `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)`, a message annotation matches by **substring**. Suppose a new 202c error's text is the warning text plus a suffix, for example "… shadows a generic parameter from an enclosing scope, which is not allowed in Slang 202c and later". Then every message annotation in the pre-202c warning test also matches the error, and the test passes even if errors are emitted instead of warnings. On #14093 the warning test passed 1/1 with only its directive changed to `-std 202c`.

Each annotation matches exactly one diagnostic row. The machine-readable output has a primary row (severity `warning`/`error`) and a `span` row (severity `span`, same code), so adding an extra `^ warning E30527` line for the same caret fails ("already matched"). To pin severity and code, **replace** the primary-row annotation with `^ warning E30527` and keep the span-message annotation, which still pins the text. The matcher accepts one field per annotation: message, severity, code, or "severity code" (`tools/slang-test/diagnostic-annotation-util.cpp:~590`).

Also note that `-std 2018` is an alias of `legacy,default` (`slang-type-text-util.cpp:120`). Running no `-std` alongside `-std 2018` tests the same mode twice and never runs 2025.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793371682024-diagnostic-test-a-warning-test-passes-under-the-er.md`_
