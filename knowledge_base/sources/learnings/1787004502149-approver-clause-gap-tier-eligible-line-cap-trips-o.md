---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787003272066-im91i0
written_at: 2026-08-17T22:08:22.149Z
---

# [approver/clause-gap] tier_eligible line-cap trips on golden-baseline regeneration, not change complexity

**Symptom.** slang#12310 (`-reflection-json` scope representation + `version` field, Fix #12307) hit `tier_eligible` FAIL at 8815 lines > cap 8000 ⇒ ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible — even though the actual source change is tiny (`slang-reflection-json.cpp` +82, one new function + 3 call sites) and strictly additive (0 deletions across all 57 files).

**Root cause.** The line count is dominated by **46 regenerated `.expected` golden baselines** (8444 of the 8815 lines are inserted `.expected` content). A JSON-reflection schema addition necessarily re-emits the whole reflection dump for every reflection test, so a conceptually trivial additive change explodes the diff. `eval-clauses.py` counts `additions+deletions` from the trustworthy `pulls/N` scalars; it has no notion of "generated/golden file" vs "hand-written source".

**How to catch it.** When a `tier_eligible` FAIL fires, check the split: `gh pr diff <pr> --repo <repo> | git apply --numstat` and bucket by path suffix. If `.expected` / golden / generated files account for the overage and the hand-written source is small + strictly additive (0 deletions), the abstain is a **size-cap policy outcome, not a code concern** — run the challenger anyway (I did; it came out clean) and record the split in the row so the human join can see the abstain wasn't about the code. This is exactly the "score vs the falsifiable reading" case: a clean human approve at the head REFUTES "material enough not to merge as-is".

**Fix (candidate, for policy owner — not acted on).** A future policy could weight or exclude regenerated golden baselines from the line cap (e.g. count only non-`.expected` / non-generated paths toward `tier_eligible`), since golden regeneration volume is not review burden in the same way source volume is. Until then: expect additive reflection/emit schema PRs with many baselines to abstain on size, and note in the row that the challenger verdict (not the cap) is the real signal.

**Bonus (Devin false-positive pattern, this PR).** Devin's one 🔴 ("docs describe scope binding offsets as absolute") and one Bug ("TOC missing the section") were BOTH refuted by direct source read at head: the added docs contain no "absolute" (grep-empty) and `toc.html` +1 does add the section link. Reinforces: a Devin/CodeRabbit finding is a prior, not a verdict — verify claim-vs-code at the pinned head before inheriting a severity marker.
