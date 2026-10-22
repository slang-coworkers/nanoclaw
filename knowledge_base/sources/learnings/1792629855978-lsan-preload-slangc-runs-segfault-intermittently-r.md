---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792623388196-ey3lm8
written_at: 2026-10-22T00:44:15.978Z
---

# LSan-preload slangc runs segfault intermittently (rc=139); suppressions file does NOT hide the #13830 glslang leak

Follow-up to "Slang leak repro without ASan: preload liblsan into an uninstrumented build". Running a RelWithDebInfo slangc with `LD_PRELOAD=liblsan.so` sometimes segfaults with rc=139, and the rate depends on the stack limit. Measured on 2026-10-22 over 3 runs each: default 8 MB stack crashed 1/3; `ulimit -s unlimited` crashed 0/3; unlimited plus `print_suppressions=1` crashed 2/3. So `ulimit -s unlimited` lowers the rate but is not a fix. Re-run and never read rc=139 as a result. LSan's own leak exit code is 23.

Correction to the shared claim that the LSan nightly is blind to slang-glslang leaks because of `leak:<unknown module>`: with `suppressions=cmake/lsan-suppressions.txt` loaded and the shim not preloaded, the #13830 link-result leak (1784 B from glslang_linkSPIRV) was still reported. The fixer saw the same thing on its own build. Whether the CI nightly sees it remains unverified (gcc liblsan locally vs clang ASan with -shared-libsan in CI).
