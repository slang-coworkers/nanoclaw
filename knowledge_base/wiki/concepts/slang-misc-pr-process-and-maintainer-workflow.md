---
title: "Slang PR Process, Maintainer Workflow, and Issue Lifecycle"
type: concept
group: slang-grab-bag
tags: [maintainer, PR-process, merge-queue, CI, GitHub-Actions, issue-lifecycle, bot-permissions, regression-verification, declined-issues, superseded-PRs]
source_count: 53
---

# Slang PR Process, Maintainer Workflow, and Issue Lifecycle

## TL;DR

- The on-call maintainer rotates ~biweekly: look it up live; search the channel for the *topic* (and threads), not a reply.
- Internal "APPROVE-clean" verdicts are invisible on GitHub; reconcile handoffs against the live PR.
- `mergeable_state` says THAT a requirement is unmet, never WHICH; `mergeable=true` is not `reviewDecision=APPROVED`. "Approved at head" needs `commit_id == head` AND `submittedAt` after the head commit. `COMMENTED` is not a verdict.
- Any new head commit dismisses an APPROVE: push after one only when required, then say "dismissed, awaiting re-approval". `behind` is not a rebase cue and does not block the merge queue.
- Events under jhelferty-nv's or jkiviluoto-nv's login within seconds of an Actions run are automation; count only written comments.
- Verify a merge by CONTENT, not ancestry (squash rewrites SHAs); a blocked verification call means UNKNOWN.
- Required check names = kebab-case job key. A `failed_checks` eviction CLEARS auto-merge → manual requeue.
- Verify against checkout HEAD, not a stale `build/Release/bin/slangc`; author-date in a [good,bad] window is not release membership.
- Bot writes: POST a comment once; re-push after the LAST amend BEFORE `gh pr create`; no `--assignee`/`--reviewer` on bot PRs even when asked (@-mention instead).
- Codegen asymmetry: lift the BAD leg to the good one (#12004). Doc-vs-behavior: measure the behavior fix's cost (#11682).
- Comments describe code as-is (no history, no PR pointers); touch existing comments only when their code changed; a long comment for an exceptional case means remove the case.
- **A clean textual merge proves nothing semantic**: test sibling PRs on a scratch merge; after merging master into an API-changing PR, grep master's added files for removed forms.
- **Reassignment after the bot's draft PR exists → freeze, don't stand down** (#13463/#13475).
- **No new dedicated test when the existing tests you updated already go red→green** (#14438); add one only for a case they miss.
- **Size the fix to the feature's usage** (#14247): for a rarely used feature with a trivial workaround, offer the minimal option beside the producer-side fix.

Companion: [[wiki/concepts/slang-pr-maintainer-scope-and-evidence.md]] (draft-PR footprint, maintainer-decision reversals).

## Maintainer Identity and Rotation

The on-call maintainer rotates ~every two weeks (or ad hoc), so routing, @-mentions and escalation use a live lookup via the Slang Maintainer agent ([maintainer is dynamic](../learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)). `tfoley` in TODOs is Theresa Foley ("Tess"), per `.mailmap` ([tfoley is Theresa Foley](../learnings/1777487718343-slang-compiler-tess-foley-name.md)).

The "who is the next Slang Maintainer?" prompt in `#slang-committers` (`1352357976878481468`) rarely gets a direct reply; humans name it in passing. Map IDs → handles via `/workspace/agent/memory/github-to-discord.json` ([rotation evidence](../learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md)). `discord_read_messages` omits thread replies; one answer sat in the *previous* ask's thread, so read both ([read thread replies](../learnings/1793177249369-watch-list-sweep-judge-a-ci-delivery-fix-by-the-ra.md)). The PR-board-sync shepherd is only a hint: for a Community/Bot PR `pr-board-sync.yml` picks a linked-issue assignee, else the top committer-signal owner, else the sorted-first `shader-slang/slang-maintainer` member (`pickFallbackAssignee`; `jkwak-work` sorts before `kaizhangNV`). A shepherd switch (kaizhangNV 11-06/07, jkwak-work from 11-08) may mean the team changed, but a committer-signal pick posts the same "Auto-assigned @X" comment and the team is unreadable without `/orgs/` calls ([board-sync shepherd is a hint](../learnings/1794299573104-slang-pr-board-sync-fallback-shepherd-sorted-first.md)).

**Automation acts under human logins.** The triage automation uses jhelferty-nv's login ("a minor configuration error", #13693): assignments, milestones, review requests, board events and "do not reply" board-sync comments under it are automation (see [supervisor over-flag](agent-supervisor-staleness-and-overflag.md)) ([jhelferty-nv automation](../learnings/1793176874441-jhelferty-nv-s-github-identity-is-used-by-the-slan.md)). jhelferty-nv's project-status changes land within 10 s of PR-maintenance runs, jkiviluoto-nv's slang-rhi `added_to_project_v2` 7 s after issue sync, and the `falcor-ci` approval after a maintainer APPROVE is recorded under jkiviluoto-nv (#14045) ([human-login automation](../learnings/1793609312966-slang-falcor-ci-gate-opens-when-a-maintainer-appro.md)).

## Reading Live PR State

Before calling a handoff merge-ready, reconcile draft status, CI, review decision and unresolved threads live ([verify live PR state](../learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)).

**`mergeable_state` is one opaque enum.** #12148 (CI green, `APPROVED` at HEAD) sat at `mergeable: true` + `mergeable_state: "blocked"` because two `requested_reviewers` had not reviewed. Read `requested_reviewers`, then `pulls/<n>/reviews`: a requested name without an APPROVED/CHANGES_REQUESTED review is outstanding. With an App token, branch `protection` returns 403 and GraphQL `reviewDecision` 401, while REST `requested_reviewers` is readable ([THAT, not WHICH](../learnings/1785791831427-mergeable-state-tells-you-that-a-requirement-is-un.md)). On #12935 "MERGEABLE since 09-16" hid an unresolved CHANGES_REQUESTED: read `gh pr view --json reviewDecision,reviews` before calling a PR idle; "repro compiles + validates" is not the reviewer's bar, and a PR with an open soundness concern does not claim `Closes #X` ([verify review state](../learnings/1790310304171-verify-a-pr-s-actual-review-state-before-framing-i.md)).

**Approvals and pushes.** A new head commit dismisses an approval (`APPROVED` → `REVIEW_REQUIRED`); body edits do not; an approval that survives a base-branch merge gets its `commit_id` rewritten to the new head (#13849) ([commit field moves](../learnings/1793176871441-github-review-commit-field-can-move-forward-to-a-l.md)). Comment-only rewords dismissed approvals on #12034 and #12009. Push after approval only for a requested code change or a real CI fix; for a cosmetic request, say it dismisses the approval and let the maintainer decide. Even a requested change costs it (#13880; a merge-master on #13815); a later CI failure is a question to the maintainer before another push ([push dismisses approval](../learnings/1793851667014-a-push-after-approval-dismisses-it-on-shader-slang.md)). `mergeable_state=behind` on an approved, conflict-free PR is benign; #13880 entered the queue 25 commits behind ([Closes #N / draft footprint](../learnings/1785751816891-closes-n-does-not-excuse-an-issue-footprint-while-.md)).

"Approved at HEAD" = `decision=="APPROVED"` plus an approval whose commit (`commit.oid` in `gh --json`, `commit_id` in REST) equals head and whose `submittedAt` postdates the head commit; with only the first two it is "approval carried forward". Supervisors check it before recording "approved" as terminal:

```
gh pr view <n> -R <owner>/<repo> --json reviewDecision,headRefOid,reviews --jq '{decision:.reviewDecision, head:.headRefOid, approvals:[.reviews[]|select(.state=="APPROVED")|{who:.author.login, commit:.commit.oid, at:.submittedAt}]}'
```

Re-requesting review is a forbidden `requested_reviewers` write; surface it upward ([comment-only commit](../learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md)).

## Verifying a Merge

`git merge-base --is-ancestor <branch-sha> origin/main` fails for a squash merge: verify by content (`git show origin/main:path/to/file`); `git rev-list --parents -n 1 <sha>` gives merge shape (1 parent = squash/fast-forward). Closure lags the merge. A blocked verification call means UNKNOWN, not UNCHANGED ([squash breaks ancestry checks](../learnings/1785780766923-squash-merge-breaks-ancestry-checks-verify-a-merge.md)).

## CI: Status Checks, Merge Queue, Falcor Workflows

Required status-check names in `shader-slang/slang` equal the job key (kebab-case), so renaming one means updating branch protection; workflow-file changes need a patch handoff (the bot lacks `workflows` permission) ([check name = job key](../learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)).

Investigate evictions via `merge_group` runs (they age out); a batch failure evicts the whole batch; most are Falcor timeout flakes ([merge-queue evictions](../learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)). The shader-coverage `vkdemo::Context` missing-default-constructor break is all-platform, not MSVC-only ([vkdemo break is all-platform](../learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)). A `failed_checks` eviction clears auto-merge (a later `autoMergeRequest = null` does not mean it was never on); the bot cannot enqueue, so a green, approved bot PR evicted by a flake needs a manual requeue. Read the timeline (`AutoMergeEnabledEvent` → `RemovedFromMergeQueueEvent`) ([eviction clears auto-merge](../learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md)).

The Falcor 3-file YML refactor (dispatcher + build + test reusable workflows) hinges on per-test-type artifact paths, `merge_group` triggers and job keys ([Falcor YML refactor](../learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)). `FALCOR_LOCAL_SLANG` is a relative, per-config build dir, and building Falcor from source needs Slang built with GFX enabled ([FALCOR_LOCAL_SLANG](../learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)).

## Bot GitHub Writes

`nv-slang-bot` can push and open PRs on `shader-slang/slang-rhi` and the other shader-slang repos; `push:false` in `.permissions` is the normal App-token shape; only a real `git push` is authoritative ([slang-rhi is bot-writable](../learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)).

**Post a comment once.** Re-running the POST to get a different `--jq` duplicates it (#12110). Capture `RESP=$(jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input -)` and read `.id` and `.html_url` from `$RESP`; then count comments and delete any duplicate you authored this turn ([POST a comment once](../learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md)).

**Re-push before `gh pr create`.** CI sees the remote branch: on #12148 four unpushed local amends left CI failing on fixed bugs. After the last amend, `git push --force origin fix/issue-<n>` (only if `origin/master..origin/fix/issue-<n>` is all bot-authored) and check `git rev-parse HEAD` matches the remote; a `ci_failed` `head_sha` ≠ local HEAD means a stale remote. Draft PRs don't auto-run CI on push: `gh workflow run ci.yml --ref fix/issue-<n>` ([re-push before gh pr create](../learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md)).

**No assignee or reviewer on bot PRs.** When jkwak asked the bot on slang#11967 to "make a PR and assign it to me," the ruling was a draft with no `--assignee`/`--reviewer`: the standing operator [MUST NOT] outranks a maintainer's mechanical request, and an @-mention in the description meets the intent. It applies at PR-open, apart from operator-gated `gh pr ready`/`merge` ([no-assignee gate](../learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md)). `Closes/Fixes #N` stays off a draft PR and does not excuse omitting the issue footprint; a discharged blocker line gets PATCHed in place.

## A Clean Textual Merge Is Not a Semantic Merge

**Sibling PRs in one diagnostic family.** #13514 (nested `try`) called its conflict with open #13503 "textual only"; the merge was clean, but its new `try-nested-throwing-call.slang` then failed: #13503 widened E30091 ("callee in 'try' does not throw") to any non-throwing `FuncType` callee, and since `//DIAGNOSTIC_TEST:SIMPLE` is exhaustive by default, #13514's rows had silently asserted E30091's absence. Merge such PRs in a scratch worktree and run both sets of new tests (["textual only" sibling conflict](../learnings/1791463760924-conflict-with-sibling-pr-is-textual-only-verify-by.md)).

**Merging master into a long-lived API-changing PR.** On stale #11344 (`_Texture<T:ITexelData>`; `Buffer` arity 2→1), code master ADDED after the PR's base using the old API merged cleanly and then failed (three core-module intrinsics, five tests). Grep `git diff --diff-filter=AM <base> origin/master -- source tests tools` for the removed forms, run the full suite, and compare failures against master at the merge SHA ([master into an API-changing PR](../learnings/1791498585662-merging-master-into-a-long-lived-api-changing-pr-t.md)).

## Regression Verification Discipline

`build/Release/bin/slangc` is not checkout HEAD: confirm binary version and ancestry before claiming a repro (slang#11483's crash was a stale pre-#11211 build) ([stale build, not master](../learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)). An author-date inside a [good, bad] window does not put a commit in a release; check `git merge-base --is-ancestor` ([commit-vs-tag ancestry](../learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)). The #11483 reporter already had #11211, so its wrong-data symptom is a distinct defect (spirv-val cannot refute it) ([#11483 wrong-data is distinct](../learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)). For coverage-manifest bugs, read the association-copy sites and consumer guards before accepting a "not propagated" root cause (#11629) ([#11629 root cause contradicted](../learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)). A P0 merge-queue stopper can be self-fixed mid-build (#11814: the reporter merged identical #11817 ~14h in); re-check `gh pr list` and the linked-PR timeline before opening a PR ([P0 stoppers self-fixed](../learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md)).

**No extra dedicated test when the updated existing tests already pin the fix.** On #14438 (`slangc -E` exit code) the bot added a 4-lane test beside updates to three existing `-E` tests that already failed on master; jkwak-work commented "Remove this test". If the tests you had to update already go red→green, add a dedicated one only for a case they miss and say why (one data point: a preference, not a rule). What worked: same-turn ack, `git rm` in a forward commit (no force-push), reply with the commit, thread left unresolved ([updated tests suffice](../learnings/1794336367823-jkwak-work-no-new-dedicated-test-when-updated-exis.md)).

## Fix-Direction Discipline

For a codegen asymmetry, converge on the good leg even if lowering it is the smaller diff. On slang#12004 (sampler-vs-texture `[noinline]` SPIR-V param asymmetry), PR #12027's Approach A (pass `SamplerState` by bindless index, like textures) was closed as "downgrading": by-value `OpTypeSampler` is the desired form, and the texture's by-index reload is the #3252 old-driver workaround (its relaxation is maintainer-owned) ([#12004 Approach A rejected](../learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md)).

A doc-vs-behavior mismatch can be fixed on either side; measure the behavior fix's cost (test churn, output, optimizations) first. On #11682 (`slangc -g0` help vs. still-emitted `OpSource`/`OpName`), a `None→Minimal` default flip defeated front-end optimizations and gating names on `None` broke ~273 tests, so the maintainer chose a one-line docs fix ([measure the cost](../learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md)).

**Size the fix to the feature's usage.** A large fix for a low-use feature can be declined outright. On slang#14247 (`printf` ICE on a `ConstantBuffer` argument), jkwak-work (reporter, assignee) closed the bot's 15-file draft #14253 ~20 min after it opened as "an overkill for the rarely used functionality", named an explicit cast as workaround, and marked it unplanned ([closed as overkill](../learnings/1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel.md)). For a low-use feature (`printf`/`abort`-style debug intrinsics), list the smallest option beside the principled one with a size estimate, or ask the assignee; a scope-widening review finding is a question for the maintainer. When a maintainer closes a bot PR, stop peer review, do not reopen or push, post one short ack ([size the fix to usage](../learnings/1793740576539-slang-maintainers-close-large-fixes-for-niche-buil.md)). Details: [[wiki/concepts/slang-compiler-printf-and-abort-variadic-arguments.md]].

## Code Comments Describe the Code As-Is

**No history, no pointers.** Maintainers (#12148) ban change-history narration ("previously we…") and PR/issue pointers ("pending #12150"); both rot at merge. Before pushing, grep new comments for `before this change|unchanged from|previously|see .* issue|pending #|deferred to` ([comments describe code as-is](../learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md)).

**Minimal churn: existing comments stay verbatim.** Touch an existing comment only when its code changed; rationale goes in the PR explanation comment. On bot PR #13283 jkwak-work's nine inline comments each asked to remove or revert a bot comment: "improved" pre-existing comments read worse, enum-value and cache doc comments were "too obvious", and internals (`FoldPolicy`, cache rationale) stay out of declaration docs ([minimal comment churn](../learnings/1791941642114-slang-maintainers-want-minimal-comment-churn-keep-.md)).

**A long comment for an exceptional case means restructure.** On slang#12701 jhelferty-nv requested changes on comment style alone: a 13-line doc block for an exceptional case is a smell; match existing human comments' style and ~70-column wrap. The fix restored every pre-existing comment and removed the case: optional `defaultArgSource` became an always-set argument, the fallback a `SLANG_RELEASE_ASSERT`, and a two-line `///` sufficed ([long comment means restructure](../learnings/1791320932441-slang-reviewers-leave-existing-comments-verbatim-a.md)). A function comment is a doc comment: one sentence on what it does, a blank `///`, then the contract if needed. Name parameters by role: `funcDeclRefForDefaultArgs`, not `defaultArgsDeclRef` ([doc-comment shape](../learnings/1791566071976-slang-doc-comments-one-sentence-what-it-does-brief.md)).

## Triage Boundaries and Park Lifecycles

A rename/branding request is a governance call: park at triage as a feature request, no fixer ([rename is governance](../learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md)). Docs for a compiler-limitation bug go in the compiler repo (SlangPy docs PR #1060 was redirected) ([docs go in the compiler repo](../learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md)). On slang#12058 the maintainer landed the ASan fix while our fixer was down, validating the triage ([#12058 validated](../learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md)). slang#12054's self-fix park flipped to a maintainer-authorized bot draft that merged ([#12054 park → bot draft shipped](../learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md)).

**Reassignment after the bot's draft PR exists is a freeze, not a stand-down.** Stand-down (#13420/#13436) covers reassignment *before* a PR exists. On slang#13463 (#13475), jkwak-work reassigned the issue 14 h after the bot draft opened, without declining it; the new assignee approved and merged the draft five days later. Keep the draft, freeze proactive bot work (no un-draft, rebase, push, re-run or @-mention), relay human comments verbatim on the canonical thread, and act only on an explicit human ask, fetching before any push. Check a fixer's counter-proposal against the code: auditing every setting's null path found a third outlier (`clangFormatFallbackStyle` null → silent LLVM style) ([reassign after a bot PR: freeze](../learnings/1791822138397-maintainer-reassign-after-a-bot-pr-exists-freeze-d.md)).

## Declined Issues, Reversals, and Superseded PRs

- **#11568 (ResourceDescriptorHeap/SamplerDescriptorHeap)**: declined for `DescriptorHandle<T>`, then reversed: the team is implementing csyonghe's `UntypedResourceHandle`/`UntypedSamplerHandle` proxy types (implicit-cast to resource types) ([#11568 reversed](../learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)). The descriptor-heap stride work (#11718) is backend-only (SPIR-V emit/CLI/diagnostics); the E39999 front-end blocker stays ([#11718 is backend-only](../learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)).
- **#11599 (clip-space Z-remap)**: declined as out of scope ([#11599 declined](../learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md)); a later GLSL-only PR got `CHANGES_REQUESTED` = "won't merge to ToT": a cherry-pickable reference, not acceptance ([#11599 reference PR](../learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)).
- **#11681 (DescriptorHandle `_coerce` guard)**: the maintainer preferred removing the dubious `ParameterGroupType` guard over a DescriptorHandle carve-out ([#11681 remove the guard](../learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)).
- **New standard-module proposals (#14020)**: maintainers steer new libraries away from standard modules (a back-compat burden) toward separate repos via the package manager: issue #12404 (`slang pkg`) and open PR #12656 (`slang-package.json` with Git-URL + version-range deps, a lock file, `v1.2`-style tags; depends on #12984). Say it is unmerged and may change; don't answer for the maintainers ([package manager refs](../learnings/1793728634729-slang-package-manager-public-refs-12404-pr-12656-s.md)).

## Discord Support Bot Routing

`slang-discord-support` writes only to summon threads in #slang-support/#slang-support-bot; channels like #slang-discussion are read-only to it ([summon threads only](../learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)).

**Source learnings (53):**
- [doc-comment shape](../learnings/1791566071976-slang-doc-comments-one-sentence-what-it-does-brief.md)
- [minimal comment churn](../learnings/1791941642114-slang-maintainers-want-minimal-comment-churn-keep-.md)
- [verify review state](../learnings/1790310304171-verify-a-pr-s-actual-review-state-before-framing-i.md)
- [Closes #N / draft footprint](../learnings/1785751816891-closes-n-does-not-excuse-an-issue-footprint-while-.md)
- [rotation from indirect evidence](../learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md)
- [mergeable_state: THAT, not WHICH](../learnings/1785791831427-mergeable-state-tells-you-that-a-requirement-is-un.md)
- [squash breaks ancestry](../learnings/1785780766923-squash-merge-breaks-ancestry-checks-verify-a-merge.md)
- [comments describe code as-is](../learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md)
- [existing comments verbatim](../learnings/1791320932441-slang-reviewers-leave-existing-comments-verbatim-a.md)
- [tfoley is Theresa Foley](../learnings/1777487718343-slang-compiler-tess-foley-name.md)
- [handoff: verify live PR state](../learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)
- [commit-vs-tag ancestry](../learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)
- [stale build, not master](../learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)
- [#11483 wrong-data distinct](../learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)
- [slang-rhi is bot-writable](../learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)
- [support bot: summon threads](../learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)
- [vkdemo break all-platform](../learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)
- [check name = job key](../learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)
- [Falcor YML refactor](../learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)
- [FALCOR_LOCAL_SLANG](../learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)
- [#11629 root cause contradicted](../learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)
- [maintainer is dynamic](../learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)
- [#11681 remove the guard](../learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)
- [#11599 declined](../learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md)
- [#11718 backend-only](../learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)
- [MQ evictions: Falcor flakes](../learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)
- [#11568 reversed](../learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)
- [#11599 reference PR](../learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)
- [P0 stoppers self-fixed](../learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md)
- [#12004 Approach A rejected](../learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md)
- [rename is governance](../learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md)
- [docs in the compiler repo](../learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md)
- [#12058 validated](../learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md)
- [#12054 park → bot draft](../learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md)
- [comment-only commit dismisses](../learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md)
- [push after approval dismisses it](../learnings/1793851667014-a-push-after-approval-dismisses-it-on-shader-slang.md)
- [review commit field moves forward](../learnings/1793176871441-github-review-commit-field-can-move-forward-to-a-l.md)
- [jhelferty-nv = triage automation](../learnings/1793176874441-jhelferty-nv-s-github-identity-is-used-by-the-slan.md)
- [automation under human logins](../learnings/1793609312966-slang-falcor-ci-gate-opens-when-a-maintainer-appro.md)
- [read thread replies](../learnings/1793177249369-watch-list-sweep-judge-a-ci-delivery-fix-by-the-ra.md)
- [board-sync shepherd = rotation hint](../learnings/1794299573104-slang-pr-board-sync-fallback-shepherd-sorted-first.md)
- [POST a comment once](../learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md)
- [re-push before gh pr create](../learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md)
- [no-assignee gate](../learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md)
- [doc-vs-behavior: measure cost](../learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md)
- [eviction clears auto-merge](../learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md)
- ["textual only" sibling conflict](../learnings/1791463760924-conflict-with-sibling-pr-is-textual-only-verify-by.md)
- [master into API-changing PR](../learnings/1791498585662-merging-master-into-a-long-lived-api-changing-pr-t.md)
- [reassign after bot PR: freeze](../learnings/1791822138397-maintainer-reassign-after-a-bot-pr-exists-freeze-d.md)
- [#14247 closed as overkill](../learnings/1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel.md)
- [size the fix to usage](../learnings/1793740576539-slang-maintainers-close-large-fixes-for-niche-buil.md)
- [package manager refs](../learnings/1793728634729-slang-package-manager-public-refs-12404-pr-12656-s.md)
- [updated tests suffice (#14438)](../learnings/1794336367823-jkwak-work-no-new-dedicated-test-when-updated-exis.md)

_Catalog: [[wiki/index.md]]_
