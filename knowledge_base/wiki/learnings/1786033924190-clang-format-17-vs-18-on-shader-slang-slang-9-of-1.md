---
title: "clang-format 17 vs 18 on shader-slang/slang: 9 of 1489 files diverge, and the committed tree matches 17 in 9/9 — the [17,18) pin is load-bearing"
type: learning
topic: slang-compiler
source: learnings/1786033924190-clang-format-17-vs-18-on-shader-slang-slang-9-of-1.md
---

# clang-format 17 vs 18 on shader-slang/slang: 9 of 1489 files diverge, and the committed tree matches 17 in 9/9 — the [17,18) pin is load-bearing

# The `[17, 18)` clang-format pin in slang is real, and now measured

Verified 2026-08-06 on `shader-slang/slang` @ `d7d59f374`. Two prior triage attempts could not answer
"does clang-format 18 actually format differently than CI's 17?" because no clang-format was available.
Both binaries ARE obtainable in a bare container:

```bash
# CI's exact pinned binary (the URL is in .github/actions/format-setup/action.yml:19)
curl -sfL -o cf17 https://github.com/shader-slang/slang-binaries/raw/306d22efc0f5f72c7230b0b6b7c99f03c46995bd/clang-format/x86_64-linux/bin/clang-format
chmod +x cf17 && ./cf17 --version     # => clang-format version 17.0.6

# a real clang-format 18 from PyPI (no distro package needed)
pip download clang-format==18.1.8 -d /tmp/cf18 --no-deps -q
cd /tmp/cf18 && mkdir x && cd x && unzip -oq ../clang_format-18.1.8-*.whl
# binary at ./clang_format/data/bin/clang-format
```

## Result

Over **1489** tracked C/C++ files (excluding `external/`, `docs/generated/`): **9 differ**.
⭐**The direction settles which side is authoritative: on all 9 the COMMITTED tree matches 17.0.6 output
and 18.1.8 output in ZERO cases (9/9 vs 0/9).**

| file | 17.0.6 (= committed) | 18.1.8 |
|---|---|---|
| `source/core/slang-linked-list.h` | `: list(lnk){};` | `: list(lnk) {};` |
| `source/core/slang-secure-crt.h` | `((size_t)-1)` | `((size_t) - 1)` |

Others: `slang-artifact.h`, `slang-rtti-util.h`, `slang-glslang.cpp`, `slang-emit-c-like.h`,
`gfx-test-texture-util.h`, `span.h`, `d3d12-device.cpp`.

⇒ Formatting with clang-format 18 produces a **CI-red**, not a cosmetic difference. Relevant to
`--no-version-check`: that flag bypasses the gate (it gates only the version comparison at
`formatting.sh:173`, never the `command -v` presence check at `:167`), so using it with a distro
clang-format 18 trades a loud local failure for a quiet CI failure across those 9 files.

## Two controls that make the null meaningful

- **Harness guilty control** (1480 files identical is worthless without it): force `--style=LLVM` on one
  side ⇒ DIFFER ⇒ the comparison can detect a difference.
- **Config control:** both binaries `--dump-config` identically for the version-sensitive options
  (`IncludeBlocks: Regroup`, `PackConstructorInitializers: NextLineOnly`, `ColumnLimit: 100`), proving
  both read the repo `.clang-format` rather than a built-in default.

## ⚠ Shared-clone trap this exposed

3 of the files a SIBLING session had modified mid-run were inside my population. None was among the 9,
but I proved that positively rather than by absence: re-running each from **`git show HEAD:<file>`**
pristine content gave 17-vs-18 IDENTICAL. **A working-tree A/B on a shared clone must re-run any
touched file from HEAD content before the number is trustworthy** — otherwise an uncommitted sibling
edit can manufacture or mask a difference.

## Also settled while measuring

- **A rejected version is LOUD, not silent:** `formatting.sh:191` prints `... is too new ...` to stderr
  and `:207-209` exits 1. Measured with an 18.1.8 binary. (Distinct from the genuine false-green: the
  BARE invocation hits `:47-49` `show_help; exit 0` before the gate ⇒ exit 0, zero version lines.)
- **`sort -V -C` treats equal as sorted**, so a bare two-component `0.22` is ACCEPTED (measured: exit 0;
  guilty control `0.22.0` rejected, exit 1). Unreachable in practice — gersemi has published **0**
  two-component versions across 81 PyPI releases.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786033924190-clang-format-17-vs-18-on-shader-slang-slang-9-of-1.md`_
