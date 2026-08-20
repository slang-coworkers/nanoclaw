---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787172126535-cworuh
written_at: 2026-08-19T21:00:01.975Z
---

# [approver/challenger-miss] Blast-radius is a separate prong, not a mitigator of the plausible-trigger prong

**Symptom.** On slang#12631 (docs-only +6 lines to AGENTS.md, adding a "Native Linux and macOS Tooling" section), the single 🟡 CodeRabbit gap was "the doc recommends bare `python`, which is absent / maps to an unsupported interpreter on python3-only Linux distros; suggest `python3`." My Step-3 challenger *conceded* the trigger is plausible, then cleared it as advisory on the grounds that the blast radius is small (a self-correcting example word in agent-guidance prose). Initial verdict: WOULD_APPROVE. DECISION_REVIEW (codex) reversed it to ABSTAIN_POLICY / OPEN_GAP, and the reversal was correct.

**Root cause.** The Step-3 severity bar has THREE independent ABSTAIN prongs: (a) any plausible real trigger, (b) real blast radius, (c) undermines the PR's stated purpose — plus "uncertainty ⇒ ABSTAIN." They are disjunctive: ANY one firing ⇒ ABSTAIN. I treated (b) as a *mitigator* of (a) — "trigger is plausible BUT blast radius is small, so it clears." That is not how the bar reads. Once I admitted the trigger is plausible and real (not unreachable / not covered elsewhere / not pure future-proofing), the gap ABSTAINs regardless of how small the consequence is. This is the classic one-directional slide-toward-approval: every judgment call bends toward "it's fine."

**Why the clearing was doubly wrong here.** The `python` recommendation is NEW in this diff (so it does not clear under "branch already covered elsewhere"), and python3-only systems are a present reality (so not "pure future-proofing with no real-world trigger"). And the trigger lands on the *exact* path the new section targets — native Linux. All three of the "clears only if clearly inconsequential" escape hatches were closed.

**How to catch it.** When writing a Step-3 gap clearance, name WHICH escape hatch you're invoking ("trigger unreachable on the supported path" / "covered elsewhere" / "pure future-proofing, no real trigger") and verify it literally. If your sentence contains "plausible trigger BUT [small/cosmetic/self-correcting]", STOP — you're using blast-radius to override a fired prong, which the bar does not permit. Blast-radius only *adds* caution; it never removes it. Grep your own draft for the word "but"/"however" after conceding a trigger.

**Also corrected here:** the falsifiability framing. An OPEN_GAP abstain's falsifiable claim is "a human should look," NOT "material enough not to merge as-is." A later clean human merge does NOT refute an OPEN_GAP abstain — it just records the human's answer to the question you flagged. Using "clean merge would refute the abstain" as an argument FOR approving is the meaningless-abstain frame the MEMORY index warns against; don't let it pressure a genuine gap toward approval.

**Fix.** Verdict recorded ABSTAIN_POLICY / OPEN_GAP. Transferable rule for docs/guidance PRs and any small change: a plausible, in-diff, present-day trigger on the change's own target path is an OPEN_GAP even when the consequence is minor and self-correcting; small blast radius is not an escape hatch.
