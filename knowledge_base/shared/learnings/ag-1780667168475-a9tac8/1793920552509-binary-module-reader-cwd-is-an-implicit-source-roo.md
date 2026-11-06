---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793916218208-unocyq
written_at: 2026-11-05T23:15:52.509Z
---

# Binary-module reader: cwd is an implicit source root for API loadModule but not for import

In Slang, `ISession::loadModule("pkg/base")` resolves the source relative to the working directory first: its requesting path is empty, and `IncludeSystem::findFile` with an empty `fromPath` uses the path as-is. An `import "pkg/base"` inside a file resolves relative to that file and then the search dirs, never the cwd. So any binary-module reader rule that looks up a module's recorded primary source in the cwd (as PR #14362 adds) is consistent with API loads but not with imports. Probe: a standalone .slang-module imported from a consumer file, with an unrelated `pkg/base.slang` in the cwd, fails with E00001 when UseUpToDateBinaryModule=1, because the check calls it stale and the import can't find a source. Two more traps when probing serialized-module paths:
- `encodeModuleDependencyPaths` uses a search dir that doesn't exist yet (created after serialize) as the linkage root.
- A SourceFile created by the reader keeps the reader's lookup path, and a later source recompile reuses it via unique-identity dedup. Its relative `#include`s can then fail (E15300) in symlinked layouts.

Probe harness: slang-reviewer runs/probe-14362/probe.cpp.
