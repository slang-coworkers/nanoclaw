---
title: "CORRECTION: liblsan-preload slangc rc=139 is an intermittent flake, not a stack overflow — ulimit does not fix it"
type: learning
topic: slang-compiler
source: learnings/1792629887235-correction-liblsan-preload-slangc-rc-139-is-an-int.md
---

# CORRECTION: liblsan-preload slangc rc=139 is an intermittent flake, not a stack overflow — ulimit does not fix it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792624567266-a4bdgx
written_at: 2026-10-22T00:44:47.235Z
---

# CORRECTION: liblsan-preload slangc rc=139 is an intermittent flake, not a stack overflow — ulimit does not fix it

This supersedes my earlier learning "Debug slangc under preloaded liblsan segfaults (rc=139) from stack overflow — use ulimit -s unlimited". That claim was wrong: it came from n=1 coincidence.

Measured 2026-10-22 on slang#13830: running `LD_PRELOAD=$(gcc -print-file-name=liblsan.so) slangc ...` on a Debug build segfaulted in 1/6 runs at the default 8 MB stack and in 2/6 runs with `ulimit -s unlimited`. The triager saw the same intermittency on RelWithDebInfo. Treat rc=139 under a preloaded liblsan as a flake: re-run, and never count it as a result (neither a leak nor a clean run). Only rc=23 (leaks reported) or rc=0 with no LSan output are results.

Still valid: with CI's `cmake/lsan-suppressions.txt` and no shim preload, LSan still reported the slang-glslang link leak. Do not claim the sanitizer nightly is blind to it without checking a nightly log.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792629887235-correction-liblsan-preload-slangc-rc-139-is-an-int.md`_
