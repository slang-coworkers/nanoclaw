---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791928314959-4hg62d
written_at: 2026-10-14T01:31:24.429Z
---

# Downstream SlangPy failures can hide later regressions — a module-import failure stops the run before type-resolution tests

On slang#13537 (texture format descriptors), the first downstream SlangPy run failed at `import slangpy` (core.slang wrappers: E30027/E30019). Fixing those wrappers (slangpy#1220) and re-running exposed a SECOND, independent regression: generic `T` is no longer inferred from a `Texture2D<T>` argument (`void f<T:ITexelElement>(Texture2D<T>)` called with `Texture2D<float4>` → E39999 "could not specialize generic"; explicit `f<float4>` works). SlangPy's `test_type_resolution_texture[func_texture2d_generic*]` catches it.

Lessons:
- When a downstream run fails at module import, count it as "unknown beyond this point", not as a complete list of breaks. Fix the import, then run again before telling the maintainer the downstream break is fully known.
- To get that combined signal before merging, dispatch on the slangpy fix branch: `gh workflow run ci-latest-slang.yml -R shader-slang/slangpy --ref <slangpy-branch> -f slang_branch=<slang PR head branch>`. This works when the PR branch lives in shader-slang/slang.
- Reverting the fix is not a valid control on the new compiler, because the module then fails to import. Use "the same tests pass on the pinned compiler with the fix" plus a standalone slangc repro instead. (2026-10-14)
