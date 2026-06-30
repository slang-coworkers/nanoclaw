---
title: "State Verification Discipline"
type: concept
group: general-misc
tags: [state-verification, stale-state, github, live-check, pr-state, resume, feature-requests, submodule, trackers]
source_count: 16
---

# State Verification Discipline

Rules for verifying live external state before acting — covering GitHub PR/issue state, resume-after-pause workflows, stale feature/fix requests, submodule version reading, recurring tracker hygiene, and the general discipline of trusting observed state over saved memos or cached assumptions.

## Re-verify Remote State Before Acting on Saved Plans

When resuming a fixer chain after a multi-day pause, the saved resume memo may be materially stale. Another session, the maintainer, or upstream automation may have advanced the PR while the chain was paused. Before acting on the memo, run a quick verification: `git log --oneline master..HEAD | head -10` (disk truth) and `gh pr view <N> --json isDraft,milestone,labels,title,body` (remote truth). If they don't match the memo, re-plan from observed state. Specific gotchas: `/tmp` snapshots are wiped on container restart; issues filed by a prior session produce a different number than the memo guessed; a draft PR may already be non-draft. Acting on a stale memo is the most likely path to wasted effort or destroying merged-down work. ([[wiki/learnings/1779847439047-resume-after-pause-re-verify-remote-state-before-a.md]])

## Re-pull Mutable PR State Before Asserting It

A PR's `isDraft`, `state`, `reviewDecision`, `mergeable`, and `mergeStateStatus` can change between turns due to maintainer or external activity. Before asserting any of these in a status report or `[Report]`, re-pull live with `gh pr view <n> --repo <owner/repo> --json isDraft,state,reviewDecision,mergeable,mergeStateStatus`. A maintainer flipped one PR from draft to ready-for-review within nine minutes of the bot opening it; the bot continued reporting it as a "parked draft" for two hours. Body edits do NOT dismiss an existing approval, so editing after approval is safe — but re-confirm `reviewDecision` before asserting it. ([[wiki/learnings/1781702557335-re-pull-mutable-pr-state-from-github-before-assert.md]])

## Verify Live PR Draft/Ready State Before Reporting

A corollary: before writing "draft"/"ready"/"merged" in a `[Fix Report]`, run `gh pr view <n> -R <repo> --json isDraft,state,reviewDecision,mergeStateStatus` and report those values, not the last state set. A maintainer readying the bot's draft is the expected positive path toward merge — approval alone does not mean the PR is still draft. ([[wiki/learnings/1782236591493-verify-live-pr-draft-ready-state-before-reporting-.md]])

## Verify Live GitHub State Before Acting on Hold/Revert Instructions

When a parent/peer sends a "hold / stop / revert / don't-do-X" instruction that could post-date a terminal action (PR opened, push done, comment posted), verify the live external state first with read-only commands rather than acting blindly. Surface any discrepancy with concrete facts and let the sender reconcile. Trust observed state over a possibly-stale instruction (the truthfulness invariant: "if a recalled memory/instruction conflicts with current information, trust what you observe now"). ([[wiki/learnings/1780510388169-verify-live-github-state-before-acting-on-a-hold-r.md]])

## Stale Feature Requests Can Be Half-Implemented

For a feature request more than a few months old, never scope the remaining work from the issue body or maintainer comments alone — those describe the state when written. Fan out code subagents to map what has already landed versus what is missing at current HEAD. In one case a maintainer design comment described the work as unstarted, but verification showed most of the backend had already landed; the genuine remaining gap was far narrower than the issue implied. ([[wiki/learnings/1782215130307-stale-feature-requests-can-be-half-implemented-at-.md]])

## Stale PR Fix-Requests: Verify Base Before Implementing

Before implementing a maintainer-requested fix on an aging PR, run two cheap checks: (1) verify the PR's base against current `origin/main` to see if the patched code was refactored away, and (2) confirm whether any referenced `#N` is an Issue or a PR (`gh api repos/O/R/issues/N --jq '.pull_request'` — non-null means it is a PR). A one-month-old PR base may have the patched code replaced on main, making the implementation moot. ([[wiki/learnings/1782211781469-stale-pr-fix-requests-verify-base-vs-current-main-.md]])

## Reporter's Release May Post-Date the Fix

When triaging a "this is already fixed on main, please update" response, verify the reporter's stated release version actually predates the fix commit before telling them to update. Map release tag → `gh release view <tag> --json publishedAt` and compare against the fix's merge date. Telling a reporter to update when they are already on a build that includes the fix causes them to dismiss the issue — potentially closing a real, unrefuted bug. ([[wiki/learnings/1781251548493-verify-reporter-s-release-actually-predates-the-fi.md]])

## Submodule Pin: Commit Date Is Not Version

When investigating a git submodule's pinned commit, do not trust the commit date as a proxy for the dependency version. Use `gh api repos/OWNER/REPO/commits/<sha>` cautiously — it resolves any object reachable in the fork network, including downstream patch commits not on `master`. To state the true version, read the version header at the pinned SHA (`IMGUI_VERSION`, etc.). To check reachability from the tracked branch, use `gh api .../compare/<pin>...master --jq '{status,ahead_by,behind_by}'`. ([[wiki/learnings/1782231360603-reading-a-submodule-pin-commit-date-version-check-.md]])

## Recurring Trackers Must Carry Disposition, Not Just Items

For any periodic agent maintaining a carried-forward tracker (watch-list, status board), the file must record each item's disposition, reasoning, and who/when — not just the item. A fresh session re-derives state from raw source facts every run and keeps re-raising alarms that a human already dispositioned. The fix: structure every tracker entry with a leading Disposition line (active / de-escalated-monitor / retired), an explicit "do NOT re-flag" section for de-escalated items, and a header rule that a human's evidence-backed de-escalation overrides what the raw window re-derives. ([[wiki/learnings/1782461882511-recurring-trackers-must-carry-disposition-reasonin.md]])

## Daily Maintainer Report Must Carry Open Ship-Stoppers

An open P0/ship-stopper fix must appear in every daily maintainer report until it reaches a terminal state (merged/closed). A PR that was opened more than 24 hours ago and is still in review falls outside the 24h merge/open window used by the fetch query and silently drops off. Keep a persistent watch-list file; at the start of every daily report, read it and carry every still-open entry forward with freshly-verified live state. Retire an entry only on merge/close or explicit human de-escalation. ([[wiki/learnings/1781598056955-daily-maintainer-report-must-carry-open-ship-stopp.md]])

## Test-Agent-Filed Issues: Strip to Minimum Before Trusting

When triaging issues filed by an agentic test-generation pipeline, do not trust the reporter's framing of the trigger. Always strip the repro to its minimum by commenting out lines one at a time to find the exact line that, when removed, makes compilation succeed. Also verify the "other targets work" claim independently — agentic reporters cite sibling tests they did not actually re-run. If the IR op in the error message is more generic than the narrow construct in the title (e.g. `castToVoid` vs. "enum-to-int cast"), the IR op is the real story. ([[wiki/learnings/1779958336217-test-agent-filed-issues-need-trigger-verification.md]])

## A PR's Changed-File List Does Not Prove "Not a Regression"

When attributing whether an ICE/assert is a regression of a past PR, do not conclude "not a regression" merely because the PR's changed-file list excludes the assert site. Adjacent lowering/transform changes can alter whether execution reaches a downstream unchanged assert. The only file-list-verifiable claim is "the assert site was/wasn't modified." For causal regression claims, trace the data/control path — not the file list. When that tracing cannot be done, say "not determinable from the file list — maintainer's call." ([[wiki/learnings/1780541174316-a-pr-s-changed-file-list-does-not-prove-not-a-regr.md]])

## Check Issue Comments for External Contributor Ownership

On an issue handoff, check issue comments and author intent before coding. If an external contributor said they are writing a PR or a maintainer publicly invited them to build the fix, do not auto-implement a competing draft PR. Stand down at a read-only plan. Re-engage only if the contributor abandons the PR AND a maintainer explicitly asks the bot to take over. ([[wiki/learnings/1780473504394-don-t-auto-implement-issues-owned-by-an-invited-ex.md]])

## Stand Down When a Maintainer or Contributor Is Driving the Fix

A consolidated rule across seven postmortems: when an issue already has a maintainer or external contributor active on it, a competing bot PR is likely to be closed even when correct. Bias toward advisory triage; if drafting, keep it thin and parked, and close it the moment the issue closes. Detection signals: `assignees` set to a maintainer, active external contributor or "I'll take this" comment, or a linked PR already open. Do not let a parked draft rot against a closed issue. ([[wiki/learnings/1782648000000-CONSOLIDATED-stand-down-when-maintainer-or-contributor-drives-fix.md]])

## Design Discussion Issues: Frame as Questions, Not Bug-With-Fix

When a maintainer asks the bot to file a new issue for design/analysis discussion rather than a solution, frame the issue as open questions — not a bug with a known fix. The existing PR's proposed fix must be listed as one candidate among neutral options, explicitly not endorsed. Shader-slang/slang has no "discussion" label; design-discussion issues go unlabeled. Ack on the source PR with a short comment linking the new issue and the scope distinction. ([[wiki/learnings/1782163190955-filing-a-neutral-design-discussion-issue-split-off.md]])

---
**Source learnings (16):**
- [[wiki/learnings/1779847439047-resume-after-pause-re-verify-remote-state-before-a.md]] — Resume-after-pause: re-verify remote state before applying the saved resume plan
- [[wiki/learnings/1781702557335-re-pull-mutable-pr-state-from-github-before-assert.md]] — Re-pull mutable PR state from GitHub before asserting it in a status report
- [[wiki/learnings/1782236591493-verify-live-pr-draft-ready-state-before-reporting-.md]] — Verify live PR draft/ready state before reporting it
- [[wiki/learnings/1780510388169-verify-live-github-state-before-acting-on-a-hold-r.md]] — Verify live GitHub state before acting on a "hold/revert/change-posture" instruction
- [[wiki/learnings/1782215130307-stale-feature-requests-can-be-half-implemented-at-.md]] — Stale feature requests can be half-implemented at HEAD
- [[wiki/learnings/1782211781469-stale-pr-fix-requests-verify-base-vs-current-main-.md]] — Stale PR fix-requests: verify base vs current main before implementing
- [[wiki/learnings/1781251548493-verify-reporter-s-release-actually-predates-the-fi.md]] — Verify reporter's release actually predates the fix before telling them to update
- [[wiki/learnings/1782231360603-reading-a-submodule-pin-commit-date-version-check-.md]] — Reading a submodule pin: commit date ≠ version; check reachability with compare
- [[wiki/learnings/1782461882511-recurring-trackers-must-carry-disposition-reasonin.md]] — Recurring trackers must carry disposition + reasoning, not just items
- [[wiki/learnings/1781598056955-daily-maintainer-report-must-carry-open-ship-stopp.md]] — Daily maintainer report must carry open ship-stoppers until merged
- [[wiki/learnings/1779958336217-test-agent-filed-issues-need-trigger-verification.md]] — Test-Agent-Filed Issues Need Trigger Verification
- [[wiki/learnings/1780541174316-a-pr-s-changed-file-list-does-not-prove-not-a-regr.md]] — A PR's changed-file list does not prove "not a regression"
- [[wiki/learnings/1780473504394-don-t-auto-implement-issues-owned-by-an-invited-ex.md]] — Don't auto-implement issues owned by an invited external contributor
- [[wiki/learnings/1782648000000-CONSOLIDATED-stand-down-when-maintainer-or-contributor-drives-fix.md]] — CONSOLIDATED: stand down when a maintainer/contributor is already driving the fix
- [[wiki/learnings/1782163190955-filing-a-neutral-design-discussion-issue-split-off.md]] — Filing a neutral design-discussion issue split off from a PR
- [[wiki/learnings/1781574732054-bi-weekly-every-other-week-scheduling-via-cron-gua.md]] — Bi-weekly (every-other-week) scheduling via cron guard
_Catalog: [[wiki/index.md]]_
