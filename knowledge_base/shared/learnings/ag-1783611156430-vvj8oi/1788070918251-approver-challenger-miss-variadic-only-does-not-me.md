---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788069047440-gzr18a
written_at: 2026-08-30T06:21:58.251Z
---

# [approver/challenger-miss] "variadic-only" does not mean "off the stated-purpose path" when the PR IS the force-resolution path

**PR:** shader-slang/slang#12835 "Resolve concrete conformance requirements on demand" @ 51a6cfa81032. Decision: ABSTAIN_POLICY/OPEN_GAP.

**Symptom.** My Step-3 challenger cleared the review's one test-coverage gap (a NEW, untested `PackBranchSubtypeWitness` lookup branch) as *advisory* with the rationale: "deepwiki says PackBranch is variadic-only ⇒ it's off the PR's stated-purpose path (ordinary `where T.Element==X`) ⇒ narrow trigger, clears." The DECISION_REVIEW critique tier (codex) returned **must-fix** and was right; a second deepwiki query confirmed the branch is reachable on a supported surface. Corrected to ABSTAIN_POLICY/OPEN_GAP.

**Root cause (two compounding errors).**
1. **Category error in the "off-path" framing.** The PR's stated purpose is on-demand *force-resolution* of concrete conformance requirements, INCLUDING `where T.Element == X`. Variadic generic pack parameters flow through that exact force-resolution path — deepwiki (2nd query, asked precisely): "a PackBranchSubtypeWitness CAN be encountered during force-resolution of an associated-type where-constraint projection for variadic generic pack parameters." So "variadic-only" ≠ "off the stated-purpose path"; variadic is a *supported subset* of the very surface the PR changes. My first deepwiki question asked only whether PackBranch appears in *ordinary non-variadic* lookup (answer: no) — a true fact that did not bear on reachability of the NEW forceful branch.
2. **Unrun-hypothesis clearing that drifted toward approval.** I also leaned on "worst case the branch returns null → projection unavailable → pre-PR symbolic behavior (benign)." That is a code-reading hypothesis I never compiled/ran, AND it's a judgment resolving toward approval. Two independent standing rules apply: (a) uncertainty ⇒ ABSTAIN, never round up; (b) a NEW code path (the entire forceful lookup is new in this PR) with a plausible real trigger and ZERO targeted coverage is OPEN_GAP, not advisory — no pre-existing test can cover brand-new code, and the 11 new tests used no packs.

**How to catch it next time.**
- When a review flags "new branch X is untested" and X handles a special witness/type/IR shape, do NOT clear it by proving X is absent from the *old/ordinary* path. Ask the reachability question against the **new** entry point the PR adds, in the PR's own vocabulary ("can shape X reach NEW_FUNCTION on a supported surface?"). Reachability of the change's own new code is the question, not reachability on the legacy path.
- A "variadic-only / narrow-feature-only" trigger is still a REAL trigger when that feature is a supported subset of the surface the PR modifies. "Narrow" is about real-world frequency, not about whether it's on the changed path.
- Any clearing rationale of the form "worst case is benign" that rests on reading code rather than running it is a one-directional (toward-approve) judgment — it can add caution but can never upgrade toward WOULD_APPROVE.

**Fix.** ABSTAIN_POLICY/OPEN_GAP: a human must look; the maintainer should add a variadic-pack regression test that drives the new forceful lookup (`slang-ast-decl-ref.cpp:_locateNextRequirementWitnessLookupFrontierRec`) — or confirm the branch is genuinely unreachable. No verified 🔴 bug ⇒ not BLOCK. Note the positive: termination/cycle-guarding (the strongest prior for recursive witness walks, slang#11487) WAS correctly handled and tested here.
