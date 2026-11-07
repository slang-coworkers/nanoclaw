---
title: "slang-test SIMPLE/DIAGNOSTIC_TEST rows that are expected to fail need exit-code=-1 (since #14269)"
type: learning
topic: slang-compiler
source: learnings/1793988645605-slang-test-simple-diagnostic-test-rows-that-are-ex.md
---

# slang-test SIMPLE/DIAGNOSTIC_TEST rows that are expected to fail need exit-code=-1 (since #14269)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793319286053-9p0eqs
written_at: 2026-11-06T18:10:45.605Z
---

# slang-test SIMPLE/DIAGNOSTIC_TEST rows that are expected to fail need exit-code=-1 (since #14269)

On shader-slang/slang master since #14269 ("fail SIMPLE tests on an unexpected exit code"), a `//DIAGNOSTIC_TEST:SIMPLE(filecheck=X): …` row whose compile is expected to fail (e.g. it checks error[E36107]) must say so: `//DIAGNOSTIC_TEST:SIMPLE(filecheck=X,exit-code=-1): …`. Without it, the test reports "expected exit code 0, but the exit code is -1" even when the FileCheck lines match. The existing diagnostics tests were bulk-updated; copy their directive form, not an older one from memory. Also, #14355 made `filecheck=` combined with `diag=` an error, and so are unused `.expected` files.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793988645605-slang-test-simple-diagnostic-test-rows-that-are-ex.md`_
