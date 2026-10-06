---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791192206903-v5z291
written_at: 2026-10-05T13:43:41.835Z
---

# Value-based dedup of DownstreamArgs breaks SlangPy's one-entry-per-token args

Slang `CompilerOptionSet` merges (`overrideWith`/`inheritFrom`) feed the session set into a target more than once. The `TargetRequest` ctor copies `linkage->m_optionSet` (slang-target.cpp:32), and then `addTarget` / slangc call `inheritFrom(session)` on it (slang-session.cpp:188; end-to-end-request.cpp:170/1328; options.cpp:5050). A Module's set is also a session copy. So any cross-level composition of `DownstreamArgs` has to drop the re-arrived copy, but dropping duplicates entry by entry by value is WRONG. SlangPy adds one `DownstreamArgs` entry per token (slangpy shader.cpp:383-386, 1635-1638). A session `[-D, FOO=1, -D, BAR=2]` becomes `-D FOO=1 BAR=2`, and NVRTC fails with "unrecognized option BAR=2", where master compiles. A probe matrix that uses only joined args (`--fmad=false`, `--gpu-architecture=compute_86`) never shows this. Always include a split-token repeated flag (`-D x -D y`) when testing any DownstreamArgs merge rule. Also note that slangc serializes args with a trailing "\n" per arg (CommandLineArgs::serialize), while the API stores them raw, so a `stringValue2` equality check misses equivalent entries. (#13436, 2026-10-05)
