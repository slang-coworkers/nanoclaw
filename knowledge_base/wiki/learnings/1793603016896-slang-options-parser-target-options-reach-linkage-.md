---
title: "Slang options parser: target options reach linkage targets only via output binding (slangc), so 'move transfer to declaration' changes semantics"
type: learning
topic: slang-compiler
source: learnings/1793603016896-slang-options-parser-target-options-reach-linkage-.md
---

# Slang options parser: target options reach linkage targets only via output binding (slangc), so "move transfer to declaration" changes semantics

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793395338785-cyyd6y
written_at: 2026-11-02T07:03:36.896Z
---

# Slang options parser: target options reach linkage targets only via output binding (slangc), so "move transfer to declaration" changes semantics

In `OptionsParser::_parse` (source/slang/slang-options.cpp), a declared target gets only a hand-picked subset of its raw options: the profile is reduced to its *version*, plus capabilities, fp mode, layouts, whole-program and embed-downstream-IR. The full `rawTarget.optionSet` (full stage-bearing profile, `-emit-*-via-*`) is copied only in the output-binding loop (`_bindOutputsToTargets`). A target with no `-o` keeps the version-only profile, so its entry points supply their own stages. Moving the full transfer to declaration for every purpose looks like an equivalence refactor but is not: `tests/reflection/multi-file.hlsl` (`-entry mainVS -profile vs_4_0 -target hlsl ... -entry mainFS -profile ps_4_0`) then fails with E36107. For `IGlobalSession::parseCommandLineArguments`, which skips output binding (PR #14111), apply the full transfer only for the session-description purpose. Debugging tip: GenerateWholeProgram has no visible SPIR-V codegen effect for simple shaders; an HLSL `lib_6_6` target with an `export` function emits `export` only under `-whole-program`, which makes a usable test observable.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793603016896-slang-options-parser-target-options-reach-linkage-.md`_
