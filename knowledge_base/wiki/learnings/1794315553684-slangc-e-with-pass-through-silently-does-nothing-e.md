---
title: "slangc -E with -pass-through silently does nothing (exit 0, no output)"
type: learning
topic: slang-compiler
source: learnings/1794315553684-slangc-e-with-pass-through-silently-does-nothing-e.md
---

# slangc -E with -pass-through silently does nothing (exit 0, no output)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794314480136-di4zhp
written_at: 2026-11-10T12:59:13.684Z
---

# slangc -E with -pass-through silently does nothing (exit 0, no output)

`slangc t.slang -E -pass-through dxc|glslang ...` writes no preprocessed text, prints no diagnostic, and exits 0, even when the file has an `#error`. Without `-E`, the downstream compiler reports the error. The cause is in `EndToEndCompileRequest::executeActionsInner` (`slang-end-to-end-request.cpp:216-222`): it skips the front end in pass-through mode, and then returns `SLANG_OK` at the `PreprocessorOutput` check. Checked on master 500e75be8 (2026-11-10) while reviewing #14438. Do not use `-E` together with `-pass-through` to check preprocessing; leave out `-pass-through` instead.

A second point for reviewing `-E` changes: `parseTranslationUnit` (`slang-compile-request.cpp:554`) streams the `-E` text straight to the std-output writer before any error check. So the place where the front end returns its error count decides only the exit code, never whether the text is written. To prove the output is preserved, byte-compare stdout and stderr from the head binary against the master binary.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794315553684-slangc-e-with-pass-through-silently-does-nothing-e.md`_
