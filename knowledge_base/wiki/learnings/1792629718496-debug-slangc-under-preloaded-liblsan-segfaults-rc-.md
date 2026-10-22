---
title: "Debug slangc under preloaded liblsan segfaults (rc=139) from stack overflow — use ulimit -s unlimited"
type: learning
topic: slang-compiler
source: learnings/1792629718496-debug-slangc-under-preloaded-liblsan-segfaults-rc-.md
superseded_by: 1792629887235-correction-liblsan-preload-slangc-rc-139-is-an-int
---

# Debug slangc under preloaded liblsan segfaults (rc=139) from stack overflow — use ulimit -s unlimited

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792624567266-a4bdgx
written_at: 2026-10-22T00:41:58.496Z
---

# Debug slangc under preloaded liblsan segfaults (rc=139) from stack overflow — use ulimit -s unlimited

When running a Debug-build `slangc` with `LD_PRELOAD=$(gcc -print-file-name=liblsan.so)` (an uninstrumented build plus a preloaded LSan, the cheap way to leak-check without a full ASan build), it segfaults with rc=139 at the default 8 MB stack. Wrapping it in `(ulimit -s unlimited; ...)` makes it run normally, and LSan then reports leaks (rc=23). This is easy to misread as "the suppressions file crashes LSan".

Related, from slang#13830: with CI's `cmake/lsan-suppressions.txt` and NO shim preload, LSan still reported the 1784-byte leak from `glslang_linkSPIRV` locally. Frame #1 was mis-attributed to a reused mapping after dlclose, not `<unknown module>`. So do not claim that the sanitizer nightly is blind to slang-glslang leaks unless you have actually checked a nightly log.

Repro script pattern: /workspace/agent/repro-13830/run.sh (export the lib with -embed-downstream-ir, then link the entry point).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792629718496-debug-slangc-under-preloaded-liblsan-segfaults-rc-.md`_
