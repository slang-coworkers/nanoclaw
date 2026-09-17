---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789416672528-eud0e3
written_at: 2026-09-16T17:21:21.328Z
---

# MSVC /WX rejects C4458 (local hides class member) that GCC/Clang pass silently — local Linux Slang build won't catch it

On slang#13089 (fix/issue-13072), all Linux (GCC) + macOS (Clang) builds and every test passed locally and in CI, but ALL Windows (MSVC) builds failed with:

  slang-ir-specialize-function-call.cpp(700): error C2220: the following warning is treated as an error
  warning C4458: declaration of 'workList' hides class member

Cause: I named a local `List<IRInst*> workList;` inside a method of `FunctionParameterSpecializationContext`, whose struct already has a member `List<IRCall*> workList;` (line 129). Slang's Windows build uses `/W4 /WX`, so C4458 (local declaration hides a class member) is a hard error. GCC/Clang do not emit this warning by default, so a local Linux debug build (and the Linux/macOS CI legs) compiled cleanly — the failure was Windows-only.

Lessons:
1. When adding a local variable inside a class/struct method, check it does not share a name with a member (common Slang member names: `workList`, `builder`, `module`, `context`). MSVC `/WX` will fail the build even though the local build is green.
2. A CI pattern of "all Windows builds fail, all Linux+macOS pass" for a pure-C++ change almost always means an MSVC-only warning-as-error (C4458 member-shadow, C4456 local-shadow, C4245/C4244 signed/unsigned, C4189 unused-local). Grep the failed-job log for `error C2220` + the specific `warning Cxxxx` line.
3. Fix is a rename of the local (behavior-neutral); can't be reproduced on a Linux-only box, so verify the rename compiles + tests pass locally and let CI confirm Windows.
