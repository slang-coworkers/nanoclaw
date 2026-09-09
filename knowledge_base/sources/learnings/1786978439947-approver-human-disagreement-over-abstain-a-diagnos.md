---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786963359328-h5kmcl
written_at: 2026-08-17T14:53:59.947Z
---

# [approver/human-disagreement] Over-abstain: a diagnostic-label gap + a speculative masking window is a nit, not OPEN_GAP, when verdict-correctness holds on every realistic path

**Context:** shader-slang/slang#12573 (2026-08-17). I decided ABSTAIN_POLICY:OPEN_GAP on the "retry a malformed reply / make `RPCAttemptOutcome::ProtocolError` retryable" PR. It **merged UNCHANGED at my exact decided head** (`5ba21973d5d0`, zero interval commits), human-approved by jkiviluoto-nv, `reviewDecision=APPROVED`, and **no human ever engaged the gap I flagged**. Scored against the falsifiable reading ("material enough not to merge as-is" — which a clean approval at my head refutes): this is a **false-abstain (over-abstain)**.

**What the gap actually was.** Devin flagged (and I verified) that `ProtocolError` collapses two situations now treated identically: genuinely corrupted-in-flight replies (the target) AND well-formed JSON-RPC *error* replies (`getMessageType()!=Result`). Both get retried and labeled "unreadable/malformed."

**Why it should have cleared to a nit (the calibration lesson).** I had already established the load-bearing fact: **verdict-correctness is preserved on every realistic deterministic path** — a child crash maps to `Lost` (unchanged), a failing test's content returns a well-formed `Result` with a non-zero code (`Ok`), and a deterministic protocol error reproduces on retry and is charged to the test. The only genuine behavior changes were (a) a *diagnostic wording* inaccuracy ("unreadable" for a well-framed error) and (b) a masking window that requires a *transient* well-formed error — which I flagged as **speculative**, with no demonstrated trigger (module-not-found etc. are deterministic).

**The transferable rule.** When a gap reduces to (a) diagnostic/label imprecision with the pass/fail verdict provably intact, and (b) a masking window that needs a trigger I can only hypothesize (not exhibit), that is a **nit that clears**, not an OPEN_GAP — even on the fallback tier with a Devin 🔴. "Uncertainty ⇒ ABSTAIN" is for uncertainty about *correctness/blast-radius*, not for a fully-understood minor-quality issue. The tell of an over-abstain-in-progress: my own investigation says "verdict preserved / no realistic false-green" AND the only surviving concern is worded as "*could* mislead" / "*narrow* window" / "*speculative*." When the correctness question is answered and only a quality-of-diagnostics question remains, lean WOULD_APPROVE (the maintainer treats label-accuracy as follow-up, not a merge blocker).

**Not a false-safe.** The abstain did not approve anything wrongly; the cost was over-caution (declining to approve a mergeable PR), which is the cheap direction. But repeated over-abstains erode the signal, so calibrate: a proven-correct verdict + a speculative-only residual = clear it.

**Confirmed-safe half:** the #11753 crash-remasking fear I investigated WAS correctly refuted (crashes → `Lost`, not the retryable outcome) — that half of the reasoning matched the outcome.
