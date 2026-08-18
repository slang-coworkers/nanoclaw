---
title: "WGSL trailing break in switch cases is VALID (redundant), not invalid — verify validator claims via DeepWiki when WebSearch is down"
type: learning
topic: verification
source: learnings/1783296818057-wgsl-trailing-break-in-switch-cases-is-valid-redun.md
---

# WGSL trailing break in switch cases is VALID (redundant), not invalid — verify validator claims via DeepWiki when WebSearch is down

## Finding (slang #11946)
Slang's WGSL emitter outputs a `break;` as the last statement of every switch `case`/`default` body. A reporter claimed this is "invalid WGSL." **It is not — it is valid but redundant.** WGSL cases don't fall through, so a case-terminal `break` is a no-op, but it is not a syntax/validation error.

Verified against BOTH reference WGSL implementations:
- **Tint** (Chrome/Dawn): `Validator::BreakStatement` accepts `break` in a `CaseStatement`; `Switch_WithBreak` test covers it; Tint's own WGSL writer merely *omits* the break when it's the case terminator (idiomatic omission, not rejection).
- **naga** (Firefox/wgpu): validator runs case bodies with `ControlFlowAbility::BREAK`; `naga/tests/in/wgsl/control-flow.wgsl` contains trailing breaks; naga's MSL backend even *inserts* them.
- WGSL spec behavior-analysis: a case-terminal `break` behavior is absorbed by the switch → valid.

So: emitting the break is at most a cosmetic non-idiomatic-output issue (P3), NOT a correctness bug. Don't rush a fix on a "target emits invalid X" report without confirming a real validator actually rejects it.

## Code locus (if a cleanup is ever wanted)
- Break emitted target-independently: `CLikeSourceEmitter::emitRegion`, `Region::Flavor::Break` → `m_writer->emit("break;\n")` at `source/slang/slang-emit-c-like.cpp:3639`; switch case body emitted at `:3733`.
- WGSL already overrides `supportsSwitchFallThrough()`→false (`slang-emit-c-like.h:662`) and `emitSwitchCaseSelectorsImpl` (comma syntax, `slang-emit-wgsl.cpp:62`); nothing suppresses the break.
- `BreakRegion` carries `BreakableRegion* outerRegion` (`slang-ir-restructure.h:141-187`; `SwitchRegion : BreakableRegion`) → can discriminate switch-exit vs loop-exit, and terminal-vs-early break, to suppress ONLY the redundant terminal one for WGSL.

## Technique / meta
When WebSearch and the Explore/Haiku-backed subagents are down (model-access 403 outage), you can still get authoritative answers about another ecosystem's rules by asking **DeepWiki against that ecosystem's own repo** — e.g. `gfx-rs/wgpu` (naga) and `google/dawn` (Tint) to settle a WGSL-spec-validity question. DeepWiki has its own backend and kept working through the AWS-Haiku outage. Cite the specific validator functions/tests it names, and cross-check ≥2 independent implementations before refuting a reporter's premise.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783296818057-wgsl-trailing-break-in-switch-cases-is-valid-redun.md`_
