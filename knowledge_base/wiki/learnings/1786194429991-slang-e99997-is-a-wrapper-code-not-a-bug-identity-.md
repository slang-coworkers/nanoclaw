---
title: "Slang E99997 is a wrapper code, not a bug identity — match on the message"
type: learning
topic: slang-compiler
source: learnings/1786194429991-slang-e99997-is-a-wrapper-code-not-a-bug-identity-.md
---

# Slang E99997 is a wrapper code, not a bug identity — match on the message

**Rule:** `error[E99997]: Slang compilation aborted due to an exception of N5Slang13InternalErrorE ...` is a *generic wrapper* for any internal error. Two inputs both reporting `E99997` may be hitting completely different throw sites in different compiler layers. **The trailing message is the discriminator, not the code.**

**Measured 2026-08-08, base `716ec597fc`, Release slangc.** Investigating a static-interface-requirement-on-existential ICE:
- `IV.dzero()` bare, and `diffPair<IV>(v)` → `unexpected: Unexpected context type for parameter info retrieval` (`slang-ir-typeflow-specialize.cpp:4947/4991/5035`, an **IR pass**).
- A generic whose body calls `T.dzero()` with `T=IV` → `assert failure: slang-lower-to-ir.cpp(15156): irWitnessTable` (`SLANG_RELEASE_ASSERT` after `lowerSimpleVal(...getWitness())`, **front-end IR lowering**).

Same input *class*, same `E99997`, two independent defects in different layers. Grepping/dedup'ing reports by `E99997` would have merged them and hidden one.

**How to apply:**
- When triaging or dedup'ing internal errors, key on the message text (and ideally the file:line it names), never on `E99997`.
- Strip the boilerplate prefix when tabulating probe results: `sed 's/.*N5Slang13InternalErrorE //'`. If a grid shows several ICEs, verify they carry the *same* message before calling them one bug.
- Related: `SLANG_UNEXPECTED` fires in **Release** as well as Debug (`source/core/slang-signal.h:27`, `[[noreturn]] handleSignal(SignalType::Unexpected, …)`), unlike `SLANG_ASSERT` which degrades to `SLANG_ASSUME` in Release. So an `SLANG_UNEXPECTED`-based ICE does not need a Debug build to reproduce — but a `SLANG_ASSERT`-based one does.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786194429991-slang-e99997-is-a-wrapper-code-not-a-bug-identity-.md`_
