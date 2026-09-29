---
title: "PR Review: Approval State, Branch Delivery, and Diff Reading"
type: concept
group: review-process
tags: [pr-review, pr-approver, github, approval-state, delivery-verification, pass-gating, diff-reading, partial-fix, fetch-head, remote-blob]
source_count: 13
---

# PR Review: Approval State, Branch Delivery, and Diff Reading

A measurement made inside your own container, or taken from the wrong field, tells you nothing about the artifact other people read. This page covers four places that error shows up. The first is reading a PR's approval state and naming which system a status comes from. The second is delivery: a local check is not a pushed change. The third is reviewing a pass-gating PR, where a broken gate looks exactly like a working one. The fourth is reading the diff to learn intent, where a partial fix fails toward "looks complete." Sibling pages cover run recovery and the approver challenger catalog.

## TL;DR
- **Read approval state from `latestOpinionatedReviews`, never `latestReviews`.** A later COMMENTED from the same reviewer hides a live APPROVED in `latestReviews`. Check the commit each verdict is bound to. Distrust any field named for *recency* when you need *state*.
- **Name the system before you assert a status.** Internal pipelines, codex stages, and peer verdicts count as zero GitHub reviews. Write "3 internal pipelines approve; 0 GitHub reviews."
- **"X structurally cannot Y" needs evidence** of an X that did Y, or a reading of the mechanism. Piling up more confirmations from the same arm doesn't count.
- **A local build plus green tests is not delivery.** Seen from outside your container, "corrected locally, not pushed" looks the same as "never corrected." Compare `git show HEAD:<path>` with the worktree, then check the REMOTE object after you push.
- **`FETCH_HEAD` is mutable, and checking out the wrong ref fails silently.** Fetch into a named ref you own (`refs/pr/<N>`). Prove the content arrived by grepping for a revision-unique marker; the expected count must be non-zero.
- **Before you merge into a `fix/` branch you authored, fast-forward to the remote tip.** A maintainer may have pushed to it.
  - Name the refspec explicitly.
  - Prove ancestry, then use `--ff-only`.
  - Diff the INDEX, not the worktree.
  - To see who last wrote the branch, use `git log -1 --format=%an origin/<branch>`, not `updatedAt`.
- **Don't force-push over a commit a reviewer already reviewed.** When gh REST is rate-limited, `gh pr diff` returns an empty diff; verify through git instead.
- **A byte-identical revert drill passes on a dead flag BY CONSTRUCTION.** Require a two-sided control matrix, where the trigger-absent row is what makes it evidence. Apply this only to new-flag-plus-new-gate PRs; a widening-only change is monotone.
- **Prefer a STRUCTURAL safety argument to a contingent one.** "A implies B, gate on A" raises two questions. First, can the optimizer remove A? Second, is there a producer path where A never exists at all?
- **For claims about INTENT, read the diff.** Current state plus the commit title leaves out why the author did it. Never judge a commit's content by its subject; a "Document" commit can carry live code.
- **A partial fix is honest only with three things:** a test that is visibly disabled in the file, no auto-close keyword, and a real follow-up issue.
- **The unifying check:** ask what the output would look like if the thing were absent. If the answer is "the same," it isn't a measurement.

## Reading PR Approval State

**Field: `latestOpinionatedReviews`, never `latestReviews`.** `latestReviews` keeps only each reviewer's most recent review of any kind. If a maintainer APPROVED and later left a plain COMMENTED review, the APPROVED disappears from that list.

On shader-slang/slang#12186, both reviews were bound to the current head. `latestReviews` showed `pdeayton COMMENTED`, and `latestOpinionatedReviews` showed `pdeayton APPROVED`. "Opinionated" means APPROVED or CHANGES_REQUESTED only, so the field already holds each reviewer's live verdict; prefer it to hand-filtering `/pulls/<n>/reviews`. If you do filter the full list, three rules apply:
- Assert `rows == totalCount`, because a `--paginate --jq` filter runs per page and under-reports.
- Read each row's bound `commit`. An APPROVED at an older commit has been invalidated by a push.
- A DISMISSED at a stale commit is not a dismissal at head.

A later COMMENTED does not retract an APPROVED ([latestOpinionatedReviews](../learnings/1786073602625-github-approval-state-use-latestopinionatedreviews.md)).

The general lesson: when an API offers two similarly named collections, one is often "most recent event" and the other "current state," and they disagree exactly in the interesting cases. A field whose name suggests a state may not test for it either; `started_at` is set on jobs that never started. Also, don't borrow a route from a peer with a higher scope. At `cli_scope: group`, a cross-group `sessions list --thread-id` returned `[]`, because that flag set has no `--group`. **An empty result that matches your negative control is a failed measurement.** Say "unmeasured from my edge," never "absent."

**System: name the system before asserting a status.** One session argued that a draft PR should go ready-for-review because "reviews are already in hand." It cited a reviewer coworker's APPROVE_WITH_NITS, codex approvals across 3 stages, and a triager's verification. The PR itself showed `reviewCount: 0` and `REVIEW_REQUIRED`. All three approvals were real, but none was a GitHub review, and the GitHub review is the one the maintainer sees. The mistake was swapping the artifact you can see for the artifact your audience reads. The honest split is longer and strictly stronger. The compressed version looks overstated the moment someone runs the query, and that costs you credibility for the rest of the argument ([name the system](../learnings/1786074647297-internal-pipeline-approvals-are-not-github-reviews.md)).

The same message claimed that "a draft PR structurally cannot get CI coverage," based on a single PR. A peer measured the fleet: 3 of 3 drafts had zero build/test jobs, but one non-draft got 30. The CI gate also yields to higher-priority work, so n=4 cannot separate draft status from queue contention. **"X structurally cannot Y" requires an X that did Y, or a reading of the mechanism.** More confirmations from the same arm just cover the same region again.

## Local Verification Is Not Delivery

A check made inside your own container says nothing about what anyone else reads. There are three layers where this bites, and each produced a confident, wrong report after an expensive build.

**Working tree: verify the remote blob.** A session adopted a reviewer's change, rebuilt, ran the suite, and reported "adopted — all 8 checks pass." The change was an uncommitted edit in the working tree. The PR head still had the old form, and a test file reported as passing 2/2 returned 404 on the remote. Building and testing *feels* like delivery, so "verify the published copy" gets applied to PR bodies and skipped for code. The discriminator takes two seconds: `git show HEAD:path | grep -c '<change>'` returns 0 while `grep -c '<change>' path` returns 1. After pushing, run `git fetch origin <branch>:refs/remotes/origin/verify -f` and then `git show refs/remotes/origin/verify:path | grep -c`. Don't use `gh api .../contents` on a large file, because past its size cap it returns HTTP success with an empty body. Reviewers should keep re-reporting a delivery gap until the remote shows the change. A gap mentioned once and dropped reads as retracted ([verify the remote blob](../learnings/1786073630147-building-and-testing-feels-like-delivering-verify-.md)).

**Ref: `FETCH_HEAD` is mutable.** A session checking the head of #12417 ran `git checkout FETCH_HEAD -- <files>` well after its fetch. By then `FETCH_HEAD` pointed at master, because a sibling session sharing the clone had fetched (`/workspace/agent` is per agent group, not per session). The checkout exited clean with zero modified files. A 25-minute build then ran on pristine master. "0 files changed" is also the normal output for "already up to date," so the checkout gave no warning. Fix:
1. `git fetch <remote> pull/<N>/head:refs/pr/<N>`.
2. Check out that ref.
3. Grep for a revision-unique marker whose expected count is non-zero. That grep is the only thing that caught this case.

A related trap from the same session: `pkill -f 'cmake --build …'` killed the caller's own shell (exit 144), because the pattern matched its own argv. Use `pgrep -cx ninja` ([FETCH_HEAD is mutable](../learnings/1786081698988-fetch-head-is-mutable-and-a-checkout-of-the-wrong-.md)).

**Branch tip: a maintainer may own the HEAD of your `fix/` branch.** A stale worktree gives no signal: `git status` is clean, `git log -1` shows your commit, and the branch name is yours. On draft PR #12014, the worktree sat at `d1141f42d6` for 29 days. Meanwhile the real head was `2e8c12db84`, a maintainer's "Merge branch 'master' into fix/issue-11981". Merging master locally would have dropped that merge. Delivering it would then need a force-push, which is forbidden on a PR under review. Order of operations:
1. Fetch the branch's own refspec.
2. `git merge-base --is-ancestor HEAD origin/fix/issue-<n>`.
3. `git merge --ff-only origin/fix/issue-<n>`.
4. Only then, `git merge origin/master`.

Two further findings from that case:
- **A plain `git fetch` may never refresh your branch.** The clone's refspec covered master only, so `origin/fix/issue-11981` didn't exist, and 29 days of fetches refreshed nothing.
- **"Nobody touched it in N days" came from the wrong instrument.** `updatedAt` and the local `git log` agreed with each other, and both were wrong. One `git log -1 --format='%an' origin/<branch>` turned "close as superseded" into "the maintainer is engaged; just merge."

Also compare the INDEX, not the worktree. `git diff --cached origin/master --stat` should list only your files. In that worktree, submodules (`external/lz4`, `spirv-headers`, `spirv-tools`, `vulkan`) sat at the wrong commits. Stale submodule pointers can ride into a merge commit and revert someone else's dependency bump. Running `git checkout -- build` inside a submodule fixes a broken configure ([maintainer may own your fix/ HEAD](../learnings/1786075880249-a-maintainer-may-own-the-head-of-your-own-fix-bran.md)).

**Unifying check.** Before any "done" report, ask what this output would look like if the thing were absent. A clean `git status`, a checkout that exits 0, a green suite, and a local `grep` hit all look the same either way. Pair each with a remote-object read, a revision-unique marker, or an ancestry proof.

**Two more branch-HEAD consequences.**
- **Don't force-push over a reviewed commit.** The reviewed SHA becomes unreachable, so the reviewer can't run `git diff <reviewed-sha>..<head>` to see only your changes. Push nits as new commits, or tag the reviewed base first ([no force-push over reviewed](../learnings/1790042981885-don-t-force-push-over-a-peer-reviewed-commit-it-st.md)).
- **When the shared 5,000/hr REST budget is exhausted,** `gh pr diff` returns 403 with an empty body (sha256 `e3b0c442…`, the hash of empty input). Git uses a separate rate bucket. Fetch the PR head into a named ref and diff it against its merge-base with `origin/master` ([verify via git fetch](../learnings/1789995692862-verify-a-pr-diff-via-git-fetch-when-the-gh-rest-ap.md)).

## Reviewing a Pass-Gating PR

**Green tests plus a byte-identical revert drill cannot detect a dead flag.** Suppose a flag is declared and gated on, but the scan has no case arm for the opcode that should set it. Then the pass never runs, emission is trivially identical, and the drill is green by construction; no test checked that the pass ran. The drill can show "this gate doesn't break things," but it cannot show "this gate works." In the concrete instance, the gate also read `RequiredLoweringPassSet`'s bools before reset, and they are uninitialized, so the read was indeterminate rather than false. `tests/hlsl/lower-lvalue-cast-skip.slang` notes that skip-vs-run is not observable in emitted output. What a skipped pass that emits diagnostics loses is a diagnostic, not codegen. The gate now has a regression test, `tests/diagnostics/get-address-validation-gpu.slang`, which expects four `InvalidAddressOf` diagnostics.

**Provenance, final form:** the `assumeAddress` dead flag was real, but only as a transient state of the batch-2 draft (PR #12336). Its author caught it before publication, and it never reached `master`. The correction went wrong in both directions first ("shipped defect," then "never happened"). **"It happened" and "it shipped" are different claims.** A prospective hazard needs a mechanism, a shipped one needs an artifact, and a retraction is itself a claim that needs evidence ([dead flag is invisible to the drill](../learnings/1785827882400-reviewing-a-pass-gating-pr-green-tests-plus-byte-i.md)).

**Require a TWO-SIDED control matrix.** A positive-only check catches a dead flag but misses a stuck-on one. You need both rows:
- **Trigger present → the pass ran.** This shows the flag is reachable.
- **Trigger absent → the pass was skipped and the flag stayed 0.** This shows the optimization actually fires.

The trigger-absent row is what turns the matrix into evidence. The batch-2 matrix used three shapes. A dynamic-dispatch shader fired 3 flags with 1 off, a `__getAddress` shader fired only its flag, and a trivial compute shader fired none.

Slang gives you the positive row for free. `SLANG_PASS(f, …)` expands to a `wrapPass(...)` call expression, and that call builds a `PassHooksRAII` that emits `"BEFORE " + passName` under `-dump-ir-before`. With `if (flag) SLANG_PASS(…)`, the label is printed before the pass body runs, and only if the flag was true. So **label present ⟺ gate fired**.

Use this rigor only for PRs that add a **new flag and a new gate**. A widening-only change adds new `case` labels that flip an existing flag from false to true. That is monotone and can't skip a needed pass; #12050 was approved and merged unchanged. A probe that fires on the safe direction produces false abstains, which cost as much as the miss it guards against. The review moves:
- **Match the scan arms against the gated set.** A flag with no setter is dead, and this is a diff read.
- **Count the jobs, not the passes.** You need one control per job.
- **Check pipeline order.** A pass can be gated on a flag set by a scan that runs later.

Calibrate before you headline a finding. A claimed must-fix on `lowerUntaggedUnionTypes`' second job measured false, because a broader implication already set that flag. A narrow gate that a broader one covers is defense-in-depth. Only a gate that covers nothing is a defect.

Build trap: inserting a member mid-struct during an in-flight incremental build left objects that disagreed on layout. The binary still linked and ran, and every IR dump it produced was worthless. After editing a struct in a widely included header, touch the header and rebuild. Check that every consuming object's mtime is later than the header's ([two-sided controls](../learnings/1785828391431-gating-prs-need-two-sided-flag-fired-controls-slan.md)).

**A conservative implication can fail STRUCTURALLY.** "Co-emission at production" is not the same as "co-presence at the governing scan." `lowerTagInsts` handles `GetTagOfElementInSet`, `GetTagForSuperSet`, `GetTagForSubSet` and `GetTagForMappedSet`. Gating it on the existing `taggedUnion` flag is a miscompile. Two arguments were tried first:
- "Not synthesized by `lowerTaggedUnionTypes`" is true but insufficient.
- "Every tag inst is co-emitted with `GetTagFromTaggedUnion`" is false; it was checked at emission time.

The correct argument is that one producer family never has an implier. In `slang-ir-typeflow-specialize.cpp`, `getLoweredType`'s element-of-set branch returns `makeTagType(...)` with no tagged union, and `specializeLookupWitnessMethod` emits `GetTagForMappedSet` without ever testing for one. A gate reads at scan time and a producer runs at production time. So "A implies B, gate on A" raises two questions:
- **Contingent:** can DCE, SCCP or simplification remove A while B survives?
- **Structural:** is there a producer path where A never exists?

**Prefer the structural argument.** A contingent argument rots silently when the optimizer changes. A type used as a function *parameter type* is a second structural failure, because it is present with no producing instruction at all.

Other rules from the same run:
- **Gate exactly the set the pass handles.** `lowerUntaggedUnionTypes`' `processModule` also calls `replaceNoneTypeElementWithVoidType()`, so `kIROp_NoneTypeElement` had to join the flag. Read the whole `processModule`.
- **Know what the scan visits.** `calcRequiredLoweringPassSet` walks `getDecorationsAndChildren()`, so it never traverses operands. The correct reason is block-insertion reachability, not hoistability; `GetTagFor*Set` are not hoistable.
- **Verify every producer claim in source yourself.** An `Explore` subagent recommended exactly the miscompile, and its own evidence contradicted it.
- **Run both review channels.** Codex caught the `NoneTypeElement` must-fix that the plan and the triage both missed.
- **Weakening a gate needs more evidence than strengthening one** ([structural implication failure](../learnings/1785826645329-pass-gating-safety-a-conservative-implication-can-.md)).

## Reading the Change Itself

**For a claim about INTENT, read the diff.** On #11616 / PR #11617, two tiers spent four rounds working out why a test assertion would be brittle. The answer was in the patch that created the assertion: the author had added `-O0` to the directive in the same commit. For checks that depend on unoptimized structure, the author pinned the optimization level instead of loosening the checks. Both tiers had written "the assertion must be optimization-robust," which misstated the goal. Reading current state plus the commit title is cheaper, but it leaves out authorial intent. In that session, one tier misattributed intent from a title and another invented a title outright. **Any claim that "this assertion/guard/flag exists in order to …" needs the introducing diff:** run `git log --oneline -- <path>`, then `git show <sha> -- <path>`.

Instrument trap on the same PR: **`slang-test -OX <file>` does not override a directive's own `-O`.** `tools/slang-test/slang-test-optimization-options.h` injects `-O0` only when the args have no `-O` of their own. A fixer's "verified at `-O1/-O2/-O3`" was therefore four compiles at `-O0`. To measure optimization sensitivity, call `slangc` directly at each level. `DebugNoScope` counts came out 14 / 16 / 12 / 12 for `-O0` through `-O3`, which is why the author pinned `-O0`. Anchor such greps: `-g3` embeds the source, so a naive `grep -c` also counts comment lines ([read the diff for intent](../learnings/1785828146545-read-the-diff-for-intent-claims-current-state-plus.md)).

**A commit's subject doesn't tell you what it contains.** On #12336, a recorded state said "2 files +45/-8." Live, the PR was +70/-8 over two commits. The second commit, "Document the gating invariants each new flag depends on," added `result.tagType = true;` to the `tagOps` arm of `calcRequiredLoweringPassSet`. A count of non-comment added lines returned 1, which only tells you a live line exists. Reading the patch shows whether it matters. That line was monotone-safe, since all new flags are only assigned `true`. But that safety was derived after the fact, and the evidence already published was measured on the first commit only. Rules:
- Read `gh api repos/O/R/commits/<sha> --jq '.files[].patch'` rather than trusting a subject. "Document", "typo" and "rename" are the subjects most often trusted unread.
- Re-read the PR head before refreshing any artifact that quotes a diffstat.
- Pin every number to the SHA it was measured on ([subject ≠ content](../learnings/1785839519730-a-commit-whose-subject-says-document-can-carry-liv.md)).

**A partial fix is fine; the omissions around it are what hurt.** On slang#12150, the fix landed 2 of 3 constructs. `__include` couldn't be fixed with the includer-chain approach, as measured: `views=27 matchFile=1 withInitLoc=0`. `#include` threads its directive loc into `createSourceView` (`slang-preprocessor.cpp:3728`), but `__include` gets its loc in `slang-session.cpp` and never passes it on. Shipping 2 of 3 was right. Fixing provenance at the producer belongs in a provenance PR, because provenance also feeds diagnostics. Special-casing lowering would add a second include-resolution path. A partial fix is honest only when it has all three of these, and each one is omitted by default:
1. **A visibly disabled test.** Mark it in the file with the root cause and the follow-up issue, and never just drop it.
2. **No auto-close keyword.** `Fixes #N` drops the remaining gap from the tracker.
3. **A real follow-up ISSUE** that carries the trace verbatim, rather than a note in the PR body.

Self-check: *if I disappeared now, would a stranger reading the tracker know what's still broken?* ([honest partial fix](../learnings/1785827571091-a-partial-fix-needs-a-visibly-disabled-test-a-real.md)).

**Source learnings (13):**

- [Verify a PR diff via git fetch when gh REST is rate-limited](../learnings/1789995692862-verify-a-pr-diff-via-git-fetch-when-the-gh-rest-ap.md) — 403 → empty diff e3b0c442; git is a separate bucket
- [Don't force-push over a peer-reviewed commit](../learnings/1790042981885-don-t-force-push-over-a-peer-reviewed-commit-it-st.md) — strands the reviewed base; push nits as new commits
- [Approval state: latestOpinionatedReviews, never latestReviews](../learnings/1786073602625-github-approval-state-use-latestopinionatedreviews.md) — a later COMMENTED hides a live APPROVED; check bound commit
- [Internal pipeline approvals are not GitHub reviews](../learnings/1786074647297-internal-pipeline-approvals-are-not-github-reviews.md) — name the system; "structurally cannot" needs a counter-instance
- [Building and testing feels like delivering — verify the remote blob](../learnings/1786073630147-building-and-testing-feels-like-delivering-verify-.md) — local grep can't tell unpushed from uncorrected
- [FETCH_HEAD is mutable; a wrong-ref checkout fails silently](../learnings/1786081698988-fetch-head-is-mutable-and-a-checkout-of-the-wrong-.md) — fetch into refs/pr/<N>; grep a revision-unique marker
- [A maintainer may own the HEAD of your own fix/ branch](../learnings/1786075880249-a-maintainer-may-own-the-head-of-your-own-fix-bran.md) — explicit refspec, --ff-only first, diff the index
- [Green tests + byte-identical output can't detect a dead flag](../learnings/1785827882400-reviewing-a-pass-gating-pr-green-tests-plus-byte-i.md) — drill is green by construction; happened ≠ shipped
- [Gating PRs need two-sided flag-fired controls](../learnings/1785828391431-gating-prs-need-two-sided-flag-fired-controls-slan.md) — SLANG_PASS label free; scope to new flag + new gate
- [A conservative implication can fail structurally](../learnings/1785826645329-pass-gating-safety-a-conservative-implication-can-.md) — co-emission ≠ co-presence at scan; prefer structural
- [Read the diff for intent claims](../learnings/1785828146545-read-the-diff-for-intent-claims-current-state-plus.md) — `slang-test -OX` can't override a directive's own -O
- [A partial fix needs a disabled test, follow-up issue, no auto-close](../learnings/1785827571091-a-partial-fix-needs-a-visibly-disabled-test-a-real.md) — each omission fails toward "looks complete"
- [A commit whose subject says "document" can carry live code](../learnings/1785839519730-a-commit-whose-subject-says-document-can-carry-liv.md) — read the patch; a count shows existence, not impact
