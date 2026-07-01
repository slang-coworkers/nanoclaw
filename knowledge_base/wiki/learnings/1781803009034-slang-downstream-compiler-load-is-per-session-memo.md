---
title: "Slang downstream-compiler load is per-session memoized; ListBlob::moveCreate doesn't actually move"
type: learning
topic: slang-compiler
source: learnings/1781803009034-slang-downstream-compiler-load-is-per-session-memo.md
---

# Slang downstream-compiler load is per-session memoized; ListBlob::moveCreate doesn't actually move

Two reusable, non-obvious facts found fixing slang#11662 (optional spirv-opt absence turning valid SPIR-V into a fatal E00100).

1. **`Session::getOrLoadDownstreamCompiler(type, sink)` is per-session MEMOIZED** (`source/slang/slang-check.cpp:99-114`): the first attempt sets an "initialized" bit and caches the result (possibly null); every later call returns the cached value WITHOUT re-running the locator or re-emitting any diagnostic, regardless of the `sink` passed. It emits `FailedToLoadDownstreamCompiler` (E00100, error-severity) only when `sink != nullptr`.
   - Consequence: deciding optional-vs-required by choosing the *sink on the load* (`needed ? sink : nullptr`) is UNSOUND — an earlier best-effort (nullptr-sink) load caches null, and a later compile that genuinely needs the compiler silently reuses the cached null with no diagnostic. The sound pattern is: load ALWAYS best-effort (`nullptr` sink), then do a POINT-OF-USE check on the *resolved* compiler pointer (`required && !compiler` → diagnose + fail). That is memoization-immune.
   - When you genuinely need a downstream compiler and want the error, emit `Diagnostics::FailedToLoadDownstreamCompiler{.compiler = TypeTextUtil::getPassThroughAsHumanText(SlangPassThrough(PassThroughMode::X))}` yourself at the point of use.

2. **`ListBlob::moveCreate(List<uint8_t>& data)` does NOT actually move its source** (`source/core/slang-blob.h:108`). It does `new ListBlob(_Move(data))`, but the move ctor (`slang-blob.h:119-122`) initializes `m_data(data)` where `data` is a *named* rvalue-reference parameter — i.e. an lvalue — so that member-init selects the List COPY constructor, not move. The caller's list (e.g. the emitted `spirv` buffer in `createArtifactFromIR`) is therefore left INTACT after `moveCreate`. Existing code relies on this (it reads `spirv` for link/validate after the `moveCreate`). A reviewer (or codex) flagging "use-after-move on the buffer passed to moveCreate" is a false alarm; refute with this trace. (It's a latent "doesn't move" quirk in moveCreate itself — copies where the name implies a move.)

Why: matters whenever wiring optional downstream compilers (glslang/spirv-opt/dxc/etc.) for graceful degradation, and whenever reasoning about whether a `*::moveCreate` empties its argument.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781803009034-slang-downstream-compiler-load-is-per-session-memo.md`_
