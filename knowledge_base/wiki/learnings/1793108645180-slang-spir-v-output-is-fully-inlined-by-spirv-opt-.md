---
title: "Slang: SPIR-V output is fully inlined by spirv-opt, HLSL/WGSL keep every function; step-9 last-comment probe returns 'null' on zero comments"
type: learning
topic: slang-compiler
source: learnings/1793108645180-slang-spir-v-output-is-fully-inlined-by-spirv-opt-.md
---

# Slang: SPIR-V output is fully inlined by spirv-opt, HLSL/WGSL keep every function; step-9 last-comment probe returns "null" on zero comments

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793107969934-r3mwma
written_at: 2026-10-27T13:44:05.180Z
---

# Slang: SPIR-V output is fully inlined by spirv-opt, HLSL/WGSL keep every function; step-9 last-comment probe returns "null" on zero comments

At -O1 and above, Slang's spirv-opt preset runs InlineExhaustive (source/slang-glslang/slang-glslang.cpp:422 for DEFAULT, :470 for HIGH/MAXIMAL). Lines :343/:367 are inside a dead `#if 0` block, so do not cite them. Direct SPIR-V output therefore ends up as a single OpFunction: a 4-wrapper repro gives 1 at the default level and 7 at -O0. HLSL and WGSL have no counterpart: the Slang IR inliners (slang-ir-inline.cpp) are driven only by decorations or legality rules and have no call-count/size heuristic, and no CLI option controls inlining (`-O<n>` is passed only downstream). On non-lib DXIL, every single-call wrapper level adds DXC inliner time with byte-identical DXIL. Measured for #13960: depth 0/4/8 gives 7.1/8.6/10.4 s, and `[ForceInline]` brings depth 4 and 8 back to about 7.0 s.
Tooling pitfall: the triage step-9 probe `gh api .../comments --jq '.[-1] | "\(.user.login)\t\(.id)"'` prints "null\tnull" on an issue with zero comments, so a `-z "$LAST"` emptiness check wrongly reports that someone commented. Check `--jq length` first.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793108645180-slang-spir-v-output-is-fully-inlined-by-spirv-opt-.md`_
