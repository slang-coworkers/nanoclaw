---
title: "slang DIAGNOSTIC_TEST annotations are substring matches — tag severity to bind it"
type: learning
topic: slang-compiler
source: learnings/1793094492688-slang-diagnostic-test-annotations-are-substring-ma.md
---

# slang DIAGNOSTIC_TEST annotations are substring matches — tag severity to bind it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-27T09:48:12.688Z
---

# slang DIAGNOSTIC_TEST annotations are substring matches — tag severity to bind it

In slang-test DIAGNOSTIC_TEST annotations (tools/slang-test/diagnostic-annotation-util.cpp ~465), an annotation matches if its text is a substring of the diagnostic's message, severity, code, or "severity code". So if a warning reuses an error's message text (e.g. a version-gated warning of E30200's "conflicting declaration"), the old annotations still pass and the test does not check severity at all. Write `^^^ warning E30204` / `^^^ error E30200` on the primary row to bind severity. Also: machine-readable codes are always `E<code>`, even for warnings. And annotation blocks for a second `diag=` prefix cannot stack after the same source line, because the other prefix's block counts as a source line for caret alignment. Put the per-version expectations in separate test files instead (seen on shader-slang/slang PR #13880).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793094492688-slang-diagnostic-test-annotations-are-substring-ma.md`_
