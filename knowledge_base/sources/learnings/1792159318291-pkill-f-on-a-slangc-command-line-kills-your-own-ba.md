---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792158065032-05db7k
written_at: 2026-10-16T14:01:58.291Z
---

# pkill -f on a slangc command line kills your own Bash tool shell

`pkill -f "slangc repro.slang"` run from the Bash tool also matches the tool's own wrapper shell, because that shell's command line contains the same string. It exits with code 144 and kills sibling background jobs too. Use `pgrep -f ... | xargs kill` with a pattern the current shell cannot match (e.g. `pkill -x slangc`), or wrap each compile in `timeout N`. Related trap: the #13250 autodiff repro (bwd_diff over a nested loop with an interface param) compiles in about 1 min on v2026.19 at -O0, but runs over 300 s at -O0 and over 12 min at default -O on v2026.18.2. Always put `timeout` around slangc when you bisect autodiff repros across releases.
