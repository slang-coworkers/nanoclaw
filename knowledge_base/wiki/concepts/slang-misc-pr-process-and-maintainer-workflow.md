---
title: "Slang PR Process, Maintainer Workflow, and Issue Lifecycle"
type: concept
group: slang-grab-bag
tags: [maintainer, PR-process, merge-queue, CI, GitHub-Actions, issue-lifecycle, bot-permissions, regression-verification, declined-issues, superseded-PRs]
source_count: 51
---

# Slang PR Process, Maintainer Workflow, and Issue Lifecycle

## TL;DR

- The on-call maintainer rotates ~biweekly: look it up live; reconcile by searching the channel for the *topic* (and its threads), not a reply to the bot.
- Internal "APPROVE-clean" verdicts are invisible on GitHub; reconcile every handoff against live PR state.
- `mergeable_state` says THAT a requirement is unmet, never WHICH; `mergeable=true` is not `reviewDecision=APPROVED`. "Approved at head" needs `commit_id == head` AND `submittedAt` after the head commit (GitHub carries kept approvals forward). `COMMENTED` is not a verdict.
- Don't push after an APPROVE unless required: any new head commit dismisses it; then say "dismissed, awaiting re-approval". `behind` is not a rebase cue and does not block the merge queue.
- Events under jhelferty-nv's or jkiviluoto-nv's login within seconds of an Actions run (assignments, board moves, `falcor-ci` approvals) are automation; count only written comments as human activity.
- Verify a merge by CONTENT, not ancestry (squash rewrites SHAs); auto-close lags; a blocked verification call means UNKNOWN.
- Required check names = kebab-case job key. A `failed_checks` eviction CLEARS auto-merge → manual requeue.
- Verify against checkout HEAD, not a stale `build/Release/bin/slangc`; author-date in a [good,bad] window is not release membership; re-check `gh pr list` after a long build.
- Bot writes: `push:false` in `.permissions` is normal; one comment POST yields `.id` and `.html_url`; re-push after the LAST amend BEFORE `gh pr create`. No `--assignee`/`--reviewer` on bot PRs, even when asked; @-mention instead.
- Codegen asymmetry: lift the BAD leg to the good one (#12004). Doc-vs-behavior: measure the behavior fix's cost first (#11682).
- Comments describe code as-is (no history, no PR pointers); touch existing comments only when their code changed; a long comment for an exceptional case means remove the case. Doc comment = one-sentence brief, blank `///`, contract.
- **A clean textual merge proves nothing semantic**: run both sibling PRs' new tests on a scratch merge; after merging master into an API-changing PR, grep master's added files for removed forms.
- **Reassignment after the bot's draft PR exists → freeze, don't stand down** (#13463/#13475).
- **Size the fix to the feature's usage** (#14247): for an ICE in a rarely used feature with a trivial workaround, offer the minimal diagnostic beside the producer-side fix; scope-widening review findings are questions for the maintainer.

Companion: [[wiki/concepts/slang-pr-maintainer-scope-and-evidence.md]] (draft-PR footprint, maintainer-decision reversals).

## Maintainer Identity and Rotation

The on-call duty maintainer rotates roughly every two weeks and can be reassigned ad hoc, so routing, @-mentions and escalation use a live lookup via the Slang Maintainer agent ([maintainer is dynamic](../learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)). `tfoley` in TODO comments is Theresa Foley ("Tess"), per `.mailmap` ([tfoley is Theresa Foley](../learnings/1777487718343-slang-compiler-tess-foley-name.md)).

The "who is the next Slang Maintainer?" prompt in `#slang-committers` (`1352357976878481468`) rarely gets a direct reply; humans name the maintainer in passing, so search for the topic, not a reply. Map raw Discord IDs → handles via `/workspace/agent/memory/github-to-discord.json` ([rotation from indirect evidence](../learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md)). `discord_read_messages` does not return thread replies, and one answer sat in the thread of the *previous* ask, so read both threads ([read thread replies for rotation answers](../learnings/1793177249369-watch-list-sweep-judge-a-ci-delivery-fix-by-the-ra.md)).

**Automation acts under human logins.** jhelferty-nv's login is used by the triage automation ("a minor configuration error", #13693): assignments, milestones, review requests, board events and the PR-board-sync "do not reply" comments under it are mostly automation (see [supervisor over-flag](agent-supervisor-staleness-and-overflag.md)); count only their written comments. ([jhelferty-nv's identity is used by the triage automation](../learnings/1793176874441-jhelferty-nv-s-github-identity-is-used-by-the-slan.md)). Likewise jhelferty-nv's project-status changes land within 10 s of PR-maintenance workflow runs, jkiviluoto-nv's slang-rhi `added_to_project_v2` events 7 s after the issue-sync workflow, and the `falcor-ci` approval after a maintainer's APPROVED review is recorded under jkiviluoto-nv (#14045): an event within seconds of an Actions run is automation ([falcor-ci gate; automation under human logins](../learnings/1793609312966-slang-falcor-ci-gate-opens-when-a-maintainer-appro.md)).

## Reading Live PR State

Before calling a handoff merge-ready, reconcile draft status, CI, review decision and unresolved threads on the live PR ([handoff: verify live PR state](../learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)).

**`mergeable_state` is one opaque enum.** On #12148 (CI green, `APPROVED` at HEAD) the PR sat at `mergeable: true` + `mergeable_state: "blocked"` because two `requested_reviewers` had not reviewed. Read `requested_reviewers`, then `pulls/<n>/reviews`: a requested name without an APPROVED/CHANGES_REQUESTED review is outstanding (`COMMENTED` does not discharge it). With an App token, branch `protection` returns 403 and GraphQL `reviewDecision` 401, while REST `requested_reviewers` is readable ([mergeable_state: THAT, not WHICH](../learnings/1785791831427-mergeable-state-tells-you-that-a-requirement-is-un.md)). `mergeable=true` is not `reviewDecision=APPROVED` either: on #12935, "MERGEABLE since 09-16" hid an unresolved CHANGES_REQUESTED. Read `gh pr view --json reviewDecision,reviews` before calling a PR idle; "repro compiles + validates" is not the reviewer's bar, and a PR with an open soundness concern does not claim `Closes #X` ([verify review state before "idle-mergeable"](../learnings/1790310304171-verify-a-pr-s-actual-review-state-before-framing-i.md)).

**Approvals and pushes.** A new head commit dismisses an approval (`APPROVED` → `REVIEW_REQUIRED`); body edits do not, and when an approval survives a base-branch merge GitHub rewrites its `commit_id` to the new head (#13849) ([review commit field can move forward](../learnings/1793176871441-github-review-commit-field-can-move-forward-to-a-l.md)). Comment-only rewords dismissed approvals on #12034 and #12009, both then relayed as "approved". Push after approval only for a requested code change or a real CI fix; for a requested cosmetic change, say it dismisses the approval and let the maintainer decide. Even a requested change costs the approval (#13880; a merge-master on #13815), so after any push every status says "dismissed, awaiting re-approval", and a later CI failure is a question to the maintainer before another push ([a push after approval dismisses it](../learnings/1793851667014-a-push-after-approval-dismisses-it-on-shader-slang.md)). `mergeable_state=behind` on an approved, conflict-free PR is benign; #13880 entered the merge queue 25 commits behind ([Closes #N / draft footprint](../learnings/1785751816891-closes-n-does-not-excuse-an-issue-footprint-while-.md)).

"Approved at HEAD" means `decision=="APPROVED"` plus an approval whose `commit == head` and whose `submittedAt` is later than the head commit's committer date; with only the first two, call it "approval carried forward". Supervisors check it before recording a fixer's "approved" as terminal:

```
gh pr view <n> -R <owner>/<repo> --json reviewDecision,headRefOid,reviews --jq '{decision:.reviewDecision, head:.headRefOid, approvals:[.reviews[]|select(.state=="APPROVED")|{who:.author.login, commit:.commit_id}]}'
```

Re-requesting review is a forbidden `requested_reviewers` write; surface it to the parent ([comment-only commit dismisses approval](../learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md)).

## Verifying a Merge

`git merge-base --is-ancestor <branch-sha> origin/main` fails for a squash merge: verify by content (`git show origin/main:path/to/file` after a fetch); `git rev-list --parents -n 1 <sha>` gives merge shape (1 parent = squash/fast-forward). Issue closure lags the merge; re-read. A blocked verification call means UNKNOWN, not UNCHANGED ([squash breaks ancestry checks](../learnings/1785780766923-squash-merge-breaks-ancestry-checks-verify-a-merge.md)).

## CI: Status Checks, Merge Queue, Falcor Workflows

Required status-check names in `shader-slang/slang` equal the job key (kebab-case), so renaming a job key requires updating branch protection; workflow-file changes need a patch handoff because the bot lacks `workflows` permission ([status check name = job key](../learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)).

Investigate evictions via `merge_group` runs (they age out); a batch failure evicts the whole batch; most are Falcor timeout flakes ([merge-queue evictions](../learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)). The shader-coverage `vkdemo::Context` missing-default-constructor break is all-platform, not MSVC-only ([vkdemo break is all-platform](../learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)). A `failed_checks` eviction clears auto-merge, so a post-eviction `autoMergeRequest = null` does not mean it was never on, and the PR will not requeue itself; the bot cannot enqueue, so a green, approved bot PR evicted by a flake needs a manual requeue. Read the timeline (`AutoMergeEnabledEvent` → `RemovedFromMergeQueueEvent`); never call it self-recovering ([eviction clears auto-merge](../learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md)).

The Falcor 3-file YML refactor (dispatcher + build + test reusable workflows) hinges on per-test-type artifact paths, `merge_group` triggers and job-key naming ([Falcor YML refactor gotchas](../learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)). `FALCOR_LOCAL_SLANG` is a relative, per-config build dir, and building Falcor from source needs Slang built with GFX enabled ([FALCOR_LOCAL_SLANG details](../learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)).

## Bot GitHub Writes

`nv-slang-bot` can push and open PRs on `shader-slang/slang-rhi` and the other shader-slang repos; `push:false` in a `.permissions` probe is the normal App-token shape; only a real `git push` is authoritative ([slang-rhi is bot-writable](../learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)).

**Post a comment once.** Re-running the POST with a different `--jq` duplicates it (#12110). Capture `RESP=$(jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input -)` and read `.id` and `.html_url` from `$RESP`; afterwards count comments and delete any duplicate you authored this turn ([POST a comment once](../learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md)).

**Re-push before `gh pr create`.** The PR and CI see the remote branch: on #12148 four local amends were never pushed, so CI failed on already-fixed bugs. After the last amend, `git push --force origin fix/issue-<n>` (only when `origin/master..origin/fix/issue-<n>` holds solely bot-authored commits) and check `git rev-parse HEAD` equals the remote; a `ci_failed` `head_sha` differing from local HEAD means a stale remote. Draft PRs don't auto-run CI on push: `gh workflow run ci.yml --ref fix/issue-<n>` ([re-push before gh pr create](../learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md)).

**No assignee or reviewer on bot PRs.** When jkwak asked the bot on slang#11967 to "make a PR and assign it to me," the ruling was a draft with no `--assignee`/`--reviewer`: the standing operator/dev-team [MUST NOT] on bot assignee/reviewer mutations outranks a maintainer's mechanical request; an @-mention in the description meets the intent. The gate applies at PR-open, separately from operator-gated `gh pr ready`/`merge` ([no-assignee gate beats "assign to me"](../learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md)). `Closes/Fixes #N` stays off a draft PR and does not excuse omitting the issue footprint; a discharged blocker line gets PATCHed in place.

## A Clean Textual Merge Is Not a Semantic Merge

**Sibling PRs in one diagnostic family.** #13514 (nested `try`) claimed its conflict with open #13503 was "textual only". The local merge was clean, but its new `try-nested-throwing-call.slang` then failed: #13503 widened E30091 ("callee in 'try' does not throw") to any non-throwing `FuncType` callee, and because `//DIAGNOSTIC_TEST:SIMPLE` is exhaustive by default, #13514's rows had silently asserted E30091's absence. Merge such PRs in a scratch worktree and run both PRs' new tests (["textual only" sibling conflict](../learnings/1791463760924-conflict-with-sibling-pr-is-textual-only-verify-by.md)).

**Merging master into a long-lived API-changing PR.** Taking over stale #11344 (`_Texture<T:ITexelData>`; `Buffer` arity 2→1), `git merge origin/master` showed only textual conflicts, but code master ADDED after the PR's base using the old API merged cleanly and then failed (three core-module intrinsics, five tests). Grep `git diff --diff-filter=AM <base> origin/master -- source tests tools` for the removed forms, run the full suite, and compare each failure against a master control at the merge SHA ([merging master into an API-changing PR](../learnings/1791498585662-merging-master-into-a-long-lived-api-changing-pr-t.md)).

## Regression Verification Discipline

`build/Release/bin/slangc` is not checkout HEAD: confirm the binary version and checkout ancestry before claiming a repro (slang#11483's crash was a stale pre-#11211 build) ([stale build, not master](../learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)). An author-date inside a [good, bad] window does not put a commit in a release; check `git merge-base --is-ancestor` ([verify commit-vs-tag ancestry](../learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)). The #11483 reporter already had #11211, so the wrong-data symptom is a distinct defect that GPU-free spirv-val cannot refute ([#11483 wrong-data is distinct](../learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)). For coverage-manifest bugs, read the association-copy sites and consumer guards before accepting a "not propagated" root cause (#11629: HEAD contradicted it) ([#11629 root cause contradicted](../learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)). A P0 merge-queue stopper can be self-fixed mid-build (#11814: the reporter merged an identical #11817 ~14h into our build); re-check `gh pr list` and the linked-PR timeline before opening a PR ([P0 stoppers self-fixed mid-build](../learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md)).

## Fix-Direction Discipline

For a codegen asymmetry, converge on the good leg even when lowering it is the smaller diff. On slang#12004 (sampler-vs-texture `[noinline]` SPIR-V param asymmetry), PR #12027's Approach A (pass `SamplerState` by bindless index, like textures) was closed unmerged as "downgrading": by-value `OpTypeSampler` is the desired form, and the texture's by-index reload is the #3252 old-driver workaround, whose relaxation is maintainer-owned ([#12004 Approach A rejected](../learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md)).

A doc-vs-behavior mismatch can be fixed on either side; measure the behavior fix's cost (test churn, output changes, optimization effects) first. On #11682 (`slangc -g0` help text vs. still-emitted `OpSource`/`OpName`), a `None→Minimal` default flip defeated front-end optimizations and gating names on `None` broke ~273 tests, so the maintainer chose a one-line docs fix ([doc-vs-behavior: measure the cost](../learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md)).

**Size the fix to the feature's usage.** "Fix the producer layer" is the default, but a large fix for a low-use feature can be declined outright. On slang#14247 (`printf` ICE on a `ConstantBuffer` argument), jkwak-work (reporter, self-assignee) closed the bot's 15-file draft #14253 ~20 minutes after it opened as "an overkill for the rarely used functionality", named an explicit cast as the workaround and marked it unplanned ([closed as overkill](../learnings/1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel.md)). For a low-use feature (debug intrinsics like `printf`/`abort`), list the smallest option beside the principled one with a size estimate, or ask the assignee which scope they want. A scope-widening review finding (an edge case on another target) is a question for the maintainer, not an automatic must-fix. When a maintainer closes a bot PR, stop peer review, do not reopen or push, and post one short ack ([size the fix to the feature's usage](../learnings/1793740576539-slang-maintainers-close-large-fixes-for-niche-buil.md)). Technical details: [[wiki/concepts/slang-compiler-printf-and-abort-variadic-arguments.md]].

## Code Comments Describe the Code As-Is

**No history, no pointers.** shader-slang maintainers (#12148) ban change-history narration ("unchanged from before this change", "previously we…") and PR/issue pointers ("pending #12150"); both rot at merge. Before pushing, grep added comments for `before this change|unchanged from|previously|see .* issue|pending #|deferred to` ([comments describe code as-is](../learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md)).

**Minimal churn: existing comments stay verbatim.** Touch an existing comment only when its code changed; design rationale goes in the PR explanation comment. On bot PR #13283, jkwak-work's nine inline comments each asked to remove or revert a bot-added or rewritten comment: an "improved" pre-existing comment read worse, doc comments on enum values and caches were "too obvious", and internal details (`FoldPolicy`, cache rationale) stay out of declaration docs. ([minimal comment churn](../learnings/1791941642114-slang-maintainers-want-minimal-comment-churn-keep-.md)).

**A long comment for an exceptional case means restructure.** On slang#12701 jhelferty-nv requested changes on comment style alone: a 13-line doc block for an exceptional case is a smell; reuse existing human comments in their style and ~70-column wrap. The fix restored every pre-existing comment and removed the case: optional `defaultArgSource` became an explicit, always-set argument, the fallback a `SLANG_RELEASE_ASSERT`, and a two-line `///` sufficed ([a long comment for an exceptional case means restructure](../learnings/1791320932441-slang-reviewers-leave-existing-comments-verbatim-a.md)). Any comment on a function is a doc comment: one sentence on what it does, a blank `///`, then the contract if needed. Name parameters by role: `funcDeclRefForDefaultArgs`, not `defaultArgsDeclRef` ([doc comments: brief, blank line, contract](../learnings/1791566071976-slang-doc-comments-one-sentence-what-it-does-brief.md)).

## Triage Boundaries and Park Lifecycles

A rename/branding request is a governance call: park at triage as a feature request, no fixer ([rename is governance](../learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md)). Docs for a compiler-limitation bug belong in the compiler repo (SlangPy docs PR #1060 was redirected) ([docs go in the compiler repo](../learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md)). On slang#12058 the maintainer landed the ASan fix while our fixer was auth-down, validating the triage ([#12058 validated by maintainer fix](../learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md)). A park is not a dead end: slang#12054's self-fix park flipped to a maintainer-authorized bot draft that merged ([#12054 park → bot draft shipped](../learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md)).

**Reassignment after the bot's draft PR exists is a freeze, not a stand-down.** Stand-down (#13420/#13436) covers reassignment *before* a PR exists. On slang#13463 (#13475), jkwak-work reassigned the issue to jkiviluoto-nv 14 hours after the bot draft opened, without declining it; the assignee adopted, approved and merged it five days later. Keep the draft, freeze proactive bot work (no un-draft, rebase, push, re-run or @-mention), relay every human comment verbatim on the canonical thread, and act only on an explicit human ask, fetching before any push. Check a fixer's counter-proposal against the code: an audit of every setting's null path found a third outlier (`clangFormatFallbackStyle` null → silent LLVM style) ([reassign after a bot PR exists: freeze](../learnings/1791822138397-maintainer-reassign-after-a-bot-pr-exists-freeze-d.md)).

## Declined Issues, Reversals, and Superseded PRs

- **#11568 (ResourceDescriptorHeap/SamplerDescriptorHeap)**: declined in favor of `DescriptorHandle<T>`, then reversed: the team is implementing csyonghe's `UntypedResourceHandle`/`UntypedSamplerHandle` proxy types that implicit-cast to resource types ([#11568 reversed](../learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)). The unified descriptor-heap stride work (#11718) changes only SPIR-V emit/CLI/diagnostics and does not remove the E39999 front-end blocker ([#11718 is backend-only](../learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)).
- **#11599 (clip-space Z-remap)**: declined as out of scope ([#11599 declined](../learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md)); a later GLSL-only scope got `CHANGES_REQUESTED` meaning "won't merge to ToT": a cherry-pickable reference PR, not acceptance ([#11599 reference PR](../learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)).
- **#11681 (DescriptorHandle `_coerce` guard)**: the maintainer preferred removing the dubious `ParameterGroupType` guard entirely over a DescriptorHandle carve-out ([#11681 remove the guard](../learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)).
- **New standard-module proposals (#14020)**: maintainers steer new libraries away from standard modules (each a back-compat burden) toward separate repos via the package manager: issue #12404 (`slang package`/`slang pkg`, open) and open PR #12656 (`slang-package.json` with Git-URL + version-range deps, `slang-package-lock.json`, `v1.2`-style tags; depends on #12984). Say it is unmerged and may change; do not answer for the maintainers ([package manager public refs](../learnings/1793728634729-slang-package-manager-public-refs-12404-pr-12656-s.md)).

## Discord Support Bot Routing

`slang-discord-support` writes only to summon threads in #slang-support/#slang-support-bot; source channels like #slang-discussion are read-only, so answers there come from a human or a summon thread ([support bot posts only to summon threads](../learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)).

**Source learnings (51):**
- [doc comments: brief, blank line, contract](../learnings/1791566071976-slang-doc-comments-one-sentence-what-it-does-brief.md)
- [minimal comment churn](../learnings/1791941642114-slang-maintainers-want-minimal-comment-churn-keep-.md)
- [verify review state before "idle-mergeable"](../learnings/1790310304171-verify-a-pr-s-actual-review-state-before-framing-i.md)
- [Closes #N / draft footprint](../learnings/1785751816891-closes-n-does-not-excuse-an-issue-footprint-while-.md)
- [rotation from indirect evidence](../learnings/1785758534668-reconciling-the-slang-maintainer-rotation-from-ind.md)
- [mergeable_state: THAT, not WHICH](../learnings/1785791831427-mergeable-state-tells-you-that-a-requirement-is-un.md)
- [squash breaks ancestry checks](../learnings/1785780766923-squash-merge-breaks-ancestry-checks-verify-a-merge.md)
- [comments describe code as-is](../learnings/1784573605212-code-comments-must-describe-the-code-as-is-never-c.md)
- [leave existing comments verbatim](../learnings/1791320932441-slang-reviewers-leave-existing-comments-verbatim-a.md)
- [tfoley is Theresa Foley](../learnings/1777487718343-slang-compiler-tess-foley-name.md)
- [handoff: verify live PR state](../learnings/1779622726384-slang-maintainer-handoff-verify-on-pr-state-agains.md)
- [verify commit-vs-tag ancestry](../learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md)
- [stale build, not master](../learnings/1780648913125-correction-slang-11483-crash-was-a-stale-pre-11211.md)
- [#11483 wrong-data is a distinct defect](../learnings/1780820664909-slang-11483-reporter-s-release-already-had-11211-w.md)
- [slang-rhi is bot-writable](../learnings/1781057580026-CONSOLIDATED-slang-rhi-is-bot-writable.md)
- [support bot: summon threads only](../learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md)
- [vkdemo break is all-platform](../learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md)
- [status check name = job key](../learnings/1781311479883-slang-required-status-check-name-job-key-kebab-cas.md)
- [Falcor YML refactor](../learnings/1781366281118-slang-11600-falcor-3-file-yml-refactor-implementat.md)
- [FALCOR_LOCAL_SLANG](../learnings/1781368939396-correction-falcor-local-slang-usage-details-verifi.md)
- [#11629 root cause contradicted](../learnings/1781626696031-slang-11629-reporter-s-root-cause-contradicted-by-.md)
- [maintainer is dynamic](../learnings/1782144700294-current-slang-maintainer-is-dynamic-ask-the-slang-.md)
- [#11681 remove the guard](../learnings/1782164510013-addendum-slang-11681-maintainer-preferred-removing.md)
- [#11599 declined as out of scope](../learnings/1782171529298-slang-11599-clip-space-z-remap-declined-by-maintai.md)
- [#11718 is backend-only](../learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md)
- [merge-queue evictions: mostly Falcor flakes](../learnings/1782392258907-investigating-merge-queue-evictions-in-shader-slan.md)
- [#11568 reversed: UntypedResourceHandle](../learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md)
- [#11599 reference PR](../learnings/1782512199002-slang-11599-feature-delivered-as-a-cherry-pickable.md)
- [P0 stoppers self-fixed](../learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md)
- [#12004 Approach A rejected](../learnings/1783635981424-slang-12004-outcome-approach-a-rejected-as-downgra.md)
- [rename is governance](../learnings/1783935538903-triage-of-rename-branding-requests-governance-not-.md)
- [docs go in the compiler repo](../learnings/1783943839130-docs-for-a-compiler-limitation-bug-belong-in-the-c.md)
- [#12058 validated by maintainer fix](../learnings/1783977766628-triage-validated-by-maintainer-s-own-merged-fix-a-.md)
- [#12054 park → bot draft shipped](../learnings/1783981181191-slang-12054-shipped-park-for-self-fix-that-flipped.md)
- [comment-only commit dismisses approval](../learnings/1784048274524-never-push-after-a-maintainer-approves-even-a-comm.md)
- [a push after approval dismisses it](../learnings/1793851667014-a-push-after-approval-dismisses-it-on-shader-slang.md)
- [review commit field moves forward](../learnings/1793176871441-github-review-commit-field-can-move-forward-to-a-l.md)
- [jhelferty-nv login = triage automation](../learnings/1793176874441-jhelferty-nv-s-github-identity-is-used-by-the-slan.md)
- [automation acts under human logins](../learnings/1793609312966-slang-falcor-ci-gate-opens-when-a-maintainer-appro.md) — falcor-ci gate, board events
- [read thread replies for rotation answers](../learnings/1793177249369-watch-list-sweep-judge-a-ci-delivery-fix-by-the-ra.md)
- [POST a comment once](../learnings/1784083867185-never-run-the-gh-post-comment-command-twice-to-cap.md)
- [re-push before gh pr create](../learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md)
- [no-assignee gate beats "assign to me"](../learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md)
- [doc-vs-behavior: measure the cost](../learnings/1784844793184-a-doc-vs-behavior-bug-can-fix-either-side-measure-.md)
- [eviction clears auto-merge](../learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md)
- ["textual only" sibling conflict](../learnings/1791463760924-conflict-with-sibling-pr-is-textual-only-verify-by.md)
- [merging master into an API-changing PR](../learnings/1791498585662-merging-master-into-a-long-lived-api-changing-pr-t.md)
- [reassign after a bot PR: freeze, not stand down](../learnings/1791822138397-maintainer-reassign-after-a-bot-pr-exists-freeze-d.md)
- [#14247 large fix closed as overkill](../learnings/1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel.md)
- [size the fix to the feature's usage](../learnings/1793740576539-slang-maintainers-close-large-fixes-for-niche-buil.md)
- [package manager refs #12404/#12656](../learnings/1793728634729-slang-package-manager-public-refs-12404-pr-12656-s.md)

_Catalog: [[wiki/index.md]]_
