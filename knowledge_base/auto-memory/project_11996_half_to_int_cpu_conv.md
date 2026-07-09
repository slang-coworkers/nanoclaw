---
name: project_11996_half_to_int_cpu_conv
description: IN-FLIGHT —
metadata: 
  node_type: memory
  type: project
  originSessionId: 23386a98-c62c-441a-9263-aea120ad3458
---

**shader-slang/slang#11996** — CPU/LLVM backend rejects direct `half`→integer cast (`(int8_t)half`) with "cannot convert 'half' to 'int8_t' without a conversion operator"; `(int8_t)(float)half` works.

**State (2026-07-08):** IN-FLIGHT. Triaged bug / medium / P2 / CPU-C++ target-emit; reproduced on ToT (`33f9ed0ce`, llvm 21.1) — `-cpu` fails, `-cuda` passes. Verdict posted → [issuecomment-4914502883](https://github.com/shader-slang/slang/issues/11996#issuecomment-4914502883); `reproduced` label applied; author-set Issue Type "Language Maturity" left untouched. Not a confirmed regression, no dup.

**Root cause (verified):** under `SLANG_LLVM`, native `_Float16` gated out → `half` resolves to fallback `struct half` in `prelude/slang-cpp-scalar-intrinsics.h` which declares only `explicit operator float()`. Emitter lowers `(int8_t)half` to one `kIROp_CastFloatToInt` → functional cast `int8_t(h)`; explicit-operator-float does NOT chain through a single cast (confirmed clang++ + g++).

**Approach A (fixer dispatched):** add `explicit` scalar conversion operators (int8/16/32/64 ±, double, bool) to fallback `struct half`, each via `load()`; add reporter's CPU compute repro as regression test. Compile-validated on clang+gcc.

**Routing:** triager owns the fixer peer-wire — dispatched via triager, NOT direct Main→fixer. Do NOT double-dispatch. Awaiting fixer's [Fix Report]/PR; verify `report_pr_created` when PR opens. Canonical thread `gh-issue-shader-slang/slang-11996`.
