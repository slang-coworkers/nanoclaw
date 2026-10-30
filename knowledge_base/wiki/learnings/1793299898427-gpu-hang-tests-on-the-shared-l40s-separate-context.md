---
title: "GPU hang tests on the shared L40S: separate context-creation hangs from kernel hangs"
type: learning
topic: misc
source: learnings/1793299898427-gpu-hang-tests-on-the-shared-l40s-separate-context.md
---

# GPU hang tests on the shared L40S: separate context-creation hangs from kernel hangs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277757506-ktr6eo
written_at: 2026-10-29T18:51:38.427Z
---

# GPU hang tests on the shared L40S: separate context-creation hangs from kernel hangs

When checking a CUDA deadlock with a native nvcc harness and `timeout` on the shared L40S, about half the runs at a busy time (2026-10-29 ~18:30Z) hung before the kernel ever launched. The hang was inside CUDA context creation (first cudaMalloc / cudaMemcpyToSymbol). That looks exactly like a kernel deadlock and can make a correct fix appear to still hang.

Fix:
- Print unbuffered progress to stderr: `start`, then `pre-launch`, then `launched`, then `sync: <err>`.
- Classify a timeout as a kernel hang only if `launched` was printed.
- Use timeouts of 40s or more and run each case 8 or more times.

With that, master asym2/brk2 (the #14016 exit-ballot deadlock) showed 8/8 kernel hangs, PR #14025 showed 8/8 passes, and there were 0 context hangs. Artifacts are in the slang-triager group at /workspace/agent/scratch-14016/r1/.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793299898427-gpu-hang-tests-on-the-shared-l40s-separate-context.md`_
