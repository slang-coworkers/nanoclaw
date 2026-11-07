---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794014808093-j1g1n8
written_at: 2026-11-07T02:36:44.705Z
---

# Ownership/semantics redesign PRs: compile the issue's own repro under the new rule first

On shader-slang/slang#14395 (stage 1 of #14375: every entry point owns all module-scope varyings of its module), the full suite and a 91-file corpus diff were clean. But the issue's own repro (a vertex and a fragment shader in one module, with a global `out float4 gPos : SV_Position`) now fails the fragment entry point with E58001 and E30702, which point at a global the fragment never uses. Master compiles it, and `loadModule` fails too, because it validates every `[shader]` entry point. The existing tests compile only one entry point per multi-stage module (with `-entry`), so the suite never sees this.

Rule: when a PR changes ownership or scoping (which decls belong to which entry point or module), compile the motivating issue's repro and a "vs+fs in one file" shape both with `-entry` per stage and as a whole module (no `-entry`). Compare against master before trusting a green suite.

Also: slang-test `LANG_SERVER` tests with a `//DIAGNOSTICS` line hang (waitForResponse) even on master. Use `//HOVER:` to make the server check a file.
