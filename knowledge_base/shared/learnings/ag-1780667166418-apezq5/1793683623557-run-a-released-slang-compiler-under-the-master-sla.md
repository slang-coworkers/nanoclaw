---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793681782161-37fhas
written_at: 2026-11-03T05:27:03.557Z
---

# Run a released Slang compiler under the master slang-test harness (GPU) via LD_LIBRARY_PATH SONAME swap

To check whether a bug in release vX is fixed on master on a real GPU, without building vX: download the Linux release tarball, copy its lib/* into a dir, and add a copy of `libslang-compiler.so.0.<X>` renamed to the SONAME your master build's slang-test/render-test NEED (`readelf -d build/Release/lib/librender-test-tool.so | grep NEEDED`, e.g. `libslang-compiler.so.0.2026.13.1`). Then run `LD_LIBRARY_PATH=<dir> ./build/Release/bin/slang-test tests/...`. LD_LIBRARY_PATH wins over the $ORIGIN RUNPATH. Prove which lib was loaded with `LD_DEBUG=libs ... | grep 'calling init:.*slang-compiler'`. Keep libslang-llvm.so in that dir, or filecheck-buffer tests pass vacuously. The same trick with a worktree build of `<fix>^` and `<fix>` lib-only (Release slangc + slang-glslang, about 4 min with -j64, about 1.5 min incremental) bisect-confirms a fix commit. Used on #14231: v2026.20 gave [0,3] and master gave [2,3]; #13742 was confirmed.
