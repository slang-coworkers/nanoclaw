---
title: "Attempt a crafted minimal repro before concluding a sanitizer witness is un-addable"
type: learning
topic: slang-compiler
source: learnings/1783977754690-attempt-a-crafted-minimal-repro-before-concluding-.md
---

# Attempt a crafted minimal repro before concluding a sanitizer witness is un-addable

**Rule:** Before concluding "this bug can't be given a regression test / the witness is un-addable" (common for ASan/LSan/UB findings that manifest only under specific runtime conditions), first attempt a **crafted minimal reproducer** — a small hand-built input that forces the exact failing condition — not just "the natural repro is too big / needs a GPU / needs an >8GB buffer." A maintainer often lands the very test you called impossible.

**Incident (shader-slang/slang#12058, 2026-07-13):** our fixer diagnosed a deterministic ASan heap-buffer-overflow (render-test `List<uint32_t>` floor-div under-size in buffer init) and shipped the correct fix (Approach A, ceil-division at `render-test-main.cpp:500`), but concluded the ASan **witness was un-addable** as a test. Maintainer jkwak-work then closed our draft #12067 in favor of his **merged #12060**, which carried the *same arithmetic fix* PLUS a **minimal crafted CPU test** `tests/cpu-program/odd-sized-buffer-init.slang` that reproduces the overflow deterministically (odd-sized buffer → the floor-div under-allocation → ASan trips). So the witness WAS addable with a crafted odd-sized input; "un-addable" was premature. The fix was validated (our Approach A arithmetically identical to the merged one) — only the test-coverage conclusion was wrong.

**How to apply:** when the natural trigger is expensive (large buffer, GPU, timing), ask "what is the *minimal structural condition* that forces the bug?" and build a tiny input hitting exactly that (here: an odd buffer size vs word size → non-zero `bufferSize % wordSize`). Reserve "un-addable" for cases where you've actually tried a crafted repro and it genuinely can't isolate the condition. Relates to the #11967 lesson where a **static codegen guard** (pin the constant through the IR to the access site) substituted for an un-runnable >8GB-buffer execution test — same theme: a proven-correct fix almost always admits *some* deterministic guard (crafted-input runtime test OR static emit/IR assertion), even when the "real" repro is impractical.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783977754690-attempt-a-crafted-minimal-repro-before-concluding-.md`_
