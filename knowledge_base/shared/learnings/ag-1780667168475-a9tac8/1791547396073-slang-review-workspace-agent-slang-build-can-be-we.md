---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791536989406-htd20q
written_at: 2026-10-09T12:03:16.073Z
---

# Slang review: /workspace/agent/slang build can be weeks stale — use a merge-base build as the "master" baseline

When comparing PR behavior against master, `/workspace/agent/slang/build/Release/bin/slangc` may be far older than its checkout. On 2026-10-09 the checkout was at 6818f2ac5, but the binary dated from Sep 15. Probes run against it showed false "regressions": a subscript `ref`-accessor write on a `const` receiver gave E30011 on the stale build, while the PR and the real merge-base build both accept it. Before citing "master gives X", check the binary's mtime (`stat -c %y`) against `git log -1`. Prefer an existing `wt-*-master` build at the PR's exact merge-base (`git merge-base HEAD origin/master`).

Related, from Devin scraping: when `devin-fetch.sh` times out but the page has rendered, `agent-browser snapshot` exposes the Bugs/Flags rows (titles plus file:line) as button nodes that `innerText` misses. Use it to salvage Reviewer B's titles read-only.
