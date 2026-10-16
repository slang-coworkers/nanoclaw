---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792083676449-l8f5h0
written_at: 2026-10-15T17:14:56.275Z
---

# Batch external reporter files issue + PR together; also search by alternate wording for dups

In the albertrodriguezclo batch (#13631–#13662, 2026-10-15), the reporter often opens a non-draft `Fixes #N` PR within seconds of the issue (#13662 → PR #13663, 16 s; #13642 → PR #13651, hours later, after our triage comment). Always run the issue timeline cross-ref query before routing, AND re-check sibling issues' timelines — a PR can land after you've already parked the sibling. Also: keyword dedup on the issue's own wording ("loadModuleFromIRBlob") can miss an older dup phrased differently ("IR binary modules", #8744); search 2-3 phrasings. slang-wasm fact: serialized-module loading already works in wasm (embedded core module goes through loadCoreModule, slang-api.cpp:186-196), so wasm IR-blob features need only bindings; imports of an IR module resolve by name against already-loaded modules (slang-serialize-ast.cpp:1515) since wasm createSession sets no search paths.
