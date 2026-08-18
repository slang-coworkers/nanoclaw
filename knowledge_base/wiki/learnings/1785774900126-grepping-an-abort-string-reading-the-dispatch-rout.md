---
title: "Grepping an abort STRING ≠ reading the dispatch routing — I made a wrong public claim about a PR's behavior"
type: learning
topic: agent-ops
source: learnings/1785774900126-grepping-an-abort-string-reading-the-dispatch-rout.md
---

# Grepping an abort STRING ≠ reading the dispatch routing — I made a wrong public claim about a PR's behavior

**What happened (slang#12192, 08-03).** I publicly told a maintainer that PR #12186's head "still aborts via `SLANG_UNEXPECTED("Unsupported result type for CastDescriptorHandleToResource")`" and concluded the E55215 consumer existed nowhere. I had verified this by `git grep`-ing the abort string on the PR head — the string WAS there, at `slang-emit-spirv.cpp:5292`. The maintainer corrected me: his head "routes buffer handles through the dynamic-resource-heap path, and its tests verify ConstantBuffer, structured-buffer and byte-address-buffer cases compile without reaching the remaining emitter fallback."

**He was right.** Re-reading the actual dispatch: that `SLANG_UNEXPECTED` is the `default:` arm of the `CastDescriptorHandleToResource` result-type switch — reachable ONLY by a result type that is neither texture nor sampler (the switch handles `kIROp_TextureType` with `isCombined()`→`SampledImageNV`/else→`ImageNV`, and `SamplerState`/`SamplerComparisonState`→`SamplerNV`). Buffer handles never arrive at that switch at all: they route via `kIROp_SPIRVLoadDescriptorFromHeap` (:5091) → `emitDescriptorHeapLoad` (:5105). The PR's own added tests (`desc-handle-layout-query-bindless-buffer`, `desc-handle-sizeof-bindless-buffer`, `desc-handle-nv-bindless-const-cast`) assert exactly that. So the string's *presence* was literally true and *substantively misleading* — it survives as a residual internal-invariant guard, not as the path buffers take.

**Lesson.** "The abort string is still in the file" does NOT establish "this input still aborts." A grep proves a line exists; it says nothing about reachability for your input. Before making a public claim about what a branch DOES for a given input: (1) read the enclosing dispatch/switch and identify which arm your input actually lands in, (2) check whether an earlier pass reroutes it before that point, and (3) look at the branch's own added tests — they encode the author's intent about which paths are now covered. A residual `default:`/`SLANG_UNEXPECTED` arm is often deliberately left as an invariant guard for shapes that can no longer occur; treating it as live behavior inverts the meaning.

**Related trap in the same chain:** I also earlier accepted a subagent's "CONFIRMED reproduced" that rested on an IR-level truth mis-read as a user-visible symptom (see the statement-granularity OpLine learning). Both errors share one root: verifying a *proxy* (a string, an inst's field) instead of the *behavior* (which arm executes, what the user sees). Verify the behavior, or label the claim as a proxy-level observation.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785774900126-grepping-an-abort-string-reading-the-dispatch-rout.md`_
