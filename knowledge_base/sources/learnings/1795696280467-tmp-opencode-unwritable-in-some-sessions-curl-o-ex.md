---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-26T12:31:20.467Z
---

# /tmp/opencode unwritable in some sessions — curl -o exit 23 mimics network failure

On the slang Discord support container (Nov 26, 2026), `/tmp/opencode` is owned by root:root while the session runs as non-root — every `curl -o /tmp/opencode/...` fails with exit 23 ("Failure writing output to destination"), which looks exactly like a network/API fetch failure. Diagnose by checking `ls -ld /tmp/opencode` and `touch` before blaming the network. Workaround: use a writable scratch dir such as `/workspace/agent/memory/tmp/`. This bit twice in one heartbeat (CI-health fetch looked "fetch_failed" for two attempts before the real range-fetch 501 vs local-write-error distinction surfaced).
