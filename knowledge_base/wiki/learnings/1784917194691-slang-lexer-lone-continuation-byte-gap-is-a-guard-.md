---
title: "Slang lexer lone-continuation-byte gap is a guard-narrowness bug, not a decoder gap"
type: learning
topic: slang-compiler
source: learnings/1784917194691-slang-lexer-lone-continuation-byte-gap-is-a-guard-.md
---

# Slang lexer lone-continuation-byte gap is a guard-narrowness bug, not a decoder gap

**Context:** shader-slang/slang#12222 (follow-up to #11858; #11886 fixed the lead-byte case). Triaged 2026-07-24 @HEAD 5281ccc66.

**Finding:** The Slang lexer silently accepts a lone UTF-8 continuation byte (0x80–0xBF with no lead byte). The instinct is "the UTF-8 decoder doesn't handle it" — that's WRONG. `getUnicodePointFromUTF8` in `source/core/slang-char-encode.h:35-39` ALREADY rejects a leading continuation byte (`else if (leading <= 0xBFU) { valid = false; }`) and consumes exactly ONE byte (no second read for continuation-first input). The bug is entirely upstream: the lexer's branch guard `if (isUtf8LeadingByte((Byte)c))` at `slang-lexer.cpp:267` (`_peek`) and `:350` (`_advance`) is too NARROW — `isUtf8LeadingByte` = `(ch & 0xC0) == 0xC0` (0xC0–0xFF only), so a continuation byte never even ENTERS the decode branch. It falls through to `isNonAsciiCodePoint` (`cp >= 0x80`, :474) → `_lexIdentifier` and gets absorbed as a non-ASCII identifier char, or silently dropped inside a comment.

**Fix layer:** the lexer guard (the producer of the branch decision), NOT the decoder (already correct) and NOT the `_lexIdentifier` consumer (patching there would mask the missing diagnostic). Recommended: broaden both guards to `isUtf8LeadingByte(c) || isUtf8ContinuationByte(c)`; the byte then enters the already-correct decoder, gets flagged invalid, and the existing E10006 emission + recovery (`c=' '`, advance 1) fires — one source of truth, ~2 lines, symmetric with #11886.

**Repro recipe (GPU-free, sidesteps local spirv-opt loader failure):** `//TEST:SIMPLE(filecheck=CHECK): -target spirv -no-codegen` with `/* <0xA8> */` (bug: no diagnostic) vs `/* <0xC0> */` (control: E10006). This is the exact recipe of `tests/bugs/gh-11858-malformed-utf8.slang`. Note in this sandbox `-target spirv` (real codegen) fails on `spirv-opt`/`glslang` dylib load — use `-no-codegen` or `-target glsl` to see lex diagnostics cleanly.

**Method lesson:** when triaging "X isn't diagnosed," check whether the low-level utility already rejects X and it's a routing/guard gap one layer up, before concluding the utility needs changing.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784917194691-slang-lexer-lone-continuation-byte-gap-is-a-guard-.md`_
