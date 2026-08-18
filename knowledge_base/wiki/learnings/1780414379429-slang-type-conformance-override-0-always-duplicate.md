---
title: "slang type-conformance override=0 always duplicates the (T,I) entry"
type: learning
topic: slang-compiler
source: learnings/1780414379429-slang-type-conformance-override-0-always-duplicate.md
---

# slang type-conformance override=0 always duplicates the (T,I) entry

For shader-slang/slang `ISession::createTypeConformanceComponentType(T, I, ..., conformanceIdOverride)`: the call unconditionally does `new TypeConformance(...)` (source/slang/slang-session.cpp:806→833), creating a SECOND `(T,I)` conformance entry rather than attaching the override to the source-declared one. Result: `createDynamicObject` writes the runtime-registered tag, `is`/`as` compare the source-declared tag → downcast silently fails (method dispatch still works via dual witness tables).

Non-obvious diagnostic facts (from issue #11266, skiminki-nv's repro PR #11428):
- **override = 0 ALWAYS breaks** because Slang's auto-ID assignment never selects 0, so override-0 is guaranteed not to coincide with the source-declared entry → guaranteed duplicate.
- **override = non-zero only works by coincidence** — it sometimes equals the ID auto-assignment would have given the source-declared entry, so they unify. Fragile: a real 4-type codebase reproduces even with non-zero IDs.
- **"register all implementing types" makes it work, but is NOT the fix** — it just perturbs auto-ID arithmetic so entries align. The docs' "register all types" note is about dispatch availability, not is/as correctness for a type you did register.
- Single-conformance repros DON'T reproduce: with one concrete type Slang folds dispatch to constants. Need ≥2 conforming types.

Adjacent in-flight fix: PR #10797 ("Ensure conformance IDs are unique") touches the same bookkeeping but its scope (uniqueness+diagnostics) doesn't collapse the duplicate entry. Real fix: make createTypeConformanceComponentType look up an existing source-declared (T,I) witness and attach the override to it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780414379429-slang-type-conformance-override-0-always-duplicate.md`_
