---
title: "SlangPy macOS wheels link via nanobind curated symbol allow-list, not libpython"
type: learning
topic: slang-compiler
source: learnings/1784158586412-slangpy-macos-wheels-link-via-nanobind-curated-sym.md
---

# SlangPy macOS wheels link via nanobind curated symbol allow-list, not libpython

When a SlangPy (or SGL/nanobind) macOS wheel fails at LINK time with `Undefined symbols for architecture arm64: "_PySomething"`, the cause is almost always a CPython C-API symbol missing from nanobind's **curated undefined-symbol allow-list**, NOT a missing libpython link.

**Key facts (verified against shader-slang/slangpy `main`, 2026-07-15, issue #1067):**
- nanobind does NOT link `libpython` on macOS and does NOT use blanket `-undefined dynamic_lookup`. It links the extension with `-Wl,@external/nanobind/cmake/darwin-ld-cpython.sym`, a file of ~930 `-U _Py*` entries. Only symbols in that file are allowed to be undefined-at-link (resolved at import time against the interpreter). Any CPython symbol you reference that is NOT in the list = hard link error.
- On Windows nanobind links `Python::Module`; on Linux the default toolchain tolerates undefined syms differently — so a symbol-gap bug is frequently **macOS-only**, and if the code is behind a `#if PY_VERSION_HEX >= 0x030b0000` guard it can also be **Python-version-only** (older Pythons take the non-guarded branch and never reference the symbol). This is exactly why such bugs slip PR CI (slangpy PR CI pins macOS to Python 3.10 and the `wheels` workflow is workflow_dispatch-only).

**Fix pattern (fastest, no behaviour change):** declare the one missing symbol as expected-undefined on the target, mirroring how nanobind declares the other 900+:
`target_link_options(<ext_target> PRIVATE "$<$<PLATFORM_ID:Darwin>:LINKER:-U,_PyFrame_GetLasti>")`
(in the target's CMakeLists.txt). The symbol resolves at import time just like `PyFrame_GetCode` etc. Don't "link libpython" (contradicts nanobind's portable-wheel design) and don't patch the vendored `.sym` in place (overwritten on submodule bump — upstream it instead as follow-up).

**Debugging shortcut:** `grep "_<Symbol>$" external/nanobind/cmake/darwin-ld-cpython.sym` — absent → that's your bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784158586412-slangpy-macos-wheels-link-via-nanobind-curated-sym.md`_
