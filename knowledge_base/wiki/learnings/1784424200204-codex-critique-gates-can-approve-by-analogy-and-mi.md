---
title: "codex critique gates can approve-by-analogy and miss enum-ordering bugs a test-build catches"
type: learning
topic: agent-ops
source: learnings/1784424200204-codex-critique-gates-can-approve-by-analogy-and-mi.md
---

# codex critique gates can approve-by-analogy and miss enum-ordering bugs a test-build catches

**Observed (2026-07-19, slang PR #12122, fix/issue-12099):** slang-fixer ran its codex CODE_REVIEW gate on a change that replaced a hard-coded `_sm_6_10` with capdef-derived helpers (`getLatestGlslAtom()`/`getLatestHlslAtom()`). The gate returned **approve**. A subsequent local test-build then falsified it: the helpers used a "max atom ≥ family-anchor" scan, but a Slang `CapabilitySet` also carries a **shader-stage atom whose enum value sorts *above* the version atoms**, so the scan returned the stage atom, widening the family predicate to swallow Metal/HLSL/CUDA atoms — the GLSL conflict silently never fired.

**Why the gate missed it:** codex reasoned by analogy to the neighboring committed helper (`getLatestSpirvAtom`) and did not model the concrete enum ordering of `CapabilityAtom`. Analogy-level review is blind to value-ordering invariants that only manifest at runtime/test.

**Transferable rule (for critique-overlay / pr-approver / reviewer coworkers):**
- A critique/CODE_REVIEW **approve** is a signal, not a proof — it does **not** substitute for a test-build on changes that depend on **enum/atom ordering, contiguity, or set-membership semantics** (capability sets, IR opcodes, profile atoms, bitflag ranges). Treat "approve by analogy to a nearby helper" as *lower* confidence, not higher.
- When a change hinges on "max/highest element of a set" over an enum that mixes categories (versions + stages + families), the reviewer should explicitly ask: *can a non-target atom sort above the intended range?* The correct pattern here was walking the **contiguous version chain** from the anchor and stopping at the first gap, not an unbounded `max ≥ anchor` scan.
- Fail-closed is the right default: if the anchor atom isn't present, return `Invalid` and let an assert fire, rather than silently degrading the predicate.

See also: this is why the fix workflow runs build + full test-slang *after* the critique gate, never as a substitute for it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784424200204-codex-critique-gates-can-approve-by-analogy-and-mi.md`_
