---
title: "Slang already captures the loaded downstream-compiler version — exposing it is a thin read"
type: learning
topic: slang-compiler
source: learnings/1781171365104-slang-already-captures-the-loaded-downstream-compi.md
---

# Slang already captures the loaded downstream-compiler version — exposing it is a thin read

When triaging a request to expose which downstream compiler version Slang actually uses (e.g. shader-slang/slang#11552 — Falcor wanting the loaded NVRTC version), the value is ALREADY captured internally; the feature is a thin public-API read, not new discovery logic.

**Where it's captured (HEAD d92b15e02):**
- `NVRTCDownstreamCompiler::init()` calls the real loaded library: `m_nvrtcVersion(&major,&minor); m_desc.version.set(major,minor)` — `source/compiler-core/slang-nvrtc-compiler.cpp:196-197`.
- Stored in `m_desc` (`DownstreamCompilerDesc`, field `version` = `SemanticVersion`), exposed via `IDownstreamCompiler::getDesc()` and `getVersionString(IBlob**)` — `source/compiler-core/slang-downstream-compiler.h:342 / :353`.

**The single lazy-discovery funnel to reuse:** `Session::getOrLoadDownstreamCompiler(PassThroughMode, DiagnosticSink*)` — `source/slang/slang-check.cpp:91`, declared `source/slang/slang-global-session.h:289`. Memoized (bitmask + cache), honors `setDownstreamCompilerPath` override + instance-dir/CUDA_PATH/PATH search + Newest-preferred. All compilation paths go through it, so reading `getOrLoadDownstreamCompiler(pt, nullptr)->getDesc().version` gives EXACTLY the library used for `SLANG_PTX`. The existing public `checkPassThroughSupport` (`include/slang.h:4069` → `slang-global-session.cpp:1256`) is the plumbing/error-semantics precedent (returns OK / E_NOT_IMPLEMENTED / E_NOT_FOUND).

**ABI:** append new `IGlobalSession` virtual immediately before `include/slang.h:4182` (last method `saveBuiltinModule` at :4178); mid-vtable insertion is breaking. Return a blob/string or primitive ints — `SlangDownstreamCompilerDesc`/`SlangCompilerVersion` do NOT exist publicly, and internal `DownstreamCompilerDesc`/`SemanticVersion` must not cross the ABI boundary. Append-only → "pr: non-breaking".

Same pattern applies to any "what version of DXC/glslang/etc did Slang load" request — the descriptor mechanism is generic across `SlangPassThrough`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781171365104-slang-already-captures-the-loaded-downstream-compi.md`_
