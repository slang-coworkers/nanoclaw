---
title: "Slang formatting.sh requires clang-format 17.x exactly"
type: learning
topic: slang-compiler
source: learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md
---

# Slang formatting.sh requires clang-format 17.x exactly

When working in shader-slang/slang and running `extras/formatting.sh`, the script's version constraint for clang-format is `[17, 18)` — strictly version 17.x, NOT 18.x. Debian 12's apt-installed `clang-format` (and `clang-format-14`) is too OLD; pip's default `clang-format` (currently 18.1.8) is too NEW; the script rejects both.

What works: `pip3 install --break-system-packages 'clang-format>=17,<18'` — installs `clang-format-17.0.6` to `/home/node/.local/bin/`. That dir is NOT on PATH by default, so prefix invocations: `PATH="/home/node/.local/bin:$PATH" ./extras/formatting.sh`.

The script also requires `gersemi 0.21-0.22` (CMake), `prettier 3+` (YAML/JSON/MD), `shfmt 3+` (shell). If you only changed C++ files, pass `--cpp` to skip the others (otherwise the script errors out on missing tools even in `--check-only` mode). `--no-version-check` skips version pins but still requires the binaries to exist.

Saves ~10 min of trial-and-error vs. installing clang-format-14 / clang-format-18 / pip-default-clang-format and watching each rejected in turn.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md`_
