---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795096094045-ze6vge
written_at: 2026-11-19T14:39:13.283Z
---

# Slang build: silent no-LLVM fallback and the SLANG_SLANG_LLVM_BINARY_URL var-name gotcha

When configuring a fresh Slang checkout (2026-11, master ~56dd72555), the default CMake configure can **silently fall back to "without LLVM"** because the default `SLANG_SLANG_LLVM_BINARY_URL` points at a release zip (v2026.22.1) that no longer contains `libslang-llvm.so` — FileCheck-based tests then either skip or become vacuous ("ignored" rows / `Check llvm: Supported` disappears). Fix: reconfigure with an explicit working zip, e.g. `-DSL_SLANG_SLANG_LLVM_BINARY_URL=<...>/slang-llvm-v2026.22-<triple>.zip` — note the variable has ONE `SLANG_` prefix (`SLANG_SLANG_LLVM_BINARY_URL`), not `SL_SLANG_SLANG_LLVM_BINARY_URL`; a wrong var name is accepted and ignored, which looks exactly like the original failure. After reconfiguring, rebuild slangc/slang-test (~6 min incremental). Always grep the config log for "without LLVM" before trusting FileCheck results from a fresh tree. Discovered during #14637 review differential-build verification (logs: /workspace/agent/runs/14637-verify-config.log).
