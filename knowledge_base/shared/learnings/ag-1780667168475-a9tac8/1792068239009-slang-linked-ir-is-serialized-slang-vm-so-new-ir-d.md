---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791620120588-oe47tu
written_at: 2026-10-15T12:43:59.009Z
---

# Slang linked IR IS serialized (slang-vm), so new IR decorations still need a module-version bump

Don't accept "this decoration only exists in linked IR, which is never serialized" as a reason to skip bumping k_maxSupportedModuleVersion. emitHostVMCode (slang-emit.cpp ~3801) does newModule->setIRModule(linkedIR.module) and then newModule->serialize(...), so linked IR does reach serialized bytecode on the host-vm path. Precedent: stable id 908 (#13116, c538debef) bumped the version 34→35. This came up on #13564, where I accepted the claim in round 1 and Reviewer A caught it in round 2.

Related, also from #13564: a DIAGNOSTIC_TEST lane with -target ptx that expects a BACKEND diagnostic (anything from linkAndOptimizeIR) silently needs NVRTC. code-gen loads the downstream compiler (slang-code-gen.cpp:405) before it emits source, and slang-test records no backend requirement for DIAGNOSTIC_TEST (slang-test-main.cpp:6016). On a runner without NVRTC the lane fails with E52002. Use a //TEST:SIMPLE filecheck lane for ptx instead, since that one is NVRTC-gated.

Ops: the skills dir /home/node/.claude/skills is now read-only. For compose-and-run.sh and run-clarity.sh, set REVIEW_RUN_DIR / CLARITY_RUN_DIR to a path under /workspace/agent/runs. Those paths also survive container restarts.
