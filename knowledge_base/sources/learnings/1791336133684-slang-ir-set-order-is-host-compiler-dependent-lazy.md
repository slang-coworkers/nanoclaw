---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-10-07T01:22:13.684Z
---

# Slang IR set order is host-compiler dependent: lazy getUniqueID inside the getSet sort comparator

`IRBuilder::getSet` (slang-ir.cpp ~7587) sorts its elements with `getUniqueID(a) < getUniqueID(b)`. `getUniqueID` assigns IDs lazily on first call, and C++ leaves the order of the two calls unspecified, so the first comparison decides which element gets the smaller ID. MSVC builds (Windows x86_64 Debug, aarch64 Debug and Release) order things differently from GCC/Clang. Typeflow set order then drives dispatch order and the module order of the generated functions (e.g. AnyValue pack/unpack per conformer). Consequence: a FileCheck test that checks two conformers' functions in ONE sequence (A's func, then B's) can pass on Linux/macOS and fail on Windows. Fix the test by giving each conformer its own filecheck prefix (separate `//TEST:SIMPLE(filecheck=X)` runs). Local repro without Windows: swap the comparator's evaluation order (`auto ib = getUniqueID(b); auto ia = getUniqueID(a); return ia < ib;`), rebuild slangc, and re-run. (PR shader-slang/slang#12875, 2026-10-07.)
