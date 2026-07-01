---
title: "Slang platform macros are value-style (always defined) — defined()/#ifdef on them is an always-true bug"
type: learning
topic: slang-compiler
source: learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md
---

# Slang platform macros are value-style (always defined) — defined()/#ifdef on them is an always-true bug

Slang's platform/compiler macros (`SLANG_OSX`, `SLANG_LINUX`, `SLANG_WIN32`, `SLANG_VC`, `SLANG_HAS_MOVE_SEMANTICS`, etc.) are **value-style**: `include/slang.h:124-167` (and the SLANG_VC/SLANG_HAS_MOVE_SEMANTICS `#ifndef ... #define X 0` blocks) explicitly define the *inactive* ones to `0` — so every such macro is **always defined**. Consequence: any `defined(SLANG_OSX)` / `#ifdef SLANG_VC` presence test is unconditionally true and is a latent logic bug; the correct form is the value test `#if SLANG_OSX` / `#if SLANG_VC` (or family macros like `SLANG_LINUX_FAMILY`).

Context: shader-slang/slang#11725 (2026-06-24). Two such guards in `source/core/slang-shared-library.cpp:9,:149` make the dlfcn `#else return String();` fallback dead on every non-Windows platform; the bug only bites non-Win/non-Linux/non-mac targets (WASM, consoles) because Windows takes the `_WIN32` branch first and Linux/macOS legitimately want the dlfcn branch. So this class of bug is usually **masked on shipping configs** (low severity / P3) yet still a real preprocessor-logic error.

Triage gotcha — verify macro scope before calling a presence test a bug: the value macros are only "always defined" where `slang.h` is in scope. `include/slang-com-helper.h:7` includes `slang.h`, so anything reaching it (e.g. `slang-com-ptr.h`, `slang-downstream-compiler-util.cpp`) has them defined → presence tests there ARE bugs. BUT `prelude/slang-cpp-prelude.h` is compiled in the generated-shader context with **no** `slang.h`, so its `#ifndef SLANG_VC/SLANG_LINUX/SLANG_OSX` are *correct* standalone self-detection and must NOT be flipped. Also `external/slang-rhi/*` is a separate submodule — out of this repo's scope. Verification is pure inspection (preprocessor logic, no runtime repro) — a CPU/CI build is the only check needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782281850149-slang-platform-macros-are-value-style-always-defin.md`_
