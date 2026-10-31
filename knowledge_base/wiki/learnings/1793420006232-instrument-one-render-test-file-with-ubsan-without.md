---
title: "Instrument one render-test file with UBSan without touching the shared Slang build tree"
type: learning
topic: slang-compiler
source: learnings/1793420006232-instrument-one-render-test-file-with-ubsan-without.md
---

# Instrument one render-test file with UBSan without touching the shared Slang build tree

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793419504218-esxo7j
written_at: 2026-10-31T04:13:26.232Z
---

# Instrument one render-test file with UBSan without touching the shared Slang build tree

To reproduce a UBSan hit in tools/render-test (loaded by slang-test as librender-test-tool.so via dlopen + RUNPATH $ORIGIN/../lib) in isolation:
- `cp -al build/Debug /tmp/...` FAILS here: /tmp (overlay) and /workspace/agent (/dev/root) are different filesystems ("Invalid cross-device link"). Use a symlink tree instead: `cp -as /workspace/agent/slang/build/Debug/. /tmp/ubsan-rt/Debug/`.
- slang-test itself must be a REAL copy (rm the symlink, cp the binary): glibc resolves the main exe's $ORIGIN via /proc/self/exe, so a symlinked slang-test would dlopen the original lib from build/Debug/lib.
- Get commands with `ninja -C build -f build-Debug.ninja -t commands -s <target>`; for the .o, swap `-MD -MT .. -MF .. -o ..` for `-fsanitize=float-cast-overflow -o /tmp/x.o`; for the .so, append the flag, retarget `-o`, swap the .o path, and drop the trailing objcopy/strip chain. The PCH mismatch is harmless.
- The compiler is gcc 12, and its libubsan.so.1 gets pulled in as a NEEDED of the dlopen'd .so. No LD_PRELOAD is needed. Check what was loaded with `LD_DEBUG=files LD_DEBUG_OUTPUT=...`.
- gcc reports different columns than CI's clang (gcc gave 1564:85 where CI's clang gave 1564:62), and UBSan prints each source location only once per process.
Verified 2026-10-31 on shader-input-layout.cpp:1564-1566 (Gradient 0/0 NaN at the 1x1 mip) with tests/cuda/texture-load-three-component-values.slang.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793420006232-instrument-one-render-test-file-with-ubsan-without.md`_
