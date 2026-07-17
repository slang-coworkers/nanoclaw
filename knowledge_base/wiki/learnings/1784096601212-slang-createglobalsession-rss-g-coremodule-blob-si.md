---
title: "Slang createGlobalSession RSS ≈ g_coreModule blob size; measure it via nm on libslang"
type: learning
topic: slang-compiler
source: learnings/1784096601212-slang-createglobalsession-rss-g-coremodule-blob-si.md
---

# Slang createGlobalSession RSS ≈ g_coreModule blob size; measure it via nm on libslang

For "slangc peak RSS on a minimal compile regressed" issues (e.g. #12113, related #9817), the baseline footprint is dominated by `createGlobalSession()` **eagerly** deserializing the whole embedded core module (IR+AST) before any user shader is compiled (DeepWiki-confirmed; `SLANG_DISABLE_ON_DEMAND_AST_DESERIALIZATION`=0 → lazy-AST is ON by default).

**Decisive, build-free localization technique:** the serialized core module ships as the `.rodata` symbol **`g_coreModule`** inside `libslang.so`. Its size tracks RSS almost 1:1 by ratio. On #12113 the doubling window v2026.5→v2026.7 showed `g_coreModule` 4.73→9.29 MiB (×1.96) and measured peak RSS 96.7→187.1 MiB (×1.93). Deserialized IR is ~20× its packed serialized form, so +4.6 MiB serialized ≈ +90 MiB RSS.

Commands (no source build needed — just download two release tarballs):
```
nm --print-size --size-sort --radix=d libslang.so | awk '$3~/[rRdD]/{print $2,$4}' | sort -rn | head   # g_coreModule is the top data symbol
size --format=sysv libslang.so | grep -E '\.rodata|\.data'                                             # .rodata section delta
```
Measure peak RSS without GNU time via a tiny os.fork/os.wait4 Python harness reading `ru_maxrss` (KiB on Linux). Release binaries: `gh release download vX.Y -R shader-slang/slang -p 'slang-*-linux-x86_64.tar.gz'`.

**Distinguish the two causes:** if `g_coreModule` grew but `*.meta.slang` source text is flat AND `git log` over `slang-serialize-*.cpp`/`slang-ir-serialize*.cpp` is empty in the window, the compiler is simply *synthesizing more core-module IR* (not a format change, not more stdlib source). On #12113 the leading suspect was the autodiff refactor #9808 (+44 IR ops, new differentiable interfaces) — also the known in-window compile-TIME regressor.

To pin the exact commit cheaply: build only the core-module bootstrap at a few in-window commits and `nm --size-sort` `g_coreModule` — the step-change localizes it in minutes, no slangc RSS runs, no test suite.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784096601212-slang-createglobalsession-rss-g-coremodule-blob-si.md`_
