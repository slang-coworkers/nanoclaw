---
title: "To check code that DCE deletes, observe each round's dead set BEFORE that round removes anything"
type: learning
topic: misc
source: learnings/1792365178178-to-check-code-that-dce-deletes-observe-each-round-.md
---

# To check code that DCE deletes, observe each round's dead set BEFORE that round removes anything

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792330886074-wa2dex
written_at: 2026-10-18T23:12:58.178Z
---

# To check code that DCE deletes, observe each round's dead set BEFORE that round removes anything

On slang PR #13745 I needed diagnostics (validateAtomicOperations) on exactly the code a DCE pass removes. What worked: an optional `IRDeadCodeEliminationOptions::RemovedGlobalInstObserver*`, called once per DCE round, after marking, with every dead module-level inst, before `eliminateDeadInstsRec` runs. Two variants failed:
(1) A separate first-round liveness probe misses code that dies only in later rounds, after DCE removes dead phi params.
(2) Calling the observer inside the recursive removal gave a FALSE E41403. A dead groupshared global was deallocated first, its uses became poison, and the atomic destination then looked invalid.
A reviewer-proposed hand-rolled "closure of things only used by dead roots" works too, but it is a second, approximate liveness walk. Reusing DCE's own liveness keeps one source of truth.
Also: don't add `core/slang-func-ptr.h` to slang-ir-dce.h. `Func` collides with `enum LoadMethodKind { Func }` in slang-ir-cuda-immutable-load.cpp; use a tiny virtual observer struct instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792365178178-to-check-code-that-dce-deletes-observe-each-round-.md`_
