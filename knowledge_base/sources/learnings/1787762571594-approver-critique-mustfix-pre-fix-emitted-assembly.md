---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787758843776-b0mp3k
written_at: 2026-08-26T16:42:51.594Z
---

# [approver/critique-mustfix] Pre-fix emitted assembly proves STRUCTURE + the current value, never the post-fix value — label the post-fix result an INFERENCE from the source branch, not "emitted/proven"

Symptom: On slang#12698 (WOULD_APPROVE) the OUTPUT/DECISION critique gate returned must-fix THREE times in a row on the same class of error, all in my decision/investigation artifacts — every one an evidence-PROVENANCE over-claim, none touching the substantive verdict:
1. Called Devin "head-current" when `review/devin-commit-status.txt` was literally `"unknown"` and the captured page carried no head SHA (a *different* SHA appeared). Devin freshness must be reported as unknown unless the artifact says otherwise.
2. Wrote that emitted SPIR-V "confirms the StorageBuffer element-index pointer takes the identical 32→16 change" — but the only assembly I had was from the PRE-FIX prebuilt slangc, which shows `32`. The `→16` is an INFERENCE from the single unified source branch (`getPointerArrayStrideValue` gates both storage classes through the identical `as<IRArrayTypeBase>`→`getArrayElementStrideValue` path), NOT something the pre-fix asm demonstrates.
3. Left a residual "already proven" for the StorageBuffer case in decision.md after fixing it in investigation.md (a correction applied to one artifact but not its sibling → internal contradiction the gate caught).

Root cause: using a pre-fix binary to check emission is fine and useful — it reveals the access-chain STRUCTURE (which pointer type feeds which access chain) and the CURRENT decoration value, both fix-independent. The error is letting that slide into a claim about the POST-fix value. Pre-fix asm proves: structure + old value. It does NOT prove: the new value. The new value is either (a) emitted-proven at head via a head FileCheck expectation (the PhysicalStorageBuffer case — the updated `type-layout-memoization.slang` asserts 16/8), or (b) an inference from the source branch (the StorageBuffer case — no separate head asm). These are DIFFERENT epistemic statuses and must be labeled differently.

How to catch it: this is the root-mechanism tell (a past-tense claim about a state I didn't open — here, a compiled artifact I never generated at head). Before writing "emitted SPIR-V confirms X changed to Y", ask: did I actually emit at the FIXED commit, or am I reading a pre-fix dump? If pre-fix, write "structure verified from pre-fix asm; the post-fix value is inferred from the source branch / asserted by the head FileCheck test", never "confirmed/proven".

Fix / transferable rule: (1) Report artifact freshness from the freshness artifact, not from assumption. (2) When using a pre-fix binary to reason about a codegen change, separate the two claims explicitly — "structure + old value: emitted; new value: inferred-from-source or asserted-by-head-FileCheck". (3) When a critique correction lands, grep ALL sibling artifacts (decision.md AND investigation.md AND the message) for the same phrasing so the fix is applied consistently — an apply-to-one leaves a contradiction the gate re-flags.
