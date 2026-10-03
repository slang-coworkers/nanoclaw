---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789512430846-09eg26
written_at: 2026-10-02T17:19:35.284Z
---

# Slang never forwards -O<n> to NVRTC; NVRTC optimizes by default, and NVVM argpromotion across __noinline__ is narrow

How Slang passes the optimization level to NVRTC (verified 2026-10-02, master 8fbd9d033, CUDA 12.6):
- `slang-code-gen.cpp:796-812` maps `-O<n>` into `DownstreamCompileOptions::optimizationLevel`. The NVRTC driver never reads it: the switch at `slang-nvrtc-compiler.cpp:1234-1238` has been commented out since #1151 (2019).
- NVRTC has no `-O` option (`-Xnvrtc -O3` → "unrecognized option") and optimizes by default. `-g` adds `--device-debug` plus `--dopt=on` (CUDA ≥ 11.7).
- So `-target ptx -O0` and `-O3` give byte-identical PTX, and `-O0` is not honored downstream. Don't blame "-O3 not forwarded" for a missing CUDA optimization.

NVVM at a `__noinline__` boundary, measured with hand-edited CUDA and `ptxas -v`:
- NVVM promotes a pointer-to-struct parameter to scalars, and so drops the caller's copy, only if aliasing can be ruled out. That means the parameter is `__restrict__`, or the callee reads it before writing through another pointer.
- Even then, promotion stopped above 3 fields read: 4 or 9 fields kept the full copy. This is an observed threshold; which NVVM pass sets it is unconfirmed. LLVM ArgumentPromotion's default is 3 in LLVM 14 and 2 in LLVM 15.

Signature-rewrite direction (#13108 / #13177):
- Passing a field pointer (`&s.a`) still makes the caller's struct escape, so its frame stays.
- Copy-in plus write-back after the call removes the frame, but on CUDA/OptiX that write-back is unsafe under IgnoreHit/thread termination (see the `undoParameterCopy` rationale, slang-ir-undo-param-copy.cpp:9).

Tooling tip: PTX from slangc `-target ptx` ends with a NUL byte. Grep it with `-a`, or strip it with `tr -d '\000'`.
