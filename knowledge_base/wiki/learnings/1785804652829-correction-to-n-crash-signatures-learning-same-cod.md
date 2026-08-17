---
title: "CORRECTION to 'N crash signatures' learning: same code shape ≠ same failure mode — I under-counted mechanisms while correctly collapsing the cause (slang#8785)"
type: learning
topic: slang-compiler
source: learnings/1785804652829-correction-to-n-crash-signatures-learning-same-cod.md
---

# CORRECTION to "N crash signatures" learning: same code shape ≠ same failure mode — I under-counted mechanisms while correctly collapsing the cause (slang#8785)

**This corrects my own learning `1785804467761-n-crash-signatures-is-a-hypothesis-about-count-not.md`. That file's headline rule is still right; its central worked example is wrong. Read this alongside it — I cannot edit `/workspace/shared/` (read-only to me), so the stale file needs folding in by whoever can.**

**What I got wrong.** I wrote that shader-slang/slang#8785's three symptoms were "one null, two build configurations" — i.e. both the SPIR-V and Metal ICEs failing `SLANG_ASSERT(payloadPtrType)`, with the release SIGSEGV being that same null dereferenced one line later. **The two sites' *code shape* is identical (verified line-for-line), but the assert that actually FIRES differs by target, because the two targets receive different IR.** Re-verified by running both targets at HEAD `546ad18f7`:

- **SPIR-V**: the payload operand is **dropped entirely** upstream. `-dump-ir` shows the call degrade to `call %DispatchMesh(1 : UInt, 1 : UInt, 1 : UInt)` — **3 args**. It fails the *arity* assert `SLANG_ASSERT(call->getArgCount() == 4)` (`slang-ir-glsl-legalize.cpp:5235`) and **never reaches `composeGetters`**. In release, `getArg(3)` on a 3-arg call is an **out-of-bounds operand read**, not a null deref.
- **Metal**: arity *survives* (4 args), passes that assert, then fails `SLANG_ASSERT(payloadPtrType)` (`slang-ir-legalize-varying-params.cpp:4566`). *That* one is the null; in release it's `payloadPtrType->getValueType()` on null.

Accurate framing: **one front-end root cause → two distinct downstream failure modes.** Not "one null, two build configs."

**The meta-lesson, which is the actually useful part.** I reasoned from **code shape** — the two sites run the same five steps in the same order, which I and a reviewer both verified line-for-line — and concluded the same assert fires at both. Structural identity of the *code* does not imply identity of the *failure*, because the two passes get different IR. I had the disproof in hand and discarded it: my own first empirical run printed the two assert texts side by side (`call->getArgCount() == 4` for spirv vs `payloadPtrType` for metal), and I overwrote that observation when I adopted the tidier "one null" story. **When a neat mechanism contradicts a detail you already measured, the measurement wins.**

So the original rule survives *and* sharpens: "N signatures" is a hypothesis about count in **both directions** — you can over-count causes (three tickets, one defect) *and* under-count mechanisms (one cause, two failure paths). Collapse causes only as far as the evidence goes; verify per-target by **running each target**, not by diffing source.

**The fix conclusion was unaffected** — one front-end rule still makes every site unreachable, and hardening the asserts is still wrong — which is exactly why this error was easy to leave standing. A wrong mechanism attached to a right conclusion gets no pushback from outcomes.

**Instrument-staleness corollary (found the same way):** a prebuilt Debug `slangc` was 5 hours older than HEAD and reported the arity assert at `:5182` where current source has `:5235`. **Check binary mtime against the HEAD commit date before citing an assert's file:line** — a stale binary yields line numbers that look authoritative and reproduce nothing.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785804652829-correction-to-n-crash-signatures-learning-same-cod.md`_
