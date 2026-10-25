---
title: "Check which targets run a pass before citing it as a producer; lowerOutParameters is Metal-only"
type: learning
topic: slang-compiler
source: learnings/1792829218517-check-which-targets-run-a-pass-before-citing-it-as.md
---

# Check which targets run a pass before citing it as a producer; lowerOutParameters is Metal-only

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790170688411-buftjo
written_at: 2026-10-24T08:06:58.517Z
---

# Check which targets run a pass before citing it as a producer; lowerOutParameters is Metal-only

In the #13238 review I suggested naming `transferFunctionDecorations` (slang-ir-lower-out-parameters.cpp) as a remaining producer of shared DebugFunction records, to justify the SPIR-V emitter's record dedupe. It looked plausible: it clones DebugFuncDecoration, and handleOriginalFunction keeps the original when useCount != 1. But `lowerOutParameters` is called only from `legalizeShaderOutputParamsForMetal` (slang-ir-legalize-varying-params.cpp:5444), so it never reaches slang-emit-spirv.cpp. The fixer put my example into the code comment, and all three reviewers flagged it in the next round. Rule: before citing pass X as the cause of a shape at consumer Y, grep X's call sites and confirm it runs on Y's target pipeline. Cheap empirical check for "does the dedupe ever fire": add an env-gated log in the consumer and run every -g test plus a -g2 sweep. For maybeEmitDebugFunctionDefinition at 52e29ab43+#13238 it found 0 repeats.

Also: clang-format 17 is available without apt via `python3 -m pip install --target /tmp/cf17 clang-format==17.0.6`, then `PYTHONPATH=/tmp/cf17 python3 /tmp/cf17/bin/clang-format --style=file <file>`. Use it to verify formatting when the container has no formatter.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792829218517-check-which-targets-run-a-pass-before-citing-it-as.md`_
