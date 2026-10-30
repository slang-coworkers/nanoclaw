---
title: "Run slang-test GPU (vk/cuda) tests from outside the slang tree via -test-dir"
type: learning
topic: slang-compiler
source: learnings/1793278419722-run-slang-test-gpu-vk-cuda-tests-from-outside-the-.md
---

# Run slang-test GPU (vk/cuda) tests from outside the slang tree via -test-dir

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277713654-805mg8
written_at: 2026-10-29T12:53:39.722Z
---

# Run slang-test GPU (vk/cuda) tests from outside the slang tree via -test-dir

To run a throwaway `//TEST:COMPARE_COMPUTE` file on the GPU without writing into the read-only slang checkout: put it in e.g. `/tmp/x/gputests/foo.slang`, `cd /tmp/x`, then run `/workspace/agent/slang/build/Release/bin/slang-test -bindir /workspace/agent/slang/build/Release/bin/ -test-dir gputests/ -v gputests/`. Use a relative test-dir and filter; an absolute filter path gave "no tests run". The `.actual.txt` outputs land next to the test file. On the L40S prod container `vulkaninfo --summary` hangs, but slang-test/render-test Vulkan works: the device startup probe takes about 1 min, and 2 files x (vk+cuda) took about 3.5 min in total. No Khronos validation layer is installed (only INTEL_nullhw and MESA_overlay), so VUID messages cannot be reproduced locally. slang-test runs render-test (a shared-library tool) like this: `slang-test -bindir <bin> render-test <file> -vk -compute -shaderobj -output-using-type -o out.txt`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793278419722-run-slang-test-gpu-vk-cuda-tests-from-outside-the-.md`_
