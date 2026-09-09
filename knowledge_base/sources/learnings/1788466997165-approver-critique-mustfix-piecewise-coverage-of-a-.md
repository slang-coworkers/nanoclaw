---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788465674012-2s5xsg
written_at: 2026-09-03T20:23:17.165Z
---

# [approver/critique-mustfix] piecewise coverage of a newly-enabled reachable path is not "branch covered elsewhere"

**Context:** slang PR #12901 (Fix HostVM vector-scalar broadcast and composite extraction), same-repo MEMBER author, all 6 clauses pass, primary review APPROVE_WITH_NITS (0🔴/2🟡/4🔵), Devin clean. I traced all three fixes and found no defect, and initially derived WOULD_APPROVE. The DECISION_REVIEW critique returned must-fix and I corrected to ABSTAIN_POLICY:OPEN_GAP.

**Symptom:** A 🟡 test-coverage gap on a specific combination (HostVM `matrix<uint,R,C> << scalar`) that the PR *newly enables* — this PR is the first to route HostVM shifts through `legalizeScalarOperandsToMatchComposite(preserveShiftOperandElementType=false)`. No executing test covers that exact combination; the Metal test exercises the *other* branch (`=true`), and the vector `shiftLeft` + matrix `scale` byte-code tests each cover one dimension (shift-cast on vectors; matrix-from-scalar broadcast on mul) but never the two together.

**Root cause (of the mis-derivation):** I cleared the gap by arguing "every constituent is exercised piecewise, so the combination is effectively covered, and the trigger is rare." That is the one-directional-approval / "could-it-have-come-out-otherwise" false-safe. Piecewise-constituent coverage is NOT the conservative-lean bar's "branch already covered elsewhere," and a reachable, newly-enabled path is NOT "no real-world trigger / pure future-proofing." Rarity of the trigger and my own confidence that the code is correct do not convert a reachable untested path into an advisory nit. The bar is "any plausible real trigger or blast radius → OPEN_GAP; uncertainty → ABSTAIN," and it is not "is the code correct in my judgment."

**How to catch it:** When a PR introduces or newly routes a code path for a target (a new pass, a new flag branch, a shared helper newly called from a new caller), enumerate the reachable INPUT COMBINATIONS the new path admits (here: {vector,matrix} × {Lsh,Rsh} × {scalar-left,scalar-right} on HostVM). For each, ask: is there an *executing* test whose assertion fails if this exact combination regresses? If a reachable combination has only piecewise constituent coverage, that is an OPEN_GAP, not "covered elsewhere." Watch specifically for: a test that looks like coverage but exercises the sibling branch (Metal `=true` vs HostVM `=false`), and for conflating a same-shaped op (scalar-left *subtract*) with the untested branch (scalar-left *shift cast*).

**Fix / rule:** Clear a 🟡 coverage gap only when the *same* branch/combination is covered by an executing test, the trigger is genuinely unreachable on the supported path, or it is pure future-proofing with no real trigger. Otherwise ABSTAIN_POLICY:OPEN_GAP — it asserts nothing negative about the code (the well-tested primary fixes were fine), it just hands the missing coverage to a human. Correctly-traced code + zero-bug reviews still abstain if a reachable newly-enabled path is untested.
