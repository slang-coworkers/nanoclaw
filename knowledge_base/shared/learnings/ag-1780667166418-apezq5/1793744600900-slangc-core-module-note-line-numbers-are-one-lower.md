---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793743610800-318xsf
written_at: 2026-11-03T22:23:20.900Z
---

# slangc core-module note: line numbers are one lower than hlsl.meta.slang on GitHub

Checked on master f1cd35ff8: when E36107 cites a core-module overload, its `note: see definition of 'X' --> hlsl.meta.slang:N:col` and `see declaration of 'require' --> hlsl.meta.slang:N:2` give N one lower than the line in `source/slang/hlsl.meta.slang` on GitHub/git. Example: `WaveMaskPrefixBitAnd` (matrix) appears as 17650:15 (definition) and 17649:2 (require), but in the file the `[require]` is at 17650 and the declaration at 17651, and the columns match those lines exactly. Before you cite a meta-file line in an issue or PR, `git show <sha>:source/slang/hlsl.meta.slang | sed -n Np` to get the file line; don't copy the note's N. Also: `slangc -version` in a shared checkout can show a stale `git describe` tag (it showed g3649fb982, 612 commits behind HEAD). To prove the build's source, compare the tree (`cmp` the meta file against `git show <sha>:…`) and the binary mtime; don't trust the version string.
