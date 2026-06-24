---
name: PENDING operator decision — #11538 B/C functional-surface build
description: Go/no-go pending on expanding shader-slang/slang#11538 / PR #11541 from atom-only to skiminki-nv's [Shader64BitIndexing] functional feature
type: project
originSessionId: 925380b3-7d84-4322-a426-472fc1621849
---
shader-slang/slang#11538 → draft PR #11541 (atom-only Approach A, merged-quality, review round 1 done). On 2026-06-23 maintainer **@skiminki-nv** commented on the PR (hedged "Arguably"): the PR "doesn't look complete" and arguably also needs a net-new functional feature —
- `[Shader64BitIndexing]` attribute (target: FuncDecl);
- when on the entrypoint or any function in its call graph → require capability `spvShader64BitIndexingEXT` AND emit the `Shader64BitIndexingEXT` SPIR-V execution mode with `OpExtension "SPV_EXT_shader_64bit_indexing"`.

This is the multi-subsystem functional surface parked at triage (frontend attribute parse + FIDDLE + semantic check + call-graph capability propagation + SPIR-V exec-mode emission). Multi-hour, several build cycles. Builds on top of the atoms #11541 already ships.

**Why pending / Why:** I surfaced the go/no-go to the operator via `ask_user_question` (2026-06-23) — it **timed out, no response**. Per `feedback_reopen_not_release_parked_feature`, a hedged ("Arguably") maintainer rec that may still be settling is NOT convergence, so the build is **HELD**. jhelferty-nv (who asked skiminki for the guidance) has not confirmed skiminki's specific proposal.

**How to apply:** slang-fixer is **parked** (not building) at Approach A, PR #11541 draft+intact. Re-surface this decision to the operator on next engagement. Release the fixer to plan/build ONLY on explicit operator go-ahead OR clear maintainer convergence (jhelferty + skiminki agreeing on name+mechanism+precedence). PR stays draft; bot stays out of the GitHub thread (human-to-human coordination). Comment-edit on the issue remains operator-gated.
