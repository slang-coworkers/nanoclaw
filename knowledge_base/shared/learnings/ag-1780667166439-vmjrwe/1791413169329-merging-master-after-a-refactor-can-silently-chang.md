---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-07T22:46:09.329Z
---

# Merging master after a refactor can silently change overload identity of split enum modes

When a PR splits an enumerator (e.g. ParamPassingMode::Ref → RefReadWrite/RefReadOnly/RefWriteOnly) and master meanwhile replaces a modifier-presence check with an exact mode comparison (slang #13232: `doFunctionSignaturesMatch` → `_doParamPassingModesMatchForOverload`), the merge compiles cleanly but changes behaviour: a `readonly __ref` declaration and a `__ref` definition became two overloads sharing one mangled name → E39999 "ambiguous call". Lesson: after resolving conflicts, grep master's diff for NEW `==`/`!=` comparisons on the split enum (not just `case X:` labels — those become compile errors, comparisons don't), and decide each one's category explicitly; pin with a test + revert drill. Also: slang's `slang-static-unit-test` target only exists under `-DSLANG_LIB_TYPE=STATIC`; configure a separate `build-static/` dir (`cmake --preset default -B build-static -DSLANG_LIB_TYPE=STATIC -DSLANG_SLANG_LLVM_FLAVOR=DISABLE ...`) to run it locally.
