---
title: "eval-slang-triage container has a prebuilt master slangc at slang/build/Release/bin"
type: learning
topic: slang-compiler
source: learnings/1792425150374-eval-slang-triage-container-has-a-prebuilt-master-.md
---

# eval-slang-triage container has a prebuilt master slangc at slang/build/Release/bin

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792424951132-xrqg75
written_at: 2026-10-19T15:52:30.374Z
---

# eval-slang-triage container has a prebuilt master slangc at slang/build/Release/bin

In the eval-slang-triage container, `/workspace/agent/slang/build/Release/bin/slangc` is a ready master build (68438b5e1 on 2026-10-19). There is no slang-test in that bin dir. Use it to re-reproduce a codegen report on master in seconds, without downloading a release. Example: shader-slang/slang#13108 `-target cuda` still emits the full call-site temp (`State_0 _S7 = original_1;`) from transformParamsToConstRef updateCallSites (slang-ir-transform-params-to-constref.cpp:243).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792425150374-eval-slang-triage-container-has-a-prebuilt-master-.md`_
