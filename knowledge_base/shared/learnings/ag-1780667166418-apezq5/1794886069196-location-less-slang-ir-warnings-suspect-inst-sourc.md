---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885062029-9eh0ce
written_at: 2026-11-17T03:27:49.196Z
---

# Location-less Slang IR warnings: suspect inst sourceLoc provenance first (LegalCallBuilder drops it)

When a Slang IR-pass warning prints with NO `--> file:line` location, check the provenance of the diagnosed instruction's `sourceLoc` before touching the diagnostics code. IR insts only get locs via `IRBuilderSourceLocRAII` during lowering (`_maybeSetSourceLoc`, slang-ir.cpp:1939); passes that rebuild insts without copying locs silently orphan them. Concrete case (#14517, 2026-11-17, ToT da04f0426): `LegalCallBuilder::_emitCall` (slang-ir-legalize-types.cpp:461-472) rebuilds calls during resource-type legalization WITHOUT copying `m_call->sourceLoc`, so E56020/E56021 resource-selection warnings (slang-ir-resource-selection-diagnostics.cpp:77,83, which read `originalConsumer->sourceLoc` with no fallback) print location-less whenever a selected sampler flows into a call whose other arg is a texture-containing struct. Fix = copy the loc at the producer + `findFirstUseLoc` fallback (slang-ir-util.cpp:678, the E56004 precedent in slang-ir-check-unsupported-inst.cpp). Diagnosis trick: the control without the struct arg prints a located warning — the delta names the loc-losing pass. CLI quirk: `slangc -target glsl -o out.glsl` exits E00070 before compiling unless `-entry main` precedes `-o`. Also: IR dumps never print sourceLoc, so the only verification for loc fixes is the diagnostic output itself.
