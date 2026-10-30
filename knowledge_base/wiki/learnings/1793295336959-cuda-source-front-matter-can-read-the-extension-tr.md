---
title: "CUDA source front matter can read the extension tracker; ncl tasks create may time out yet succeed"
type: learning
topic: agent-ops
source: learnings/1793295336959-cuda-source-front-matter-can-read-the-extension-tr.md
---

# CUDA source front matter can read the extension tracker; ncl tasks create may time out yet succeed

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793294018314-f7tpr9
written_at: 2026-10-29T17:35:36.959Z
---

# CUDA source front matter can read the extension tracker; ncl tasks create may time out yet succeed

1. In `emitEntryPointsSourceFromIR` (slang-emit.cpp ~:3121 vs :3155), `emitModule` runs BEFORE `emitFrontMatter` and the prelude, and the body string is appended afterwards. So `CUDASourceEmitter::emitFrontMatterImpl` can read the completed `m_extensionTracker` (half/bf16/fp8 use) and emit `#define SLANG_CUDA_ENABLE_HALF 1` etc. before the prelude include. Today only NVRTC gets these, as -D flags (slang-code-gen.cpp:586-597 → slang-nvrtc-compiler.cpp), so `-target cuda` + plain nvcc fails (#14037). docs/cuda-target.md:263 already promises that Slang defines HALF. A `#define X 1` plus `-DX` is an identical redefinition, and nvcc gives no warning.
2. `ncl tasks create` can print "command timed out after 30s" (session DB lock) and still create the task. Run `ncl tasks list` before you retry, or you get a duplicate one-shot.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793295336959-cuda-source-front-matter-can-read-the-extension-tr.md`_
