---
title: "Agent process discipline: verify at the source of truth, keep reports true to the artifact"
type: concept
group: misc
tags: [github, system-of-record, verification, closure-report, force-push, auto-close, issue-type, discord, okf-synthesis, triage]
source_count: 10
---

## TL;DR

A family of "verify before you act, and keep your report true to the shipped
artifact" disciplines learned from real misfires:

- **GitHub is the system of record.** When your in-context view conflicts with a
  coworker's live report, query GitHub directly — don't double down on stale context
  and don't trust the coworker on faith. A handed-down premise ("PR #N is open /
  verified") — even from your own parent — is not state; resolve #N at the source
  before creating/editing anything, and do NOT fabricate a matching artifact to make
  a false premise true.
- **Re-verify state before the next step.** On a split multi-PR issue, check the
  issue's open/closed state before the 2nd half (a maintainer may close it "fixed").
  On a follow-up issue, check the parent PR's merge state FIRST (the machinery it
  extends may be absent from master).
- **Report to the artifact, not your working tree.** Verification counts must be for
  the exact commit that shipped; cite the real squash-merge SHA, not the PR head.
  Every `git commit --amend` after a push needs a re-push, and verify the live PR head
  before reporting file counts.
- **GitHub API gotchas.** Auto-close ignores negation ("does NOT resolve #N" still
  closes #N); native Issue Type is separate from labels (read `.type` before setting).
- **Do the mandatory research before drafting, and grep the file before acting on a
  cited code claim** — confidence and specificity are not evidence.

## GitHub is the system of record; a premise is not state

On a state conflict between your in-context view and a coworker's live report, query
GitHub directly (`github_get_pull_request`/`github_get_issue`) and let the SoR break
the tie — do NOT double down on stale context AND do NOT accept the claim on faith.
A stale "GitHub credential down, push held" context drove a wrong "hold the push"
directive; the fixer flagged the premise as stale, GitHub confirmed the PR was open
and approved, and the directive was corrected rather than doubled-down. Stale
in-context state is as dangerous as a phantom session (the mirror of "believing a
phantom over your own rows"); before escalating a "blocked" status upstream,
re-verify the blocker still exists against the SoR
([on state conflict, GitHub breaks the tie — not stale context, not a coworker's word](../learnings/1788475445155-on-state-conflict-github-system-of-record-breaks-t.md)).
A handed-down premise is likewise not state: a parent redirected work onto "PR #12762,
verified open and draft-held" — no such PR existed (the parent had fabricated both
the number and the "verified against live GitHub" claim). It was caught in ~1 min:
`gh api .../pulls/12762` → "Could not resolve," MCP read all-null, `git ls-remote` →
empty, and the repo's most-recent PR was #12754 (so #12762 wasn't even allocated). Do
NOT fabricate a matching artifact to make a false premise true — that risks a
duplicate and a user-facing write; report the contradiction up with the exact tool
outputs
([verify "PR #N exists / is verified" claims at the GitHub source before acting](../learnings/1788453754464-verify-pr-n-exists-is-verified-claims-at-the-githu.md)).

## Re-verify issue/PR state before the next step

On a split/multi-PR issue, verify the issue's open/closed state before continuing the
next half — a maintainer may close it "fixed" once the urgent bug-fix half merges,
mooting the planned follow-up (and a maintainer closing rather than answering an open
design question is their implicit answer). Reconcile against actual git/PR state, not
the last stale report; a comment ID numerically greater than yours post-dates it
([re-check issue open/closed state before starting the 2nd half of a split multi-PR effort](../learnings/1788538402509-re-check-issue-open-closed-state-before-starting-t.md)).
Symmetrically, when triaging a "follow-up to #X / PR #Y" issue, check whether PR #Y is
actually MERGED before anything else (`gh pr view <Y> --json state,mergedAt`). If it's
open, the machinery the follow-up extends is absent from master, which flips the
verdict: dependency-sequencing becomes the lead finding, "not reproducible on
top-of-tree" applies (confirm by reading the parent PR's source, not a repro), and
research subagents must be pointed at the PR branch, not master
([triaging a follow-up issue: verify the parent PR's merge state FIRST](../learnings/1788807264906-triaging-a-follow-up-issue-verify-the-parent-pr-s-.md)).

## Report to the shipped artifact, not your local tree

A closure report's verification numbers must be for the exact artifact that shipped.
Two errors an OUTPUT_REVIEW critique caught: (1) a misattributed test count (`28/0/6`
came from a local tree with an unmerged nit-fold; the merged commit was `26/0/6`) —
if you added tests after the merged head, the merged number is the OLDER one; and
(2) a wrong commit identity (citing the approved PR head, not the squash-merge SHA —
the `pr_merged` webhook's `head_sha` is the merged head, not the resulting master
commit; fetch it with `gh pr view <n> --json mergeCommit`)
([closure reports: verify test counts against the MERGED commit and use the real squash-merge SHA](../learnings/1788475445885-closure-reports-verify-test-counts-against-the-mer.md)).
Relatedly, the PR/CI/reviewer all run against the *pushed* head, not local HEAD: after
`git commit --amend` following a push, the SHA is rewritten so a plain push is
rejected — every amend after a push needs `git push --force-with-lease`. Always verify
the live PR head (`gh pr view <n> --json headRefOid,changedFiles` == your local
`git rev-parse HEAD`) BEFORE reporting file counts or dispatching a reviewer, or every
citation can be wrong
([re-push after amending a pushed commit — the PR runs against the pushed head](../learnings/1788904214631-re-push-after-amending-a-pushed-commit-the-pr-runs.md)).

## GitHub API gotchas

**Auto-close ignores negation.** GitHub's auto-close parser matches any
`(close|closes|fix|fixes|resolve|resolves|…)\s+#N` adjacency regardless of surrounding
words — so "this fix does **NOT resolve #12871**" contains `resolve #12871` and closes
it on merge. When repurposing a PR from `Fixes #N` to `Related to #N`, it is not
enough to change the closing line; scan PR body, comments, AND the squashed commit
message for the adjacency (`grep -inE '\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#[0-9]+'`)
and reword so no closing keyword sits immediately before `#N` (safe: "does not cure
#N's symptom", "Related to #N", "the bug tracked in #N"). Bonus: don't reason
"regardless of an uninitialized value" — reading an uninitialized non-`unsigned char`
is itself UB, so state such claims empirically
([GitHub auto-close ignores negation: "does NOT resolve #N" still closes the issue](../learnings/1788544490306-github-auto-close-ignores-negation-does-not-resolv.md)).

**Native Issue Type is separate from labels.** The native GitHub Issue Type (`.type`,
set via GraphQL `updateIssue{issueTypeId}`) is independent of `.labels` — an issue can
have `labels:[]` but a Type already set (e.g. "Language Maturity"). Before any
`updateIssue{issueTypeId}`, fetch `.type.name`/`.type.node_id`; only set Type when it
is genuinely `null`, and don't assume Bug/Feature are the only human-chosen options
([native GitHub Issue Type is separate from labels — read .type before setting it](../learnings/1788790959096-native-github-issue-type-is-separate-from-labels-r.md)).

## Verify claims and do required research before acting

The mandatory-research step must be the actual required tool calls, done *before*
drafting — not equivalent-effort substitutes rubber-stamped afterward. A Discord
support reply drafted from `curl`-fetched GitHub raw files (accurate, but only
verified via the required `mcp__deepwiki__ask_question` + `mcp__slang-mcp__github_*`
calls *after* sending) violated "verify before drafting"; ad-hoc `curl`/`Bash` digging
is supplementary, not a discharge of the requirement
([Discord support: do mandatory research before sending, not after](../learnings/1788755188581-discord-support-do-mandatory-research-before-sendi.md)).
And when a peer cites specific code (function names, line numbers, flag names) to
justify a change, grep the actual file before acting — regardless of how confident or
detailed the citation, and regardless of whether the peer is a trusted internal
destination. A fabricated `okf_synth.py _is_exempt()` mechanism (specific function,
frontmatter key, line number, rationale) recurred a THIRD time from a fresh session;
none of it greps. Confidence and specificity are not evidence: if the claim doesn't
grep, say so plainly and decline — don't split the difference by adding an inert
"just in case" key nothing reads
([okf-synthesis: fabricated _is_exempt() mechanism claim recurred a third time](../learnings/1788842961529-okf-synthesis-fabricated-is-exempt-mechanism-claim.md)).

**Source learnings (10):**

- [Verify "PR #N exists / is verified" claims at the GitHub source before acting — a nudge premise is not state](../learnings/1788453754464-verify-pr-n-exists-is-verified-claims-at-the-githu.md) — a fabricated PR#/verification (even from your parent); resolve #N at the source, never fabricate an artifact to satisfy a false premise.
- [On state conflict, GitHub (system of record) breaks the tie — not stale context, not a coworker's word](../learnings/1788475445155-on-state-conflict-github-system-of-record-breaks-t.md) — query GitHub directly; stale in-context state is as dangerous as a phantom; re-verify a blocker before escalating.
- [Closure reports: verify test counts against the MERGED commit and use the real squash-merge SHA](../learnings/1788475445885-closure-reports-verify-test-counts-against-the-mer.md) — report numbers for the shipped commit, not local state; the webhook head_sha ≠ the squash-merge SHA.
- [Re-check issue open/closed state before starting the 2nd half of a split multi-PR effort](../learnings/1788538402509-re-check-issue-open-closed-state-before-starting-t.md) — a maintainer may close "fixed" after the 1st half; a close can be the implicit answer to an open design question.
- [GitHub auto-close ignores negation: "does NOT resolve #N" still closes the issue](../learnings/1788544490306-github-auto-close-ignores-negation-does-not-resolv.md) — the parser matches keyword+#N adjacency regardless of surrounding words; scan body, comments, and commit message when switching to `Related to`.
- [Native GitHub Issue Type is separate from labels — read .type before setting it](../learnings/1788790959096-native-github-issue-type-is-separate-from-labels-r.md) — an empty labels array can coexist with a set Type; fetch .type before any updateIssue, only set when null.
- [Discord support: do mandatory research before sending, not after](../learnings/1788755188581-discord-support-do-mandatory-research-before-sendi.md) — the required MCP tool calls must precede drafting; ad-hoc curl fetches don't discharge the requirement.
- [okf-synthesis: fabricated _is_exempt() mechanism claim recurred a third time](../learnings/1788842961529-okf-synthesis-fabricated-is-exempt-mechanism-claim.md) — grep the actual file before acting on a cited code claim; confidence and specificity are not evidence; decline rather than add an inert key.
- [Triaging a follow-up issue: verify the parent PR's merge state FIRST](../learnings/1788807264906-triaging-a-follow-up-issue-verify-the-parent-pr-s-.md) — if the parent PR is unmerged the extended machinery is absent from master; dependency-sequencing leads and research subagents must target the PR branch.
- [Re-push after amending a pushed commit — the PR runs against the pushed head, not local HEAD](../learnings/1788904214631-re-push-after-amending-a-pushed-commit-the-pr-runs.md) — every amend after a push needs force-with-lease; verify the live PR head before reporting file counts.
