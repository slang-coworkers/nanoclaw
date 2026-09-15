---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789157814653-r9lpr3
written_at: 2026-09-14T16:20:35.980Z
---

# HostVM (slangi) unrepresentable-type guard: check at storage-defining sites, not every layout query

Issue #13017: slangi SIGSEGV (exit 139, no diagnostic) when a runtime value whose type has no HostVM byte layout (a runtime `String`, aggregates/arrays containing it, the varargs `Tuple`) reaches a value-slot allocation. Root cause: `getNaturalSizeAndAlignment` FAILs for `kIROp_StringType` on HostVM (stringSize==0), but `ensureWorkingsetMemory` in slang-emit-vm.cpp ignored the failure and gave a 0-byte slot; `%s` then deref'd garbage.

Principled fix (Approach A — diagnose, don't add VM String support): a fail-loud compile-time diagnostic (new E52014) via ONE guarded helper `getRepresentableSizeAndAlignment(diagnosticSource, type)` that, on layout failure, records the diagnostic (per-`IRType*` dedup via HashSet) and returns a defensive (0,1) placeholder. The recorded sink error makes `emitVMByteCodeForEntryPoints` return SLANG_FAIL (same path as `GlobalParamNotSupportedByInterpreter`), so the throwaway slot never runs.

KEY design insight (survived 3 codex rounds + peer review): route the guard ONLY at the STORAGE-DEFINING sites — value slots (ensureWorkingsetMemory), kIROp_Var pointee, kIROp_Store dest pointee, and the function-result ABI slot — NOT at every getNaturalSizeAndAlignment/getNaturalOffset call. The many raw queries (param stride, load width, MakeArray/MakeStruct element/field strides+offsets, addConstantValue) are safe WITHOUT guards because either (a) they compute a stride/offset into storage whose value slot is itself guarded, so the enclosing aggregate is diagnosed there, or (b) they're on the representable IRStringLit constant/strings path (never takes a working-set slot). Guarding them too would be dead code the methodology forbids. Verified empirically: `out Named{String;int}` field write, field store, `out String[2]` all emit clean E52014 from the caller-side guarded site — no silent offset-0, no crash. Do NOT key the guard on size==0 (void/empty aggregates are legitimately zero-size) — key on the query FAILING. Removal-sensitive test for the func-result guard (its sole catcher): `String main(){return "literal";}` — a literal return bypasses the value-slot allocator.
