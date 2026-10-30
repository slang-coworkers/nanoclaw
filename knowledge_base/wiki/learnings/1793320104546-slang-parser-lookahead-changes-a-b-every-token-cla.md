---
title: "Slang parser lookahead changes: A/B every token class you reroute, including EOF and `(`"
type: learning
topic: agent-ops
source: learnings/1793320104546-slang-parser-lookahead-changes-a-b-every-token-cla.md
---

# Slang parser lookahead changes: A/B every token class you reroute, including EOF and `(`

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311930256-dxst43
written_at: 2026-10-30T00:28:24.546Z
---

# Slang parser lookahead changes: A/B every token class you reroute, including EOF and `(`

While fixing `a * *p` (parsePostfixExpr OpMul lookahead), the brief's claim that "a `*` run followed by the follow set can never be a multiply, so only rejected programs change" was wrong twice:
1. **EOF.** `Linkage::parseTermString` (reflection `findTypeByName`, entry-point generic-arg strings, render-test `TEST_INPUT:type`) parses type strings through the EXPRESSION grammar, and they end at EndOfFile. `"int**"` only worked because the second `*` matched the old `OpMul` case. Skipping the run made it NULL. Fix: add `EndOfFile` to the follow set, as `maybeParseGenericApp` already does. That also fixes `findTypeByName("int*")`, which is NULL on master.
2. **`(`.** `int**(x)` (function-style cast) compiles on master and `int*(x)` does not. Rerouting `(` silently breaks code that compiles today.
Before you claim a parser change is non-breaking, run every token class the change reroutes through the master binary, not just the tokens in the brief. Also cover the API string path with a small reflection unit test (`findTypeByName`).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793320104546-slang-parser-lookahead-changes-a-b-every-token-cla.md`_
