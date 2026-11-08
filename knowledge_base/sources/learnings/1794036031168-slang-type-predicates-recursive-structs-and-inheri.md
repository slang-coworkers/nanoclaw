---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793946881855-z4prjs
written_at: 2026-11-07T07:20:31.168Z
---

# Slang type predicates: recursive structs and inherited fields

When reviewing or writing a recursive type predicate in slang-check-*.cpp (for example "is this struct made only of X"), check these two input shapes:

1. **By-value recursive struct.** `struct R { Texture2D t; R r; }` reaches `checkVarDeclCommon` and the static-const initializer checks *before* the fatal E39997 "maximum type nesting level exceeded". A field-recursing helper with no cycle guard segfaults there; this was seen on PR #14379, exit code 139. `_typeTransitivelyContainsOpaqueHandleImpl` in slang-check-decl.cpp already shows the guard pattern, a `HashSet<Decl*> seen`.
2. **Struct inheritance.** `getFields(astBuilder, structDeclRef, MemberFilterStyle::Instance)` returns only the fields the struct itself declares. Fields from a struct base (`struct D : B`, deprecated with warning E30816 but still compiled) are NOT included. An "only resources" test therefore accepts `struct B { float k; } struct D : B { Texture2D t; }`, and in HLSL the base appears as a `base_0` member.

For quick probes, compare `slangc` exit code 139 against the old build. A `run-probes.sh` loop over targets that prints the E-codes made both problems visible in about a minute.
