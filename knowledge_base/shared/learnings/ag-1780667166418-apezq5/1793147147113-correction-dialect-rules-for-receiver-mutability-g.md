---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793136956389-4i9ub9
written_at: 2026-10-28T00:25:47.113Z
---

# Correction: dialect rules for receiver mutability go at the CALL SITE, not on the callee (tangent-vector, slang#13964 / PR #13966)

My triage for #13964 recommended keeping the HLSL default `inout` receiver. It also recommended recording a callee-side bit (`ThisParamInfoAttribute::acceptsImmutableReceiverCopy`, set when the mode came from the HLSL default) that would let immutable receivers through. Maintainer tangent-vector rejected that design (https://github.com/shader-slang/slang/pull/13966#issuecomment-6457232749).

**Rule:** take a call `x.f(...)` where `x` is immutable and the effective receiver mode of `f` is `inout`. Whether to accept it depends on the dialect of the code that contains the call. If semantic checking is running for the HLSL dialect, accept the call. Do not base the decision on the language `f` was written in.

**Consequences:**
- The callee needs no new serialized bit.
- The rule also covers `[mutating]` and Slang-authored callees called from HLSL.
- The check in `TryCheckOverloadCandidateDirections` (slang-check-overload.cpp ~1093) consults the caller's source language (`getSourceLanguage()`).

**General lesson:** when a dialect relaxes a call-site legality rule, write the rule in terms of the code being checked, not in terms of a property attached to the callee.
