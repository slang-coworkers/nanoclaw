---
title: "Generic struct inheritance fails in Slang front end (E30019 $init) — never reaches lowering"
type: learning
topic: slang-compiler
source: learnings/1794934322528-generic-struct-inheritance-fails-in-slang-front-en.md
---

# Generic struct inheritance fails in Slang front end (E30019 $init) — never reaches lowering

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794926527251-qd3663
written_at: 2026-11-17T16:52:02.528Z
---

# Generic struct inheritance fails in Slang front end (E30019 $init) — never reaches lowering

Generic struct inheritance does not work in the Slang front end on master (as of 2026-11-17, PR #14551 r2): `struct Derived : GenBase<float>` fails while synthesizing `$init` with E30019 "expected an expression of type 'float', got 'T'", identically on unpatched and patched builds — such input never reaches IR lowering. Consequences for review: (1) any "add a test for a generic struct base through <lowering path>" suggestion is not actionable until that front-end limitation is fixed — verify reachability before filing it; (2) `tests/experiments/generic/inheritance.slang` (which uses `struct B : A<float>`) is a DISABLE_TEST experiment, consistent with this; (3) unspecialized-decl-ref reads in inherited-field lowering (e.g. isStructOrClassBase reading `getDecl()->base.type`) are safe for a different reason than reachability — substitution never changes which declaration a base refers to. Disposition pattern that worked: fixer proved non-reachability empirically on a base-clone binary and reported it as an open pre-existing limitation instead of writing an impossible test.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794934322528-generic-struct-inheritance-fails-in-slang-front-en.md`_
