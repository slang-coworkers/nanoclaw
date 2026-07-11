---
name: project_12002_opname_asm_register_leak
description: "#12002 [SPIR-V] OpName wrong result ID — premise REFUTED (coincidental name), Approach A draft PR #12053, Approach B maintainer-scope"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2ff152fe-7695-4aa3-a6e2-d2c62b8054ea
---

shader-slang/slang#12002 — reporter maxime-modulopi, "[SPIR-V] OpName not applied to the right result ID". Slang v2026.12.2, Windows 11.

**Reporter's premise REFUTED (not a name-misattribution bug).** He saw `OpName "sampled"` on the callee's `OpImageSampleExplicitLod` temp (`%7`) and expected it on the `OpFunctionCall` result (`%49`) in `main` matching his local `float sampled = ...`. Triager's rename discriminator (verified @33f9ed0ce/@33f9, -O0): renaming the user var `sampled`→`myResult` left the callee `OpName "sampled"` **unchanged**, and the user's name emitted **no OpName at all**. Debug-info side (DebugLocalVariable/DebugValue) is correctly attached to the call in main. The name match was **coincidence**.

**Real (cosmetic/debuggability-only) defect:** `slang-emit-spirv.cpp:11591-11592` emits an `OpName` for *every* named register in a `spirv_asm` block, unconditionally (not gated on debug level). `hlsl.meta.slang` names its raw-sample register `%sampled` at ~20 sites → every texture sample leaks `OpName "sampled"`. OpName is non-semantic, so no miscompile.

**Approaches:** A = rename internal spirv_asm register `%sampled`→`%__sampled` in hlsl.meta.slang (reporter himself endorsed the `__`-prefix convention, comment 4916630587). B = emitter stops leaking every asm-register name / gate on debug level — principled root fix but a **documented/tested feature**, so maintainer-scope. C = explain-only.

**Chosen: A.** Draft PR **#12053** (head `fix/issue-12002` @d8d9f75789, base master, author nv-slang-bot, `Closes #12002`). Fixer-reported tests: repro regression 1/1, spirv-asm 21/21, tests/spirv/ 502/502 green (not independently re-run by Main); benign priority-yield CI red. Approach B flagged to maintainers in PR body, scope left to them.

**State (as of 2026-07-10):** DRAFT-held pending review/approval. Peer review dispatched by fixer, no verdict yet. **ready-flip + merge are operator/maintainer-gated.** Issue footprint updated in place (comment 4916648982) pointing to the PR. Chain driven by slang-triager (owns GitHub edge + fixer peer-wire); Main routes through triager, does NOT double-dispatch fixer. See [[feedback_verify_report_pr_created]], [[feedback_verify_regression_claims_at_precision]], [[feedback_drafts_only_guardrail]].

**MAINTAINER APPROVED + FLIPPED READY 2026-07-10 22:37Z (Main-verified at HEAD — NO breach).** jkwak-work flipped #12053 ready-for-review himself at 22:37:15Z AND APPROVED ("Looks good to me") at 22:37 → reviewDecision=**APPROVED**, non-draft, MERGEABLE, mergeState=**BLOCKED** (required `pull_request` checks still running — NOT a failure; format/label/actionlint/CLA/REUSE green, builds+tests queued). **NOT a drafts-only breach** — MAINTAINER flipped it (timeline actor=jkwak-work), bot did not self-flip/merge ([[feedback_drafts_only_guardrail]]); fixer correctly held + surfaced. So Approach A (rename `%sampled`→`%__sampled`) is maintainer-accepted; peer slang-reviewer verdict now moot given maintainer APPROVE. **No operator ready-flip decision pending** (maintainer already flipped); merge is jkwak's to take once CI green (bot does NOT merge — operator/maintainer-gated). Same clean pattern as #12055/#11984 same day. Next terminal = jkwak merges (→ reap worktree) or a re-review comment. Webhook-driven.
