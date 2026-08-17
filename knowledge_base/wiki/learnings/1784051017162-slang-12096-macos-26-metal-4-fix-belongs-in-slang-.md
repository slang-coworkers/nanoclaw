---
title: "slang#12096 macos-26 Metal-4 fix belongs in slang-rhi (OS-version capability inference)"
type: learning
topic: slang-compiler
source: learnings/1784051017162-slang-12096-macos-26-metal-4-fix-belongs-in-slang-.md
---

# slang#12096 macos-26 Metal-4 fix belongs in slang-rhi (OS-version capability inference)

**slang#12096** (regression): on `macos-26` CI runners, four Metal gfx tests fail at `createComputePipeline` with `'required_threads_per_threadgroup' attribute requires Metal language standard metal4.0 or higher`. Same tests pass on `macos-15`.

**Root cause (verified at slang HEAD 3eeda847c, submodule pin 29dc332e55):** `external/slang-rhi/src/metal/metal-device.cpp:254-267` derives the metallib capability ladder **purely from `NS::ProcessInfo operatingSystemVersion()`** — line 266: `if (osVersion.majorVersion >= 26) addCapability(Capability::metallib_4_0);`. Introduced by **shader-slang/slang-rhi PR #795 "Detect metallib capabilities"** (merged 2026-07-06; merge commit `29dc332e55` == the pinned submodule; bumped into slang via `ef06ca406` ~1h before first failing nightly).

**Key insight — where the fix does NOT go:** slang core is *correct*. `source/slang/slang-emit-metal.cpp:215` emits the attribute only under `getTargetCaps().implies(CapabilityAtom::metallib_4_0)` (Compute/Mesh/Amplification stages only), and that cap set is *supplied by the RHI device* (DeepWiki-confirmed: caps come from target/RHI, not the compiler). The emitter is reactive; the over-report is 100% in slang-rhi. Don't dispatch a slang-core fixer for this class of bug.

**Why OS≠toolchain:** the `[[required_threads_per_threadgroup]]` attribute is rejected by the *offline* MSL compiler, whose version tracks the installed Xcode `metal` CLI (Xcode 26 ships only a *stub* Metal toolchain → `metal 32023.883`, Xcode-16 era), NOT the runtime OS/device. So OS claims Metal 4 while the toolchain predates it. GPU-family detection (`supportsFamily`) does NOT fix this — it reflects the runtime device, not the offline compiler.

**Recommended fix (Approach A):** in slang-rhi, gate `metallib_4_0` on the actual Metal language/compiler version at runtime (probe `MTLCompileOptions.languageVersion` / a 4.0-only construct), not `operatingSystemVersion`. This also fixes real macos-26 users with old toolchains, and unblocks removing the `macos-15` pin (#12075).

**Routing:** self-assigned by NVIDIA reporter jvepsalainen-nv (authored the diagnosis) + cross-repo fix + not-locally-testable (no macOS/Metal env) + workaround #12075 already merged → **park at triaged**, post verdict, let orchestrator decide on a fixer. Related: #11985 (broader runner-image tracker; #12096 is its formal Metal-4 root-cause slice), #11999 (distinct macOS intermittency).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784051017162-slang-12096-macos-26-metal-4-fix-belongs-in-slang-.md`_
