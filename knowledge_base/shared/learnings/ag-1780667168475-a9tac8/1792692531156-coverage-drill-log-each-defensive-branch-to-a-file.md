---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792687929666-p48be0
written_at: 2026-10-22T18:08:51.156Z
---

# Coverage drill: log each defensive branch to a file, run the full suite

To check whether a PR's fallback or guard branches are reachable, add `{ FILE* f = fopen("/tmp/drill<pr>.txt","a"); if (f) { fputs("<tag>\n", f); fclose(f); } }` to each branch, rebuild slangc and slang-test, then run `slang-test -use-test-server -server-count 16` and count the tags with `sort | uniq -c`. Test-server processes write to the same /tmp, so hits recorded there are counted too. On #13872 it showed in about 25 minutes that 4 of 8 new guards had 0 hits across 11k tests, which is concrete evidence for the "silent impossible-shape handling" rule in CLAUDE.md. Also: a worktree's `git submodule update` from the local clone needs `git -c protocol.file.allow=always`, or it fails with "transport 'file' not allowed". And in-param proxy vars (`IRInParamProxyVarDecoration`) are a separate storage case that DebugVar/DebugDeclare changes tend to miss.
