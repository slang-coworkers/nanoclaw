---
name: feedback_a_claim_about_master_is_a_timestamp_not_a_version
description: "A quoted claim about 'master'/'tip-of-tree' must be resolved to the DATE IT WAS WRITTEN before reasoning about what a later fix should have done to it — the wrong framing yields a correct number on a false comparison, and it flatters whoever publishes it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12100-close-2026-08-05
---

**slang#12100/#12103, 2026-08-05.** A maintainer's 07-14 survey reported operator-built generic nesting "still degrading in **current master**" (8.5 s). I dispatched that shape as *the one #12106 would not be expected to have fixed*, reasoning: a degradation at master can't have been cured by a fix already in master. The triager inherited the framing and measured post-fix master at 0.256 s, then headlined **"the reported master degradation does NOT reproduce — master is ~65x FASTER, not 2x slower."**

Both wrong, same root cause. The survey posted **07-14T18:40:51Z**; #12106 (`c8d02ae59`) merged **07-16T03:28:03Z**. **His "master" was ~2 days PRE-fix.** The honest analogue is the pre-fix tag `v2026.13.1` (`merge-base --is-ancestor c8d02ae59 v2026.13.1` = **false**, fix 38 commits ahead), where the measurement was **16.5 s — the degradation is REAL and WORSE than reported**, on a different platform. #12106 landed *between* the two measurements.

⇒ ⛔**A claim about `master` / `tip-of-tree` / `ToT` / `HEAD` is a TIMESTAMP, NOT A VERSION. Resolve it to the date it was written — against the merge date of whatever fix you're reasoning about — BEFORE concluding anything about what that fix should have done to it.** Cheap: comment `created_at` vs `pulls/<n> .merged_at`, then `merge-base --is-ancestor <fix> <their-nearest-tag>`.

⭐⭐⭐**WHY THIS CLASS IS DANGEROUS — it produces a CORRECT NUMBER attached to a FALSE COMPARISON.** Every measurement was sound; every cell reproduced; the arithmetic was right. Only the *pairing* was wrong, and no amount of re-measuring detects that — re-running a comparison re-confirms it. ⭐⭐**And it FLATTERS the publisher** ("I couldn't reproduce their claim" / "their finding was wrong"), so nothing downstream objects: the maintainer would have had to defend a finding my own data corroborated. Same family as [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] — the framing consumes the reason to look.

⭐⭐**INHERITED PREMISES ARE THE TRANSMISSION PATH.** I supplied the premise in a dispatch; the triager adopted it without checking and built a headline on it. **A premise arriving inside a task assignment gets less scrutiny than one you formed yourself** — it reads as already-decided. The move to stop, on both sides: check the dispatcher's stated reason before executing on it. (Cf. [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] on inheriting unverified claims.)

⚠️**SECOND DEFECT, MINE, in the very message that corrected the first:** I wrote their master was "~68 commits after" the fix. **It is 101.** 68 is `c8d02ae59...v2026.14.1` — I reached for the *release tag* I'd measured earlier instead of `d2b405d31`, the ref actually under discussion. Verified: `compare/c8d02ae59...d2b405d31` → `ahead_by=101`; `...v2026.14.1` → `ahead_by=68`. My adjacent figure (38, for v2026.13.1) was exact, which is what made the wrong one look trustworthy. ⇒ ⭐⭐⭐**When a correction hinges on commit distances, recompute EVERY ref in the sentence against the ref actually named — a nearby exact figure lends unearned credibility to the one beside it, and I published this while correcting someone else's framing.** Per this store's own rule: *a fresh correct finding is the least-audited moment in an exchange* — being right about the timestamp is precisely what licensed sloppiness about the count.

**Handled well by the triager, worth copying:** verified the retraction *positionally* (`grep -n -B1`, since a count can't tell a retraction from an assertion); then swept the ALREADY-POSTED comment for the same defect class (any claim about someone else's "master") and confirmed all 5 occurrences pinned to a SHA ⇒ the defect never reached GitHub. ⭐**After finding a framing defect in a draft, sweep the published artifacts for the same class — a defect found late is a search key, not just a fix.**

**Two mechanical harness defects from the same chain are filed with the inert-guard family, not here** — `min()` over runs selects for the fast-failing run, and `${VAR:-default}` makes a blank-the-variable control vacuous: [[feedback_a_guard_can_be_inert_and_read_as_passing]].

Related: [[technique_compile_perf_three_platforms_and_v_staleness]] (`slangc -v` is a configure-time string — the same "identifier that looks like a version but isn't" trap) · [[project_12100_generic_nesting_exponential_compile_parked]] · [[technique_merged_at_not_committer_date_for_merge_time]]
