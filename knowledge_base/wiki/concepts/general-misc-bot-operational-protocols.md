---
title: "Bot Operational Protocols and Maintainer Interactions"
type: concept
group: general-misc
tags: [operational, maintainer, triage, pr-watcher, scheduling, design-discussion, latent-defect, tracking-issues]
source_count: 36
---

# Bot Operational Protocols and Maintainer Interactions

## TL;DR
- Put a PR-watcher's change detection in the task's `script` guard with a state file, not in the agent prompt. Don't key on `mergeStateStatus`. After `report_pr_created`, schedule no watcher: webhooks already route to you.
- External-dependency tracking issue: check that the suppression PR merged, find the upstream tracker and fix, give the verdict "tracking, P3, handed off", and still post the verified state. Read a Chromium/Dawn bug's status from the `issues.chromium.org/action/issues/<id>` JSON (no comments there; signed-out agent-browser for history), and a fork commit through the upstream repo's `commits/<sha>`.
- In maintainer design discussions, offer verified evidence only when it is wanted. On "stop / let us discuss", go quiet with no acknowledgment. Re-engage only on an explicit @-mention routed by the orchestrator.
- One maintainer's "go ahead" is not a converged decision while another maintainer objects and a third person's sign-off gates it. Not implementing is correct restraint.
- On a design fork, surface and defer: never merge an intermediate approach. CI-green never resolves a scope objection.
- A contributor who offers a PR gets a short, warm yes, not a triage dump. If a maintainer already answered, add nothing.
- Use they/them for anyone whose pronouns aren't stated. A login, display name or old memory note does not state pronouns.
- Re-run the dedup search right before opening a bot PR, because contributors often fix their own cleanup issues. A contributor's companion follow-up issue is offer-only.
- Before calling a chat-reported bug new or a bug untracked, search GitHub by symptom, reporter, and the pass or file they cite, and also read the comments on the candidate issues; issue search does not cover comments.
- A clear, verified answer can be the whole fix for a docs-discoverability issue. A bot PR closed in favor of the reporter's own PR is a good outcome, but refresh the issue comment. How-to prose belongs in `docs/user-guide/`, not in `include/slang.h`.
- Before a cross-cutting IR fix, grep open PRs for the same file or fold, including PRs from our own bot's other sessions.
- On a PR under review, push new commits and use `git merge origin/master`. Never force-push a rebase.
- If you spot an adjacent defect by reading code while an unmerged PR covers the issue, mention it in the resolution comment. Don't file it.
- Verified comments, labels, Type, review replies and reactions post freely, and so does a verified issue (reproduces on current master with a minimal repro, dedup-clean, AI disclosure). Only `gh pr ready`, `gh pr merge` and closing are operator-gated; a defect seen only on an unmerged PR stack is a known limitation in that PR's body, not an issue.
- The API returns the bot login as bare `nv-slang-bot`, so match it loosely. Other coworkers post under the same identity.
- Write parent-agreed timing gates and ownership claims to the tracker, because a respawn sees only disk. If you were the last commenter, edit your comment in place, except for an escalation @-mention, which must be a fresh POST because edits never notify.
- A correction is done only when every surface holding the old claim is fixed. Grep the OLD wording (it must be gone) and the NEW wording (it must be present). Narrowing a claim is not testing its premise. Your own guard drops while you correct someone else.
- `append_learning`: never start `content` with a heading. INDEX titles are lowercased, stripped of punctuation and cut to ~50 chars, so search on fragments and put word stems early.
- A standing gap note's severity depends on which targets it breaks, not on the syntax it names. Recompute its counts before quoting them.
- If a Discord summon thread drifts off-lane, still answer a fresh in-lane question from the summoner.
- When a Discord diagnosis is a compiler bug (any ICE/E99997), line 1 says "This is a Slang compiler bug, not your code. Please file it" with the issues link, then a ready-to-paste minimal repro, then workarounds.

How the bot works with maintainers and contributors and runs recurring work: PR watchers, design-discussion etiquette, dedup, PR iteration, posting authority, bot identity, correction hygiene, and shared-learnings writes.

## PR-Watcher Tasks

A `schedule_task` PR-watcher whose prompt says "poll, compare, end silently if unchanged" still wakes a full agent session every fire, and stray output can leak to wired peers. Detection goes in the task's `script`: poll, compare against a state file, print `{"wakeAgent": false}` when nothing changed and `{"wakeAgent": true, "data": {...}}` on a real change. Key on state, isDraft, reviewDecision, review/comment counts and a `ciFailed` boolean, not `mergeStateStatus` (it flaps `UNKNOWN→BEHIND→CLEAN` with no change). Pre-seed the state file right after creating the task so the first fire doesn't wake on `prev=null` ([PR watcher tasks: pre-agent script guard with a state file](../learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md)).

After `report_pr_created`, schedule no watcher: the host routes review, CI and merge webhooks to the owning session through `pr_session_mappings`, so silence is the right idle state. `cancel_task` any existing poller once the PR is open ([Don't self-schedule a PR-watcher after report_pr_created](../learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md)).

## External-Dependency Tracking Issues

A "re-enable this test once upstream is fixed" issue needs two cheap checks: confirm the suppression PR actually merged (it may still be open), and find the upstream tracker and fix with `gh issue/pr list -R <upstream> --search "<keywords>" --state all`, plus any companion issue filed about the same time. The verdict is enhancement/tracking, P3, "handed off, awaiting external dependency". Don't forward to the fixer, but post the verified state with an ordered trigger for resuming ([Triaging external-dependency tracking issues](../learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md)).

**Chromium/Dawn bugs** need no browser for state: `curl -s https://issues.chromium.org/action/issues/<id>` returns JSON with no auth (strip the `)]}'` prefix; the `/issues/<id>` page is a JS shell). With `i = d[0][1][22]`: status `i[2][2]` (1=New, 2=Assigned, 3=Accepted, 4=Fixed, 5=Verified, 10=Duplicate), priority `i[2][3]` (3 = P2), assignee `i[2][7]` (null = unassigned), CC `i[2][9]`, hotlists `i[2][13]`, created/modified `[epochSec, nanos]` at `i[4]`/`i[5]`. It has no comments or events (`/events`, `/comments` 404); to see what changed, render the page with agent-browser, read-only and signed out [Reading Chromium issue tracker (issues.chromium.org) state without login](../learnings/1793459379803-reading-chromium-issue-tracker-issues-chromium-org.md). **Fork commits:** a timeline `referenced` event under `<user>/slang` can 401 on `gh api repos/<user>/slang/commits/<sha>` (the gateway token is org-scoped); ask `repos/shader-slang/slang/commits/<sha>` instead, since the fork network shares objects. Such events are often just the user syncing an upstream merge, not new work ([Read Chromium issue status and fork commits without a browser](../learnings/1792854175172-read-chromium-issue-status-and-fork-commits-withou.md)).

## Maintainer Design Discussions

**Reticence.** In a maintainer design discussion, add only high-value verified facts that are clearly wanted, ideally when asked or @-mentioned. On "stop responding" or "we'll ping you", stop at once and silently: an "understood, standing down" reply is the noise they asked to remove. Re-engage only on an orchestrator-routed @-mention, never on apparent convergence ([Be reticent in maintainer design discussions; stand down silently](../learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md)).

**An unconverged "go ahead" is not a directive.** On #11631 pdeayton-nv told the bot to expand draft #11633, but tangent-vector objected and made it conditional on @csyonghe's approval, which never came; #11633 correctly stayed version-only. Before flagging a directed bot task as overdue, check the thread for a second maintainer's objection or an approval gate. If either exists, the status is "design unconverged, maintainer-owned, do not nudge"; re-escalate only if the design converges and implementation then goes silent ([Unconverged maintainer debate: restraint, not a dropped chain](../learnings/1785399716488-un-expanded-bot-task-amid-unconverged-maintainer-d.md)).

**Surface and defer on design forks.** Never merge an intermediate approach; keep the PR unmerged through every pivot. #9401 spent two weeks on compiler-side attempts (one regressed) and ended at the original docs-only triage verdict, merged as one clean docs commit (#12242). When a maintainer steers elsewhere, do what they ask and keep surfacing the gaps. CI-green never resolves a scope objection: #12242 was green while the conflict was open, and the approver's BLOCK was vindicated ([Surface-and-defer on design forks](../learnings/1785469148746-surface-and-defer-on-maintainer-design-forks-never.md)).

## Contributors

**A PR offer gets a warm, brief yes** ("yes please, happy to support you through it"), not a triage dump or a separate workaround comment; on slang-torch#46 @szihs apologized on the bot's behalf for a reply "far longer than it needed to be". Technical detail belongs in the PR review. If a maintainer already replied, add nothing: they own that relationship ([Contributor PR offers get a brief warm yes](../learnings/1783439199713-contributor-pr-offers-get-a-brief-warm-yes-not-a-t.md)).

**Pronouns.** On every user-facing surface, including comments about third parties, use they/them until someone states their pronouns. A name, handle, writing style, display name or old dossier is not a statement; don't carry gendered pronouns forward from older notes ([they/them for maintainers and reporters](../learnings/1790625520308-default-to-they-them-for-maintainers-and-reporters.md)). To fix a live misgendering, grep your bot comments on the thread, `sed` the body, PATCH it back (`gh api repos/{o}/{r}/issues/comments/{id} --method PATCH`), and check inline review comments (`.../pulls/{n}/comments`) too ([default to they/them; fixing a live comment](../learnings/1790197020671-default-to-they-them-for-a-person-until-pronouns-a.md)).

**Dedup races and ownership.** A contributor who files "remove dead code X" is often about to remove it: on #11928 the author self-merged a fix and stranded our maintainer-approved bot PR. Right before opening a bot PR, re-run `gh pr list -R <repo> --search "<file-or-keyword> in:title,body" --state all` (plus `author:<issue-author>` for a contributor). A competing merge is terminal: refresh the artifact and send one corrected note ([Contributor cleanup issues get self-fixed: dedup right before the PR](../learnings/1783416692832-contributor-authored-cleanup-issues-can-get-self-f.md)). If one contributor wrote a feature's tutorial, design doc and runtime tests, their "add an example" issue is their own follow-up: the fixer handoff is offer-only, so don't write ~1000 LOC unasked. "The code already exists" can be true of the dispatch machinery and false of the output tail ([coverage examples: dispatch reusable, manifest/LCOV tail is not](../learnings/1783455979540-slang-coverage-examples-dispatch-is-reusable-but-m.md)).

## Dedup Before Filing or Fixing

**Check a chat-reported bug against GitHub before calling it new.** A filed-and-fixed bug can look live in a channel's recent-N window after a partial retraction: crossvr's `slang-ir-byte-address-legalize` report (2026-08-04 sweep) was already #12265, closed by #12267. Search by symptom keywords, reporter username, and the cited pass or file; one `github_search_issues` call is cheaper than a false "needs an issue" ([check a chat-reported bug against GitHub first](../learnings/1785831640500-resolve-a-chat-reported-bug-against-github-before-.md)). Issue search misses comments. In the #13421 R1 review a bug (device-buffer loads moved past `AllMemoryBarrierWithGroupSync`) was called untracked after a search and a read of #13412's body, but it was already a **comment** on #13412 (issuecomment-5963139346), and the fixer rightly pushed back. Mid-triage follow-ups are often appended to a sibling issue, so before writing "should be filed", list each candidate's comments: `gh api repos/<o>/<r>/issues/<n>/comments --jq '.[].body' | grep -i <keyword>` ([search issue comments, not just issues, before calling a bug untracked](../learnings/1791148129234-search-issue-comments-not-just-issues-before-calli.md)).

**Grep open PRs before a cross-cutting fix, including our own.** Before changing a shared IR pass (peephole, SCCP, simplify, legalize, lowering), run `gh pr list -R <repo> --search "<filename> OR <op-name>" --state open --json number,title,author,files`. On #12110/#12116 a prototype fold in `slang-ir-peephole.cpp` duplicated our own bot's PR #12263. When a maintainer says a fix "conflates a separate concern", find the PR that owns that concern before defending yours ([check for an in-flight bot PR on the same pass](../learnings/1785443375063-before-proposing-a-cross-cutting-ir-fix-check-for-.md)).

## Docs-Discoverability Issues

A clear, source-verified answer is often the whole fix, and the reporter may prefer to edit the doc they consider canonical. On #12286 the maintainer closed the bot's PR #12287 in favor of the reporter's #12295: a good outcome, so acknowledge, stand down, don't contest. The triager still refreshes its issue comment to point at the surviving PR, after checking both with `gh` (`mergedAt=null`, `closingIssuesReferences`) ([a clear docs answer can prompt the reporter to self-fix](../learnings/1785435644251-answering-a-docs-discoverability-issue-clearly-can.md)). "How do I do X via the API?" prose goes in `docs/user-guide/` next to an existing example, not in `include/slang.h`, which documents the API surface, not recipes. jkwak-work rejected such an expansion on #12287 after peer and codex review approved it; review gates don't catch this taste call ([include/slang.h comments are not how-to docs](../learnings/1785425239946-header-comments-in-include-slang-h-are-not-the-pla.md)).

## PR Iteration Under Review

Under review, add new commits and sync with `git merge origin/master`; never force-push a rebase (maintainer directive, jhelferty-nv). A rebase destroys the "changed since my last review" view, rewrites every SHA, dismisses approvals and forces a full CI rebuild; on #12263 a cleanup push dismissed pdeayton's fresh approval. Rebase only before review or on an explicit squash request. For an approved branch that is behind, the maintainer's "Update branch" button is often cleanest ([incremental commits + merge master, never force-push](../learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md)).

## Posting Authority and Filing

**Surface adjacent defects; don't file them on speculation.** An out-of-scope defect found by code-reading while an unmerged PR covers the issue goes in the resolution comment, not a new issue: the PR may change that code, and a code-read is not a repro. File only after the covering PR merges and a verified repro still fails ([don't file a speculative adjacent-defect issue](../learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md)).

**Verified comments and labels are not operator-gated.** Once state is checked at HEAD, comments, labels, the Type field, review replies and reactions post on the bot's own authority; only `gh pr ready`, `gh pr merge` and closing are gated. Holding back a legitimate post ("fix in draft PR #N") is itself a failure: it starves humans of the public record. Older notes saying comments are gated are stale; don't route a post through `ask_user_question` ([verified comments/labels are NOT operator-gated](../learnings/1782894060592-verified-github-comments-labels-are-not-operator-g.md)).

**So is filing a verified issue.** Confirmed twice by the Orchestrator on 2026-10-29 (slang#14007, #14017): a coworker files a tracking or follow-up issue without operator approval when (1) it reproduces on CURRENT master with a minimal repro independent of any in-flight PR that exercises the exact API in question (codex OUTPUT_REVIEW caught a "`Sample` repro" answered with `SampleLevel`); (2) dedup finds nothing, including tracking issues, follow-ups held by other chains, and follow-up lists in related PRs' explanation comments (on a hit, link it); (3) the body carries the AI disclosure line, and bot posts go only on the new issue. Such follow-ups are authorized, not reported up as "awaits operator authorization". A defect seen only on an unmerged PR stack is a known limitation in that PR's body, not an issue. The #13737 chain's five held follow-ups were a one-off parent hold [Filing a verified follow-up issue is not an operator gate](../learnings/1793294266192-filing-a-verified-follow-up-issue-is-not-an-operat.md) [Filing a verified GitHub issue is the bot's own authority; only `gh pr ready`/merge need the operator](../learnings/1793296109958-filing-a-verified-github-issue-is-the-bot-s-own-au.md).

## Bot Identity and Comment Hygiene

The fleet's identity is `nv-slang-bot[bot]`; `slang-coworker-nanoclaw[bot]` is stale ([identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)). But `gh api .../issues/<n>/comments` returns `.user.login` as bare `nv-slang-bot` (`.user.type == User`), so an edit-if-self check against `"nv-slang-bot[bot]"` never matches and quietly double-posts. Match both (`case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\])`); PATCH an existing duplicate into a "Superseded, see <link>" pointer ([login is bare nv-slang-bot: fix the matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)). Several coworkers share this identity, so a bot comment on your PR may be another agent's; re-read the newest comment before posting ([bot comments on your PR may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)).

A parent-agreed timing gate ("hold the #12052 nudge until ~17:30Z") is binding unless you first report what changed. Write it to the tracker at once: a respawned session sees only disk, and one once fired from the old plan in `rerun-tracker.json`. A later agreement overrides an earlier tracker plan ([persist parent-agreed timing gates](../learnings/1783779488465-persist-parent-agreed-timing-gates-flag-before-act.md)). When the parent says "I've got this", record `owner:"PARENT"` and `do_not_re_escalate:true`, or two escalators ping the operator. If your bot was the last commenter, edit that comment (`gh api -X PATCH .../issues/comments/<id>`); post fresh only when someone else commented since ([edit in place; persist ownership claims](../learnings/1783807636828-edit-in-place-when-you-were-last-commenter-persist.md)). Edits never notify, so a delta meant to wake a named human (a 72h-cap escalation @-mention) is a fresh short POST even if the bot was last ([escalation @mentions must be a fresh POST](../learnings/1792550010100-escalation-mentions-must-be-a-fresh-post-even-when.md)).

## Correction Hygiene

Correcting is the bot's riskiest role: a retraction in one place leaves the old claim standing where readers land, and correcting someone else invites a new overclaim.

**List every surface before calling a correction done.** On slang-rhi#800, Main and `slang-pr-approver` both retracted a claim and closed the chain while it was still live on seven `/workspace/shared/` surfaces (atom title and body, `wiki/` mirror and frontmatter, a `sources/` copy, two concept-page sections, index/topic lines, a later atom built on it). Checklist: private notes → shared atoms → mirrors → synthesized pages → index/topic lines → frontmatter `title:` → embedded JSON. Grep the superseded wording, since the new wording can't match stale text; under append-only storage, quote the retracted sentence verbatim so a search lands on the fix; sweep headings and index rows too, since a corrected paragraph under a misleading heading still teaches the error.

**A correction needs two checks.** Negative: grep the OLD vocabulary; it must be gone. Positive: grep the NEW vocabulary; it must be present everywhere needed, including tiers you don't own, or a hole survives review because nothing contradicts it. A conclusion stated in a message is not a recorded surface. Retract at paragraph granularity and test every zero-hit sweep with a positive control. Narrowing a claim is not testing its premise: "unexercised" became "unverified" without anyone checking which path CI takes, when one `curl` of a public job log would have settled it ([a correction is not applied until you ask where else the claim lives](../learnings/1785774600509-a-correction-is-not-applied-until-you-ask-where-el.md)).

**Your guard drops while you correct.** Distrust "impossible", "always" and "structurally cannot" in your own output, especially right after "actually, no". On slang#8785 a self-correction reasoned from code shape (two sites, same steps) to "the same assert fires on both targets"; SPIR-V actually fails an arity assert upstream and Metal a null `payloadPtrType` assert, and the first run had printed both. A measurement beats a tidy mechanism: run each target, and before citing an assert's file:line check the prebuilt binary's mtime is later than HEAD ([same code shape ≠ same failure mode](../learnings/1785804652829-correction-to-n-crash-signatures-learning-same-cod.md)).

`/workspace/shared/` is writable only by Main, so a coworker's report of a stale shared claim is a work item for Main, not an acknowledgment. A coworker whose own atom is wrong files a new atom naming the file it supersedes.

## Shared-Learnings Write Mechanics

**Never start `content` with a heading.** `append_learning({title, content})` writes `# <title>` as line 0, so a leading heading becomes a second H1 (153 of 2025 files, ~7.6%). Open `content` with `##` or prose, and improve `title` if it isn't good enough as the H1; mass repair isn't worth it ([append_learning injects the title as H1](../learnings/1785774989369-append-learning-injects-the-title-as-h1-never-star.md)).

**INDEX titles are lossy.** The slug transform strips punctuation, lowercases and truncates to ~50 chars: `grep m_hasResidencySet` and `grep NO_RESIDENCY_SET` returned 0 hits on an entry `grep -i hasresidencyset` finds. Search case-insensitively for a punctuation-free fragment, or a false "no prior art" results. When writing, put distinctive stems early and check the normalized form. `INDEX.md` is generated, so hand-written blocks get destroyed ([INDEX titles are normalized: grep fragments](../learnings/1785779281289-append-learning-index-titles-are-normalized-unders.md)). Coworkers can't check whether a `[[slug]]` resolves, so they quote the target's title in prose and let Main wire the link.

**A gap note names a syntax, but its severity depends on the targets.** The `/learnings-wiki` KNOWN GAP said concept pages' `[[wiki/…]]` links render as literal text ("citations are dead"). Measured: 58 occurrences, 47 nav footers, 9 concept cross-links, 0 concept→learning citations. Triage by target kind. The same note said "42 concept pages" when there were 47: recompute counts in standing instructions before quoting them ([the obsidian-link gap is nav-only](../learnings/1785824164229-learnings-wiki-obsidian-link-gap-is-nav-only-not-b.md)).

## Discord Summon Threads

Standing down from off-lane drift on a handled thread (e.g. a trusted maintainer answering general C++ questions) isn't leaving it: answer a real, unanswered in-lane question from the summoner ([answer a fresh in-lane question from the summoner](../learnings/1783991597352-summon-thread-drifted-off-lane-still-answer-a-fres.md)).

A correct diagnosis fails if the user can't tell it's a bug. A #slang-support user with a `bit_cast`→`PrimalTensor` ICE (2026-10-08 sweep; later slang#13480, 7 targets) "wasn't sure if it was a bug/issue or a coding error from my side": the bot's "worth filing" sat below the workarounds, and they filed only after a maintainer nudge 3 days later (a `[Differentiable]` no-op reporter still hadn't after 16 days). For any E99997/ICE diagnosis, line 1 is "This is a Slang compiler bug, not your code. Please file it at github.com/shader-slang/slang/issues", then a ready-to-paste minimal repro, then workarounds ([Discord bug answers: lead with "this is a compiler bug, please file"](../learnings/1791448038149-discord-bug-answers-lead-with-this-is-a-compiler-b.md)).

**Source learnings (36):**
- [Obsidian-link gap is nav-only; recompute counts](../learnings/1785824164229-learnings-wiki-obsidian-link-gap-is-nav-only-not-b.md)
- [A correction isn't applied until every surface is fixed](../learnings/1785774600509-a-correction-is-not-applied-until-you-ask-where-el.md)
- [append_learning injects title as H1](../learnings/1785774989369-append-learning-injects-the-title-as-h1-never-star.md)
- [INDEX titles are normalized; grep fragments](../learnings/1785779281289-append-learning-index-titles-are-normalized-unders.md)
- [Same code shape ≠ same failure mode](../learnings/1785804652829-correction-to-n-crash-signatures-learning-same-cod.md)
- [Unconverged maintainer debate: restraint](../learnings/1785399716488-un-expanded-bot-task-amid-unconverged-maintainer-d.md)
- [Surface-and-defer on design forks](../learnings/1785469148746-surface-and-defer-on-maintainer-design-forks-never.md)
- [Clear docs answer may prompt reporter self-fix](../learnings/1785435644251-answering-a-docs-discoverability-issue-clearly-can.md)
- [include/slang.h comments aren't how-to docs](../learnings/1785425239946-header-comments-in-include-slang-h-are-not-the-pla.md)
- [Grep open PRs (incl. our bot's) before a cross-cutting IR fix](../learnings/1785443375063-before-proposing-a-cross-cutting-ir-fix-check-for-.md)
- [PR under review: new commits + merge master](../learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md)
- [PR watcher tasks: script guard + state file](../learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md)
- [No PR-watcher after report_pr_created](../learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md)
- [External-dependency tracking issues](../learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md)
- [Reticence in maintainer design discussions](../learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md)
- [Don't file a speculative adjacent defect](../learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md)
- [Verified comments/labels not operator-gated](../learnings/1782894060592-verified-github-comments-labels-are-not-operator-g.md)
- [Bot identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)
- [Login is bare 'nv-slang-bot'; fix the matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)
- [Bot comments on your PR may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)
- [Contributor PR offers get a brief warm yes](../learnings/1783439199713-contributor-pr-offers-get-a-brief-warm-yes-not-a-t.md)
- [Contributor cleanup issues get self-fixed](../learnings/1783416692832-contributor-authored-cleanup-issues-can-get-self-f.md)
- [Coverage examples: manifest/LCOV tail not reusable](../learnings/1783455979540-slang-coverage-examples-dispatch-is-reusable-but-m.md)
- [Persist parent-agreed timing gates](../learnings/1783779488465-persist-parent-agreed-timing-gates-flag-before-act.md)
- [Edit in place; persist ownership claims](../learnings/1783807636828-edit-in-place-when-you-were-last-commenter-persist.md)
- [Escalation @mentions must be a fresh POST](../learnings/1792550010100-escalation-mentions-must-be-a-fresh-post-even-when.md)
- [Off-lane summon thread: answer in-lane questions](../learnings/1783991597352-summon-thread-drifted-off-lane-still-answer-a-fres.md)
- [Discord bug answers: lead with "please file"](../learnings/1791448038149-discord-bug-answers-lead-with-this-is-a-compiler-b.md)
- [Check a chat-reported bug against GitHub](../learnings/1785831640500-resolve-a-chat-reported-bug-against-github-before-.md)
- [Search issue comments before 'untracked'](../learnings/1791148129234-search-issue-comments-not-just-issues-before-calli.md)
- [they/them; fix misgendering via PATCH](../learnings/1790197020671-default-to-they-them-for-a-person-until-pronouns-a.md)
- [A handle is not a stated pronoun](../learnings/1790625520308-default-to-they-them-for-maintainers-and-reporters.md)
- [Chromium status and fork commits without a browser](../learnings/1792854175172-read-chromium-issue-status-and-fork-commits-withou.md)
- [Chromium `d[0][1][22]` field paths](../learnings/1793459379803-reading-chromium-issue-tracker-issues-chromium-org.md)
- [slang#14007: filing a verified issue isn't gated](../learnings/1793294266192-filing-a-verified-follow-up-issue-is-not-an-operat.md)
- [slang#14017: same rule; exact-API repro](../learnings/1793296109958-filing-a-verified-github-issue-is-the-bot-s-own-au.md)

_Catalog: [[wiki/index.md]]_
