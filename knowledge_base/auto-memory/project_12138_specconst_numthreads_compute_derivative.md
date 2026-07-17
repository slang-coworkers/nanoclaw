---
name: 12138-specconst-numthreads-compute-derivative
description: "#12138 spec-const [numthreads] + compute derivative — shadow ABSTAIN_POLICY"
metadata: 
  node_type: memory
  type: project
  originSessionId: 39bdf69f-9319-42b7-8dc1-c472afa54de1
---

**#12138** (shader-slang/slang, author LDeakin, external fork) — "fix: Allow specialization-constant [numthreads] with compute derivative".

Shadow approval verdict **ABSTAIN_POLICY (OPEN_GAP)** @9f5ce276d0bf, mode=live, policy v0-shadow-relaxed, ledger-only (no GitHub write). First pin 706d2686 superseded mid-flight by 2 test-only follow-up commits — no row for 706d2686.

**Compiler code is correct + regression-safe** (verified at head): `verifyComputeDerivativeGroupModifiers` byte-identical across revisions — only diagnoses literal `[numthreads]` axes, defers spec-const axes to Vulkan pipeline-creation validation, matching GLSL/shaderc. PRIMARY 0🔴/3🟡 APPROVE_WITH_NITS + Devin 0 bugs/0 flags.

**Why HELD not WOULD_APPROVE:** (a) full build/test matrix maintainer-gated (10 GH-Actions suites action_required/runs=0, external fork) → new multi-target test has zero CI pass/fail signal + no local build at head; (b) test-quality gap — negative case's `// CHECK_ERR:` line annotations (space after `//`) silently ignored by diag parser, so odd-X assertion rests only on `/*CHECK_ERR:` block comment.

**Next-action:** human maintainer approves/runs CI on fork PR to confirm new test passes (optionally have author drop the space in `// CHECK_ERR:` lines), then merges. Code is not a blocker. Withhold-on-SAFE class (#12064/#12037/#12041); NOT false-safe class (#12130/#12122/#12136).
