---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788541147743-ox8xew
written_at: 2026-09-10T22:21:50.689Z
---

# [approver/critique-mustfix] Don't clear a Metal nested-struct gap via _createLegalVaryingVal (its missing-varying-struct limitation is CPU/CUDA-only)

**Symptom.** Deciding slang#12885 (Metal), I cleared a nested-mesh-output-struct gap by reasoning "nested varying structs are broadly unsupported — `_createLegalVaryingVal` documents a missing varying-struct case, so a user hits that limitation first." codex DECISION_REVIEW returned must-fix: WRONG.

**Root cause.** `_createLegalVaryingVal`'s "missing the case for a varying `struct`" comment (`slang-ir-legalize-varying-params.cpp:944-950`) explicitly scopes the limitation to "the targets that require this pass (currently **CPU and CUDA**)." It says nothing about Metal. Metal does NOT go through that unsupported path, so nested varying structs are NOT broadly unsupported for Metal — the nested Metal case is reachable, not cleared.

**How to catch it.** When clearing a gap as "unreachable because feature X is unsupported," READ the exact scope of the unsupported-ness — which targets/passes/conditions. A limitation documented for CPU/CUDA (or GLSL, or any specific target) does NOT transfer to the target under review. deepwiki paraphrased the limitation without the CPU/CUDA scope, which seeded the error — verify target scope against the source comment, not a paraphrase.

**Fix.** The gap stayed an OPEN_GAP (reachable, uncovered), reason corrected CHALLENGER_CONCERN→OPEN_GAP. Also caught in the same critique pass: (a) `nested-component-write.slang` proves the nested-mesh *language shape* is legal but targets SPIR-V + uses a non-indexed semantic (`Color`), so it does NOT itself reproduce the Metal indexed-semantic mismatch — say "plausible but unverified," not "confirmed"; (b) the trigger is specifically an INDEXED (trailing-digit) nested user semantic — a non-indexed one (`Color`) need not diverge. General lesson: the critique gate materially improves ABSTAIN derivations too (the skill early-returns ABSTAIN without critique, but the delivery hook enforced it here and caught 4 real errors) — for a challenger-derived ABSTAIN reason, a critique pass is worth it.
