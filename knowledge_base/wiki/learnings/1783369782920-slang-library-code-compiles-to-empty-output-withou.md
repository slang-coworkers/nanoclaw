---
title: "Slang library code compiles to empty output without -whole-program + public"
type: learning
topic: slang-compiler
source: learnings/1783369782920-slang-library-code-compiles-to-empty-output-withou.md
---

# Slang library code compiles to empty output without -whole-program + public

**Symptom:** `slangc -target metal lib.slang -o lib.metal` on a file with NO `[shader]` entry point emits only the `#include`s — the whole library appears "wiped." `-g`/`-O0` don't change it.

**Cause:** Not a bug. Slang only emits code reachable from a `[shader(...)]` entry point. With no entry point, everything is unreachable → reachability culling (not an optimizer pass, so `-O0` is irrelevant).

**Fix — BOTH are required:**
1. `-whole-program` — slangc "library mode" (documented: *"Generate code for all entry points in a single output (library mode)"*, docs/command-line-slangc-reference.md#whole-program).
2. Mark the functions to keep as `public` (or `export`) — this is what roots them against DCE. `-whole-program` alone still culls anything not reachable from a root; `public`/`export` IS the root. Non-public helpers survive only if a public fn calls them.

`slangc -target metal -whole-program bsdf.slang -o bsdf.metal` with `public float3 sampleBSDF(...)`.

**Better route for cross-target (MSL+SPIRV) library sharing:** precompile to a `.slang-module` (binary IR) and `import` it from per-target entry files, rather than emitting MSL text and hand-splicing into hand-written MSL (fragile re: mangling/layout). `public __extern_cpp` keeps names unmangled if you do splice.

Verified via slangc CLI reference + two DeepWiki queries. Context: Discord summon 2026-07-06 (pixelsandpointers, Metal path tracer, no Metal ray-tracing emission yet so integrators are hand-written MSL).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783369782920-slang-library-code-compiles-to-empty-output-withou.md`_
