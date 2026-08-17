---
title: "Slang JSON reflection drops the $Globals CB scope binding (flat getParameterByIndex, #12307)"
type: learning
topic: slang-compiler
source: learnings/1785536267099-slang-json-reflection-drops-the-globals-cb-scope-b.md
---

# Slang JSON reflection drops the $Globals CB scope binding (flat getParameterByIndex, #12307)

**Context:** Triaging shader-slang/slang#12307 — a self-filed (nv-slang-bot at @tangent-vector's request) design proposal to extend `slangc -reflection-json` to represent global/entry-point scopes completely, including the implicit `$Globals` constant-buffer / parameter-block binding.

**Verified fact (@HEAD 744eb9ed4):** The JSON reflection emitter iterates a FLAT parameter list and never exposes the scope's implicit wrapper binding:
- `emitReflectionJSON` top-level loop uses `programReflection->getParameterByIndex()` (`source/slang/slang-reflection-json.cpp:1304`, count `:1314`, get `:1320`).
- `emitReflectionEntryPointJSON` entry-point loop likewise (`:1188`, count `:1235`, get `:1246`).
- Neither ever calls `getGlobalParamsVarLayout()` or `EntryPointReflection::getVarLayout()` (grep = 0 hits).
- The container+element machinery DOES exist — `emitReflectionParameterGroupTypeLayoutInfoJSON` (`:774`) emits `containerVarLayout` (`:836`) + `elementVarLayout` (`:842`) — but ONLY when a *parameter's TYPE* is a `ConstantBuffer`/`ParameterBlock`, never for a *scope's own* implicit `$Globals` wrapper.
- The clean reference traversal is `examples/reflection-api/main.cpp` `printScope` (def `:676`, called for global scope `:661` and per entry point `:747`); it switches on `TypeLayout` kind and recurses on `getElementVarLayout()` for CB (`:710`) / PB (`:722`).
- The internal pass that wraps loose globals is `slang-ir-collect-global-uniforms.cpp`.

**Symptoms this drops:** the `$Globals` CB's OWN binding is absent (a `uniform, offset 0` param — "offset 0 into WHAT?"), and the descriptor slot the `$Globals` CB consumes appears as an unexplained hole (resources start at slot 1, slot 0 unexplained).

**DeepWiki caveat (verify-don't-trust-the-summary):** DeepWiki's high-level answer claimed the JSON "includes" the CB binding — that conflates the reflection *API's* capability with the JSON *output*. The direct code read is authoritative: the flat loops drop it. Always confirm a load-bearing "does X emit Y" claim against the source, not a docs summary.

**Triage takeaway:** Reflection output SHAPE proposals with open trade-off questions aimed at a maintainer = PARK for design decision, do NOT open a PR guessing the shape (same pattern as #12183). Self-filed proposals must NOT be forwarded to the fixer — that spawns duplicate design work inside our own coworker system.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785536267099-slang-json-reflection-drops-the-globals-cb-scope-b.md`_
