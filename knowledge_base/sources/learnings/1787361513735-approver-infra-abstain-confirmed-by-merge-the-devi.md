---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787273068610-gcdnaz
written_at: 2026-08-22T01:18:33.735Z
---

# [approver/infra-abstain] Confirmed by merge: the Devin-only tier on a bot fixer branch can force an infra-abstain on a genuinely-clean, human-approved PR

**Confirmed calibration (shader-slang/slang #12417, merged 2026-08-22 at my exact R2 head 48bc99b029a6 by MEMBER jvepsalainen-nv, 0 interval commits).** My R2 decision was ABSTAIN_POLICY/CRITIQUE_MUSTFIX. The merge outcome confirms the code was clean — it shipped as-is with a formal MEMBER approval and no post-decision commits. So the abstain was NOT over-caution on substance (my own source read had judged it clean and correct) and NOT a false-safe (I did not approve); it was driven *entirely* by review-signal integrity.

**The structural gap this names (the burn-down target):** on a `nv-slang-bot[bot]` fixer branch (`fix/issue-N`), production's claude-code-action review + CodeRabbit are BOTH skipped by design (harvest exit 20). That leaves Devin as the SOLE automated review signal — and Devin's cache can lag a fresh push, so its analysis describes a prior revision (commit-status "unknown", prose citing removed constructs). When that happens you have NO demonstrably head-current review signal at all, and the approver correctly abstains rather than substitute its own code read for the missing review tier. Net effect: a whole class of clean, mergeable bot-fixer PRs can only ever reach ABSTAIN on the current pipeline, not WOULD_APPROVE.

**What would actually close the gap (fix the SIGNAL, not the verdict):** a Devin run that is *verified head-current* before it's trusted — check the returned commit-status equals the pinned SHA and the prose references the current diff's constructs; if stale, re-trigger Devin on the head and poll until it settles, the same way the harvest tier waits on `pending_bot` (harvest exit 22). Only if a head-current Devin still cannot be obtained is the abstain irreducible. The lever is a head-pinned review signal on bot branches, not a challenger override.

**Scoring note for joins of this shape:** when an infra-abstain (CRITIQUE_MUSTFIX / NO_REVIEW_SIGNAL on a fixer branch) joins to a clean merge at the exact decided head, score it as an *infra miss* (the pipeline gap), never as a code disagreement and never as a false-safe. The abstain refusing to round up past a stale signal was the correct move; the datapoint belongs against the infra-abstain rate the quality gate drives to ~0, not against decision accuracy. Related: this session's [approver/critique-mustfix] ("Devin is head-stale" IS the abstain condition) and [approver/challenger-miss-averted] (a doc-🔴 on removed code is stale, not live).
