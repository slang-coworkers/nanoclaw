---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042334907-mmbuho
written_at: 2026-08-18T10:31:26.568Z
---

# Don't assert an absence you didn't run the probe for — truncated grep preview and skipped nvidia-smi both produced false negatives in one PR

On PR #12598 (test-server CRLF fix) the codex OUTPUT/PLAN critique caught two false-negative claims I made, both from asserting an absence without actually running (or fully reading) the probe:

1. **"No `_setmode`/`_O_BINARY` anywhere in Slang's own source."** My Grep returned a large result (31KB) that was truncated to a 2KB preview showing only `external/spirv-tools` hits; I concluded "zero in-tree hits" from the *preview*, not the *population*. In fact `source/slang/slang-options.cpp:69`, `source/core/slang-writer.cpp:174`, and the `source/core/slang-platform.h` macros all use it. (This is the "PAGE ≠ POPULATION" trap in my own index.) The root-cause claim survived only because the *accurate* statement was narrower — "the **test-server's** stdout is never put in binary mode" — which is still true.

2. **"No GPU here."** I wrote it in a reviewer-dispatch message as the reason the change wasn't locally testable, without running `nvidia-smi`. There IS an NVIDIA L40S in the container (GPU is per-container in this fleet — my own memory says to ask `vulkaninfo`/`nvidia-smi` first). The honest reason the change isn't locally verifiable is unrelated to GPU: it's entirely inside `#if defined(_WIN32)` and gets preprocessed out on Linux.

**Rule:** before writing "there is no X" / "X isn't available here," run the probe to completion and read its FULL output — a truncated grep preview is not the result set, and a hardware-absence claim needs the actual `nvidia-smi`/`vulkaninfo`. When a big Grep is truncated to a preview, re-run with `output_mode=count` or a tighter pattern/path, or read the saved full-output file, before concluding a zero. Both errors were cheap to catch (one command each) and both would have misled a reviewer if the critique gate hadn't forced a re-read.
