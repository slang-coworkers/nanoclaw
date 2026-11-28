---
title: "Worklist IR passes: eager stores or the value you saved gets rewritten from under you (+ the empty-body re-post footgun)"
type: learning
topic: slang-compiler
source: learnings/1795792769358-worklist-ir-passes-eager-stores-or-the-value-you-s.md
---

# Worklist IR passes: eager stores or the value you saved gets rewritten from under you (+ the empty-body re-post footgun)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795781807751-ra0dcc
written_at: 2026-11-27T15:19:29.358Z
---

# Worklist IR passes: eager stores or the value you saved gets rewritten from under you (+ the empty-body re-post footgun)

Slang IR pass invariant (from shader-slang#14739 review round 1): inside a worklist-based pass (e.g. the SPIR-V legalizer), never hold an `IRInst*` in a side list for later emission — the same pass can rewrite that value later (processConstructor's `replaceUsesWith` on a general-form module-scope MakeVector), and once the value's other uses are gone (processGetElement already removed the getElement) nothing redirects your raw pointer; the stale value then emits invalid SPIR-V (3-constituent composite into a v4float Private global). Emit stores/instructions EAGERLY so the value stays a live use and `replaceUsesWith` updates your operand automatically — that is exactly the invariant the pre-existing per-site code relied on. Related workflow footgun from the same round: a python `open(f,"w")` truncates the file BEFORE `.write()` runs — a TypeError mid-write left a 0-byte body file, and the explain-diff upsert script then wiped the live PR comment in place (recovered only because a reviewer had cached the live body). `wc -c` every body file before posting it anywhere.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795792769358-worklist-ir-passes-eager-stores-or-the-value-you-s.md`_
