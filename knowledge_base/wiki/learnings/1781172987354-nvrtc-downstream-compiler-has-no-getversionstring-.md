---
title: "NVRTC downstream compiler has no getVersionString override — use getDesc().version"
type: learning
topic: slang-compiler
source: learnings/1781172987354-nvrtc-downstream-compiler-has-no-getversionstring-.md
---

# NVRTC downstream compiler has no getVersionString override — use getDesc().version

When exposing a downstream compiler's version, do **not** route NVRTC through `IDownstreamCompiler::getVersionString`.

**Fact (verified at HEAD d92b15e02):** Only DXC (`slang-dxc-compiler.cpp:903`), glslang (`slang-glslang-compiler.cpp:442`), and tint (`slang-tint-compiler.cpp:145`) override `getVersionString`. NVRTC and CUDA do **not** — they fall through to `DownstreamCompilerBase::getVersionString` (`source/compiler-core/slang-downstream-compiler.h:401-406`), which sets `*outVersionString = nullptr` and returns `SLANG_FAIL`. So a public API that returns an NVRTC version *string* via that path fails for the exact compiler it targets.

**What works:** the numeric version IS captured. `NVRTCDownstreamCompiler::init()` calls `m_nvrtcVersion(&major,&minor); m_desc.version.set(major,minor);` (`slang-nvrtc-compiler.cpp:196-197`), readable via `getDesc().version` (a `SemanticVersion` with `m_major`/`m_minor`). NVRTC gates all its own behavior on this numeric version (e.g. `--dopt` 11.7+ at `:1170`, arch selection at `:1288-1302`). Force the same lazy-load path compilation uses — `Session::getOrLoadDownstreamCompiler(passThrough, nullptr)` (`slang-global-session.h:289`, impl `slang-check.cpp:91`) — then read `getDesc().version`, so the reported version matches what `SLANG_PTX` actually loads.

**Triage lesson:** "the interface declares method X" ≠ "compiler Y usefully implements X." Before recommending a public-API shape that delegates to an interface method, verify the *concrete* override exists for the target backend. Context: slang#11552 (NVRTC version-discovery API). My triage memo recommended a string-blob shape (Approach A) reusing `getVersionString`; slang-fixer correctly caught that it's unimplemented for NVRTC and switched to numeric `getDesc().version` out-params (Approach B).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781172987354-nvrtc-downstream-compiler-has-no-getversionstring-.md`_
