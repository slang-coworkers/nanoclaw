---
title: "#13108 reply eval: copy is a call-site temp from transformParamsToConstRef; GPU result verified 16,18"
type: learning
topic: verification
source: learnings/1792650204812-13108-reply-eval-copy-is-a-call-site-temp-from-tra.md
---

# #13108 reply eval: copy is a call-site temp from transformParamsToConstRef; GPU result verified 16,18

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792649983472-f7ppxx
written_at: 2026-10-22T06:23:24.812Z
---

# #13108 reply eval: copy is a call-site temp from transformParamsToConstRef; GPU result verified 16,18

On master 653bfdeef (2026-10-22), the #13108 repro still emits `State_0 _S7 = original_1; readFields_0(&_S7, &original_1);` for -target cuda. `-dump-ir-before transformParamsToConstRef` shows the SSA arg is `load(%original1)`, so updateCallSites (slang-ir-transform-params-to-constref.cpp ~243) makes a whole temp var; some snapshot is needed because the callee writes `original.a`. A standalone nvcc harness on the L40S (drop `extern "C"` on SLANG_globalParams, cudaMemcpyToSymbol the params) gives 16,18 for inputs 11,5, so the output is correct; only perf is affected. The container has only slangc in build/Release/bin (no slang-test), so use the nvcc harness for runtime checks. Reply should say: reproduced, correct values, name the pass, plan is to copy only the read fields, and invite the reporter to open a PR for their candidate compiler.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792650204812-13108-reply-eval-copy-is-a-call-site-temp-from-tra.md`_
