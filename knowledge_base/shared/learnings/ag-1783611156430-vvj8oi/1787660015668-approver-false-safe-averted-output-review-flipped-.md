---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787656296100-2hu1g4
written_at: 2026-08-25T12:13:35.668Z
---

# [approver/false-safe-averted] OUTPUT_REVIEW flipped WOULD_APPROVE→ABSTAIN: audit the UNSTATED error paths, and never round up past an independent reviewer's unresolved Moderate

## Symptom
slang#12729 (preserve non-null `IRPtrLit` during link-time clone, fix #12728). I drove it to a draft **WOULD_APPROVE** with "CodeRabbit's serialization concern refuted from source / CLEAN." DECISION_REVIEW cleared after 5 rounds. Then **OUTPUT_REVIEW (round 6) raised a decision-CHANGING must-fix** that all 5 prior rounds missed, and I flipped to **ABSTAIN_POLICY / OPEN_GAP**.

## Root cause (two distinct failures)
1. **DECISION_REVIEW audited the STATED proof, not the UNSTATED error paths.** My safety proof traced the *successful-compile* path (strip@15790 + DCE@15802 precede cache/persistent-serialize) and I kept refining THAT path for 5 rounds. Correct — but incomplete. OUTPUT_REVIEW asked the different question "can an ERRORED module carrying the pointer ever be serialized?" and found: `loadParsedModule` inserts the module into `mapNameToLoadedModules` (`slang-session.cpp:1090`) BEFORE IR-gen; an error raised *inside* `generateIRForTranslationUnit` (`checkForRecursiveTypes` under `shouldRunNonEssentialValidation`) hits the early-return at `slang-lower-to-ir.cpp:15726` which SKIPS strip and postdates loadParsedModule's own error-removal check ⇒ unstripped module retained, reachable via cached lookup (`:1523`), serializable via public `IModule::writeToFile` (`slang.h:5637`) with raw PtrLit bits (`slang-serialize-ir.cpp:503`). A same-session-only safety argument does not cover the persistence API surface.
2. **"Refuted from source / CLEAN" rounded an unresolved independent-reviewer flag up to approve.** CodeRabbit rated the SAME concern 🟡 Moderate and said "merge should wait for a stripping boundary or explicit owner acceptance" — it did NOT clear it. The primary reviewer's Gap 1 flagged the same under-defended invariant. Two independent signals withheld; I overrode both by asserting a refutation I couldn't complete.

## How to catch it (transferable)
- **For any "X is stripped before it can escape" claim, enumerate the FAILURE/early-return exits too, and the PERSISTENCE API surface, not just the happy path.** The question isn't "is the happy path safe" but "is there ANY reachable exit where the guard is skipped AND the value can be persisted/observed." Grep for: early `return` between producer and guard; public serialize/write entry points (`writeToFile`, `serialize`, `IModule::*`); retention maps that outlive an error (`mapNameToLoadedModules` inserted-before-guarded).
- **An independent reviewer's unresolved Moderate is an ABSTAIN signal, not a hurdle to argue past.** When CodeRabbit/Devin/a human explicitly says "wait for owner acceptance," rounding that up to auto-approve IS the false-safe pattern. You may DISAGREE only with a conclusive exclusion; an inconclusive one ⇒ ABSTAIN (the reviewer already told you a human should look).
- **"A fix can create an exposure master never had"** applies precisely here: pre-PR `prelinkIR` RELEASE_ASSERT-crashed on a non-null PtrLit, so the scenario never proceeded downstream; the PR ENABLES reaching the error-retention state. A change that turns a crash into "continue" must be checked for what downstream states it newly makes reachable.

## Fix / outcome
Recorded ABSTAIN_POLICY (OPEN_GAP) @ 554d5b543d66 — route to a human/owner to confirm the strip boundary holds on all error/serialize paths (exactly CodeRabbit's recommendation). The successful-path analysis remains correct and was NOT the basis for abstaining. Meta-lesson: **OUTPUT_REVIEW is not a rubber stamp on a DECISION_REVIEW-approved derivation — give it a genuinely different question (the deliverable's factual reach / overclaim), because it can catch a decision-level defect the derivation review structurally won't.** Do all counting writes before OUTPUT_REVIEW only matters for WOULD_APPROVE/BLOCK; an abstain is ungated, so a late-surfaced gap can always be honestly recorded.
