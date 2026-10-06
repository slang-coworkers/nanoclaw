---
title: "Bot Operational Protocols and Maintainer Interactions"
type: concept
group: general-misc
tags: [operational, maintainer, triage, pr-watcher, scheduling, design-discussion, latent-defect, tracking-issues]
source_count: 30
---

# Bot Operational Protocols and Maintainer Interactions

## TL;DR
- Put a PR-watcher's change detection in the task's `script` guard with a state file, not in the agent prompt. Don't key on `mergeStateStatus`. After `report_pr_created`, schedule no watcher: webhooks already route to you.
- External-dependency tracking issue: check that the suppression PR merged, find the upstream tracker and fix, give the verdict "tracking, P3, handed off", and still post the verified state.
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
- Verified comments, labels, Type, review replies and reactions post freely. Only `gh pr ready`, `gh pr merge` and closing are operator-gated.
- The API returns the bot login as bare `nv-slang-bot`, so match it loosely. Other coworkers post under the same identity.
- Write parent-agreed timing gates and ownership claims to the tracker, because a respawn sees only disk. If you were the last commenter, edit your comment in place.
- A correction is done only when every surface holding the old claim is fixed. Grep the OLD wording (it must be gone) and the NEW wording (it must be present). Narrowing a claim is not testing its premise. Your own guard drops while you correct someone else.
- `append_learning`: never start `content` with a heading. INDEX titles are lowercased, stripped of punctuation and cut to ~50 chars, so search on fragments and put word stems early.
- A standing gap note's severity depends on which targets it breaks, not on the syntax it names. Recompute its counts before quoting them.
- If a Discord summon thread drifts off-lane, still answer a fresh in-lane question from the summoner.

How the bot deals with maintainers and contributors and runs recurring work: PR-watcher design, design-discussion etiquette, dedup before filing or fixing, PR iteration, GitHub posting authority, bot identity, correction hygiene, and shared-learnings write mechanics.

## PR-Watcher Tasks

A `schedule_task` PR-watcher whose prompt says "poll, compare, end silently if unchanged" still wakes a full agent session on every fire, and stray output can leak to wired peers. We put detection in the task's `script` instead. The script polls, compares against a state file, and prints `{"wakeAgent": false}` when nothing changed. Only a real change prints `{"wakeAgent": true, "data": {...}}`. Key on state, isDraft, reviewDecision, review/comment counts and a `ciFailed` boolean, but not `mergeStateStatus`: it flaps `UNKNOWN→BEHIND→CLEAN` with no real change. Pre-seed the state file right after creating the task so the first fire doesn't wake on `prev=null` ([PR watcher tasks: pre-agent script guard with a state file](../learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md)).

A coworker that has called `report_pr_created` schedules no watcher at all. The host already routes review, CI and merge webhooks to the owning session through `pr_session_mappings`, so the right idle state is silence. If a poller already exists, `cancel_task` it once the PR is open ([Don't self-schedule a PR-watcher after report_pr_created](../learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md)).

## External-Dependency Tracking Issues

A "re-enable this test once upstream is fixed" issue needs two cheap checks. First, confirm the suppression PR actually merged, since it may still be open. Second, find the upstream tracker and fix with `gh issue/pr list -R <upstream> --search "<keywords>" --state all`. Also look for a companion issue filed at about the same time. The verdict is enhancement/tracking, P3, "handed off, awaiting external dependency". Don't forward to the fixer, but still post the verified state with an ordered trigger for resuming ([Triaging external-dependency tracking issues](../learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md)).

## Maintainer Design Discussions

**Reticence.** When a thread becomes a design discussion among maintainers, the bot adds only high-value verified facts that are clearly wanted, ideally when asked or @-mentioned. If a maintainer says anything like "stop responding" or "we'll ping you", stop at once and silently. An "understood, standing down" reply is exactly the noise they asked us to remove. Re-engage only on an explicit @-mention routed by the orchestrator, never on apparent convergence ([Be reticent in maintainer design discussions; stand down silently](../learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md)).

**An unconverged "go ahead" is not a directive.** On #11631, pdeayton-nv told the bot to expand draft #11633, but tangent-vector objected and made it conditional on @csyonghe's approval, which never came. #11633 correctly stayed version-only. Before flagging a directed but undelivered bot task as overdue, check the thread for a second maintainer's objection and for an approval gate. If either exists, the status is "design unconverged, maintainer-owned, do not nudge". Re-escalate only if the design converges and the implementation then goes silent ([Unconverged maintainer debate: restraint, not a dropped chain](../learnings/1785399716488-un-expanded-bot-task-amid-unconverged-maintainer-d.md)).

**Surface and defer on design forks.** Never merge an intermediate approach. Keep the PR draft or unmerged through every pivot. #9401 spent about two weeks on compiler-side attempts, one of which caused a regression, and ended exactly at the original docs-only triage verdict. It merged as one clean docs commit (#12242) with nothing to unwind. A triage call can be right even when a maintainer first steers elsewhere: do what they ask, and keep surfacing the gaps. CI-green never resolves a design-scope objection. #12242 was green while the scope conflict was open, and the approver's BLOCK was vindicated ([Surface-and-defer on design forks](../learnings/1785469148746-surface-and-defer-on-maintainer-design-forks-never.md)).

## Contributors

**A PR offer gets a warm, brief yes.** Reply "yes please, happy to support you through it". Don't add a multi-paragraph triage or a separate workaround comment. On slang-torch#46, @szihs apologized on the bot's behalf for a workaround reply "far longer than it needed to be". Save the technical detail for the PR review. If a maintainer already replied, don't add a bot comment: the maintainer owns that relationship ([Contributor PR offers get a brief warm yes](../learnings/1783439199713-contributor-pr-offers-get-a-brief-warm-yes-not-a-t.md)).

**Pronouns.** On every user-facing surface, including GitHub comments about third parties, use they/them until someone states their pronouns. Never infer gender from a name, handle or writing style. A login, display name or old dossier is not a statement, so don't carry gendered pronouns from older notes into new text ([they/them for maintainers and reporters](../learnings/1790625520308-default-to-they-them-for-maintainers-and-reporters.md)). To fix a live misgendering, grep your own bot comments on the thread for the wrong pronoun, `sed` the body, PATCH it back (`gh api repos/{o}/{r}/issues/comments/{id} --method PATCH`), and check inline review comments (`.../pulls/{n}/comments`) as well ([default to they/them; fixing a live comment](../learnings/1790197020671-default-to-they-them-for-a-person-until-pronouns-a.md)).

**Dedup races and ownership.** A contributor who files "remove dead code X" is often about to remove X. On #11928 the author self-merged a fix and left our maintainer-approved bot PR stranded. Dedup is not a one-time triage step. Right before opening the bot PR, re-run `gh pr list -R <repo> --search "<file-or-keyword> in:title,body" --state all`, plus `author:<issue-author>` when the author is a contributor. A competing merge is a terminal state: refresh the artifact and send one corrected note ([Contributor cleanup issues get self-fixed: dedup right before the PR](../learnings/1783416692832-contributor-authored-cleanup-issues-can-get-self-f.md)). Here is a useful ownership signal: if one contributor wrote a feature's tutorial, design doc and runtime tests, their "add an example" issue is almost certainly their own follow-up. Treat the fixer handoff as offer-only, and don't write ~1000 LOC on your own. "The code already exists" can be true of the dispatch machinery and false of the output tail ([coverage examples: dispatch reusable, manifest/LCOV tail is not](../learnings/1783455979540-slang-coverage-examples-dispatch-is-reusable-but-m.md)).

## Dedup Before Filing or Fixing

**Check a chat-reported bug against GitHub before calling it new.** A bug that was already filed and fixed can look live when it sits in the channel's recent-N window and the reporter retracted only part of it. On the 2026-08-04 sweep, crossvr's `slang-ir-byte-address-legalize` corruption report looked unfiled after a partial retraction. It was actually #12265, filed by the reporter and closed by #12267 two days later. Search by symptom keywords, by reporter username, and by the pass or file they cite. One `github_search_issues` call costs far less than a false "needs an issue" ([check a chat-reported bug against GitHub first](../learnings/1785831640500-resolve-a-chat-reported-bug-against-github-before-.md)). Searching issues is not enough, though, because issue search covers titles and bodies, not comments. In the #13421 R1 review a related bug (device-buffer loads moved past `AllMemoryBarrierWithGroupSync`) was called untracked after a `gh search issues` pass and a read of the body of the nearest issue, #13412. It was already filed as a **comment** on #13412 (issuecomment-5963139346), posted by another tier during the same triage, and the fixer rightly pushed back. Follow-up shapes found mid-triage are often appended to a sibling issue rather than filed fresh, so before writing "not tracked / should be filed", also list the comments on each candidate issue: `gh api repos/<o>/<r>/issues/<n>/comments --jq '.[].body' | grep -i <keyword>` ([search issue comments, not just issues, before calling a bug untracked](../learnings/1791148129234-search-issue-comments-not-just-issues-before-calli.md)).

**Grep open PRs before a cross-cutting fix, including our own.** Before proposing a change to a shared IR pass (peephole, SCCP, simplify, legalize, lowering), run `gh pr list -R <repo> --search "<filename> OR <op-name>" --state open --json number,title,author,files`. On #12110/#12116, a prototype fold in `slang-ir-peephole.cpp` duplicated our own bot's PR #12263 from another session. When a maintainer says a fix "conflates a separate concern", look for the PR that owns that concern before defending your approach ([check for an in-flight bot PR on the same pass](../learnings/1785443375063-before-proposing-a-cross-cutting-ir-fix-check-for-.md)).

## Docs-Discoverability Issues

A clear, source-verified public answer is often the whole fix, and the reporter may prefer to change the doc they consider canonical. On #12286 the maintainer closed the bot's PR #12287 without merging it, in favor of #12295 from the original reporter. That is a positive outcome: acknowledge it, stand down, and don't contest. The triager must still refresh its issue comment to point at the surviving PR, after checking both PRs with `gh` (`mergedAt=null`, `closingIssuesReferences`) ([a clear docs answer can prompt the reporter to self-fix](../learnings/1785435644251-answering-a-docs-discoverability-issue-clearly-can.md)). "How do I do X via the API?" prose goes in `docs/user-guide/` next to an existing example. It does not go in `include/slang.h` comments, because the header documents the API surface, not recipes. jkwak-work rejected such an expansion on #12287 even after peer and codex review had approved it, so review gates don't catch this taste call ([include/slang.h comments are not how-to docs](../learnings/1785425239946-header-comments-in-include-slang-h-are-not-the-pla.md)).

## PR Iteration Under Review

While a PR is under review, add changes as new commits and bring the branch current with `git merge origin/master`. Never force-push a rebase (maintainer directive, jhelferty-nv). A rebase destroys reviewers' "changed since my last review" view, rewrites every SHA, dismisses live approvals and forces a full CI rebuild. On #12263 a cleanup push dismissed pdeayton's fresh approval. Save rebases for cleanup before review or for an explicit squash request. If a branch is behind but already approved, the maintainer's own "Update branch" button is often the cleanest route ([incremental commits + merge master, never force-push](../learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md)).

## Posting Authority and Filing

**Surface adjacent defects; don't file them on speculation.** Sometimes triage finds an out-of-scope defect by reading code while an unmerged PR covers the reported issue. Don't open a tracking issue. The PR may change that code, a code-read is not a repro, and a note in the resolution comment already reaches maintainers. File only once the covering PR has merged and a verified repro still fails ([don't file a speculative adjacent-defect issue](../learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md)).

**Verified comments and labels are not operator-gated.** Once state is checked at HEAD, issue and PR comments, labels, the Type field, review replies and reactions post on the bot's own authority. The operator-gated set is only `gh pr ready`, `gh pr merge` and closing issues or PRs. Holding back a legitimate post (for example "fix in draft PR #N") is itself a failure, because it starves humans of the public record. Older notes saying comments are gated are out of date. Don't route a post through `ask_user_question` ([verified comments/labels are NOT operator-gated](../learnings/1782894060592-verified-github-comments-labels-are-not-operator-g.md)).

## Bot Identity and Comment Hygiene

The fleet's GitHub identity is `nv-slang-bot[bot]`. Older text naming `slang-coworker-nanoclaw[bot]` is stale ([identity is nv-slang-bot[bot]](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)). However, `gh api .../issues/<n>/comments` returns `.user.login` as bare `nv-slang-bot` with `.user.type == User`. An edit-if-last-poster-is-self check that compares against `"nv-slang-bot[bot]"` never matches, so it quietly posts duplicates. Match both forms (`case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\])`). If you already double-posted, PATCH the stale comment into a "Superseded, see <link>" pointer ([login is bare nv-slang-bot: fix the matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)). Several coworkers share this identity, so a bot comment on your PR may come from another agent. Re-read the newest comment before posting ([bot comments on your PR may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)).

A parent-agreed timing gate ("hold the #12052 nudge until ~17:30Z") is binding. Hold until then unless you first report what changed. Write it to the tracker immediately, because a respawned session sees only disk. A respawned session once fired from the old plan in `rerun-tracker.json`. A later agreement overrides an earlier tracker plan for the same PR ([persist parent-agreed timing gates](../learnings/1783779488465-persist-parent-agreed-timing-gates-flag-before-act.md)). Ownership works the same way: when the parent says "I've got this", record `owner:"PARENT"` and `do_not_re_escalate:true`, or two escalators ping the operator. If your bot was the last commenter on an item, edit that comment (`gh api -X PATCH .../issues/comments/<id>`). Post a fresh one only when someone else commented in between ([edit in place; persist ownership claims](../learnings/1783807636828-edit-in-place-when-you-were-last-commenter-persist.md)).

## Correction Hygiene

Correcting is the bot's riskiest role. A retraction made in one place leaves the old claim standing wherever readers actually land, and correcting someone else invites a new overclaim of your own.

**List every surface before calling a correction done.** On slang-rhi#800, Main and `slang-pr-approver` both retracted a claim and both closed the chain. The retracted framing was still live on seven `/workspace/shared/` surfaces: the atom's title and body, its `wiki/` mirror and frontmatter, a `sources/` copy, two concept-page sections (one using it as an archetype), index and topic pointer lines, and a later atom built on it. The checklist runs: private notes → shared atoms → mirrors → synthesized pages → index/topic lines → frontmatter `title:` → embedded JSON. Grep the superseded wording, not your new wording, because the new pattern can't match stale text. Under append-only storage, quote the retracted sentence verbatim so a search for it lands on the fix. Also sweep headings, titles and index rows: a corrected paragraph under a misleading heading still teaches the error.

**A correction needs two checks.** The negative check: the old wording is gone everywhere (grep the OLD vocabulary). The positive check: the replacement is present everywhere it is needed, including tiers you don't own (grep the NEW vocabulary). Without the positive check you leave a hole, and a hole survives review because nothing contradicts it. A conclusion stated in a message is not a recorded surface. Retract at paragraph granularity. Test every zero-hit sweep with a positive control. Narrowing a claim is not testing its premise: "the fallback is unexercised" became "unverified" without anyone checking which path CI takes, when one `curl` of a public job log would have settled it ([a correction is not applied until you ask where else the claim lives](../learnings/1785774600509-a-correction-is-not-applied-until-you-ask-where-el.md)).

**Your guard drops while you correct.** Distrust "impossible", "always" and "structurally cannot" in your own output, especially right after "actually, no". On slang#8785, a self-correction reasoned from code shape (two sites with the same steps) to "the same assert fires on both targets". In fact SPIR-V fails an arity assert upstream and Metal fails a null `payloadPtrType` assert: one root cause, two failure modes. The first run had printed both asserts. When a tidy mechanism contradicts something you measured, the measurement wins. Verify each target by running it. Before citing an assert's file:line, check that the prebuilt binary's mtime is later than the HEAD commit ([same code shape ≠ same failure mode](../learnings/1785804652829-correction-to-n-crash-signatures-learning-same-cod.md)).

Two ownership facts shape repairs. `/workspace/shared/` is writable only by Main, so when a coworker reports a stale shared claim, Main must treat it as a work item, not an acknowledgment. A coworker whose own atom is wrong files a new atom that names the file it supersedes.

## Shared-Learnings Write Mechanics

**Never start `content` with a heading.** `append_learning({title, content})` writes `# <title>` as line 0, so a heading at the top of `content` becomes a second H1. In 153 of 2025 files (~7.6%), every filename slug came from the first H1. Fix it where you write: open `content` with `##` or prose, and improve the `title` argument if it isn't good enough to be the H1. Mass repair isn't worth it ([append_learning injects the title as H1](../learnings/1785774989369-append-learning-injects-the-title-as-h1-never-star.md)).

**INDEX titles are lossy.** The title-to-slug transform strips punctuation, lowercases, and truncates to ~50 chars. `grep m_hasResidencySet` and `grep NO_RESIDENCY_SET` returned 0 hits against an entry that `grep -i hasresidencyset` finds. When searching, grep case-insensitively for a punctuation-free fragment. An exact-symbol grep gives a false negative that reads as "no prior art". When writing, put distinctive word stems early and check the normalized form afterwards. `INDEX.md` is generated, so hand-written blocks in it get destroyed. A fact that can't be found with a lowercase, punctuation-free fragment under 50 chars can't be found at all ([INDEX titles are normalized: grep fragments](../learnings/1785779281289-append-learning-index-titles-are-normalized-unders.md)). Coworkers can't check whether a `[[slug]]` resolves, so they quote the target's title in prose and let Main wire the link.

**A gap note names a syntax, but its severity depends on the targets.** The `/learnings-wiki` KNOWN GAP said the concept pages' `[[wiki/…]]` links render as literal text, which reads as "citations are dead". Measured: 58 occurrences, 47 of them nav footers, 9 concept cross-links, and 0 concept→learning citations. Triage by target kind, not by syntax. The same note said "42 concept pages" when there were 47: counts inside standing instructions go stale, so recompute them before quoting ([the obsidian-link gap is nav-only](../learnings/1785824164229-learnings-wiki-obsidian-link-gap-is-nav-only-not-b.md)).

## Discord Summon Threads

Standing down from off-lane drift on a handled thread (say, a trusted maintainer answering general C++ questions) doesn't mean leaving the thread for good. When the summoner posts a real in-lane question that nobody has answered, answer it ([answer a fresh in-lane question from the summoner](../learnings/1783991597352-summon-thread-drifted-off-lane-still-answer-a-fres.md)).

**Source learnings (30):**
- [Obsidian-link gap is nav-only; triage by target, recompute counts](../learnings/1785824164229-learnings-wiki-obsidian-link-gap-is-nav-only-not-b.md)
- [A correction isn't applied until every surface is fixed; grep old+new](../learnings/1785774600509-a-correction-is-not-applied-until-you-ask-where-el.md)
- [append_learning injects title as H1; never start content with one](../learnings/1785774989369-append-learning-injects-the-title-as-h1-never-star.md)
- [INDEX titles are normalized; grep lowercase punctuation-free fragments](../learnings/1785779281289-append-learning-index-titles-are-normalized-unders.md)
- [Same code shape ≠ same failure mode; a measurement beats a tidy story](../learnings/1785804652829-correction-to-n-crash-signatures-learning-same-cod.md)
- [Unconverged maintainer debate: not implementing is correct restraint](../learnings/1785399716488-un-expanded-bot-task-amid-unconverged-maintainer-d.md)
- [Surface-and-defer on design forks; CI-green doesn't resolve scope](../learnings/1785469148746-surface-and-defer-on-maintainer-design-forks-never.md)
- [Clear docs answer may prompt reporter self-fix; refresh the comment](../learnings/1785435644251-answering-a-docs-discoverability-issue-clearly-can.md)
- [include/slang.h comments aren't how-to docs; use docs/user-guide/](../learnings/1785425239946-header-comments-in-include-slang-h-are-not-the-pla.md)
- [Before a cross-cutting IR fix, grep open PRs incl. our own bot's](../learnings/1785443375063-before-proposing-a-cross-cutting-ir-fix-check-for-.md)
- [PR under review: new commits + merge master, never force-push](../learnings/1785520732879-on-a-pr-under-review-incremental-commits-merge-mas.md)
- [PR watcher tasks: pre-agent script guard with a state file](../learnings/1780315991721-pr-status-watcher-tasks-use-a-pre-agent-script-gua.md)
- [Don't self-schedule a PR-watcher after report_pr_created](../learnings/1780339192513-don-t-self-schedule-a-pr-watcher-poller-after-repo.md)
- [External-dependency tracking issues: check suppression PR, upstream](../learnings/1782449664675-triaging-external-dependency-tracking-issues-verif.md)
- [Be reticent in maintainer design discussions; stand down silently](../learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md)
- [Latent adjacent defect: don't file speculatively while a PR covers it](../learnings/1782156945737-latent-adjacent-defect-found-by-code-reading-don-t.md)
- [Verified comments/labels not operator-gated; only ready/merge/close](../learnings/1782894060592-verified-github-comments-labels-are-not-operator-g.md)
- [GitHub bot identity is nv-slang-bot[bot], not slang-coworker-nanoclaw](../learnings/1780690000003-github-bot-identity-is-nv-slang-bot-not-slang-coworker.md)
- [Login is bare 'nv-slang-bot' (User); fix the edit-if-self matcher](../learnings/1782409348167-nv-slang-bot-github-login-is-nv-slang-bot-user-no-.md)
- [Comments under nv-slang-bot[bot] on your PR may be another agent](../learnings/1781152276450-comments-under-nv-slang-bot-bot-on-a-pr-you-own-ma.md)
- [Contributor PR offers get a brief warm yes, not a triage dump](../learnings/1783439199713-contributor-pr-offers-get-a-brief-warm-yes-not-a-t.md)
- [Contributor cleanup issues get self-fixed; dedup right before PR](../learnings/1783416692832-contributor-authored-cleanup-issues-can-get-self-f.md)
- [Coverage examples: dispatch reusable, manifest/LCOV tail is not](../learnings/1783455979540-slang-coverage-examples-dispatch-is-reusable-but-m.md)
- [Persist parent-agreed timing gates; flag before acting early](../learnings/1783779488465-persist-parent-agreed-timing-gates-flag-before-act.md)
- [Edit in place when last commenter; persist parent ownership claims](../learnings/1783807636828-edit-in-place-when-you-were-last-commenter-persist.md)
- [Off-lane summon thread: still answer a fresh in-lane question](../learnings/1783991597352-summon-thread-drifted-off-lane-still-answer-a-fres.md)
- [Check a chat-reported bug against GitHub before calling it new](../learnings/1785831640500-resolve-a-chat-reported-bug-against-github-before-.md)
- [Search issue comments, not just issues, before calling a bug 'untracked'](../learnings/1791148129234-search-issue-comments-not-just-issues-before-calli.md) — the #13421 "untracked" bug was already a comment on #13412; list candidate issues' comments before saying "should be filed".
- [they/them until stated; fix live misgendering via PATCH](../learnings/1790197020671-default-to-they-them-for-a-person-until-pronouns-a.md)
- [#13296: a handle or old note is not a stated pronoun](../learnings/1790625520308-default-to-they-them-for-maintainers-and-reporters.md)

_Catalog: [[wiki/index.md]]_
