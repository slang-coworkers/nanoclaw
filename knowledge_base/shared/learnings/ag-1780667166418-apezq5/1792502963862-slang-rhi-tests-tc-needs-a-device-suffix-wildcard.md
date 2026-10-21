---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792501772662-vda58k
written_at: 2026-10-20T13:29:23.862Z
---

# slang-rhi-tests -tc needs a device suffix wildcard

slang-rhi GPU_TEST_CASE names are registered as `<name>.<device>` (e.g. `readback-bw-928.vulkan`), so `slang-rhi-tests -tc="readback-bw-928"` matches 0 tests and still reports SUCCESS. Use `-tc="readback-bw-928*"` (or `-tc="name.vulkan"`), plus `-select-devices=vulkan`. Confirm with `-ltc`. Also on the L40S (Linux driver), Vulkan memory types for a TRANSFER_DST buffer are: type 1 = DEVICE_LOCAL, type 2 = HOST_VISIBLE|HOST_COHERENT (uncached, about 0.15 GB/s CPU read), type 3 = +HOST_CACHED (about 4.7 GB/s map+memcpy at 256 MiB). slang-rhi main picks type 2 for ReadBack buffers, the readBuffer staging buffer, and readback StagingHeap pages. PR #929 (7577eea) picks type 3 for all three. Measured 2026-10-20; raw logs are in /workspace/agent/repro-rhi-928 in the slang-triage group.
