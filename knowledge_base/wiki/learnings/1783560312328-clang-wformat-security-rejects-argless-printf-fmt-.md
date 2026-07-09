---
title: "clang -Wformat-security rejects argless printf(fmt) — Linux gcc verify won't catch it"
type: learning
topic: slang-compiler
source: learnings/1783560312328-clang-wformat-security-rejects-argless-printf-fmt-.md
---

# clang -Wformat-security rejects argless printf(fmt) — Linux gcc verify won't catch it

**Rule:** A `printf`-family call with a **non-literal** format string and **zero** variadic args (e.g. `reportError("literal\n")` where `reportError(fmt,args...)` forwards to `printf(fmt,args...)`) is a hard **error** under clang `-Werror -Wformat-security`. **gcc/Linux does NOT enforce this**, so a Linux-only local build is green while the macOS/clang CI build fails. Slang examples build with `-Werror` on all platforms.

**Why:** `-Wformat-security` fires whenever the format arg is not a string literal AND there are no format arguments — the classic `printf(userStr)` footgun. Even a compile-time-constant literal *passed through a variadic wrapper* counts as non-literal at the `printf(fmt)` call site, because the wrapper's `fmt` parameter is a runtime `const char*`.

**How to apply:**
- When adding/auditing a `printf`-wrapper call (Slang examples: `reportError`, `log`) that passes only a fixed string, route it through `"%s"`: `reportError("%s", "error: ...\n")`. This makes the arg pack non-empty and satisfies the check. Matches the existing `diagnoseIfNeeded` idiom in examples/gpu-printing/main.cpp (`reportError("%s", blob->getBufferPointer())`).
- **Verify limitation:** my local build is Linux/gcc-only (no macOS runner in-container), so it is STRUCTURALLY BLIND to clang-only `-Werror` flags (`-Wformat-security`, `-Wreturn-local-addr`, etc.). Before shipping an example/tool change, grep the diff for argless wrapper-`printf` calls even when the Linux build is green; the macOS `build-macos-*-clang-aarch64` CI job is the real gate.
- Observed 2026-07-09 on shader-slang/slang PR #12009 (gpu-printing instrumentation): 3 argless `reportError(...)` calls passed Linux CI + a maintainer approval, then failed `build-macos-{release,debug}-clang-aarch64` with `example-base.h:104: error: format string is not a string literal (potentially insecure) [-Werror,-Wformat-security]`. One-line-each fix, one CI round-trip lost.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783560312328-clang-wformat-security-rejects-argless-printf-fmt-.md`_
