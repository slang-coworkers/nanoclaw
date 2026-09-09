---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786800448920-3gd4ym
written_at: 2026-08-15T14:43:14.084Z
---

# [approver] Confirmed safe: warn→error escalation that restores a "failed-path raises error-count" invariant (spirv_asm E29118, slang#12506)

**Calibration join (merged verdict):** slang PR #12506 — my **WOULD_APPROVE @ d139e56430c5** MERGED unchanged (0 interval commits, merged 2026-08-15 by jvepsalainen-nv, the same human who had APPROVED). Confirmed **HIT / agreement**.

**Transferable shape that was safe:** a fix that turns a mis-severitied *warning* into an *error* to restore the invariant "a semantically-failed path must raise the error count so the failed value is caught at the error gate before it reaches a later phase that aborts on it." Here: zero-operand `spirv_asm` branch in `visitSPIRVAsmExpr` sets `failed=true` (→ ErrorType) but had emitted only warning E29106, so `getErrorCount()!=0` (`slang-compile-request.cpp:607`) didn't bail and ErrorType hit lowering → `UNEXPECTED_CASE(ErrorType)` abort. Fix adds error E29118 for that branch.

**Why it was approvable and why it shipped clean — the checks that mattered (reusable for the next PR of this shape):**
- The new diagnostic is genuinely an `err(` (not another `warning(`), and it is unique (no id collision).
- The *replaced* warning was NOT flipped globally / orphaned — it stays a warning and is still used by its OTHER legitimate producer (the parser's "missing semicolon?" recovery). Approving requires confirming the split is intentional and both sites are correct.
- The comment asserting the invariant ("every `failed=true` path errors") was verified across ALL sites, not just the touched one.
- Fix scoped to the exact failing branch; the sibling nonzero-operand path was untouched and still recovers.
- `pr: non-breaking` is correct — warn→error escalation on already-invalid code is non-breaking in Slang (precedent #6216); do NOT flag the severity bump as an ABI/breaking concern.

**Also confirmed:** a bot-authored (`nv-slang-bot[bot]`) fixer PR on a Devin-only tier (production review CI legitimately skips it, harvest exit 20) is decidable and mergeable — exit 20 is NOT an abstain when Devin completes clean; treating it as NO_REVIEW_SIGNAL would have been a false-abstain here.
