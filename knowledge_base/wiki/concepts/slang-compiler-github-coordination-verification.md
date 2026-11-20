---
title: "Slang Compiler: GitHub Coordination Verification"
type: concept
group: slang-grab-bag
tags: [github, pr-workflow, duplicate-pr, review-branch, branch-parent, attribution, support-bot, ping, coordination]
source_count: 3
---

# Slang Compiler: GitHub Coordination Verification

Verify live GitHub state before acting on or writing about someone else's work: the reporter's own PR, a pushed review branch's parent, and the support bot's issue filings. All three cases (slang#14632, #14633, #14607) punished acting on stale assumptions.

## TL;DR

- Check for the reporter's own PR landing right before `gh pr create` on a triaged community issue — a CLA can clear mid-fix and produce a duplicate PR.
- Verify a pushed review branch's parent sha before trusting it as the patch base; the branch may be test-only on master while the patch was authored against a PR head.
- The support bot's answer surface is GitHub filings, not in-channel replies — check nv-slang-bot's issue outbound before writing "the bot never replied".
- An inbound ping proves arrival, never authorship: resolve who filed at the counterparty (issue `user.login` + `created_at`) before restating a story, and sweep every artifact carrying the wrong variant.

## The reporter can open their own PR mid-fix (slang#14632/#14633)

Check for the reporter's own PR landing BEFORE `gh pr create` on a triaged community issue. On slang#14632 (2026-11-19) the reporter said "no PR yet, CLA pending"; ~40 min into the bot's build their CLA cleared and they opened PR #14633 with the exact fix the bot's branch carried. The cheap guard: one `gh api graphql` PR list for the issue (or `gh pr view`) right before the create step. The recovery that keeps everyone whole: do NOT open the duplicate — contribute the delta yours has and theirs lacks (here: the hermetic regression test) via the reporter's PR in patch-comment form, since cross-fork PRs into contributor forks are undeliverable through the gateway (repos other than shader-slang/slang return app_not_connected). If your branch was already pushed to origin, delete the superseded remote branch (keep the local one for history); force-moving your own not-yet-consumed contribution branch after review nits is fine — name the new head in the follow-up comment and mark any inline patch already posted as pre-review [Reporter can open their own PR mid-fix — check before opening yours](../learnings/1795102087102-reporter-can-open-their-own-pr-mid-fix-check-befor.md).

## Verify a pushed review branch's parent before trusting it as the patch base

When a fixer says "test patch attached; same commit pushed as branch X", do not assume branch X contains fix+test. On slang#14632 the pushed branch `nvrtc-soname-lookup-test` (e4c939b1b) was test-only on master (parent a4d69f877) while the patch was authored against PR #14633's head (a29bcef). Always check the branch's parent sha against the PR head (`gh api repos/<o>/<r>/branches/<name> --jq '{sha, parent: .commit.parents[0].sha}'`) before choosing the review base. For a test patch authored on a PR head, the patch-on-PR-head recipe (bare clone, fetch `+pull/<n>/head:refs/heads/master` from GitHub directly, revA/revC clones pinned and verified at the head, REPO_ROOT override, --mode patch) gives reviewers the fix as surrounding context and the test as the diff [Verify a pushed review branch's parent before trusting it as the patch base (slang#14632)](../learnings/1795096264140-verify-a-pushed-review-branch-s-parent-before-trus.md).

## The support bot answers pings via GitHub filings, not in-channel

Before writing "the bot never replied to the ping" in a sweep report, check nv-slang-bot's GitHub outbound (REST: `api.github.com/repos/shader-slang/slang/issues?creator=nv-slang-bot[bot]`, sorted by created desc) — the support bot's answer surface is GitHub (its Discord send allowlist blocks in-channel replies), so replies manifest as filed issues minutes after a visible "apparently it's not listening" remark. Case 2026-11-18/19: a user pinged 18:26Z, said "Apparently it's not listening" 19:22Z; the bot filed slang#14607 at 19:27:32Z (verified via the API author field), yet a sweep report wrongly credited the user with "doing the bot's job" because the ping was never connected to the filing. Attribution rule: an inbound ping proves arrival, never authorship — resolve who filed at the counterparty (issue `user.login` + `created_at`) before restating the story, and sweep every artifact carrying the wrong variant (report, pending-questions, reconciliation, drafts index — the drafts index carried an even wronger sibling) [The support bot answers pings via GitHub filings, not in-channel — check nv-slang-bot's issue outbound before writing "never replied"](../learnings/1795076462686-the-support-bot-answers-pings-via-github-filings-n.md).

**Source learnings (3):**
- [check the reporter's PR right before `gh pr create`; contribute the delta via their PR; cross-fork PRs undeliverable via gateway](../learnings/1795102087102-reporter-can-open-their-own-pr-mid-fix-check-befor.md)
- [verify branch parent vs PR head before using it as review base; patch-on-PR-head recipe](../learnings/1795096264140-verify-a-pushed-review-branch-s-parent-before-trus.md)
- [bot replies = GitHub filings; a ping proves arrival, never authorship; sweep all wrong-variant artifacts](../learnings/1795076462686-the-support-bot-answers-pings-via-github-filings-n.md)

_Catalog: [[wiki/index.md]]_
