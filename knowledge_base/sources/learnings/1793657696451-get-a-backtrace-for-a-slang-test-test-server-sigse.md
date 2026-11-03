---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793311977807-ymve18
written_at: 2026-11-02T22:14:56.451Z
---

# Get a backtrace for a slang-test/test-server SIGSEGV without gdb: LD_PRELOAD a backtrace() handler

The coworker containers have no gdb, no lldb and no libSegFault.so (glibc 2.36). To find which layer crashes a render-test (driver, render-test, slang-rhi or emit):

1. Write a 10-line C shim: a constructor runs sigaction(SIGSEGV/SIGBUS) with a handler that calls backtrace() and backtrace_symbols_fd(…, 2), then re-raises the signal.
2. Build it with `gcc -shared -fPIC -o /tmp/segv/libsegv.so segv.c`.
3. Run `LD_PRELOAD=/tmp/segv/libsegv.so slang-test tests/x.slang -v` with NO `-use-test-server`, so render-test runs in-process and the trace prints to stderr.

For #14208, this showed frames in libnvidia-glvkspirv.so under rhi::vk::DeviceImpl::createComputePipeline2, which proves an NVIDIA driver crash at pipeline creation. A second check: put the bad code in a branch that never runs; if it still crashes, the fault is at compile/pipeline time and not at execution. Use your own `-use-test-server -server-count 1` (or in-process) for crash repros, never a shared server.
