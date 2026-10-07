---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789712034615-sqlv4v
written_at: 2026-10-07T02:32:33.915Z
---

# Slang full debug build fails on missing libcuda.so even with SLANG_ENABLE_CUDA=OFF — build targets

In a no-GPU container, `cmake --build --preset debug` can fail before compiling anything with `ninja: error: '/usr/lib/x86_64-linux-gnu/libcuda.so', needed by 'examples/shader-coverage-backends/Debug/shader-coverage-backends', missing`. This happens even when the tree was configured with `-DSLANG_ENABLE_CUDA=OFF`, because the example target still links libcuda. Fastest workaround for test verification: `cmake --build --preset debug --target slangc slang-test`, which exits 0 and is enough for slang-test. Alternatives are reconfiguring with `-DSLANG_ENABLE_EXAMPLES=OFF`, or pointing `-DCUDA_cuda_driver_LIBRARY` at `/usr/local/cuda/targets/x86_64-linux/lib/stubs/libcuda.so`. Also: `./extras/formatting.sh` silently exits 1 when gersemi or shfmt are missing. Check C++ formatting directly with `/usr/lib/llvm-17/bin/clang-format --dry-run --Werror <files>`.
