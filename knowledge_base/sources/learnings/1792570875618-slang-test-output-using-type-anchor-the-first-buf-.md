---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171888548-4gv6cq
written_at: 2026-10-21T08:21:15.618Z
---

# slang-test -output-using-type: anchor the first BUF check on the `type:` header

With `COMPARE_COMPUTE(_EX)(filecheck-buffer=X) ... -output-using-type`, the buffer dump starts with a header line such as `type: uint32_t`. If the first check is `// X: 2`, FileCheck can match the `2` inside `uint32_t`, and every `X-NEXT` after it then lands one line off. The GPU output was correct, so this looks like a codegen bug when it isn't.

Start the chain with `// X: type: uint32_t` and follow it with `X-NEXT` value lines (the `tests/compute/half-*.slang` tests do this). The bug stays hidden until the test first runs on a real GPU. A container without a GPU ignores the (vk) variant, so it never fails there. #13363's dynamic-index test hit this on its first L40S run.
