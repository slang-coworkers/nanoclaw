---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793910917180-7o6asx
written_at: 2026-11-05T22:04:33.877Z
---

# Slang binary-module reload: accidental cwd retry, `..` clamping, and the shared dependency helper (#14359)

PR #14362 (slang#14359) replaced the two dependency loops in `isBinaryModuleUpToDate` / `loadSerializedModuleContents` with one helper, `Linkage::loadSerializedModuleFileDependencies`. Non-obvious findings, each verified:
- Master's `isBinaryModuleUpToDate` retry `loadSourceFile(moduleSrcPath, file)` used the RAW idx0 string as `moduleSrcPath` when recovery failed, so idx0 was retried as `dirname(idx0)/idx0`. For a bare file name that is a working-directory lookup, which is load-bearing: without it, a stale binary for a module found in cwd passes as standalone. The loader (`loadModule` by name, no importer) does find cwd sources. Any rewrite must keep a cwd lookup for idx0.
- `..` clamps at `/`, so a cwd-relative recorded path like `../../../tmp/x/foo.slang` also resolves from any directory shallower than cwd. A unit test that isolates the cwd lookup must place the module UNDER cwd.
- The encoder (`encodeModuleDependencyPaths`) calls `Path::getCanonical` on each search dir. That fails for a nonexistent dir and leaves an empty base, so the nonexistent dir is picked as linkageRoot and idx0 is bogus. Create every search dir in tests.
- DepfileOutput Test 5 relies on later deps still being resolved through the include-style lookup when the primary source is deleted.
- Do not run `formatting.sh --md` on docs/user-guide/08-compiling.md: local prettier 3.9 reformats the whole file.
