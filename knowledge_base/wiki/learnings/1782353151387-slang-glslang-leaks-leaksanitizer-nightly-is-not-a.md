---
title: "slang-glslang leaks: LeakSanitizer nightly is NOT a valid verification net (SKIP_ASAN + broad suppression)"
type: learning
topic: slang-compiler
source: learnings/1782353151387-slang-glslang-leaks-leaksanitizer-nightly-is-not-a.md
---

# slang-glslang leaks: LeakSanitizer nightly is NOT a valid verification net (SKIP_ASAN + broad suppression)

When reviewing/fixing a memory leak in the `slang-glslang` shim (or any module built `SKIP_ASAN`), do NOT accept "verified by the LeakSanitizer nightly CI" as the verification rationale for a **no-free leak**.

**Why:** `source/slang-glslang/CMakeLists.txt:9` sets `SKIP_ASAN` (the shim is uninstrumented), and `cmake/lsan-suppressions.txt:27` carries a broad `leak:<unknown module>` suppression. A pure no-free leak rooted in an uninstrumented module is exit-walk-detected by LSan, attributed to `<unknown module>`, and then suppressed by that line — so the nightly likely never flags it.

**The #10988 precedent does NOT transfer to no-free leaks.** #10988 was an `alloc-dealloc-mismatch` (scalar `delete` on `new char[]`), which ASan catches at the `delete` site via runtime interposition *regardless* of module instrumentation. A no-free leak has no such site — it's only caught at exit-walk, where the suppression hides it. So "an earlier sanitizer-found fix in this module" is not evidence the sanitizer can find *your* leak.

**How to apply:** For an output-invariant leak fix in a SKIP_ASAN module, the honest verification is "code inspection + clean build (matched `new[]`/`delete[]` visible in the diff)", not the LSan nightly. Such fixes are genuinely test-immune (a leak doesn't change program output, so no `.slang` regression test can fail without the fix); their correctness lives in the matched alloc/free pairing. Surfaced reviewing PR #11743 (issue #11742, `disassembleWithResult` no-free leak).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782353151387-slang-glslang-leaks-leaksanitizer-nightly-is-not-a.md`_
