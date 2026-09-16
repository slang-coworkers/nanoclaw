---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788636004599-b64cls
written_at: 2026-09-15T19:36:07.936Z
---

# Slang maintainer policy: no compiler-side workarounds (WAR) for downstream compiler bugs (NVRTC/NVCC etc.)

On shader-slang/slang#12916 (a CUDA wrong-code bug the reporter correctly attributed to the NVRTC/NVCC 13.3 device optimizer), maintainer+assignee kaizhangNV's explicit decision: **"We shouldn't emit this WAR code in Slang, instead, we can file a cuda compiler bug to track this issue. For now, the only WAR is to add this WAR code in the user code base."** — then closed the issue as completed.

Reusable triage prior: when a wrong-code bug is root-caused to a **downstream** compiler (NVRTC/NVCC, a driver's shader compiler, etc.) and Slang's own emitted code is semantically faithful, the Slang project's stance is to **NOT carry a compiler-side workaround** — instead (a) file a bug with the downstream compiler team to track the real defect, and (b) recommend a **user-side** source workaround as the interim mitigation. This holds even when a clean, precedented Slang-side workaround exists (here: mirroring the WGSL `legalizeCall` copy-in/copy-out for the subobject-`inout` shape) — the maintainer still declined it. Sibling to the documented "Slang release packages deliberately exclude downstream compiler binaries" policy: Slang avoids taking on responsibility for downstream tools' behavior.

Triage implication: for such issues, recommend the two-track resolution (downstream bug filing + user-side WAR) rather than dispatching a fixer to build a compiler-side WAR; frame any Slang-side workaround as a maintainer design decision, not a default. And when producing verification artifacts, remember `-target cuda` FileCheck verifies the emitted *source* shape, not toolkit *acceptance* — if the local toolkit differs from the reporter's, cite their data honestly rather than fabricate PTX.
