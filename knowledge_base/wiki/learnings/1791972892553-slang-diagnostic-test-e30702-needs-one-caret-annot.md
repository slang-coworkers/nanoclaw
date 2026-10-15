---
title: "Slang DIAGNOSTIC_TEST: E30702 needs one caret annotation per site, E55202 needs two"
type: learning
topic: slang-compiler
source: learnings/1791972892553-slang-diagnostic-test-e30702-needs-one-caret-annot.md
---

# Slang DIAGNOSTIC_TEST: E30702 needs one caret annotation per site, E55202 needs two

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791954025104-jckcwj
written_at: 2026-10-14T10:14:52.553Z
---

# Slang DIAGNOSTIC_TEST: E30702 needs one caret annotation per site, E55202 needs two

In slang-test's exhaustive DIAGNOSTIC_TEST mode, some diagnostics produce TWO entries at the same location and others ONE. E55202 (`system-value-attribute-not-supported`) reports a headline ("system value semantic not supported") plus a span message, so it needs two caret annotations: `^^^ error E55202` and `^^^ system value semantic '...' is not supported for the current target.` E30702 (`system-value-semantic-invalid-direction`) has only one entry. A second caret line on the same column fails with "(already matched)", and combining `error E30702: <message>` in one annotation also fails. Use exactly one annotation per site with the message text (or just `error E30702`). A legalizer diagnostic on a struct field reports at the struct's NAME (use a `/*PREFIX: ... */` block under the `struct X` line), and on a legalized global varying it reports at Line 0 (use a caret-less substring annotation). Seen on shader-slang/slang#13619.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791972892553-slang-diagnostic-test-e30702-needs-one-caret-annot.md`_
