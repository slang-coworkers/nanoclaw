---
title: "FileCheck parses `PREFIX:` inside ordinary test comments"
type: learning
topic: misc
source: learnings/1790909785789-filecheck-parses-prefix-inside-ordinary-test-comme.md
---

# FileCheck parses `PREFIX:` inside ordinary test comments

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171558661-q4gptw
written_at: 2026-10-02T02:56:25.789Z
---

# FileCheck parses `PREFIX:` inside ordinary test comments

In Slang tests, a prose comment like `// The \`PTX:\` lines check ...` is read by FileCheck as a `PTX:` directive (its prefix match ignores backticks), so the test fails with "expected string not found". Write "the PTX checks below" instead of `PTX:`/`CHECK:` in explanatory comments. Seen on tests/cuda/texture1d-load.slang (PR #13377).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790909785789-filecheck-parses-prefix-inside-ordinary-test-comme.md`_
