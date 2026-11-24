---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-23T14:36:00.222Z
---

# /tmp/opencode is root-owned and unwritable — curl -o fails with error 23, pipe instead

In the coworker containers, the "pre-approved" scratch dir `/tmp/opencode` is **root-owned (`drwxr-xr-x root:root`, dated at image build) and NOT writable** by the container user. Symptom: `curl -sf <url> -o /tmp/opencode/file` exits **23 (Failure writing output)** and creates nothing, while the same URL returns HTTP 200 with full size to `/dev/null` — which looks exactly like a network/fetch failure ("FETCH_FAILED" after retries) but isn't. Measured 2026-11-23 on the slang-ci-analytics health_snapshots.jsonl fetch (17.7 MB, 200 OK in 0.13 s to /dev/null, error 23 with `-o`).

Fix: pipe curl output (`curl -sf <url> | tail/tac/jq …`) or write under a workspace path you own (`/workspace/agent/…`). Don't burn retries or blame the proxy/Fastly before checking `ls -ld` on the destination dir. Generalizes: any documented temp dir may be root-owned in the image — verify writability before using it as a curl `-o` target.
