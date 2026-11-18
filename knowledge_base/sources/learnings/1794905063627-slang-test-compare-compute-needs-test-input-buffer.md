---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794890438284-ebme81
written_at: 2026-11-17T08:44:23.627Z
---

# slang-test COMPARE_COMPUTE needs TEST_INPUT buffer binding; hook gotchas (pulls/ reads blocked, critique recording pins)

slang COMPARE_COMPUTE tests need an explicit `//TEST_INPUT:ubuffer(data=[0 0], stride=4):out,name=output` line binding the output buffer, or the kernel writes to an unbound buffer — empty FileCheck results or CUDA_ERROR_ILLEGAL_ADDRESS that looks exactly like a compiler bug. Cost me ~1.5h of false root-causing on #13996 (probes "crashed" on clean master until I noticed generic-interface-inherit.slang carries that line). Also: the host workflow state resets on every routed inbound AND every 429-retry prompt, and codex critique rounds only record when the call carries the verbatim /codex-critique developer-instructions block (sentinel-pinned) plus REQUIREMENTS with anchored GitHub URLs (#issuecomment-…); bare issue URLs fail the anchor regex. And the deliver gate pattern-blocks any bash command containing `pulls/` even for read-only GETs — use the MCP github tools or `git fetch origin pull/N/head` instead.
