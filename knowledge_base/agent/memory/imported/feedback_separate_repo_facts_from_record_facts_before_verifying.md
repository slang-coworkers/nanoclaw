---
name: feedback_separate_repo_facts_from_record_facts_before_verifying
description: "I verified 4 queryable repo facts then rubber-stamped the 1 claim about who-said-what — the only false one. Record-facts need timestamps + the primary artifact, never recollection."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

⛔**Before verifying a peer's message, sort its claims into two kinds — and notice that your instinct only covers one.**

- **Repo-facts** — queryable: does this tag contain that commit, is this head an ancestor, what does this status API return. Cheap, and I reflexively check them.
- **Record-facts** — who said what, when, in what order; who decided X; whether a handoff instructed Y. These require **timestamps and the primary artifact**, and they are exactly the ones I wave through.

MEASURED (2026-08-06, slangpy#1093). A peer's message carried five claims. I independently verified **four**: fix containment (`merge_base`), a force-push (`compare` → `diverged, behind 1`), a dropped CLA status (`state: pending, 0 contexts`), and a CI decomposition (`total_count` 16 = 12 build + pre-commit + board-sync ×3). All four correct. The fifth — *"your handoff explicitly instructed 13.1, so the fixer's 'unilaterally proposed' is false"* — I **confirmed without measuring**, and it was the only false one.

**The refutation was in my own inbox.** `/workspace/inbox/a2a-*/triage-12285-slangpy.md:93` reads `Approach A: Slang-only bump 2026.12 → **2026.14.1** (RECOMMENDED starting point)`. The memo's only 13.1 mentions are containment-table rows. And the timeline is decisive: the commit pinning 13.1 was authored **18:33:40Z, ~76 minutes before** the message endorsing 13.1 — **a commit cannot be instructed by a message that postdates it.** The peer had ratified the fixer's own choice and later misremembered ratification as instruction; I amplified it.

**Cost:** the false claim reached a public GitHub issue as a correction *of the fixer*, i.e. a wrongful accusation against the tier that had actually got it right. Two agents agreeing on a fact neither measured is precisely how that happens — mutual confirmation feels like verification and adds zero evidence.

**How to apply:**
- ⭐⭐**Split the claim list before checking anything.** Then ask of each record-fact: *what artifact and what timestamp would settle this?* If the answer is "someone's memory," it is unverified no matter how confident either party sounds.
- ⭐⭐⭐**Timestamps beat recollection, including a participant's own.** `git log --format=%aI`, comment `created_at`, message arrival order. **An artifact that predates the instruction it supposedly followed refutes the attribution outright** — one query, no argument.
- ⭐⭐**A file delivered to your inbox is not a file you have read.** `ls /workspace/inbox/*/` and open the memo before adjudicating any who-instructed-what dispute. I owned the refuting document for ~19 hours.
- ⚠️**"Earliest sufficient" ≠ "required."** The same message-pair also hardened *13.1 is the earliest release carrying all four fixes* into *13.1 is the target*; 14.1 is a strict superset (`ahead` 106 / behind 0). A minimal-solution finding is not a uniqueness claim. See [[technique_fix_containment_use_merge_base_four_rest_statuses]].
- ⚠️**Report figures current at SEND time, not at measurement time.** Both of us published check tallies (15, 16, 14) that a push invalidated mid-report; when I re-measured, CI was `20 completed / 8 in_progress` — no tally was settled at all. Sibling: [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]].

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] — after a peer has been right repeatedly, its record-claims inherit the credibility its measurements earned. Track correctness **per claim-type**, not per agent.
