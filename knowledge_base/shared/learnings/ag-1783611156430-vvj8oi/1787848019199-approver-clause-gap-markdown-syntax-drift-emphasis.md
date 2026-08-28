---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787156579051-3ss1r1
written_at: 2026-08-27T16:26:59.199Z
---

# [approver/clause-gap] Markdown-syntax drift (*emphasis* vs _emphasis_) survives `git diff -w` — a "rebase" can still trip the size cap while being cosmetic-only

## Symptom
shader-slang/slang#11335 R2 (synchronize): author pushed a partial rebase after an R1 ABSTAIN on the tier size cap. Current master became a TRUE ancestor of the new head (behind_by=0) and the worst R1 offender (command-line-slangc-reference.md) went clean — yet the diff was STILL 326 files, ~299 non-CI files divergent. `git diff -w -B --ignore-blank-lines` still reported 299 "substantive" files, which looks like real content divergence.

## Root cause
The remaining divergence is **markdown-syntax normalization**, not code: `*emphasis*`↔`_emphasis_`, definition-list continuation-line indentation, table-separator dash width (`| --- |` vs `| ------- |`), code-fence backtick count. `git diff -w`/`--ignore-all-space` does NOT hide these because emphasis-marker swaps and separator-width changes are non-whitespace characters. So `-w` showing a nonzero diff is NOT proof of substantive content change for markdown files. The prose text was byte-identical; head carried the un-normalized form and master the prettier/gersemi-normalized form.

## How to catch it
When `-w` still shows churn on doc/markdown files, don't conclude "real content revert." Grep the actual added/removed lines (`git diff --ignore-all-space <master>...<head> -- file | grep -E '^[+-]' | grep -vE '^[+-]{3}'`) and eyeball them: if every hunk is `*`↔`_`, `---`↔`--------`, fence-length, or blank-line insertion, it's formatting normalization. Confirm direction: head un-normalized, master normalized ⇒ merging reverts master's formatting ⇒ cosmetic, fixable by the repo's `/format` slash command.

## Fix / rule
Outcome is the same as R1: `tier_eligible` size cap (326>150) → ABSTAIN_POLICY, deterministic at Step 1, regardless of Devin/review signal. Do NOT escalate to BLOCK: markdown-format drift is not a verified 🔴 bug. But DO distinguish it in the report from R1's "stale-branch-behind-master" drift — here the branch is NOT behind (true ancestor), so the divergence is what the PR genuinely proposes on top of master, just cosmetic. Tell the human: rebase alone won't shrink this; they must re-run the formatter (`/format`) or drop the doc files from the PR so it's just the ~150-line CI feature. Ledger is first-write-wins per commit_sha, so each synchronize head is a fresh eligible decision row.
