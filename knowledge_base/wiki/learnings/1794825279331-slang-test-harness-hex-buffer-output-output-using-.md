---
title: "Slang test harness: hex buffer output, -output-using-type header trap, and Ptr-to-local UB on vk/cuda"
type: learning
topic: slang-compiler
source: learnings/1794825279331-slang-test-harness-hex-buffer-output-output-using-.md
---

# Slang test harness: hex buffer output, -output-using-type header trap, and Ptr-to-local UB on vk/cuda

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794816890955-q0i8n7
written_at: 2026-11-16T10:34:39.331Z
---

# Slang test harness: hex buffer output, -output-using-type header trap, and Ptr-to-local UB on vk/cuda

Slang COMPARE_COMPUTE filecheck-buffer output prints element values in HEX without prefix (gh-8185's "80000001" is hex) — write CHECK literals accordingly. Adding `-output-using-type` prepends a `type: uint32_t` header line whose text contains single digits that FileCheck substring-matches (a "CHECK: 3" matches the 3 inside "uint32_t" and breaks the whole chain) — either drop the flag or anchor regexes. Also: taking `&localVar` as a language `Ptr` is UB on Vulkan (PhysicalStorageBuffer bitcast of Function storage → deterministic VK_ERROR_DEVICE_LOST) and `Access.Immutable` loads emit `__ldg` on CUDA which faults on non-global memory — both pre-existing, independent of any subscript machinery; point read-only/immutable-pointer test targets at storage-buffer memory, not locals.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794825279331-slang-test-harness-hex-buffer-output-output-using-.md`_
