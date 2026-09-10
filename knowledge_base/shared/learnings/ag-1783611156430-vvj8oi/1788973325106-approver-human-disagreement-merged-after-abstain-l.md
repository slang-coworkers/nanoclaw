---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788479621007-3oyvwe
written_at: 2026-09-09T17:02:05.106Z
---

# [approver/human-disagreement] Merged-after-abstain: large maintainer feature PR (slang#12859) — what the merge join actually means

**Outcome:** slang#12859 ("Add experimental numeric interface modules", MEMBER tangent-vector) **MERGED** 2026-09-09 16:59Z (merge commit 3d595e6f, merged_by the author). I recorded **ABSTAIN_POLICY on all 5 heads** (4be3d737, 3de7c106, 37aeafcc, 9375413f, b8b2f94d) — same two gates every time: `no_protected_paths` (edits `**/CMakeLists.txt`) + `tier_eligible` (~8.7–9.2k lines / 41–43 files ≫ v0-shadow's 400-line/30-file caps). merged ⇒ APPROVED-equivalent, but ABSTAIN_POLICY rows are excluded from agreement scoring, so this is the **expected by-design shadow-mode abstain-then-merged** outcome for this class (cf. #12903, #12801), NOT a false-safe.

**Transferable calibration nuance (why the merge join can mislead if taken at face value):**
1. **"Merged" here = author-maintainer self-merged a green-CI feature, NOT a second human's approval.** There was **zero** independent (non-author, non-bot) review on the PR — checked `reviews[]` filtered of the author + bots = `[]`. For large MEMBER/OWNER-authored feature PRs, the merged⇒APPROVED join reflects **author confidence + green CI**, not independent scrutiny. Don't read such a join as "a reviewer validated the code" when scoring or calibrating.
2. **The diff between your last-decided head and the merged head can be a master-merge, not review churn.** Comparing my last decision commit to the merged head showed +9 commits, but they were dominated by a `Merge branch 'master'` pulling in unrelated master work (spvdb vendoring, other fixes) — the numerics feature itself was **stable across all 5 revisions**. When mining "what humans changed between my decision and merge," separate feature-substantive commits from routine master merges before drawing a lesson.
3. **This class is a standing routing cost, not a review signal.** A large maintainer feature that adds a `CMakeLists.txt` or exceeds the size caps will ABSTAIN on every push under bundled v0-shadow, then merge on human/maintainer authority with green CI. A mounted policy with **tiered handling** (e.g. raise/relax size caps and exempt standard-module `CMakeLists.txt` for trusted MEMBER/OWNER authors when full CI is green) would make the whole class *decidable* instead of contributing only excluded-from-scoring abstains. This is the concrete value the absent-mount escalation is leaving on the table.

**How to catch/apply:** on any `github.pr_merged` join for an ABSTAIN row, before concluding "abstain was fine," verify (a) whether an independent human actually reviewed vs. author self-merge, and (b) whether the pre-merge delta was feature churn or a master merge. Both shape whether the merge is real validation of the code.
