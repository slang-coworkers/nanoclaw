---
title: "Slang core-module generated header is shared across configs — a stale slangc lies silently, and mtime will not tell you"
type: learning
topic: slang-compiler
source: learnings/1786040498662-slang-core-module-generated-header-is-shared-acros.md
---

# Slang core-module generated header is shared across configs — a stale slangc lies silently, and mtime will not tell you

Two traps that bit me on the #12396/#12403 pair (both edit `source/slang/hlsl.meta.slang`), and that will bite anyone rebasing one core-module change onto another.

## 1. The generated header is SHARED ACROSS CONFIGS, not per-config

Within one multi-config build tree there is exactly ONE:

```
build/source/slang-core-module/core-module-meta/hlsl.meta.slang.h
```

Measured: `find build -name 'hlsl.meta.slang.h'` returns a **single** path — no `Debug/` or `Release/`
copy. Configured at `source/slang-core-module/CMakeLists.txt:22`. (Separate build *directories* do not
share it.)

⇒ **Two concurrent builds off the same edited source contaminate each other's embedded core module.**
I launched a Release restore (to undo a patch) and a Debug guilty-control build (to apply a different
patch) minutes apart, and the second was about to regenerate the shared header from the patched
source, silently poisoning the first. I caught it only by comparing the header's mtime against my
patch time. **Serialize any two builds that touch a `*.meta.slang`.**

## 2. ⭐ THE LOAD-BEARING PART: mtime will lie to you about a stale binary

`slangc`'s mtime tells you when the *binary* was linked. It tells you **nothing** about which
core-module source is embedded in it. My Release `slangc` had a mtime one minute old and was still
emitting the *patched* core module from a previous session.

`slangc -v` is worse than useless here — it's a **configure-time** string baked by
`cmake/GitVersion.cmake`, so it can report a commit tens of commits behind HEAD while the binary is
freshly built.

**Check it BEHAVIOURALLY instead** — compile something whose output differs between the two states
and read the output:

```bash
# my case: is the dot() fallback loop still there (pristine) or unrolled (patched)?
slangc probe.slang -target cuda -entry computeMain -stage compute -o probe.cu
grep -c 'for(;;)' probe.cu    # 1 => pristine, 0 => still carrying the patch
```

The emitted `#line` directives are a second, independent tell: a one-line insertion upstream shifts
every `#line` below it, so `#line 10161` vs `#line 10160` in the emitted code distinguished the two
binaries for me before I had any other evidence.

Also useful for scoping a *partially* stale binary: ask which files the staleness actually touches,
rather than discarding the binary wholesale —

```bash
git log --oneline --since='<binary build time>' -- source/slang/hlsl.meta.slang source/slang/core.meta.slang
# empty => binary still valid FOR CLAIMS ABOUT THOSE FILES
# (pair it with a tree-wide `git log --since` as a non-zero control, or an empty
#  result is indistinguishable from a broken invocation)
```

## 3. Rebuild recipe after editing a `*.meta.slang`

The `cmake -E touch` is not optional — without it the cached bootstrap silently embeds the OLD source:

```bash
cmake -E touch source/slang/hlsl.meta.slang
cmake --build --preset <preset> --target generate_core_module_headers
cmake --build --preset <preset> --target slangc
```

## 4. A link failure right after this can be a stale-link race, not a real break

My Release build failed with `undefined reference to Slang::Linkage::getSearchDirectories()`. The
symbol **was** defined (`source/slang/slang-session.cpp:133`) and `nm --defined-only` found it in
`slang-session.cpp.o` — whose mtime was **newer than the link step**. Re-running the same build
succeeded with no source change. Diagnose before believing it: check whether the defining object is
newer than the link, and re-run once.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786040498662-slang-core-module-generated-header-is-shared-acros.md`_
