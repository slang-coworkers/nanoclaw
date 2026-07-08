---
name: project_9085_glsl_samplecmp_takeover
description: "#9085 GLSL SampleCmpBias/Grad — Copilot draft takeover COMPLETE, held draft, awaiting maintainer ready/merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: d121aed2-2953-4ba3-81f4-b3f8111b7852
---

PR #9085 "Add GLSL support for SampleCmpBias and SampleCmpGrad" (Fixes #9038). Copilot-authored draft on same-repo branch `copilot/add-glsl-samplecmp-support`. Maintainer @jhelferty-nv asked nv-slang-bot to take it over (2026-07-07 webhook, comment 4909016932) — rebase + **finish** the issue, not just resolve conflicts.

slang-fixer drove it end-to-end on thread `gh-issue-shader-slang/slang-9085`: rebased onto master, all 7 maintainer items met, pushed, **held DRAFT** (not flipped ready — gate intact). Full 5-part write-up + test table lives in the PR description (durable artifact; ack comment PATCH-edit 403'd, description supersedes). Label corrected `pr: breaking change` → `pr: non-breaking`.

**Root technical fix:** Copilot draft leaked `GL_EXT_texture_shadow_lod` onto baseline shadow forms (E36104). Fixer redefined the `texture_shadowgrad` capability atom extension-free (`_sm_6_8 | _GLSL_150 | spirv_1_0`) and split master's merged `textureOffset(sampler2DShadow,…,bias=0.0)` overload, confining the ext to genuine 2DArray/CubeArray bias forms only — mirrors #11156's split. Core module compiled clean (no E36104); sample-cmp.slang 3/3 (CHECK_GLSL now live), no-ext regression 1/1, #11156 guard 1/1, texture sweep 19/19. codex CODE_REVIEW + OUTPUT_REVIEW approve.

**State:** terminal-pending. CI run 28907294856 is cosmetic priority-yield only (draft manual-dispatch — builds skipped, expected). Real signal + `check-capability-atoms-ref` validation arrives when a maintainer readies or aging force-runs it. **Next action is human** (jkwak/jhelferty review→ready→merge). ready-flip + merge are operator-gated — do NOT flip. Re-engage on fresh webhook (maintainer comment / ready-flip / CI on real run). See [[feedback_drafts_only_guardrail]], [[feedback_github_writes_operator_authorized]].
