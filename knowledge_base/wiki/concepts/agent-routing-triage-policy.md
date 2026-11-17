---
title: "Agent Routing: Slang Issue Triage Policy"
type: concept
group: agent-routing
tags: [triage, slang, stand-down, issue-routing, maintainer-only, issue-types, onboard-workflows, handoffs]
source_count: 9
---

# Agent Routing: Slang Issue Triage Policy

Dispatch and disposition policy for shader-slang/slang issues reaching the bot chain: when the bot must engage (stand-down rule), maintainer-only actions, core-team umbrella triage, Issue-Type metadata, known bot-infra workflow failures, and triage handoff mechanics. Hold/park resumption discipline lives in [Holds, Authorization, Gates](agent-routing-holds-authorization-gates.md); bot identity and comment CRUD in [GitHub Bot & Webhooks](agent-routing-github-bot-and-webhooks.md).

## TL;DR

- Only an explicit stand-down stops the bot on an issue: the `no-bot` label, or the issue text, a comment, or the operator asking the bot to stay off. An assignee (even a self-assignment seconds after filing), a milestone, a MEMBER/COLLABORATOR author, a fix plan in the body, a "tracking" title, or a missing `bot-ok` label is NOT a stand-down — dispatch to the triager at once on the canonical thread.
- Two states are not holds because the work is already owned or done: a chain already owns the issue (send to that owner), and an open or merged human PR already fixes it (point to it; open no second PR).
- Closing a GitHub issue is maintainer-only for the triager: post the verdict as an issue comment, leave the close to a human. The anti-close hook pattern-matches the whole bash command string, so avoid the literal close phrase in commands and heredocs.
- The no-repro skip rule for core-team tracking umbrellas forbids pestering for reproducers, not posting: post the 5-bullet when the dispatch authorizes posting, skip when discretion is granted, log the call either way.
- Query GraphQL `issueType` before any Issue-Type write: REST `type` can be null while GraphQL holds a human-set value, and types beyond Bug/Feature/Testing exist ("Language Maturity"). Never overwrite a human's more-specific Type.
- Issue Onboard and Check IR Version workflow failures are known bot-infra, never master regressions: the onboard GraphQL `$iteration` failure is tracked by fix PR #12982 — never flag it untracked or file a new issue.
- In triage handoffs, attach files or inline their contents (paths are container-local), and verify "related open PRs" numbers are actually PRs (`gh pr view` errors on issue numbers) before planning around them.

## Stand-Down: What Stops the Bot on an Issue

A coworker backs off an issue only for an explicit stand-down: the issue carries the `no-bot` label (the webhook already drops `GoodFirstBug`/`HelpWanted`/`no-bot`, and `bot-ok` hands one back), or the issue text, a comment, or the operator asks the bot to stay off. An assignee or self-assignment (even seconds after filing), a milestone, a MEMBER or COLLABORATOR author, a fix plan in the body, a "tracking" title, or no `bot-ok` label is not a stand-down — Main dispatches the issue to the triager at once on the canonical thread with `<github-post-authorized />`, and the triager hands a clear fix to the fixer as for any other issue. This operator correction (2026-11-17) supersedes every earlier R6-draft rule that held an issue because of who owned it ("maintainer self-assigned ⇒ hold", "human assignee ⇒ stop", "no `bot-ok` on a self-assigned item ⇒ parked"): R6 as decided (#13596) has no wait and no ownership rule. Two states remain non-holds because the work is already owned or done: a chain already owns the issue (send to that owner), and an open or merged human PR already fixes it (point to that PR, open no second PR). If a maintainer later asks the bot to stop or adds `no-bot`, the chain stops then. Motivating failure: on 2026-11-16 the Orchestrator held slang#14517 (MEMBER author, self-assigned 10 s after filing) — no triage and no post ([Correction (operator, 2026-11-17): only an explicit stand-down stops the bot](../learnings/1794884111425-correction-only-an-explicit-stand-down-stops-the-bot.md)).

## Maintainer-Only Actions: Issue Closing and the Anti-Close Hook

`gh issue close` (any close of a GitHub issue) is hook-blocked for the slang-triager container as a "maintainer-only action", and the hook pattern-matches the whole command string — it fires on command text that merely mentions the close phrase, including heredoc bodies. For duplicates/wontfix, post the verdict as an issue comment and leave the close to a human maintainer; when writing memos or gate scripts, avoid the literal phrase in bash command strings ([issue-closing is maintainer-only for slang-triager](../learnings/1794824034217-issue-closing-is-maintainer-only-for-slang-triager.md)).

## Core-Team Tracking Umbrellas: Post or Skip by Dispatch, Log Either Way

When triaging a core-team (MEMBER/COLLABORATOR) tracking umbrella with no reproducer, the "silently skip triage" rule's intent is "don't pester for reproducers on bugs" — it does not forbid a post. If the parent's dispatch explicitly includes `<github-post-authorized />` and asks for a reconciliation/analysis "before posting", post the 5-bullet artifact; if discretion is granted, skip the post. Log the call either way. Instance: #13719 vs #13979 — reconciled as adjacent efforts already linked by author nesting (#13979 is a sub-issue of #13719); #13719 posted 2026-11-17, #13979 skipped on granted discretion ([triage post decision on core-team tracking umbrellas](../learnings/1794891487671-triage-post-decision-on-core-team-tracking-umbrell.md)).

## Issue Types: Query GraphQL Before Any Type Write

Slang issue Types are not limited to Bug/Feature/Testing: "Language Maturity" exists and a human may have set it (e.g. #13621, a keyword-classification RFC, carried GraphQL `issueType` "Language Maturity" — a better fit than Feature), so check before setting Feature. The REST `GET /repos/.../issues/N` field `type` can return `null` for the same issue where GraphQL has the value, so use GraphQL `issueType` for the drift check before any Type write. Overwriting a human's more-specific Type violates the never-overwrite-human-triage rule and has burned the fleet before (#12526) ([Slang issue Type "Language Maturity" exists; GraphQL issueType authoritative](../learnings/1794892431490-slang-issue-type-language-maturity-exists-graphql-.md)).

## Known Bot-Infra Workflow Failures: Issue Onboard, Check IR Version

The Issue Onboard workflow's GraphQL error "Type mismatch on variable $iteration (ID! / String)" is a KNOWN, TRACKED failure — fix PR **#12982** ("ci: pass Sprint iteration ids as GraphQL String", open since 2026-09-09). It fires only when the issue author is in team `shader-slang/source-internal` (that path sets Source = Internal, then the Sprint iteration, which fails); outside members are logged "source-internal for slang: false … Source = Community" and the run succeeds. Read the job-log tail (last ~40 lines) to see which branch ran. Never flag it "UNTRACKED" or propose filing a new issue — it's board plumbing, not a master break or test-infra regression. Nuance (2026-11-17): the current error says the API now wants `ID!` while the workflow passes String, and #12982's String-passing approach predates that flip — if invalidated, report "fix PR likely needs rework" as info only; still no new issue, a maintainer owns the PR ([onboard $iteration failure hits only source-internal authors](../learnings/1794387437154-slang-issue-onboard-iteration-failure-hits-only-so.md), [onboard setIteration GraphQL failure is TRACKED (#12982)](../learnings/1794874087474-slang-issue-onboard-setiteration-graphql-failure-i.md)).

`Check IR Version` failures on the master run list are likewise bot-infra, not code: the workflow fails at the "Create or update comment" step with GitHub 403 "At least one email address must be verified to do that" when posting its IR-version advisory comment. Merge-queue trap: `git/matching-refs/heads/gh-readonly-queue/master` can list STALE leftover refs for PRs merged/closed months ago (old check-run `started_at` timestamps); identify them by the PR number encoded in the ref name, confirm currency via master head advancing, and don't treat stale refs as gating current merges ([Check IR Version / Issue Onboard failures are bot-infra](../learnings/1794888227180-master-scan-check-ir-version-issue-onboard-failure.md)).

## Triage Handoffs: Attach Material, Verify Numbers

Coworker containers do NOT share filesystems: a path like `/workspace/agent/slang/build-noexc` cited in a triage handoff was invisible to the fixer, which checked, found nothing, and rebuilt the tree itself (correct fallback). Attach the actual files (`send_file`) or inline their full contents in the message body; give command flags inline, never "run the command I saved at …" ([handoff paths are container-local](../learnings/1794814261744-handoff-paths-are-container-local-attach-files-don.md)). And when a handoff lists "related open PRs" by number, verify the kind before planning around them: `gh pr view <n>` errors on issue numbers ("Could not resolve to a PullRequest") — fall back to `gh issue view <n>` (issues and PRs share one number space, but pr view only resolves PRs). On the #14215 test-infra umbrella the "related PRs #14249/#14250/#14257/#14258/#14260" were actually open fallout ISSUES, flipping the verdict from "implementation in flight" to "core already merged" ([verify handed-off numbers are PRs before planning](../learnings/1794885464925-verify-handed-off-numbers-are-prs-before-planning-.md)).

**Source learnings (9):**

- [Only an explicit stand-down stops the bot](../learnings/1794884111425-correction-only-an-explicit-stand-down-stops-the-bot.md)
- [Issue-closing is maintainer-only; hook matches text](../learnings/1794824034217-issue-closing-is-maintainer-only-for-slang-triager.md)
- [Core-team umbrella post decision; log either way](../learnings/1794891487671-triage-post-decision-on-core-team-tracking-umbrell.md)
- [GraphQL issueType authoritative; Language Maturity exists](../learnings/1794892431490-slang-issue-type-language-maturity-exists-graphql-.md)
- [Onboard $iteration failure hits source-internal authors](../learnings/1794387437154-slang-issue-onboard-iteration-failure-hits-only-so.md)
- [Onboard setIteration failure TRACKED via PR #12982](../learnings/1794874087474-slang-issue-onboard-setiteration-graphql-failure-i.md)
- [Check IR Version/Onboard failures are bot-infra, not regressions](../learnings/1794888227180-master-scan-check-ir-version-issue-onboard-failure.md)
- [Handoff paths are container-local; attach files](../learnings/1794814261744-handoff-paths-are-container-local-attach-files-don.md)
- [Verify handed-off numbers are PRs before planning](../learnings/1794885464925-verify-handed-off-numbers-are-prs-before-planning-.md)

_Catalog: [[wiki/index.md]]_
