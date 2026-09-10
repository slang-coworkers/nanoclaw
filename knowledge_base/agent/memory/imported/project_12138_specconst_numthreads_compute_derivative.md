---
name: 12138-specconst-numthreads-compute-derivative
description: "#12138 spec-const [numthreads] + compute derivative — shadow ABSTAIN_POLICY"
metadata: 
  node_type: memory
  type: project
  originSessionId: 39bdf69f-9319-42b7-8dc1-c472afa54de1
---

**TERMINAL 07-23: CLOSED-UNMERGED** by jkwak-work (maintainer) after team-meeting design decision. R2 ABSTAIN_POLICY (OPEN_GAP) @9f5ce276 is operative row; join recorded `human_verdict=CHANGES_REQUESTED`. Maintainers rejected on **design grounds** (NOT the flagged gaps): "it is desired behavior to print an error on the default value even when variables might be overridden at runtime"; prescribed fix = *user* changes spec-const default (1→2), not relax the compiler check. ABSTAIN was directionally correct (withheld → agreement, not false-safe) but withheld for the *wrong reason* (unrun CI + test-annotation gap); the real kill was a design judgment — challenger wrongly treated "matches GLSL/shaderc" as establishing correctness. Had CI been green, that read risked a WOULD_APPROVE false-safe. LEARNING: a diagnostic *relaxation* is a language-design call maintainers own — cross-toolchain precedent supports technical feasibility, not desired Slang behavior.

**#12138** (shader-slang/slang, author LDeakin, external fork) — "fix: Allow specialization-constant [numthreads] with compute derivative".

Shadow approval verdict **ABSTAIN_POLICY (OPEN_GAP)** @9f5ce276d0bf, mode=live, policy v0-shadow-relaxed, ledger-only (no GitHub write). First pin 706d2686 superseded mid-flight by 2 test-only follow-up commits — no row for 706d2686.

**Compiler code is correct + regression-safe** (verified at head): `verifyComputeDerivativeGroupModifiers` byte-identical across revisions — only diagnoses literal `[numthreads]` axes, defers spec-const axes to Vulkan pipeline-creation validation, matching GLSL/shaderc. PRIMARY 0🔴/3🟡 APPROVE_WITH_NITS + Devin 0 bugs/0 flags.

**Why HELD not WOULD_APPROVE:** (a) full build/test matrix maintainer-gated (10 GH-Actions suites action_required/runs=0, external fork) → new multi-target test has zero CI pass/fail signal + no local build at head; (b) test-quality gap — negative case's `// CHECK_ERR:` line annotations (space after `//`) silently ignored by diag parser, so odd-X assertion rests only on `/*CHECK_ERR:` block comment.

**Next-action:** human maintainer approves/runs CI on fork PR to confirm new test passes (optionally have author drop the space in `// CHECK_ERR:` lines), then merges. Code is not a blocker. Withhold-on-SAFE class (#12064/#12037/#12041); NOT false-safe class (#12130/#12122/#12136).

**07-17 spurious `synchronize` ×2:** webhook fired `pr_ready_for_review/synchronize` twice but head did NOT move — still 9f5ce276 (last push 07-16 16:54Z). The `updated_at` bump was a human issue comment, not a push. Design exchange corroborates the fix: jkwak-work asked "isn't `[numthreads(1,1,1)]`+`DerivativeGroupQuad` an error?"; LDeakin: "yes, but it's wrongly rejected at *compile* time not *pipeline-creation* time — those spec consts can be overridden." Approver verified live head, refused duplicate row (one-decision-per-revision), R2 ABSTAIN stands. LEARNING: `synchronize` webhooks can fire on comment-driven `updated_at` bumps, not real pushes — approver correctly guards by verifying live head/check-runs before re-running.
