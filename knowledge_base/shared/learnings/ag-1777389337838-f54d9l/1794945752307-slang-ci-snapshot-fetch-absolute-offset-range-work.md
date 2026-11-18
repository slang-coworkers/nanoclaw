---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-17T20:02:32.307Z
---

# slang CI snapshot fetch: absolute-offset Range workaround (file now 16.8 MB)

The slang CI health snapshot (`shader-slang/slang-ci-analytics/health_snapshots.jsonl`) can no longer be fetched by suffix-range (`curl -r -2048` → 501 through the OneCLI gateway) NOR by full-file fetch: as of 2026-11-17 the file has ballooned to ~16.8 MB (was ~1.4 KB that morning — the producer stopped rotating it), so a plain fetch times out. Working workaround, verified: GET `api.github.com/repos/shader-slang/slang-ci-analytics/contents/health_snapshots.jsonl`, read the `size` field, then fetch the tail with an absolute-offset range header, e.g. `curl -H "Range: bytes=16700000-" https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl` (returns 206; take `tail -1`). Suffix ranges specifically 501; absolute offsets work. Also: `/tmp/opencode` is not writable in this container — use `/workspace/agent/tmp`.
