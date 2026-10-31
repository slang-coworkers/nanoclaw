---
title: "Sweeping SlangPy .slang sources for a new Slang front-end diagnostic (e.g. E30515 shadowing)"
type: learning
topic: slang-compiler
source: learnings/1793369454429-sweeping-slangpy-slang-sources-for-a-new-slang-fro.md
---

# Sweeping SlangPy .slang sources for a new Slang front-end diagnostic (e.g. E30515 shadowing)

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793366457865-l3w8os
written_at: 2026-10-30T14:10:54.429Z
---

# Sweeping SlangPy .slang sources for a new Slang front-end diagnostic (e.g. E30515 shadowing)

To show that SlangPy is clean against a new Slang warning from an unmerged PR (slang#14093, E30515/E30527/E30528, generic-param shadowing), I combined two checks, and you need both.

1. **Static check:** run `slangc <file> -I slangpy/slang -I <dir> -I src -I build/linux-gcc/Release/shaders -o x.slang-module` on every `git ls-files '*.slang'`, plus `slangpy/slang/slangpy.slang` itself. Emitting `.slang-module` runs the full front end without picking a target. In a 2x2 run ({pinned, PR} compiler × {orig, patched} module dir), 12 of 81 files exit non-zero on BOTH compilers. Those files need runtime defines: ppisp needs `NUM_VIGNETTING_ALPHA_TERMS=3`, falcorhashgrid needs the defines from `test_declrefs.py:450`, and blit.slang needs the defines from `blit.cpp generate_defines`, so wrap it in a file that `#define`s them and then `#include`s it. A few others are intentional-error fixtures. Rerun the define-dependent files with their real defines and audit the rest by hand; otherwise "0 hits" does not prove coverage. `tensor_indices_each.slang` is commented out of `slangpy.slang`, so check it with a copy of the module dir that has the `__include` uncommented.
2. **Runtime check:** build SlangPy with `SGL_LOCAL_SLANG` pointing at the PR build, then run `pytest slangpy/tests -s` serially; xdist workers swallow `-s` output. SGL prints "Slang compiler warnings:" through log_warn. Wipe `$HOME/.sgl` (the module cache) first. This also covers generated kernels and Slang sources inlined in Python. Always run a positive control with the pre-fix file; here it produced 4 hits, which proves the harness surfaces the warning at all.

**No-op proof for a rename:** a harness that calls every touched overload, compiled with the pinned slangc, gives byte-identical `spirv-asm`. HLSL, CUDA and Metal differ only in `#line` paths, so compare them with `grep -v '^#line'`. Keep evidence files out of any directory a later sweep runs `rm -rf out-*` on; I lost the first copy that way.

A Release build of slangpy_ext with GCC 12 fails in `examples/tinybc` on `-Werror=restrict`. Build `--target slangpy_ext` only.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793369454429-sweeping-slangpy-slang-sources-for-a-new-slang-fro.md`_
