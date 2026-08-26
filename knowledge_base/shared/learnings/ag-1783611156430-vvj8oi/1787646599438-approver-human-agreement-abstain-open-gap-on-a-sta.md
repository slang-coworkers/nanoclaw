---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477780028-zjf192
written_at: 2026-08-25T08:29:59.438Z
---

# [approver/human-agreement] ABSTAIN(OPEN_GAP) on a stale-suppression-list merge gap confirmed by close — and a supersession check I should add to Step 0

**Outcome:** slang#12465 (render-test HLSL-prelude scoping) was CLOSED UNMERGED at head 5e2cae2f, the exact commit I decided ABSTAIN_POLICY(OPEN_GAP) on. Closed-unmerged ≈ CHANGES_REQUESTED-equivalent ⇒ my ABSTAIN was concordant (I did not approve). Recording this as a positive calibration datapoint AND the one thing I could have probed.

**Where I was right:** My OPEN_GAP was "the master-merge reverted the PR's deletions of the slang#12442 test-suppression entries." The closing MEMBER (jvepsalainen-nv) independently landed on the same artifact from a deeper angle: "drop the two _meta list changes — merging them would re-list tests that now pass." Same files, same instinct that the suppression-list state was wrong. Reaching the gap by 'the merge dropped the PR's deletions' vs 'the deletions are now stale' converged on the same must-fix — good sign that counting a PR's reverted deletions surfaces real problems.

**What I could NOT see, and the transferable probe:** The PR was ultimately obsoleted by a SIBLING PR — #12593 (merged 73deb0f9, ~9.5h AFTER my decision) removed the non-NVAPI else-branch that blanked the prelude, fixing the parent issue #12442 the PR was framed around. My ABSTAIN correctly withheld approval, but I framed the PR as a live fix; the human's key insight was "this is now defence-in-depth hardening, not a #12442 fix — re-scope it." That supersession was NOT in the master I reviewed (bec577b3 still had the else-blank at render-test-main.cpp:1614), so it was genuinely undiscoverable at decision time — but the CLASS of it is probeable.

**Add to Step-0/challenger for any PR that fixes a named issue:** check whether the issue it Fixes/closes is already addressed or has a competing open/recently-merged PR. Cheap probes: `gh issue view <N>` state + `gh pr list --search "<issue#> in:title,body"` / `gh api search/issues?q=<issue#>+repo:...`. When the parent issue's root cause is fixable at more than one layer (here: remove the blanking source vs. guard/restore around it), two PRs can race; the one that lands second becomes hardening or dead. If a sibling already fixed the root cause, the correct feedback is 're-scope/retitle', which supports ABSTAIN over BLOCK/APPROVE — and it sharpens the human-facing note.

**Also reaffirms:** a byte-identical fix hunk to a previously-approved head (7cde7d29 → 5e2cae2f) does NOT carry the approval forward — the surrounding master-merge changed both the delivered scope (reverted deletions) AND the world (a sibling fix landed), and both mattered to the human's close.
